#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "[deploy] Resolving symlinks for Docker build..."

# Replace symlinks with actual files
for f in src/ai/system-prompt.ts src/ai/file-parser.ts src/ai/default-project.ts; do
  if [ -L "$f" ]; then
    TARGET=$(readlink "$f")
    rm "$f"
    cp "$SCRIPT_DIR/$TARGET" "$f"
    echo "  Copied $f"
  fi
done

# Replace templates symlink with actual directory
if [ -L "src/ai/templates" ]; then
  TARGET=$(readlink "src/ai/templates")
  rm "src/ai/templates"
  cp -r "$SCRIPT_DIR/$TARGET" "src/ai/templates"
  echo "  Copied src/ai/templates/"
fi

echo "[deploy] Deploying to Fly.io..."
fly deploy "$@"

echo "[deploy] Restoring symlinks..."
cd src/ai
rm -rf system-prompt.ts file-parser.ts default-project.ts templates
ln -sf ../../../worker/src/ai/system-prompt.ts system-prompt.ts
ln -sf ../../../worker/src/ai/file-parser.ts file-parser.ts
ln -sf ../../../worker/src/ai/default-project.ts default-project.ts
ln -sf ../../../worker/src/ai/templates templates

echo "[deploy] Done!"
