"""Local CPU Fakespot service. No remote Python code, request storage, or text logging."""
import os
from pathlib import Path
os.environ.setdefault('HF_HOME', str(Path(__file__).resolve().parent.parent / '.runtime' / 'huggingface'))
os.environ.setdefault('HF_HUB_DISABLE_TELEMETRY', '1')
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from cleaning import clean_text

MODEL = 'fakespot-ai/roberta-base-ai-text-detection-v1'
REVISION = 'f9cdb14d1f8b105f597d80fa7b56f20c6ea0e9db'
MAX_CHARS = 10_000
MAX_TOKENS = 512
LABELS = {0: 'Human', 1: 'AI'}

class InvalidText(ValueError):
    pass

def validate(document):
    if not isinstance(document, str) or not document.strip():
        raise InvalidText('Provide non-empty English text.')
    # UTF-16 count matches the browser and Next.js guard.
    if len(document.encode('utf-16-le')) // 2 > MAX_CHARS:
        raise InvalidText('Use at most 10,000 characters. Text is never truncated.')
    cleaned = clean_text(document)
    if not cleaned.strip():
        raise InvalidText('No readable prose remains after text cleaning.')
    return cleaned

class Engine:
    def __init__(self):
        import torch
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        torch.set_num_threads(2)
        self.torch = torch
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL, revision=REVISION, trust_remote_code=False)
        self.model = AutoModelForSequenceClassification.from_pretrained(MODEL, revision=REVISION, trust_remote_code=False, use_safetensors=True).to('cpu').eval()
        if self.model.config.id2label != LABELS or self.tokenizer.model_max_length != MAX_TOKENS:
            raise RuntimeError('Unexpected model metadata')

    def predict(self, document):
        cleaned = validate(document)
        encoded = self.tokenizer(cleaned, return_tensors='pt', truncation=False)
        tokens = encoded['input_ids'].shape[1]
        if tokens > MAX_TOKENS:
            raise InvalidText(f'Text has {tokens} tokens after cleaning; maximum is 512 including special tokens. Shorten it; no text was truncated.')
        with self.torch.inference_mode():
            probabilities = self.torch.softmax(self.model(**encoded).logits, dim=-1)[0]
        index = int(probabilities.argmax().item())
        return {'provider': 'Fakespot', 'label': LABELS[index], 'score': float(probabilities[index].item()), 'tokens': tokens, 'model_revision': REVISION}

def create_app(factory=Engine):
    @asynccontextmanager
    async def lifespan(app):
        app.state.engine = None
        app.state.busy = False
        app.state.failed = False
        try:
            app.state.engine = await asyncio.to_thread(factory)
        except Exception:
            # Do not expose exception messages, which can include filesystem/network details.
            app.state.failed = True
        yield
        app.state.engine = None

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    @app.middleware('http')
    async def no_store(request, call_next):
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        return response

    @app.get('/health')
    async def health():
        ready = app.state.engine is not None
        return JSONResponse({'status': 'ready' if ready else 'unavailable', 'model_revision': REVISION}, status_code=200 if ready else 503)

    @app.post('/analyze')
    async def analyze(request: Request):
        if app.state.engine is None:
            return JSONResponse({'error': 'Local model failed to load. Check model download and service setup.'}, status_code=503)
        if app.state.busy:
            return JSONResponse({'error': 'Local detector is busy. Try again later.'}, status_code=429)
        if request.headers.get('content-type', '').split(';')[0] != 'application/json':
            return JSONResponse({'error': 'Send application/json.'}, status_code=415)
        # Reserve before reading to bound simultaneous uploads as well as inference.
        app.state.busy = True
        try:
            async def read():
                body = bytearray()
                async for chunk in request.stream():
                    body.extend(chunk)
                    if len(body) > 64 * 1024:
                        raise InvalidText('Request too large.')
                import json
                return json.loads(body)
            try:
                data = await asyncio.wait_for(read(), timeout=10)
            except asyncio.TimeoutError:
                return JSONResponse({'error': 'Upload timed out.'}, status_code=408)
            except Exception:
                return JSONResponse({'error': 'Invalid or excessive JSON request.'}, status_code=400)
            if not isinstance(data, dict) or set(data) != {'document'}:
                raise InvalidText('Provide only a document field.')
            validate(data['document'])
            # Keep the single slot occupied until inference finishes, even if the caller times out.
            result = await asyncio.to_thread(app.state.engine.predict, data['document'])
            return JSONResponse(result, headers={'Cache-Control': 'no-store'})
        except InvalidText as exc:
            return JSONResponse({'error': str(exc)}, status_code=422)
        except Exception:
            return JSONResponse({'error': 'Local model inference failed.'}, status_code=503)
        finally:
            app.state.busy = False
    return app

app = create_app()
