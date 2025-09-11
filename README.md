# Fantasy Football AI CoManager 🏈🤖

An intelligent ESPN Fantasy Football management system that combines automated GitHub Actions workflows with Claude Desktop integration through MCP (Model Context Protocol). The system analyzes your ESPN leagues and provides AI-driven recommendations for lineup optimization, waiver wire targets, and trade analysis.

## 🎯 What This Does

Transform your fantasy football management with AI that:
- **Analyzes your ESPN leagues** - Fetches real-time data from ESPN Fantasy API
- **Optimizes lineups** - Sets optimal lineups based on projections and matchups  
- **Identifies waiver targets** - Finds breakout players before your competition
- **Evaluates trades** - Provides fair trade analysis with projected impact
- **Runs automatically** - GitHub Actions or on-demand through Claude Desktop

## 🚀 Quick Start

### Choose Your Path

#### Path 1: GitHub Actions Automation (Set It & Forget It)
Best for: Users who want automated daily/weekly analysis sent to Discord

#### Path 2: Claude Desktop + MCP (Interactive AI Assistant)
Best for: Users who want conversational AI help with fantasy decisions

#### Path 3: Local POC (Development & Testing)
Best for: Developers who want to test ESPN API integration

## 📚 Documentation

### Core Documentation
- [**Setup Guide for Friends**](./SETUP_GUIDE_FOR_FRIENDS.md) - Easy setup guide for non-developers
- [**GitHub Actions Flow**](./FLOWCHART.md) - Visual flowchart of the automation workflow
- [**MCP + Claude Desktop Flow**](./MCP_CLAUDE_DESKTOP_FLOWCHART.md) - Integration with Claude Desktop
- [**Technical Fixes**](./ESPN_API_FIXES_REPORT.md) - Recent ESPN API data collection improvements
- [**Phase 4 Intelligence**](./PHASE4_ADVANCED_INTELLIGENCE.md) - Advanced AI system documentation

### For Developers
- [**CLAUDE.md**](./CLAUDE.md) - Instructions for Claude Code development
- [**System Prompt**](./SYSTEM_PROMPT.md) - AI prompting guidelines

## 🛠️ Installation

### Prerequisites
- Node.js 16+ and npm
- ESPN Fantasy Football account
- GitHub account (for Actions) OR Claude Desktop (for MCP)

### Option 1: GitHub Actions Setup

1. **Fork this repository**
2. **Get ESPN cookies** (see Authentication section)
3. **Add GitHub Secrets**:
   ```
   ESPN_S2          # Your espn_s2 cookie
   ESPN_SWID        # Your SWID cookie  
   LEAGUE_1_ID      # Your league ID
   LEAGUE_1_TEAM_ID # Your team ID
   GEMINI_API_KEY   # Google Gemini API key (free tier)
   DISCORD_WEBHOOK_URL # Discord channel webhook
   ```
4. **Enable GitHub Actions** in your fork
5. **Automated runs**:
   - Daily at 8 AM ET
   - Hourly during games (Sun/Mon/Thu)
   - Manual trigger anytime

### Option 2: Claude Desktop + MCP Setup

1. **Clone repository**:
   ```bash
   git clone https://github.com/yourusername/FantasyCoManager.git
   cd FantasyCoManager/fantasy-engine/mcp-server
   ```

2. **Build MCP server**:
   ```bash
   npm install
   npm run build
   ```

3. **Configure Claude Desktop** (`~/.config/Claude/claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "fantasy-football": {
         "command": "node",
         "args": ["/path/to/fantasy-engine/mcp-server/dist/index.js"],
         "cwd": "/path/to/fantasy-engine/mcp-server"
       }
     }
   }
   ```

4. **Restart Claude Desktop** and ask:
   - "Help me with my fantasy team"
   - "Who should I start this week?"
   - "Find waiver wire targets"

### Option 3: Local Development POC

```bash
# Clone and navigate
git clone https://github.com/yourusername/FantasyCoManager.git
cd FantasyCoManager/fantasy-engine

# Quick start (both frontend and backend)
./start-poc.sh

# Or manually:
cd server && npm install && npm run dev  # Backend on :3003
cd client && npm install && npm run dev  # Frontend on :5173
```

## 🔐 ESPN Authentication

### Getting Your ESPN Cookies

1. **Login to ESPN Fantasy** in Chrome/Firefox
2. **Open DevTools** (F12) → Application → Cookies
3. **Find on fantasy.espn.com**:
   - `espn_s2` - Long authentication token
   - `SWID` - UUID in curly braces like `{123-456-789}`
4. **Copy these values** for configuration

### Finding Your League Info

From your ESPN Fantasy league URL:
```
https://fantasy.espn.com/football/league?leagueId=123456
                                              ^^^^^^ Your League ID

https://fantasy.espn.com/football/team?leagueId=123456&teamId=3
                                                         ^^^^^^ Your Team ID
```

## 💡 Usage Examples

### With GitHub Actions
Once configured, the system automatically:
- **Thursday 6 PM**: Pre-game optimization
- **Sunday 11 AM**: Final lineup checks
- **Monday 8 AM**: Waiver wire analysis  
- **Tuesday 10 AM**: Trade recommendations

Results sent to your Discord channel.

### With Claude Desktop
Ask Claude naturally:
- "Show me my current roster"
- "Who should I start: Player A or Player B?"
- "What's the best waiver pickup this week?"
- "Is this trade fair: My RB1 for their WR1?"

### With Local POC
Access http://localhost:5173 to:
- View your roster with live ESPN data
- Test ESPN API endpoints
- See player projections and stats

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────┐
│                   User Interfaces                │
├──────────┬────────────┬────────────┬────────────┤
│  GitHub  │   Claude   │    Web     │    CLI     │
│  Actions │  Desktop   │    POC     │   Tools    │
└──────────┴────────────┴────────────┴────────────┘
                           │
┌─────────────────────────────────────────────────┐
│              Core Services Layer                 │
├──────────────────────────────────────────────────┤
│  • ESPN API Integration (Authentication, Data)   │
│  • FantasyPros Rankings Integration              │
│  • AI Orchestration (Gemini, Claude, GPT)        │
│  • Data Processing & Slot Categorization         │
└─────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────┐
│                 Data Sources                     │
├──────────────────────────────────────────────────┤
│  • ESPN Fantasy API (Rosters, Matchups, Stats)   │
│  • FantasyPros (Expert Rankings, Projections)    │
│  • Weather API (Game Conditions)                 │
│  • News Feeds (Injury Reports, Breaking News)    │
└─────────────────────────────────────────────────┘
```

### Key Features by Component

**GitHub Actions Automation** (`fantasy-engine/automation/`)
- Phase 4 Advanced Intelligence System
- Scheduled and manual workflows
- Discord webhook notifications
- Multi-league support

**MCP Server** (`fantasy-engine/mcp-server/`)
- 10+ MCP tools for ESPN data access
- Lineup optimization algorithms
- Trade and waiver analysis
- Direct Claude Desktop integration

**Web POC** (`fantasy-engine/client/` + `fantasy-engine/server/`)
- React 19 + TypeScript frontend
- Express + Puppeteer backend
- ESPN authentication handling
- API testing interface

**Shared Library** (`fantasy-engine/shared/`)
- ESPN API client with 2025 season support
- Roster slot categorization (26 position types)
- Projection normalization (weekly vs season)
- AI workflow orchestration

## 🔧 Recent Improvements

### ESPN Data Collection Fixes (Completed)
✅ Fixed weekly vs season projection logic  
✅ Enhanced FantasyPros player matching with position validation  
✅ Standardized ESPN API to use 2025 season  
✅ Improved slot categorization for all roster positions  
✅ Added comprehensive logging for debugging  

### Repository Cleanup (Completed)
✅ Removed duplicate MCP server (saved 40% repository size)  
✅ Cleaned up 18 outdated documentation files  
✅ Streamlined to essential, current documentation  

## 🐛 Troubleshooting

### Common Issues

**"ESPN authentication failed"**
- Cookies expire after ~30 days
- Get fresh cookies from ESPN website
- Update secrets/config with new values

**"No roster data available"**
- Verify League ID and Team ID are correct
- Check if league is private (requires auth)
- Ensure cookies are from correct ESPN account

**"Port already in use" (Local POC)**
- Another instance is running
- Kill existing process or use different port

**GitHub Actions not running**
- Check if Actions are enabled in fork
- Verify all secrets are set correctly
- Check workflow logs for specific errors

### Debug Commands

```bash
# Test ESPN authentication
curl -H "Cookie: espn_s2=YOUR_COOKIE; SWID=YOUR_SWID" \
  "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2025/segments/0/leagues/YOUR_LEAGUE_ID"

# Check MCP server
node fantasy-engine/mcp-server/dist/index.js

# View GitHub Actions logs
# Go to Actions tab → Select workflow → View logs
```

## 📊 Performance

- **ESPN API Response**: < 500ms average
- **Lineup Optimization**: < 2 seconds
- **Full Analysis**: < 5 seconds
- **MCP Tool Execution**: < 1 second each
- **GitHub Actions Runtime**: ~2-3 minutes total

## 🔒 Security & Privacy

- ESPN cookies stored as secrets (GitHub) or locally (MCP/POC)
- No credentials sent to third parties
- AI providers receive only anonymized fantasy data
- All data processing happens in your environment

## 🤝 Contributing

Contributions welcome! Areas for improvement:
- Additional MCP tools for Claude
- Enhanced trade algorithms
- More LLM provider support
- Dynasty league features
- Keeper league optimization

## 📝 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- ESPN Fantasy API (unofficial)
- FantasyPros for expert rankings
- Anthropic for Claude and MCP
- Google for Gemini API
- The fantasy football community

---

**Built with ❤️ for fantasy football managers who want an AI edge**

*Not affiliated with ESPN or Disney. Use responsibly and within ESPN's terms of service.*