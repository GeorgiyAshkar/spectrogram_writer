# Offline deployment

## Why "no space left on device" happens
Docker loads images into `/var/lib/docker`. Even if your archive is compressed, unpacking layers requires a lot of free disk in Docker storage.

## Prerequisites on target server
- Docker Engine
- Docker Compose plugin (`docker compose`)
- Free space in Docker storage (`/var/lib/docker`) recommended: **at least 8-12 GB**

## Check free space
```bash
df -h /var/lib/docker || df -h /
docker system df
```

## If space is low
```bash
docker compose -f docker-compose.yml down || true
docker system prune -af
```
> Warning: prune removes unused containers/images/cache globally.

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
