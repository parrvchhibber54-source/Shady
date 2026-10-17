export const MAX_VIDEO_BYTES=100*1024*1024;
export const MAX_VIDEO_SECONDS=120;
export const MAX_VIDEO_FRAMES=7200;
export const VIDEO_POLL_MS=7260000;
export const VIDEO_BROWSER_MS=7440000;
export const WAVEREP_REVISION='0fd6010759c14b572b7842a28fa9f85fe1ddd2fd';
export type VideoFrame={index:number;timestamp:number;llr:number};
export type VideoResult={provider:'WaveRep';checkpoint:'G4';source_revision:typeof WAVEREP_REVISION;coverage:'all_decoded_frames';crop:504;duration:number;frames:VideoFrame[];mean_llr:number;sigmoid_mean_llr:number;synthetic_frame_count:number;frame_count:number;processing_seconds:number;device:'cpu'};
export function validateVideoFile(file:{name:string;size:number;type:string}){
 if(!file.size||file.size>MAX_VIDEO_BYTES)return 'Choose a non-empty MP4 up to 100 MiB.';
 if(!/\.mp4$/i.test(file.name)||(file.type&&file.type!=='video/mp4'))return 'Choose an MP4 with H.264 video.';
 return null;
}
export function parseVideoResult(input:unknown):VideoResult{
 if(!input||typeof input!=='object')throw new Error('Invalid WaveRep result');
 const d=input as VideoResult;
 if(d.provider!=='WaveRep'||d.checkpoint!=='G4'||d.source_revision!==WAVEREP_REVISION||d.coverage!=='all_decoded_frames'||d.crop!==504||d.device!=='cpu'||!Number.isFinite(d.duration)||d.duration<=0||d.duration>MAX_VIDEO_SECONDS||!Number.isFinite(d.processing_seconds)||d.processing_seconds<0||!Array.isArray(d.frames)||d.frames.length<1||d.frames.length>MAX_VIDEO_FRAMES||d.frame_count!==d.frames.length)throw new Error('Invalid WaveRep result');
 const frames=d.frames.map((f,i)=>{
  if(!f||f.index!==i||!Number.isFinite(f.timestamp)||f.timestamp<0||f.timestamp>d.duration||(i>0&&f.timestamp<=d.frames[i-1].timestamp)||!Number.isFinite(f.llr))throw new Error('Invalid WaveRep frame');
  return {index:i,timestamp:f.timestamp,llr:f.llr};
 });
 if(frames[0].timestamp!==0)throw new Error('Invalid WaveRep frame origin');
 const mean=frames.reduce((n,f)=>n+f.llr/frames.length,0);
 const sigmoid=mean>=0?1/(1+Math.exp(-mean)):Math.exp(mean)/(1+Math.exp(mean));
 if(!Number.isFinite(d.mean_llr)||Math.abs(mean-d.mean_llr)>1e-6*Math.max(1,Math.abs(mean))||!Number.isFinite(d.sigmoid_mean_llr)||Math.abs(sigmoid-d.sigmoid_mean_llr)>1e-6||d.synthetic_frame_count!==frames.filter(f=>f.llr>0).length)throw new Error('Invalid WaveRep aggregation');
 return {provider:'WaveRep',checkpoint:'G4',source_revision:WAVEREP_REVISION,coverage:'all_decoded_frames',crop:504,duration:d.duration,frames,mean_llr:d.mean_llr,sigmoid_mean_llr:d.sigmoid_mean_llr,synthetic_frame_count:d.synthetic_frame_count,frame_count:frames.length,processing_seconds:d.processing_seconds,device:'cpu'};
}
export type VideoJob={state:'processing'|'completed'|'failed'|'cancelled';progress:{processed_frames:number;total_frames:number}|null;result?:VideoResult;error?:string};
export function parseVideoJob(input:unknown):VideoJob{
 if(!input||typeof input!=='object')throw new Error('Invalid video job');const d=input as VideoJob;
 if(!['processing','completed','failed','cancelled'].includes(d.state))throw new Error('Invalid video state');
 let progress=null;
 if(d.progress!==null&&d.progress!==undefined){const p=d.progress;if(!Number.isInteger(p.processed_frames)||!Number.isInteger(p.total_frames)||p.total_frames<1||p.total_frames>MAX_VIDEO_FRAMES||p.processed_frames<0||p.processed_frames>p.total_frames)throw new Error('Invalid video progress');progress={processed_frames:p.processed_frames,total_frames:p.total_frames};}
 const job:VideoJob={state:d.state,progress};
 if(d.state==='completed')job.result=parseVideoResult(d.result);
 if(d.state==='failed'||d.state==='cancelled')job.error=typeof d.error==='string'&&d.error.length<=300?d.error:'Video analysis failed. No assessment is available.';
 return job;
}
