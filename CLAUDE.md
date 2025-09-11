# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ESPN Fantasy Football AI Manager - Automates team management for ESPN Fantasy Football private leagues using AI-driven decisions. The system runs via GitHub Actions automation or Claude Desktop MCP integration, providing lineup optimization, waiver analysis, and trade recommendations.

## Tech Stack

**Automation**: GitHub Actions, TypeScript, Node.js
**MCP Server**: Model Context Protocol for Claude Desktop integration
**Backend API**: Node.js, Express 4, TypeScript, Puppeteer (ESPN auth), node-cache
**LLM Providers**: Gemini, Claude, OpenAI, Perplexity
**Architecture**: Dual-mode system (GitHub Actions scheduled jobs + Claude Desktop interactive)

## Essential Commands

### Development
```bash
# Start backend API server
cd fantasy-engine/server && npm run dev  # Backend at http://localhost:3003

# Build and test automation CLI
cd fantasy-engine/automation && npm install && npm run build

# Test MCP server
cd fantasy-engine/mcp-server && npm test
```

### Build & Production
```bash
# Backend API
cd fantasy-engine/server
npm run build    # Compiles TypeScript to dist/
npm start        # Runs production server

# Automation CLI
cd fantasy-engine/automation
npm run build    # Builds CLI for GitHub Actions

# MCP Server
cd fantasy-engine/mcp-server
npm run build    # Builds MCP server for Claude Desktop
```

### Testing & Debugging
```bash
# Test ESPN authentication
cd fantasy-engine/server && npm run dev
# Then navigate to http://localhost:3003/health

# Test automation locally
cd fantasy-engine/automation
npm run build
node dist/cli.js --help

# Test MCP server
cd fantasy-engine/mcp-server
npm test
```

## High-Level Architecture

### ESPN Authentication System
The app implements dual authentication strategies to handle ESPN's DisneyID login system:

1. **Puppeteer Automation** (`server/src/services/espnAuth.ts:15-391`)
   - Launches headless Chrome to automate ESPN/DisneyID login
   - Handles iframe-based and modal login forms
   - Extracts `espn_s2` and `SWID` cookies after successful auth
   - Session cached for 1 hour using node-cache

2. **Manual Cookie Input** (`server/src/services/manualAuth.ts`)
   - Fallback when Puppeteer fails due to ESPN changes
   - Users manually provide cookies from browser DevTools
   - Validates cookies against ESPN API before storing

### Data Flow & Session Management
```
Client Request → Express Route → Session Validation → ESPN API Call → Response
       ↓               ↓                  ↓                ↓
   React Query    Route Handler      Cookie Cache      Puppeteer/Manual
```

**Key Points**:
- Cookies stored server-side only (security)
- Custom headers (`X-ESPN-S2`, `X-ESPN-SWID`) pass auth to API
- 2-hour session TTL with automatic cleanup
- CORS configured for ports 5173 ↔ 3003

### ESPN API Integration Details
**Base URL**: `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/`
**Season**: Currently hardcoded to 2024 (`server/src/routes/espn.ts:30`)

**Core Endpoints**:
- `POST /api/auth/login` - Puppeteer authentication
- `POST /api/auth/manual-login` - Manual cookie authentication
- `GET /api/espn/league/:leagueId` - League metadata
- `GET /api/espn/league/:leagueId/team/:teamId/roster` - Team roster with players
- `GET /api/espn/league/:leagueId/players` - All available players
- `GET /api/espn/league/:leagueId/matchups/:week` - Weekly matchups
- `GET /api/espn/league/:leagueId/transactions` - League transactions

## Development Patterns

### Adding New ESPN Endpoints
1. **Define types**: `client/src/types/espn.ts`
2. **Add route**: `server/src/routes/espn.ts` 
3. **Implement service**: `server/src/services/espnApi.ts`
4. **Client API**: `client/src/services/api.ts`
5. **React hook**: Use TanStack Query in component

### Error Handling Strategy
- **401 errors**: Cookies expired/invalid - prompt re-authentication
- **HTML responses**: ESPN returned login page instead of JSON - auth failed
- **Network errors**: Axios interceptors handle retries
- **Validation**: Pre-flight cookie checks before ESPN requests

### Project Structure
```
fantasy-engine/
├── automation/        # GitHub Actions CLI for scheduled jobs
│   └── src/          # TypeScript source for Phase 4 intelligence
├── mcp-server/       # Claude Desktop MCP integration
│   └── src/tools/    # MCP tools for fantasy operations
├── server/           # Backend API server
│   └── src/services/ # ESPN auth and API services
└── shared/           # Shared utilities and LLM integration
    └── src/services/ # Common services across modules
```

## Critical Implementation Notes

### Puppeteer Authentication Challenges
The ESPN login uses DisneyID which frequently changes structure. Current implementation (`server/src/services/espnAuth.ts`) handles:
- Multiple iframe detection strategies
- Dynamic form field selectors
- JavaScript-triggered modals
- Fallback to manual cookie entry when automation fails

### Cookie Handling
- **espn_s2**: Long auth token (200+ chars)
- **SWID**: UUID in curly braces (e.g., `{UUID}`)
- Both required for private league access
- Cookies domain: `fantasy.espn.com`

### Known Issues & Limitations
- Single concurrent user session (last login wins)
- No database persistence (memory only)
- ESPN rate limiting not handled (will cause 429 errors)
- Season year hardcoded to 2024
- No WebSocket support for live updates
- Puppeteer requires Chrome/Chromium installed

## Environment Setup

### Required Environment Variables
None required, but `.env` file supports:
```bash
PORT=3003  # Server port (optional, defaults to 3003)
```

### Browser Requirements for Puppeteer
```bash
# Ubuntu/Debian
sudo apt-get install -y chromium-browser

# macOS
brew install chromium

# Or let Puppeteer download Chromium automatically
```

## Key Features

### GitHub Actions Automation
- **Scheduled runs**: Daily analysis, game-day monitoring, waiver analysis
- **Phase 4 Intelligence**: Advanced AI-driven decision making
- **Multi-league support**: Manages multiple ESPN leagues
- **Discord notifications**: Real-time updates via webhooks

### MCP Server Integration
- **Claude Desktop**: Interactive fantasy assistant
- **Real-time analysis**: On-demand roster evaluation
- **Trade recommendations**: AI-powered trade analysis
- **Waiver suggestions**: Identifies breakout players

## Development Guidelines

1. **Always test ESPN authentication** before making API changes
2. **Respect rate limits** - ESPN has undocumented rate limiting
3. **Use existing LLM providers** in `shared/src/services/llm/`
4. **Follow TypeScript patterns** - strict typing throughout
5. **Test locally first** before pushing GitHub Actions changes