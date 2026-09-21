#!/usr/bin/env bash
# Rebuilds the bundled copy of Kids Coloring from upstream.
#
# The built files are committed, because a release must not depend on GitHub
# being up or on npm resolving the same tree twice. This script is how those
# files are reproduced and how the patch is re-applied when upstream moves.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="https://github.com/oh-namgyu/kids-coloring.git"
COMMIT="$(sed -n 's/^commit: *//p' "$HERE/UPSTREAM")"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "cloning $REPO at $COMMIT"
git clone -q "$REPO" "$WORK/src"
git -C "$WORK/src" checkout -q "$COMMIT"

echo "patching"
node "$HERE/patch.mjs" "$WORK/src"

echo "building"
(cd "$WORK/src" && npm ci --silent && npm run build)

echo "installing into $HERE/app"
rm -rf "$HERE/app"
mkdir -p "$HERE/app"
cp -R "$WORK/src/dist/." "$HERE/app/"
cp "$WORK/src/LICENSE" "$HERE/LICENSE"

echo "done: $(du -sh "$HERE/app" | cut -f1)"
