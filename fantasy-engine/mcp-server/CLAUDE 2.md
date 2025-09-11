# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fantasy Football AI Manager - A web application that automates ESPN Fantasy Football team management using AI. Currently in POC phase with working authentication and data fetching from ESPN private leagues.

## Tech Stack

**Frontend**: React 19, TypeScript, Vite, React Query (TanStack Query v5), Axios
**Backend**: Node.js, Express, TypeScript, Puppeteer, node-cache
**Build Tools**: Vite (frontend), TypeScript compiler (backend)

## Essential Commands

### Development
```bash
# Start both frontend and backend simultaneously (recommended)
cd fantasy-poc && ./start-poc.sh

# Or start individually:
cd fantasy-poc/client && npm run dev  # Frontend at http://localhost:5173
cd fantasy-poc/server && npm run dev  # Backend at http://localhost:3003
```

### Build & Production
```bash
# Frontend
cd fantasy-poc/client
npm run build    # TypeScript check + Vite build
npm run preview  # Preview production build

# Backend  
cd fantasy-poc/server
npm run build    # Compile TypeScript to dist/
npm start        # Run production server from dist/
```

### Code Quality
```bash
# Frontend linting
cd fantasy-poc/client && npm run lint

# Backend - No linting configured yet
```

### Testing
No automated tests yet. Manual testing:
- API testing UI: http://localhost:5173 (ApiTester component)
- Health check: `curl http://localhost:3003/health`
- Cookie testing: `cd fantasy-poc && ./test-cookies.sh`

## High-Level Architecture

### Authentication Flow
1. **Automatic**: Puppeteer automates ESPN login (`server/src/services/espnAuth.ts`)
2. **Manual Fallback**: Direct cookie input (`server/src/services/manualAuth.ts`)
3. Sessions stored in-memory using node-cache with 2-hour expiry

### Data Flow
```
User Input → React UI → Axios Client → Express Routes → ESPN Services → ESPN API
                ↓                           ↓                ↓
         React Query Cache         Session Cache      Puppeteer/Cookies
```

### Key ESPN API Integration
Base URL: `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/`

Critical routes:
- `POST /api/auth/login` - Authenticate with credentials
- `POST /api/auth/manual-login` - Authenticate with cookies
- `GET /api/espn/league/:leagueId` - League data (requires auth)
- `GET /api/espn/league/:leagueId/team/:teamId/roster` - Team roster

### Session Management
- Cookies stored server-side after authentication
- Headers `X-ESPN-S2` and `X-ESPN-SWID` used for API requests
- CORS configured for credential sharing between ports

## Development Patterns

### Adding New ESPN Endpoints
1. Define types in `client/src/types/espn.ts` and server types
2. Add route handler in `server/src/routes/espn.ts`
3. Implement in `server/src/services/espnApi.ts`
4. Add client method in `client/src/services/api.ts`
5. Use React Query hook in components

### Component Structure
- Simple components (LoginForm, TeamRoster) in `client/src/components/`
- ApiTester for endpoint debugging
- App.tsx switches between simple/complex modes

### Error Handling
- ESPN auth failures return 401 with clear messages
- HTML responses detected and handled (indicates auth issues)
- Cookie validation before API requests

## Current Implementation Status

### Working Features
✅ ESPN authentication via Puppeteer
✅ Manual cookie authentication fallback  
✅ League and roster data fetching
✅ API testing interface
✅ Session caching

### Known Limitations
- Single user sessions only
- No production deployment config
- Credentials stored unencrypted in memory
- ESPN rate limiting not handled
- No automated tests
- 2024 season hardcoded

## Important Files

**Authentication**: `server/src/services/espnAuth.ts`, `server/src/services/manualAuth.ts`
**API Routes**: `server/src/routes/espn.ts`, `server/src/routes/auth.ts`
**Client API**: `client/src/services/api.ts`
**Type Definitions**: `client/src/types/espn.ts`
**Main Components**: `client/src/components/LoginForm.tsx`, `client/src/components/TeamRoster.tsx`

## Next Phase Goals
- Implement lineup optimization logic
- Add waiver wire management
- Create trade analysis engine
- Integrate AI/LLM for recommendations
- Add persistent database storage
- Implement proper security measures