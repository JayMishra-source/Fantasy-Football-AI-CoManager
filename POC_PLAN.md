# ESPN Fantasy Football POC - Implementation Plan

## Overview
A lightweight proof of concept to establish ESPN Fantasy Football API integration, displaying team rosters and providing a testing interface for various ESPN API endpoints.

## POC Goals
1. Successfully authenticate with ESPN private leagues
2. Fetch and display team roster data
3. Create a UI for testing different ESPN API endpoints
4. Establish a foundation for future feature development

## Technical Stack (Simplified)

### Frontend
- **React** with Vite for fast development
- **TypeScript** for type safety
- **Tailwind CSS** for rapid UI development
- **Axios** for API calls
- **React Query** for data fetching and caching

### Backend
- **Node.js** with Express
- **TypeScript**
- **Puppeteer** for ESPN authentication
- **Node-cache** for temporary cookie storage
- **Cors** for cross-origin requests

## Project Structure
```
fantasy-poc/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── TeamRoster.tsx
│   │   │   ├── ApiTester.tsx
│   │   │   ├── LoginForm.tsx
│   │   │   └── Layout.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── types/
│   │   │   └── espn.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── server/                    # Node.js backend
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   └── espn.ts
│   │   ├── services/
│   │   │   ├── espnAuth.ts
│   │   │   └── espnApi.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── README.md
└── docker-compose.yml        # Optional for easy setup
```

## Implementation Phases

### Phase 1: Backend Setup (Days 1-3)

#### 1.1 ESPN Authentication Service
```typescript
// Core authentication flow
class ESPNAuthService {
  async authenticate(username: string, password: string) {
    // 1. Launch headless browser
    // 2. Navigate to ESPN login
    // 3. Fill credentials
    // 4. Extract cookies (espn_s2 and SWID)
    // 5. Store in cache with expiration
  }
}
```

#### 1.2 ESPN API Service
```typescript
// API endpoints to implement
const endpoints = {
  leagueInfo: '/apis/v3/games/ffl/seasons/{year}/segments/0/leagues/{leagueId}',
  teams: '/apis/v3/games/ffl/seasons/{year}/segments/0/leagues/{leagueId}?view=mTeam',
  roster: '/apis/v3/games/ffl/seasons/{year}/segments/0/leagues/{leagueId}?view=mRoster',
  players: '/apis/v3/games/ffl/seasons/{year}/segments/0/leagues/{leagueId}?view=kona_player_info',
  matchups: '/apis/v3/games/ffl/seasons/{year}/segments/0/leagues/{leagueId}?view=mMatchup',
  transactions: '/apis/v3/games/ffl/seasons/{year}/segments/0/leagues/{leagueId}/transactions'
}
```

#### 1.3 Express Routes
- `POST /api/auth/login` - Authenticate with ESPN
- `GET /api/league/:leagueId` - Get league information
- `GET /api/league/:leagueId/team/:teamId` - Get team roster
- `POST /api/test-endpoint` - Generic endpoint tester

### Phase 2: Frontend Development (Days 4-6)

#### 2.1 Login Component
```typescript
// Simple form to collect ESPN credentials and league ID
interface LoginProps {
  onSuccess: (leagueId: string, teamId: string) => void
}
```

#### 2.2 Team Roster Display
```typescript
// Display roster with player details
interface RosterDisplay {
  starters: Player[]
  bench: Player[]
  injuredReserve: Player[]
}
```

#### 2.3 API Testing Interface
```typescript
// Dropdown to select endpoint, display raw JSON response
interface ApiTester {
  endpoints: string[]
  selectedEndpoint: string
  response: any
  loading: boolean
}
```

### Phase 3: Integration & Testing (Days 7-8)

#### 3.1 End-to-End Testing
- Test authentication flow
- Verify data fetching
- Handle error cases
- Test cookie refresh

#### 3.2 Documentation
- API endpoint documentation
- Setup instructions
- Known limitations

## Key Features to Implement

### 1. Authentication Flow
```mermaid
User Login → Backend Puppeteer → ESPN Login → Extract Cookies → Store Session → Return Success
```

### 2. Roster Display UI
- **Player Card**: Name, position, team, points
- **Roster Sections**: Starters, Bench, IR
- **Team Summary**: Total points, record, ranking

### 3. API Testing Panel
- **Endpoint Selector**: Dropdown with all available endpoints
- **Parameter Inputs**: Dynamic form based on endpoint
- **Response Viewer**: Formatted JSON with syntax highlighting
- **Request History**: Log of recent API calls

## Sample Code Structure

### Backend: ESPN Authentication
```typescript
// server/src/services/espnAuth.ts
import puppeteer from 'puppeteer';

export class ESPNAuth {
  private cookies: Map<string, any> = new Map();

  async login(username: string, password: string): Promise<{espn_s2: string, swid: string}> {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Navigate to ESPN login
    await page.goto('https://www.espn.com/login');
    
    // Fill in credentials
    await page.type('input[type="email"]', username);
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForNavigation();
    
    // Extract cookies
    const cookies = await page.cookies();
    const espn_s2 = cookies.find(c => c.name === 'espn_s2')?.value;
    const swid = cookies.find(c => c.name === 'SWID')?.value;
    
    await browser.close();
    
    if (!espn_s2 || !swid) {
      throw new Error('Failed to retrieve authentication cookies');
    }
    
    return { espn_s2, swid };
  }
}
```

### Frontend: Team Roster Component
```tsx
// client/src/components/TeamRoster.tsx
import React from 'react';
import { useQuery } from 'react-query';
import { fetchTeamRoster } from '../services/api';

export const TeamRoster: React.FC<{leagueId: string, teamId: string}> = ({ leagueId, teamId }) => {
  const { data, isLoading, error } = useQuery(
    ['roster', leagueId, teamId],
    () => fetchTeamRoster(leagueId, teamId)
  );

  if (isLoading) return <div>Loading roster...</div>;
  if (error) return <div>Error loading roster</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <h2 className="text-xl font-bold mb-4">Starters</h2>
        {data.starters.map(player => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>
      <div>
        <h2 className="text-xl font-bold mb-4">Bench</h2>
        {data.bench.map(player => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>
    </div>
  );
};
```

## Environment Variables
```env
# .env.server
PORT=3001
ESPN_BASE_URL=https://fantasy.espn.com
SESSION_SECRET=your-secret-key

# .env.client
VITE_API_URL=http://localhost:3001
```

## Quick Start Commands
```bash
# Setup
npm create vite@latest client -- --template react-ts
cd server && npm init -y
npm install express puppeteer cors dotenv
npm install -D typescript @types/node @types/express nodemon

# Development
cd server && npm run dev
cd client && npm run dev
```

## Testing Checklist

### Authentication
- [ ] Can login with valid ESPN credentials
- [ ] Cookies are properly extracted
- [ ] Session persists across requests
- [ ] Handles invalid credentials gracefully

### Data Fetching
- [ ] League information loads correctly
- [ ] Team roster displays all players
- [ ] Player stats are accurate
- [ ] Handles private league access

### UI Functionality
- [ ] Login form validation works
- [ ] Roster displays properly on mobile
- [ ] API tester shows formatted responses
- [ ] Error states are user-friendly

## Known Challenges & Solutions

### Challenge 1: ESPN Rate Limiting
**Solution**: Implement request throttling and caching

### Challenge 2: Cookie Expiration
**Solution**: Auto-refresh cookies before expiration

### Challenge 3: Private League Access
**Solution**: Ensure cookies are sent with every request

## Success Criteria
1. ✅ Successfully authenticate with ESPN
2. ✅ Display team roster from private league
3. ✅ Test at least 5 different API endpoints
4. ✅ Handle errors gracefully
5. ✅ Provide clear documentation

## Next Steps After POC
1. Add more sophisticated caching
2. Implement webhook support for real-time updates
3. Add lineup optimization logic
4. Create production-ready authentication with token refresh
5. Add support for multiple leagues

## Estimated Timeline
- **Day 1-2**: Backend authentication setup
- **Day 3**: API service implementation
- **Day 4-5**: Frontend UI development
- **Day 6**: Integration and testing
- **Day 7**: Bug fixes and documentation
- **Day 8**: Demo preparation

## Resources
- [ESPN API Endpoints Gist](https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b)
- [espn-api Python Package](https://github.com/cwendt94/espn-api) (for reference)
- [Puppeteer Documentation](https://pptr.dev/)
- [React Query Documentation](https://react-query.tanstack.com/)