from types import SimpleNamespace
import pytest
from fastapi.testclient import TestClient
from service import create_app, validate, InvalidText, Engine, LABELS, REVISION
from cleaning import clean_text

class FakeEngine:
    def predict(self, text):
        return {'provider': 'Fakespot', 'label': 'Human', 'score': .75, 'tokens': 12, 'model_revision': REVISION}

def test_cleaning_and_validation():
    assert clean_text('**Hello** [world](https://example.org)\n`secret`') == 'Hello world '
    assert validate('Hello') == 'Hello'
    for value in ['', None, 'a' * 10001, '```only code```']:
        with pytest.raises(InvalidText):
            validate(value)

@pytest.mark.parametrize('index,label', [(0, 'Human'), (1, 'AI')])
def test_real_engine_mapping_with_mocked_inference(index, label):
    class Probabilities:
        def argmax(self): return SimpleNamespace(item=lambda: index)
        def __getitem__(self, i): return SimpleNamespace(item=lambda: .8)
    from contextlib import nullcontext
    engine = object.__new__(Engine)
    engine.tokenizer = lambda *a, **kw: {'input_ids': SimpleNamespace(shape=(1, 12))}
    engine.model = lambda **kw: SimpleNamespace(logits=None)
    engine.torch = SimpleNamespace(inference_mode=nullcontext, softmax=lambda *a, **kw: [Probabilities()])
    assert engine.predict('Some English prose.')['label'] == label
    assert LABELS == {0: 'Human', 1: 'AI'}
    engine.tokenizer = lambda *a, **kw: {'input_ids': SimpleNamespace(shape=(1, 513))}
    with pytest.raises(InvalidText, match='513 tokens'):
        engine.predict('Too many tokens')

def test_health_response_validation_and_busy():
    with TestClient(create_app(FakeEngine)) as client:
        assert client.get('/health').json()['status'] == 'ready'
        assert client.post('/analyze', json={'document': 'A sample.'}).json()['score'] == .75
        for data in [{'document': ''}, {'document': 'a' * 10001}, {'document': 'x', 'extra': True}, {'document': '```gone```'}]:
            assert client.post('/analyze', json=data).status_code == 422
        assert client.post('/analyze', content='bad', headers={'content-type': 'application/json'}).status_code == 400
        client.app.state.busy = True
        assert client.post('/analyze', json={'document': 'Sample'}).status_code == 429

def test_load_failure_and_inference_failure_do_not_echo_text():
    def broken(): raise RuntimeError('private filesystem data')
    with TestClient(create_app(broken)) as client:
        assert client.get('/health').status_code == 503
        assert client.post('/analyze', json={'document': 'private sample'}).status_code == 503
    class BrokenEngine:
        def predict(self, text): raise RuntimeError(text)
    with TestClient(create_app(BrokenEngine)) as client:
        response = client.post('/analyze', json={'document': 'private sample'})
        assert response.status_code == 503
        assert 'private sample' not in response.text

def test_pinned_safe_cpu_loading(monkeypatch):
    import torch
    import transformers
    calls = []
    class FakeModel:
        config = SimpleNamespace(id2label=LABELS)
        def to(self, device):
            assert device == 'cpu'
            return self
        def eval(self): return self
    def tokenizer(*args, **kwargs):
        calls.append(kwargs)
        return SimpleNamespace(model_max_length=512)
    def model(*args, **kwargs):
        calls.append(kwargs)
        return FakeModel()
    monkeypatch.setattr(transformers.AutoTokenizer, 'from_pretrained', tokenizer)
    monkeypatch.setattr(transformers.AutoModelForSequenceClassification, 'from_pretrained', model)
    Engine()
    assert all(c['revision'] == REVISION and c['trust_remote_code'] is False for c in calls)
    assert calls[1]['use_safetensors'] is True
