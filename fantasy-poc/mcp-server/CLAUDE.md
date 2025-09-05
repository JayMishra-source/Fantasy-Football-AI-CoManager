# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ESPN Fantasy Football MCP Server - Model Context Protocol server that enables Claude Desktop to access ESPN Fantasy Football data and provide AI-driven team management recommendations. Supports multiple leagues, multiple LLM providers, draft assistance, and comprehensive fantasy analysis.

## Tech Stack

**Core**: Node.js, TypeScript 5.7, ES2022 modules
**MCP**: @modelcontextprotocol/sdk 1.17.4
**ESPN Integration**: Puppeteer 24, Axios, Cheerio
**LLM Providers**: Claude (Anthropic), OpenAI GPT, Google Gemini, Perplexity
**Build**: TypeScript compiler, tsx for dev mode

## Essential Commands

### Development & Testing
```bash
# Install dependencies
npm install

# Build TypeScript to dist/
npm run build

# Development mode with hot reload
npm run dev

# Test MCP server functionality
./test-mcp.sh                    # Basic tool listing
./test-mcp-roster.sh             # Test roster tools
./test-all-features.sh           # Comprehensive test
./test-draft-features.sh         # Draft functionality

# Test with Claude Desktop protocol
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/index.js
```

### Configuration
```bash
# Initial setup
cp .env.example .env
# Edit .env with ESPN cookies and LLM provider keys

# Switch between leagues
./switch-league.sh

# Get Claude Desktop config path
./get-claude-config.sh
```

## High-Level Architecture

### MCP Server Structure
The server implements Model Context Protocol to expose ESPN Fantasy tools to Claude Desktop:

```
Claude Desktop → MCP Protocol → index.ts → Tool Handlers → ESPN/LLM APIs
                      ↓                           ↓
              JSON-RPC over stdio         Service Layer (espnApi, llmManager)
```

### Authentication & Session Management
- **ESPN Cookies**: `ESPN_S2` and `ESPN_SWID` stored in environment variables
- **FantasyPros**: Optional MVP subscription via session cookie or credentials
- **LLM Providers**: API keys for chosen provider (Claude/OpenAI/Gemini/Perplexity)
- **Multi-League Support**: Configure multiple leagues with separate team IDs

### Tool Categories & Files

**Core Fantasy Tools** (`src/tools/`)
- `roster.ts` - Team roster management and analysis
- `lineup.ts` - Lineup optimization and start/sit advice
- `waiver.ts` - Waiver wire targets and player analysis
- `trades.ts` - Trade evaluation and partner finding
- `simple-enhanced.ts` - Simplified roster access

**Draft Tools**
- `draft.ts` - Basic draft info and recommendations
- `enhancedDraft.ts` - FantasyPros integration for expert rankings
- `liveAuction.ts` - Real-time auction draft assistance

**AI & Automation**
- `aiWorkflowOrchestrator.ts` - Complex workflow automation
- `directLLM.ts` - Direct LLM analysis interface
- `automation.ts` - Automated report generation
- `feedbackLoop.ts` - Performance tracking and learning

**Advanced Features**
- `crossLeague.ts` - Multi-league coordination
- `gameContext.ts` - Weather, news, and game conditions
- `cost.ts` - LLM usage cost monitoring

### LLM Provider Architecture
```
src/services/llm/
├── manager.ts         # Provider orchestration & fallback logic
├── types.ts          # Shared interfaces
└── providers/
    ├── base.ts       # Abstract provider class
    ├── claude.ts     # Anthropic implementation
    ├── openai.ts     # OpenAI GPT implementation
    ├── gemini.ts     # Google Gemini implementation
    └── perplexity.ts # Perplexity with web search
```

**Provider Selection**: Configured via `DEFAULT_LLM_PROVIDER` env variable or runtime switching through `llmConfig.switchProvider()`

### Service Layer (`src/services/`)
- `espnApi.ts` - ESPN Fantasy API client with cookie auth
- `fantasyProsApi.ts` - FantasyPros expert data integration
- `costMonitor.ts` / `enhancedCostMonitor.ts` - Usage tracking
- `automationService.ts` - Scheduled task automation
- `workflowContext.ts` - Workflow state management
- `learningEngine.ts` - ML-based performance optimization
- `abTesting.ts` - A/B testing for strategy optimization

## Development Patterns

### Adding New MCP Tools
1. **Create tool handler**: `src/tools/newTool.ts`
2. **Export function** with signature: `async (args: ToolArgs) => ToolResponse`
3. **Register in index.ts**: Import and add to tool registry
4. **Define types**: Add interfaces to `src/types/`
5. **Test**: Create test script in root directory

### Error Handling Strategy
- ESPN API errors wrapped with context in `espnApi.ts`
- LLM fallback chain in `llmManager.ts` (primary → fallback providers)
- Cost limits enforced before LLM calls
- MCP protocol errors returned as structured JSON-RPC errors

### Environment Configuration
Required variables in `.env`:
```bash
# ESPN Authentication (required)
ESPN_S2=<cookie_value>
ESPN_SWID={<uuid>}

# League Configuration (at least one required)
LEAGUE_1_ID=<id>
LEAGUE_1_TEAM_ID=<team_id>

# LLM Provider (at least one required)
GEMINI_API_KEY=<key>          # Most cost-effective
CLAUDE_API_KEY=<key>           # Best reasoning
OPENAI_API_KEY=<key>           # Good general purpose
PERPLEXITY_API_KEY=<key>       # Real-time web data

# Optional Enhancements
FANTASYPROS_SESSION_ID=<cookie>  # Expert consensus data
DAILY_COST_LIMIT=2.00           # Cost controls
```

## Claude Desktop Integration

Configuration location:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Example configuration:
```json
{
  "mcpServers": {
    "espn-fantasy": {
      "command": "node",
      "args": ["/absolute/path/to/fantasy-poc/mcp-server/dist/index.js"],
      "env": {
        "ESPN_S2": "...",
        "ESPN_SWID": "{...}",
        "LEAGUE_1_ID": "...",
        "LEAGUE_1_TEAM_ID": "...",
        "GEMINI_API_KEY": "..."
      }
    }
  }
}
```

## Current Implementation Status

### Working Features
✅ 30+ MCP tools exposed to Claude Desktop
✅ Multi-league support with team switching
✅ Four LLM provider integrations with fallback
✅ FantasyPros expert consensus integration
✅ Real-time draft assistance (snake & auction)
✅ Cost monitoring with limits and alerts
✅ Performance tracking and A/B testing framework

### Known Limitations
- ESPN cookies expire after ~30 days (manual refresh required)
- FantasyPros session expires frequently
- No database persistence (in-memory caching only)
- LLM costs can accumulate quickly without limits
- Draft tools require manual draft room navigation

## Testing & Debugging

### MCP Protocol Testing
```bash
# List all available tools
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/index.js | jq

# Call specific tool
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"my_roster","arguments":{}},"id":2}' | node dist/index.js | jq
```

### Common Issues
- **"No LLM configuration found"**: Set at least one provider's API key in `.env`
- **"ESPN authentication failed"**: Refresh cookies from browser DevTools
- **"FantasyPros not initialized"**: Call `initialize_fantasypros` tool first
- **Claude Desktop not connecting**: Check absolute path in config, rebuild, restart Claude

## Cost Management

The system tracks LLM usage costs with configurable limits:
- Per-analysis limit (default: $1.00)
- Daily limit (default: $2.00)
- Weekly limit (default: $10.00)
- Monthly limit (default: $35.00)

Monitor costs using the `get_cost_summary` tool or check `cost_tracking.json`.