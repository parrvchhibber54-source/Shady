import {MODEL_REVISION} from '../lib/text-config';
export const sampleText='The garden outside my window has changed with the seasons. This morning I noticed new leaves on the old tree.';
export function textFixture(label:'Human'|'AI'='Human',score=.8){return {provider:'Fakespot',label,score,tokens:24,model_revision:MODEL_REVISION};}
