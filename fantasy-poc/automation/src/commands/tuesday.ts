import { 
  executeAIWorkflow,
  runABTest,
  coordinateWaiverClaims,
  getABTestResults,
  getCostAnalysis
} from '@fantasy-ai/shared';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { getCurrentWeek } from '../utils/environment.js';

export interface TuesdayOptions {
  week?: number;
}

export interface TuesdayResult {
  recommendations: Array<{
    player: string;
    action: 'claim' | 'drop' | 'monitor';
    faabBid: number;
    priority: number;
    reasoning: string;
  }>;
  coordination: {
    strategy: string;
    conflictsResolved: number;
    totalBudgetAllocated: number;
  };
}

export async function executeTuesdayWaivers(options: TuesdayOptions): Promise<TuesdayResult> {
  const week = options.week || getCurrentWeek();
  
  const leagues = [
    {
      leagueId: process.env.LEAGUE_1_ID || process.env.LEAGUE_ID_1,
      teamId: process.env.LEAGUE_1_TEAM_ID || process.env.TEAM_ID_1,
      name: process.env.LEAGUE_1_NAME || 'League 1',
      faabBudget: 100 // Default FAAB budget
    },
    {
      leagueId: process.env.LEAGUE_2_ID || process.env.LEAGUE_ID_2,
      teamId: process.env.LEAGUE_2_TEAM_ID || process.env.TEAM_ID_2,
      name: process.env.LEAGUE_2_NAME || 'League 2',
      faabBudget: 100
    }
  ].filter(league => league.leagueId && league.teamId);
  
  console.log(`🎯 Tuesday waiver analysis for ${leagues.length} league(s) - Week ${week}`);
  
  // Step 1: Run A/B test for waiver strategy
  console.log('🧪 Running A/B test for waiver strategy...');
  let abWaiverResults;
  try {
    abWaiverResults = await runABTest({
      operation: 'waiver_analysis',
      leagueId: leagues[0].leagueId!,
      teamId: leagues[0].teamId!,
      week,
      testName: 'Tuesday Waiver AI vs Basic'
    });
    console.log('✅ Waiver A/B test completed');
  } catch (error: any) {
    console.warn('⚠️ Waiver A/B test failed:', error.message);
  }
  
  // Step 2: Coordinate waiver claims across leagues
  console.log('🔄 Coordinating waiver claims across leagues...');
  let coordinatedWaivers;
  try {
    coordinatedWaivers = await coordinateWaiverClaims({
      leagues: leagues.map(league => ({
        leagueId: league.leagueId!,
        teamId: league.teamId!,
        faabBudget: league.faabBudget
      })),
      maxTargets: 5
    });
    console.log('✅ Waiver coordination completed');
  } catch (error: any) {
    console.warn('⚠️ Waiver coordination failed:', error.message);
  }
  
  // Step 3: Execute enhanced AI workflow for waiver analysis
  console.log('🤖 Executing AI-powered waiver analysis...');
  
  // Load previous analysis for context
  let mondayAnalysis;
  let crossLeagueContext;
  if (existsSync('monday_results.json')) {
    try {
      mondayAnalysis = JSON.parse(readFileSync('monday_results.json', 'utf8'));
      console.log('📋 Loaded Monday analysis for context');
    } catch (error) {
      console.warn('⚠️ Could not load Monday analysis');
    }
  }
  
  const aiResult = await executeAIWorkflow({
    task: 'tuesday_waivers',
    leagues: leagues.map(league => ({
      leagueId: league.leagueId!,
      teamId: league.teamId!,
      name: league.name
    })),
    week,
    prompt: `Execute intelligent Tuesday waiver analysis with cross-league coordination. 
             Apply learned patterns from historical waiver success, integrate Monday analysis insights, 
             identify value plays from dropped players, optimize FAAB allocation across leagues, and 
             prepare streaming strategies for upcoming week. Focus on evidence-based decisions with 
             calculated risk assessment.`,
    context: mondayAnalysis ? { 
      mondayAnalysis: 'monday_results.json',
      crossLeagueAnalysis: mondayAnalysis.crossLeagueAnalysis
    } : undefined
  });
  
  // Step 4: Get A/B test results summary
  console.log('📊 Analyzing A/B test results...');
  let abTestSummary;
  try {
    abTestSummary = await getABTestResults({
      includeRecommendations: true
    });
    console.log('✅ A/B test summary generated');
  } catch (error: any) {
    console.warn('⚠️ A/B test summary failed:', error.message);
  }
  
  // Step 5: Final cost analysis for the week
  console.log('💰 Final cost analysis for the week...');
  const finalCostAnalysis = await getCostAnalysis({
    detailed: true
  });
  
  // Extract recommendations and coordination info
  const recommendations = aiResult.recommendations?.flatMap((rec: any) => 
    rec.waiverClaims?.map((claim: any) => ({
      player: claim.player?.fullName || claim.player || claim.name || 'Unknown',
      action: claim.action || 'claim',
      faabBid: claim.faabBid || claim.bidAmount || 0,
      priority: claim.priority || 1,
      reasoning: claim.reasoning || claim.reason || 'Waiver wire target'
    })) || []
  ) || [];
  
  // Extract coordination strategy
  const coordination = {
    strategy: coordinatedWaivers?.strategy || 'balanced',
    conflictsResolved: coordinatedWaivers?.conflictsResolved || 0,
    totalBudgetAllocated: coordinatedWaivers?.totalBudgetAllocated || 
      recommendations.reduce((sum: number, rec: any) => sum + rec.faabBid, 0)
  };
  
  // Save comprehensive results
  const results = {
    week,
    recommendations,
    coordination,
    abWaiverResults,
    coordinatedWaivers,
    abTestSummary,
    finalCostAnalysis,
    aiWorkflowResult: aiResult,
    timestamp: new Date().toISOString()
  };
  
  writeFileSync('tuesday_results.json', JSON.stringify(results, null, 2));
  
  return {
    recommendations,
    coordination
  };
}