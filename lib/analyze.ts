import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { MAX_FILE_BYTES, MIME_TYPES } from './config';
import { configured } from './credentials';
const buckets = new Map<string, { count: number; until: number }>();
const active = new Set<string>();
let nextProviderAt = 0;
function json(data: object, status = 200, extra = {}) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...extra } }); }
function error(message: string, status: number, extra = {}) { return json({ error: message }, status, extra); }
export async function analyze(request: Request): Promise<Response> {
  // Next.js may normalize request.url to localhost even when the browser uses
  // 127.0.0.1. Compare with the actual HTTP Host, not that internal hostname.
  const origin = request.headers.get('origin');
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.host;
  if (origin && origin !== `${url.protocol}//${host}`) return error('This request must come from this website.', 403);
  if (!configured()) return error('Live analysis is unavailable. Add Sightengine credentials to .env.local and restart the server.', 503);
  const ip = process.env.TRUST_PROXY === 'true' ? request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local' : 'local';
  const key = createHash('sha256').update(ip).digest('hex');
  const now = Date.now();
  for (const [k, b] of buckets) if (b.until <= now) buckets.delete(k);
  const bucket = buckets.get(key) || { count: 0, until: now + 60_000 };
  if (bucket.count >= 5 || (!buckets.has(key) && buckets.size >= 10000)) return error('Too many requests. Please wait a minute.', 429, { 'Retry-After': '60' });
  bucket.count++; buckets.set(key, bucket);
  if (active.has(key)) return error('An analysis is already in progress. Please wait.', 409);
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) return error('Upload an image using multipart form data.', 400);
  const length = Number(request.headers.get('content-length'));
  if (length > MAX_FILE_BYTES + 65536) return error('Choose an image smaller than 8 MB.', 413);
  active.add(key);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (!request.body) return error('Choose an image first.', 400);
    reader = request.body.getReader();
    timer = setTimeout(() => { void reader?.cancel(); }, 10_000);
    const chunks: Uint8Array[] = []; let total = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; total += value.length; if (total > MAX_FILE_BYTES + 65536) { await reader.cancel(); return error('Choose an image smaller than 8 MB.', 413); } chunks.push(value); }
    clearTimeout(timer);
    let form: FormData;
    try { form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData(); } catch { return error('The upload could not be read. Please choose the image again.', 400); }
    const files = form.getAll('image'); const file = files[0];
    if (files.length !== 1 || !(file instanceof File) || file.size === 0) return error('Choose exactly one non-empty image.', 400);
    if (file.size > MAX_FILE_BYTES) return error('Choose an image smaller than 8 MB.', 413);
    if (!MIME_TYPES.includes(file.type)) return error('Use a JPEG, PNG, or WebP image.', 415);
    const bytes = Buffer.from(await file.arrayBuffer());
    let format: string;
    try {
      const image = sharp(bytes, { limitInputPixels: 25_000_000, animated: true, failOn: 'warning' });
      const meta = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(meta.format || '') || (meta.pages || 1) !== 1 || `image/${meta.format}` !== file.type) return error('Use a valid, still JPEG, PNG, or WebP image.', 415);
      await image.stats(); format = meta.format!;
    } catch { return error('This image is invalid or too large to decode. Try a smaller image.', 422); }
    if (Date.now() < nextProviderAt) return error('Please wait a moment before another analysis.', 429, { 'Retry-After': '1' });
    nextProviderAt = Date.now() + 1100;
    const providerForm = new FormData();
    providerForm.set('media', new Blob([new Uint8Array(bytes)], { type: file.type }), `image.${format}`);
    providerForm.set('models', 'genai'); providerForm.set('api_user', process.env.SIGHTENGINE_API_USER!.trim()); providerForm.set('api_secret', process.env.SIGHTENGINE_API_SECRET!.trim());
    let response: Response;
    try { response = await fetch('https://api.sightengine.com/1.0/check.json', { method: 'POST', body: providerForm, signal: AbortSignal.timeout(20_000), cache: 'no-store' }); }
    catch (e) { return error(e instanceof Error && ['TimeoutError', 'AbortError'].includes(e.name) ? 'Sightengine took too long to respond. Please try again later.' : 'Sightengine could not be reached. Please try again later.', 504); }
    let data;
    try { data = await response.json(); } catch { return error('Sightengine returned an unreadable response. Please try again later.', 502); }
    if (!response.ok || data.status !== 'success') {
      const code = String(data.error?.type || '');
      if (response.status === 429 || ['too_many_requests', 'usage_limit', 'quota_exceeded'].includes(code)) return error('Sightengine’s quota or rate limit has been reached. Please try later or check your plan.', 429, { 'Retry-After': '60' });
      if (data.error?.code === 1) return error('Sightengine authentication failed. Check the server credentials.', 503);
      if (response.status === 401 || response.status === 403 || ['credentials_error', 'plan_error'].includes(code)) return error('Sightengine authentication failed. Check the server credentials and plan.', 503);
      if (['media_error', 'argument_error'].includes(code)) return error('Sightengine could not analyze this image. Try a different image.', 422);
      return error('Sightengine could not complete the analysis. Please try again later.', 502);
    }
    const score = data.type?.ai_generated;
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1) return error('Sightengine returned an invalid confidence score. Please try again later.', 502);
    return json({ score, provider: 'Sightengine', model: 'genai', operations: Number.isInteger(data.request?.operations) ? data.request.operations : null });
  } catch { return error('The image could not be processed. Please try again.', 400); }
  finally { if (timer) clearTimeout(timer); reader?.releaseLock(); active.delete(key); }
}
export function resetLimitsForTests() { buckets.clear(); active.clear(); nextProviderAt = 0; }
