import {VIDEO_POLL_MS,parseVideoJob,type VideoJob,type VideoResult} from './video-config';
export async function pollVideoResult(job:string,signal:AbortSignal,onProgress:(progress:VideoJob['progress'])=>void):Promise<VideoResult>{
 const deadline=Date.now()+VIDEO_POLL_MS;
 for(let attempt=0;attempt<3630&&Date.now()<deadline;attempt++){
  await new Promise<void>((resolve,reject)=>{const onAbort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',onAbort);resolve();},2000);if(signal.aborted)onAbort();else signal.addEventListener('abort',onAbort,{once:true});});
  const r=await fetch('/api/analyze-video',{headers:{Authorization:`Bearer ${job}`},signal:AbortSignal.any([signal,AbortSignal.timeout(15000)]),cache:'no-store'});const d=await r.json();
  if(!r.ok)throw new Error(typeof d.error==='string'?d.error:'Video polling failed. No upload was retried.');
  const result=parseVideoJob(d);onProgress(result.progress);
  if(result.state==='completed')return result.result!;
  if(result.state!=='processing')throw new Error(result.error||'Video analysis cancelled.');
 }
 throw new Error('Video processing timed out. No partial assessment is shown.');
}
export async function cancelVideo(job:string){try{await fetch('/api/analyze-video',{method:'DELETE',headers:{Authorization:`Bearer ${job}`},keepalive:true,signal:AbortSignal.timeout(8000)});}catch{/* Python enforces its own hard deadline if cancellation cannot reach it. */}}
