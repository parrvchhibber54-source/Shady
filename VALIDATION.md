# Shady validation — October 16, 2026

## Completed checks

- 111 JavaScript tests passed, using mocked provider responses.
- 6 Python tests passed, using mocked model inference. One upstream Starlette/AnyIO deprecation warning remains; it does not fail tests.
- TypeScript typecheck and production Next.js build passed.
- Live Sightengine request through Shady: HTTP 200, valid provider score, 5 operations consumed. Only a generated 128×128 PNG was submitted.
- Live Fakespot request through Shady: HTTP 200, actual binary model result for non-sensitive sample prose.
- Reality Defender credentials successfully authenticated. Live signed upload PUT returned HTTP 200; polling returned AUDIO / NOT_APPLICABLE / no ensemble score for a generated tone.
- The complete Next.js audio route also returned POST 202 / processing, then GET 200 / completed with Reality Defender's actual NOT_APPLICABLE result and null score.
- These smoke tests verify integration operation, not detector accuracy. No real/private voice recording was submitted. The system TTS tool produced an empty recording, which Shady correctly rejected before provider upload. Two actual synthetic-tone uploads were made; additional signed-upload reservations occurred during diagnosis. Check the provider dashboard for its account-specific scan accounting.
- Temporary audio files and signed-upload metadata were deleted; no key or signed URL was printed. No automatic upload retry was used.
- Mobile browser inspection showed the stacked Audio UI without horizontal overflow (375px document/content width).
- Scanned 24 built browser JavaScript/JSON/map files: none contained configured Sightengine or Reality Defender credential values. `.env.local` permissions verified as 0600.

## Issues found and fixed

Reality Defender's live signed URL used its exact official API host as an upload proxy. The original AWS-only restriction rejected it. The allowlist now accepts HTTPS on that exact API host as well as documented AWS hosts, without forwarding API keys to uploads or following redirects. Added a regression test.

Corrected text-mode recovery instructions: local Fakespot needs its Python service, not an invented API key. Added a regression test. Corrected metadata punctuation and added streaming upload-size/cancellation checks.

## Limits and remaining account action

Audio deliberately supports only 16-bit uncompressed PCM WAV, mono/stereo, 8–48 kHz, 1.5–60 seconds, up to 10 MiB. Text remains English-only, maximum 512 tokens after cleaning. Models can be wrong; no result proves authorship, identity or truthfulness.

Key rotation was not performed. Provider credential creation/revocation requires the account owner's action in the Reality Defender dashboard; browser credential-change rules require a user handoff. Rotate the key shared in chat, then update `.env.local` privately and restart Next.js. Do not paste replacement credentials into chat.

Account-wide remaining quota, paid overage settings and exact provider retention/deletion settings have not been verified through authenticated account-management access. The application shows advertised free-plan information and links to the provider dashboard; it does not claim a remaining quota or spending guarantee. Public multi-instance deployment still requires the shared job/rate store and private Python hosting described in README.md.

## WaveRep video integration — October 16, 2026

Implemented a fourth Video tab and a separate localhost FastAPI inference service on port 8002. Existing Sightengine image, Fakespot text and Reality Defender audio routes/UI remain. No provider keys were changed. The source ZIP excludes all credentials, Python environments, downloaded weights/caches and temporary media.

Official source pinned at `0fd6010759c14b572b7842a28fa9f85fe1ddd2fd`. G4 checkpoint verified against publisher MD5 `8bf19e6f68a92bed600dd97fbed3f2cd`; 346,163,178 bytes. Independent SHA-256: `50d639049d928986ba7d69861a4fe4f3e7afbba1843e3e089cdf6b4748f53d5b`. Restricted informational/nonprofit license and original code/notices retained. No training data or training runs were used.

Real CPU inference ran before completion of integration on Apple M5 Pro / arm64 / 24 GiB RAM. A programmatically generated one-second H.264 test-pattern clip contained four frames, all analyzed. Model load: 5.91 seconds; inference/decoding: 1.66 seconds; peak smoke-process RSS: 1,103 MiB. MPS reported unavailable; CPU was explicit. A full Next.js upload/poll smoke returned HTTP 202 then 200, all four actual timestamps (0, .25, .5, .75 seconds), raw frame LLRs, the mean and sigmoid(mean). Processing time: 1.67 seconds. These are integration/performance observations, not detection-accuracy evidence. The clip was synthetic graphics, not a benchmark of generated-video detection.

Default duration reduced from the requested 15-second starting ceiling to 5 seconds because observed CPU frame cost suggests a full high-fps 15-second clip may exceed the 180-second deadline. Configuration permits up to 15 seconds, still subject to 300-frame, 60fps, 25MiB and 1920×1080 pixel-count limits. No frames are skipped and no result is returned for a partial clip. The input is center-cropped to 504×504 as in the official demo.

A second live job was explicitly cancelled through Next DELETE: the service returned `cancelled`, terminated its worker, removed the temporary clip and reloaded the model. The temporary-video directory was checked empty afterward, and health returned ready again. Original test clips were deleted. Failed uploads/decoding/worker errors, timeout termination, cleanup and cancellation are additionally covered by model-free tests.

141 JavaScript tests and 16 Python tests passed, including all original image/text/audio tests. TypeScript and production build passed. Live Fakespot health and text inference again returned HTTP 200. No additional paid Sightengine/Reality Defender scan was necessary for this video-only change; their mocked regression suites passed. Desktop/mobile browser layout was inspected, with no horizontal overflow at 375px content width. Browser file-chooser automation did not select the synthetic file, so the real full-route upload/inference/cancellation verification used HTTP; preview/reset/progress/timeline UI behavior is covered by component tests.

Known operational limits: one local video worker/job at a time; no GPU support enabled; persistent worker hosting/shared job stores/authenticated private networking needed for public multi-instance deployment. WaveRep's license is not unrestricted open source and does not authorize industrial/profit-oriented use. See README.md and video-service/NOTICE.md for setup, exact semantics, privacy and attribution.

Video result clarity update: the UI now displays the factual presence/absence of frames crossing the published LLR > 0 rule, with exact counts and an explicit no-proof notice. No new clip-level authenticity threshold or confidence band was added. 143 JavaScript tests, TypeScript and production build passed after this presentation change; Python inference was unchanged.

## Two-minute WaveRep upgrade (2026-10-16)

Supersedes the earlier five-second/300-frame operating limits. Current policy: 120 seconds, 100 MiB, 60 fps, 7,200 frames; every decoded center crop is scored. Worker timeout 7,200s, poll window 7,260s, browser 7,440s, job TTL 9,000s. Raw streaming uploads replace multipart buffering. Result cap 2 MiB. UI uses a peak-preserving display envelope and 50-row pagination; inference is not sampled.

Real CPU: 8s/4fps/32 frames in 12.9868s; 12s/30fps/360 frames in 146.1912s, last timestamp 11.9667s; production Next route 120s/1fps/120 frames in 48.4984s, last timestamp 119s, 25 distinct observed progress values. Dense two-minute inference was not benchmarked. Real cancellation removed temporary input and reloaded the worker; subsequent full job cleanup verified. All clips were generated non-sensitive patterns and deleted.

150 Vitest tests, 19 Python tests, TypeScript check and production build passed. Boundary decoding tested 120s/60fps/7,200 lightweight frames, rejection of 7,201; routine model inference mocked. Image/text/audio regression tests pass; no live paid image/audio scans were consumed. Starlette test client emits one existing AnyIO deprecation warning. Development hot reload can lose process-local handles; stable production run verified separately.
