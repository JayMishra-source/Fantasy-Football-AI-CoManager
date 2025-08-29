#!/bin/bash

# Script to switch between fantasy leagues

echo "🏈 ESPN Fantasy League Switcher"
echo "==============================="
echo ""
echo "Select a league:"
echo "1) League 2078910238 (Team 1)"
echo "2) League 21366365 (Team 7)"
echo ""
read -p "Enter choice (1 or 2): " choice

case $choice in
  1)
    LEAGUE_ID="2078910238"
    TEAM_ID="1"
    echo "✅ Switched to League $LEAGUE_ID (Team $TEAM_ID)"
    ;;
  2)
    LEAGUE_ID="21366365"
    TEAM_ID="7"
    echo "✅ Switched to League $LEAGUE_ID (Team $TEAM_ID)"
    ;;
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

# Update .env file
sed -i.bak "s/^LEAGUE_ID=.*/LEAGUE_ID=$LEAGUE_ID/" .env
sed -i.bak "s/^TEAM_ID=.*/TEAM_ID=$TEAM_ID/" .env

echo ""
echo "📝 Updated .env file with:"
echo "   LEAGUE_ID=$LEAGUE_ID"
echo "   TEAM_ID=$TEAM_ID"
echo ""
echo "⚠️  Remember to update your Claude Desktop config if needed!"