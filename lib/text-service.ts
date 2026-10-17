import 'server-only';
import {MODEL_REVISION} from './text-config';
export function serviceUrl(path:string){
  const url=new URL(process.env.FAKESPOT_SERVICE_URL?.trim()||'http://127.0.0.1:8001');
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('Invalid service URL');
  return new URL(path,url).toString();
}
export async function textAvailable(){try{const r=await fetch(serviceUrl('/health'),{cache:'no-store',signal:AbortSignal.timeout(1500),redirect:'error'});if(!r.ok)return false;const d=await r.json();return d.status==='ready'&&d.model_revision===MODEL_REVISION;}catch{return false;}}
