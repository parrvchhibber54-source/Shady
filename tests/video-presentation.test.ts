import {it,expect} from 'vitest';
import {timelineEnvelope,suspiciousRuns} from '../lib/video-presentation';
it('bounds chart geometry while preserving an isolated positive peak and official classification rule',()=>{
 const frames=Array.from({length:7200},(_,index)=>({index,timestamp:index/60,llr:index===3501?5:-2}));
 const envelope=timelineEnvelope(frames);expect(envelope.length).toBeLessThanOrEqual(1200);expect(envelope).toContainEqual(frames[3501]);
 expect(suspiciousRuns(frames)).toEqual([{first:frames[3501],last:frames[3501],peak:frames[3501],count:1}]);
 expect(suspiciousRuns([{index:0,timestamp:0,llr:0}])).toEqual([]);
});
