#!/usr/bin/env python3
"""Check publishable Git files without printing matched credentials or contents.

This is a basic publication guard, not a comprehensive security scanner. With
--staged, inspect only index blobs; otherwise inspect tracked/unignored files.
"""
from pathlib import Path
import argparse
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
PATTERNS = [
    re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    re.compile(rb'gh[pousr]_[A-Za-z0-9]{30,}'),
    re.compile(rb'github_pat_[A-Za-z0-9_]{50,}'),
    re.compile(rb'rd_[a-f0-9]{16}_[a-f0-9]{32}'),
]
EXCLUDED_PARTS = {'.venv', '.runtime', 'node_modules', '.next', '__pycache__', '.pytest_cache', 'coverage'}

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def check(staged=False):
    args = ['ls-files', '-z', '--cached']
    if not staged: args += ['--others', '--exclude-standard']
    names = sorted(set(git(*args).decode().strip('\0').split('\0')) - {''})
    known = []
    local = ROOT / '.env.local'
    if local.exists():
        for line in local.read_text().splitlines():
            if '=' not in line or line.lstrip().startswith('#'): continue
            key, value = line.split('=', 1)
            value = value.strip().strip('\"\'')
            if any(word in key for word in ['SECRET', 'API_KEY', 'API_USER']) and len(value) > 7:
                known.append(value.encode())
    failures = []
    total = 0
    for name in names:
        path = Path(name)
        if not staged and not (ROOT/path).is_file(): continue
        if any(part in EXCLUDED_PARTS for part in path.parts) or (path.name.startswith('.env') and path.name != '.env.example') or path.suffix.lower() in {'.ckpt', '.pt', '.pth', '.safetensors', '.pem', '.key', '.p12', '.onnx'}:
            failures.append((name, 'private/runtime file included'))
            continue
        data = git('show', f':{name}') if staged else (ROOT/path).read_bytes()
        total += len(data)
        if len(data) > 50 * 1024 * 1024: failures.append((name, 'file exceeds repository 50 MiB policy'))
        if any(secret in data for secret in known) or any(pattern.search(data) for pattern in PATTERNS):
            failures.append((name, 'possible credential/private key; value withheld'))
    for name, reason in failures: print(f'FAIL: {name}: {reason}')
    print(f'Checked {len(names)} files ({total/1024**2:.2f} MiB); {len(failures)} finding(s). Matched contents are never printed.')
    return 1 if failures else 0

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--staged', action='store_true')
    sys.exit(check(parser.parse_args().staged))
