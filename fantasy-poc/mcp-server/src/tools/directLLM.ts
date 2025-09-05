import { llmManager } from '../services/llm/manager.js';
import { LLMAnalysisRequest } from '../services/llm/types.js';

export async function directLLMAnalysis(args: {
  leagueId: string;
  teamId: string;
  week: number;
  task: string;
  prompt: string;
}): Promise<any> {
  
  const { leagueId, teamId, week, task, prompt } = args;

  // Create a direct request to the LLM manager
  const request: LLMAnalysisRequest = {
    context: {
      week: week,
      day_of_week: task.includes('thursday') ? 'thursday' : 
                   task.includes('sunday') ? 'sunday' : 
                   task.includes('monday') ? 'monday' : 'tuesday',
      action_type: task.includes('lineup') ? 'lineup' : 
                   task.includes('waiver') ? 'waivers' : 'analysis',
      priority: 'high'
    },
    data: {
      league_info: [{
        leagueId,
        teamId,
        prompt
      }]
    },
    user_preferences: {
      risk_tolerance: 'balanced',
      focus_areas: ['injuries', 'matchups', 'projections'],
      notification_style: 'comprehensive'
    }
  };

  // Call the LLM manager directly
  try {
    console.log(`🤖 Direct LLM Analysis: ${task} for Week ${week}`);
    const result = await llmManager.analyzeFantasyData(request);
    console.log(`✅ Direct LLM completed successfully`);
    return result;
  } catch (error: any) {
    console.error(`❌ Direct LLM failed:`, error.message);
    throw error;
  }
}