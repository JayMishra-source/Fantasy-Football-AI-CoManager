import { espnApi } from '../services/espnApi.js';
import { Player } from '../types/espn.js';
import { optimizeLineupTool } from './lineup.js';
import { findWaiverTargetsTool } from './waiver.js';
import { getFantasyProsRankings } from './enhancedDraft.js';

export interface CrossLeagueAnalysis {
  leagues: LeagueAnalysis[];
  crossLeagueInsights: {
    sharedPlayers: SharedPlayerAnalysis[];
    strategicOpportunities: string[];
    riskMitigation: string[];
    coordinatedRecommendations: string[];
  };
  overallStrategy: {
    primaryFocus: string;
    secondaryFocus: string;
    riskLevel: 'conservative' | 'balanced' | 'aggressive';
    confidenceScore: number;
  };
}

export interface LeagueAnalysis {
  leagueId: string;
  teamId: string;
  leagueName?: string;
  teamName?: string;
  roster: {
    starters: Player[];
    bench: Player[];
    strengths: string[];
    weaknesses: string[];
  };
  recommendations: {
    lineupChanges: any;
    waiverTargets: any;
    tradeNeeds: string[];
  };
  leagueContext: {
    competitiveness: 'high' | 'medium' | 'low';
    availableValue: 'high' | 'medium' | 'low';
    urgency: 'high' | 'medium' | 'low';
  };
}

export interface SharedPlayerAnalysis {
  playerName: string;
  position: string;
  leagues: Array<{
    leagueId: string;
    ownership: 'owned' | 'available' | 'other_team';
    priority: number;
    reasoning: string;
  }>;
  crossLeagueStrategy: string;
  conflictResolution?: string;
}

export async function analyzeCrossLeagueStrategy(args: {
  leagues: Array<{
    leagueId: string;
    teamId: string;
    leagueName?: string;
  }>;
  week?: number;
  strategy?: 'conservative' | 'balanced' | 'aggressive';
}): Promise<CrossLeagueAnalysis> {
  const { leagues, week = 1, strategy = 'balanced' } = args;

  if (!leagues || leagues.length < 2) {
    throw new Error('At least 2 leagues are required for cross-league analysis');
  }

  try {
    console.log(`🔍 Analyzing cross-league strategy for ${leagues.length} leagues...`);

    // Analyze each league individually
    const leagueAnalyses: LeagueAnalysis[] = [];
    
    for (const league of leagues) {
      console.log(`📊 Analyzing league ${league.leagueId}...`);
      const analysis = await analyzeIndividualLeague(league, week);
      leagueAnalyses.push(analysis);
    }

    // Find shared players and conflicts
    const sharedPlayers = await findSharedPlayerOpportunities(leagueAnalyses);

    // Generate cross-league insights
    const crossLeagueInsights = generateCrossLeagueInsights(leagueAnalyses, sharedPlayers);

    // Determine overall strategy
    const overallStrategy = determineOverallStrategy(leagueAnalyses, strategy);

    return {
      leagues: leagueAnalyses,
      crossLeagueInsights: {
        sharedPlayers,
        ...crossLeagueInsights
      },
      overallStrategy
    };

  } catch (error: any) {
    throw new Error(`Failed to analyze cross-league strategy: ${error.message}`);
  }
}

export async function coordinateWaiverClaims(args: {
  leagues: Array<{
    leagueId: string;
    teamId: string;
    faabBudget?: number;
  }>;
  maxTargets?: number;
}): Promise<{
  coordinatedClaims: Array<{
    leagueId: string;
    playerName: string;
    priority: number;
    suggestedFAAB: number;
    reasoning: string;
    conflicts: string[];
  }>;
  strategy: string;
  totalBudgetAllocation: number;
}> {
  const { leagues, maxTargets = 5 } = args;

  try {
    console.log(`🔄 Coordinating waiver claims across ${leagues.length} leagues...`);

    const allWaiverTargets: any[] = [];

    // Get waiver targets for each league
    for (const league of leagues) {
      const targets = await findWaiverTargetsTool({
        leagueId: league.leagueId,
        teamId: league.teamId,
        maxResults: maxTargets * 2 // Get more to find best cross-league opportunities
      });
      
      targets.targets.forEach(target => {
        allWaiverTargets.push({
          ...target,
          leagueId: league.leagueId,
          teamId: league.teamId,
          faabBudget: league.faabBudget || 100
        });
      });
    }

    // Group by player name to find cross-league opportunities
    const playerGroups = groupTargetsByPlayer(allWaiverTargets);

    // Prioritize and coordinate claims
    const coordinatedClaims = prioritizeCoordinatedClaims(playerGroups, leagues, maxTargets);

    // Calculate strategy and budget allocation
    const totalBudget = coordinatedClaims.reduce((sum, claim) => sum + claim.suggestedFAAB, 0);
    const strategy = generateWaiverStrategy(coordinatedClaims, leagues.length);

    return {
      coordinatedClaims,
      strategy,
      totalBudgetAllocation: totalBudget
    };

  } catch (error: any) {
    throw new Error(`Failed to coordinate waiver claims: ${error.message}`);
  }
}

async function analyzeIndividualLeague(
  league: { leagueId: string; teamId: string; leagueName?: string },
  week: number
): Promise<LeagueAnalysis> {
  try {
    // Get roster
    const roster = await espnApi.getTeamRoster(league.leagueId, league.teamId);
    
    // Get lineup optimization
    const lineupOptimization = await optimizeLineupTool({
      leagueId: league.leagueId,
      teamId: league.teamId,
      week
    });

    // Get waiver targets
    const waiverTargets = await findWaiverTargetsTool({
      leagueId: league.leagueId,
      teamId: league.teamId,
      maxResults: 10
    });

    // Analyze roster strengths and weaknesses
    const strengths = analyzeRosterStrengths(roster.starters, roster.bench);
    const weaknesses = analyzeRosterWeaknesses(roster.starters, roster.bench);

    // Assess league context
    const leagueContext = assessLeagueContext(waiverTargets.targets);

    return {
      leagueId: league.leagueId,
      teamId: league.teamId,
      leagueName: league.leagueName,
      roster: {
        starters: roster.starters,
        bench: roster.bench,
        strengths,
        weaknesses
      },
      recommendations: {
        lineupChanges: lineupOptimization,
        waiverTargets: waiverTargets,
        tradeNeeds: weaknesses // Simplified - could be more sophisticated
      },
      leagueContext
    };

  } catch (error: any) {
    throw new Error(`Failed to analyze league ${league.leagueId}: ${error.message}`);
  }
}

async function findSharedPlayerOpportunities(
  leagues: LeagueAnalysis[]
): Promise<SharedPlayerAnalysis[]> {
  const sharedPlayers: SharedPlayerAnalysis[] = [];
  const allPlayers = new Map<string, any[]>();

  // Collect all players across leagues
  leagues.forEach(league => {
    [...league.roster.starters, ...league.roster.bench].forEach(player => {
      if (!allPlayers.has(player.fullName)) {
        allPlayers.set(player.fullName, []);
      }
      allPlayers.get(player.fullName)!.push({
        leagueId: league.leagueId,
        ownership: 'owned',
        player
      });
    });

    // Add waiver targets
    league.recommendations.waiverTargets.targets.forEach((target: any) => {
      if (!allPlayers.has(target.player.fullName)) {
        allPlayers.set(target.player.fullName, []);
      }
      allPlayers.get(target.player.fullName)!.push({
        leagueId: league.leagueId,
        ownership: 'available',
        priority: target.priority,
        player: target.player
      });
    });
  });

  // Analyze players that appear in multiple leagues
  for (const [playerName, playerData] of allPlayers) {
    if (playerData.length > 1) {
      const crossLeagueStrategy = generateCrossLeaguePlayerStrategy(playerData);
      
      sharedPlayers.push({
        playerName,
        position: playerData[0].player.position,
        leagues: playerData.map(data => ({
          leagueId: data.leagueId,
          ownership: data.ownership,
          priority: data.priority || 0,
          reasoning: data.ownership === 'owned' ? 'Already on roster' : 
                    data.priority > 5 ? 'High waiver priority' : 'Available target'
        })),
        crossLeagueStrategy
      });
    }
  }

  return sharedPlayers.sort((a, b) => 
    b.leagues.reduce((sum, l) => sum + l.priority, 0) - 
    a.leagues.reduce((sum, l) => sum + l.priority, 0)
  );
}

function generateCrossLeagueInsights(
  leagues: LeagueAnalysis[],
  sharedPlayers: SharedPlayerAnalysis[]
): {
  strategicOpportunities: string[];
  riskMitigation: string[];
  coordinatedRecommendations: string[];
} {
  const strategicOpportunities: string[] = [];
  const riskMitigation: string[] = [];
  const coordinatedRecommendations: string[] = [];

  // Find strategic opportunities
  const highPriorityShared = sharedPlayers.filter(p => 
    p.leagues.some(l => l.priority > 5)
  );

  if (highPriorityShared.length > 0) {
    strategicOpportunities.push(
      `${highPriorityShared.length} high-value players available across multiple leagues`
    );
  }

  // Risk mitigation
  const ownedInMultiple = sharedPlayers.filter(p => 
    p.leagues.filter(l => l.ownership === 'owned').length > 1
  );

  if (ownedInMultiple.length > 0) {
    riskMitigation.push(
      `Diversification risk: ${ownedInMultiple.length} players owned in multiple leagues`
    );
  }

  // Coordinated recommendations
  leagues.forEach((league, index) => {
    const strengthCount = league.roster.strengths.length;
    const weaknessCount = league.roster.weaknesses.length;
    
    if (weaknessCount > strengthCount) {
      coordinatedRecommendations.push(
        `League ${index + 1}: Focus on addressing weaknesses (${league.roster.weaknesses.join(', ')})`
      );
    } else {
      coordinatedRecommendations.push(
        `League ${index + 1}: Maintain strengths while seeking upside plays`
      );
    }
  });

  return {
    strategicOpportunities,
    riskMitigation,
    coordinatedRecommendations
  };
}

function determineOverallStrategy(
  leagues: LeagueAnalysis[],
  preferredStrategy: 'conservative' | 'balanced' | 'aggressive'
): {
  primaryFocus: string;
  secondaryFocus: string;
  riskLevel: 'conservative' | 'balanced' | 'aggressive';
  confidenceScore: number;
} {
  const highUrgencyLeagues = leagues.filter(l => l.leagueContext.urgency === 'high').length;
  const competitiveLeagues = leagues.filter(l => l.leagueContext.competitiveness === 'high').length;

  let primaryFocus = 'Balanced approach across all leagues';
  let secondaryFocus = 'Monitor for emerging opportunities';
  let riskLevel = preferredStrategy;
  let confidenceScore = 75;

  if (highUrgencyLeagues > leagues.length / 2) {
    primaryFocus = 'Aggressive waiver and trade activity';
    riskLevel = 'aggressive';
    confidenceScore = 85;
  } else if (competitiveLeagues === leagues.length) {
    primaryFocus = 'Conservative optimization with high-confidence moves';
    riskLevel = 'conservative';
    confidenceScore = 90;
  }

  if (leagues.length > 2) {
    secondaryFocus = 'Cross-league coordination to minimize correlated risk';
    confidenceScore += 5;
  }

  return {
    primaryFocus,
    secondaryFocus,
    riskLevel,
    confidenceScore: Math.min(100, confidenceScore)
  };
}

// Helper functions
function analyzeRosterStrengths(starters: Player[], bench: Player[]): string[] {
  const strengths: string[] = [];
  const allPlayers = [...starters, ...bench];
  
  const positions = groupPlayersByPosition(allPlayers);
  
  Object.entries(positions).forEach(([pos, players]) => {
    const avgProjection = players.reduce((sum, p) => sum + (p.projectedPoints || 0), 0) / players.length;
    
    if (avgProjection > 12 && pos !== 'K' && pos !== 'DST') {
      strengths.push(`Strong ${pos} depth`);
    }
  });
  
  return strengths;
}

function analyzeRosterWeaknesses(starters: Player[], bench: Player[]): string[] {
  const weaknesses: string[] = [];
  const allPlayers = [...starters, ...bench];
  
  const positions = groupPlayersByPosition(allPlayers);
  
  Object.entries(positions).forEach(([pos, players]) => {
    if (players.length < 2 && pos !== 'QB' && pos !== 'K' && pos !== 'DST') {
      weaknesses.push(`Lack of ${pos} depth`);
    }
    
    const injuredPlayers = players.filter(p => p.injuryStatus && p.injuryStatus !== 'ACTIVE');
    if (injuredPlayers.length > 0) {
      weaknesses.push(`${pos} injury concerns`);
    }
  });
  
  return weaknesses;
}

function groupPlayersByPosition(players: Player[]): { [position: string]: Player[] } {
  return players.reduce((acc, player) => {
    if (!acc[player.position]) acc[player.position] = [];
    acc[player.position].push(player);
    return acc;
  }, {} as { [position: string]: Player[] });
}

function assessLeagueContext(waiverTargets: any[]): {
  competitiveness: 'high' | 'medium' | 'low';
  availableValue: 'high' | 'medium' | 'low';
  urgency: 'high' | 'medium' | 'low';
} {
  const highPriorityTargets = waiverTargets.filter(t => t.priority > 5).length;
  const totalTargets = waiverTargets.length;
  
  return {
    competitiveness: highPriorityTargets > 3 ? 'high' : highPriorityTargets > 1 ? 'medium' : 'low',
    availableValue: totalTargets > 7 ? 'high' : totalTargets > 4 ? 'medium' : 'low',
    urgency: highPriorityTargets > 2 ? 'high' : 'medium'
  };
}

function generateCrossLeaguePlayerStrategy(playerData: any[]): string {
  const ownedCount = playerData.filter(d => d.ownership === 'owned').length;
  const availableCount = playerData.filter(d => d.ownership === 'available').length;
  
  if (ownedCount > 1) {
    return 'Risk mitigation: Consider diversifying away from this player';
  } else if (ownedCount === 1 && availableCount > 0) {
    return 'Opportunity: Already own in one league, available in others';
  } else if (availableCount > 1) {
    return 'Multi-league target: Available across multiple leagues';
  }
  
  return 'Monitor for opportunity';
}

function groupTargetsByPlayer(targets: any[]): Map<string, any[]> {
  const groups = new Map<string, any[]>();
  
  targets.forEach(target => {
    const playerName = target.player.fullName;
    if (!groups.has(playerName)) {
      groups.set(playerName, []);
    }
    groups.get(playerName)!.push(target);
  });
  
  return groups;
}

function prioritizeCoordinatedClaims(
  playerGroups: Map<string, any[]>,
  leagues: Array<{leagueId: string, teamId: string, faabBudget?: number}>,
  maxTargets: number
): Array<{
  leagueId: string;
  playerName: string;
  priority: number;
  suggestedFAAB: number;
  reasoning: string;
  conflicts: string[];
}> {
  const coordinatedClaims: any[] = [];
  
  // Sort by cross-league priority
  const sortedPlayers = Array.from(playerGroups.entries()).sort((a, b) => {
    const aPriority = a[1].reduce((sum, target) => sum + target.priority, 0);
    const bPriority = b[1].reduce((sum, target) => sum + target.priority, 0);
    return bPriority - aPriority;
  });
  
  sortedPlayers.slice(0, maxTargets).forEach(([playerName, targets]) => {
    // Choose the league with highest priority for this player
    const bestTarget = targets.sort((a, b) => b.priority - a.priority)[0];
    
    const conflicts = targets.filter(t => t.leagueId !== bestTarget.leagueId)
                            .map(t => `Available in league ${t.leagueId}`);
    
    coordinatedClaims.push({
      leagueId: bestTarget.leagueId,
      playerName,
      priority: bestTarget.priority,
      suggestedFAAB: bestTarget.suggestedFAAB,
      reasoning: `Highest priority in this league among ${targets.length} options`,
      conflicts
    });
  });
  
  return coordinatedClaims;
}

function generateWaiverStrategy(claims: any[], leagueCount: number): string {
  const totalClaims = claims.length;
  const highPriorityClaims = claims.filter(c => c.priority > 5).length;
  
  if (highPriorityClaims > leagueCount) {
    return 'Aggressive: Multiple high-priority targets identified across leagues';
  } else if (totalClaims > leagueCount * 2) {
    return 'Active: Pursuing multiple opportunities with coordinated approach';
  } else {
    return 'Conservative: Focusing on highest-value targets only';
  }
}