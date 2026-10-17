import Detector from '../detector';
import { configured, audioConfigured } from '@/lib/credentials';
import {textAvailable} from '@/lib/text-service';
import {videoStatus} from '@/lib/video-service';
import type { Metadata } from 'next';
export const metadata: Metadata = {title:'Analyze images, text, audio & video — Shady'};
export const dynamic = 'force-dynamic';
export default async function Page() { const video=await videoStatus(); return <Detector available={configured()} textAvailable={await textAvailable()} audioAvailable={audioConfigured()} videoAvailable={video.available} videoMaxSeconds={video.maxSeconds}/>; }
