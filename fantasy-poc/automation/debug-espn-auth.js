#!/usr/bin/env node

// Debug ESPN authentication to find the root cause of 400 errors
import dotenv from 'dotenv';
import { espnApi } from '@fantasy-ai/shared';

// Load environment variables
dotenv.config();

async function debugESPNAuth() {
  console.log('🔍 ESPN Authentication Debug');
  console.log('=====================================');
  
  // Check if environment variables are present
  const ESPN_S2 = process.env.ESPN_S2;
  const ESPN_SWID = process.env.ESPN_SWID;
  
  console.log('📋 Environment Variables:');
  console.log(`ESPN_S2 present: ${!!ESPN_S2} (length: ${ESPN_S2?.length || 0})`);
  console.log(`ESPN_SWID present: ${!!ESPN_SWID} (length: ${ESPN_SWID?.length || 0})`);
  
  if (!ESPN_S2 || !ESPN_SWID) {
    console.error('❌ ESPN cookies missing from environment variables');
    return false;
  }
  
  // Set cookies in ESPN API
  console.log('\n🍪 Setting cookies in ESPN API...');
  espnApi.setCookies({
    espn_s2: ESPN_S2,
    swid: ESPN_SWID
  });
  
  // Verify cookies were set
  const setCookies = espnApi.getCookies();
  console.log('✅ Cookies set in API:');
  console.log(`  espn_s2: ${setCookies?.espn_s2?.substring(0, 20)}... (length: ${setCookies?.espn_s2?.length})`);
  console.log(`  swid: ${setCookies?.swid}`);
  
  // Test league access with both league IDs from error message
  const testLeagues = ['2078910238', '21366365'];
  
  for (const leagueId of testLeagues) {
    console.log(`\n🏈 Testing league ${leagueId}:`);
    
    try {
      console.log('  📋 Attempting getLeagueInfo...');
      const leagueInfo = await espnApi.getLeagueInfo(leagueId);
      console.log(`  ✅ League Info: ${leagueInfo.name} (Teams: ${leagueInfo.teams?.length || 0})`);
      
      // If league info works, try team roster for first team
      if (leagueInfo.teams && leagueInfo.teams.length > 0) {
        const firstTeamId = leagueInfo.teams[0].id;
        console.log(`  📋 Attempting getTeamRoster for team ${firstTeamId}...`);
        const roster = await espnApi.getTeamRoster(leagueId, firstTeamId.toString());
        console.log(`  ✅ Roster: ${roster.teamName} (Starters: ${roster.starters?.length || 0}, Bench: ${roster.bench?.length || 0})`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error for league ${leagueId}:`, error.message);
      
      // Log the full error details for debugging
      if (error.response) {
        console.error(`    HTTP Status: ${error.response.status}`);
        console.error(`    Status Text: ${error.response.statusText}`);
        console.error(`    Response Data (first 200 chars):`, JSON.stringify(error.response.data).substring(0, 200));
      }
    }
  }
  
  console.log('\n🔍 Debug complete');
}

debugESPNAuth().catch(error => {
  console.error('❌ Debug script failed:', error);
  process.exit(1);
});