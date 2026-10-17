'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowRight, Upload, X, ScanLine, ShieldCheck, LoaderCircle, Check, Info } from 'lucide-react';
import Brand from './brand';
import ThemeToggle from './theme-toggle';
import ImagePreview from './image-preview';
import TextDetector from './text-detector';
import AudioDetector from './audio-detector';
import VideoDetector from './video-detector';
import Link from 'next/link';
import { MAX_FILE_BYTES, MIME_TYPES } from '../lib/config';
type Result = { score: number; operations: number | null };
export default function Detector({ available, textAvailable=false, audioAvailable=false, videoAvailable=false, videoMaxSeconds=120 }: { available: boolean; textAvailable?: boolean; audioAvailable?:boolean;videoAvailable?:boolean;videoMaxSeconds?:number }) {
  const [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState(''), [drag, setDrag] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(''), [result, setResult] = useState<Result | null>(null);
  const [mode,setMode]=useState<'image'|'text'|'audio'|'video'>('image'),[textBusy,setTextBusy]=useState(false),[audioBusy,setAudioBusy]=useState(false),[videoBusy,setVideoBusy]=useState(false);
  const imageTab=useRef<HTMLButtonElement>(null),textTab=useRef<HTMLButtonElement>(null),audioTab=useRef<HTMLButtonElement>(null),videoTab=useRef<HTMLButtonElement>(null);
  function tabKey(e:React.KeyboardEvent<HTMLButtonElement>){if(loading||textBusy||audioBusy||videoBusy)return;const modes=['image','text','audio','video'] as const;if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const index=e.key==='Home'?0:e.key==='End'?3:(modes.indexOf(mode)+(e.key==='ArrowRight'?1:3))%4;setMode(modes[index]);[imageTab,textTab,audioTab,videoTab][index].current?.focus();}}

  const input = useRef<HTMLInputElement>(null), busy = useRef(false), controller = useRef<AbortController | null>(null);
  useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  useEffect(() => () => controller.current?.abort(), []);
  function choose(files: FileList | File[] | null) {
    if (busy.current || !files?.length) return;
    setResult(null); setError('');
    if (files.length !== 1) { setError('Please choose one image at a time.'); return; }
    const image = files[0];
    if (!MIME_TYPES.includes(image.type)) { setError('Please choose a JPEG, PNG, or WebP image.'); return; }
    if (!image.size || image.size > MAX_FILE_BYTES) { setError('Choose a non-empty image up to 8 MB.'); return; }
    setFile(image);
  }
  function reset() { if (busy.current) return; setFile(null); setResult(null); setError(''); if (input.current) input.current.value = ''; }
  async function submit() {
    if (!file || busy.current || !available || result) return;
    busy.current = true; setLoading(true); setError('');
    const abort = new AbortController(); controller.current = abort; const timer = setTimeout(() => abort.abort(), 35_000);
    try { const body = new FormData(); body.set('image', file); const response = await fetch('/api/analyze', { method: 'POST', body, signal: abort.signal }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Analysis failed. Please try again.'); if (typeof data.score !== 'number' || !Number.isFinite(data.score) || data.score < 0 || data.score > 1) throw new Error('An invalid result was returned.'); setResult(data); }
    catch (e) { setError(e instanceof Error && e.name === 'AbortError' ? 'The request timed out. Please try again later.' : e instanceof Error ? e.message : 'Connection failed. Please try again.'); }
    finally { clearTimeout(timer); busy.current = false; setLoading(false); controller.current = null; }
  }
  const percentage = result ? (result.score * 100).toFixed(1) : '';
  return <div className="shell analysis-shell">
    <a className="skip" href={mode==='image'?'#detector':mode==='text'?'#text-panel':mode==='audio'?'#audio-panel':'#video-panel'}>Skip to detector</a>
    <header className="site-header"><Brand/><div className="header-tools"><Link href="/" className="back-link">← Back to Shady</Link><ThemeToggle/></div></header>
    <main><section className="analysis-intro"><h1>Something look <em>shady?</em></h1><p>Choose an image, text, a voice recording, or a short video. Take a closer look.</p></section>
    <div className="analysis-tabs" role="tablist" aria-label="Analysis type"><button type="button" ref={imageTab} id="image-tab" role="tab" aria-selected={mode==='image'} aria-controls="image-panel" tabIndex={mode==='image'?0:-1} disabled={loading||textBusy||audioBusy||videoBusy} onKeyDown={tabKey} onClick={()=>setMode('image')}>Image <span>Sightengine</span></button><button type="button" ref={textTab} id="text-tab" role="tab" aria-selected={mode==='text'} aria-controls="text-panel" tabIndex={mode==='text'?0:-1} disabled={loading||textBusy||audioBusy||videoBusy} onKeyDown={tabKey} onClick={()=>setMode('text')}>Text <span>Fakespot</span></button><button type="button" ref={audioTab} id="audio-tab" role="tab" aria-selected={mode==='audio'} aria-controls="audio-panel" tabIndex={mode==='audio'?0:-1} disabled={loading||textBusy||audioBusy||videoBusy} onKeyDown={tabKey} onClick={()=>setMode('audio')}>Audio <span>Reality Defender</span></button><button type="button" ref={videoTab} id="video-tab" role="tab" aria-selected={mode==='video'} aria-controls="video-panel" tabIndex={mode==='video'?0:-1} disabled={loading||textBusy||audioBusy||videoBusy} onKeyDown={tabKey} onClick={()=>setMode('video')}>Video <span>WaveRep</span></button></div>
    <div id="image-panel" role="tabpanel" aria-labelledby="image-tab" hidden={mode!=='image'}>
    <section id="detector" className="workspace" aria-label="Image detector"><div className="upload-panel"><div className="panel-heading"><div><span className="step">01 / INPUT</span><h2>Your image, a closer look.</h2></div><span className="format-badge">STILL IMAGES</span></div>
    <input ref={input} type="file" id="image-file" className="sr-only" accept="image/jpeg,image/png,image/webp" disabled={loading} aria-label="Choose image" onChange={e => choose(e.target.files)}/>
    <div className={`dropzone ${drag ? 'dragging' : ''} ${file ? 'has-image' : ''}`} onDragOver={e => { e.preventDefault(); if (!loading) setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files); }}>
    {file ? <>{preview && <ImagePreview src={preview} name={file.name} loading={loading} onError={() => setError('Your browser could not preview this image. Choose another file.')}/>}<div className="file-row"><div><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · {loading ? 'Analysis in progress' : result ? 'Analysis complete' : 'Ready for analysis'}</span></div><button className="icon-button" onClick={reset} disabled={loading} aria-label="Remove image"><X size={19}/></button></div></> : <><div className="upload-symbol"><Upload size={26} strokeWidth={1.5}/></div><h3>Drop an image here</h3><p>or choose a file from your device</p><button className="browse" onClick={() => input.current?.click()}>Choose image <ArrowUpRight size={16}/></button><span className="file-hint">JPEG, PNG, WebP · Up to 8 MB</span></>}
    </div>
    <div className="privacy-note"><ShieldCheck size={19}/><p>When you analyze, your image is sent to <a href="https://sightengine.com" target="_blank" rel="noreferrer">Sightengine</a> for processing. Shady keeps no copy.</p></div>
    {!available && <p className="notice" role="status"><Info size={17}/> Live analysis unavailable. Configure server credentials to enable it.</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    <button className="analyze" onClick={submit} disabled={!file || loading || !available || !!result}>{loading ? <><LoaderCircle className="spin" size={19}/> Analyzing image…</> : result ? <><Check size={19}/> Analysis complete</> : <>Analyze image <ArrowRight size={20}/></>}</button>
    {file && <button className="reset" onClick={reset} disabled={loading}>Reset & choose another image</button>}
    </div>
    <aside className={`result-panel ${result ? 'complete' : ''}`} aria-live="polite" aria-busy={loading}><span className="step">02 / INSIGHT</span>{result ? <><div className="result-state"><Check size={15}/> Analysis complete</div><h2>AI-generation<br/>confidence</h2><div className="score">{percentage}<span>%</span></div><div className="meter" role="meter" aria-label="AI-generation confidence" aria-valuenow={result.score * 100} aria-valuemin={0} aria-valuemax={100}><span style={{width: `${result.score * 100}%`}}/></div><div className="scale"><span>Lower confidence</span><span>Higher confidence</span></div><p className="result-caption">Sightengine’s estimate that this image was generated or edited with AI.</p><div className="result-source">Sightengine · genai{result.operations !== null && <span>{result.operations} operations used</span>}</div></> : <><div className={`orb ${loading ? 'scanning' : ''}`} aria-hidden="true"><ScanLine size={47} strokeWidth={1}/></div><h2>{loading ? 'Looking a little closer.' : 'Every image has a story.'}</h2><p className="empty-description">{loading ? 'Sightengine is analyzing your image. Your result will appear here.' : 'Upload an image to explore its AI-generation confidence. Your results will appear here.'}</p><div className="awaiting"><span/>{loading ? 'ANALYSIS IN PROGRESS' : 'AWAITING YOUR IMAGE'}</div></>}
    <div className="interpretation"><Info size={18}/><p>A signal, not a verdict. The score is an estimate, not proof or the percentage of AI-generated pixels. Always consider context.</p></div></aside></section>
    </div><div id="text-panel" role="tabpanel" aria-labelledby="text-tab" hidden={mode!=='text'}><TextDetector available={textAvailable} onBusyChange={setTextBusy}/></div><div id="audio-panel" role="tabpanel" aria-labelledby="audio-tab" hidden={mode!=='audio'}><AudioDetector available={audioAvailable} onBusyChange={setAudioBusy}/></div><div id="video-panel" role="tabpanel" aria-labelledby="video-tab" hidden={mode!=='video'}><VideoDetector available={videoAvailable} maxSeconds={videoMaxSeconds} onBusyChange={setVideoBusy}/></div>
    <section id="how-it-works" className="how"><div className="section-intro"><span className="step">A SIMPLE PROCESS</span><h2>More context.<br/><span className="serif">Better questions.</span></h2></div><div className="how-item"><span>01</span><h3>{mode==='image'?'Choose an image':mode==='audio'?'Upload speech':mode==='video'?'Choose a short clip':'Paste your text'}</h3><p>{mode==='image'?'Upload a still image you want to understand. It stays on your device until you analyze.':mode==='audio'?'Choose a 1.5–60 second PCM WAV recording. It stays in your browser until analysis.':mode==='video'?`Upload a complete H.264 MP4 up to ${videoMaxSeconds} seconds. Every accepted decoded frame is analyzed.`:'Provide English prose, up to 512 tokens after cleaning. Your draft stays in this page until you choose to analyze.'}</p></div><div className="how-item"><span>02</span><h3>{mode==='image'?'Let the model look':mode==='audio'?'Let Reality Defender listen':mode==='video'?'Follow the frames':'Let Fakespot read'}</h3><p>{mode==='image'?'Sightengine’s genai model examines the visual content and returns a confidence score.':mode==='audio'?'Reality Defender analyzes signs of synthetic or manipulated speech. Shady checks the existing scan for a conclusion.':mode==='video'?'WaveRep G4 runs locally and returns raw frame scores and their arithmetic mean. The soundtrack is not analyzed.':'Fakespot runs locally and returns a Human or AI classification and its model score.'}</p></div><div className="how-item"><span>03</span><h3>Keep your perspective</h3><p>Use the estimate alongside provenance and context. Detection models can make mistakes.</p></div></section></main>
    <footer><Brand/><span>Stay curious. Stay critical.</span><a href="https://sightengine.com" target="_blank" rel="noreferrer">Images: Sightengine <ArrowUpRight size={14}/></a><a href="https://huggingface.co/fakespot-ai/roberta-base-ai-text-detection-v1" target="_blank" rel="noreferrer">Text: Fakespot <ArrowUpRight size={14}/></a><a href="https://www.realitydefender.com/product/realapi" target="_blank" rel="noreferrer">Audio: Reality Defender <ArrowUpRight size={14}/></a><a href="https://github.com/grip-unina/WaveRep-SyntheticVideoDetection" target="_blank" rel="noreferrer">Video: WaveRep <ArrowUpRight size={14}/></a></footer>
  </div>;
}
