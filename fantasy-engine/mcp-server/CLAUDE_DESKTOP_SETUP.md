# Claude Desktop Setup Guide

## Step 1: Install Claude Desktop
Download from: https://claude.ai/download

## Step 2: Locate Configuration Directory

**macOS**: `~/Library/Application Support/Claude/`
**Windows**: `%APPDATA%\Claude\`
**Linux**: `~/.config/Claude/`

## Step 3: Copy Configuration File

Copy the content from `claude-desktop-config.json` in this directory to:
`[Claude Config Directory]/claude_desktop_config.json`

## Step 4: Build the MCP Server

```bash
cd /Users/jaymishra/Desktop/FantasyCoManager/fantasy-poc/mcp-server
npm install
npm run build
```

## Step 5: Restart Claude Desktop

Close and reopen Claude Desktop to load the MCP server.

## Step 6: Verify Connection

In Claude Desktop, you should see "🔌 Connected to MCP server" or similar indicator.

## Step 7: Test the Tools

Try these commands in Claude Desktop:

### Basic Commands
- "Show my roster"
- "Who should I start this week?"
- "Find me waiver pickups"
- "How are my costs looking?"

### FantasyPros Commands (if configured)
- "Initialize FantasyPros"
- "Get expert rankings for RB"
- "Show me player tiers"

## Available MCP Tools

Your Claude Desktop now has access to 24+ fantasy football tools:

### Quick Access
- `my_roster` - Your current roster
- `optimize_lineup` - Best lineup recommendations
- `find_waiver_targets` - Waiver wire opportunities
- `analyze_roster` - Deep roster analysis

### Detailed Analysis  
- `analyze_player` - Individual player analysis
- `analyze_trade` - Trade evaluation
- `get_start_sit_advice` - Specific start/sit help

### Expert Data (FantasyPros)
- `get_fantasypros_rankings` - Expert consensus
- `get_player_tiers` - Tier-based analysis
- `compare_player_value` - ADP analysis

### Draft Tools
- `get_draft_recommendations` - Draft assistance
- `get_player_rankings` - Player rankings
- `analyze_completed_draft` - Draft grades

### Automation
- `generate_automation_report` - Weekly comprehensive analysis
- `get_cost_summary` - LLM usage monitoring

## Troubleshooting

### MCP Server Not Connecting
1. Check the file path in claude_desktop_config.json
2. Ensure the MCP server was built (`npm run build`)
3. Restart Claude Desktop
4. Check Console for error messages

### ESPN Authentication Issues  
1. Verify ESPN cookies are current
2. Check that cookies include both ESPN_S2 and ESPN_SWID
3. Login to ESPN Fantasy in browser to refresh cookies

### FantasyPros Not Working
1. Verify session ID is current
2. Check if FantasyPros MVP subscription is active
3. The system works without FantasyPros - it's optional

## Configuration Details

Your current configuration includes:
- **2 Fantasy Leagues** with separate team management
- **FantasyPros Integration** for expert consensus
- **Cost Monitoring** to track LLM usage
- **Gemini API** for cost-effective analysis
- **Automated GitHub Actions** running weekly

## Usage Tips

### Best Practices
- Start conversations with "Show my roster" to get context
- Use specific commands like "Optimize my lineup for this week"
- Ask for explanations: "Why do you recommend starting X over Y?"
- Check costs periodically: "What are my current LLM costs?"

### Sample Conversations
```
You: "Show my roster and tell me who to start this week"

Claude: [Uses my_roster and optimize_lineup tools to provide data-driven recommendations]

You: "Should I pick up [Player Name] from waivers?"

Claude: [Uses analyze_player and find_waiver_targets to evaluate]

You: "Initialize FantasyPros and show me RB rankings"

Claude: [Enables expert data and shows tiered rankings]
```

## System Capabilities

✅ **Real-time ESPN data** for both your leagues
✅ **Expert consensus** from FantasyPros (when enabled)  
✅ **Lineup optimization** with confidence scores
✅ **Waiver wire analysis** with priority rankings
✅ **Trade evaluation** for fairness and value
✅ **Cost monitoring** for LLM usage
✅ **Weekly automation reports** with comprehensive analysis

Your Claude Desktop is now a complete fantasy football command center! 🏈