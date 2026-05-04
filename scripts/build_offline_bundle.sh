#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/build/offline_bundle"
IMAGES_DIR="${OUT_DIR}/deploy/offline/images"
ARCHIVE_PATH="${ROOT_DIR}/build/spectrogram-writer-offline-bundle.tar.gz"

rm -rf "$OUT_DIR"
mkdir -p "$IMAGES_DIR"
rm -f "$ARCHIVE_PATH"

echo "[1/6] Building backend image..."
docker build -t spectrogram-writer-backend:offline -f "$ROOT_DIR/backend/Dockerfile" "$ROOT_DIR"

echo "[2/6] Building frontend image..."
docker build -t spectrogram-writer-frontend:offline -f "$ROOT_DIR/frontend/Dockerfile" "$ROOT_DIR"

echo "[3/6] Saving backend image..."
docker save -o "$IMAGES_DIR/spectrogram-writer-backend-offline.tar" spectrogram-writer-backend:offline

echo "[4/6] Saving frontend image..."
docker save -o "$IMAGES_DIR/spectrogram-writer-frontend-offline.tar" spectrogram-writer-frontend:offline

echo "[5/6] Copying deployment files..."
cp -R "$ROOT_DIR/deploy/offline" "$OUT_DIR/deploy/offline"
cp "$ROOT_DIR/deploy/nginx/default.conf" "$OUT_DIR/deploy/offline/nginx.default.conf"

cat > "$OUT_DIR/deploy/offline/README_DEPLOY.md" <<'DOC'
# Offline deployment

## Prerequisites on target server
- Docker Engine
- Docker Compose plugin (`docker compose`)

## Steps
1. Copy this `deploy/offline` directory to the server.
2. On server run:
   ```bash
   cd deploy/offline
   chmod +x load_and_run.sh
   ./load_and_run.sh
   ```
3. Open `http://<SERVER_IP>:8080`.

## Stop service
```bash
docker compose -f docker-compose.yml down
```
DOC

echo "[6/6] Creating archive..."
tar -C "$OUT_DIR" -czf "$ARCHIVE_PATH" deploy

echo "Bundle ready: $ARCHIVE_PATH"
