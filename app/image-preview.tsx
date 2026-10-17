'use client';
import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { lensGeometry } from '../lib/magnifier';
export default function ImagePreview({ src, name, loading, onError }: {src:string; name:string; loading:boolean; onError:()=>void}) {
  const image = useRef<HTMLImageElement>(null);
  const surface = useRef<HTMLDivElement>(null), lens = useRef<HTMLDivElement>(null), glass = useRef<HTMLDivElement>(null);
  const [loadedSrc, setLoadedSrc] = useState(''), [paused, setPaused] = useState(false);
  const ready = loadedSrc === src;
  useEffect(() => {
    setPaused(false);
    // Cached/quickly decoded images can finish before React attaches onLoad.
    // Associate readiness with the URL so an old preview cannot enable a new one.
    if (image.current?.complete && image.current.naturalWidth > 0) setLoadedSrc(src);
  },[src]);
  useEffect(() => {
    if (!loading || !ready) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, start = 0, last = 0;
    const place = (progress:number) => {
      if (!surface.current || !image.current || !lens.current || !glass.current) return;
      const bounds = image.current.getBoundingClientRect();
      const {width,height} = bounds;
      if (width <= 0 || height <= 0) return;
      const parent = surface.current.getBoundingClientRect();
      const g = lensGeometry(width,height,progress);
      lens.current.style.width = `${g.diameter}px`; lens.current.style.height = `${g.diameter}px`;
      lens.current.style.transform = `translate(${bounds.left-parent.left+g.x-g.diameter/2}px,${bounds.top-parent.top+g.y-g.diameter/2}px)`;
      glass.current.style.backgroundSize = `${g.backgroundWidth}px ${g.backgroundHeight}px`;
      glass.current.style.backgroundPosition = `${g.backgroundX}px ${g.backgroundY}px`;
    };
    const tick = (time:number) => {if (!start) start=time;if(time-last>=33){place((time-start)/1600);last=time;}frame=requestAnimationFrame(tick);};
    const restart = () => {cancelAnimationFrame(frame);start=0;last=0;place(.7);if (!media.matches && !paused && !document.hidden) frame=requestAnimationFrame(tick);};
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(restart) : null;
    if (image.current) observer?.observe(image.current);
    window.addEventListener('resize',restart);
    media.addEventListener('change',restart); document.addEventListener('visibilitychange',restart);restart();
    return () => {cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',restart);media.removeEventListener('change',restart);document.removeEventListener('visibilitychange',restart);};
  },[loading,ready,paused]);
  return <><div className="preview-frame"><div className="image-surface" ref={surface}><img ref={image} className="source-image" src={src} alt={`Preview of ${name}`} onLoad={()=>setLoadedSrc(src)} onError={()=>{setLoadedSrc('');onError();}}/>{loading && ready && <div className="roaming-lens" ref={lens} aria-hidden="true" data-testid="zoom-lens"><div className="lens-glass" ref={glass} style={{backgroundImage:`url("${src}")`}}/><span className="lens-shine"/><span className="lens-handle"/></div>}</div></div>{loading && <div className="preview-scan-note"><span>Looking closer… <small>Visual zoom only</small></span><button type="button" className="motion-toggle" aria-label={paused?'Resume magnifier animation':'Pause magnifier animation'} onClick={()=>setPaused(p=>!p)}>{paused?<Play size={13}/>:<Pause size={13}/>}</button></div>}</>;
}
