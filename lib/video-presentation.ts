import type {VideoFrame} from './video-config';
// Display aggregation only: every frame still participates in inference and mean LLR.
// Preserve extrema so a short positive section survives chart reduction.
export function timelineEnvelope(frames:VideoFrame[],buckets=300){
 const points:VideoFrame[]=[];
 const width=Math.max(1,Math.ceil(frames.length/buckets));
 for(let start=0;start<frames.length;start+=width){
  const slice=frames.slice(start,start+width);
  const min=slice.reduce((a,b)=>a.llr<=b.llr?a:b),max=slice.reduce((a,b)=>a.llr>=b.llr?a:b);
  points.push(...[...new Map([slice[0],min,max,slice[slice.length-1]].map(f=>[f.index,f])).values()].sort((a,b)=>a.index-b.index));
 }
 return points;
}
export function suspiciousRuns(frames:VideoFrame[]){
 const runs:{first:VideoFrame;last:VideoFrame;count:number;peak:VideoFrame}[]=[];
 for(const frame of frames){
  if(frame.llr<=0)continue;
  const previous=runs[runs.length-1];
  if(previous&&previous.last.index===frame.index-1){previous.last=frame;previous.count++;if(frame.llr>previous.peak.llr)previous.peak=frame;}
  else runs.push({first:frame,last:frame,count:1,peak:frame});
 }
 return runs;
}
