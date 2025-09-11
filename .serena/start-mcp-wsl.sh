#!/usr/bin/env bash
set -euo pipefail

# Ensure nvm (WSL native Node) is loaded
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
  nvm use --lts >/dev/null 2>&1 || true
fi

# Prefer nvm-managed Node if available
if [ -d "$HOME/.nvm/versions/node" ]; then
  NODEBIN=$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | tail -n1)
  if [ -n "${NODEBIN:-}" ]; then
    export PATH="$NODEBIN:$PATH"
  fi
fi

proj_path="${1:-$PWD}"

exec uvx --from git+https://github.com/oraios/serena \
  serena start-mcp-server --context codex --project "$proj_path"
