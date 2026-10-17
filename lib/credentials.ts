import 'server-only';
export function configured() { return [process.env.SIGHTENGINE_API_USER, process.env.SIGHTENGINE_API_SECRET].every(v => !!v?.trim() && !v.startsWith('your_')); }
export function audioConfigured(){const key=process.env.REALITY_DEFENDER_API_KEY?.trim();return !!key&&!key.startsWith('your_');}
