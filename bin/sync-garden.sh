#!/usr/bin/env bash
# Syncs cultivated pieces from SecondBrain's Garden/ folder (Creative's and
# CareerTechnology's Cultivate operations both write finished pieces there
# directly) into this project's content/ folder, so Quartz has something to
# build.
#
# Default source: ~/Documents/Obsidian/SecondBrain/Garden
# (Updated 2026-09-05: Garden moved into the new SecondBrain hub vault --
# see ~/Documents/VAULT-SPLIT-PLAN.md for the full history. Previously lived
# at the sibling path ../Garden, briefly shared via symlink with Creative and
# CareerTechnology before the hub-and-spoke redesign.)
#
# Usage:
#   bin/sync-garden.sh              # sync from the default SecondBrain path
#   bin/sync-garden.sh /path/to/Garden   # sync from an explicit path

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${1:-$SCRIPT_DIR/../Obsidian/SecondBrain/Garden}"
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
