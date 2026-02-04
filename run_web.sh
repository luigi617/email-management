#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PID=""
PORT_START=8000
PORT_END=9000

cleanup() {
  echo ""
  echo "Stopping server..."
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

pick_free_port() {
  local start="${1:-8000}"
  local end="${2:-9000}"

  # 1) Best option: ask Python for an ephemeral free port (reliable, cross-platform)
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY'
import socket
s = socket.socket()
s.bind(("127.0.0.1", 0))  # 0 => OS chooses free port
print(s.getsockname()[1])
s.close()
PY
    return 0
  fi

  # 2) Next: scan a range using lsof
  if command -v lsof >/dev/null 2>&1; then
    local p
    for ((p=start; p<=end; p++)); do
      if ! lsof -iTCP:"$p" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
        echo "$p"
        return 0
      fi
    done
  fi

  # 3) Fallback: /dev/tcp scan (Bash feature; may not work everywhere)
  local p
  for ((p=start; p<=end; p++)); do
    if (echo >/dev/tcp/127.0.0.1/"$p") >/dev/null 2>&1; then
      : # port is open (something listening)
    else
      echo "$p"
      return 0
    fi
  done

  echo "ERROR: could not find a free port in ${start}-${end}" >&2
  return 1
}

echo "Building frontend..."
cd "${BASE_DIR}/webapp/frontend"
npm ci
npm run build

echo "Starting FastAPI (prod-like)..."
cd "${BASE_DIR}/webapp"

PORT="$(pick_free_port "${PORT_START}" "${PORT_END}")"

# No --reload (faster) and prod-ish settings
uvicorn main:app --host 0.0.0.0 --port "${PORT}" --log-level warning &
BACKEND_PID=$!

echo ""
echo "Open: http://localhost:${PORT}"
echo "Press Ctrl+C to stop"
wait "${BACKEND_PID}"
