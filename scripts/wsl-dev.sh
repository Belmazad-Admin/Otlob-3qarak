#!/bin/bash
# Dev preview inside WSL (Ubuntu), used because Windows Smart App Control blocks the unsigned
# workerd.exe that the Cloudflare/Vinext dev runtime needs on Windows.
# The Windows folder stays the source of truth: this keeps a Linux copy in ~/belmazad in sync
# every second (sources and .dev.vars only; Linux has its own node_modules), then runs the dev server.
# One-time setup (Node 24 + pnpm + first install) is described in HANDOFF.md, "Running the preview in WSL".
set -uo pipefail
SRC="/mnt/n/Belmazad/Otlob Aqarak/"
DST="$HOME/belmazad/"
EXCLUDES=(--exclude node_modules --exclude .git --exclude .vinext --exclude dist --exclude .wrangler --exclude .sites-runtime)

mkdir -p "$DST"
rsync -a --delete "${EXCLUDES[@]}" "$SRC" "$DST"
cd "$DST"
# New or changed dependencies: install when the lockfile differs from the last install.
if ! cmp -s pnpm-lock.yaml node_modules/.belmazad-lock 2>/dev/null; then
  COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm install --frozen-lockfile && cp pnpm-lock.yaml node_modules/.belmazad-lock
fi

# Keep syncing while the dev server runs; stop the loop when the server exits.
( while sleep 1; do rsync -a --delete "${EXCLUDES[@]}" "$SRC" "$DST"; done ) &
SYNC_PID=$!
trap 'kill $SYNC_PID 2>/dev/null' EXIT INT TERM

COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm dev
