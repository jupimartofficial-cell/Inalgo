#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env.production"
BRANCH="main"
COMPOSE_FILE="${REPO_ROOT}/docker-compose.yml"
PROJECT_NAME="trade-prod"
COMPOSE_CMD=()

usage() {
  cat <<USAGE
Usage: $(basename "$0") [options]

Deploy the Trade stack on an Oracle Cloud Linux host using Docker Compose.

Options:
  --branch <name>        Git branch to deploy (default: main)
  --env-file <path>      Environment file to load (default: .env.production)
  --compose-file <path>  Docker compose file (default: docker-compose.yml)
  --project-name <name>  Docker compose project name (default: trade-prod)
  -h, --help             Show this help
USAGE
}

log() {
  printf '[deploy] %s\n' "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "Missing required command: $1"
    exit 1
  fi
}

detect_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
    return
  fi

  log "Missing Docker Compose. Install the docker compose plugin or docker-compose binary."
  exit 1
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --branch)
        BRANCH="${2:-}"
        shift 2
        ;;
      --env-file)
        ENV_FILE="${2:-}"
        shift 2
        ;;
      --compose-file)
        COMPOSE_FILE="${2:-}"
        shift 2
        ;;
      --project-name)
        PROJECT_NAME="${2:-}"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        log "Unknown argument: $1"
        usage
        exit 1
        ;;
    esac
  done
}

install_docker_if_missing() {
  if command -v docker >/dev/null 2>&1 && { docker compose version >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1; }; then
    log "Docker and docker compose already installed."
    return
  fi

  log "Docker not detected. Installing docker package using scripts/install-docker.sh"
  bash "${SCRIPT_DIR}/install-docker.sh"
}

load_env_file() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    cat <<ERR
[deploy] Missing env file: ${ENV_FILE}
Create it with, at minimum:
  DB_PASSWORD=<secure password>
  CORS_ALLOWED_ORIGINS=https://<your-oracle-domain>
ERR
    exit 1
  fi

  # shellcheck disable=SC1090
  set -a
  source "${ENV_FILE}"
  set +a
}

validate_required_env() {
  local required=(DB_PASSWORD)
  local missing=()

  for key in "${required[@]}"; do
    if [[ -z "${!key:-}" ]]; then
      missing+=("${key}")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    log "Missing required env vars in ${ENV_FILE}: ${missing[*]}"
    exit 1
  fi
}

prepare_repo() {
  require_command git
  require_command docker
  detect_compose_cmd

  log "Fetching latest code for branch ${BRANCH}"
  git -C "${REPO_ROOT}" fetch --all --prune
  git -C "${REPO_ROOT}" checkout "${BRANCH}"
  git -C "${REPO_ROOT}" pull --ff-only origin "${BRANCH}"
}

deploy_stack() {
  if [[ ! -f "${COMPOSE_FILE}" ]]; then
    log "Compose file not found: ${COMPOSE_FILE}"
    exit 1
  fi

  log "Validating docker compose configuration"
  "${COMPOSE_CMD[@]}" -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" config >/dev/null

  log "Building and starting services"
  "${COMPOSE_CMD[@]}" -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --build

  log "Deployment complete. Current service status:"
  "${COMPOSE_CMD[@]}" -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" ps
}

main() {
  parse_args "$@"
  install_docker_if_missing
  load_env_file
  validate_required_env
  prepare_repo
  deploy_stack
}

main "$@"
