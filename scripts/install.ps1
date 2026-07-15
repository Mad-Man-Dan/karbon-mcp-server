# Karbon MCP Server — one-line bootstrap installer for Windows.
#
#   irm https://raw.githubusercontent.com/Mad-Man-Dan/karbon-mcp-server/main/scripts/install.ps1 | iex
#
# Checks for Node.js (installs the LTS via winget if missing), then runs the
# interactive setup wizard from npm. Nothing is cloned; the package comes
# from the npm registry and your API keys only ever go into your own MCP
# client's local config file.
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Karbon MCP Server - installer" -ForegroundColor Cyan
Write-Host "============================="

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "Node.js not found - it's required to run the MCP server."
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Host "Installing Node.js LTS via winget..."
        winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        # Refresh PATH for this session so node/npx resolve immediately
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("Path", "User")
        if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
            Write-Host "Node.js was installed but isn't on PATH yet." -ForegroundColor Yellow
            Write-Host "Close this terminal, open a new one, and run:"
            Write-Host "  npx -y karbon-mcp-server setup"
            return
        }
    }
    else {
        Write-Host "Please install Node.js 18+ from https://nodejs.org, then re-run this command." -ForegroundColor Yellow
        return
    }
}

Write-Host "Node.js $(node --version) found."
Write-Host "Starting the setup wizard..."
Write-Host ""

npx -y karbon-mcp-server setup
