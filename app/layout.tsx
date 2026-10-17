import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Shady — Is there AI behind what you see?', description: 'Explore images with Sightengine, text with Fakespot, voice recordings with Reality Defender, and video frames with WaveRep. Shady gives you a signal to inform your judgment.' };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`(()=>{let t;try{t=localStorage.getItem('shady-theme')}catch{}if(t!=='light'&&t!=='dark')t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t})()`}}/></head><body>{children}</body></html>; }
