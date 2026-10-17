import 'server-only';
import { createHash } from 'node:crypto';
import {serviceUrl} from './text-service';
import { parseTextResult, validateText } from './text-config';
const MAX_BODY = 64 * 1024;
const MAX_RESPONSE = 16 * 1024;
const buckets = new Map<string,{count:number;until:number}>();
const active = new Set<string>();
let globalWindow = {count:0,until:0};
function json(body:object,status=200,headers={}) { return Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}}); }
function error(message:string,status:number,headers={}) { return json({error:message},status,headers); }
class BodyFailure extends Error {constructor(public status:number){super('Body unavailable');}}
async function readBounded(body:ReadableStream<Uint8Array>|null,max:number,timeout:number) {
  if (!body) throw new BodyFailure(400);
  const reader=body.getReader();let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    const timeoutPromise=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(new BodyFailure(408));void reader.cancel().catch(()=>{});},timeout);});
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await Promise.race([reader.read(),timeoutPromise]);if(done)break;size+=value.length;if(size>max){void reader.cancel().catch(()=>{});throw new BodyFailure(413);}chunks.push(value);}
    return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));
  } finally {if(timer)clearTimeout(timer);reader.releaseLock();}
}
export async function analyzeText(request:Request):Promise<Response> {
  const url=new URL(request.url),origin=request.headers.get('origin'),host=request.headers.get('host')||url.host;
  if(origin && origin!==`${url.protocol}//${host}`)return error('This request must come from this website.',403);
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return error('Send text as application/json.',415);
  const ip=process.env.TRUST_PROXY==='true' ? request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'local' : 'local';
  const key=createHash('sha256').update(ip).digest('hex'),now=Date.now();
  for(const [k,b] of buckets)if(b.until<=now)buckets.delete(k);
  const bucket=buckets.get(key)||{count:0,until:now+60_000};
  if(bucket.count>=5||(!buckets.has(key)&&buckets.size>=10_000))return error('Too many text requests. Please wait a minute.',429,{'Retry-After':'60'});
  bucket.count++;buckets.set(key,bucket);
  if(active.has(key))return error('A text analysis is already in progress. Please wait.',409);
  if(active.size>=2)return error('Text analysis is busy. Please try later.',429,{'Retry-After':'60'});
  if(Number(request.headers.get('content-length'))>MAX_BODY)return error('The text request is too large.',413);
  active.add(key);
  try {
    let input:unknown;
    try {input=JSON.parse(await readBounded(request.body,MAX_BODY,10_000));}
    catch(e){return error(e instanceof BodyFailure && e.status===408?'The text upload timed out. Try again.':'The text request is invalid or too large.',e instanceof BodyFailure?e.status:400);}
    if(!input||typeof input!=='object'||Array.isArray(input)||!('document' in input)||Object.keys(input).some(k=>k!=='document'))return error('Provide a JSON object containing only document.',400);
    const validation=validateText(input.document);if(validation)return error(validation,422);
    if(Date.now()>=globalWindow.until)globalWindow={count:0,until:Date.now()+60_000};
    if(globalWindow.count>=10)return error('The local text-analysis request limit has been reached. Please wait a minute.',429,{'Retry-After':'60'});
    globalWindow.count++;
    let response:Response;
    try {response=await fetch(serviceUrl('/analyze'),{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({document:input.document}),signal:AbortSignal.timeout(25_000),cache:'no-store',redirect:'error'});}
    catch(e){return error(e instanceof Error && ['TimeoutError','AbortError'].includes(e.name)?'The local detector took too long to respond. Please try later.':'The local detector could not be reached. Please try later.',e instanceof Error && ['TimeoutError','AbortError'].includes(e.name)?504:502);}
    if(!response.ok){void response.body?.cancel().catch(()=>{});
      if(response.status===503)return error('Live text analysis is unavailable. Start the Python service and check model setup.',503);
      if(response.status===429)return error('The local detector is busy. Please try later.',429,{'Retry-After':'10'});
      if([400,413,422].includes(response.status)) {
        return error('Text was rejected. Use readable English prose within 512 tokens after cleaning (including special tokens). Shorten the sample; nothing is truncated.',422);
      }
      return error('The local detector could not complete analysis. Please try later.',502);
    }
    try {const data=JSON.parse(await readBounded(response.body,MAX_RESPONSE,25_000));return json(parseTextResult(data));}
    catch(e){return error(e instanceof BodyFailure&&e.status===408||e instanceof Error&&['TimeoutError','AbortError'].includes(e.name)?'The local detector took too long to return a result. Please try later.':'The local detector returned an unexpected response. No result is available.',e instanceof BodyFailure&&e.status===408||e instanceof Error&&['TimeoutError','AbortError'].includes(e.name)?504:502);}
  } catch {return error('Text analysis could not be completed. Please try later.',502);}
  finally {active.delete(key);}
}
export function resetTextLimitsForTests(){buckets.clear();active.clear();globalWindow={count:0,until:0};}
