#!/usr/bin/env npx tsx

import { espnApi } from '@fantasy-ai/shared';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env') });

async function testESPNConnection() {
  console.log('🔍 Testing ESPN API Connection...\n');
  
  // Get cookies from environment
  const espn_s2 = process.env.ESPN_S2;
  const swid = process.env.ESPN_SWID;
  
  // Get league config from environment
  const leagues = [
    {
      id: process.env.LEAGUE_1_ID || process.env.LEAGUE_ID_1,
      teamId: process.env.LEAGUE_1_TEAM_ID || process.env.TEAM_ID_1,
      name: process.env.LEAGUE_1_NAME || 'League 1'
    },
    {
      id: process.env.LEAGUE_2_ID || process.env.LEAGUE_ID_2,
      teamId: process.env.LEAGUE_2_TEAM_ID || process.env.TEAM_ID_2,
      name: process.env.LEAGUE_2_NAME || 'League 2'
    }
  ].filter(l => l.id && l.teamId);
  
  // Validate cookies exist
  if (!espn_s2 || !swid) {
    console.error('❌ ESPN cookies not found in environment variables');
    console.log('Required: ESPN_S2 and ESPN_SWID');
    process.exit(1);
  }
  
  // Show cookie status (safely)
  console.log('📋 Cookie Status:');
  console.log(`  ESPN_S2: ${espn_s2.substring(0, 10)}...${espn_s2.substring(espn_s2.length - 5)} (${espn_s2.length} chars)`);
  console.log(`  SWID: ${swid.substring(0, 10)}...${swid.substring(swid.length - 5)} (${swid.length} chars)\n`);
  
  // Show league configuration
  console.log('🏈 Configured Leagues:');
  if (leagues.length === 0) {
    console.error('❌ No leagues configured in environment variables');
    process.exit(1);
  }
  
  leagues.forEach((league, i) => {
    console.log(`  ${i + 1}. ${league.name}: League ${league.id}, Team ${league.teamId}`);
  });
  console.log('');
  
  // Set cookies in API
  console.log('🔐 Setting ESPN cookies...');
  espnApi.setCookies({ espn_s2, swid });
  
  // Test each league
  for (const league of leagues) {
    console.log(`\n📊 Testing ${league.name} (League: ${league.id}, Team: ${league.teamId})...`);
    console.log('─'.repeat(60));
    
    try {
      // Test 1: Get League Info
      console.log('  1️⃣ Testing League Info...');
      const leagueInfo = await espnApi.getLeagueInfo(league.id!);
      console.log(`     ✅ League: ${leagueInfo.name}`);
      console.log(`     📅 Current Week: ${leagueInfo.currentWeek}`);
      console.log(`     👥 Teams: ${leagueInfo.teams.length}`);
      
      // Check if our team exists in the league
      const ourTeam = leagueInfo.teams.find((t: any) => t.id === parseInt(league.teamId!));
      if (ourTeam) {
        console.log(`     ✅ Found our team: ${ourTeam.name || ourTeam.location + ' ' + ourTeam.nickname || 'Team ' + ourTeam.id}`);
      } else {
        console.log(`     ⚠️  Team ${league.teamId} not found in league`);
        console.log(`     Available team IDs: ${leagueInfo.teams.map((t: any) => t.id).join(', ')}`);
      }
      
    } catch (error: any) {
      console.error(`     ❌ League Info Failed: ${error.message}`);
      if (error.message.includes('401')) {
        console.log('     💡 This indicates cookie authentication failed');
      } else if (error.message.includes('404')) {
        console.log('     💡 This league ID might not exist');
      }
    }
    
    try {
      // Test 2: Get Team Roster
      console.log('  2️⃣ Testing Team Roster...');
      const roster = await espnApi.getTeamRoster(league.id!, league.teamId!);
      console.log(`     ✅ Roster loaded successfully`);
      console.log(`     📋 Starters: ${roster.starters.length} players`);
      console.log(`     🪑 Bench: ${roster.bench.length} players`);
      
      // Show a sample player
      if (roster.starters.length > 0) {
        const samplePlayer = roster.starters[0];
        console.log(`     Sample player: ${samplePlayer.fullName} (${samplePlayer.position}) - ${samplePlayer.team}`);
      }
      
    } catch (error: any) {
      console.error(`     ❌ Roster Failed: ${error.message}`);
      if (error.message.includes('401')) {
        console.log('     💡 Cookie authentication failed for roster access');
      } else if (error.message.includes('not found')) {
        console.log('     💡 Team ID might be incorrect for this league');
      }
    }
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('📋 Connection Test Summary:');
  console.log('═'.repeat(60));
  
  // Test cookie validity with a simple request
  try {
    console.log('\n🔐 Final Cookie Validation...');
    const testLeague = leagues[0];
    await espnApi.getLeagueInfo(testLeague.id!);
    console.log('✅ ESPN cookies are VALID and working!');
    console.log('   Your authentication is successful.\n');
  } catch (error: any) {
    console.error('❌ ESPN cookies appear to be INVALID or EXPIRED');
    console.log('   Error:', error.message);
    console.log('\n📝 To refresh cookies:');
    console.log('   1. Go to https://fantasy.espn.com/');
    console.log('   2. Log in to your account');
    console.log('   3. Open Developer Tools (F12)');
    console.log('   4. Go to Application/Storage → Cookies');
    console.log('   5. Find and copy espn_s2 and SWID values');
    console.log('   6. Update them in your .env file\n');
  }
}

// Run the test
testESPNConnection().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});