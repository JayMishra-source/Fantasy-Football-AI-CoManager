import { executeAIWorkflow } from '@fantasy-ai/shared';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { getCurrentWeek } from '../utils/environment.js';

export interface SundayOptions {
  week?: number;
}

export interface SundayResult {
  changes: Array<{
    league: string;
    player: string;
    action: string;
    reason: string;
  }>;
  recommendations: string[];
}

export async function executeSundayCheck(options: SundayOptions): Promise<SundayResult> {
  const week = options.week || getCurrentWeek();
  
  // Get league configuration
  const leagues = [
    {
      leagueId: process.env.LEAGUE_1_ID || process.env.LEAGUE_ID_1,
      teamId: process.env.LEAGUE_1_TEAM_ID || process.env.TEAM_ID_1,
      name: process.env.LEAGUE_1_NAME || 'League 1'
    },
    {
      leagueId: process.env.LEAGUE_2_ID || process.env.LEAGUE_ID_2,
      teamId: process.env.LEAGUE_2_TEAM_ID || process.env.TEAM_ID_2,
      name: process.env.LEAGUE_2_NAME || 'League 2'
    }
  ].filter(league => league.leagueId && league.teamId);
  
  console.log(`🔍 Sunday final check for ${leagues.length} league(s) - Week ${week}`);
  
  // Load Thursday analysis for context if available
  let previousAnalysis;
  if (existsSync('thursday_results.json')) {
    try {
      previousAnalysis = JSON.parse(readFileSync('thursday_results.json', 'utf8'));
      console.log('📋 Loaded Thursday analysis for context');
    } catch (error) {
      console.warn('⚠️ Could not load Thursday analysis');
    }
  }
  
  // Execute AI workflow for Sunday final adjustments
  const aiResult = await executeAIWorkflow({
    task: 'sunday_check',
    leagues: leagues.map(league => ({
      leagueId: league.leagueId!,
      teamId: league.teamId!,
      name: league.name
    })),
    week,
    prompt: `Perform final lineup review before games start. Focus on late-breaking injury news, 
             inactive lists, weather updates, and last-minute pivots. Compare with Thursday 
             recommendations and make only high-confidence changes.`,
    context: previousAnalysis ? { previousAnalysis: 'thursday_results.json' } : undefined
  });
  
  // Extract changes and recommendations
  const changes = aiResult.recommendations?.flatMap((rec: any, index: number) => 
    rec.changes?.map((change: any) => ({
      league: leagues[index]?.name || `League ${index + 1}`,
      player: change.player?.fullName || change.player || 'Unknown',
      action: change.action || 'adjust',
      reason: change.reason || change.reasoning || 'Sunday adjustment'
    })) || []
  ) || [];
  
  const recommendations = aiResult.summary?.keyInsights || [
    'Sunday final check completed',
    'No critical changes needed',
    'Lineup appears optimal for game start'
  ];
  
  // Save results
  const results = {
    week,
    changes,
    recommendations,
    aiWorkflowResult: aiResult,
    timestamp: new Date().toISOString()
  };
  
  writeFileSync('sunday_results.json', JSON.stringify(results, null, 2));
  
  return {
    changes,
    recommendations
  };
}