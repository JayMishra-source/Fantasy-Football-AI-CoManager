# ESPN Fantasy Football MCP Server

This MCP (Model Context Protocol) server enables Claude to directly access and analyze your ESPN Fantasy Football data, providing intelligent recommendations for lineup optimization, waiver pickups, and trades.

## Features

### 🏈 Available Tools

1. **Roster Management**
   - `get_roster` - View complete team roster with player details
   - `analyze_roster` - Get strengths, weaknesses, and recommendations

2. **Lineup Optimization**
   - `optimize_lineup` - Get optimal lineup based on projections
   - `get_start_sit_advice` - Specific player start/sit recommendations

3. **Waiver Wire**
   - `find_waiver_targets` - Discover top available players
   - `analyze_player` - Deep dive on any player's value

4. **Trade Analysis**
   - `analyze_trade` - Evaluate trade fairness and impact
   - `find_trade_targets` - Identify potential trade partners

## Setup Instructions

### 1. Install Dependencies

```bash
cd fantasy-poc/mcp-server
npm install
```

### 2. Configure ESPN Authentication

#### Option A: Get Cookies from Browser (Recommended)

1. Login to ESPN Fantasy Football in your browser
2. Open Developer Tools (F12)
3. Go to Application/Storage → Cookies → fantasy.espn.com
4. Find and copy these cookie values:
   - `espn_s2` - Copy the value (long string)
   - `SWID` - Copy the value (keep the curly braces)

#### Option B: Use Existing Authentication

If you've already authenticated using the main app, copy the cookies from there.

### 3. Set Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your values
ESPN_S2=your_espn_s2_cookie_here
ESPN_SWID={your-swid-uuid-here}
LEAGUE_ID=your_league_id
TEAM_ID=your_team_id
```

### 4. Build the Server

```bash
npm run build
```

### 5. Configure Claude Desktop

Add to your Claude Desktop configuration file:

**Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "espn-fantasy": {
      "command": "node",
      "args": ["/absolute/path/to/fantasy-poc/mcp-server/dist/index.js"],
      "env": {
        "ESPN_S2": "your_espn_s2_cookie",
        "ESPN_SWID": "{your-swid-uuid}",
        "LEAGUE_ID": "your_league_id",
        "TEAM_ID": "your_team_id"
      }
    }
  }
}
```

Replace `/absolute/path/to/` with the actual path to your project.

### 6. Restart Claude Desktop

After saving the config, restart Claude Desktop to load the MCP server.

## Usage Examples

Once configured, you can ask Claude questions like:

### Roster Analysis
```
"Show me my fantasy roster"
"Analyze my team's strengths and weaknesses"
"What positions do I need to improve?"
```

### Lineup Optimization
```
"Optimize my lineup for this week"
"Should I start [Player Name] this week?"
"Who should I put in my flex position?"
```

### Waiver Wire
```
"Find the best available RBs on waivers"
"Should I pick up [Player Name]?"
"Who should I drop to make room?"
```

### Trade Analysis
```
"Is this trade fair: I give [Player A] for [Player B]?"
"Find me trade targets to improve my WR position"
"What players could I package for an elite RB?"
```

## Development

### Run in Development Mode

```bash
npm run dev
```

### Test the Server Standalone

```bash
# Build first
npm run build

# Test with sample input
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/index.js
```

### Debugging

- Check Claude Desktop logs for connection issues
- Server logs errors to stderr (visible in Claude Desktop developer console)
- Ensure cookies are valid and not expired
- Verify league ID and team ID are correct

## Troubleshooting

### "Authentication required" Error
- Your ESPN cookies have expired
- Get fresh cookies from browser
- Update .env file with new values

### "Team not found" Error
- Verify your team ID is correct
- Check that you have access to the league

### Claude Can't See the Server
- Ensure path in config is absolute, not relative
- Check that the built files exist in `dist/`
- Restart Claude Desktop after config changes

### No Data Returned
- League might be public (doesn't need auth)
- Try removing ESPN_S2 and ESPN_SWID for public leagues

## Privacy & Security

- Cookies are only stored locally in your .env file
- Never commit .env file to version control
- MCP server runs locally on your machine
- No data is sent to external services

## Next Steps

1. **Customize Analysis**: Modify tools in `src/tools/` for your league's scoring
2. **Add Scheduling**: Create scheduled analysis reports
3. **Historical Data**: Add past performance tracking
4. **Custom Strategies**: Implement your specific fantasy strategies

## Support

For issues or questions:
1. Check the main app's README for ESPN auth details
2. Review Claude Desktop's MCP documentation
3. Check server logs for detailed error messages