import {uploadAudio,pollAudio} from '@/lib/analyze-audio';
export const runtime='nodejs';
// Upload has a 25s application deadline; each GET polls once (8s deadline).
export const maxDuration=30;
export const POST=uploadAudio;
export const GET=pollAudio;
