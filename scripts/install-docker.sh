#!/usr/bin/env bash
set -euo pipefail

require_apt() {
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "This installer currently supports apt-based distributions only." >&2
    exit 1
  fi
}

apt_cmd() {
  if command -v sudo >/dev/null 2>&1 && [[ "${EUID}" -ne 0 ]]; then
    sudo apt-get "$@"
  else
    apt-get "$@"
  fi
}

systemctl_cmd() {
  if command -v sudo >/dev/null 2>&1 && [[ "${EUID}" -ne 0 ]]; then
    sudo systemctl "$@"
  else
    systemctl "$@"
  fi
}

if command -v docker >/dev/null 2>&1; then
  echo "docker already installed"
  exit 0
fi

require_apt

apt_cmd update

# Try modern plugin package first and fall back to docker-compose-v2 for older distros.
if ! apt_cmd install -y docker.io docker-compose-plugin; then
  apt_cmd install -y docker.io docker-compose-v2
fi

if command -v systemctl >/dev/null 2>&1; then
  if ! systemctl_cmd enable --now docker; then
    echo "warning: docker installed but service could not be enabled automatically." >&2
    echo "Run 'sudo systemctl enable --now docker' on a systemd host." >&2
  fi
else
  echo "warning: systemctl not available; skipped docker service enablement." >&2
fi

echo "docker installation completed"
