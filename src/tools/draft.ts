import { draftApi } from '../services/draftApi.js';
import { espnApi } from '../services/espnApi.js';
import { DraftAnalysis, DraftRecommendation, PlayerRankings } from '../types/draft.js';

export async function getDraftInfo(args: { leagueId: string }) {
  const { leagueId } = args;
  
  if (!leagueId) {
    throw new Error('League ID is required');
  }
  
  try {
    const draftInfo = await draftApi.getDraftInfo(leagueId);
    return draftInfo;
  } catch (error: any) {
    throw new Error(`Failed to get draft info: ${error.message}`);
  }
}

export async function analyzeDraft(args: { leagueId: string }): Promise<DraftAnalysis> {
  const { leagueId } = args;
  
  if (!leagueId) {
    throw new Error('League ID is required');
  }
  
  try {
    const draftInfo = await draftApi.getDraftInfo(leagueId);
    
    if (!draftInfo.isCompleted) {
      throw new Error('Draft is not yet completed - cannot analyze');
    }

    // Get all available players for value analysis
    const allPlayers = await draftApi.getAvailablePlayers(leagueId);
    const playerValues = new Map(allPlayers.map(p => [p.id, p.adp || 999]));

    // Analyze each team's draft
    const teamAnalysis = await Promise.all(
      Array.from(new Set(draftInfo.picks.map(p => p.teamId))).map(async (teamId) => {
        const teamPicks = draftInfo.picks.filter(p => p.teamId === teamId);
        const teamName = teamPicks[0]?.teamName || `Team ${teamId}`;

        // Count positions
        const positionCounts: { [position: string]: number } = {};
        teamPicks.forEach(pick => {
          positionCounts[pick.position] = (positionCounts[pick.position] || 0) + 1;
        });

        // Analyze strengths/weaknesses
        const strengths: string[] = [];
        const weaknesses: string[] = [];

        if ((positionCounts['RB'] || 0) >= 3) strengths.push('Good RB depth');
        if ((positionCounts['WR'] || 0) >= 4) strengths.push('Strong WR corps');
        if ((positionCounts['TE'] || 0) >= 2) strengths.push('TE depth');
        
        if ((positionCounts['RB'] || 0) < 2) weaknesses.push('Thin at RB');
        if ((positionCounts['WR'] || 0) < 3) weaknesses.push('Need WR depth');
        if ((positionCounts['QB'] || 0) === 0) weaknesses.push('No QB drafted');

        // Find best pick (biggest value)
        const bestPick = teamPicks.reduce((best, pick) => {
          const expectedPick = playerValues.get(pick.playerId) || pick.pickNumber;
          const value = expectedPick - pick.pickNumber;
          const bestValue = (playerValues.get(best.playerId) || best.pickNumber) - best.pickNumber;
          return value > bestValue ? pick : best;
        });

        // Grade the draft
        const avgValue = teamPicks.reduce((sum, pick) => {
          const expectedPick = playerValues.get(pick.playerId) || pick.pickNumber;
          return sum + (expectedPick - pick.pickNumber);
        }, 0) / teamPicks.length;

        let grade = 'C';
        if (avgValue > 10) grade = 'A+';
        else if (avgValue > 5) grade = 'A';
        else if (avgValue > 2) grade = 'B+';
        else if (avgValue > 0) grade = 'B';
        else if (avgValue > -5) grade = 'C';
        else grade = 'D';

        return {
          teamId,
          teamName,
          grade,
          strengths,
          weaknesses,
          bestPick,
          positionCounts
        };
      })
    );

    // Overall insights
    const allPicks = draftInfo.picks;
    
    // Find best value pick overall
    const bestValue = allPicks.reduce((best, pick) => {
      const expectedPick = playerValues.get(pick.playerId) || pick.pickNumber;
      const value = expectedPick - pick.pickNumber;
      const bestVal = (playerValues.get(best.playerId) || best.pickNumber) - best.pickNumber;
      return value > bestVal ? pick : best;
    });

    // Find biggest reach
    const biggestReach = allPicks.reduce((reach, pick) => {
      const expectedPick = playerValues.get(pick.playerId) || pick.pickNumber;
      const value = pick.pickNumber - expectedPick;
      const reachVal = reach.pickNumber - (playerValues.get(reach.playerId) || reach.pickNumber);
      return value > reachVal ? pick : reach;
    });

    // Position trends
    const positionTrends: string[] = [];
    const earlyPicks = allPicks.slice(0, 30); // First 3 rounds roughly
    const rbEarly = earlyPicks.filter(p => p.position === 'RB').length;
    const wrEarly = earlyPicks.filter(p => p.position === 'WR').length;
    
    if (rbEarly > wrEarly * 1.5) positionTrends.push('RB-heavy early draft');
    if (wrEarly > rbEarly * 1.5) positionTrends.push('WR-heavy early draft');
    
    // Find potential sleepers (late picks with high projections)
    const latePicks = allPicks.slice(-50); // Last ~3 rounds
    const sleepers = latePicks
      .filter(pick => {
        const expectedPick = playerValues.get(pick.playerId) || 999;
        return expectedPick < pick.pickNumber - 30; // Went 30+ picks later than expected
      })
      .slice(0, 3);

    return {
      draftInfo,
      teamAnalysis,
      overallInsights: {
        bestValue,
        biggestReach,
        positionTrends,
        sleepers
      }
    };
  } catch (error: any) {
    throw new Error(`Failed to analyze draft: ${error.message}`);
  }
}

export async function getDraftRecommendations(args: {
  leagueId: string;
  teamId: string;
  round?: number;
}): Promise<DraftRecommendation> {
  const { leagueId, teamId, round = 1 } = args;
  
  if (!leagueId || !teamId) {
    throw new Error('League ID and Team ID are required');
  }
  
  try {
    const draftInfo = await draftApi.getDraftInfo(leagueId);
    
    if (draftInfo.isCompleted) {
      throw new Error('Draft is already completed');
    }

    // Get team's current picks
    const teamPicks = draftInfo.picks.filter(p => p.teamId === parseInt(teamId));
    
    // Analyze position needs
    const positionCounts: { [position: string]: number } = {};
    teamPicks.forEach(pick => {
      positionCounts[pick.position] = (positionCounts[pick.position] || 0) + 1;
    });

    const positionNeeds: string[] = [];
    if ((positionCounts['RB'] || 0) < 2) positionNeeds.push('RB');
    if ((positionCounts['WR'] || 0) < 2) positionNeeds.push('WR');
    if ((positionCounts['QB'] || 0) === 0 && round >= 4) positionNeeds.push('QB');
    if ((positionCounts['TE'] || 0) === 0 && round >= 6) positionNeeds.push('TE');

    // Get available players
    const availablePlayers = await draftApi.getAvailablePlayers(leagueId);
    const draftedPlayerIds = new Set(draftInfo.picks.map(p => p.playerId));
    const stillAvailable = availablePlayers.filter(p => !draftedPlayerIds.has(p.id));

    // Recommend players
    const recommendedPlayers = stillAvailable
      .slice(0, 20)
      .map(player => {
        const adp = player.adp || 999;
        const currentPick = draftInfo.picks.length + 1;
        
        let value: 'steal' | 'good' | 'fair' | 'reach';
        if (adp < currentPick - 20) value = 'steal';
        else if (adp < currentPick - 5) value = 'good';
        else if (adp <= currentPick + 5) value = 'fair';
        else value = 'reach';

        let reason = `Ranked #${Math.floor(adp)} overall`;
        if (positionNeeds.includes(player.position)) {
          reason += `, fills ${player.position} need`;
        }
        if (value === 'steal') reason += ', excellent value';

        return {
          player,
          reason,
          tier: Math.ceil(adp / 24), // Rough tier based on ADP
          adp,
          value
        };
      })
      .sort((a, b) => {
        // Prioritize position needs and value
        const aScore = (positionNeeds.includes(a.player.position) ? 20 : 0) +
                      (['steal', 'good', 'fair', 'reach'].indexOf(a.value) * -5);
        const bScore = (positionNeeds.includes(b.player.position) ? 20 : 0) +
                      (['steal', 'good', 'fair', 'reach'].indexOf(b.value) * -5);
        return bScore - aScore;
      })
      .slice(0, 10);

    // Draft strategy
    let strategy = '';
    if (round <= 3) {
      strategy = 'Focus on RB/WR studs - build your foundation';
    } else if (round <= 6) {
      strategy = 'Fill roster needs, consider QB/TE if good value';
    } else if (round <= 10) {
      strategy = 'Look for depth and upside plays';
    } else {
      strategy = 'Handcuffs, defense, kicker, and lottery tickets';
    }

    const nextFewRounds = [
      round <= 2 ? 'Target elite RB or WR' : '',
      round <= 4 ? 'Consider top-tier QB/TE if available' : '',
      round <= 8 ? 'Build depth at skill positions' : '',
      'Look for breakout candidates and handcuffs'
    ].filter(Boolean);

    return {
      recommendedPlayers,
      positionNeeds,
      strategy,
      nextFewRounds
    };
  } catch (error: any) {
    throw new Error(`Failed to get draft recommendations: ${error.message}`);
  }
}

export async function getPlayerRankings(args: { 
  leagueId: string;
  position?: string;
}): Promise<PlayerRankings> {
  const { leagueId, position } = args;
  
  if (!leagueId) {
    throw new Error('League ID is required');
  }
  
  try {
    const availablePlayers = await draftApi.getAvailablePlayers(leagueId, position);
    
    // Sort by ADP/projection
    const overall = availablePlayers
      .sort((a, b) => (a.adp || 999) - (b.adp || 999))
      .slice(0, 200);

    // Group by position
    const byPosition: { [position: string]: any[] } = {};
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
    
    positions.forEach(pos => {
      byPosition[pos] = overall
        .filter(p => p.position === pos)
        .slice(0, pos === 'QB' || pos === 'TE' ? 20 : pos === 'K' || pos === 'DST' ? 15 : 40);
    });

    // Create tiers (every 12 players roughly)
    const tiers: any[] = [];
    for (let i = 0; i < Math.min(overall.length, 120); i += 12) {
      const tierPlayers = overall.slice(i, i + 12);
      tiers.push({
        tier: Math.floor(i / 12) + 1,
        players: tierPlayers,
        description: i === 0 ? 'Elite Tier' : 
                    i < 24 ? 'High-End Starters' :
                    i < 60 ? 'Solid Starters' :
                    i < 96 ? 'Flex/Backup' : 'Deep Sleepers'
      });
    }

    // Identify sleepers (high projection, low ADP)
    const sleepers = overall
      .filter(p => p.projectedPoints > 100 && (p.adp || 999) > 150)
      .slice(0, 10);

    // Players to potentially avoid (injury concerns, etc.)
    const avoids = overall
      .filter(p => p.injuryStatus && p.injuryStatus !== 'ACTIVE')
      .slice(0, 10);

    return {
      overall,
      byPosition,
      tiers,
      sleepers,
      avoids
    };
  } catch (error: any) {
    throw new Error(`Failed to get player rankings: ${error.message}`);
  }
}