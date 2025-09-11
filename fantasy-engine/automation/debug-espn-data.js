#!/usr/bin/env node

import { espnApi } from '@fantasy-ai/shared';
import { loadProductionConfig } from './dist/config/production.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Force enable ESPN debugging
process.env.DEBUG_ESPN = 'true';

async function debugESPNData() {
  try {
    console.log('🔍 ========== ESPN DATA FLOW DEBUG ==========');
    
    // Load config and initialize cookies
    const config = loadProductionConfig();
    
    if (config.espn.s2 && config.espn.swid) {
      espnApi.setCookies({
        espn_s2: config.espn.s2,
        swid: config.espn.swid
      });
      console.log('✅ ESPN cookies initialized');
    } else {
      throw new Error('ESPN cookies not available in config');
    }
    
    // Debug first league's roster
    const firstLeague = config.leagues[0];
    console.log(`\n📊 Debugging league: ${firstLeague.name} (${firstLeague.id})`);
    console.log(`👤 Team ID: ${firstLeague.teamId}`);
    
    console.log('\n🔄 Calling espnApi.getTeamRoster()...');
    const roster = await espnApi.getTeamRoster(firstLeague.id, firstLeague.teamId);
    
    console.log('\n📋 ROSTER SUMMARY:');
    console.log(`- Starters: ${roster.starters?.length || 0}`);
    console.log(`- Bench: ${roster.bench?.length || 0}`);
    console.log(`- IR: ${roster.injuredReserve?.length || 0}`);
    
    console.log('\n🔍 ANALYZING SAMPLE PLAYERS:');
    
    // Check first 3 starters for projection data
    if (roster.starters && roster.starters.length > 0) {
      console.log('\n📊 STARTERS SAMPLE (Weekly Projections):');
      roster.starters.slice(0, 3).forEach((player, index) => {
        console.log(`${index + 1}. ${player.fullName} (${player.position})`);
        console.log(`   - Projected Points: ${player.projectedPoints}`);
        console.log(`   - Season Total: ${player.seasonProjectedPoints || 'Not set'}`);
        console.log(`   - Percent Owned: ${player.percentOwned}%`);
        console.log(`   - Percent Started: ${player.percentStarted}%`);
      });
    }
    
    // Check bench players
    if (roster.bench && roster.bench.length > 0) {
      console.log('\n🪑 BENCH SAMPLE (Weekly Projections):');
      roster.bench.slice(0, 3).forEach((player, index) => {
        console.log(`${index + 1}. ${player.fullName} (${player.position})`);
        console.log(`   - Projected Points: ${player.projectedPoints}`);
        console.log(`   - Season Total: ${player.seasonProjectedPoints || 'Not set'}`);
        console.log(`   - Percent Owned: ${player.percentOwned}%`);
        console.log(`   - Percent Started: ${player.percentStarted}%`);
      });
    }
    
    // Check IR players specifically
    if (roster.injuredReserve && roster.injuredReserve.length > 0) {
      console.log('\n🏥 IR PLAYERS:');
      roster.injuredReserve.forEach((player, index) => {
        console.log(`${index + 1}. ${player.fullName} (${player.position})`);
        console.log(`   - Injury Status: ${player.injuryStatus || 'None'}`);
        console.log(`   - Projected Points: ${player.projectedPoints}`);
        console.log(`   - Percent Owned: ${player.percentOwned}%`);
      });
    } else {
      console.log('\n🏥 IR PLAYERS: None');
    }
    
    console.log('\n🔍 ========== DEBUG COMPLETE ==========');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Full error:', error);
  }
}

debugESPNData();