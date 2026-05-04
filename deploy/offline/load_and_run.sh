#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"

echo "[1/3] Loading backend image..."
docker load -i images/spectrogram-writer-backend-offline.tar

echo "[2/3] Loading frontend image..."
docker load -i images/spectrogram-writer-frontend-offline.tar

echo "[3/3] Starting services..."
docker compose -f docker-compose.yml up -d

echo "Done. Open: http://<server-ip>:8080"
