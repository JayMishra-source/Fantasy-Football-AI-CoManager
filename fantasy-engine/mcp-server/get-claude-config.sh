#!/bin/bash

# Generate Claude Desktop configuration

echo "🤖 Claude Desktop MCP Configuration"
echo "===================================="
echo ""

# Get absolute path
ABSOLUTE_PATH=$(cd "$(dirname "$0")"; pwd)/dist/index.js

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found. Creating from template..."
    cp .env.example .env
    echo "Please edit .env with your ESPN cookies before proceeding."
    echo ""
fi

# Read .env file if it exists
if [ -f ".env" ]; then
    source .env
fi

echo "📍 Configuration file location:"
echo "   Mac: ~/Library/Application Support/Claude/claude_desktop_config.json"
echo "   Windows: %APPDATA%\\Claude\\claude_desktop_config.json"
echo ""
echo "📝 Add this to your Claude Desktop config:"
echo ""
echo "{"
echo '  "mcpServers": {'
echo '    "espn-fantasy": {'
echo '      "command": "node",'
echo "      \"args\": [\"$ABSOLUTE_PATH\"],"
echo '      "env": {'

if [ -n "$ESPN_S2" ]; then
    echo "        \"ESPN_S2\": \"$ESPN_S2\","
else
    echo '        "ESPN_S2": "YOUR_ESPN_S2_COOKIE_HERE",'
fi

if [ -n "$ESPN_SWID" ]; then
    echo "        \"ESPN_SWID\": \"$ESPN_SWID\","
else
    echo '        "ESPN_SWID": "{YOUR-SWID-UUID-HERE}",'
fi

if [ -n "$LEAGUE_ID" ]; then
    echo "        \"LEAGUE_ID\": \"$LEAGUE_ID\","
else
    echo '        "LEAGUE_ID": "YOUR_LEAGUE_ID_HERE",'
fi

if [ -n "$TEAM_ID" ]; then
    echo "        \"TEAM_ID\": \"$TEAM_ID\""
else
    echo '        "TEAM_ID": "YOUR_TEAM_ID_HERE"'
fi

echo '      }'
echo '    }'
echo '  }'
echo '}'
echo ""
echo "📋 Next steps:"
echo "1. Copy the configuration above"
echo "2. Open Claude Desktop config file"
echo "3. Merge this config with existing content (if any)"
echo "4. Save and restart Claude Desktop"
echo ""
echo "✅ Your MCP server path is: $ABSOLUTE_PATH"