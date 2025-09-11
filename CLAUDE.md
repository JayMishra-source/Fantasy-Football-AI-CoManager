# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ESPN Fantasy Football AI Manager - Automates team management for ESPN Fantasy Football private leagues using AI-driven decisions. POC phase with functional ESPN authentication and data fetching.

## Tech Stack

**Frontend**: React 19, TypeScript 5.8, Vite 7, TanStack Query v5, Axios
**Backend**: Node.js, Express 4, TypeScript 5.7, Puppeteer 24 (ESPN auth), node-cache
**Architecture**: REST API with session-based auth, CORS-enabled for local development

## Essential Commands

### Development
```bash
# Start both frontend and backend (recommended)
cd fantasy-engine && ./start-poc.sh

# Individual services:
cd fantasy-engine/server && npm run dev  # Backend at http://localhost:3003
cd fantasy-engine/client && npm run dev  # Frontend at http://localhost:5173
```

### Build & Production
```bash
# Backend
cd fantasy-engine/server
npm run build    # Compiles TypeScript to dist/
npm start        # Runs production server

# Frontend  
cd fantasy-engine/client
npm run build    # TypeScript check + Vite build
npm run preview  # Preview production build
```

### Testing & Debugging
```bash
# Manual testing endpoints
cd fantasy-engine && ./test-cookies.sh  # Test ESPN cookie authentication

# Health check
curl http://localhost:3003/health

# Frontend linting (no backend linting configured)
cd fantasy-engine/client && npm run lint
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

### Component Organization
```
client/src/components/
├── LoginForm.tsx      # Dual auth mode (auto/manual)
├── TeamRoster.tsx     # Display roster with player stats
├── ApiTester.tsx      # Debug panel for testing endpoints
└── ComplexMode.tsx    # Advanced features (future)
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

## Next Development Phase

Priority tasks for production readiness:
1. Add PostgreSQL/Redis for session persistence
2. Implement queue system for ESPN API rate limiting
3. Add comprehensive error recovery and retry logic
4. Create lineup optimization algorithm
5. Build waiver wire automation
6. Integrate LLM for trade recommendations