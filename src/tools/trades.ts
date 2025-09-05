import { espnApi } from '../services/espnApi.js';
import { Player, TradeAnalysis } from '../types/espn.js';

export interface TradeProposal {
  giving: Player[];
  receiving: Player[];
  teamId: string;
  partnerTeamId?: string;
}

export async function analyzeTradesTool(args: {
  leagueId: string;
  teamId: string;
  giving: string[]; // Player names
  receiving: string[]; // Player names
}): Promise<TradeAnalysis> {
  const { leagueId, teamId, giving, receiving } = args;
  
  if (!leagueId || !teamId || !giving?.length || !receiving?.length) {
    throw new Error('League ID, Team ID, and trade players are required');
  }
  
  try {
    // Get all players to find the ones in the trade
    const allPlayers = await espnApi.getPlayers(leagueId);
    
    // Find players being given
    const givingPlayers: Player[] = [];
    for (const playerName of giving) {
      const player = allPlayers.find(p => 
        p.fullName.toLowerCase().includes(playerName.toLowerCase()) ||
        p.lastName.toLowerCase().includes(playerName.toLowerCase())
      );
      if (player) {
        givingPlayers.push(player);
      } else {
        throw new Error(`Player "${playerName}" not found`);
      }
    }
    
    // Find players being received
    const receivingPlayers: Player[] = [];
    for (const playerName of receiving) {
      const player = allPlayers.find(p => 
        p.fullName.toLowerCase().includes(playerName.toLowerCase()) ||
        p.lastName.toLowerCase().includes(playerName.toLowerCase())
      );
      if (player) {
        receivingPlayers.push(player);
      } else {
        throw new Error(`Player "${playerName}" not found`);
      }
    }
    
    // Calculate trade values
    const givingValue = givingPlayers.reduce((sum, p) => {
      let value = (p.projectedPoints || 0) * 2; // Base value
      if (p.percentOwned && p.percentOwned > 80) value *= 1.2; // Premium for elite players
      if (p.injuryStatus && p.injuryStatus !== 'ACTIVE') value *= 0.7; // Discount for injuries
      return sum + value;
    }, 0);
    
    const receivingValue = receivingPlayers.reduce((sum, p) => {
      let value = (p.projectedPoints || 0) * 2;
      if (p.percentOwned && p.percentOwned > 80) value *= 1.2;
      if (p.injuryStatus && p.injuryStatus !== 'ACTIVE') value *= 0.7;
      return sum + value;
    }, 0);
    
    const valueDiff = receivingValue - givingValue;
    const fairnessRating = Math.max(0, Math.min(100, 50 + (valueDiff * 2)));
    
    // Determine recommendation
    let recommendation: 'accept' | 'reject' | 'counter';
    let reasoning = '';
    
    if (valueDiff > 10) {
      recommendation = 'accept';
      reasoning = 'Trade heavily favors you';
    } else if (valueDiff > 0) {
      recommendation = 'accept';
      reasoning = 'Slight value gain in your favor';
    } else if (valueDiff > -5) {
      recommendation = 'counter';
      reasoning = 'Close to fair value, but you could get more';
    } else {
      recommendation = 'reject';
      reasoning = 'Trade favors the other team';
    }
    
    // Analyze positional impact
    const givingPositions = givingPlayers.map(p => p.position);
    const receivingPositions = receivingPlayers.map(p => p.position);
    
    let immediateImpact = '';
    let restOfSeasonImpact = '';
    
    // Check if trading away key positions
    if (givingPositions.includes('RB') && !receivingPositions.includes('RB')) {
      immediateImpact = 'Losing RB depth could hurt immediately';
    } else if (receivingPositions.includes('RB') && !givingPositions.includes('RB')) {
      immediateImpact = 'Gaining RB help addresses key need';
    } else {
      immediateImpact = 'Balanced positional exchange';
    }
    
    // Rest of season projection
    const givingRestOfSeason = givingPlayers.reduce((sum, p) => sum + ((p.projectedPoints || 0) * 10), 0);
    const receivingRestOfSeason = receivingPlayers.reduce((sum, p) => sum + ((p.projectedPoints || 0) * 10), 0);
    
    if (receivingRestOfSeason > givingRestOfSeason * 1.1) {
      restOfSeasonImpact = 'Significant upgrade for playoff push';
    } else if (receivingRestOfSeason > givingRestOfSeason) {
      restOfSeasonImpact = 'Modest improvement long-term';
    } else {
      restOfSeasonImpact = 'Potential downgrade in total points';
    }
    
    // Add detailed reasoning
    const detailedReasoning = [
      reasoning,
      `Value difference: ${valueDiff > 0 ? '+' : ''}${valueDiff.toFixed(1)} points`,
      `Giving: ${givingPlayers.map(p => `${p.fullName} (${p.projectedPoints})`).join(', ')}`,
      `Getting: ${receivingPlayers.map(p => `${p.fullName} (${p.projectedPoints})`).join(', ')}`
    ].join('. ');
    
    return {
      tradeScore: Math.round(valueDiff),
      recommendation,
      reasoning: detailedReasoning,
      fairnessRating: Math.round(fairnessRating),
      impact: {
        immediate: immediateImpact,
        restOfSeason: restOfSeasonImpact
      }
    };
  } catch (error: any) {
    throw new Error(`Failed to analyze trade: ${error.message}`);
  }
}

export async function findTradeTargetsTool(args: {
  leagueId: string;
  teamId: string;
  targetPosition?: string;
}): Promise<{
  suggestions: Array<{
    targetPlayer: Player;
    suggestedOffer: Player[];
    reasoning: string;
  }>;
}> {
  const { leagueId, teamId, targetPosition } = args;
  
  if (!leagueId || !teamId) {
    throw new Error('League ID and Team ID are required');
  }
  
  try {
    const roster = await espnApi.getTeamRoster(leagueId, teamId);
    const allPlayers = await espnApi.getPlayers(leagueId);
    
    // Identify surplus positions (where we have depth)
    const positionCounts: { [key: string]: number } = {};
    [...roster.starters, ...roster.bench].forEach(player => {
      positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
    });
    
    const surplusPositions = Object.entries(positionCounts)
      .filter(([pos, count]) => count > 3)
      .map(([pos]) => pos);
    
    // Find trade targets (high-value players we could target)
    let targets = allPlayers.filter(p => {
      if (targetPosition && p.position !== targetPosition) return false;
      if ((p.percentOwned || 0) < 70) return false; // Focus on rostered players
      if ((p.projectedPoints || 0) < 8) return false; // Minimum value threshold
      return true;
    });
    
    // Create trade suggestions
    const suggestions = targets
      .slice(0, 5)
      .map(targetPlayer => {
        // Find players from surplus positions to offer
        const offerCandidates = [...roster.starters, ...roster.bench]
          .filter(p => surplusPositions.includes(p.position))
          .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0));
        
        // Try to match value
        const targetValue = (targetPlayer.projectedPoints || 0) * 2;
        const suggestedOffer: Player[] = [];
        let offerValue = 0;
        
        for (const candidate of offerCandidates) {
          if (offerValue < targetValue * 0.9) {
            suggestedOffer.push(candidate);
            offerValue += (candidate.projectedPoints || 0) * 2;
          }
          if (offerValue >= targetValue * 0.9 && offerValue <= targetValue * 1.2) {
            break;
          }
        }
        
        const reasoning = `Target ${targetPlayer.fullName} (${targetPlayer.position}) ` +
          `by offering surplus at ${suggestedOffer[0]?.position || 'position'}`;
        
        return {
          targetPlayer,
          suggestedOffer,
          reasoning
        };
      })
      .filter(s => s.suggestedOffer.length > 0);
    
    return { suggestions };
  } catch (error: any) {
    throw new Error(`Failed to find trade targets: ${error.message}`);
  }
}