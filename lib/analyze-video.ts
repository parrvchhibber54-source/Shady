import 'server-only';
import {createHash} from 'node:crypto';
import {MAX_VIDEO_BYTES,parseVideoJob} from './video-config';
import {videoUrl} from './video-service';
import {boundedRead,AudioFailure} from './reality-defender';
const buckets=new Map<string,{count:number;until:number}>(),active=new Set<string>();
const handles=new Map<string,{until:number;nextPoll:number;polling:boolean}>();
function json(data:object,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store',...(status===429?{'Retry-After':'3'}:{})}});}
function originGuard(request:Request){const url=new URL(request.url);const origin=request.headers.get('origin');return !origin||origin===`${url.protocol}//${request.headers.get('host')||url.host}`;}
async function data(response:Response,signal:AbortSignal){try{return JSON.parse((await boundedRead(response.body,2*1024*1024,signal)).toString('utf8'));}catch{throw new Error('Video service returned an unreadable response.');}}
export async function uploadVideo(request:Request){
 let key:string|undefined,owns=false;
 try{
  if(!originGuard(request))return json({error:'This request must come from this website.'},403);
  const now=Date.now();for(const [k,b] of buckets)if(b.until<=now)buckets.delete(k);for(const [k,h] of handles)if(h.until<=now)handles.delete(k);
  const ip=process.env.TRUST_PROXY==='true'?request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'local':'local';key=createHash('sha256').update(ip).digest('hex');
  const bucket=buckets.get(key)||{count:0,until:now+60000};if(bucket.count>=3||buckets.size>=10000&&!buckets.has(key)||handles.size>=100)return json({error:'Too many video requests. Wait a minute.'},429);bucket.count++;buckets.set(key,bucket);
  if(active.has(key))return json({error:'A video upload is already in progress.'},409);
  if(active.size>=1)return json({error:'Video analysis is busy. Please try later.'},429);
  if(request.headers.get('content-type')?.split(';')[0]!=='video/mp4')return json({error:'Upload MP4 video bytes.'},415);
  const length=Number(request.headers.get('content-length'));
  if(length>MAX_VIDEO_BYTES)return json({error:'Video exceeds 100 MiB.'},413);
  if(!request.body||length<0)return json({error:'Choose a non-empty MP4.'},422);
  active.add(key);owns=true;const signal=AbortSignal.any([request.signal,AbortSignal.timeout(120000)]);
  let bytes=0;
  // Backpressure passes bounded chunks through; no multipart parsing or full-file copies.
  const body=request.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){bytes+=chunk.byteLength;if(bytes>MAX_VIDEO_BYTES)throw new AudioFailure('Video exceeds 100 MiB.',413);controller.enqueue(chunk);},flush(){if(!bytes)throw new AudioFailure('Choose a non-empty MP4.',422);}}),{signal});
  const init:RequestInit & {duplex:'half'}={method:'POST',headers:{'Content-Type':'video/mp4'},body,duplex:'half',signal,cache:'no-store',redirect:'error'};
  const r=await fetch(videoUrl('/jobs'),init);
  if(!r.ok){void r.body?.cancel().catch(()=>{});return json({error:r.status===429?'WaveRep is busy. Please try later.':r.status===503?'Live video analysis is unavailable. Check the G4 weights and Python service.':'The local video service rejected the upload.'},[429,503,422].includes(r.status)?r.status:502);}
  const d=await data(r,signal);if(typeof d.job!=='string'||!/^[a-f0-9]{64}$/.test(d.job)||d.state!=='processing')throw new Error('Video service returned invalid upload details.');
  handles.set(d.job,{until:Date.now()+9000000,nextPoll:0,polling:false});return json({job:d.job,state:'processing'},202);
 }catch(e){return json({error:e instanceof AudioFailure?'Video upload timed out or exceeded its size limit.':e instanceof Error&&['TimeoutError','AbortError'].includes(e.name)?'Video upload timed out. No upload is retried automatically.':'Live video analysis could not be reached or returned an invalid response.'},e instanceof AudioFailure?e.status:e instanceof Error&&['TimeoutError','AbortError'].includes(e.name)?504:502);}
 finally{if(key&&owns)active.delete(key);}
}
export async function videoJob(request:Request){
 let handle:{until:number;nextPoll:number;polling:boolean}|undefined;
 try{
  if(!originGuard(request))return json({error:'This request must come from this website.'},403);
  const token=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];handle=token?handles.get(token):undefined;
  if(!token||!handle||handle.until<=Date.now())return json({error:'Video job expired or server restarted.'},404);
  const cancel=request.method==='DELETE';
  if(!cancel&&(handle.polling||handle.nextPoll>Date.now()))return json({error:'Wait before checking the video again.'},429);
  handle.polling=true;handle.nextPoll=Date.now()+1000;
  const signal=AbortSignal.timeout(8000);const r=await fetch(videoUrl(`/jobs/${token}`),{method:cancel?'DELETE':'GET',signal,cache:'no-store',redirect:'error'});
  if(!r.ok){void r.body?.cancel().catch(()=>{});return json({error:'Video service is unavailable or this job expired.'},r.status===404?404:503);}
  if(cancel){await r.body?.cancel();return json({state:'cancelling'});}
  return json(parseVideoJob(await data(r,signal)));
 }catch{return json({error:'Could not check the local video analysis. No new upload was submitted.'},502);}
 finally{if(handle)handle.polling=false;}
}
export function resetVideoLimitsForTests(){buckets.clear();active.clear();handles.clear();}
