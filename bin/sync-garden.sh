#!/usr/bin/env bash
# Syncs cultivated pieces from the shared Garden/ folder (symlinked into both
# the Creative and CareerTechnology vaults) into this project's content/
# folder, so Quartz has something to build.
#
# Assumes this project and Garden/ are siblings under the same parent
# folder (e.g. both under ~/Documents/): ../Garden
# (Updated 2026-09-04: Garden moved out of the single ExtendedBrain vault as
# part of the 5-vault split -- see ~/Documents/VAULT-SPLIT-PLAN.md.)
#
# Usage:
#   bin/sync-garden.sh              # sync from the default sibling path
#   bin/sync-garden.sh /path/to/Garden   # sync from an explicit path

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${1:-$SCRIPT_DIR/../Garden}"
DEST="$SCRIPT_DIR/content"

if [ ! -d "$SOURCE" ]; then
  echo "Garden folder not found at: $SOURCE" >&2
  echo "Pass the path explicitly: bin/sync-garden.sh /path/to/Garden" >&2
  exit 1
fi

mkdir -p "$DEST"

# README.md is vault-internal documentation about the folder itself, not a
# piece meant for the public site -- never copy it.
rsync -av --delete \
  --exclude 'README.md' \
  --exclude '.DS_Store' \
  --exclude '.obsidian' \
  "$SOURCE/" "$DEST/"

echo
echo "Synced $SOURCE -> $DEST"
echo "Next: npx quartz build --serve   (preview locally)"
echo "  or: git add -A && git commit -m 'sync garden' && git push   (deploy)"
