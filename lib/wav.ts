import 'server-only';
import {MIN_AUDIO_SECONDS,MAX_AUDIO_SECONDS,MAX_AUDIO_BYTES} from './audio-config';
// PCM is uncompressed. Validate the complete RIFF structure and decode every
// signed 16-bit sample; no container metadata duration or filename is trusted.
export function decodeWav(bytes:Buffer):{duration:number;sampleRate:number;channels:number} {
  const invalid=()=>new Error('Use a valid uncompressed 16-bit PCM WAV, mono or stereo, 8–48 kHz, lasting 1.5–60 seconds.');
  if(bytes.length<44||bytes.length>MAX_AUDIO_BYTES||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE'||bytes.readUInt32LE(4)+8!==bytes.length)throw invalid();
  let offset=12,fmt:{rate:number;channels:number;align:number;byteRate:number}|null=null,pcm:Buffer|null=null;
  while(offset<bytes.length){
    if(offset+8>bytes.length)throw invalid();
    const name=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4),start=offset+8,end=start+size;
    if(end>bytes.length||end+(size%2)>bytes.length)throw invalid();
    if(name==='fmt '){
      if(fmt||size!==16||bytes.readUInt16LE(start)!==1||bytes.readUInt16LE(start+14)!==16)throw invalid();
      fmt={channels:bytes.readUInt16LE(start+2),rate:bytes.readUInt32LE(start+4),byteRate:bytes.readUInt32LE(start+8),align:bytes.readUInt16LE(start+12)};
      if(![1,2].includes(fmt.channels)||fmt.rate<8000||fmt.rate>48000||fmt.align!==fmt.channels*2||fmt.byteRate!==fmt.rate*fmt.align)throw invalid();
    }
    if(name==='data'){if(pcm)throw invalid();pcm=bytes.subarray(start,end);}
    offset=end+(size%2);
  }
  if(!fmt||!pcm||!pcm.length||pcm.length%fmt.align)throw invalid();
  const duration=pcm.length/fmt.byteRate;
  if(duration<MIN_AUDIO_SECONDS||duration>MAX_AUDIO_SECONDS)throw invalid();
  for(let i=0;i<pcm.length;i+=2){const sample=pcm.readInt16LE(i)/32768;if(!Number.isFinite(sample))throw invalid();}
  return {duration,sampleRate:fmt.rate,channels:fmt.channels};
}
