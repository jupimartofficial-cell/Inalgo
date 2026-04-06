#!/usr/bin/env bash
set -euo pipefail

MAX_LINES="${MAX_LINES:-500}"
MAX_BYTES="${MAX_BYTES:-20000}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SCAN_DIRS=(
  "backend/src/main/java"
  "backend/src/test/java"
  "desktop/src/renderer/src"
)

if ! command -v rg >/dev/null 2>&1; then
  echo "ripgrep (rg) is required for token-budget scan." >&2
  exit 2
fi

FILES=()
while IFS= read -r file; do
  FILES+=("$file")
done < <(rg --files "${SCAN_DIRS[@]}" -g "*.java" -g "*.kt" -g "*.ts" -g "*.tsx" -g "*.js" -g "*.jsx" -g "*.css" -g "*.scss" -g "*.sql" -g "*.json" -g "*.yml" -g "*.yaml")

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "No source files found in scanned directories."
  exit 0
fi

violations=0

printf "Token budget scan (max lines=%s, max bytes=%s)\n" "$MAX_LINES" "$MAX_BYTES"
printf "%-8s %-10s %s\n" "LINES" "BYTES" "FILE"

while IFS= read -r entry; do
  lines="${entry%% *}"
  rest="${entry#* }"
  bytes="${rest%% *}"
  file="${rest#* }"
  printf "%-8s %-10s %s\n" "$lines" "$bytes" "$file"
  if [ "$lines" -gt "$MAX_LINES" ] || [ "$bytes" -gt "$MAX_BYTES" ]; then
    violations=$((violations + 1))
  fi
done < <(
  for file in "${FILES[@]}"; do
    lines="$(wc -l < "$file" | tr -d ' ')"
    bytes="$(wc -c < "$file" | tr -d ' ')"
    printf "%s %s %s\n" "$lines" "$bytes" "$file"
  done | sort -nr
)

if [ "$violations" -gt 0 ]; then
  echo ""
  echo "FAIL: ${violations} file(s) exceed token budget limits."
  exit 1
fi

echo ""
echo "PASS: all scanned files are within token budget limits."
