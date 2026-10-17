import {afterEach,it,expect,vi} from 'vitest';
import {pollAudioResult} from '../lib/audio-client';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('backs off while polling an existing handle without submitting an upload',async()=>{
 vi.useFakeTimers();const mock=vi.fn().mockResolvedValueOnce(Response.json({state:'processing'})).mockResolvedValue(Response.json({state:'completed',result:{provider:'Reality Defender',status:'SUSPICIOUS',score:50}}));vi.stubGlobal('fetch',mock);
 const pending=pollAudioResult('a'.repeat(64),new AbortController().signal,vi.fn());await vi.advanceTimersByTimeAsync(1999);expect(mock).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);expect(mock).toHaveBeenCalledTimes(1);await vi.advanceTimersByTimeAsync(3000);expect((await pending).status).toBe('SUSPICIOUS');expect(mock.mock.calls.every(([,init])=>!init.method&&!init.body)).toBe(true);
});
it('bounds polling duration and never resubmits on timeout',async()=>{
 vi.useFakeTimers();const mock=vi.fn().mockImplementation(()=>Promise.resolve(Response.json({state:'processing'})));vi.stubGlobal('fetch',mock);const pending=pollAudioResult('a'.repeat(64),new AbortController().signal,vi.fn());const assertion=expect(pending).rejects.toThrow('polling timed out');await vi.advanceTimersByTimeAsync(135000);await assertion;expect(mock.mock.calls.length).toBeLessThan(30);
});
it('aborts an idle polling wait without any provider requests',async()=>{vi.useFakeTimers();const mock=vi.fn();vi.stubGlobal('fetch',mock);const abort=new AbortController();const pending=pollAudioResult('a'.repeat(64),abort.signal,vi.fn());const assertion=expect(pending).rejects.toThrow('Aborted');abort.abort();await assertion;expect(mock).not.toHaveBeenCalled();});
it('rejects malformed results without fabricating a score',async()=>{vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({state:'completed',result:{status:'FAKE'}})));const pending=pollAudioResult('a'.repeat(64),new AbortController().signal,vi.fn());const assertion=expect(pending).rejects.toThrow('Invalid audio result');await vi.advanceTimersByTimeAsync(2000);await assertion;});
