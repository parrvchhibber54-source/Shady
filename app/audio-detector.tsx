'use client';
import {useEffect,useRef,useState} from 'react';
import {AudioLines,ArrowRight,Check,Info,LoaderCircle,ShieldCheck,Upload,X} from 'lucide-react';
import {validateAudioFile,type AudioResult} from '../lib/audio-config';
import {pollAudioResult} from '../lib/audio-client';
const descriptions={AUTHENTIC:'Provider conclusion: Authentic',FAKE:'Provider conclusion: Manipulated',SUSPICIOUS:'Suspicious · review needed',NOT_APPLICABLE:'Inconclusive · not applicable',UNABLE_TO_EVALUATE:'Analysis failed · unable to evaluate',ANALYZING:'Processing',DOWNLOADING:'Processing'};
export default function AudioDetector({available,onBusyChange}:{available:boolean;onBusyChange:(busy:boolean)=>void}){
 const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[duration,setDuration]=useState<number|null>(null),[drag,setDrag]=useState(false),[phase,setPhase]=useState<'idle'|'uploading'|'processing'|'completed'|'failed'>('idle'),[error,setError]=useState(''),[result,setResult]=useState<AudioResult|null>(null),[attempted,setAttempted]=useState(false);
 const input=useRef<HTMLInputElement>(null),busy=useRef(false),controller=useRef<AbortController|null>(null);
 const loading=phase==='uploading'||phase==='processing';
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 function reset(){if(busy.current)return;setFile(null);setDuration(null);setResult(null);setError('');setPhase('idle');setAttempted(false);if(input.current)input.current.value='';}
 function choose(files:FileList|File[]|null){if(busy.current||!files?.length)return;if(files.length!==1){setError('Choose one audio recording at a time.');return;}const invalid=validateAudioFile(files[0]);if(invalid){setError(invalid);return;}reset();setFile(files[0]);}
 async function analyze(){
  if(!file||!available||busy.current||attempted)return;
  busy.current=true;setAttempted(true);setPhase('uploading');setError('');setResult(null);onBusyChange(true);
  const abort=new AbortController();controller.current=abort;const timer=setTimeout(()=>abort.abort(),155_000);
  try{
   const form=new FormData();form.set('audio',file);
   const response=await fetch('/api/analyze-audio',{method:'POST',body:form,signal:AbortSignal.any([abort.signal,AbortSignal.timeout(30_000)])});
   const data=await response.json();
   if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Audio upload failed.');
   if(typeof data.job!=='string'||!/^[a-f0-9]{64}$/.test(data.job)||!['processing','upload-uncertain'].includes(data.state)||typeof data.duration!=='number'||!Number.isFinite(data.duration)||data.duration<1.5||data.duration>60)throw new Error('Invalid audio upload response. Check the provider dashboard before resubmitting.');
   setDuration(data.duration);setPhase('processing');
   if(data.state==='upload-uncertain')setError('Upload confirmation was unavailable. Checking the existing scan; the upload will not be repeated.');
   const detected=await pollAudioResult(data.job,abort.signal,()=>setPhase('processing'));
   setResult(detected);setError('');setPhase(detected.status==='UNABLE_TO_EVALUATE'?'failed':'completed');
  }catch(e){setPhase('failed');setError(e instanceof Error&&['AbortError','TimeoutError'].includes(e.name)?'Audio request timed out. Check the existing scan in the provider dashboard before submitting again.':e instanceof Error?e.message:'Audio analysis failed.');}
  finally{clearTimeout(timer);busy.current=false;onBusyChange(false);controller.current=null;}
 }
 const inconclusive=result&&['SUSPICIOUS','NOT_APPLICABLE'].includes(result.status);
 return <section className="workspace audio-workspace" aria-label="Audio detector"><div className="upload-panel"><div className="panel-heading"><div><span className="step">01 / AUDIO INPUT</span><h2>Listen a little closer.</h2></div><span className="format-badge">VOICE CHECK</span></div>
  <input className="sr-only" ref={input} id="audio-file" type="file" accept=".wav,audio/wav,audio/x-wav" aria-label="Choose audio" disabled={loading} onChange={e=>choose(e.target.files)}/>
  <div className={`dropzone ${drag?'dragging':''}`} onDragOver={e=>{e.preventDefault();if(!loading)setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);choose(e.dataTransfer.files);}}>
   {file?<><div className="audio-preview"><AudioLines size={38} strokeWidth={1}/>{preview&&<audio controls preload="metadata" src={preview} aria-label="Audio preview" onLoadedMetadata={e=>{const d=e.currentTarget.duration;setDuration(Number.isFinite(d)?d:null);}} onError={()=>setError('Your browser could not preview this audio. The server will validate it before submission.')}/>}</div><div className="file-row"><div><strong>{file.name}</strong><span>{(file.size/1024/1024).toFixed(2)} MiB · {duration!==null?`${duration.toFixed(1)} seconds`:'Duration unavailable'} · {phase==='idle'?'Ready to validate':phase}</span></div><button className="icon-button" type="button" disabled={loading} aria-label="Remove audio" onClick={reset}><X size={19}/></button></div></>:<><div className="upload-symbol"><Upload size={26}/></div><h3>Drop a voice recording here</h3><p>Single-speaker speech works best</p><button className="browse" type="button" onClick={()=>input.current?.click()}>Choose audio <ArrowRight size={16}/></button></>}
   <span className="file-hint">16-bit PCM WAV · Mono/stereo · 8–48 kHz<br/>1.5–60 seconds · Up to 10 MiB</span>
  </div>
  <div className="privacy-note"><ShieldCheck size={18}/><p>On analysis, your recording is sent to <a href="https://www.realitydefender.com/product/realapi" target="_blank" rel="noreferrer">Reality Defender</a>. Shady keeps no audio copy. Provider retention depends on your account terms; no zero-retention promise is made. <a href="https://www.realitydefender.com/t-c/data-processing-addendum" target="_blank" rel="noreferrer">Provider data policy</a></p></div>
  <p className="audio-quota">Free plan advertised: 50 scans/month shared across Reality Defender audio and images. Account remaining: not available here. <a href="https://app.realitydefender.ai" target="_blank" rel="noreferrer">Check dashboard ↗</a></p>
  {!available&&<p className="notice" role="status"><Info size={17}/> Live audio detection is unavailable. Add REALITY_DEFENDER_API_KEY in the server’s .env.local, then restart Shady.</p>}
  {error&&<p className="notice error" role="alert">{error}</p>}
  <button className="analyze" type="button" onClick={analyze} disabled={!file||!available||loading||attempted}>{loading?<><LoaderCircle size={18} className="spin"/>{phase==='uploading'?'Uploading audio…':'Processing audio…'}</>:phase==='completed'?<><Check size={18}/> Audio analysis complete</>:phase==='failed'?'Audio analysis failed':<>Analyze audio <ArrowRight size={18}/></>}</button>
  {file&&<button className="reset" type="button" onClick={reset} disabled={loading}>Reset & choose another recording</button>}
  {attempted&&!loading&&<p className="audio-quota">No automatic resubmission. Check your provider dashboard before starting another scan.</p>}
 </div><aside className={`result-panel ${result?'complete':''}`} aria-live="polite" aria-busy={loading}><span className="step">02 / AUDIO INSIGHT</span>
 {result?<><div className={`text-confidence ${inconclusive?'low-confidence':''}`}>Reality Defender · {result.status}</div><h2>{descriptions[result.status]}</h2>{inconclusive&&<p className="uncertainty-note">The provider did not return a clear authentic/manipulated conclusion. Review the recording and its context.</p>}{result.status==='UNABLE_TO_EVALUATE'&&<p className="empty-description">The provider could not evaluate this recording. No authorship conclusion is available.</p>}{result.score!==null?<><div className="score">{result.score.toFixed(1)}<span>/100</span></div><p className="result-caption">Provider ensemble manipulation score. Higher means a higher estimated likelihood of manipulation.</p></>:<p className="empty-description">No ensemble score was supplied.</p>}<div className="result-source">Audio detection by Reality Defender</div></>:<><div className={`orb ${loading?'scanning':''}`} aria-hidden="true"><AudioLines size={44} strokeWidth={1}/></div><h2>{phase==='failed'?'No result available.':loading?'Following the signal.':'A voice can be synthetic.'}</h2><p className="empty-description">{loading?phase==='uploading'?'Validating and uploading your recording.':'Checking the existing provider scan with bounded polling.':'Upload a speech recording to check for signs of synthetic or manipulated audio.'}</p><div className="awaiting"><span/>{loading?phase==='uploading'?'UPLOADING':'PROCESSING':phase==='failed'?'ANALYSIS FAILED':'AWAITING YOUR AUDIO'}</div></>}
 <div className="interpretation"><Info size={18}/><p>Estimates, not proof or the percentage of AI-generated audio. This does not verify a speaker’s identity or whether their words are truthful. Music, noise, short clips and overlapping speakers may be inconclusive.</p></div></aside></section>;
}
