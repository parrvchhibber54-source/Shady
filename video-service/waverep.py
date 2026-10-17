"""Shady adapter of the pinned GRIP-UNINA WaveRep demo; informational/nonprofit use only.
Original authors: Riccardo Corvi, Davide Cozzolino, Ekta Prashnani,
Shalini De Mello, Koki Nagano, Luisa Verdoliva. See upstream/LICENSE.md.
"""
import hashlib
import math
import os
from pathlib import Path
import time

REVISION = '0fd6010759c14b572b7842a28fa9f85fe1ddd2fd'
CHECKPOINT_MD5 = '8bf19e6f68a92bed600dd97fbed3f2cd'
ROOT = Path(__file__).resolve().parent.parent
WEIGHTS = ROOT / '.runtime/waverep/weights_dinov2_G4.ckpt'
MAX_BYTES = 100 * 1024 * 1024
MAX_SECONDS = min(120.0, max(.1, float(os.environ.get('WAVEREP_MAX_SECONDS', '120'))))
MAX_FRAMES = 7200
MAX_PIXELS = 1920 * 1080
TIMEOUT = 7200

class InvalidVideo(ValueError):
    pass


def verify_weights(path=WEIGHTS):
    digest = hashlib.md5(usedforsecurity=False)
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            digest.update(chunk)
    if digest.hexdigest() != CHECKPOINT_MD5:
        raise RuntimeError('G4 checksum mismatch')


def inspect_video(path):
    import av
    if not 0 < Path(path).stat().st_size <= MAX_BYTES:
        raise InvalidVideo('Choose a non-empty MP4 up to 100 MiB.')
    with open(path, 'rb') as f:
        header = f.read(12)
    if header[4:8] != b'ftyp':
        raise InvalidVideo('Use an MP4 container with H.264 video.')
    try:
        with av.open(str(path), mode='r') as container:
            streams = container.streams.video
            if len(streams) != 1:
                raise InvalidVideo('Use an MP4 with exactly one video track.')
            stream = streams[0]
            codec = stream.codec_context
            if codec.name != 'h264' or codec.width <= 0 or codec.height <= 0 or codec.width * codec.height > MAX_PIXELS:
                raise InvalidVideo('Use H.264 video up to 1920×1080 pixels (or equivalent pixel count).')
            if stream.duration is None or stream.time_base is None or not stream.average_rate:
                raise InvalidVideo('Video duration and frame timing must be readable.')
            duration = float(stream.duration * stream.time_base)
            fps = float(stream.average_rate)
            if not math.isfinite(duration) or not 0 < duration <= MAX_SECONDS or not 0 < fps <= 60:
                raise InvalidVideo(f'Use a complete video up to {MAX_SECONDS:g} seconds and 60 fps; no frames are skipped.')
            timestamps = []
            first = None
            for frame in container.decode(stream):
                if frame.pts is None or frame.time_base is None:
                    raise InvalidVideo('Every video frame must have a presentation timestamp.')
                t = float(frame.pts * frame.time_base)
                if first is None:
                    first = t
                t -= first
                if not math.isfinite(t) or t < 0 or (timestamps and t <= timestamps[-1]):
                    raise InvalidVideo('Video timestamps must increase in presentation order.')
                if frame.width * frame.height > MAX_PIXELS or frame.width <= 0 or frame.height <= 0:
                    raise InvalidVideo('Decoded frame dimensions exceed the supported limit.')
                timestamps.append(t)
                if len(timestamps) > MAX_FRAMES or t > MAX_SECONDS:
                    raise InvalidVideo('Video exceeds the complete-frame processing limits.')
            if not timestamps or (stream.frames and len(timestamps) != stream.frames):
                raise InvalidVideo('Video is empty, truncated, or has missing decoded frames.')
            # Do not accept an undecoded tail hidden behind valid header metadata.
            if abs(timestamps[-1] + 1 / fps - duration) > max(.1, 2 / fps):
                raise InvalidVideo('Decoded frame coverage does not match the video duration.')
            return {'duration': duration, 'fps': fps, 'frame_count': len(timestamps), 'timestamps': timestamps, 'width': codec.width, 'height': codec.height}
    except InvalidVideo:
        raise
    except Exception:
        raise InvalidVideo('The MP4 could not be completely decoded.') from None


def aggregate(frames):
    if not frames or any(not math.isfinite(f['llr']) for f in frames):
        raise ValueError('Invalid model output')
    mean = math.fsum(f['llr'] for f in frames) / len(frames)
    # Official main_avideo.py: expit(mean(frame LLR)). Not a calibrated probability.
    sigmoid = 1 / (1 + math.exp(-mean)) if mean >= 0 else math.exp(mean) / (1 + math.exp(mean))
    return {'mean_llr': mean, 'sigmoid_mean_llr': sigmoid, 'synthetic_frame_count': sum(f['llr'] > 0 for f in frames), 'frame_count': len(frames)}


class Detector:
    def __init__(self, weights=WEIGHTS):
        import torch
        import timm
        from torchvision import transforms
        verify_weights(weights)
        torch.set_num_threads(2)
        self.torch = torch
        self.device = 'cpu'
        # The full checkpoint replaces every tensor (strict=True), so a separate
        # pretrained backbone download is unnecessary and cannot affect inference.
        self.model = timm.create_model('vit_base_patch14_reg4_dinov2.lvd142m', num_classes=1, pretrained=False, img_size=504)
        checkpoint = torch.load(weights, map_location='cpu', weights_only=True)
        if 'state_dict' in checkpoint:
            checkpoint = {k[6:]: v for k, v in checkpoint['state_dict'].items() if k.startswith('model')}
        self.model.load_state_dict(checkpoint, strict=True)
        self.model.to('cpu').eval()
        self.transform = transforms.Compose([transforms.CenterCrop((504, 504)), transforms.ToTensor(), transforms.Normalize(mean=[.485, .456, .406], std=[.229, .224, .225])])
        del checkpoint

    def predict(self, path, progress=lambda *_: None):
        import av
        started = time.monotonic()
        info = inspect_video(path)
        progress(0, info['frame_count'])
        results, batch, indices = [], [], []
        batch_size = 2
        def run_batch():
            with self.torch.inference_mode():
                predictions = self.model(self.torch.stack(batch).to('cpu'))[:, -1].cpu().tolist()
            for index, prediction in zip(indices, predictions, strict=True):
                if not math.isfinite(prediction):
                    raise ValueError('Invalid model output')
                results.append({'index': index, 'timestamp': info['timestamps'][index], 'llr': prediction})
            progress(len(results), info['frame_count'])
            batch.clear()
            indices.clear()
        with av.open(str(path), mode='r') as container:
            for index, frame in enumerate(container.decode(video=0)):
                if index >= info['frame_count'] or time.monotonic() - started > TIMEOUT:
                    raise TimeoutError('Video processing deadline reached')
                # Matches the upstream PyAV iterator: RGB PIL -> official transform.
                batch.append(self.transform(frame.to_image().convert('RGB')))
                indices.append(index)
                if len(batch) == batch_size:
                    run_batch()
            if batch:
                run_batch()
        if len(results) != info['frame_count']:
            raise InvalidVideo('The complete video could not be decoded on the inference pass.')
        return {'provider': 'WaveRep', 'checkpoint': 'G4', 'source_revision': REVISION, 'coverage': 'all_decoded_frames', 'crop': 504, 'duration': info['duration'], 'frames': results, **aggregate(results), 'processing_seconds': time.monotonic() - started, 'device': 'cpu'}
