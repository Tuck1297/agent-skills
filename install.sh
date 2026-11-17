#!/usr/bin/env bash
# Installs this repo's skills, agents and commands for Claude Code, Gemini CLI and
# Antigravity, and Codex, each made from its one source.
#
#   ./install.sh                     everything, for every agent
#   ./install.sh --agent gemini      one agent (claude, gemini, codex, or a list: claude,codex)
#   ./install.sh html-slides         only these skills, agents or commands (and what they use)
#   ./install.sh --replace           update installed copies that differ, remove what the repo dropped
#   ./install.sh --dry-run           say what would change, change nothing
#   ./install.sh --list              list everything here and which agents get it
#
# The work is done by tools/install.mjs (Node 18 or later).
set -euo pipefail
if ! command -v node >/dev/null 2>&1; then
    echo "install.sh needs Node.js 18 or later (https://nodejs.org)." >&2
    exit 1
fi
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/tools/install.mjs" "$@"
