"""Local-only, single-worker WaveRep inference with killable jobs and temporary uploads."""
import asyncio
from contextlib import asynccontextmanager
import multiprocessing
from pathlib import Path
import secrets
import shutil
import tempfile
import time

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from waverep import Detector, InvalidVideo, MAX_BYTES, MAX_SECONDS, MAX_FRAMES, REVISION, TIMEOUT, ROOT


def worker_main(connection):
    try:
        detector = Detector()
        connection.send(('ready', None))
    except Exception:
        connection.send(('unavailable', None))
        connection.close()
        return
    while True:
        try:
            path = connection.recv()
        except EOFError:
            return
        try:
            result = detector.predict(path, lambda done, total: connection.send(('progress', {'processed_frames': done, 'total_frames': total})))
            connection.send(('completed', result))
        except InvalidVideo as exc:
            connection.send(('failed', {'error': str(exc)}))
        except TimeoutError:
            connection.send(('failed', {'error': 'Video processing timed out. No partial assessment is returned.'}))
        except Exception:
            connection.send(('failed', {'error': 'WaveRep inference failed. No assessment is available.'}))


class Supervisor:
    def __init__(self):
        self.process = None
        self.connection = None
        self.ready = False

    async def start(self):
        self.ready = False
        context = multiprocessing.get_context('spawn')
        parent, child = context.Pipe()
        self.connection = parent
        self.process = context.Process(target=worker_main, args=(child,), daemon=True)
        self.process.start()
        child.close()
        if await asyncio.to_thread(parent.poll, 120):
            try:
                self.ready = parent.recv()[0] == 'ready'
            except (EOFError, OSError):
                pass
        if not self.ready:
            await self.stop()

    async def stop(self):
        self.ready = False
        if self.process:
            if self.process.is_alive():
                self.process.terminate()
                await asyncio.to_thread(self.process.join, 2)
                if self.process.is_alive():
                    self.process.kill()
                    await asyncio.to_thread(self.process.join)
            else:
                await asyncio.to_thread(self.process.join)
        if self.connection:
            self.connection.close()
        self.process, self.connection = None, None

    async def run(self, path, job):
        self.connection.send(str(path))
        start = time.monotonic()
        while time.monotonic() - start < TIMEOUT:
            if job.get('cancel'):
                await self.stop()
                return 'cancelled', {'error': 'Video analysis cancelled.'}
            if not self.process.is_alive():
                await self.stop()
                return 'failed', {'error': 'The inference worker stopped unexpectedly.'}
            if await asyncio.to_thread(self.connection.poll, .1):
                kind, payload = self.connection.recv()
                if kind == 'progress':
                    job['progress'] = payload
                else:
                    return kind, payload
        await self.stop()
        return 'failed', {'error': 'Video processing timed out. No partial assessment is returned.'}


def create_app(supervisor_factory=Supervisor, temp_root=None):
    directory = Path(temp_root or ROOT / '.runtime/video-tmp')
    jobs = {}
    active = None
    task = None
    uploading = False
    closing = False

    @asynccontextmanager
    async def lifespan(app):
        nonlocal task, closing
        directory.mkdir(parents=True, exist_ok=True)
        # A single service owns this directory. Remove leftovers from a prior crash.
        for path in directory.glob('job-*'):
            if path.is_dir():
                shutil.rmtree(path)
        app.state.detector = supervisor_factory()
        await app.state.detector.start()
        yield
        closing = True
        if active and active in jobs:
            jobs[active]['cancel'] = True
        await app.state.detector.stop()
        if task:
            await asyncio.gather(task, return_exceptions=True)

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    @app.middleware('http')
    async def privacy_headers(request, call_next):
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        return response

    @app.get('/health')
    async def health():
        ready = app.state.detector.ready
        return JSONResponse({'status': 'ready' if ready else 'unavailable', 'provider': 'WaveRep', 'source_revision': REVISION, 'device': 'cpu', 'max_seconds': MAX_SECONDS, 'max_bytes': MAX_BYTES, 'max_frames': MAX_FRAMES, 'busy': active is not None or uploading}, status_code=200 if ready else 503)

    async def execute(token, path, folder):
        nonlocal active
        job = jobs[token]
        job['state'] = 'processing'
        try:
            kind, payload = await app.state.detector.run(path, job)
            job['state'] = kind
            if kind == 'completed':
                job['result'] = payload
            else:
                job['error'] = payload.get('error', 'Video analysis failed.')
        except Exception:
            job['state'] = 'failed'
            job['error'] = 'Video analysis failed. No assessment is available.'
            await app.state.detector.stop()
        finally:
            # On timeout/cancellation the subprocess has been stopped before removal.
            folder.cleanup()
            active = None
            if not closing and not app.state.detector.ready:
                await app.state.detector.start()

    @app.post('/jobs')
    async def submit(request: Request):
        nonlocal active, task, uploading
        if not app.state.detector.ready:
            return JSONResponse({'error': 'WaveRep is unavailable. Verify the G4 checkpoint and service setup.'}, status_code=503)
        if active is not None or uploading:
            return JSONResponse({'error': 'WaveRep is processing another clip. Please try later.'}, status_code=429)
        if request.headers.get('content-type', '').split(';')[0] != 'video/mp4':
            return JSONResponse({'error': 'Upload MP4 video bytes.'}, status_code=415)
        for token in list(jobs):
            if jobs[token]['expires'] < time.monotonic():
                jobs.pop(token)
        if len(jobs) >= 10:
            return JSONResponse({'error': 'Too many recent video jobs. Please wait.'}, status_code=429)
        folder = tempfile.TemporaryDirectory(prefix='job-', dir=directory)
        path = Path(folder.name) / 'clip.mp4'
        uploading = True
        accepted = False
        try:
            async def read():
                size = 0
                with path.open('wb') as output:
                    async for chunk in request.stream():
                        size += len(chunk)
                        if size > MAX_BYTES:
                            raise InvalidVideo('MP4 exceeds 100 MiB.')
                        output.write(chunk)
                if not size:
                    raise InvalidVideo('Choose a non-empty MP4.')
            await asyncio.wait_for(read(), timeout=120)
            token = secrets.token_hex(32)
            jobs[token] = {'state': 'processing', 'expires': time.monotonic() + 9000, 'progress': None}
            active = token
            task = asyncio.create_task(execute(token, path, folder))
            accepted = True
            return JSONResponse({'job': token, 'state': 'processing'}, status_code=202)
        except asyncio.TimeoutError:
            return JSONResponse({'error': 'Video upload timed out.'}, status_code=408)
        except InvalidVideo as exc:
            return JSONResponse({'error': str(exc)}, status_code=422)
        except Exception:
            return JSONResponse({'error': 'Video upload failed.'}, status_code=400)
        finally:
            uploading = False
            if not accepted:
                folder.cleanup()

    @app.get('/jobs/{token}')
    async def status(token: str):
        job = jobs.get(token)
        if not job or job['expires'] < time.monotonic():
            return JSONResponse({'error': 'Video job expired or service restarted.'}, status_code=404)
        return {key: job[key] for key in ['state', 'progress', 'result', 'error'] if key in job}

    @app.delete('/jobs/{token}')
    async def cancel(token: str):
        job = jobs.get(token)
        if not job:
            return JSONResponse({'error': 'Video job expired.'}, status_code=404)
        if job['state'] == 'processing':
            job['cancel'] = True
        return {'state': 'cancelling' if job.get('cancel') else job['state']}

    return app

app = create_app()
