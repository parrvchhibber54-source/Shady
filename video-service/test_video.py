"""Model-free validation and lifecycle tests. All clips are programmatically generated."""
import asyncio
import importlib.util
from pathlib import Path
import sys
import threading
import time
from types import SimpleNamespace

import av
import numpy as np
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent))
import waverep
from smoke import make_clip

spec = importlib.util.spec_from_file_location('shady_video_api', Path(__file__).with_name('service.py'))
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)


def frames():
    return [{'index': 0, 'timestamp': 0., 'llr': -6.}, {'index': 1, 'timestamp': .25, 'llr': 2.}, {'index': 2, 'timestamp': .5, 'llr': 1.}]


def result():
    data = frames()
    return {'provider': 'WaveRep', 'checkpoint': 'G4', 'source_revision': waverep.REVISION, 'coverage': 'all_decoded_frames', 'crop': 504, 'duration': .75, 'frames': data, **waverep.aggregate(data), 'processing_seconds': .1, 'device': 'cpu'}


def test_official_aggregation_and_rule():
    summary = waverep.aggregate(frames())
    assert summary['mean_llr'] == -1
    assert summary['synthetic_frame_count'] == 2
    assert summary['sigmoid_mean_llr'] == pytest.approx(.26894142137)
    assert waverep.aggregate([{'llr': 0}])['synthetic_frame_count'] == 0
    with pytest.raises(ValueError): waverep.aggregate([{'llr': float('nan')}])


def test_real_decoder_and_actual_timestamps(tmp_path):
    p = tmp_path / 'synthetic.mp4'
    make_clip(p)
    info = waverep.inspect_video(p)
    assert info['frame_count'] == 4
    assert info['duration'] == 1
    assert info['timestamps'] == [0, .25, .5, .75]
    assert info['width'] == 640


def test_rejects_invalid_empty_duration_and_frame_limits(tmp_path, monkeypatch):
    p = tmp_path / 'bad.mp4'
    for data in [b'', b'not a video', b'\0\0\0\x18ftypisom' + b'broken']:
        p.write_bytes(data)
        with pytest.raises(waverep.InvalidVideo): waverep.inspect_video(p)
    make_clip(p)
    monkeypatch.setattr(waverep, 'MAX_SECONDS', .5)
    with pytest.raises(waverep.InvalidVideo, match='complete video'): waverep.inspect_video(p)
    monkeypatch.setattr(waverep, 'MAX_SECONDS', 5)
    monkeypatch.setattr(waverep, 'MAX_FRAMES', 2)
    with pytest.raises(waverep.InvalidVideo, match='processing limits'): waverep.inspect_video(p)


def test_rejects_unsupported_codec(tmp_path):
    p = tmp_path / 'mpeg4.mp4'
    with av.open(str(p), 'w') as output:
        s = output.add_stream('mpeg4', rate=4)
        s.width = s.height = 64
        s.pix_fmt = 'yuv420p'
        for _ in range(4):
            for packet in s.encode(av.VideoFrame.from_ndarray(np.zeros((64,64,3), dtype=np.uint8), format='rgb24')): output.mux(packet)
        for packet in s.encode(): output.mux(packet)
    with pytest.raises(waverep.InvalidVideo, match='H.264'): waverep.inspect_video(p)


def test_checksum_missing_or_changed(tmp_path):
    with pytest.raises(FileNotFoundError): waverep.verify_weights(tmp_path/'missing')
    p = tmp_path/'changed'
    p.write_bytes(b'not the official checkpoint')
    with pytest.raises(RuntimeError, match='checksum'): waverep.verify_weights(p)


class FakeSupervisor:
    ready = False
    def __init__(self): self.stopped = False
    async def start(self): self.ready = True
    async def stop(self): self.ready = False; self.stopped = True
    async def run(self, path, job):
        assert Path(path).exists()
        assert Path(path).read_bytes() == b'mocked-video'
        job['progress'] = {'processed_frames': 3, 'total_frames': 3}
        return 'completed', result()


def wait_terminal(client, token):
    for _ in range(100):
        d = client.get('/jobs/'+token).json()
        if d['state'] != 'processing': return d
        time.sleep(.005)
    raise AssertionError('job did not finish')


def test_jobs_return_actual_mock_result_and_remove_temp_files(tmp_path):
    with TestClient(api.create_app(FakeSupervisor, tmp_path)) as client:
        assert client.get('/health').json()['status'] == 'ready'
        assert client.post('/jobs', content=b'x', headers={'content-type':'image/png'}).status_code == 415
        r = client.post('/jobs', content=b'mocked-video', headers={'content-type':'video/mp4'})
        assert r.status_code == 202
        token = r.json()['job']
        d = wait_terminal(client, token)
        assert d['result'] == result()
        for _ in range(100):
            if not list(tmp_path.iterdir()): break
            time.sleep(.005)
        assert not list(tmp_path.iterdir())
        assert client.get('/jobs/missing').status_code == 404


def test_unavailable_model_and_invalid_upload_cleanup(tmp_path, monkeypatch):
    class Missing(FakeSupervisor):
        async def start(self): self.ready = False
    with TestClient(api.create_app(Missing, tmp_path)) as client:
        assert client.get('/health').status_code == 503
        assert client.post('/jobs', content=b'x', headers={'content-type':'video/mp4'}).status_code == 503
    monkeypatch.setattr(api, 'MAX_BYTES', 2)
    with TestClient(api.create_app(FakeSupervisor, tmp_path)) as client:
        assert client.post('/jobs', content=b'xxx', headers={'content-type':'video/mp4'}).status_code == 422
        assert not list(tmp_path.iterdir())


def test_worker_failure_cleans_temp_files(tmp_path):
    class Broken(FakeSupervisor):
        async def run(self, path, job): raise RuntimeError('private path or content')
    with TestClient(api.create_app(Broken, tmp_path)) as client:
        token=client.post('/jobs', content=b'mocked-video', headers={'content-type':'video/mp4'}).json()['job']
        d=wait_terminal(client,token)
        assert d['state']=='failed'
        assert 'private' not in d['error']
        assert not list(tmp_path.iterdir())


def test_cancellation_stops_worker_and_cleans_temp_files(tmp_path):
    class Waiting(FakeSupervisor):
        async def run(self,path,job):
            while not job.get('cancel'): await asyncio.sleep(.005)
            await self.stop()
            return 'cancelled', {'error':'Video analysis cancelled.'}
    with TestClient(api.create_app(Waiting,tmp_path)) as client:
        token=client.post('/jobs', content=b'mocked-video', headers={'content-type':'video/mp4'}).json()['job']
        assert client.post('/jobs', content=b'other', headers={'content-type':'video/mp4'}).status_code==429
        assert client.delete('/jobs/'+token).status_code==200
        assert wait_terminal(client,token)['state']=='cancelled'
        assert not list(tmp_path.iterdir())


def test_supervisor_deadline_terminates_process(monkeypatch):
    supervisor=api.Supervisor()
    supervisor.connection=SimpleNamespace(send=lambda _:None,poll=lambda _:False,close=lambda:None)
    terminated=[]
    supervisor.process=SimpleNamespace(is_alive=lambda:True,terminate=lambda:terminated.append(True),kill=lambda:None,join=lambda *args:None)
    monkeypatch.setattr(api,'TIMEOUT',0)
    kind,payload=asyncio.run(supervisor.run('mock-path',{}))
    assert kind=='failed' and 'timed out' in payload['error']
    assert terminated and not supervisor.ready


def make_small_clip(path, count, fps):
    with av.open(str(path), 'w', format='mp4') as output:
        stream = output.add_stream('libx264', rate=fps)
        stream.width = stream.height = 32
        stream.pix_fmt = 'yuv420p'
        image = av.VideoFrame.from_ndarray(np.zeros((32,32,3), dtype=np.uint8), format='rgb24')
        for _ in range(count):
            for packet in stream.encode(image): output.mux(packet)
        for packet in stream.encode(): output.mux(packet)


def test_two_minute_60fps_boundary_and_rejection(tmp_path):
    p = tmp_path/'boundary.mp4'
    make_small_clip(p, 7200, 60)
    info = waverep.inspect_video(p)
    assert info['duration'] == 120 and info['frame_count'] == 7200
    assert info['timestamps'][-1] == pytest.approx(7199/60)
    make_small_clip(p, 7201, 60)
    with pytest.raises(waverep.InvalidVideo): waverep.inspect_video(p)


def test_mock_inference_keeps_all_frames_beyond_old_caps(tmp_path):
    import torch
    p = tmp_path/'long.mp4'
    make_small_clip(p, 360, 30)
    detector = object.__new__(waverep.Detector)
    detector.torch = torch
    sizes = []
    def model(batch):
        sizes.append(len(batch))
        return torch.ones((len(batch),1))
    detector.model = model
    detector.transform = lambda image: torch.zeros((3,2,2))
    progress = []
    data = detector.predict(p, lambda n,total: progress.append((n,total)))
    assert data['frame_count'] == 360
    assert data['frames'][-1]['timestamp'] == pytest.approx(359/30)
    assert data['mean_llr'] == 1 and max(sizes) == 2
    assert progress[-1] == (360,360)


def test_timeout_failure_cleans_temp_files(tmp_path):
    class Deadline(FakeSupervisor):
        async def run(self,path,job):
            await self.stop()
            return 'failed', {'error':'Video processing timed out. No partial assessment is returned.'}
    with TestClient(api.create_app(Deadline,tmp_path)) as client:
        token=client.post('/jobs', content=b'mocked-video', headers={'content-type':'video/mp4'}).json()['job']
        assert wait_terminal(client,token)['state']=='failed'
        assert not list(tmp_path.iterdir())
