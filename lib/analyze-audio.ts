import 'server-only';
import {createHash,randomBytes} from 'node:crypto';
import {audioConfigured} from './credentials';
import {MAX_AUDIO_BYTES,validateAudioFile,inProgress,type AudioResult} from './audio-config';
import {decodeWav} from './wav';
import {AudioFailure,boundedRead,providerJson,signedUpload,parseProviderResult} from './reality-defender';
type Job={requestId:string;until:number;deadline:number;polls:number;nextPoll:number;polling:boolean;result?:AudioResult;uploadFailed?:boolean};
const jobs=new Map<string,Job>(),duplicates=new Map<string,string>(),active=new Set<string>(),buckets=new Map<string,{count:number;until:number}>();
let budget={count:0,until:0},polling=0;
function json(data:object,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store',...(status===429?{'Retry-After':'5'}:{})}});}
function failure(e:unknown){return json({error:e instanceof AudioFailure?e.message:'Audio analysis failed. No upload is automatically resubmitted.'},e instanceof AudioFailure?e.status:502);}
function guard(request:Request){const u=new URL(request.url),origin=request.headers.get('origin');if(origin&&origin!==`${u.protocol}//${request.headers.get('host')||u.host}`)throw new AudioFailure('This request must come from this website.',403);if(!audioConfigured())throw new AudioFailure('Live audio detection is unavailable. Configure REALITY_DEFENDER_API_KEY on the server.',503);}
function clean(){const now=Date.now();for(const [k,j] of jobs)if(j.until<=now)jobs.delete(k);for(const [k,t] of duplicates)if(!jobs.has(t))duplicates.delete(k);for(const [k,b] of buckets)if(b.until<=now)buckets.delete(k);}
export async function uploadAudio(request:Request){
 let key:string|undefined,ownsSlot=false;
 try{
  guard(request);clean();
  const ip=process.env.TRUST_PROXY==='true'?request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'local':'local';
  key=createHash('sha256').update(ip).digest('hex');const now=Date.now(),b=buckets.get(key)||{count:0,until:now+60_000};
  if(b.count>=3||buckets.size>=10000&&!buckets.has(key))throw new AudioFailure('Too many audio uploads. Wait a minute.',429);
  b.count++;buckets.set(key,b);
  if(active.has(key))throw new AudioFailure('An audio upload is already in progress.',409);
  if(active.size>=2||jobs.size>=100)throw new AudioFailure('Audio analysis is busy. Try later.',429);
  if(!request.headers.get('content-type')?.startsWith('multipart/form-data'))throw new AudioFailure('Upload one WAV file using multipart form data.',415);
  if(Number(request.headers.get('content-length'))>MAX_AUDIO_BYTES+65536)throw new AudioFailure('Audio upload exceeds 10 MiB.',413);
  active.add(key);ownsSlot=true;
  const signal=AbortSignal.timeout(25_000);
  const raw=await boundedRead(request.body,MAX_AUDIO_BYTES+65536,signal);
  let form:FormData;try{form=await new Response(new Uint8Array(raw),{headers:{'Content-Type':request.headers.get('content-type')!}}).formData();}catch{throw new AudioFailure('The audio upload could not be read.',400);}
  const all=[...form.entries()];const file=form.get('audio');
  if(all.length!==1||!(file instanceof File))throw new AudioFailure('Choose exactly one audio file.',400);
  const invalid=validateAudioFile(file);if(invalid)throw new AudioFailure(invalid,415);
  const bytes=Buffer.from(await file.arrayBuffer());
  let duration:number;try{duration=decodeWav(bytes).duration;}catch(e){throw new AudioFailure(e instanceof Error?e.message:'Invalid WAV recording.',422);}
  const digest=createHash('sha256').update(key).update(bytes).digest('hex'),existing=duplicates.get(digest);
  if(existing){const job=jobs.get(existing)!;return json({job:existing,duration,state:job.uploadFailed?'upload-uncertain':'processing'},202);}
  if(Date.now()>=budget.until)budget={count:0,until:Date.now()+3600_000};
  if(budget.count>=10)throw new AudioFailure('Shady’s local audio submission limit is reached. Check your provider quota and try later.',429);
  budget.count++;
  const data=await providerJson('/api/files/aws-presigned','POST',signal,{fileName:'recording.wav'});
  const upload=signedUpload(data),token=randomBytes(32).toString('hex');
  const job:Job={requestId:upload.requestId,until:Date.now()+600_000,deadline:Date.now()+120_000,polls:0,nextPoll:0,polling:false};
  jobs.set(token,job);duplicates.set(digest,token);
  try{
    const response=await fetch(upload.url,{method:'PUT',body:new Uint8Array(bytes),signal,redirect:'error'});
    void response.body?.cancel().catch(()=>{});
    if(!response.ok)job.uploadFailed=true;
  }catch{job.uploadFailed=true;}
  // A timed-out PUT may still have arrived. Return the existing handle to poll;
  // never repeat the upload or signed-URL request automatically.
  return json({job:token,duration,state:job.uploadFailed?'upload-uncertain':'processing'},202);
 }catch(e){return failure(e);}finally{if(key&&ownsSlot)active.delete(key);}
}
export async function pollAudio(request:Request){
 let job:Job|undefined;
 try{
  guard(request);clean();
  const token=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  job=token?jobs.get(token):undefined;
  if(!job)throw new AudioFailure('Audio analysis handle expired or the server restarted. Check the Reality Defender dashboard before submitting again.',404);
  if(job.result)return json({state:'completed',result:job.result});
  if(Date.now()>job.deadline||job.polls>=40)throw new AudioFailure('Audio polling timed out. The existing scan may still finish; check the Reality Defender dashboard. No new scan was submitted.',504);
  if(job.polling||polling>=4||Date.now()<job.nextPoll)throw new AudioFailure('Please wait before checking this analysis again.',429);
  job.polling=true;job.nextPoll=Date.now()+1500;job.polls++;polling++;
  try{
    const data=await providerJson(`/api/media/users/${encodeURIComponent(job.requestId)}`,'GET',AbortSignal.timeout(8000));
    const result=parseProviderResult(data,job.requestId);
    if(inProgress(result.status))return json({state:'processing'});
    job.result=result;
    return json({state:'completed',result});
  }finally{job.polling=false;polling--;}
 }catch(e){return failure(e);}
}
export function resetAudioLimitsForTests(){jobs.clear();duplicates.clear();active.clear();buckets.clear();budget={count:0,until:0};polling=0;}
