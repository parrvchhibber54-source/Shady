import {parseAudioResult,type AudioResult} from './audio-config';
export async function pollAudioResult(job:string,signal:AbortSignal,onProcessing:()=>void):Promise<AudioResult>{
 const deadline=Date.now()+120_000;let delay=2000;
 for(let attempts=0;attempts<30&&Date.now()<deadline;attempts++){
  await new Promise<void>((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},delay);if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});});
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  const response=await fetch('/api/analyze-audio',{headers:{Authorization:`Bearer ${job}`},signal,cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Could not check the existing audio analysis. No upload was retried.');
  if(data.state==='completed')return parseAudioResult(data.result);
  if(data.state!=='processing')throw new Error('An unexpected audio response was returned.');
  onProcessing();delay=Math.min(delay*1.5,8000);
 }
 throw new Error('Audio polling timed out. Check the Reality Defender dashboard for the existing scan. No upload was retried.');
}
