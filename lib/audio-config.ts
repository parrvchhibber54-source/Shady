// Shady's deliberate initial subset of Reality Defender's supported formats.
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MIN_AUDIO_SECONDS = 1.5;
export const MAX_AUDIO_SECONDS = 60;
export const AUDIO_MIMES = ['audio/wav','audio/wave','audio/x-wav','audio/vnd.wave'];
export const AUDIO_STATUSES = ['AUTHENTIC','FAKE','SUSPICIOUS','NOT_APPLICABLE','UNABLE_TO_EVALUATE','ANALYZING','DOWNLOADING'] as const;
export type AudioStatus = typeof AUDIO_STATUSES[number];
export type AudioResult = {provider:'Reality Defender';status:AudioStatus;score:number|null};
export function validateAudioFile(file:{name:string;size:number;type:string}):string|null {
  if(!file.size||file.size>MAX_AUDIO_BYTES)return 'Choose a non-empty WAV file up to 10 MiB.';
  if(!/\.wav$/i.test(file.name)||(file.type&&!AUDIO_MIMES.includes(file.type)))return 'Use an uncompressed 16-bit PCM WAV recording.';
  return null;
}
export function parseAudioResult(data:unknown):AudioResult {
  if(!data||typeof data!=='object')throw new Error('Invalid audio result');
  const d=data as Record<string,unknown>;
  if(d.provider!=='Reality Defender'||!AUDIO_STATUSES.includes(d.status as AudioStatus)||!(d.score===null||typeof d.score==='number'&&Number.isFinite(d.score)&&d.score>=0&&d.score<=100))throw new Error('Invalid audio result');
  return {provider:'Reality Defender',status:d.status as AudioStatus,score:d.score as number|null};
}
export function inProgress(status:AudioStatus){return status==='ANALYZING'||status==='DOWNLOADING';}
