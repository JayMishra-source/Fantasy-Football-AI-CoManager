import { executeAIWorkflow } from '@fantasy-ai/shared';
import { writeFileSync } from 'fs';
import { getCurrentWeek } from '../utils/environment.js';

export interface WorkflowOptions {
  task: string;
  week?: number;
  prompt?: string;
}

export async function executeCustomWorkflow(options: WorkflowOptions): Promise<any> {
  const week = options.week || getCurrentWeek();
  
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
  
  console.log(`🔧 Executing custom workflow: ${options.task}`);
  console.log(`📅 Week: ${week}, Leagues: ${leagues.length}`);
  
  const defaultPrompts: { [key: string]: string } = {
    'draft_analysis': 'Analyze draft performance and provide recommendations for future draft strategies',
    'playoff_prep': 'Analyze playoff positioning and recommend strategies for championship run',
    'trade_analysis': 'Evaluate potential trade opportunities and provide recommendations',
    'streaming_strategy': 'Analyze streaming opportunities for QB, TE, K, and DST positions',
    'injury_impact': 'Analyze impact of recent injuries on roster and provide contingency plans'
  };
  
  const prompt = options.prompt || defaultPrompts[options.task] || 
    `Execute ${options.task} analysis with comprehensive data-driven recommendations`;
  
  // Execute the custom AI workflow
  const result = await executeAIWorkflow({
    task: options.task,
    leagues: leagues.map(league => ({
      leagueId: league.leagueId!,
      teamId: league.teamId!,
      name: league.name
    })),
    week,
    prompt
  });
  
  // Save results
  const filename = `${options.task}_results.json`;
  const output = {
    task: options.task,
    week,
    leagues: leagues.map(l => ({ name: l.name, leagueId: l.leagueId })),
    prompt,
    result,
    timestamp: new Date().toISOString()
  };
  
  writeFileSync(filename, JSON.stringify(output, null, 2));
  console.log(`📄 Results saved to ${filename}`);
  
  return result;
}