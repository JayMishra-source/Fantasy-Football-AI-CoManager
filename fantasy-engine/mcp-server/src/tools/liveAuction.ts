import { draftApi } from '../services/draftApi.js';
import { espnApi } from '../services/espnApi.js';
import axios from 'axios';

export interface AuctionRecommendation {
  player: {
    id: string;
    name: string;
    position: string;
    team: string;
    projectedPoints: number;
  };
  recommendedBid: number;
  maxBid: number;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
  positionRank: number;
}

export interface BudgetStrategy {
  remainingBudget: number;
  remainingPositions: string[];
  spendingPlan: {
    position: string;
    recommendedBudget: number;
    reasoning: string;
  }[];
  currentStrategy: string;
}

export async function getAuctionRecommendation(args: {
  leagueId: string;
  teamId: string;
  playerName: string;
  currentBid?: number;
}): Promise<AuctionRecommendation> {
  const { leagueId, teamId, playerName, currentBid = 1 } = args;
  
  if (!leagueId || !teamId || !playerName) {
    throw new Error('League ID, Team ID, and Player Name are required');
  }

  try {
    // Get current roster to understand needs
    const currentRoster = await espnApi.getTeamRoster(leagueId, teamId);
    
    // Get available players to find the one being auctioned
    const availablePlayers = await draftApi.getAvailablePlayers(leagueId);
    
    const player = availablePlayers.find(p => 
      p.fullName.toLowerCase().includes(playerName.toLowerCase()) ||
      p.lastName.toLowerCase().includes(playerName.toLowerCase())
    );
    
    if (!player) {
      throw new Error(`Player "${playerName}" not found in available players`);
    }

    // Analyze team needs
    const rosterPlayers = [...currentRoster.starters, ...currentRoster.bench];
    const positionCounts: { [key: string]: number } = {};
    rosterPlayers.forEach(p => {
      positionCounts[p.position] = (positionCounts[p.position] || 0) + 1;
    });

    // Determine priority based on position need
    let priority: 'high' | 'medium' | 'low' = 'medium';
    if (player.position === 'RB' && (positionCounts['RB'] || 0) < 2) priority = 'high';
    else if (player.position === 'WR' && (positionCounts['WR'] || 0) < 3) priority = 'high';
    else if (player.position === 'QB' && (positionCounts['QB'] || 0) === 0) priority = 'high';
    else if (player.position === 'TE' && (positionCounts['TE'] || 0) === 0) priority = 'medium';
    else priority = 'low';

    // Calculate recommended bid based on projected points and scarcity
    const baseValue = Math.max(1, Math.floor(player.projectedPoints / 10));
    let recommendedBid = baseValue;
    let maxBid = baseValue * 1.5;

    // Adjust for priority
    if (priority === 'high') {
      recommendedBid = Math.floor(baseValue * 1.3);
      maxBid = Math.floor(baseValue * 2);
    } else if (priority === 'low') {
      recommendedBid = Math.max(1, Math.floor(baseValue * 0.7));
      maxBid = Math.floor(baseValue * 1.1);
    }

    // Don't recommend going significantly over current bid
    if (currentBid > recommendedBid * 1.2) {
      recommendedBid = currentBid + 1;
      maxBid = Math.max(maxBid, currentBid + 3);
    }

    // Cap bids reasonably
    recommendedBid = Math.min(recommendedBid, 50);
    maxBid = Math.min(maxBid, 80);

    const reasoning = [
      `${player.projectedPoints} projected points`,
      priority === 'high' ? `Fills ${player.position} need` : 
      priority === 'medium' ? `Good depth at ${player.position}` : 'Luxury pick',
      currentBid > baseValue ? 'Bidding has exceeded value' : 'Good value available'
    ].join('. ');

    return {
      player: {
        id: player.id,
        name: player.fullName,
        position: player.position,
        team: player.team,
        projectedPoints: player.projectedPoints
      },
      recommendedBid,
      maxBid,
      reasoning,
      priority,
      positionRank: 1 // Would need more data to calculate exact rank
    };
  } catch (error: any) {
    throw new Error(`Failed to get auction recommendation: ${error.message}`);
  }
}

export async function getBudgetStrategy(args: {
  leagueId: string;
  teamId: string;
}): Promise<BudgetStrategy> {
  const { leagueId, teamId } = args;
  
  if (!leagueId || !teamId) {
    throw new Error('League ID and Team ID are required');
  }

  try {
    // Get current roster
    const currentRoster = await espnApi.getTeamRoster(leagueId, teamId);
    
    // Analyze current roster
    const rosterPlayers = [...currentRoster.starters, ...currentRoster.bench];
    const positionCounts: { [key: string]: number } = {};
    rosterPlayers.forEach(p => {
      positionCounts[p.position] = (positionCounts[p.position] || 0) + 1;
    });

    // Estimate remaining budget (this would need to be tracked separately in a real auction)
    const estimatedRemainingBudget = 200; // Default auction budget
    
    // Determine remaining needs
    const remainingPositions: string[] = [];
    if ((positionCounts['QB'] || 0) === 0) remainingPositions.push('QB');
    if ((positionCounts['RB'] || 0) < 2) remainingPositions.push('RB');
    if ((positionCounts['WR'] || 0) < 3) remainingPositions.push('WR');
    if ((positionCounts['TE'] || 0) === 0) remainingPositions.push('TE');
    if ((positionCounts['K'] || 0) === 0) remainingPositions.push('K');
    if ((positionCounts['DST'] || 0) === 0) remainingPositions.push('DST');

    // Create spending plan
    const spendingPlan = remainingPositions.map(position => {
      let recommendedBudget = 10;
      let reasoning = '';

      switch (position) {
        case 'RB':
          recommendedBudget = 40;
          reasoning = 'RBs are scarce, invest heavily in top talent';
          break;
        case 'WR':
          recommendedBudget = 25;
          reasoning = 'WR depth is important but more available';
          break;
        case 'QB':
          recommendedBudget = 15;
          reasoning = 'Wait on QB unless elite option available';
          break;
        case 'TE':
          recommendedBudget = 12;
          reasoning = 'Target top 3-4 TEs or wait for value';
          break;
        case 'K':
        case 'DST':
          recommendedBudget = 1;
          reasoning = 'Save money, draft at minimum';
          break;
      }

      return { position, recommendedBudget, reasoning };
    });

    let currentStrategy = '';
    if (remainingPositions.length > 8) {
      currentStrategy = 'Early draft - focus on elite RB/WR talent';
    } else if (remainingPositions.length > 4) {
      currentStrategy = 'Mid-draft - balance needs with value';
    } else {
      currentStrategy = 'Late draft - fill remaining spots cheaply';
    }

    return {
      remainingBudget: estimatedRemainingBudget,
      remainingPositions,
      spendingPlan,
      currentStrategy
    };
  } catch (error: any) {
    throw new Error(`Failed to get budget strategy: ${error.message}`);
  }
}

export async function shouldAutoBid(args: {
  leagueId: string;
  teamId: string;
  playerName: string;
  currentBid: number;
  timeRemaining: number; // seconds
}): Promise<{ shouldBid: boolean; suggestedBid?: number; reasoning: string }> {
  const { leagueId, teamId, playerName, currentBid, timeRemaining } = args;
  
  try {
    const recommendation = await getAuctionRecommendation({
      leagueId,
      teamId, 
      playerName,
      currentBid
    });

    const shouldBid = currentBid < recommendation.maxBid && 
                     (recommendation.priority === 'high' || currentBid <= recommendation.recommendedBid);
    
    let reasoning = '';
    if (!shouldBid) {
      if (currentBid >= recommendation.maxBid) {
        reasoning = `Price too high (${currentBid} vs max ${recommendation.maxBid})`;
      } else {
        reasoning = `Low priority player, not worth bidding at ${currentBid}`;
      }
    } else {
      const suggestedBid = Math.min(
        recommendation.recommendedBid,
        currentBid + 1
      );
      
      if (timeRemaining < 10 && recommendation.priority === 'high') {
        reasoning = `Must-have player, bid ${suggestedBid} quickly!`;
      } else {
        reasoning = `Good value at ${suggestedBid}, ${recommendation.reasoning}`;
      }
      
      return { shouldBid, suggestedBid, reasoning };
    }

    return { shouldBid, reasoning };
  } catch (error: any) {
    return { 
      shouldBid: false, 
      reasoning: `Error analyzing bid: ${error.message}` 
    };
  }
}