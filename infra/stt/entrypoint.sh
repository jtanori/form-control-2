#!/usr/bin/env bash
# Download the ggml model if needed, then run whisper-server.
set -euo pipefail

MODEL="${WHISPER_MODEL:-base}"
DIR="${WHISPER_MODELS_DIR:-/models}"
PORT="${WHISPER_PORT:-8080}"
THREADS="${WHISPER_THREADS:-4}"
FILE="${DIR}/ggml-${MODEL}.bin"

mkdir -p "${DIR}"

if [[ ! -f "${FILE}" ]]; then
  echo "[stt] downloading ggml-${MODEL}.bin → ${FILE}"
  curl -fL --retry 3 --retry-delay 2 \
    -o "${FILE}.partial" \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${MODEL}.bin"
  mv "${FILE}.partial" "${FILE}"
  echo "[stt] model ready"
fi

echo "[stt] whisper-server model=${MODEL} port=${PORT} threads=${THREADS}"
exec whisper-server \
  -m "${FILE}" \
  -t "${THREADS}" \
  --port "${PORT}" \
  --host 0.0.0.0
