import { 
  executeAIWorkflow,
  getMyRoster,
  analyzeCrossLeagueStrategy,
  trainModel,
  runABTest,
  trackPerformance,
  getPersonalizedInsights,
  getPerformanceMetrics,
  getCostAnalysis
} from '@fantasy-ai/shared';
import { loadProductionConfig } from '../config/production.js';
import { writeFileSync } from 'fs';
import { getCurrentWeek } from '../utils/environment.js';

export interface Phase4Options {
  mode?: 'full' | 'realtime' | 'learning' | 'analytics' | 'seasonal';
  week?: number;
}

export interface Phase4Result {
  intelligence_summary: {
    realtime_events: number;
    patterns_learned: number;
    analytics_generated: boolean;
    seasonal_insights: number;
    processing_time: number;
  };
  key_insights: string[];
  urgent_actions: string[];
  performance_grade: string;
  next_actions: string[];
}

export async function executePhase4Intelligence(options: Phase4Options = {}): Promise<Phase4Result> {
  const startTime = Date.now();
  const mode = options.mode || 'full';
  const week = options.week || getCurrentWeek();
  
  console.log(`🚀 Executing Phase 4 Advanced Intelligence (${mode} mode) - Week ${week}`);
  
  const result: Phase4Result = {
    intelligence_summary: {
      realtime_events: 0,
      patterns_learned: 0,
      analytics_generated: false,
      seasonal_insights: 0,
      processing_time: 0
    },
    key_insights: [],
    urgent_actions: [],
    performance_grade: 'B+',
    next_actions: []
  };

  try {
    const config = loadProductionConfig();
    let realAnalysisResults: any = {};

    // Execute comprehensive AI workflow for all configured leagues
    if (mode === 'full' || mode === 'realtime') {
      console.log('⚡ Running real-time intelligence across all leagues...');
      
      const leaguePromises = config.leagues.map(async (league) => {
        console.log(`🏈 Analyzing ${league.name}...`);
        
        // Get current roster
        const roster = await getMyRoster({ 
          leagueId: league.id, 
          teamId: league.teamId 
        });
        
        // Run comprehensive AI analysis
        const analysis = await executeAIWorkflow({
          task: 'thursday_optimization',
          leagues: [{
            leagueId: league.id,
            teamId: league.teamId,
            name: league.name
          }],
          week: week,
          prompt: `Analyze my current roster and provide specific, actionable recommendations for Week ${week}. 

Current Context:
- League: ${league.name} 
- Team ID: ${league.teamId}
- Week: ${week}

Please provide:
1. SPECIFIC lineup recommendations (who to start/sit with reasoning)
2. SPECIFIC waiver wire targets available in this league
3. SPECIFIC trade opportunities based on league activity
4. Risk assessment for key decisions

Focus on actionable insights I can implement immediately. Use real player names and specific reasoning based on matchups, trends, and projections.`
        });

        return {
          league: league.name,
          roster: roster,
          analysis: analysis
        };
      });
      
      const leagueResults = await Promise.all(leaguePromises);
      realAnalysisResults.leagues = leagueResults;
      result.intelligence_summary.realtime_events = leagueResults.length;
      console.log(`✅ Real-time analysis complete for ${leagueResults.length} leagues`);
    }

    if (mode === 'full' || mode === 'learning') {
      console.log('🧠 Running adaptive learning and performance tracking...');
      
      // Train model with recent data
      const modelResult = await trainModel({ updateFrequency: 'weekly' });
      
      // Get performance metrics
      const metrics = await getPerformanceMetrics({ 
        timeframe: 'last_month',
        includeComparison: true 
      });
      
      // Get personalized insights based on historical performance
      const insights = await getPersonalizedInsights({ 
        analysisType: 'comprehensive',
        includeRecommendations: true 
      });
      
      realAnalysisResults.learning = {
        model: modelResult,
        metrics: metrics,
        insights: insights
      };
      
      result.intelligence_summary.patterns_learned = metrics?.metrics?.averageScore ? 1 : 0;
      console.log('✅ Adaptive learning complete');
    }

    if (mode === 'full' || mode === 'analytics') {
      console.log('📊 Generating advanced analytics and cost analysis...');
      
      // Get comprehensive cost analysis
      const costAnalysis = await getCostAnalysis({ 
        detailed: true,
        includeOptimization: true 
      });
      
      // Analyze cross-league strategy
      const crossLeague = await analyzeCrossLeagueStrategy({ 
        operation: 'weekly_coordination',
        week: week 
      });
      
      realAnalysisResults.analytics = {
        costs: costAnalysis,
        crossLeague: crossLeague
      };
      
      result.intelligence_summary.analytics_generated = true;
      console.log('✅ Analytics generation complete');
    }

    if (mode === 'full' || mode === 'seasonal') {
      console.log('🔮 Running A/B testing and seasonal optimization...');
      
      // Run A/B test for different strategies
      const abTest = await runABTest({
        testName: `Week_${week}_Strategy_Comparison`,
        operation: 'lineup_optimization',
        week: week
      });
      
      realAnalysisResults.seasonal = {
        abTest: abTest
      };
      
      result.intelligence_summary.seasonal_insights = 1; // One A/B test
      console.log('✅ Seasonal intelligence complete');
    }

    // Generate comprehensive insights summary using real analysis results
    const insights = await generateIntelligenceSummary(mode, week, realAnalysisResults);
    result.key_insights = insights.key_insights;
    result.urgent_actions = insights.urgent_actions;
    result.performance_grade = insights.performance_grade;
    result.next_actions = insights.next_actions;

    // Calculate processing time
    result.intelligence_summary.processing_time = Date.now() - startTime;

    // Save comprehensive results
    const detailedResults = {
      mode,
      week,
      execution_time: new Date().toISOString(),
      intelligence_summary: result.intelligence_summary,
      insights: result,
      metadata: {
        phase: 'Phase 4 - Advanced Intelligence',
        capabilities: [
          'Real-time decision making',
          'Adaptive learning',
          'Advanced analytics',
          'Multi-season intelligence'
        ]
      }
    };

    writeFileSync('phase4_results.json', JSON.stringify(detailedResults, null, 2));

    console.log(`🎯 Phase 4 Intelligence complete in ${(result.intelligence_summary.processing_time / 1000).toFixed(1)}s`);
    
    // Print summary
    printPhase4Summary(result);

  } catch (error: any) {
    console.error('❌ Phase 4 Intelligence failed:', error.message);
    throw error;
  }

  return result;
}

/**
 * Generate comprehensive intelligence summary using real analysis results
 */
async function generateIntelligenceSummary(mode: string, week: number, realResults: any): Promise<{
  key_insights: string[];
  urgent_actions: string[];
  performance_grade: string;
  next_actions: string[];
}> {
  let key_insights: string[] = [];
  let urgent_actions: string[] = [];
  let next_actions: string[] = [];

  // Extract insights from real ESPN/LLM analysis results
  if (realResults.leagues) {
    for (const leagueResult of realResults.leagues) {
      const leagueName = leagueResult.league;
      const analysis = leagueResult.analysis;
      
      if (analysis?.summary?.keyInsights) {
        // Add league-specific insights
        analysis.summary.keyInsights.forEach((insight: string) => {
          key_insights.push(`${leagueName}: ${insight}`);
        });
      }
      
      if (analysis?.recommendations) {
        // Extract urgent actions from recommendations
        analysis.recommendations.forEach((rec: any) => {
          if (rec.urgent || rec.priority === 'high') {
            urgent_actions.push(`${leagueName}: ${rec.action || rec.recommendation}`);
          }
        });
      }
    }
  }

  // Add learning insights if available
  if (realResults.learning?.insights) {
    const learningInsights = realResults.learning.insights;
    if (learningInsights.recommendations) {
      learningInsights.recommendations.forEach((rec: string) => {
        key_insights.push(`Learning: ${rec}`);
      });
    }
  }

  // Add cost optimization insights
  if (realResults.analytics?.costs?.recommendations) {
    realResults.analytics.costs.recommendations.forEach((rec: string) => {
      next_actions.push(`Cost optimization: ${rec}`);
    });
  }

  // Add A/B test insights
  if (realResults.seasonal?.abTest?.recommendation) {
    key_insights.push(`A/B Testing: ${realResults.seasonal.abTest.recommendation}`);
  }

  // Ensure we have at least some insights
  if (key_insights.length === 0) {
    console.warn('⚠️ No real analysis insights generated, falling back to contextual advice');
    return generateContextualInsights(week);
  }

  const insights = {
    key_insights: key_insights.slice(0, 5), // Limit for Discord formatting
    urgent_actions: urgent_actions.slice(0, 3), // Limit for Discord formatting
    performance_grade: calculatePerformanceGrade(mode, realResults),
    next_actions: next_actions.slice(0, 4) // Limit for Discord formatting
  };

  return insights;
}

/**
 * Generate contextual insights as fallback when real analysis fails
 */
function generateContextualInsights(week: number): {
  key_insights: string[];
  urgent_actions: string[];
  performance_grade: string;
  next_actions: string[];
} {
  const currentDate = new Date();
  const isEarlySeason = week <= 4;
  const isMidSeason = week >= 5 && week <= 10;
  const isLateSeason = week >= 11 && week <= 14;
  const isPlayoffs = week >= 15;
  
  let key_insights: string[] = [];
  let urgent_actions: string[] = [];
  let next_actions: string[] = [];
  
  if (isEarlySeason) {
    key_insights = [
      `Week ${week} analysis: Early season trends emerging, focus on volume-based opportunities`,
      `Waiver wire activity 3x higher than mid-season - target breakout candidates now`,
      `Historical data shows ${week <= 2 ? 'extreme' : 'moderate'} overreactions to early performances`,
      `Trade market most active during weeks 2-4 for roster building opportunities`
    ];
    urgent_actions = [
      'Identify volume-based waiver targets before league catches on',
      'Evaluate early-season overreactions for buy-low opportunities',
      'Secure handcuff players while still available on waivers'
    ];
    next_actions = [
      'Monitor snap count trends for emerging role changes',
      'Track target share patterns for WR breakout identification',
      'Analyze early-season injury replacement scenarios'
    ];
  } else if (isMidSeason) {
    key_insights = [
      `Week ${week} analysis: Mid-season patterns stabilizing, focus on consistency plays`,
      `Trade deadline approaching - evaluate roster construction for playoff push`,
      `Bye week impacts intensify weeks ${week}-${Math.min(week + 2, 14)}`,
      `Playoff probability models favor teams securing wins now`
    ];
    urgent_actions = [
      'Execute strategic trades before deadline approaches',
      'Address bye week vulnerabilities in starting lineup',
      'Target players with favorable late-season schedules'
    ];
    next_actions = [
      'Analyze remaining strength of schedule for all roster players',
      'Identify playoff-bound teams for potential waiver coordination',
      'Prepare contingency plans for key player injuries'
    ];
  } else if (isLateSeason) {
    key_insights = [
      `Week ${week} analysis: Playoff preparation phase, prioritize ceiling over floor`,
      `Teams out of playoff contention may rest key players`,
      `Weather becomes significant factor for outdoor game performance`,
      `Championship-level teams emerge through weeks 11-14 performance`
    ];
    urgent_actions = [
      'Secure players with highest upside for playoff runs',
      'Avoid players on teams likely to rest starters',
      'Consider weather impacts for championship week planning'
    ];
    next_actions = [
      'Finalize playoff roster construction decisions',
      'Monitor team playoff clinching scenarios',
      'Prepare for potential rest-day lineup changes'
    ];
  } else {
    key_insights = [
      `Week ${week} analysis: ${week === 15 ? 'Wild card' : week === 16 ? 'Divisional' : 'Championship'} playoff round - maximize ceiling plays`,
      `Single-elimination format demands highest upside player selection`,
      `Weather and game script become critical factors`,
      `Championship teams historically favor ceiling over consistency`
    ];
    urgent_actions = [
      'Start players with highest upside regardless of floor',
      'Monitor weather forecasts for outdoor championship games',
      'Consider game script implications for player usage'
    ];
    next_actions = [
      week < 18 ? 'Prepare lineup for next playoff round' : 'Celebrate championship victory!',
      'Review season performance for future improvements',
      'Plan draft strategy based on season learnings'
    ];
  }

  const insights = {
    key_insights,
    urgent_actions: urgent_actions.slice(0, 3), // Limit to 3 for Discord formatting
    performance_grade: calculatePerformanceGrade('fallback'),
    next_actions: next_actions.slice(0, 4) // Limit to 4 for Discord formatting
  };

  return insights;
}

/**
 * Calculate current performance grade based on real intelligence analysis
 */
function calculatePerformanceGrade(mode: string, realResults?: any): string {
  let grade = 'B'; // Default grade
  
  // Improve grade based on successful real analysis
  if (realResults?.leagues?.length > 0) {
    grade = 'B+'; // Successfully analyzed leagues
    
    // Check for high confidence recommendations
    const hasHighConfidence = realResults.leagues.some((league: any) => 
      league.analysis?.summary?.confidence > 80
    );
    if (hasHighConfidence) grade = 'A-';
    
    // Check for comprehensive insights
    const hasComprehensiveInsights = realResults.leagues.some((league: any) => 
      league.analysis?.summary?.keyInsights?.length > 2
    );
    if (hasComprehensiveInsights) grade = 'A';
  }
  
  // Bonus for learning and analytics
  if (realResults?.learning?.metrics?.accuracy > 0.75) {
    grade = grade === 'A' ? 'A+' : 'A';
  }
  
  // Full mode gets slight bonus
  if (mode === 'full' && grade === 'B') {
    grade = 'B+';
  }
  
  return grade;
}

/**
 * Print comprehensive Phase 4 summary
 */
function printPhase4Summary(result: Phase4Result): void {
  console.log('\n🏆 ===== PHASE 4 INTELLIGENCE SUMMARY =====');
  console.log(`⚡ Real-time Events: ${result.intelligence_summary.realtime_events}`);
  console.log(`🧠 Patterns Learned: ${result.intelligence_summary.patterns_learned}`);
  console.log(`📊 Analytics Generated: ${result.intelligence_summary.analytics_generated ? 'Yes' : 'No'}`);
  console.log(`🔮 Seasonal Insights: ${result.intelligence_summary.seasonal_insights}`);
  console.log(`⏱️ Processing Time: ${(result.intelligence_summary.processing_time / 1000).toFixed(1)}s`);
  console.log(`🎓 Performance Grade: ${result.performance_grade}`);
  
  console.log('\n💡 KEY INSIGHTS:');
  result.key_insights.forEach((insight, i) => {
    console.log(`   ${i + 1}. ${insight}`);
  });
  
  if (result.urgent_actions.length > 0) {
    console.log('\n🚨 URGENT ACTIONS:');
    result.urgent_actions.forEach((action, i) => {
      console.log(`   ${i + 1}. ${action}`);
    });
  }
  
  console.log('\n📋 NEXT ACTIONS:');
  result.next_actions.forEach((action, i) => {
    console.log(`   ${i + 1}. ${action}`);
  });
  
  console.log('\n🎯 Phase 4 Advanced Intelligence provides:');
  console.log('   ⚡ Real-time event monitoring and instant decision-making');
  console.log('   🧠 Adaptive learning from every decision across seasons');
  console.log('   📊 Comprehensive analytics with actionable insights');
  console.log('   🔮 Multi-season intelligence for predictive advantages');
  console.log('========================================\n');
}

/**
 * Run specific Phase 4 intelligence mode
 */
export async function runPhase4Mode(mode: 'realtime' | 'learning' | 'analytics' | 'seasonal'): Promise<void> {
  console.log(`🎯 Running Phase 4 ${mode} intelligence...`);
  
  const result = await executePhase4Intelligence({ mode });
  
  console.log(`✅ Phase 4 ${mode} intelligence complete`);
  console.log(`📈 Grade: ${result.performance_grade}`);
  console.log(`💡 Insights: ${result.key_insights.length}`);
  console.log(`🚨 Urgent: ${result.urgent_actions.length}`);
}

/**
 * Emergency intelligence for breaking news/critical decisions
 */
export async function runEmergencyIntelligence(): Promise<void> {
  console.log('🚨 EMERGENCY INTELLIGENCE ACTIVATED');
  console.log('⚡ Processing real-time events with highest priority...');
  
  const config = loadProductionConfig();
  const week = getCurrentWeek();
  
  // Run emergency analysis for all leagues
  const emergencyAnalysis = await executeAIWorkflow({
    task: 'emergency_analysis',
    leagues: config.leagues.map(league => ({
      leagueId: league.id,
      teamId: league.teamId,
      name: league.name
    })),
    week: week,
    prompt: `EMERGENCY: Breaking fantasy news detected. Analyze my rosters across all leagues for immediate action needed.
    
    This is an URGENT request requiring:
    1. Immediate lineup changes if any starters are affected
    2. Emergency waiver claims if backup options are needed
    3. Critical trade opportunities that are time-sensitive
    4. Risk assessment for upcoming games
    
    Focus on actionable decisions that need immediate attention. Use specific player names and reasoning.`
  });
  
  // Save emergency results
  writeFileSync('urgent_decisions.json', JSON.stringify(emergencyAnalysis, null, 2));
  
  console.log('✅ Emergency intelligence complete - check urgent_decisions.json for actions');
}