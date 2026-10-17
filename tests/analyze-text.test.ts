import {beforeEach,it,expect,vi} from 'vitest';
import {analyzeText,resetTextLimitsForTests} from '../lib/analyze-text';
import {parseTextResult,validateText} from '../lib/text-config';
import {textFixture,sampleText} from './text-fixtures';
import {textAvailable} from '../lib/text-service';
beforeEach(()=>{resetTextLimitsForTests();vi.unstubAllGlobals();});
function request(document:unknown=sampleText){return new Request('http://localhost/api/analyze-text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({document})});}
it.each(['Human','AI'] as const)('preserves the actual %s mapping and score',async label=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({...textFixture(label),document:'must be dropped'})));const r=await analyzeText(request());expect(r.status).toBe(200);expect(await r.json()).toEqual(textFixture(label));});
it('accepts close scores without inventing confidence categories',()=>{expect(parseTextResult(textFixture('AI',.501))).toEqual(textFixture('AI',.501));});
it.each([{},textFixture('Human',NaN),textFixture('AI',1.1),{...textFixture(),label:'mixed'},{...textFixture(),tokens:513},{...textFixture(),model_revision:'unknown'}])('rejects malformed inference results',data=>{expect(()=>parseTextResult(data)).toThrow();});
it.each(['',null,'a'.repeat(10001)])('validates input before inference',async input=>{const mock=vi.fn();vi.stubGlobal('fetch',mock);expect(validateText(input)).toBeTruthy();expect((await analyzeText(request(input))).status).toBe(422);expect(mock).not.toHaveBeenCalled();});
it.each([[422,422],[503,503],[429,429],[500,502]])('handles service status %s',async(status,expected)=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:'private detail'},{status})));const r=await analyzeText(request());expect(r.status).toBe(expected);expect(JSON.stringify(await r.json())).not.toContain('private detail');});
it.each([['TimeoutError',504],['TypeError',502]])('handles %s without retrying',async(name,status)=>{const mock=vi.fn().mockRejectedValue(Object.assign(new Error('private'),{name}));vi.stubGlobal('fetch',mock);expect((await analyzeText(request())).status).toBe(status);expect(mock).toHaveBeenCalledTimes(1);});
it('rejects malformed response',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({label:'AI'})));expect((await analyzeText(request())).status).toBe(502);});
it('enforces origin protection',async()=>{const r=new Request('http://localhost/api/analyze-text',{method:'POST',headers:{origin:'https://other.test'}});expect((await analyzeText(r)).status).toBe(403);});
it('rejects duplicates and rate limits',async()=>{let finish!:(r:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(r=>finish=r)));const pending=analyzeText(request());await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));expect((await analyzeText(request())).status).toBe(409);finish(Response.json(textFixture()));await pending;});
it('reports unavailable health',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));expect(await textAvailable()).toBe(false);});
