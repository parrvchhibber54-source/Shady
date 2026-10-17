# Engineering notes and historical validation

These detailed notes include implementation history. Use the [current README](../README.md) for current limits and startup instructions. The two-minute upgrade supersedes earlier five-second settings.

# Shady — image, text, voice and video analysis

A complete portfolio application built with Next.js App Router, TypeScript, Tailwind CSS, Sightengine image detection, Fakespot text detection, Reality Defender voice detection and local WaveRep video-frame analysis. A dark editorial collage combines a purple Cinzel wordmark, supplied eye logo, cutout stickers and yellow “AI GENERATED CONTENT” tape. A separate investigation desk handles accessible uploads and real results. The detection models belong to Sightengine (images), Fakespot (text), Reality Defender (audio) and GRIP-UNINA WaveRep (video); Shady provides the interface and server integrations.

## Run locally

Use Node.js 20.9+ (Node 22 LTS recommended).

```sh
npm ci
cp -n .env.example .env.local
# Edit .env.local with your credentials, then:
npm run dev
```

Open http://127.0.0.1:3000. Development uses Webpack with polling to work around restricted macOS filesystem watchers. The local checkout includes your configured, git-ignored `.env.local`. The source ZIP excludes credentials; when using the ZIP, copy `.env.example` to `.env.local` and fill in your Sightengine credentials. For image detection, enter your API user ID in `SIGHTENGINE_API_USER` and API secret in `SIGHTENGINE_API_SECRET`, obtained from https://dashboard.sightengine.com/. Restart the server after changes. Never use `NEXT_PUBLIC_` for credentials. Missing Sightengine credentials disable image analysis; unavailable Python service disables text analysis and return HTTP 503; Shady never substitutes demonstration scores.

```sh
npm test
npm run typecheck
npm run build
npm start
```

## Architecture

- `app/detector.tsx`: responsive client UI, drag and drop/file picker, object-URL preview, removal/reset, submission lock, loading/error/success states. Object URLs are revoked. Successful files cannot be accidentally resubmitted.
- `app/page.tsx`: static landing page, purple serif branding, supplied collage assets and a Get started link to `/analyze`.
- `app/analyze/page.tsx`: dynamic server component passes only image credential availability and local text-service health.
- `app/text-detector.tsx`: text entry, counts, validation, explicit submission, binary classification/model-score display and no persistent storage.
- `app/api/analyze-text/route.ts` → `lib/analyze-text.ts`: server-only local Fakespot service integration. `lib/text-config.ts` shares pure validation and result types with the browser.
- `app/image-preview.tsx` and `lib/magnifier.ts`: measured 2× optical zoom, animated lens path, pause control and reduced-motion handling.
- `app/api/analyze/route.ts`: Node server route, delegates to `lib/analyze.ts`.
- Backend: bounded multipart reading (8 MB plus 64 KB envelope), 10-second upload deadline, non-empty single-file checks, MIME/decoded-format matching, Sharp full decode and a 25-million-pixel ceiling, rejection of animations. Only still JPEG, PNG and WebP are accepted by this app.
- Multipart POST to `https://api.sightengine.com/1.0/check.json` with `media`, `models=genai`, `api_user`, `api_secret`. Provider timeout is 20 seconds; client timeout is 35 seconds. No automatic retries, which could consume more operations.
- Success requires `status=success` and a finite `type.ai_generated` between 0 and 1. The browser receives only that score, model/provider identifiers, and actual operations if supplied. Percentage is score × 100, rounded to one decimal for display.
- Sanitized errors cover missing/invalid credentials, bad media, quota/rate limits, malformed responses, provider failure and timeout. Raw upstream error messages and secrets are never logged or sent to the browser.
- Five attempts/minute per key, one active request per key, global 1.1-second spacing between provider calls. Limiter entries expire and the map is bounded. Without `TRUST_PROXY=true`, all clients share a local bucket. Enable it only behind a proxy which overwrites `X-Forwarded-For`. These in-memory limits reset on restart and do not coordinate multiple processes; use a shared store and gateway body limits before public deployment. This is not a hard billing cap.

## Official API verification and costs

Documentation checked October 15, 2026:

- [AI image detection and request/response contract](https://sightengine.com/docs/ai-generated-image-detection): authenticated multipart upload, `genai`, `type.ai_generated`, `request.operations`.
- [Supported formats](https://sightengine.com/faq/supported-image-types): provider supports JPEG, GIF, PNG, WebP, AVIF, BMP and TIFF. Shady deliberately offers a narrower browser-friendly subset and rejects animated files; no conversion is performed.
- [Error structure](https://sightengine.com/docs/api-error-codes-and-responses): `error.type` plus numeric `error.code`; mapped to safe local messages.
- [Operation accounting](https://sightengine.com/faq/what-is-an-operation): `genai` costs **5 operations per still image**, with animated frames multiplying usage. Legacy accounts may differ.
- [Pricing](https://sightengine.com/pricing): free testing plan available; Starter $29/month with 10,000 operations, Pro $99/month with 40,000. Both list $0.002 per extra operation: a 5-operation image costs $0.01 in overage. Included volumes correspond to approximately 2,000 and 8,000 still-image analyses if no other models consume operations. Paid overages can incur charges rather than stop processing. Confirm current pricing and your account terms before use.

## Privacy and limitations

The UI tells users before submission that the image will be sent to Sightengine. Until analysis it remains in the browser. Shady handles image bytes temporarily in memory; no database, disk upload directory, analytics, or image/result logging is used. Outbound filenames are replaced with a generic filename. Responses use `Cache-Control: no-store`. Rate limiting retains a hashed client key briefly, never image contents. Removing a preview does not revoke an already completed provider submission.

Sightengine is an external processor with its own [privacy policy](https://sightengine.com/privacy-policy) and account terms. Shady's no-retention statement describes this application only; check the provider's retention and contractual terms before sending sensitive images. Server memory use and third-party processing still exist even without persistent storage.

The score is model confidence that the image was generated or edited with AI, **not proof**, a calibrated real-world certainty, or a fraction of AI-generated pixels. False positives and negatives are possible. Compression, screenshots, edits, unfamiliar generators, and image content can affect reliability. Use provenance and human judgment. There are no heatmaps, generator attribution, fabricated explanations, or hard “real/fake” verdicts. Live API verification succeeded on October 15, 2026: a temporary 256×256 PNG was submitted through the local Next.js route and Sightengine returned HTTP 200, a valid genai confidence, and 5 operations consumed. The test image was created and handled in memory; its score is not used as an accuracy benchmark.

## Portfolio description

**Shady** is a full-stack image-analysis product demonstrating responsive frontend design, accessible file interactions, asynchronous state management, and a defensive TypeScript backend. A custom purple-and-yellow editorial landing page introduces a separate investigation workspace. During analysis, a magnifier roams across the actual uploaded image with precisely aligned 2× magnification. Reduced-motion preferences disable decorative animations. Server-side Next.js routes integrate Sightengine’s `genai` image model and the local Fakespot RoBERTa detector with upload decoding, timeouts, throttling, secure credential handling and clear failure recovery. Automated tests use mocked provider responses to verify real-response mapping and edge cases without consuming paid operations. The image detection model and score are credited to **Sightengine**; text classifications and model scores are credited to **Fakespot**.

## Validation

Vitest covers server success payloads and multipart parameters, absent credentials, invalid/MIME-mismatched/unsupported files, oversized bodies, cross-origin calls, provider quota/auth/plan/media errors, invalid scores, timeouts, unreadable provider responses, rate limiting and overlapping requests. Testing Library covers preview/reset, drag and drop, local validation, duplicate-click prevention, unavailable state, real percentage rendering and provider error display. Mock values are confined to tests.

Origin validation uses the actual HTTP Host to handle Next.js internal localhost normalization; regression tests cover loopback, mismatched ports/schemes, and cross-site origins. Updated verification: 63 JavaScript automated tests pass, plus the production build and TypeScript checks. A browser test verified landing-to-detector navigation, local upload, the animated lens and a successful real Sightengine result (5 operations).

## Frontend and assets

The `/` landing page uses the supplied purple eye logo, “THIS IS NOT AI” poster, orange observer illustration, and laptop/magnifier stickers, with yellow tape rendered as HTML text. Decorative illustrations are not detection results. The two stickers had baked-in checkerboards removed using the built-in imagegen tool; prompt: remove only the checkerboard, preserve the halftone art and paper border, export transparent alpha. The selected cutouts are optimized to WebP in `public/art/`. Originals are not uploaded to the detection API automatically. The wordmark uses locally hosted Cinzel (a classical serif chosen to match the reference style), licensed under the SIL Open Font License; see `public/fonts/OFL-Cinzel.txt`.

Get started opens `/analyze`. While a real request is pending, `app/image-preview.tsx` measures the actual displayed image, computes a bounded roaming path and reuses the same object URL at 2× scale inside a circular lens. Background offsets keep the magnified point aligned with the original point underneath it. This is optical magnification only: no pixel-grid fabrication, hidden-AI-trace claims, or heatmaps. The lens disappears immediately when the request resolves or fails. Pause and reduced-motion settings hold the lens still. Animation uses requestAnimationFrame with a 30fps update limit, suspends while the document is hidden, and cancels on unmount; ResizeObserver recalculates dimensions responsively. The landing page has no continuous decorative animation.

The application remains in `outputs/shady`; credentials stay in its git-ignored `.env.local`. Source ZIPs exclude secrets. Use the configured local checkout without replacing `.env.local`, or add your own credentials when extracting the ZIP. Development and production use Webpack for compatibility with this environment.

## Local Fakespot text service

No detector subscription, API key, or hosted inference credits are required for text detection. It downloads open-source model files and Python dependencies and uses this computer’s disk, RAM and CPU. Sightengine image billing remains separate and unchanged.

Use Python 3.12 (CPU PyTorch wheels required), Node 20.9+, and two terminals from this project directory. The configured checkout already has a project-local `.venv`; for a fresh checkout:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r text-service/requirements.lock.txt
# Terminal 1 (first startup downloads the model):
./scripts/text-service.sh
```

If Python 3.12 is unavailable, install it or use uv with a project-local runtime:

```sh
UV_PYTHON_INSTALL_DIR="$PWD/.runtime/python" UV_CACHE_DIR="$PWD/.runtime/uv" uv python install 3.12
UV_PYTHON_INSTALL_DIR="$PWD/.runtime/python" uv venv --python 3.12 .venv
UV_CACHE_DIR="$PWD/.runtime/uv" uv pip install --python .venv/bin/python -r text-service/requirements.lock.txt
./scripts/text-service.sh
```

In terminal 2, run `npm ci` then `npm run dev`. Open http://127.0.0.1:3000/analyze and select Text. Check http://127.0.0.1:8001/health for `status: ready`; reload the analysis page after the service starts. The service binds only to 127.0.0.1:8001, with one worker, two Torch CPU threads and one inference at a time. Stop it with Ctrl+C. No GPU is required. If a download/load fails, health reports HTTP 503 and the interface displays unavailable; restart after fixing network/storage/dependencies. Hugging Face network access is required for initial downloads, but cached inference can run offline afterward.

`FAKESPOT_SERVICE_URL=http://127.0.0.1:8001` in `.env.local` is an optional **server-only** override. It is never embedded in browser code. No text detector credential exists. Existing Sightengine credentials stay in the git-ignored file; only `.env.example` ships in the source ZIP. Python environments, model cache, bytecode and runtime downloads are also excluded.

### Model contract and attribution

Reviewed official [model card](https://huggingface.co/fakespot-ai/roberta-base-ai-text-detection-v1), linked [ApolloDFT usage repository](https://github.com/FakespotAILabs/ApolloDFT) and recommended `utils.py`. This is the open-source supervised RoBERTa component, **not the complete APOLLO ensemble** or Firefox extension. No ensemble accuracy claims apply here.

Pinned revision: `f9cdb14d1f8b105f597d80fa7b56f20c6ea0e9db`. The official config maps **0 → Human, 1 → AI**; the tokenizer declares **512 tokens**, including special tokens (RoBERTa position embeddings: 514). Loading checks this metadata and fails if it differs. `trust_remote_code=False`, `use_safetensors=True`; no pickled training/model files or downloaded Python are executed. The recommended cleaning implementation is reviewed and vendored unchanged as `text-service/cleaning.py`: removes Markdown code/images, formatting, blockquotes/tables and HTML, keeps link labels, decodes HTML entities, normalizes selected whitespace. Some non-prose content is removed by this preprocessing; token limits apply afterward. Text with no prose left is rejected.

Input guards on browser and Next/Python servers reject empty input and more than 10,000 UTF-16 character units. The authoritative Python tokenizer rejects more than 512 tokens **without truncation**; character count cannot predict token count. No language classifier is added: users must supply English prose. Short prose can be submitted but gives less context.

The output is the actual argmax label and corresponding softmax score from model logits, displayed as a percentage. It is a model estimate, not the percentage of AI-written words, proof of authorship, or calibrated real-world confidence. There is no mixed class, sentence attribution, fabricated explanation or invented confidence tier. Near 50% the two class scores are close; no arbitrary certainty threshold is introduced. False positives and negatives, unfamiliar generators/domains, editing, non-English input and short samples limit reliability.

The upstream model card declares **Apache-2.0**. Attribution, full license, pinned model card/config/tokenizer metadata and cleaner are included in `text-service/NOTICE.md` and neighboring files. Text model credit belongs to FakespotAI/Mozilla; Shady supplies the frontend, backend and local inference integration. Dependencies retain their respective licenses.

### Architecture, resources and privacy

Browser → same-origin Next `/api/analyze-text` → Python `/analyze` → reusable startup-loaded CPU model. Submitted text stays in volatile browser/server memory; this application has no submission database, file storage, analytics, content logging or access logs on the Python service. Model files are downloaded from Hugging Face, not submitted text. OS swap, crash dumps, hosting/reverse-proxy logging and transport are outside this application’s guarantees; review them for sensitive deployments. Local HTTP stays on loopback; use HTTPS/private authenticated networking between hosts.

Weights are roughly 500 MB; allow several GB of disk for the Python runtime, dependencies, cache and download overhead. Reserve roughly 2–4 GB of available RAM as a practical starting budget, then measure on the deployment hardware; CPU latency and memory vary. `.runtime/huggingface` is the model cache, `.runtime/python` the optional uv-managed Python, `.runtime/uv` the installer cache, and `.venv` the environment. Deleting these removes downloaded software/models, not saved submissions. Loading once reuses RAM until the process stops.

Next bounds JSON uploads at 64 KiB, responses at 16 KiB, body reading at 10 seconds and service calls/body reading at 25 seconds each; browser deadline is 35 seconds. Five attempts/client/minute, one active request/client, two active Next requests and ten service calls/process/minute are bounded in memory. Python bounds request bytes, input characters/tokens and upload time, rejects concurrent inference, and keeps its single slot until inference completes if a caller times out. There are no automatic inference retries. Unexpected/malformed responses, invalid input, service failure/busy and timeouts produce errors, never fallback scores. In-memory rate limits reset on restart and are not shared across processes.

For a public website, visitors **cannot reach your localhost service**. Deploy Next plus a private CPU inference service on your infrastructure, set the server-only URL to that service, add network access controls/authentication and gateway body/rate limits, and budget hosting/storage/compute costs. Keep the Python service behind the backend, never exposed directly to browsers. A serverless Next host alone does not host this Python model. Do not configure a public service without securing it.

### Verification

```sh
npm test
npm run typecheck
npm run build
.venv/bin/python -m pytest text-service -q
```

Routine tests mock inference: label mapping, close binary scores, cleaning, empty/excessive input, token overflow, health/loading failure, service errors/timeouts, malformed results, no text echoes, duplicate submissions, counters and draft retention. Existing Sightengine image tests remain intact. A real inference smoke test uses only non-sensitive sample prose and establishes that loading/inference work, not detection accuracy. Verified locally: Python health returned 200/ready; direct inference and the Next.js text endpoint both returned HTTP 200 with the same actual model label and score for non-sensitive sample prose. A 604-token sample was rejected with HTTP 422. This verifies operation only, not accuracy. All 63 JavaScript and 6 Python tests passed, TypeScript and the production build passed, and a real Sightengine request through the image endpoint returned HTTP 200. The Python tests emit one upstream Starlette/AnyIO deprecation warning.

## Reality Defender voice detection

Shady now has Image, Text and Audio tabs. Audio is a file-upload-only speech check; there is no microphone recording, remote URL import or speaker enrollment. Sightengine images and the local Fakespot text service remain independent.

### Setup and free access

1. Create/sign in to a [Reality Defender account](https://app.realitydefender.ai). In profile → Settings → API Keys, create a key. Enter it **only** in the project's git-ignored `.env.local`:

   ```dotenv
   REALITY_DEFENDER_API_KEY=your_reality_defender_api_key
   ```

2. Restart Next (`npm run dev`). Audio shows unavailable until a non-placeholder key is configured. Shady does not test a key or consume a scan just by opening a page; credential presence does not prove account validity. Existing Sightengine settings and Python startup instructions above are unchanged.
3. Confirm your account is on the intended Free plan, has audio/API access, has remaining scans, and has suitable retention/deletion settings before submitting a recording. Do not paste the key into chat, prefix it with `NEXT_PUBLIC_`, commit it, or put it in browser code. The local file may already contain your configured key; source archives contain `.env.example` only.

The [current RealAPI plan page](https://www.realitydefender.com/product/realapi), checked October 16, 2026, advertises Free at $0/month with **50 scans/month, image/audio analysis and API keys**. Shady shows that advertised allowance and a dashboard link, not an invented remaining balance. The allowance is shared with other uses of your Reality Defender account; Sightengine images do not consume Reality Defender scans. No documented account quota endpoint was verified, so Shady does not claim to track account-wide usage. It does not upgrade subscriptions or activate paid usage. Your actual account terms control billing, overages, scan counting/reset rules and eligibility: verify these in the dashboard/support. Application throttles are not an account-wide spending cap.

### Verified contract and supported recordings

The official [SDK overview](https://docs.realitydefender.com/sdks/quickstart) supports TypeScript via `@realitydefender/realitydefender`. Shady uses the documented REST contract directly to keep uploads in memory, enforce deadlines and control each poll, without the SDK's file-path requirement or automatic long-running loop.

The provider lists MP3, WAV, M4A, AAC, OGG, FLAC and ALAC, with a 20 MiB audio limit. **Shady deliberately starts with a narrower subset**: RIFF/WAVE, uncompressed signed little-endian **16-bit PCM**, a standard 16-byte format chunk, mono/stereo, 8–48 kHz, **1.5–60 seconds**, maximum **10 MiB**. Export a recording as PCM WAV to use it; renaming an MP3 does not convert it. No transcoding or silent clipping occurs. The public docs identify speech shorter than 1.5 seconds as not applicable; a fixed maximum audio duration was not established in the reviewed docs. The 60-second maximum is Shady's initial application limit, not a claimed provider limit. MP3 and other compressed formats can be added later with a bounded server decoder.

Client checks cover extension/MIME and size; server independently verifies the complete RIFF length/chunk boundaries, PCM format, sample rate/channels/block alignment/byte rate, complete data frames and every decoded signed sample. Duration is calculated from actual PCM frames, not browser metadata. Unsupported codecs, malformed/truncated files, duplicate data/format chunks and invalid durations are rejected before provider submission. Because accepted PCM is uncompressed, decoding needs no FFmpeg, Python or native audio dependency. Browser playback duration is informational until server validation succeeds.

Official workflow: [Quickstart](https://docs.realitydefender.com/api-reference/quickstart), [signed upload](https://docs.realitydefender.com/api-reference/endpoint/presigned), [media detail](https://docs.realitydefender.com/api-reference/endpoint/get_media_detail), and reviewed [TypeScript SDK source](https://github.com/Reality-Defender/realitydefender-sdk-typescript):

- POST `https://api.prd.realitydefender.xyz/api/files/aws-presigned` with `X-API-KEY` and JSON `{ "fileName": "recording.wav" }`. Read `requestId` and `response.signedUrl`. The generic filename avoids sending the user's filename.
- PUT the validated bytes once to that signed AWS URL. Never forward the API key to storage; allow only HTTPS URLs on the exact official API host (its observed upload proxy) or documented AWS hosts, and reject redirects. The signed URL stays on the server. No automatic POST/PUT retry occurs, even on ambiguous timeouts.
- GET `https://api.prd.realitydefender.xyz/api/media/users/{requestId}` with the server API key to check the **existing** analysis. A poll does not submit another upload. `ANALYZING` and `DOWNLOADING` remain in progress. Shady keeps polling only these documented statuses.
- Preserve the ensemble `resultsSummary.status` (fallback `overallStatus`) and `resultsSummary.metadata.finalScore` on its documented **0–100** scale. The TypeScript SDK normalizes this field by dividing by 100; Shady displays the original `/100` value instead. Missing/null is explicitly unavailable, and numeric zero is accepted. No raw per-model scores, private media URLs, explanations, reasons or user identifiers are forwarded.

Provider conclusions are `AUTHENTIC`, `FAKE` (displayed as Manipulated), `SUSPICIOUS` (review needed), `NOT_APPLICABLE` (inconclusive), and `UNABLE_TO_EVALUATE` (processing failure). Shady uses provider statuses without inventing thresholds. An absent ensemble score can still accompany a legitimate conclusion. Unknown statuses, wrong request/media IDs, non-finite/out-of-range scores and malformed JSON fail safely. Higher ensemble scores indicate higher estimated likelihood of manipulation; they are not proof, percentages of generated seconds, identity verification, lie detection or a guarantee of authenticity. Music/dial tones, cross-talk, noise, short clips and language constraints can make a recording unsuitable. Supply permitted single-speaker speech and interpret it alongside provenance and context.

### Server architecture, deadlines and duplication

`app/audio-detector.tsx` reuses Shady's workspace styling, accessible upload/reset controls and real-result states. Its preview uses a browser object URL, revoked on replacement/reset/unmount. `lib/audio-client.ts` manages bounded polling with increasing waits (2s, 3s, 4.5s, then at most 8s), a 120-second polling budget and no upload retries. A completed/failed attempt cannot be submitted again until explicitly reset; the UI directs ambiguous failures/timeouts to the provider dashboard.

`app/api/analyze-audio/route.ts` is Node-only and delegates POST/GET to `lib/analyze-audio.ts`. POST validates a bounded multipart body, decodes WAV, requests a signed URL and uploads once within a **25-second application deadline**. It returns an opaque random handle. GET uses that handle in an Authorization header to retrieve one existing provider result per request, with an **8-second deadline**. Route `maxDuration=30` avoids holding a single request open for the full analysis; browser upload deadline is 30 seconds and overall client deadline 155 seconds. API keys are isolated in server-only modules; no credentials or signed URLs enter result payloads.

A process-local map holds only handles, provider request IDs, timing/poll counters, final sanitized results and short-lived client-scoped SHA-256 content fingerprints for deduplication—**not audio bytes**. Entries expire after 10 minutes and are pruned on audio requests. The same bytes from the same client bucket reuse the existing handle rather than creating another scan. Three upload attempts/minute/client, two concurrent uploads, ten new provider submissions/hour/process, at most 100 handles, four concurrent GET polls, at least 1.5 seconds between checks of a handle and bounded per-job polls limit resource use. The server stops polling after 120 seconds; the provider scan may still finish. Restarting loses handles/deduplication, so check the provider dashboard before submitting again after interruption. The existing trusted-proxy caveat applies: without `TRUST_PROXY=true`, clients share a local bucket.

A failed PUT can have reached the provider: Shady marks upload confirmation uncertain and polls the original ID instead of retransmitting. Authentication, `free-tier-not-allowed`, `upload-limit-reached`, HTTP 402/429, rejection, service/network/timeout failures and malformed results receive sanitized errors. No provider response body, key, original filename or recording is logged by application code.

For production, use a long-running Node host with at least a 30-second request budget and gateway multipart limit above 10 MiB plus 64 KiB overhead. Some serverless hosts impose lower body limits despite `maxDuration`; adjust the application limits for the selected platform or use an appropriate host. Multi-instance/serverless deployment needs a shared TTL job/rate/deduplication store with access control, rather than this process-local map. Keep the existing Python inference service privately hosted for Text mode. Secure provider keys and review access, spend and request limits before opening a public endpoint.

### Audio privacy and provider retention

Shady displays the recipient before analysis. Upload bytes are held in request memory only; no disk temp files, database, audio logs or audio archives are created. They become eligible for collection after upload processing finishes, including failures. The browser retains its selected file/preview until reset or leaving the page. All application API responses use `Cache-Control: no-store`. OS swap/crash dumps, browser caches and deployment/proxy logs need separate operational review.

**Reality Defender retention is separate from Shady's handling.** Its [media-detail documentation](https://docs.realitydefender.com/api-reference/endpoint/get_media_detail) exposes a URL to stored originals that may be absent after retention deletion. Signed URL expiry is not deletion. The [DPA](https://www.realitydefender.com/t-c/data-processing-addendum) describes retention as needed to fulfill the agreement and return/deletion on request or termination subject to exceptions. The [website privacy policy](https://www.realitydefender.com/t-c/privacy-policy) uses purpose-dependent retention and says contracted services have additional notices. These sources do not establish an automatic zero-retention mode or fixed deletion period for your Free API account. Verify original-media/result retention, deletion controls, training/use permissions and applicable account terms with Reality Defender before sending sensitive recordings. Shady does not claim to delete the provider's copy when you remove a preview.

### Audio verification and attribution

Run `npm test`, `npm run typecheck`, `npm run build`, and the existing Python tests. Routine audio tests mock all provider traffic and never consume real scans. Coverage includes valid/invalid PCM, size/duration/format limits, zero/missing scores, successful/suspicious/inapplicable/failed results, polling backoff/timeout, authentication/quota/rate errors, unavailable credentials, malformed responses, private-field stripping, key isolation, uncertain uploads and duplicate locking. UI tests cover playback metadata, URL revocation, tabs, drop uploads, loading states and failures. Live integration validation is recorded below; routine automated tests still use only mocks. No fabricated fallback result is displayed. Existing image/text tests remain in the suite.

Audio detection models/results are supplied by **Reality Defender**; image detection by **Sightengine**; text classification by the **Fakespot** open-source model. Shady provides frontend interactions, validation, API orchestration, privacy disclosures and safe result handling.

Audio delivery verification (October 16, 2026): 108 JavaScript tests and 6 Python tests passed; TypeScript and production build passed. Browser inspection confirmed the Audio tab, limits, recipient/retention notices and disabled unavailable state. Live local Fakespot health and text inference returned HTTP 200. All existing Sightengine backend/UI tests passed; no additional live Sightengine scan was needed for the unchanged image integration. No Reality Defender scan was submitted without credentials. See the later live validation report for verification after key setup.

## Latest full validation

See [VALIDATION.md](../VALIDATION.md) for the October 16, 2026 full review: **111 JavaScript tests, 6 Python tests, TypeScript and production build passed**. All three live analysis routes were exercised using generated images/audio and non-sensitive prose. Reality Defender returned a legitimate `NOT_APPLICABLE` result without a score for synthetic tones; this verifies the API workflow, not voice-detection accuracy. The official API signed-upload proxy is now supported alongside AWS storage, and stale Fakespot API-key recovery guidance has been corrected. Temporary validation audio and signed-upload metadata were removed. Key rotation and account quota/retention verification remain account-owner tasks.

## WaveRep video analysis — restricted noncommercial demo

Video mode runs the official **WaveRep G4** detector locally. This integration is for the requested informational/nonprofit portfolio demo. WaveRep is **not unrestricted open source**: its [license](https://github.com/grip-unina/WaveRep-SyntheticVideoDetection/blob/main/LICENSE.md) prohibits unauthorized industrial/profit-oriented use, requires original notices to remain, and requires attribution when publishing results. The full license, reviewed original demo code and notices are preserved in `video-service/upstream/` and `video-service/NOTICE.md`. Other Shady modalities retain their own provider/model terms.

Credit: **Riccardo Corvi, Davide Cozzolino, Ekta Prashnani, Shalini De Mello, Koki Nagano and Luisa Verdoliva**, “Seeing What Matters: Generalizable AI-generated Video Detection with Forensic-Oriented Augmentation,” NeurIPS 2025, GRIP-UNINA. [Official repository](https://github.com/grip-unina/WaveRep-SyntheticVideoDetection), [demo instructions](https://github.com/grip-unina/WaveRep-SyntheticVideoDetection/blob/main/demo/README.md).

### Setup and startup

The local checkout already has the dependencies and verified G4 checkpoint. Fresh checkouts/source ZIPs exclude weights and Python environments. Use the existing Python 3.12 `.venv` (created above), then:

```sh
# From Shady's project directory; pinned complete environment:
UV_CACHE_DIR="$PWD/.runtime/uv" uv pip install --python .venv/bin/python -r video-service/requirements.lock.txt
# Or: .venv/bin/python -m pip install -r video-service/requirements.lock.txt
.venv/bin/python scripts/setup-video.py
./scripts/video-service.sh
```

This is a separate service on **127.0.0.1:8002**. Run it in another terminal alongside `npm run dev` and `./scripts/text-service.sh`. Keeping the video worker separate preserves the existing Fakespot text service and Sightengine/Reality Defender routes. The decoder is PyAV with bundled FFmpeg libraries; the tested wheel supports H.264 decoding and libx264 encoding for synthetic test clips. No system FFmpeg binary or GPU is required. Linux x86 CPU-only installations may use PyTorch's official CPU wheel index rather than installing CUDA packages; retain matching Torch/Torchvision versions.

Optional server-only `.env.local` setting: `WAVEREP_SERVICE_URL=http://127.0.0.1:8002`. Never use `NEXT_PUBLIC_`. No video API key, paid detector subscription or hosted inference credits are required. CPU, storage and hosting still have costs. Check http://127.0.0.1:8002/health; the page enables Video only when it sees the expected revision and ready state. Reload the page after service startup. Missing/corrupted weights or model-loading failures leave the feature unavailable, never populated with sample scores.

Source is pinned to **`0fd6010759c14b572b7842a28fa9f85fe1ddd2fd`**. Only `weights_dinov2_G4.ckpt` is downloaded from the official GRIP-UNINA HTTPS URL: **346,163,178 bytes (about 330.1 MiB)**. The setup script verifies the publisher's MD5 **`8bf19e6f68a92bed600dd97fbed3f2cd`**, also checked before model loading. Independently recorded SHA-256 after that match: **`50d639049d928986ba7d69861a4fe4f3e7afbba1843e3e089cdf6b4748f53d5b`** (not claimed to be a publisher-provided SHA-256). Installation writes a partial file and promotes it only after verification. No training data, G1 weights, denoiser weights or extra pretrained backbone are downloaded.

### Hardware and practical limits

A real CPU smoke test ran on this **Apple M5 Pro, arm64, 24 GiB RAM** machine with Torch 2.7.0, Torchvision 0.22.0, timm 1.0.12 and PyAV 16.0.1. A generated 1-second, 4-frame H.264 clip took **1.66 seconds** of processing after **5.91 seconds** model initialization; process peak RSS was approximately **1,103 MiB** (macOS `getrusage`, including libraries/model and the smoke test). A later full Shady route test processed all four frames in **1.67 seconds**. These are small synthetic smoke-test observations, not throughput guarantees or accuracy evaluation. Reserve several GB of free RAM for the combined app/text/video services and allow several GB of disk for environments, caches and downloaded dependencies.

CPU is explicit, with two Torch threads and batches of two frames. PyTorch reports MPS built but **MPS unavailable** in this environment; no Apple GPU execution was assumed or enabled. CUDA is not used.

Shady now accepts **up to 120 seconds**, **100 MiB**, **7,200 decoded frames**, **60 fps maximum average frame rate**, and **1920×1080 maximum pixel count per frame** (equivalent pixel-count portrait sizes allowed). These are application resource bounds, not inherent WaveRep limits. The 100 MiB policy bounds temporary disk use and transfer time while allowing compressed two-minute clips; high-bitrate clips may still exceed it. This is not a promise that every two-minute export fits. Only one upload/inference is admitted at a time. Frames remain in bounded batches of two, not an in-memory video array. Scores/timestamps grow to at most 7,200 entries. Next no longer buffers/parses a multipart upload or copies the whole file: the browser sends raw MP4 bytes and Next forwards a byte-counted, backpressure-controlled stream to Python's temporary file.

Default and hard duration ceiling are both 120 seconds. A smaller operational limit may be set in the **Python service shell**, for example `WAVEREP_MAX_SECONDS=60 ./scripts/video-service.sh`. This is not read from Next's `.env.local`. Restart Python after code/config changes and reload `/analyze`; service health advertises the effective duration. The former five-second default and 300-frame cap are removed.

Real non-sensitive synthetic H.264 CPU benchmarks on this machine, with startup-loaded G4 and batches of two:

| Clip | Frames scored | Final scored timestamp | Measured processing |
| --- | --- | --- | --- |
| 8 seconds at 4 fps | 32 / 32 | 7.75 s | 12.99 s |
| 12 seconds at 30 fps | 360 / 360 | 11.9667 s | 146.19 s |
| 120 seconds at 1 fps, through production Next upload/poll | 120 / 120 | 119 s | 48.50 s |

The denser measurement is about 0.406 seconds/frame. A **linear extrapolation**, not a completed benchmark, gives approximately **24 minutes at 120 seconds/30 fps**, or **49 minutes at 120 seconds/60 fps**. The two-minute **1-fps** run completed, but **two-minute 30-fps/60-fps inference was not run**. Content, competing workloads, temperature and hardware affect speed; benchmark the deployment host. The **two-hour worker deadline** provides headroom over that measured projection while bounding runaway jobs. Full analysis remains the only mode: it never silently switches to sampled frames. If that latency is unsuitable, a separately labelled sampled-frame mode could be added, but is not enabled here.

Oversized, unsupported, malformed, empty, ambiguous-timing and partially decoded clips are rejected. MP4 with exactly one H.264 video track is supported; other containers/codecs are not silently transcoded. An audio track can be present but is not decoded or analyzed. Browser preview duration is informational; the server checks actual stream duration, decoded-frame timestamps and the final-frame interval. A clip over 120 seconds or 7,200 frames is rejected, never shortened.

### Actual frame coverage and score meanings

The adapter follows the reviewed official `demo/utils.py` and `main_avideo.py`:

- Decode **every video frame** in presentation order with PyAV, as the official PyAV iterator supports. No `limit`, frame skipping, temporal resampling or selective sampling is used. The first pass validates complete decoding, dimensions, frame count, duration and presentation timestamps; the second pass scores every frame in bounded batches.
- Convert frames to RGB PIL images, **CenterCrop(504,504)** (torchvision zero-pads small frames), ToTensor, ImageNet normalization `mean=[0.485,0.456,0.406]`, `std=[0.229,0.224,0.225]`. There is no spatial resizing; only the center crop is assessed. The timeline is complete temporally, not a claim to cover every spatial pixel.
- Architecture: `vit_base_patch14_reg4_dinov2.lvd142m`, image size 504, one output. Shady constructs with `pretrained=False` and strictly loads the complete official checkpoint; all model tensors must match. This avoids downloading unused initial backbone weights that the official demo immediately replaces. `torch.load(..., weights_only=True, map_location='cpu')` prevents arbitrary checkpoint Python execution; no dynamic remote model code is executed.
- Outputs are raw scalar classifier **logits**, called **LLR** in the official demo documentation. The published frame rule is **LLR > 0 → synthetic frame**. Zero is not counted as synthetic. The UI reports the actual count out of all analyzed frames; this is a thresholded-frame count, not an authorship percentage or calibrated probability.
- Clip aggregation is the arithmetic mean of raw frame LLRs, exactly as `main_avideo.py` does; sigmoid is applied to that **mean**, not averaged over frame sigmoids. The UI explicitly labels the sigmoid as an uncalibrated transformed model score on 0–1, not a real-world authenticity probability. It does not invent confidence tiers or a clip-level identity/authenticity verdict.
- Timeline timestamps are actual decoded presentation timestamps normalized to the first decoded frame. Every score is preserved in the API and accessible frame table. The chart uses at most 300 buckets with ordered first/minimum/maximum/last points (at most 1,200 points), retaining short positive peaks. This is display aggregation only, never inference sampling. The table renders 50 rows per page with an optional LLR > 0 filter. Consecutive positive-frame sections and their timestamps/peaks are listed separately (first ten sections summarized; all positive frames remain accessible), so localized signals remain visible even when the official mean is negative. Section endpoints identify scored frame timestamps, not exact manipulation edit boundaries. UI rounding is display-only. The parser verifies indices, ordering, bounds, revision and arithmetic consistency before rendering a result. No heatmaps, generator attribution, invented explanations or sound-track scores are produced.

The detector can fail on unfamiliar generators, compression, editing, domains and content outside its training distribution. Center-crop analysis may miss activity elsewhere. A synthetic test-pattern result demonstrates pipeline operation only. Results do not prove authenticity, identify a speaker, establish truthfulness or validate soundtrack authenticity. Do not combine video scores with the separate audio detector as if they were a joint model.

### Jobs, cancellation, privacy and deployment

Browser → Next `/api/analyze-video` → private Python `/jobs`. Next uploads raw validated-size bytes to the configured server-only URL, returns an opaque job handle, and proxies short GET polls and DELETE cancellation requests. POST has a 120-second application/Python upload deadline (125 seconds in the browser), and route `maxDuration=150`; polls have an 8-second service timeout and 15-second browser request bound. Python verifies the actual container/codec after upload. The result JSON limit is 2 MiB, sufficient for the bounded 7,200-frame schema; larger responses fail explicitly. Processing is asynchronous in a persistent, startup-loaded Python subprocess, so no Next request waits for the full inference. Progress appears only after the decoder has verified the total frame count and the worker has actually scored frames. No fake progress, estimated completion percentage before decoding or automatic upload retry exists.

Python accepts one upload/inference job at a time. Its worker loads G4 once and reuses it for normal jobs. A hard **7,200-second (two-hour) processing deadline** covers validation/decoding/inference; on timeout or cancellation the supervisor terminates the subprocess, waits for it to stop, removes temporary input, and reloads a fresh worker for subsequent jobs. Browser polling is bounded at 7,260 seconds (at most 3,630 checks, every two seconds), with an overall 7,440-second controller covering upload and processing. Timeouts never return a partial result. Background-tab timer throttling/network loss may still stop browser observation; the worker deadline remains authoritative. Closing/resetting an in-flight component requests cancellation where a handle is available. If a network interruption prevents cancellation, the Python hard deadline remains the fallback.

Temporary videos are stored under `.runtime/video-tmp/job-*` with unpredictable names and removed after success/failure/cancellation. Extracted frames remain only in bounded process memory; no frame files, user filenames, audio transcripts or video-content logs are created. Aborted uploads clean up immediately. A stopped/crashed application cannot run a cleanup `finally`; a single service instance removes leftover `job-*` directories on its next startup. Do not share that temporary directory between multiple service instances. Results and timestamps remain only in bounded in-memory job maps, with 9,000-second (150-minute) TTLs pruned on requests; submitted video bytes are not retained there. Preview URLs are revoked on reset/replacement/unmount. API responses use `Cache-Control: no-store`. OS swap/crash dumps, browser storage and infrastructure logs need separate operational controls.

Next limits uploads to three attempts/client/minute, one in-flight upload, a bounded handle map, same-origin checks and at least one second between polls per handle. Python limits recent jobs to ten and single active inference/upload. Existing trusted-proxy caveats apply. **Process-local jobs and handles are not durable across either service or Next restarts.** There is no automatic resume or upload resubmission. A sleeping browser may lose polling even while a worker continues. For public deployment, persistent CPU workers, bounded/durable job storage and a queue are required; configure proxy/host upload limits to at least the chosen 100 MiB policy and allow the 120-second upload window. A host enforcing smaller body limits can reject uploads before this code. Streaming at the route does not disable upstream proxy buffering. A serverless function alone cannot host the persistent Python worker or preserve process-local handles. This is a local portfolio implementation; public multi-instance deployment needs authenticated private service access, shared bounded job/rate storage, gateway upload limits, process/resource supervision and a host that supports persistent CPU workers. Visitors cannot reach this computer's localhost service. Keep the Python endpoint private; do not expose it directly to browsers. WaveRep's nonprofit/informational license also limits deployment scope.

### Video verification

```sh
npm test
npm run typecheck
npm run build
.venv/bin/python -m pytest text-service video-service -q
# Optional real smoke test, only after installing verified weights:
.venv/bin/python video-service/smoke.py
```

Routine tests never download models or perform inference: they mock results/workers and generate tiny non-sensitive decoder fixtures. They cover format/size/duration/frame limits, real timestamp mapping, raw-score aggregation and threshold semantics, malformed outputs, missing/changed checkpoints, unavailable service, failures, polling deadlines, duplicate prevention, cancellation and temporary-file cleanup. Existing image, text and audio tests remain. Real CPU smoke inference, full Next upload/poll results, and subprocess cancellation were tested locally. Further check outcomes are recorded in the delivery validation report; none establishes detection accuracy.

Video results now lead with a plain-language frame-signal headline: “AI-generation signals detected” when at least one frame meets the published LLR > 0 rule, otherwise “No AI-generation signals detected.” The exact count appears immediately below it. This reports the presence of thresholded frame signals; it is not a new clip-level classification, confidence threshold, majority vote or authenticity guarantee. A clip with some positive frames can have a negative mean LLR; both are preserved and shown distinctly.

### Two-minute upgrade verification

- `npm test`: **150 tests passed**, including existing image, text and audio routes/interfaces, streamed-upload bounds with tiny fixtures, 7,200-frame result/progress parsing, >256 KiB results, peak preservation and paginated 7,200-frame rendering.
- `.venv/bin/python -B -m pytest video-service/test_video.py text-service -q -p no:cacheprovider`: **19 tests passed**. Real lightweight 32×32 H.264 decoder fixtures cover exactly 120 seconds/60 fps/7,200 frames and rejection at 7,201 frames. Mock inference covers all 360 frames at 12 seconds/30 fps with batches capped at two. Timeout termination, failure/cancellation cleanup and unavailable weights are covered. A Starlette/AnyIO deprecation warning remains in the test client dependency.
- TypeScript and production build passed. Real G4 benchmarks are in the table above; no external paid-provider calls were made for regression checks. This confirms mocked image/audio regression behavior, not a newly charged live-provider scan.
- Real cancellation through Next terminated an existing job, removed `.runtime/video-tmp/job-*`, and reloaded the worker. A subsequent 120-second/1-fps real inference job completed through production Next on port 3001, returned all 120 frames through timestamp 119 seconds, exposed 25 distinct progress values, and cleaned its upload. Generated clips were deleted.
- An initial development-server observation lost its Next process-local handle during hot reload while files/build artifacts changed. The worker completed and cleaned the input; the stable production-server run succeeded. This is why hot reload/restarts cannot promise job continuity. No automatic resubmission is performed.

### Appearance

The header offers light/dark mode on the landing and analysis pages. Light uses warm ivory paper surfaces and dark purple accents; dark preserves the original palette. First visit follows the browser system preference; an explicit choice is saved only in browser localStorage (`shady-theme`) and applied before rendering to avoid a theme flash. No submitted content is stored by this preference. Switching still works with blocked storage, but cannot survive reloads in that case.
