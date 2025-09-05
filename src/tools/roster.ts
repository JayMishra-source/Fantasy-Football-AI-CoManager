import { espnApi } from '../services/espnApi.js';
import { TeamRoster, Player } from '../types/espn.js';

export interface RosterAnalysis {
  roster: TeamRoster;
  analysis: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
  statistics: {
    totalProjectedPoints: number;
    averageProjectedPoints: number;
    injuredPlayers: number;
    byeWeekPlayers: number;
  };
}

export async function getRosterTool(args: { leagueId: string; teamId: string }): Promise<TeamRoster> {
  const { leagueId, teamId } = args;
  
  if (!leagueId || !teamId) {
    throw new Error('League ID and Team ID are required');
  }
  
  try {
    const roster = await espnApi.getTeamRoster(leagueId, teamId);
    return roster;
  } catch (error: any) {
    throw new Error(`Failed to fetch roster: ${error.message}`);
  }
}

export async function analyzeRosterTool(args: { leagueId: string; teamId: string }): Promise<RosterAnalysis> {
  const { leagueId, teamId } = args;
  
  if (!leagueId || !teamId) {
    throw new Error('League ID and Team ID are required');
  }
  
  try {
    const roster = await espnApi.getTeamRoster(leagueId, teamId);
    
    // Analyze roster composition
    const positionCounts: { [key: string]: number } = {};
    const injuredPlayers: Player[] = [];
    let totalProjected = 0;
    
    [...roster.starters, ...roster.bench].forEach(player => {
      positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
      if (player.injuryStatus && player.injuryStatus !== 'ACTIVE') {
        injuredPlayers.push(player);
      }
      totalProjected += player.projectedPoints || 0;
    });
    
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];
    
    // Analyze position depth
    if ((positionCounts['RB'] || 0) >= 5) {
      strengths.push('Strong RB depth');
    } else if ((positionCounts['RB'] || 0) < 3) {
      weaknesses.push('Thin at RB position');
      recommendations.push('Consider trading for or claiming RB depth');
    }
    
    if ((positionCounts['WR'] || 0) >= 5) {
      strengths.push('Good WR depth');
    } else if ((positionCounts['WR'] || 0) < 4) {
      weaknesses.push('Need more WR depth');
      recommendations.push('Target WR on waiver wire');
    }
    
    if (injuredPlayers.length > 2) {
      weaknesses.push(`${injuredPlayers.length} players injured`);
      recommendations.push('Monitor injury reports closely and have backup plans');
    }
    
    // Check for handcuffs and bye week issues
    const startersProjected = roster.starters.reduce((sum, p) => sum + (p.projectedPoints || 0), 0);
    if (startersProjected < totalProjected * 0.6) {
      recommendations.push('Consider adjusting your starting lineup for better projected output');
    }
    
    return {
      roster,
      analysis: {
        strengths,
        weaknesses,
        recommendations
      },
      statistics: {
        totalProjectedPoints: totalProjected,
        averageProjectedPoints: totalProjected / (roster.starters.length + roster.bench.length),
        injuredPlayers: injuredPlayers.length,
        byeWeekPlayers: 0 // Would need schedule data to calculate
      }
    };
  } catch (error: any) {
    throw new Error(`Failed to analyze roster: ${error.message}`);
  }
}