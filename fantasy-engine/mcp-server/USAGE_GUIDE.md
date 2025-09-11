# ESPN Fantasy MCP Server - Usage Guide

## 🎯 How to Use in Claude Desktop

Once your MCP server is configured and Claude Desktop is restarted, you can use natural language OR specific tool calls.

### 📋 Your Teams

- **League 1**: LA Locker Room Boys (ID: 2078910238, Team 1)
- **League 2**: Desi Rookies League (ID: 21366365, Team 7)

## 🚀 Easy Commands (Natural Language)

### Quick Roster Check
```
"Show me my roster"                    # Defaults to League 1
"Show my roster for league 2"         # Your Desi Rookies team
"Get my team info"                     # League 1 roster
```

### Advanced Analysis
```
"Analyze my team in league 1"
"Optimize my lineup for this week"
"Should I start Chris Godwin or DJ Moore?"
"Find me RB pickups on waivers"
```

## 🔧 Direct Tool Usage

If natural language doesn't work, use these exact tool calls:

### Enhanced Tool (Recommended)
```
Use the my_roster tool                 # Defaults to League 1
Use the my_roster tool with team "league 2"   # Your other league
```

### Specific Tools (Always Work)
```
Use get_roster with leagueId "2078910238" and teamId "1"     # League 1
Use get_roster with leagueId "21366365" and teamId "7"      # League 2

Use optimize_lineup with leagueId "2078910238" and teamId "1"

Use find_waiver_targets with leagueId "2078910238" and position "RB"

Use analyze_trade with:
- leagueId "2078910238"  
- teamId "1"
- giving ["Player A", "Player B"]
- receiving ["Player C"]
```

## 📊 All Available Tools

### 1. **Roster Tools**
- `my_roster` - Your roster (easy version)
- `get_roster` - Any team roster (need IDs)
- `analyze_roster` - Team analysis with recommendations

### 2. **Lineup Tools**
- `optimize_lineup` - Get optimal lineup suggestions
- `get_start_sit_advice` - Specific player advice

### 3. **Waiver Wire Tools**
- `find_waiver_targets` - Best available players
- `analyze_player` - Should you pick up a specific player?

### 4. **Trade Tools**
- `analyze_trade` - Evaluate trade fairness
- `find_trade_targets` - Find players to target

## 💡 Pro Tips

### Team References
- **"my team"** → League 1 (default)
- **"league 2"** → Desi Rookies League
- **"desi"** or **"rookies"** → League 2
- No team specified → League 1

### Player Names
- Use full names: "Chris Godwin" not "Godwin"
- Partial names work: "DJ Moore" or "Moore"
- Case doesn't matter: "saquon barkley" works

### Position Filters
- Use standard positions: RB, WR, TE, QB, K, DST
- Example: "Find RB waiver targets"

## 🔄 Switching Between Leagues

You have three options:

1. **Use the enhanced tool**: `my_roster` with team parameter
2. **Specify in natural language**: "Show league 2 roster"  
3. **Use full IDs**: Always specify leagueId and teamId

## ⚠️ Troubleshooting

### "Tool not found" error
- Make sure Claude Desktop was fully restarted
- Check MCP configuration is correct
- Try using exact tool names

### "Authentication required" error  
- Your ESPN cookies may have expired
- Get fresh cookies from browser
- Update .env file and restart Claude Desktop

### "Team not found" error
- Double-check league/team IDs are correct
- Make sure you have access to the league

## 🎯 Example Conversation Flow

```
You: "Show me my fantasy roster"
Claude: [Uses my_roster tool] Shows League 1 team with players

You: "How about my other league?"  
Claude: [Uses my_roster with team "league 2"] Shows League 2 team

You: "Optimize my lineup for league 1"
Claude: [Uses optimize_lineup] Suggests lineup changes

You: "Should I pick up Jordan Mason?"
Claude: [Uses analyze_player] Gives pickup recommendation
```

The enhanced tools make it much easier - you don't need to remember league IDs!