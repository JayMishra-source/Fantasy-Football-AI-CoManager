#!/bin/bash

# ESPN Fantasy Football MCP Server Installation Script

echo "🏈 ESPN Fantasy Football MCP Server Setup"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the mcp-server directory"
    exit 1
fi

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Step 2: Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo ""
    echo "🔐 Setting up authentication..."
    cp .env.example .env
    echo "✅ Created .env file from template"
    echo ""
    echo "⚠️  IMPORTANT: You need to add your ESPN cookies to the .env file"
    echo ""
    echo "To get your cookies:"
    echo "1. Login to ESPN Fantasy Football in your browser"
    echo "2. Open Developer Tools (F12)"
    echo "3. Go to Application → Cookies → fantasy.espn.com"
    echo "4. Copy the values for:"
    echo "   - espn_s2 (long string)"
    echo "   - SWID (keep the curly braces)"
    echo ""
    read -p "Press Enter to continue after you've updated .env..."
else
    echo "✅ .env file already exists"
fi

# Step 3: Build the TypeScript code
echo ""
echo "🔨 Building TypeScript..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Failed to build TypeScript"
    exit 1
fi

# Step 4: Get the absolute path for Claude config
ABSOLUTE_PATH=$(pwd)/dist/index.js
echo ""
echo "✅ Build complete!"
echo ""
echo "📍 Your MCP server path is:"
echo "   $ABSOLUTE_PATH"
echo ""

# Step 5: Generate Claude config snippet
echo "📝 Add this to your Claude Desktop config:"
echo ""
echo "Location:"
echo "  Mac: ~/Library/Application Support/Claude/claude_desktop_config.json"
echo "  Windows: %APPDATA%\\Claude\\claude_desktop_config.json"
echo ""
echo "Configuration to add:"
echo "----------------------------------------"
cat << EOF
{
  "mcpServers": {
    "espn-fantasy": {
      "command": "node",
      "args": ["$ABSOLUTE_PATH"],
      "env": {
        "ESPN_S2": "YOUR_ESPN_S2_COOKIE",
        "ESPN_SWID": "{YOUR-SWID-UUID}",
        "LEAGUE_ID": "YOUR_LEAGUE_ID",
        "TEAM_ID": "YOUR_TEAM_ID"
      }
    }
  }
}
EOF
echo "----------------------------------------"
echo ""
echo "⚠️  Remember to:"
echo "1. Replace the cookie values with your actual ESPN cookies"
echo "2. Add your League ID and Team ID"
echo "3. Restart Claude Desktop after updating the config"
echo ""
echo "✅ Setup complete! Restart Claude Desktop to use the MCP server."