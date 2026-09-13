#!/bin/zsh
set -eu
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"
NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  NODE_BIN="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [[ ! -x "$NODE_BIN" || ! -f node_modules/next/dist/bin/next ]]; then
  print -u2 'Node.js 또는 프로젝트 의존성이 없습니다. 개발 점검 문서의 로컬 복구 안내를 확인해주세요.'
  exit 1
fi
export PATH="$(dirname "$NODE_BIN"):$PATH"
exec "$NODE_BIN" node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3000
