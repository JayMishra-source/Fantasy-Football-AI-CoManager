# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ESPN Fantasy Football AI Manager — automates team management for ESPN Fantasy Football private leagues using AI-driven decisions. The system runs via GitHub Actions automation or Claude Desktop MCP integration, providing lineup optimization, waiver analysis, and trade recommendations.

There is **no web frontend**. This is a backend/automation-only repository.

## Tech Stack

**Automation**: GitHub Actions, TypeScript, Node.js, Commander (CLI)
**MCP Server**: Model Context Protocol for Claude Desktop integration
**Backend API**: Node.js, Express 4, TypeScript, Puppeteer (ESPN auth), node-cache
**LLM Providers**: Gemini (default), Claude, OpenAI, Perplexity
**Architecture**: Dual-mode system (GitHub Actions scheduled jobs + Claude Desktop interactive)

## Project Structure

```
fantasy-engine/
├── shared/           # Core library — everything else depends on this
│   └── src/
│       ├── config/       # LLM provider config + selection
│       ├── constants/    # ESPN roster slot maps
│       ├── services/     # espnApi, fantasyProsApi, costMonitor, abTesting, llm/providers
│       ├── tools/        # aiWorkflowOrchestrator, feedbackLoop
│       └── types/
├── automation/       # GitHub Actions CLI — the only module CI builds
│   └── src/commands/     # thursday, sunday, monday, tuesday, phase4, workflow
├── mcp-server/       # Claude Desktop MCP integration (see Known Issues)
│   └── src/tools/        # MCP tools for fantasy operations
└── server/           # Local Express API for ESPN auth + manual exploration
    └── src/
        ├── routes/       # auth, espn, test
        └── services/     # espnAuth (Puppeteer), manualAuth, espnApi, espnDebug
```

`shared/` is consumed via `file:../shared` by both `automation/` and `mcp-server/`. Changing anything in `shared/` requires rebuilding it before dependents pick it up — the `build` scripts in those two modules do this automatically.

## Essential Commands

### Build & Test
```bash
# Automation CLI (this is what CI builds — build shared first, handled by the script)
cd fantasy-engine/automation && npm ci && npm run build
node dist/cli.js --help          # or: npm test

# Shared library on its own
cd fantasy-engine/shared && npm ci && npm run build

# Local API server
cd fantasy-engine/server && npm run dev     # http://localhost:3003
cd fantasy-engine/server && npm run build && npm start
```

### Automation CLI commands
```bash
node dist/cli.js <command>
# Scheduled day jobs: thursday | sunday | monday | tuesday
# Intelligence:       intelligence | realtime | learning | analytics | seasonal | emergency
# Utility:            init | roster | workflow | cost
```

## GitHub Actions

A single workflow drives everything: `.github/workflows/fantasy-phase4-intelligence.yml`.

- **Schedule is NFL-season-only** (`* 9-12,1` — September through January). Nothing runs Feb–Aug except manual dispatch.
- Daily analysis 13:00 UTC; game-day monitoring every 4h on Sun/Mon/Thu; waiver analysis Tuesdays 14:00 UTC.
- `workflow_dispatch` accepts `intelligence_mode` (full/realtime/learning/analytics/seasonal/emergency), `week`, and `force_execution`.
- **CI builds only `fantasy-engine/automation`.** `server/` and `mcp-server/` are never compiled in CI.
- The workflow does **not** trigger on `pull_request`, so PRs get no automated checks.

## ESPN Integration

### Season year — computed, not hardcoded
`getCurrentNFLSeasonYear()` derives the season from the current date: Jan/Feb belong to the previous season's playoffs/offseason, everything else to the season starting that year.

It is currently **duplicated in three places** that must be kept in sync:
- `shared/src/services/espnApi.ts` (exported; also used by `fantasyProsApi.ts`)
- `server/src/services/espnApi.ts` (exported; used by all three route files)
- `mcp-server/src/services/espnApi.ts` (private static) and an inline copy in `mcp-server/src/services/draftApi.ts`

Known edge: from March onward the helper returns the current year, but ESPN may not have opened that season yet, which can 404 during the spring offseason.

### Authentication
Dual strategy against ESPN's DisneyID login:

1. **Puppeteer automation** (`server/src/services/espnAuth.ts`) — headless Chrome, handles iframe and modal login forms, extracts `espn_s2` and `SWID`, caches the session for 1 hour via node-cache.
2. **Manual cookie input** (`server/src/services/manualAuth.ts`) — fallback when ESPN changes break automation. Cookies are validated against the ESPN API before being stored.

In GitHub Actions there is no Puppeteer step; cookies come straight from the `ESPN_S2` / `ESPN_SWID` secrets.

### Cookie handling
- `espn_s2`: long auth token (200+ chars)
- `SWID`: UUID in curly braces, e.g. `{UUID}`
- Both required for private leagues; cookie domain is `fantasy.espn.com`
- Stored server-side only; passed to the local API via `X-ESPN-S2` / `X-ESPN-SWID` headers

### Base URL
`https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/`

### Local server endpoints
```
POST /api/auth/login                                    Puppeteer authentication
POST /api/auth/manual-login                             Manual cookie authentication
POST /api/auth/public-login                             Public-league access check
POST /api/auth/logout
GET  /api/auth/cookie-instructions
GET  /api/auth/debug-login
GET  /api/espn/league/:leagueId                         League metadata
GET  /api/espn/league/:leagueId/teams
GET  /api/espn/league/:leagueId/team/:teamId/roster     Roster with players
GET  /api/espn/league/:leagueId/players                 Available players
GET  /api/espn/league/:leagueId/matchups/:week
GET  /api/espn/league/:leagueId/transactions
POST /api/test/test-cookies | test-public-league | test-endpoint
```

## LLM Layer

Providers live in `shared/src/services/llm/providers/` (`base`, `gemini`, `claude`, `openai`, `perplexity`). Add new providers there and extend `BaseLLMProvider`.

- Default is **Gemini 3.x**; override the model with the `GEMINI_MODEL` env var rather than editing code.
- Gemini 3.x models think by default and thinking tokens count against `maxOutputTokens`, so `thinkingConfig.thinkingLevel` is pinned to `'low'` and `validateConfig()` uses a 500-token budget. Do not lower it — small budgets return empty content with `finishReason: MAX_TOKENS`.
- Model pricing tables are hardcoded in `getPricing()` (per 1M tokens) and `enhancedCostMonitor.ts` (per 1K tokens). Both need updating together when rates change.

## Development Patterns

### Adding a new ESPN endpoint
1. Add the method to `shared/src/services/espnApi.ts` (and mirror it in `server/src/services/espnApi.ts` if the local API needs it)
2. Add types to `shared/src/types/`
3. Expose a route in `server/src/routes/espn.ts` if it should be reachable locally
4. Surface it to automation via `shared/src/tools/` or to Claude Desktop via `mcp-server/src/tools/`

### Error handling
- **401**: cookies expired or invalid — re-authenticate
- **HTML response instead of JSON**: ESPN returned a login page — auth failed
- **Empty roster**: expected before the league drafts; only treat as a credential problem if the draft has already happened
- **Network errors**: handled by Axios interceptors

## Environment Setup

Copy `.env.example` and fill in. Required for any real run:

```bash
ESPN_S2=...            # ESPN auth cookie
ESPN_SWID={...}        # ESPN SWID, braces included
LEAGUE_1_ID=...        # plus LEAGUE_1_TEAM_ID, LEAGUE_1_NAME
GEMINI_API_KEY=...     # or CLAUDE_API_KEY / OPENAI_API_KEY / PERPLEXITY_API_KEY
```

Optional: `LEAGUE_2_*`, `GEMINI_MODEL`, `PRIMARY_LLM_PROVIDER`, `FALLBACK_LLM_PROVIDER`, `FANTASYPROS_SESSION_ID` (or email/password), `DISCORD_WEBHOOK_URL`, `SLACK_WEBHOOK_URL`, `NEWS_API_KEY`, `OPENWEATHER_API_KEY`, `ENABLE_FANTASYPROS` / `ENABLE_NEWS` / `ENABLE_WEATHER`, and the cost limits (`DAILY_COST_LIMIT`, `WEEKLY_COST_LIMIT`, `MONTHLY_COST_LIMIT`, `PER_ANALYSIS_LIMIT`).

For GitHub Actions these are repository **secrets**, except `GEMINI_MODEL` and `PRIMARY_LLM_PROVIDER` which are repository **variables**.

`PORT` (default 3003) applies to the local server only.

### Puppeteer / Chromium
Only needed for the local server's automated login path.
```bash
brew install chromium                        # macOS
sudo apt-get install -y chromium-browser     # Debian/Ubuntu
# or let Puppeteer download its own
```

## Known Issues & Limitations

- **`mcp-server/` does not compile.** It has ~40 pre-existing TypeScript errors: its `package.json` is missing `@google/generative-ai`, `openai`, and `@anthropic-ai/sdk`, and several imports reference exports `shared` no longer has. CI does not catch this because it only builds `automation/`.
- **`shared/` and `mcp-server/` contain duplicated copies** of `gemini.ts`, `enhancedCostMonitor.ts`, `costMonitor.ts`, `abTesting.ts`, `espnApi.ts`, and `feedbackLoop.ts`. Edits must be applied to both or they drift.
- **`@google/generative-ai` is Google's deprecated SDK**, superseded by `@google/genai`. It currently works, including passing `thinkingConfig` through, but it is the next thing likely to break.
- **Gemini Flash pricing doubles on 2027-01-01** per Google's published rates; the hardcoded tables will under-report cost by 2x after that date.
- `.env.example` has drifted from the workflow: it lists `DEFAULT_LLM_PROVIDER` (code uses `PRIMARY_LLM_PROVIDER` / `FALLBACK_LLM_PROVIDER`) and `SLACK_WEBHOOK_URL` but not `DISCORD_WEBHOOK_URL`.
- The local server's CORS origin is still pinned to `http://localhost:5173`, left over from a removed React client. Harmless but vestigial.
- Single concurrent user session in the local server (last login wins); no database persistence (memory only).
- ESPN rate limiting is not handled and will surface as 429s.

## Development Guidelines

1. **Build `shared/` first** — dependents consume its compiled `dist/`
2. **Mirror edits into `mcp-server/`** while the duplication exists
3. **Never hardcode a season year** — use `getCurrentNFLSeasonYear()`
4. **Never hardcode a model name** — use `GEMINI_MODEL` and the provider config
5. **Verify with `cd fantasy-engine/automation && npm run build`** — that is what CI actually runs
6. Respect ESPN rate limits; test locally before pushing workflow changes
