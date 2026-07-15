#!/usr/bin/env bash
# Karbon MCP Server — one-line bootstrap installer for macOS/Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/Mad-Man-Dan/karbon-mcp-server/main/scripts/install.sh | bash
#
# Checks for Node.js, then runs the interactive setup wizard from npm.
# Nothing is cloned; the package comes from the npm registry and your API
# keys only ever go into your own MCP client's local config file.
set -euo pipefail

echo ""
echo "Karbon MCP Server - installer"
echo "============================="

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found - it's required to run the MCP server."
  if command -v brew >/dev/null 2>&1; then
    echo "Installing Node.js via Homebrew..."
    brew install node
  else
    echo "Please install Node.js 18+ first:"
    echo "  macOS:  brew install node   (or https://nodejs.org)"
    echo "  Linux:  use your package manager or https://nodejs.org"
    exit 1
  fi
fi

echo "Node.js $(node --version) found."
echo "Starting the setup wizard..."
echo ""

# When this script is piped into bash, stdin is the pipe — reattach the
# terminal so the wizard's questions actually wait for the user. If no
# terminal is available (CI, containers), the wizard falls back to safe
# non-interactive defaults on its own.
if [ ! -t 0 ] && { : < /dev/tty; } 2>/dev/null; then
  exec < /dev/tty
fi

npx -y karbon-mcp-server setup
