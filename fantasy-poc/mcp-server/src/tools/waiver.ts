import { espnApi } from '../services/espnApi.js';
import { Player, WaiverTarget } from '../types/espn.js';
import { getFantasyProsRankings } from './enhancedDraft.js';

export interface WaiverRecommendations {
  targets: WaiverTarget[];
  dropCandidates: Player[];
  analysis: {
    leagueContext: string;
    weeklyTrends: string[];
    priorityFocus: string;
  };
}

export async function findWaiverTargetsTool(args: {
  leagueId: string;
  teamId?: string;
  position?: string;
  maxResults?: number;
  useFantasyPros?: boolean;
}): Promise<WaiverRecommendations> {
  const { leagueId, teamId, position, maxResults = 10, useFantasyPros = true } = args;
  
  if (!leagueId) {
    throw new Error('League ID is required');
  }
  
  try {
    // Get available players
    let availablePlayers = await espnApi.getAvailablePlayers(leagueId);
    
    // Enhance with FantasyPros data if available
    if (useFantasyPros) {
      try {
        console.log(`🔍 Attempting to enhance waiver analysis with FantasyPros data...`);
        const fpRankings = await getFantasyProsRankings({ format: 'PPR' });
        if (fpRankings && fpRankings.topPlayers && fpRankings.topPlayers.length > 0) {
          console.log(`✅ Enhancing ${availablePlayers.length} available players with FantasyPros data`);
          availablePlayers = await enhanceWaiverPlayersWithFantasyPros(availablePlayers, fpRankings.topPlayers);
        }
      } catch (error) {
        console.log(`⚠️ FantasyPros waiver enhancement failed: ${error} - using ESPN data only`);
      }
    }
    
    // Filter by position if specified
    let candidates = position 
      ? availablePlayers.filter(p => p.position === position)
      : availablePlayers;
    
    // Score and rank waiver targets
    const targets: WaiverTarget[] = candidates
      .map(player => {
        let priority = 0;
        const reasons: string[] = [];
        
        // Scoring factors
        if ((player.projectedPoints || 0) > 10) {
          priority += 3;
          reasons.push(`Strong projection: ${player.projectedPoints} pts`);
        }
        
        // Rising usage
        if ((player.percentStarted || 0) > (player.percentOwned || 0) - 20) {
          priority += 2;
          reasons.push('Rising start percentage');
        }
        
        // Low ownership with good projection
        if ((player.percentOwned || 0) < 30 && (player.projectedPoints || 0) > 8) {
          priority += 4;
          reasons.push('Hidden gem (low owned, good projection)');
        }
        
        // Position scarcity bonus
        if (['RB', 'TE'].includes(player.position) && (player.projectedPoints || 0) > 7) {
          priority += 1;
          reasons.push(`Scarce position: ${player.position}`);
        }
        
        // FantasyPros boost if available
        if ((player as any).fantasyProsBoost) {
          priority += (player as any).fantasyProsBoost;
          const rank = (player as any).fantasyProsRank;
          reasons.push(`FantasyPros ranked #${rank} (expert consensus)`);
        }
        
        // Calculate suggested FAAB
        let suggestedFAAB = 0;
        if (priority >= 7) suggestedFAAB = 15 + Math.floor((player.projectedPoints || 0));
        else if (priority >= 5) suggestedFAAB = 8 + Math.floor((player.projectedPoints || 0) / 2);
        else if (priority >= 3) suggestedFAAB = 3 + Math.floor((player.projectedPoints || 0) / 3);
        else suggestedFAAB = 1;
        
        return {
          player,
          reason: reasons.join('; ') || 'Depth addition',
          priority,
          suggestedFAAB
        };
      })
      .filter(target => target.priority > 0)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxResults);
    
    // Get drop candidates if team is specified
    let dropCandidates: Player[] = [];
    if (teamId) {
      const roster = await espnApi.getTeamRoster(leagueId, teamId);
      const allPlayers = [...roster.starters, ...roster.bench];
      
      // Identify worst performers and injured players
      dropCandidates = allPlayers
        .filter(p => {
          const isInjured = p.injuryStatus && !['ACTIVE', 'QUESTIONABLE'].includes(p.injuryStatus);
          const lowProjection = (p.projectedPoints || 0) < 5;
          const lowUsage = (p.percentStarted || 0) < 20;
          return isInjured || (lowProjection && lowUsage);
        })
        .sort((a, b) => (a.projectedPoints || 0) - (b.projectedPoints || 0))
        .slice(0, 5);
    }
    
    // Generate analysis
    const analysis = {
      leagueContext: `Found ${targets.length} viable waiver targets from ${availablePlayers.length} available players`,
      weeklyTrends: [
        targets.filter(t => t.player.position === 'RB').length > 3 
          ? 'Multiple RB options available' 
          : 'Limited RB options on waivers',
        targets.filter(t => t.priority >= 5).length > 0
          ? `${targets.filter(t => t.priority >= 5).length} high-priority targets identified`
          : 'No urgent waiver claims needed'
      ],
      priorityFocus: targets[0]?.priority >= 7 
        ? `Priority claim: ${targets[0].player.fullName}` 
        : 'No must-have players this week'
    };
    
    return {
      targets,
      dropCandidates,
      analysis
    };
  } catch (error: any) {
    throw new Error(`Failed to find waiver targets: ${error.message}`);
  }
}

export async function analyzePlayerTool(args: {
  leagueId: string;
  playerName: string;
}): Promise<{
  player: Player;
  analysis: {
    verdict: 'add' | 'hold' | 'drop';
    reasoning: string[];
    comparison: string;
  };
}> {
  const { leagueId, playerName } = args;
  
  if (!leagueId || !playerName) {
    throw new Error('League ID and Player Name are required');
  }
  
  try {
    // Get all players to find the specific one
    const allPlayers = await espnApi.getPlayers(leagueId);
    const player = allPlayers.find(p => 
      p.fullName.toLowerCase().includes(playerName.toLowerCase()) ||
      p.lastName.toLowerCase().includes(playerName.toLowerCase())
    );
    
    if (!player) {
      throw new Error(`Player "${playerName}" not found`);
    }
    
    const reasoning: string[] = [];
    let score = 0;
    
    // Analyze player value
    if ((player.projectedPoints || 0) > 12) {
      reasoning.push('Strong weekly projection');
      score += 3;
    } else if ((player.projectedPoints || 0) < 5) {
      reasoning.push('Low projected output');
      score -= 2;
    }
    
    if ((player.percentOwned || 0) > 70) {
      reasoning.push(`Widely rostered (${player.percentOwned}%)`);
      score += 2;
    } else if ((player.percentOwned || 0) < 20) {
      reasoning.push(`Low roster percentage (${player.percentOwned}%)`);
      score -= 1;
    }
    
    if (player.injuryStatus && !['ACTIVE', 'QUESTIONABLE'].includes(player.injuryStatus)) {
      reasoning.push(`Injury concern: ${player.injuryStatus}`);
      score -= 3;
    }
    
    // Compare to position average
    const samePositionPlayers = allPlayers.filter(p => p.position === player.position);
    const avgProjection = samePositionPlayers.reduce((sum, p) => sum + (p.projectedPoints || 0), 0) / samePositionPlayers.length;
    
    const comparison = (player.projectedPoints || 0) > avgProjection 
      ? `Above average for ${player.position} (avg: ${avgProjection.toFixed(1)})`
      : `Below average for ${player.position} (avg: ${avgProjection.toFixed(1)})`;
    
    // Determine verdict
    let verdict: 'add' | 'hold' | 'drop';
    if (score >= 3) verdict = 'add';
    else if (score >= -1) verdict = 'hold';
    else verdict = 'drop';
    
    return {
      player,
      analysis: {
        verdict,
        reasoning,
        comparison
      }
    };
  } catch (error: any) {
    throw new Error(`Failed to analyze player: ${error.message}`);
  }
}

/**
 * Enhance waiver players with FantasyPros rankings for better waiver decisions
 */
async function enhanceWaiverPlayersWithFantasyPros(players: Player[], fpRankings: any[]): Promise<Player[]> {
  const enhancedPlayers = players.map(player => {
    // Find matching FantasyPros ranking by name
    const fpPlayer = fpRankings.find(fp => 
      fp.name && (
        fp.name.toLowerCase().includes(player.lastName.toLowerCase()) ||
        player.fullName.toLowerCase().includes(fp.name.toLowerCase())
      )
    );
    
    if (fpPlayer) {
      // Enhance player with FantasyPros data for better waiver priority
      return {
        ...player,
        fantasyProsRank: fpPlayer.rank || null,
        fantasyProsTier: fpPlayer.tier || null,
        // Boost projected points if FantasyPros rates the player highly
        projectedPoints: fpPlayer.rank && fpPlayer.rank < 100 
          ? Math.max(player.projectedPoints || 0, player.projectedPoints || 0)
          : player.projectedPoints,
        // Add waiver priority boost for highly ranked players
        fantasyProsBoost: fpPlayer.rank < 50 ? 2 : fpPlayer.rank < 100 ? 1 : 0
      };
    }
    
    return player;
  });
  
  return enhancedPlayers;
}