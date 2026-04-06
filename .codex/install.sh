#!/usr/bin/env bash
set -euo pipefail

# Fast, repeatable local setup for Docker + project containers.
# - Installs Docker when missing (Ubuntu/Debian)
# - Enables BuildKit for faster cached builds
# - Pre-pulls base images to reduce first-run latency
# - Builds services in parallel and starts stack

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v docker >/dev/null 2>&1; then
  echo "[setup] Docker not found. Installing docker package..."
  "${ROOT_DIR}/scripts/install-docker.sh"
fi

if ! docker info >/dev/null 2>&1; then
  echo "[setup] Docker daemon is not reachable. Starting service..."
  sudo systemctl enable --now docker
fi

# BuildKit speeds up layer builds and improves cache reuse.
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Pre-pull common images to cut cold-start wait during compose build/up.
# Keep this idempotent and non-fatal if some pull fails temporarily.
for image in postgres:16-alpine maven:3.9.9-eclipse-temurin-21 eclipse-temurin:21-jre node:22-alpine; do
  docker pull "$image" >/dev/null 2>&1 || true
done

echo "[setup] Building backend and desktop images in parallel..."
docker compose -f "${ROOT_DIR}/docker-compose.yml" build --parallel

echo "[setup] Starting services (detached)..."
docker compose -f "${ROOT_DIR}/docker-compose.yml" up -d

echo "[setup] Current status:"
docker compose -f "${ROOT_DIR}/docker-compose.yml" ps
