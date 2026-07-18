<!-- nia-rules: managed by Nia IDE, do not edit -->
# Nia IDE — Rules

## Dev server — CRITICAL
NEVER run 'npm install', 'pnpm install', or 'next dev' manually. Use ONLY the IDE dev-server API:
  curl -s -X POST http://localhost:19876/api/dev-server -H "Content-Type: application/json" -d '{"action":"start","projectId":"folder_005f576dcd39ff7e"}'
This API auto-detects the framework, installs deps if needed, and starts the server on a free port.
If it fails, check the error — don't manually run install commands (they take 5-10 minutes and block the AI).

## Project Analysis Protocol — CRITICAL: Read this carefully
Before running ANY commands, understand the project by reading files FIRST:
1. **Read .env and .env.local FIRST** — Check for existing database URLs, API keys, remote service connections (Supabase, PlanetScale, Neon, etc.). If remote services are already configured, do NOT try to start local Docker/database.
2. Check root for: package.json, Makefile, docker-compose.yml, turbo.json, pnpm-workspace.yaml, nx.json, *.sln
3. Read package.json to understand the tech stack, scripts, and dependencies.
4. For monorepos: identify the correct app package, use workspace-aware commands (pnpm --filter, turbo run --filter, npx nx serve)
5. **Before trying to install/start any infrastructure** (Docker, databases, etc.):
   - Check if .env has connection strings pointing to remote/cloud services — if yes, SKIP local setup
   - Only start Docker/local DB if the connection strings point to localhost AND Docker is available
   - NEVER waste time installing Docker just to run a database when .env already has a remote URL
6. Verify prerequisites only for what's actually needed: which pnpm, dotnet --version, etc.
7. If a prerequisite is MISSING and actually needed, try to install it:
   - pnpm: npm install -g pnpm
   - dotnet: brew install dotnet (macOS) / winget install Microsoft.DotNet.SDK.8 (Windows)
   - python: brew install python (macOS) / winget install Python.Python.3.12 (Windows)
   - go: brew install go (macOS) / winget install GoLang.Go (Windows)
   Do NOT install Docker unless explicitly asked — suggest the user install it themselves.
8. If .env.example exists but .env does not, copy it first
9. For multi-service projects, start the dev server FIRST — it may work with remote services without local Docker

## Browser / Preview Tools
Use curl to control the built-in preview browser. Always use the Bash tool for these.

### Take screenshot
  curl -s -X POST http://localhost:19876/api/screenshot -H "Content-Type: application/json" -d '{}'
  # Returns: {"path":"/tmp/nia-screenshot-xxx.jpg"}
  # Then use the Read tool on the returned path to VIEW the image.

### Get DOM state (element IDs for clicking/typing)
  curl -s -X POST http://localhost:19876/api/browser-action -H "Content-Type: application/json" -d '{"action":"get_state"}'

### Navigate to URL
  curl -s -X POST http://localhost:19876/api/browser-action -H "Content-Type: application/json" -d '{"action":"navigate","args":{"url":"http://localhost:PORT"}}'

### Click element (use nodeId from get_state)
  curl -s -X POST http://localhost:19876/api/browser-action -H "Content-Type: application/json" -d '{"action":"click_node","args":{"nodeId":123}}'

### Type into element
  curl -s -X POST http://localhost:19876/api/browser-action -H "Content-Type: application/json" -d '{"action":"type_node","args":{"nodeId":123,"text":"hello","clear":true}}'

### Scroll
  curl -s -X POST http://localhost:19876/api/browser-action -H "Content-Type: application/json" -d '{"action":"scroll","args":{"direction":"down","y":500}}'

### Hover (trigger dropdowns, tooltips, menus)
  curl -s -X POST http://localhost:19876/api/browser-action -H "Content-Type: application/json" -d '{"action":"hover","args":{"nodeId":123}}'

### Select dropdown option (by value or label)
  curl -s -X POST http://localhost:19876/api/browser-action -H "Content-Type: application/json" -d '{"action":"select","args":{"nodeId":123,"value":"option1"}}'
  curl -s -X POST http://localhost:19876/api/browser-action -H "Content-Type: application/json" -d '{"action":"select","args":{"nodeId":123,"label":"Option One"}}'

### Focus element
  curl -s -X POST http://localhost:19876/api/browser-action -H "Content-Type: application/json" -d '{"action":"focus","args":{"nodeId":123}}'

### Toggle checkbox/radio
  curl -s -X POST http://localhost:19876/api/browser-action -H "Content-Type: application/json" -d '{"action":"toggle","args":{"nodeId":123}}'

### Double click
  curl -s -X POST http://localhost:19876/api/browser-action -H "Content-Type: application/json" -d '{"action":"dblclick","args":{"nodeId":123}}'

### Get element value
  curl -s -X POST http://localhost:19876/api/browser-action -H "Content-Type: application/json" -d '{"action":"get_value","args":{"nodeId":123}}'

### Wait (up to 5 seconds)
  curl -s -X POST http://localhost:19876/api/browser-action -H "Content-Type: application/json" -d '{"action":"wait","args":{"ms":1000}}'

### Send keys (e.g. Enter, Escape, Tab, Control+a)
  curl -s -X POST http://localhost:19876/api/browser-action -H "Content-Type: application/json" -d '{"action":"send_keys","args":{"keys":"Enter"}}'

### Go back / Refresh
  curl -s -X POST http://localhost:19876/api/browser-action -H "Content-Type: application/json" -d '{"action":"go_back"}'
  curl -s -X POST http://localhost:19876/api/browser-action -H "Content-Type: application/json" -d '{"action":"refresh"}'

### Console logs
  curl -s "http://localhost:19876/api/browser-control?logs=true"

### Network logs
  curl -s -X POST http://localhost:19876/api/browser-action -H "Content-Type: application/json" -d '{"action":"network_logs"}'

### Running ports / process tree
  curl -s "http://localhost:19876/api/scan-ports"

### Dev server logs
  curl -s "http://localhost:19876/api/dev-server?action=logs&projectId=folder_005f576dcd39ff7e"

## Long-Running Commands
Long-running commands (downloads, installs, builds, scaffolds, model pulls, servers) are automatically routed to the terminal panel when you run them with the Bash tool. You do NOT need to do anything special — just run the command normally and the system handles the rest.
If you see "Command started in the terminal panel" in the Bash output, the command is running — do NOT retry or re-run the same command.

## Monitoring Long-Running Commands — IMPORTANT
After starting a long-running command (build, install, download, scaffold, etc.), you MUST monitor it until completion:
1. Tell the user the command is running in the terminal
2. Wait 15 seconds, then check progress using `ps aux | grep COMMAND_NAME` or check the terminal output
3. Report progress to the user (e.g., "Still building... 45s elapsed")
4. Increase the gap between checks: 15s → 30s → 45s → 60s
5. Keep checking until the process exits or the user asks you to stop
6. When the command finishes, tell the user the result (success/failure) and proceed with next steps

NEVER stop monitoring early. NEVER say "check the terminal yourself" — YOU must track progress and report back.
If the command fails, read the error output and try to fix the issue automatically.

<!-- /nia-rules -->
