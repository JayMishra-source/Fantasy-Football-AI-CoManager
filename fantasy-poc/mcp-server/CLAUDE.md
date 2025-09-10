# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ESPN Fantasy Football MCP Server - Model Context Protocol server that enables Claude Desktop to access ESPN Fantasy Football data and provide AI-driven team management recommendations. Supports multiple leagues, multiple LLM providers, draft assistance, and comprehensive fantasy analysis.

## Tech Stack

**Core**: Node.js, TypeScript 5.7, ES2022 modules
**MCP**: @modelcontextprotocol/sdk 1.17.4
**ESPN Integration**: Puppeteer 24, Axios, Cheerio
**Shared Library**: @fantasy-ai/shared (local package in ../shared)
**LLM Providers**: Claude (Anthropic), OpenAI GPT, Google Gemini, Perplexity
**Build**: TypeScript compiler, tsx for dev mode

## Essential Commands

### Build & Development
```bash
# Full build (includes shared library)
npm run build         # Builds ../shared first, then MCP server

# Local build only (skips shared library)
npm run build:local   # Just runs tsc

# Development mode with hot reload
npm run dev          # Uses tsx to run TypeScript directly

# Start production server
npm start            # Runs built JavaScript from dist/

# Quick test
npm test             # Builds and tests MCP protocol
```

### Testing Scripts
```bash
# MCP Protocol Testing
./test-mcp.sh                    # Basic tool listing
./test-mcp-roster.sh             # Test roster tools
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/index.js

# Feature Testing  
./test-all-features.sh           # Comprehensive test suite
./test-draft-features.sh         # Draft functionality
./test-auction-ready.sh          # Auction draft readiness
./test-snake-ready.sh            # Snake draft readiness
./test-fantasypros-ready.sh     # FantasyPros integration

# API Testing (Node scripts)
node test-api.js                 # Basic API functionality
node test-espn-only.js          # ESPN API without LLM
node test-enhanced-tools.js     # Enhanced tool features
node test-cost-monitoring.js    # Cost tracking system
```

### Configuration Management
```bash
# Initial setup
cp .env.example .env
# Edit .env with ESPN cookies and LLM provider keys

# Switch between leagues (modifies .env)
./switch-league.sh

# Get Claude Desktop config path
./get-claude-config.sh

# Install and setup
./install.sh
```

## High-Level Architecture

### MCP Server Flow
```
Claude Desktop → JSON-RPC/stdio → index.ts → Tool Registry → Handler Functions
                                      ↓                           ↓
                                 Tool Mapping              Service Layer
                                                    (espnApi, llmManager, etc.)
```

### Dependency Architecture
```
mcp-server/
    ↓
@fantasy-ai/shared (../shared/)
    ↓
External APIs (ESPN, LLMs, FantasyPros)
```

The shared library provides:
- `espnApi` - ESPN Fantasy API client with cookie auth
- `llmConfig` - LLM provider configuration and switching
- `getRosterTool`, `getMyRoster` - Roster management functions
- `executeAIWorkflow` - Complex workflow orchestration

### Tool Registration Pattern

Tools are registered in `src/index.ts:188-193` via MCP protocol handlers:
1. `ListToolsRequestSchema` handler returns available tools
2. `CallToolRequestSchema` handler routes to specific tool functions
3. Tools are imported from `src/tools/` directory
4. Each tool exports an async function with standardized signature

### Service Layer (`src/services/`)

**Core Services**:
- `espnApi.ts` - ESPN Fantasy API client with cookie auth
- `draftApi.ts` / `enhancedDraftApi.ts` - Draft-specific functionality
- `fantasyProsApi.ts` - Expert consensus data integration

**LLM Management** (`src/services/llm/`):
- `manager.ts` - Provider orchestration & fallback logic
- `providers/` - Implementations for Claude, OpenAI, Gemini, Perplexity
- Provider selection via `DEFAULT_LLM_PROVIDER` or runtime switching

**Advanced Features**:
- `costMonitor.ts` / `enhancedCostMonitor.ts` - Usage tracking with limits
- `automationService.ts` - Scheduled task automation
- `workflowContext.ts` - Workflow state management
- `learningEngine.ts` - ML-based performance optimization
- `abTesting.ts` - A/B testing for strategy optimization
- `performanceTracker.ts` - Performance metrics tracking
- `notificationService.ts` - Alert and notification system
- `weatherApi.ts` / `newsApi.ts` - External data sources

## Development Patterns

### Adding New MCP Tools
1. Create tool handler in `src/tools/newTool.ts`
2. Export async function: `async (args: ToolArgs) => ToolResponse`
3. Import in `index.ts` and add to tool registry
4. Define types in `src/types/` if needed
5. Create test script: `test-newtool.js` or add to `test-all-features.sh`

### Error Handling Strategy
- ESPN API errors wrapped with context in service layer
- LLM fallback chain: primary → fallback providers
- Cost limits enforced before LLM calls
- MCP errors returned as JSON-RPC structured errors
- All errors logged to stderr for Claude Desktop console

### Testing Approach
- Standalone test scripts for each major feature
- JSON-RPC protocol testing via echo/pipe
- Node.js scripts for API integration testing
- No formal test framework (Jest/Mocha) - uses direct execution

## Environment Configuration

Required `.env` variables:
```bash
# ESPN Authentication (required)
ESPN_S2=<cookie_value>
ESPN_SWID={<uuid>}

# League Configuration (multiple supported)
LEAGUE_1_ID=<id>
LEAGUE_1_TEAM_ID=<team_id>
LEAGUE_2_ID=<id>           # Optional second league
LEAGUE_2_TEAM_ID=<team_id>

# LLM Provider (at least one required)
DEFAULT_LLM_PROVIDER=gemini  # gemini|claude|openai|perplexity
GEMINI_API_KEY=<key>
CLAUDE_API_KEY=<key>
OPENAI_API_KEY=<key>
PERPLEXITY_API_KEY=<key>

# Optional Enhancements
FANTASYPROS_SESSION_ID=<cookie>
FANTASYPROS_USERNAME=<email>    # Alternative auth
FANTASYPROS_PASSWORD=<password>
DAILY_COST_LIMIT=2.00
WEEKLY_COST_LIMIT=10.00
MONTHLY_COST_LIMIT=35.00
```

## Claude Desktop Integration

### Configuration Location
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Required Configuration Structure
```json
{
  "mcpServers": {
    "espn-fantasy": {
      "command": "node",
      "args": ["/absolute/path/to/fantasy-poc/mcp-server/dist/index.js"],
      "env": {
        // Copy all required env vars from .env
      }
    }
  }
}
```

### Integration Checklist
1. Build server: `npm run build`
2. Configure `.env` with valid cookies
3. Update Claude Desktop config with absolute path
4. Restart Claude Desktop
5. Verify with "Show me my fantasy roster" query

## Common Issues & Solutions

### ESPN Authentication
- **Cookies expired**: Refresh from browser DevTools → Application → Cookies
- **Invalid SWID**: Must include curly braces `{uuid}`
- **Rate limiting**: No built-in handling, manual retry needed

### LLM Provider Issues
- **No provider configured**: Set at least one API key
- **Cost limit exceeded**: Check `cost_tracking.json`, adjust limits
- **Fallback not working**: Ensure multiple providers configured

### MCP Connection
- **Path issues**: Must use absolute path in Claude config
- **Build missing**: Run `npm run build` before starting
- **Shared library error**: Run full build, not `build:local`

### Testing & Debugging
```bash
# Check if server starts
node dist/index.js

# Test tool listing
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/index.js | jq

# Check ESPN connection
node test-espn-only.js

# Verify LLM configuration
node -e "import('./dist/services/llm/manager.js').then(m => console.log(m.llmManager.getCurrentProvider()))"
```

## Project Structure

```
mcp-server/
├── src/
│   ├── index.ts              # MCP server entry, tool registration
│   ├── tools/                # MCP tool implementations (30+ tools)
│   ├── services/             # Service layer
│   │   └── llm/             # LLM provider management
│   └── types/               # TypeScript type definitions
├── dist/                     # Built JavaScript output
├── test-*.{sh,js}           # Test scripts
└── data/                    # Cache and tracking files
```

## Known Limitations

- ESPN cookies expire ~30 days (manual refresh required)
- FantasyPros session expires frequently
- No database persistence (in-memory caching)
- Single-threaded Node.js process
- No WebSocket support for real-time updates
- Draft tools require manual draft room navigation