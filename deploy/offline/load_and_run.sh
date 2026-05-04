#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGES_DIR="${SCRIPT_DIR}/images"

if [[ ! -f "${IMAGES_DIR}/spectrogram-writer-backend-offline.tar" ]] || [[ ! -f "${IMAGES_DIR}/spectrogram-writer-frontend-offline.tar" ]]; then
  echo "ERROR: image tar files were not found in ${IMAGES_DIR}" >&2
  echo "Expected files:" >&2
  echo "  - ${IMAGES_DIR}/spectrogram-writer-backend-offline.tar" >&2
  echo "  - ${IMAGES_DIR}/spectrogram-writer-frontend-offline.tar" >&2
  echo "Tip: run this script from deploy/offline and keep the images/ directory рядом." >&2
  exit 1
fi

cd "$SCRIPT_DIR"

echo "[1/3] Loading backend image..."
docker load -i "${IMAGES_DIR}/spectrogram-writer-backend-offline.tar"

echo "[2/3] Loading frontend image..."
docker load -i "${IMAGES_DIR}/spectrogram-writer-frontend-offline.tar"

echo "[3/3] Starting services..."
docker compose -f docker-compose.yml up -d

echo "Done. Open: http://<server-ip>:8080"
