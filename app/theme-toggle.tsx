'use client';
import {useSyncExternalStore} from 'react';
import {Moon,Sun} from 'lucide-react';
const key='shady-theme';
function current(){return document.documentElement.dataset.theme==='light'?'light':'dark';}
function apply(theme:'light'|'dark'){document.documentElement.dataset.theme=theme;window.dispatchEvent(new Event('shady-theme-change'));}
function subscribe(notify:()=>void){
 const media=window.matchMedia?.('(prefers-color-scheme: dark)');
 const syncSystem=()=>{try{const saved=localStorage.getItem(key);if(saved==='light'||saved==='dark')return;}catch{/* Storage can be blocked. */}apply(media?.matches?'dark':'light');};
 const syncStorage=(event:StorageEvent)=>{if(event.key!==key&&event.key!==null)return;if(event.newValue==='light'||event.newValue==='dark')apply(event.newValue);else syncSystem();};
 window.addEventListener('shady-theme-change',notify);window.addEventListener('storage',syncStorage);media?.addEventListener('change',syncSystem);
 return()=>{window.removeEventListener('shady-theme-change',notify);window.removeEventListener('storage',syncStorage);media?.removeEventListener('change',syncSystem);};
}
export default function ThemeToggle(){
 const theme=useSyncExternalStore(subscribe,current,()=> 'dark');
 function toggle(){const next=current()==='dark'?'light':'dark';try{localStorage.setItem(key,next);}catch{/* Still allow switching when storage is unavailable. */}apply(next);}
 return <button className="theme-toggle" type="button" onClick={toggle} aria-label={`Switch to ${theme==='dark'?'light':'dark'} mode`} title={`Switch to ${theme==='dark'?'light':'dark'} mode`}>{theme==='dark'?<Sun size={16} aria-hidden="true"/>:<Moon size={16} aria-hidden="true"/>}<span>{theme==='dark'?'Light':'Dark'}</span></button>;
}
