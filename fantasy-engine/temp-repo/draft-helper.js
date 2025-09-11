#!/usr/bin/env node

/**
 * Live Draft Helper - Your AI Fantasy Football Draft Assistant
 * Run this during your draft for real-time recommendations!
 */

import { espnApi } from './dist/services/espnApi.js';
import { getDraftRecommendations, getPlayerRankings, getDraftInfo } from './dist/tools/draft.js';
import { llmManager } from './dist/services/llm/manager.js';
import { getDefaultLLMConfig } from './dist/config/llm-config.js';

console.log('🏈 DRAFT HELPER - Live Fantasy Football Assistant');
console.log('================================================\n');

const LEAGUE_ID = process.env.LEAGUE_2_ID || process.env.LEAGUE_1_ID;
const TEAM_ID = process.env.LEAGUE_2_TEAM_ID || process.env.LEAGUE_1_TEAM_ID;

if (!LEAGUE_ID || !TEAM_ID) {
  console.log('❌ Please set LEAGUE_2_ID and LEAGUE_2_TEAM_ID environment variables');
  console.log('   Or LEAGUE_1_ID and LEAGUE_1_TEAM_ID if using first league');
  process.exit(1);
}

console.log(`🎯 League: ${LEAGUE_ID}`);
console.log(`👤 Team: ${TEAM_ID}\n`);

async function getDraftStatus() {
  try {
    const draftInfo = await getDraftInfo({ leagueId: LEAGUE_ID });
    
    console.log('📋 DRAFT STATUS:');
    console.log(`Status: ${draftInfo.isCompleted ? '✅ COMPLETED' : '🔄 IN PROGRESS'}`);
    console.log(`Type: ${draftInfo.draftType.toUpperCase()}`);
    console.log(`Rounds: ${draftInfo.totalRounds}`);
    console.log(`Picks completed: ${draftInfo.picks.length}/${draftInfo.totalPicks}`);
    
    if (draftInfo.currentPick) {
      const currentRound = Math.ceil(draftInfo.currentPick / 10);
      console.log(`Current: Round ${currentRound}, Pick #${draftInfo.currentPick}`);
    }
    
    if (draftInfo.onTheClock) {
      console.log(`⏰ On the clock: Team ${draftInfo.onTheClock}`);
      if (draftInfo.onTheClock === parseInt(TEAM_ID)) {
        console.log('🚨 YOU\'RE UP! CHECK RECOMMENDATIONS BELOW 🚨');
      }
    }
    
    return draftInfo;
  } catch (error) {
    console.log(`⚠️ Could not get draft status: ${error.message}`);
    return null;
  }
}

async function getMyRecommendations() {
  try {
    const currentRound = 1; // You can update this manually during draft
    
    console.log('\n🎯 YOUR DRAFT RECOMMENDATIONS:');
    console.log('================================');
    
    const recommendations = await getDraftRecommendations({
      leagueId: LEAGUE_ID,
      teamId: TEAM_ID,
      round: currentRound
    });
    
    console.log(`📊 Strategy: ${recommendations.strategy}`);
    
    if (recommendations.positionNeeds.length > 0) {
      console.log(`🔍 Position Needs: ${recommendations.positionNeeds.join(', ')}`);
    }
    
    console.log('\n🏆 TOP RECOMMENDED PLAYERS:');
    recommendations.recommendedPlayers.slice(0, 8).forEach((rec, i) => {
      const valueEmoji = {
        'steal': '🔥',
        'good': '✅', 
        'fair': '👍',
        'reach': '⚠️'
      }[rec.value];
      
      console.log(`${i + 1}. ${rec.player.fullName} (${rec.player.position}) ${valueEmoji}`);
      console.log(`   ${rec.reason}`);
      console.log(`   ADP: ${rec.adp} | Value: ${rec.value.toUpperCase()}`);
    });
    
    console.log('\n🔮 NEXT FEW ROUNDS STRATEGY:');
    recommendations.nextFewRounds.forEach((strategy, i) => {
      console.log(`Round ${currentRound + i + 1}: ${strategy}`);
    });
    
    return recommendations;
  } catch (error) {
    console.log(`⚠️ Could not get recommendations: ${error.message}`);
    return null;
  }
}

async function getTopPlayers() {
  try {
    console.log('\n📈 OVERALL PLAYER RANKINGS:');
    console.log('===========================');
    
    const rankings = await getPlayerRankings({ leagueId: LEAGUE_ID });
    
    console.log('🔝 TOP 20 AVAILABLE:');
    rankings.overall.slice(0, 20).forEach((player, i) => {
      const injuryStatus = player.injuryStatus && player.injuryStatus !== 'ACTIVE' 
        ? ` (${player.injuryStatus})` : '';
      console.log(`${i + 1}. ${player.fullName} - ${player.position}${injuryStatus}`);
    });
    
    if (rankings.sleepers.length > 0) {
      console.log('\n💎 SLEEPER PICKS:');
      rankings.sleepers.slice(0, 5).forEach((player, i) => {
        console.log(`${i + 1}. ${player.fullName} - ${player.position}`);
      });
    }
    
    if (rankings.avoids.length > 0) {
      console.log('\n⚠️ PLAYERS TO MONITOR (Injuries):');
      rankings.avoids.slice(0, 5).forEach((player, i) => {
        console.log(`${i + 1}. ${player.fullName} - ${player.position} (${player.injuryStatus})`);
      });
    }
    
    return rankings;
  } catch (error) {
    console.log(`⚠️ Could not get rankings: ${error.message}`);
    return null;
  }
}

async function getLLMDraftAdvice(recommendations, rankings) {
  const llmConfig = getDefaultLLMConfig();
  if (!llmConfig) {
    console.log('\n🤖 LLM Analysis: Not available (no API key configured)');
    return;
  }
  
  try {
    console.log('\n🤖 AI DRAFT ANALYSIS:');
    console.log('=====================');
    
    await llmManager.initialize(llmConfig);
    
    const draftContext = {
      context: {
        week: 0, // Draft week
        day_of_week: 'tuesday',
        action_type: 'draft',
        priority: 'high'
      },
      data: {
        rosters: [{
          draftRecommendations: recommendations?.recommendedPlayers?.slice(0, 5).map(rec => ({
            player: rec.player.fullName,
            position: rec.player.position,
            value: rec.value,
            adp: rec.adp,
            reason: rec.reason
          })) || []
        }],
        available_players: rankings?.overall?.slice(0, 10).map(player => ({
          name: player.fullName,
          position: player.position,
          injury: player.injuryStatus
        })) || [],
        league_info: [{
          draftType: 'snake',
          currentRound: 1,
          positionNeeds: recommendations?.positionNeeds || []
        }]
      },
      user_preferences: {
        risk_tolerance: 'balanced',
        focus_areas: ['draft_strategy', 'player_values'],
        notification_style: 'detailed'
      }
    };
    
    const analysis = await llmManager.analyzeFantasyData(draftContext);
    
    console.log('🎯 AI INSIGHTS:');
    console.log(analysis.summary);
    console.log(`\n💰 Analysis cost: $${analysis.cost_estimate.estimated_cost.toFixed(4)}`);
    
  } catch (error) {
    console.log(`⚠️ LLM analysis failed: ${error.message}`);
  }
}

// Main draft helper function
async function runDraftHelper() {
  console.log('⚡ Fetching live draft data...\n');
  
  const draftInfo = await getDraftStatus();
  const recommendations = await getMyRecommendations(); 
  const rankings = await getTopPlayers();
  await getLLMDraftAdvice(recommendations, rankings);
  
  console.log('\n' + '='.repeat(50));
  console.log('🏈 DRAFT HELPER SUMMARY:');
  console.log('• Run this script throughout your draft for updates');
  console.log('• Focus on VALUE picks and POSITION NEEDS');
  console.log('• Trust the process - you\'ve got AI backing you up!');
  console.log('='.repeat(50));
  console.log('\n🍀 GOOD LUCK WITH YOUR DRAFT! 🍀');
}

// Run the draft helper
runDraftHelper().catch(error => {
  console.error('Draft helper error:', error.message);
});