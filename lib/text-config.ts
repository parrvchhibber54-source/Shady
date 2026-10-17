export const MAX_TEXT_CHARACTERS = 10_000;
export const MODEL_REVISION = 'f9cdb14d1f8b105f597d80fa7b56f20c6ea0e9db';
export type TextResult = {provider:'Fakespot';label:'Human'|'AI';score:number;tokens:number;model_revision:typeof MODEL_REVISION};
export function textCounts(text:string){return {characters:text.length,words:text.trim()?text.trim().split(/\s+/u).length:0};}
export function validateText(text:unknown):string|null {
  if(typeof text!=='string'||!text.trim())return 'Paste English text before analyzing.';
  if(text.length>MAX_TEXT_CHARACTERS)return 'Use no more than 10,000 characters. Shady will not truncate your text.';
  return null;
}
export function parseTextResult(data:unknown):TextResult {
  if(!data||typeof data!=='object')throw new Error('Invalid local model response');
  const d=data as Record<string,unknown>;
  if(d.provider!=='Fakespot'||!['Human','AI'].includes(d.label as string)||typeof d.score!=='number'||!Number.isFinite(d.score)||d.score<.5||d.score>1||!Number.isInteger(d.tokens)||Number(d.tokens)<2||Number(d.tokens)>512||d.model_revision!==MODEL_REVISION)throw new Error('Invalid local model response');
  return {provider:'Fakespot',label:d.label as 'Human'|'AI',score:d.score,tokens:Number(d.tokens),model_revision:MODEL_REVISION};
}
