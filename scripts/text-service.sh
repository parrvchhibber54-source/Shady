#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
export HF_HOME="$PWD/.runtime/huggingface"
export HF_HUB_DISABLE_TELEMETRY=1
exec .venv/bin/python -m uvicorn service:app --app-dir text-service --host 127.0.0.1 --port 8001 --workers 1 --no-access-log --limit-concurrency 8 --timeout-keep-alive 5
