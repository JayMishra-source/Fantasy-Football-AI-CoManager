import { enhancedDraftApi } from '../services/enhancedDraftApi.js';
import { fantasyProsApi } from '../services/fantasyProsApi.js';

export async function initializeFantasyPros(args: {
  email?: string;
  password?: string;
  sessionId?: string;
  additionalCookies?: string;
}): Promise<{ success: boolean; message: string }> {
  const { email, password, sessionId, additionalCookies } = args;
  
  // Session authentication takes priority
  if (sessionId) {
    try {
      const success = await fantasyProsApi.authenticateWithSession(sessionId, additionalCookies);
      
      if (success) {
        // Initialize enhanced draft API after authentication
        await enhancedDraftApi.initializeWithSession();
        return {
          success: true,
          message: 'FantasyPros MVP subscription connected via session! Enhanced draft data now available.'
        };
      } else {
        return {
          success: false,
          message: 'Failed to authenticate with session ID. Please verify it\'s still valid.'
        };
      }
    } catch (error: any) {
      throw new Error(`FantasyPros session authentication failed: ${error.message}`);
    }
  }
  
  // Fall back to email/password authentication
  if (!email || !password) {
    throw new Error('Either sessionId OR email and password are required');
  }
  
  try {
    const success = await enhancedDraftApi.initialize(email, password);
    
    if (success) {
      return {
        success: true,
        message: 'FantasyPros MVP subscription connected successfully! Enhanced draft data now available.'
      };
    } else {
      return {
        success: false,
        message: 'Failed to authenticate with FantasyPros. Please check your credentials.'
      };
    }
  } catch (error: any) {
    throw new Error(`FantasyPros initialization failed: ${error.message}`);
  }
}

export async function getEnhancedDraftRecommendations(args: {
  leagueId: string;
  teamId: string;
  round?: number;
}) {
  const { leagueId, teamId, round = 1 } = args;
  
  if (!leagueId || !teamId) {
    throw new Error('League ID and Team ID are required');
  }
  
  if (!fantasyProsApi.isLoggedIn()) {
    throw new Error('Must initialize FantasyPros integration first. Use initialize_fantasypros tool.');
  }
  
  try {
    const recommendations = await enhancedDraftApi.getEnhancedRecommendations(leagueId, teamId, round);
    return recommendations;
  } catch (error: any) {
    throw new Error(`Failed to get enhanced recommendations: ${error.message}`);
  }
}

export async function getFantasyProsRankings(args: {
  position?: 'ALL' | 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';
  format?: 'STD' | 'HALF' | 'PPR';
}) {
  const { position = 'ALL', format = 'PPR' } = args;
  
  if (!fantasyProsApi.isLoggedIn()) {
    throw new Error('Must initialize FantasyPros integration first. Use initialize_fantasypros tool.');
  }
  
  try {
    const rankings = await fantasyProsApi.getRankings(position, format);
    return {
      position,
      format,
      lastUpdated: rankings.lastUpdated,
      totalPlayers: rankings.players.length,
      topPlayers: rankings.players.slice(0, 50).map(player => ({
        rank: player.rank,
        name: player.player.name,
        team: player.player.team,
        position: player.player.position,
        adp: player.adp,
        tier: player.tier,
        expertConsensus: player.expertConsensus,
        variance: player.stdDev,
        confidence: player.stdDev < 5 ? 'High' : player.stdDev < 10 ? 'Medium' : 'Low'
      }))
    };
  } catch (error: any) {
    throw new Error(`Failed to get FantasyPros rankings: ${error.message}`);
  }
}

export async function getPlayerTiers(args: {
  position: 'QB' | 'RB' | 'WR' | 'TE';
  format?: 'STD' | 'HALF' | 'PPR';
}) {
  const { position, format = 'PPR' } = args;
  
  if (!position) {
    throw new Error('Position is required');
  }
  
  if (!fantasyProsApi.isLoggedIn()) {
    throw new Error('Must initialize FantasyPros integration first. Use initialize_fantasypros tool.');
  }
  
  try {
    const tiers = await fantasyProsApi.getPlayerTiers(position, format);
    
    const formattedTiers = Object.entries(tiers).map(([tierNum, players]) => ({
      tier: parseInt(tierNum),
      description: getTierDescription(parseInt(tierNum), position),
      playerCount: players.length,
      players: players.map(player => ({
        name: player.player.name,
        team: player.player.team,
        rank: player.rank,
        adp: player.adp,
        variance: player.stdDev
      }))
    }));
    
    return {
      position,
      format,
      tiers: formattedTiers
    };
  } catch (error: any) {
    throw new Error(`Failed to get player tiers: ${error.message}`);
  }
}

export async function comparePlayerValue(args: {
  playerName: string;
  currentPick: number;
  leagueId: string;
}) {
  const { playerName, currentPick, leagueId } = args;
  
  if (!playerName || !currentPick || !leagueId) {
    throw new Error('Player name, current pick, and league ID are required');
  }
  
  if (!fantasyProsApi.isLoggedIn()) {
    throw new Error('Must initialize FantasyPros integration first. Use initialize_fantasypros tool.');
  }
  
  try {
    // Get all rankings to find the player
    const rankings = await fantasyProsApi.getRankings('ALL', 'PPR');
    const player = rankings.players.find(p => 
      p.player.name.toLowerCase().includes(playerName.toLowerCase())
    );
    
    if (!player) {
      throw new Error(`Player "${playerName}" not found in FantasyPros rankings`);
    }
    
    const adp = player.adp || player.expertConsensus;
    const valueDiff = adp - currentPick;
    
    let valueAssessment: string;
    let recommendation: string;
    
    if (valueDiff > 20) {
      valueAssessment = 'STEAL';
      recommendation = 'MUST DRAFT - Exceptional value!';
    } else if (valueDiff > 10) {
      valueAssessment = 'GREAT VALUE';
      recommendation = 'Strong pick - well ahead of ADP';
    } else if (valueDiff > 5) {
      valueAssessment = 'GOOD VALUE';
      recommendation = 'Good pick - slight value';
    } else if (valueDiff > -5) {
      valueAssessment = 'FAIR VALUE';
      recommendation = 'Reasonable pick at current ADP';
    } else if (valueDiff > -15) {
      valueAssessment = 'SLIGHT REACH';
      recommendation = 'Minor reach - consider waiting';
    } else {
      valueAssessment = 'REACH';
      recommendation = 'Significant reach - look for better value';
    }
    
    return {
      player: {
        name: player.player.name,
        team: player.player.team,
        position: player.player.position,
        fpRank: player.rank,
        tier: player.tier,
        adp: adp,
        variance: player.stdDev
      },
      currentPick,
      pickDifference: valueDiff,
      valueAssessment,
      recommendation,
      confidence: player.stdDev < 5 ? 'High' : player.stdDev < 10 ? 'Medium' : 'Low',
      expertRange: `${player.bestRank}-${player.worstRank}`,
      shouldDraft: valueDiff > -10
    };
  } catch (error: any) {
    throw new Error(`Failed to compare player value: ${error.message}`);
  }
}

function getTierDescription(tier: number, position: string): string {
  if (position === 'QB') {
    if (tier === 1) return 'Elite QB1s';
    if (tier === 2) return 'High-End Starters';
    if (tier === 3) return 'Solid Starters';
    return 'Streaming Options';
  }
  
  if (position === 'RB' || position === 'WR') {
    if (tier === 1) return 'Elite Tier';
    if (tier === 2) return 'High RB/WR1';
    if (tier === 3) return 'Low RB/WR1';
    if (tier === 4) return 'High RB/WR2';
    if (tier === 5) return 'Mid RB/WR2';
    return 'Flex/Depth';
  }
  
  if (position === 'TE') {
    if (tier === 1) return 'Elite TEs';
    if (tier === 2) return 'Solid Starters';
    return 'Streaming/Backup';
  }
  
  return `Tier ${tier}`;
}