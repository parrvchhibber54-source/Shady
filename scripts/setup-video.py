#!/usr/bin/env python3
"""Download only the official WaveRep G4 weights; never a training dataset."""
import hashlib
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
URL = 'https://www.grip.unina.it/download/prog/WaveRep_SynthVideoDet/weights_dinov2_G4.ckpt'
PUBLISHER_MD5 = '8bf19e6f68a92bed600dd97fbed3f2cd'
# SHA-256 measured after matching the publisher MD5; not claimed publisher-provided.
VERIFIED_SHA256 = '50d639049d928986ba7d69861a4fe4f3e7afbba1843e3e089cdf6b4748f53d5b'
DEST = ROOT / '.runtime/waverep/weights_dinov2_G4.ckpt'
SIZE = 346163178


def valid(path):
    if not path.exists() or path.stat().st_size != SIZE:
        return False
    md5, sha = hashlib.md5(usedforsecurity=False), hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            md5.update(chunk)
            sha.update(chunk)
    return md5.hexdigest() == PUBLISHER_MD5 and sha.hexdigest() == VERIFIED_SHA256


def main():
    print('WaveRep G4: informational/nonprofit use only. See video-service/upstream/LICENSE.md.')
    DEST.parent.mkdir(parents=True, exist_ok=True)
    if valid(DEST):
        print('Existing G4 checkpoint checksum verified.')
        return
    partial = DEST.with_suffix('.ckpt.part')
    try:
        with urllib.request.urlopen(URL, timeout=30) as response, partial.open('wb') as output:
            size = 0
            while chunk := response.read(1024 * 1024):
                size += len(chunk)
                if size > SIZE:
                    raise RuntimeError('Checkpoint exceeded its expected size')
                output.write(chunk)
        if not valid(partial):
            raise RuntimeError('Checkpoint checksum mismatch; model not installed')
        partial.replace(DEST)
        print('G4 downloaded and verified (publisher MD5 and independently recorded SHA-256).')
    finally:
        partial.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
