import {beforeEach,afterEach,it,expect,vi} from 'vitest';
vi.mock('../lib/video-config',async original=>({...await original<typeof import('../lib/video-config')>(),MAX_VIDEO_BYTES:8}));
import {uploadVideo,resetVideoLimitsForTests} from '../lib/analyze-video';
beforeEach(()=>resetVideoLimitsForTests());afterEach(()=>vi.unstubAllGlobals());
function request(chunks:Uint8Array[]){return new Request('http://localhost/api/analyze-video',{method:'POST',headers:{'Content-Type':'video/mp4'},body:new ReadableStream({start(c){for(const chunk of chunks)c.enqueue(chunk);c.close();}}),duplex:'half'} as RequestInit);}
it('rejects excessive unknown-length streamed bytes, without retaining the full upload',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(_,init)=>{await new Response(init.body).arrayBuffer();return Response.json({job:'a'.repeat(64),state:'processing'});}));
 expect((await uploadVideo(request([new Uint8Array(5),new Uint8Array(5)]))).status).toBe(413);
});
it('rejects an empty streamed upload and accepts bounded chunks',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(_,init)=>{const bytes=await new Response(init.body).arrayBuffer();expect(bytes.byteLength).toBe(8);return Response.json({job:'a'.repeat(64),state:'processing'});}));
 expect((await uploadVideo(request([]))).status).toBe(422);
 expect((await uploadVideo(request([new Uint8Array(4),new Uint8Array(4)]))).status).toBe(202);
});
