import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Fingerprint } from 'lucide-react';
import Brand from './brand';
import ThemeToggle from './theme-toggle';
export default function Page() {
  return <div className="landing">
    <a className="skip" href="#landing-main">Skip to main content</a>
    <header className="site-header"><Brand/><div className="header-tools"><span className="header-note">QUESTION WHAT YOU SEE.</span><ThemeToggle/></div></header>
    <main id="landing-main">
      <section className="collage-hero" aria-labelledby="hero-title">
        <div className="collage-backdrop" aria-hidden="true"><div className="purple-haze"/>
          <img className="collage-eye" src="/art/shady-eye.webp" alt="" width="900" height="900" fetchPriority="high"/>
          <img className="collage-sticker laptop-sticker" src="/art/laptop.webp" alt="" width="430" height="430"/>
          <img className="collage-sticker magnifier-sticker" src="/art/magnifier.webp" alt="" width="400" height="400"/>
          <img className="not-ai-sticker" src="/art/not-ai.webp" alt="" width="220" height="220"/>
          <div className="observer-card"><img src="/art/observer.webp" width="188" height="150" alt=""/><span>TRUST YOUR CURIOSITY.</span></div>
          <div className="caution-tape tape-one">{Array.from({length:8},(_,i)=><span key={i}>AI GENERATED CONTENT <span className="tape-star">✳</span> </span>)}</div>
          <div className="caution-tape tape-two">{Array.from({length:8},(_,i)=><span key={i}>AI GENERATED CONTENT <span className="tape-star">✳</span> </span>)}</div>
        </div>
        <div className="hero-center"><div className="eyebrow"><span/> NOTHING IS QUITE WHAT IT SEEMS</div><h1 id="hero-title">Is there <em>AI</em><br/>behind what you see?</h1><p>Looks real. Feels real. But is it?<br/>Take a closer look with Shady.</p><Link href="/analyze" className="primary-link">Get started <ArrowRight size={19}/></Link></div>

      </section>
      <section className="landing-method"><div className="method-heading"><Fingerprint size={24}/><span className="eyebrow">A LITTLE DOUBT. A CLOSER LOOK.</span><h2>Reality deserves<br/><em>a second opinion.</em></h2><p>Bring an image. We’ll bring a signal.<br/>You bring the judgment.</p></div><div className="method-steps"><article><span>01 / BRING THE EVIDENCE</span><h3>Drop your image.</h3><p>Choose a JPEG, PNG, or WebP up to 8 MB, paste English text, or upload a PCM WAV voice recording in Audio mode. Your input stays on your device until you analyze.</p></article><article><span>02 / LOOK A LITTLE CLOSER</span><h3>Choose your closer look.</h3><p>Images go to Sightengine’s genai model. Text goes to the local Fakespot model for an English-language Human or AI estimate. Voice recordings go to Reality Defender. Short video clips use the local WaveRep G4 demo.</p></article><article><span>03 / KEEP YOUR PERSPECTIVE</span><h3>A signal. Not a verdict.</h3><p>The estimate isn’t proof or the percentage of AI-generated pixels. Context still matters.</p></article></div></section>
      <section className="landing-last"><span>DOES SOMETHING LOOK A LITTLE SHADY?</span><Link href="/analyze">Let’s take a look. <ArrowUpRight size={35}/></Link></section>
    </main><footer><Brand/><span>Stay curious. Stay critical.</span><a href="https://sightengine.com" target="_blank" rel="noreferrer">Images: Sightengine <ArrowUpRight size={14}/></a><a href="https://huggingface.co/fakespot-ai/roberta-base-ai-text-detection-v1" target="_blank" rel="noreferrer">Text: Fakespot <ArrowUpRight size={14}/></a><a href="https://www.realitydefender.com/product/realapi" target="_blank" rel="noreferrer">Audio: Reality Defender <ArrowUpRight size={14}/></a><a href="https://github.com/grip-unina/WaveRep-SyntheticVideoDetection" target="_blank" rel="noreferrer">Video: WaveRep <ArrowUpRight size={14}/></a></footer>
  </div>;
}
