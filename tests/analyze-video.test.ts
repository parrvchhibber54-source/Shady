import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {uploadVideo,videoJob,resetVideoLimitsForTests} from '../lib/analyze-video';
import {parseVideoResult,parseVideoJob,MAX_VIDEO_BYTES} from '../lib/video-config';
import {videoStatus} from '../lib/video-service';
import {videoFixture} from './video-fixtures';
const token='a'.repeat(64);
beforeEach(()=>resetVideoLimitsForTests());afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
function request(name='clip.mp4',type='video/mp4'){return new Request('http://localhost/api/analyze-video',{method:'POST',headers:{'Content-Type':type},body:'synthetic bytes'});}
function poll(method='GET'){return new Request('http://localhost/api/analyze-video',{method,headers:{Authorization:`Bearer ${token}`}});}
it('preserves actual timestamps, LLRs and official aggregation; strips private fields',()=>{expect(parseVideoResult({...videoFixture(),path:'private'})).toEqual(videoFixture());expect(parseVideoResult(videoFixture()).mean_llr).not.toBe(.5);});
it.each([{...videoFixture(),mean_llr:0},{...videoFixture(),synthetic_frame_count:3},{...videoFixture(),sigmoid_mean_llr:.5},{...videoFixture(),frame_count:4},{...videoFixture(),frames:[{index:0,timestamp:0,llr:NaN}]},{...videoFixture(),source_revision:'other'},{...videoFixture(),frames:[{index:0,timestamp:1,llr:0}]}])('rejects malformed or inconsistent assessment',d=>expect(()=>parseVideoResult(d)).toThrow());
it('only accepts actual bounded progress',()=>{expect(parseVideoJob({state:'processing',progress:null}).progress).toBeNull();expect(()=>parseVideoJob({state:'processing',progress:{processed_frames:4,total_frames:3}})).toThrow();});
it('uploads raw bytes only to the private service and polls the existing job',async()=>{const mock=vi.fn().mockResolvedValueOnce(Response.json({job:token,state:'processing'},{status:202})).mockResolvedValueOnce(Response.json({state:'completed',progress:{processed_frames:3,total_frames:3},result:{...videoFixture(),filename:'private'}}));vi.stubGlobal('fetch',mock);expect((await uploadVideo(request())).status).toBe(202);expect(mock.mock.calls[0][0]).toBe('http://127.0.0.1:8002/jobs');expect(mock.mock.calls[0][1].headers).toEqual({'Content-Type':'video/mp4'});const r=await videoJob(poll());expect(r.headers.get('cache-control')).toBe('no-store');expect((await r.json()).result).toEqual(videoFixture());});
it.each([['clip.mov','video/quicktime'],['clip.mp4','image/png']])('validates format %s before inference',async(name,type)=>{const mock=vi.fn();vi.stubGlobal('fetch',mock);expect((await uploadVideo(request(name,type))).status).toBe(415);expect(mock).not.toHaveBeenCalled();});
it('rejects oversized requests and cross-origin calls',async()=>{const r=request();r.headers.set('content-length',String(MAX_VIDEO_BYTES+65537));expect((await uploadVideo(r)).status).toBe(413);const other=request();other.headers.set('origin','https://other.test');expect((await uploadVideo(other)).status).toBe(403);});
it.each([429,503,422])('handles service failure HTTP %s',async status=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:'private detail'},{status})));const r=await uploadVideo(request());expect(r.status).toBe(status);expect(JSON.stringify(await r.json())).not.toContain('private detail');});
it('marks unreachable or missing weights unavailable without sample scores',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('private')));expect(await videoStatus()).toEqual({available:false,maxSeconds:120});expect((await uploadVideo(request())).status).toBe(502);});
it('rejects duplicate submissions while holding the first lock',async()=>{let finish!:(r:Response)=>void;const mock=vi.fn(()=>new Promise<Response>(r=>finish=r));vi.stubGlobal('fetch',mock);const pending=uploadVideo(request());await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));expect((await uploadVideo(request())).status).toBe(409);expect((await uploadVideo(request())).status).toBe(409);finish(Response.json({job:token,state:'processing'}));expect((await pending).status).toBe(202);expect(mock).toHaveBeenCalledTimes(1);});
it('rejects unknown handles and malformed responses',async()=>{expect((await videoJob(poll())).status).toBe(404);vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({job:'bad'})));expect((await uploadVideo(request())).status).toBe(502);});
it('cancels an existing job without another upload',async()=>{const mock=vi.fn().mockResolvedValueOnce(Response.json({job:token,state:'processing'})).mockResolvedValueOnce(Response.json({state:'cancelling'}));vi.stubGlobal('fetch',mock);await uploadVideo(request());expect(await(await videoJob(poll('DELETE'))).json()).toEqual({state:'cancelling'});expect(mock.mock.calls[1][1].method).toBe('DELETE');});
it('accepts all 7200 frames at 120 seconds and rejects excessive duration or frame counts',()=>{
 const frames=Array.from({length:7200},(_,index)=>({index,timestamp:index/60,llr:index===400?1:-1}));
 const mean=frames.reduce((s,f)=>s+f.llr,0)/frames.length;
 const d={...videoFixture(),frames,frame_count:7200,duration:120,synthetic_frame_count:1,mean_llr:mean,sigmoid_mean_llr:1/(1+Math.exp(-mean))};
 expect(parseVideoResult(d).frames.at(-1)?.timestamp).toBe(7199/60);
 expect(()=>parseVideoResult({...d,duration:120.01})).toThrow();
 expect(()=>parseVideoJob({state:'processing',progress:{processed_frames:7200,total_frames:7200}})).not.toThrow();
 expect(()=>parseVideoJob({state:'processing',progress:{processed_frames:0,total_frames:7201}})).toThrow();
});
it('streams the upload without parsing multipart or buffering a full-file copy',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(_,init)=>{expect(init.duplex).toBe('half');expect(await new Response(init.body).text()).toBe('synthetic bytes');return Response.json({job:token,state:'processing'});}));
 expect((await uploadVideo(request())).status).toBe(202);
});
it('accepts a large legitimate frame result beyond the former 256 KiB response cap',async()=>{
 const frames=Array.from({length:7200},(_,index)=>({index,timestamp:index/60,llr:-1}));
 const d={...videoFixture(),duration:120,frames,frame_count:7200,synthetic_frame_count:0};
 const response=JSON.stringify({state:'completed',progress:{processed_frames:7200,total_frames:7200},result:d});expect(response.length).toBeGreaterThan(256*1024);
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({job:token,state:'processing'})).mockResolvedValueOnce(new Response(response)));
 await uploadVideo(request());expect((await(await videoJob(poll())).json()).result.frame_count).toBe(7200);
});
