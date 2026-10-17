import 'server-only';
import {parseAudioResult,type AudioResult} from './audio-config';
export const RD_BASE='https://api.prd.realitydefender.xyz';
export class AudioFailure extends Error {constructor(message:string,public status=502){super(message);}}
export async function boundedRead(body:ReadableStream<Uint8Array>|null,max:number,signal:AbortSignal):Promise<Buffer>{
  if(!body)throw new AudioFailure('Empty request or response.',400);
  const reader=body.getReader();let size=0;const chunks:Uint8Array[]=[];
  let rejectAbort!:(reason:unknown)=>void;
  const aborted=new Promise<never>((_,reject)=>rejectAbort=reject);
  const onAbort=()=>{rejectAbort(new AudioFailure('Audio request timed out. No upload is automatically resubmitted.',504));void reader.cancel().catch(()=>{});};
  signal.addEventListener('abort',onAbort,{once:true});
  try{if(signal.aborted)onAbort();while(true){const {done,value}=await Promise.race([reader.read(),aborted]);if(done)break;size+=value.length;if(size>max){void reader.cancel().catch(()=>{});throw new AudioFailure('Audio request or response is too large.',413);}chunks.push(value);}return Buffer.concat(chunks);}
  finally{signal.removeEventListener('abort',onAbort);reader.releaseLock();}
}
export async function providerJson(path:string,method:'GET'|'POST',signal:AbortSignal,body?:object):Promise<Record<string,unknown>>{
  let response:Response;
  try{response=await fetch(`${RD_BASE}${path}`,{method,headers:{'X-API-KEY':process.env.REALITY_DEFENDER_API_KEY!.trim(),'Content-Type':'application/json',Accept:'application/json'},body:body?JSON.stringify(body):undefined,signal,cache:'no-store',redirect:'error'});}
  catch{throw new AudioFailure('Reality Defender could not be reached or timed out. No upload was retried.',signal.aborted?504:502);}
  if([401,403,402,429].includes(response.status)){
    void response.body?.cancel().catch(()=>{});
    if(response.status===401||response.status===403)throw new AudioFailure('Reality Defender authentication failed. Check the server key and account access.',503);
    throw new AudioFailure('Reality Defender rate limit or scan quota reached. Check your account dashboard; Shady does not enable paid usage.',429);
  }
  let data:Record<string,unknown>;
  try{data=JSON.parse((await boundedRead(response.body,256*1024,signal)).toString('utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw new Error();}
  catch(e){if(e instanceof AudioFailure)throw e;throw new AudioFailure('Reality Defender returned an unreadable response.');}
  const code=typeof data.code==='string'?data.code:'';
  if(code.includes('upload-limit-reached')||response.status===402)throw new AudioFailure('Reality Defender scan quota is exhausted. Check your account; no paid usage is enabled by Shady.',429);
  if(code.includes('free-tier-not-allowed'))throw new AudioFailure('This Reality Defender account does not permit this analysis. Check audio API access and your plan.',503);
  if(response.status===401||response.status===403)throw new AudioFailure('Reality Defender authentication failed. Check the server key and account access.',503);
  if(response.status===429)throw new AudioFailure('Reality Defender rate limit or quota reached. Check your dashboard before trying later.',429);
  if(!response.ok||typeof data.errno==='number'&&data.errno!==0){
    if([400,413,415,422].includes(response.status))throw new AudioFailure('Reality Defender rejected this recording.',422);
    throw new AudioFailure('Reality Defender could not complete this request.');
  }
  return data;
}
export function parseProviderResult(data:Record<string,unknown>,requestId:string):AudioResult{
  if(data.requestId!==requestId||data.mediaType!=='AUDIO')throw new AudioFailure('Reality Defender returned an unexpected media result.');
  const summary=data.resultsSummary;
  if(summary!==undefined&&summary!==null&&(typeof summary!=='object'||Array.isArray(summary)))throw new AudioFailure('Reality Defender returned an unexpected summary.');
  const s=summary as {status?:unknown;metadata?:{finalScore?:unknown}}|undefined|null;
  const status=s?.status??data.overallStatus;
  const score=s?.metadata?.finalScore??null;
  try{return parseAudioResult({provider:'Reality Defender',status,score});}catch{throw new AudioFailure('Reality Defender returned an unexpected status or score.');}
}
export function signedUpload(data:Record<string,unknown>){
  const response=data.response as {signedUrl?:unknown}|undefined;
  if(typeof data.requestId!=='string'||!/^[a-zA-Z0-9_-]{1,200}$/.test(data.requestId)||typeof response?.signedUrl!=='string')throw new AudioFailure('Reality Defender returned invalid upload details.');
  let url:URL;try{url=new URL(response.signedUrl);}catch{throw new AudioFailure('Reality Defender returned an invalid upload URL.');}
  // Official API may proxy its signed uploads; AWS destinations are also documented.
  // Exact API host or AWS only; never forward the API key or follow redirects.
  if(url.protocol!=='https:'||url.username||url.password||url.port||!(url.hostname===new URL(RD_BASE).hostname||url.hostname.endsWith('.amazonaws.com')))throw new AudioFailure('Reality Defender returned an unsupported storage destination.');
  return {requestId:data.requestId,url:url.toString()};
}
