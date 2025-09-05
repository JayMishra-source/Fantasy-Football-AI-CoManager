import { espnApi } from '../services/espnApi.js';
import { Player } from '../types/espn.js';
import { getFantasyProsRankings, comparePlayerValue } from './enhancedDraft.js';

export interface LineupOptimization {
  currentLineup: Player[];
  suggestedLineup: Player[];
  changes: Array<{
    action: 'bench' | 'start';
    player: Player;
    reason: string;
  }>;
  projectedPointsGain: number;
  dataSources: {
    espnData: boolean;
    fantasyProsData: boolean;
    fantasyProsUsed: boolean;
  };
}

export async function optimizeLineupTool(args: { 
  leagueId: string; 
  teamId: string; 
  week?: number;
  useFantasyPros?: boolean;
}): Promise<LineupOptimization> {
  const { leagueId, teamId, week = 1, useFantasyPros = true } = args;
  
  if (!leagueId || !teamId) {
    throw new Error('League ID and Team ID are required');
  }
  
  try {
    const roster = await espnApi.getTeamRoster(leagueId, teamId);
    let allPlayers = [...roster.starters, ...roster.bench];
    
    // Track data sources
    let fantasyProsUsed = false;
    let fantasyProsData = false;
    
    // Try to enhance with FantasyPros data if available
    if (useFantasyPros) {
      try {
        console.log(`🔍 Attempting to enhance lineup optimization with FantasyPros data...`);
        
        // Try to get FantasyPros rankings for context
        const fpRankings = await getFantasyProsRankings({ format: 'PPR' });
        if (fpRankings && fpRankings.topPlayers && fpRankings.topPlayers.length > 0) {
          fantasyProsData = true;
          fantasyProsUsed = true;
          console.log(`✅ FantasyPros data available with ${fpRankings.topPlayers.length} player rankings`);
          
          // Enhance players with FantasyPros rankings for better decision making
          allPlayers = await enhancePlayersWithFantasyPros(allPlayers, fpRankings.topPlayers);
          
        } else {
          console.log(`⚠️ FantasyPros rankings not available - using ESPN data only`);
        }
      } catch (error) {
        console.log(`⚠️ FantasyPros integration failed: ${error} - falling back to ESPN data`);
      }
    }
    
    // Group players by position
    const playersByPosition: { [key: string]: Player[] } = {};
    allPlayers.forEach(player => {
      if (!playersByPosition[player.position]) {
        playersByPosition[player.position] = [];
      }
      playersByPosition[player.position].push(player);
    });
    
    // Sort each position by projected points (descending)
    Object.keys(playersByPosition).forEach(position => {
      playersByPosition[position].sort((a, b) => 
        (b.projectedPoints || 0) - (a.projectedPoints || 0)
      );
    });
    
    // Standard lineup requirements (adjust based on league settings)
    const lineupRequirements = {
      'QB': 1,
      'RB': 2,
      'WR': 2,
      'TE': 1,
      'K': 1,
      'DST': 1,
      'FLEX': 1 // RB/WR/TE
    };
    
    const suggestedLineup: Player[] = [];
    const changes: LineupOptimization['changes'] = [];
    
    // Fill required positions
    Object.entries(lineupRequirements).forEach(([position, count]) => {
      if (position === 'FLEX') {
        // Handle flex separately
        return;
      }
      
      const availablePlayers = playersByPosition[position] || [];
      const selectedPlayers = availablePlayers
        .filter(p => !p.injuryStatus || p.injuryStatus === 'ACTIVE')
        .slice(0, count);
      
      suggestedLineup.push(...selectedPlayers);
      
      // Mark these players as used
      selectedPlayers.forEach(player => {
        const currentlyStarting = roster.starters.some(s => s.id === player.id);
        if (!currentlyStarting) {
          changes.push({
            action: 'start',
            player,
            reason: `Higher projected points (${player.projectedPoints})`
          });
        }
      });
    });
    
    // Handle FLEX position (best available RB/WR/TE not already starting)
    const flexCandidates = [
      ...(playersByPosition['RB'] || []).slice(2), // RBs beyond the 2 starters
      ...(playersByPosition['WR'] || []).slice(2), // WRs beyond the 2 starters
      ...(playersByPosition['TE'] || []).slice(1), // TEs beyond the 1 starter
    ].filter(p => 
      !suggestedLineup.some(s => s.id === p.id) && 
      (!p.injuryStatus || p.injuryStatus === 'ACTIVE')
    ).sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0));
    
    if (flexCandidates.length > 0) {
      const flexPlayer = flexCandidates[0];
      suggestedLineup.push(flexPlayer);
      
      const currentlyStarting = roster.starters.some(s => s.id === flexPlayer.id);
      if (!currentlyStarting) {
        changes.push({
          action: 'start',
          player: flexPlayer,
          reason: `Best FLEX option (${flexPlayer.projectedPoints} projected)`
        });
      }
    }
    
    // Identify players to bench
    roster.starters.forEach(starter => {
      if (!suggestedLineup.some(s => s.id === starter.id)) {
        changes.push({
          action: 'bench',
          player: starter,
          reason: starter.injuryStatus ? 
            `Injury status: ${starter.injuryStatus}` : 
            'Lower projected points than alternatives'
        });
      }
    });
    
    // Calculate projected points gain
    const currentProjected = roster.starters.reduce((sum, p) => sum + (p.projectedPoints || 0), 0);
    const suggestedProjected = suggestedLineup.reduce((sum, p) => sum + (p.projectedPoints || 0), 0);
    const projectedPointsGain = suggestedProjected - currentProjected;
    
    return {
      currentLineup: roster.starters,
      suggestedLineup,
      changes,
      projectedPointsGain: Math.round(projectedPointsGain * 10) / 10,
      dataSources: {
        espnData: true,
        fantasyProsData: fantasyProsData,
        fantasyProsUsed: fantasyProsUsed
      }
    };
  } catch (error: any) {
    throw new Error(`Failed to optimize lineup: ${error.message}`);
  }
}

export async function getStartSitAdviceTool(args: {
  leagueId: string;
  teamId: string;
  playerName: string;
}): Promise<{ recommendation: 'start' | 'sit'; reasoning: string[] }> {
  const { leagueId, teamId, playerName } = args;
  
  if (!leagueId || !teamId || !playerName) {
    throw new Error('League ID, Team ID, and Player Name are required');
  }
  
  try {
    const roster = await espnApi.getTeamRoster(leagueId, teamId);
    const allPlayers = [...roster.starters, ...roster.bench];
    
    // Find the player in question
    const player = allPlayers.find(p => 
      p.fullName.toLowerCase().includes(playerName.toLowerCase()) ||
      p.lastName.toLowerCase().includes(playerName.toLowerCase())
    );
    
    if (!player) {
      throw new Error(`Player "${playerName}" not found on roster`);
    }
    
    const reasoning: string[] = [];
    let score = 0;
    
    // Check injury status
    if (player.injuryStatus && player.injuryStatus !== 'ACTIVE') {
      reasoning.push(`Injury concern: ${player.injuryStatus}`);
      score -= 3;
    }
    
    // Check projected points
    if ((player.projectedPoints || 0) > 10) {
      reasoning.push(`Strong projection: ${player.projectedPoints} points`);
      score += 2;
    } else if ((player.projectedPoints || 0) < 5) {
      reasoning.push(`Low projection: ${player.projectedPoints} points`);
      score -= 2;
    }
    
    // Check start percentage
    if ((player.percentStarted || 0) > 70) {
      reasoning.push(`Widely started: ${player.percentStarted}% of leagues`);
      score += 1;
    } else if ((player.percentStarted || 0) < 30) {
      reasoning.push(`Rarely started: ${player.percentStarted}% of leagues`);
      score -= 1;
    }
    
    // Compare to other options at position
    const samePositionPlayers = allPlayers
      .filter(p => p.position === player.position && p.id !== player.id)
      .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0));
    
    if (samePositionPlayers.length > 0) {
      const bestAlternative = samePositionPlayers[0];
      if ((bestAlternative.projectedPoints || 0) > (player.projectedPoints || 0) + 3) {
        reasoning.push(`Better option available: ${bestAlternative.fullName} (${bestAlternative.projectedPoints} proj)`);
        score -= 2;
      } else if ((player.projectedPoints || 0) > (bestAlternative.projectedPoints || 0) + 3) {
        reasoning.push(`Best option at position`);
        score += 2;
      }
    }
    
    return {
      recommendation: score >= 0 ? 'start' : 'sit',
      reasoning
    };
  } catch (error: any) {
    throw new Error(`Failed to get start/sit advice: ${error.message}`);
  }
}

/**
 * Enhance player data with FantasyPros rankings for better decision making
 */
async function enhancePlayersWithFantasyPros(players: Player[], fpRankings: any[]): Promise<Player[]> {
  const enhancedPlayers = players.map(player => {
    // Find matching FantasyPros ranking by name
    const fpPlayer = fpRankings.find(fp => 
      fp.name && (
        fp.name.toLowerCase().includes(player.lastName.toLowerCase()) ||
        player.fullName.toLowerCase().includes(fp.name.toLowerCase())
      )
    );
    
    if (fpPlayer) {
      // Enhance player with FantasyPros data
      return {
        ...player,
        // Add FantasyPros rank as additional context
        fantasyProsRank: fpPlayer.rank || null,
        fantasyProsTier: fpPlayer.tier || null,
        // Keep existing projected points (FantasyPros doesn't provide projected points in this format)
        projectedPoints: player.projectedPoints
      };
    }
    
    return player;
  });
  
  return enhancedPlayers;
}