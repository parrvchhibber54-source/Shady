'use client';
import { useEffect, useRef, useState } from 'react';
import { AlignLeft, ArrowRight, Check, Info, LoaderCircle, ShieldCheck, Trash2 } from 'lucide-react';
import { MAX_TEXT_CHARACTERS, parseTextResult, textCounts, validateText, type TextResult } from '../lib/text-config';

export default function TextDetector({available,onBusyChange}:{available:boolean;onBusyChange:(busy:boolean)=>void}) {
  const [text,setText]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<TextResult|null>(null);
  const busy=useRef(false),controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const counts=textCounts(text),validation=validateText(text);
  function edit(value:string){if(busy.current)return;setText(value);setResult(null);setError('');}
  async function submit(){
    if(busy.current||!available||result)return;
    const invalid=validateText(text);if(invalid){setError(invalid);return;}
    busy.current=true;setLoading(true);onBusyChange(true);setError('');
    const abort=new AbortController();controller.current=abort;const timer=setTimeout(()=>abort.abort(),35_000);
    try {
      const response=await fetch('/api/analyze-text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({document:text}),signal:abort.signal});
      let data;try{data=await response.json();}catch{throw new Error('Text analysis returned an unreadable response. Please try later.');}
      if(!response.ok)throw new Error(typeof data?.error==='string'?data.error:'Text analysis failed. Please try later.');
      // Validate the narrow response again; never render echoed text or deprecated scores.
      setResult(parseTextResult(data));
    } catch(e){setError(e instanceof Error&&e.name==='AbortError'?'The text request timed out. Please try later.':e instanceof Error?e.message:'Text analysis failed. Please try later.');}
    finally {clearTimeout(timer);busy.current=false;setLoading(false);onBusyChange(false);controller.current=null;}
  }
  return <section className="workspace text-workspace" aria-label="Text detector"><div className="upload-panel"><div className="panel-heading"><div><span className="step">01 / TEXT INPUT</span><h2>Read between the lines.</h2></div><span className="format-badge">FAKESPOT</span></div>
    <label className="text-label" htmlFor="text-document">Text to analyze</label>
    <textarea id="text-document" className="text-document" value={text} onChange={e=>edit(e.target.value)} disabled={loading} aria-describedby="text-limits text-counts" aria-invalid={!!text&&!!validation} placeholder="Paste an article, essay, or other prose here…" spellCheck={false}/>
    <div className="text-toolbar"><span id="text-counts">{counts.words.toLocaleString('en-US')} words · {counts.characters.toLocaleString('en-US')} / {MAX_TEXT_CHARACTERS.toLocaleString('en-US')} characters</span><button type="button" className="text-clear" onClick={()=>edit('')} disabled={loading||!text}><Trash2 size={12}/> Clear text</button></div>
    <p id="text-limits" className={`text-limits ${text&&validation?'invalid':''}`}>{text&&validation ? validation : 'English only · maximum 512 tokens including special tokens after cleaning. 10,000-character upload cap. Longer prose provides more context.'}</p>
    <div className="privacy-note"><ShieldCheck size={18}/><p>Your text will be sent to Shady’s local Python detector for processing. Shady does not save or log submitted text. Model files are downloaded from Hugging Face; text inference runs on this machine.</p></div>
    {!available&&<p className="notice" role="status"><Info size={17}/> Live text analysis is unavailable. Start the local Python service with scripts/text-service.sh, check its health, then reload this page. No API key is needed. No sample scores are shown.</p>}
    {error&&<p className="notice error" role="alert">{error}</p>}
    <button type="button" className="analyze" onClick={submit} disabled={!available||!!validation||loading||!!result}>{loading?<><LoaderCircle size={18} className="spin"/> Analyzing text…</>:result?<><Check size={18}/> Text analysis complete</>:<>Analyze text <ArrowRight size={18}/></>}</button>
    </div><aside className={`result-panel text-result ${result?'complete':''}`} aria-live="polite" aria-busy={loading}><span className="step">02 / TEXT INSIGHT</span>
    {result ? <><div className="text-confidence">Fakespot · model estimate</div><h2>{result.label} classification</h2>
      <div className="text-probabilities"><div className="probability-row"><div><span>{result.label} model score</span><strong>{(result.score*100).toFixed(1)}%</strong></div><div className="probability-track" aria-hidden="true"><span style={{width:`${result.score*100}%`}}/></div></div></div>
      <p className="probability-explanation">This is the model’s score for its selected class, not the percentage of AI-written words or a calibrated confidence level. A score near 50% reflects a close choice between the two classes. This model does not provide a mixed classification or sentence-level evidence.</p>
      <div className="result-source">English text detection by Fakespot · {result.tokens} tokens</div></> : <><div className={`orb ${loading?'scanning':''}`} aria-hidden="true"><AlignLeft size={43} strokeWidth={1}/></div><h2>{loading?'Reading a little closer.':'Every word has context.'}</h2><p className="empty-description">{loading?'The local Fakespot model is analyzing your text. Its result will appear here.':'Paste English prose to see Fakespot’s Human or AI classification and model score.'}</p><div className="awaiting"><span/>{loading?'TEXT ANALYSIS IN PROGRESS':'AWAITING YOUR TEXT'}</div></>}
      <div className="interpretation"><Info size={18}/><p>AI-text detection can make mistakes. Results are not proof of authorship and should not be the sole basis for an accusation or decision.</p></div>
    </aside></section>;
}
