#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"

check_space() {
  local target="/var/lib/docker"
  if [[ ! -d "$target" ]]; then
    target="/"
  fi

  local avail_kb
  avail_kb=$(df -Pk "$target" | awk 'NR==2 {print $4}')
  local min_kb=$((6 * 1024 * 1024))

  if (( avail_kb < min_kb )); then
    echo "ERROR: Not enough free space in $target."
    echo "Available: $((avail_kb / 1024 / 1024)) GB, required at least: 6 GB"
    echo "Try cleanup: docker system prune -af"
    exit 1
  fi
}

check_space

echo "[1/3] Loading backend image..."
gunzip -c images/spectrogram-writer-backend-offline.tar.gz | docker load

echo "[2/3] Loading frontend image..."
gunzip -c images/spectrogram-writer-frontend-offline.tar.gz | docker load

echo "[3/3] Starting services..."
docker compose -f docker-compose.yml up -d

echo "Done. Open: http://<server-ip>:8080"
