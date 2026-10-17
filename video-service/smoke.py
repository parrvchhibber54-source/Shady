"""Non-sensitive, programmatically generated H.264 clip; not an accuracy test."""
import json
import resource
import tempfile
from pathlib import Path
import time
import av
import numpy as np
from waverep import Detector


def make_clip(path, frames=4, fps=4):
    with av.open(str(path), 'w', format='mp4') as output:
        stream = output.add_stream('libx264', rate=fps)
        stream.width, stream.height, stream.pix_fmt = 640, 504, 'yuv420p'
        for index in range(frames):
            image = np.zeros((504, 640, 3), dtype=np.uint8)
            image[:, :, 0] = np.arange(640, dtype=np.uint16)[None, :] % 256
            image[:, :, 1] = (index * 35 + 80) % 256
            image[100:300, 100 + index * 4:300 + index * 4, 2] = 220
            for packet in stream.encode(av.VideoFrame.from_ndarray(image, format='rgb24')):
                output.mux(packet)
        for packet in stream.encode():
            output.mux(packet)


if __name__ == '__main__':
    start = time.monotonic()
    detector = Detector()
    loaded = time.monotonic() - start
    with tempfile.TemporaryDirectory(prefix='shady-waverep-smoke-') as directory:
        path = Path(directory) / 'synthetic.mp4'
        make_clip(path)
        result = detector.predict(path)
    print(json.dumps({'load_seconds': loaded, 'processing_seconds': result['processing_seconds'], 'frames': result['frame_count'], 'duration': result['duration'], 'mean_llr': result['mean_llr'], 'sigmoid_mean_llr': result['sigmoid_mean_llr'], 'peak_rss_mib_macos': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024**2, 'device': detector.device}))
