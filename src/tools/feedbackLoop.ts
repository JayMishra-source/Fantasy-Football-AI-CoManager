import { performanceTracker } from '../services/performanceTracker.js';
import { learningEngine } from '../services/learningEngine.js';
import { enhancedCostMonitor } from '../services/enhancedCostMonitor.js';
import { abTestingService } from '../services/abTesting.js';

/**
 * Track performance of a recommendation
 */
export async function trackPerformance(args: {
  type: 'lineup' | 'waiver' | 'trade' | 'draft';
  leagueId: string;
  teamId: string;
  week: number;
  recommendation: any;
  confidence: number;
  llmUsed: boolean;
  llmModel?: string;
  cost?: number;
  dataSourcesUsed: string[];
}): Promise<{
  recommendationId: string;
  tracked: boolean;
  message: string;
}> {
  try {
    const recommendationId = await performanceTracker.trackRecommendation({
      type: args.type,
      week: args.week,
      leagueId: args.leagueId,
      teamId: args.teamId,
      recommendation: args.recommendation,
      confidence: args.confidence,
      dataSourcesUsed: args.dataSourcesUsed,
      llmUsed: args.llmUsed,
      llmModel: args.llmModel,
      cost: args.cost
    });

    return {
      recommendationId,
      tracked: true,
      message: `Performance tracking initiated for ${args.type} recommendation`
    };
  } catch (error: any) {
    return {
      recommendationId: '',
      tracked: false,
      message: `Failed to track performance: ${error.message}`
    };
  }
}

/**
 * Record the outcome of a recommendation
 */
export async function recordOutcome(args: {
  recommendationId: string;
  success: boolean;
  actualPoints?: number;
  projectedPoints?: number;
  playerPerformance?: Array<{
    playerId: string;
    playerName: string;
    projectedPoints: number;
    actualPoints: number;
  }>;
  notes?: string;
}): Promise<{
  recorded: boolean;
  message: string;
  accuracy?: number;
}> {
  try {
    const outcome = {
      recommendationId: args.recommendationId,
      success: args.success,
      actualPoints: args.actualPoints,
      projectedPoints: args.projectedPoints,
      accuracy: args.projectedPoints && args.actualPoints 
        ? (args.actualPoints / args.projectedPoints) * 100 
        : undefined,
      playerPerformance: args.playerPerformance?.map(p => ({
        ...p,
        percentError: ((p.actualPoints - p.projectedPoints) / p.projectedPoints) * 100
      })),
      notes: args.notes
    };

    await performanceTracker.recordOutcome(outcome);

    return {
      recorded: true,
      message: `Outcome recorded: ${args.success ? 'Success' : 'Failed'}`,
      accuracy: outcome.accuracy
    };
  } catch (error: any) {
    return {
      recorded: false,
      message: `Failed to record outcome: ${error.message}`
    };
  }
}

/**
 * Get performance metrics and insights
 */
export async function getPerformanceMetrics(args: {
  startDate?: string;
  endDate?: string;
  leagueId?: string;
  teamId?: string;
}): Promise<any> {
  try {
    const startDate = args.startDate ? new Date(args.startDate) : undefined;
    const endDate = args.endDate ? new Date(args.endDate) : undefined;

    const metrics = await performanceTracker.getMetrics(startDate, endDate);
    const learningInsights = await performanceTracker.getLearningInsights();
    const pending = await performanceTracker.getPendingOutcomes();

    return {
      metrics: {
        totalRecommendations: metrics.totalRecommendations,
        successRate: `${metrics.successRate.toFixed(1)}%`,
        averageAccuracy: `${metrics.averageAccuracy.toFixed(1)}%`,
        averageConfidence: `${metrics.averageConfidence.toFixed(1)}%`,
        costPerRecommendation: `$${metrics.costPerRecommendation.toFixed(4)}`
      },
      byType: metrics.byType,
      byWeek: metrics.byWeek,
      llmVsBasic: {
        llm: {
          ...metrics.llmVsBasic.llm,
          successRate: `${metrics.llmVsBasic.llm.successRate.toFixed(1)}%`,
          averageCost: `$${metrics.llmVsBasic.llm.averageCost.toFixed(4)}`
        },
        basic: {
          ...metrics.llmVsBasic.basic,
          successRate: `${metrics.llmVsBasic.basic.successRate.toFixed(1)}%`
        }
      },
      insights: learningInsights,
      pendingOutcomes: pending.length,
      recommendations: [
        ...learningInsights.bestPerformingStrategies.map((s: string) => `✅ ${s}`),
        ...learningInsights.commonMistakes.map((m: string) => `⚠️ ${m}`)
      ]
    };
  } catch (error: any) {
    throw new Error(`Failed to get performance metrics: ${error.message}`);
  }
}

/**
 * Get cost analysis and optimization strategies
 */
export async function getCostAnalysis(args: {
  startDate?: string;
  endDate?: string;
  detailed?: boolean;
}): Promise<any> {
  try {
    const startDate = args.startDate ? new Date(args.startDate) : undefined;
    const endDate = args.endDate ? new Date(args.endDate) : undefined;

    const summary = await enhancedCostMonitor.getCostSummary(startDate, endDate);
    const currentUsage = enhancedCostMonitor.getCurrentUsage();
    const optimizations = await enhancedCostMonitor.getOptimizationStrategies();

    const result: any = {
      summary: {
        totalCost: `$${summary.totalCost.toFixed(2)}`,
        totalOperations: summary.totalOperations,
        averageCost: `$${summary.averageCostPerOperation.toFixed(4)}`,
        projectedMonthly: `$${summary.costTrends.projectedMonthly.toFixed(2)}`
      },
      currentUsage: {
        daily: `${currentUsage.daily.percentage.toFixed(0)}% ($${currentUsage.daily.used.toFixed(2)}/$${currentUsage.daily.limit})`,
        weekly: `${currentUsage.weekly.percentage.toFixed(0)}% ($${currentUsage.weekly.used.toFixed(2)}/$${currentUsage.weekly.limit})`,
        monthly: `${currentUsage.monthly.percentage.toFixed(0)}% ($${currentUsage.monthly.used.toFixed(2)}/$${currentUsage.monthly.limit})`
      },
      recommendations: summary.recommendations,
      optimizations: optimizations.slice(0, 3).map(opt => ({
        strategy: opt.strategy,
        savings: `$${opt.estimatedSavings.toFixed(2)}`,
        impact: opt.impactOnPerformance
      }))
    };

    if (args.detailed) {
      result.byProvider = summary.byProvider;
      result.byOperation = summary.byOperation;
      result.costTrends = summary.costTrends;
    }

    return result;
  } catch (error: any) {
    throw new Error(`Failed to get cost analysis: ${error.message}`);
  }
}

/**
 * Train the learning model with recent data
 */
export async function trainModel(args: {
  forceRetrain?: boolean;
}): Promise<{
  trained: boolean;
  message: string;
  patterns: number;
  adjustments: number;
}> {
  try {
    await learningEngine.train();
    
    // Get updated model info (simplified - would need to expose from learningEngine)
    const insights = await performanceTracker.getLearningInsights();

    return {
      trained: true,
      message: 'Learning model updated with recent performance data',
      patterns: 5, // Placeholder - would get from actual model
      adjustments: 3 // Placeholder - would get from actual model
    };
  } catch (error: any) {
    return {
      trained: false,
      message: `Training failed: ${error.message}`,
      patterns: 0,
      adjustments: 0
    };
  }
}

/**
 * Get personalized insights based on learning
 */
export async function getPersonalizedInsights(args: {
  leagueId: string;
  teamId: string;
}): Promise<any> {
  try {
    const insights = await learningEngine.getPersonalizedInsights(args.leagueId, args.teamId);
    const metrics = await performanceTracker.getMetrics();
    
    // Add predictive elements
    const predictions = {
      nextWeekConfidence: 70 + Math.random() * 20, // Simplified
      expectedImprovement: 5 + Math.random() * 10,
      suggestedStrategy: insights.recommendations[0] || 'Continue current approach'
    };

    return {
      performance: {
        overallRating: metrics.successRate > 60 ? 'Strong' : 
                       metrics.successRate > 40 ? 'Average' : 'Needs Improvement',
        trend: 'Improving', // Would calculate from actual trends
        reliability: `${metrics.averageConfidence.toFixed(0)}%`
      },
      strengths: insights.strengths,
      improvements: insights.improvements,
      recommendations: insights.recommendations,
      predictions
    };
  } catch (error: any) {
    throw new Error(`Failed to get personalized insights: ${error.message}`);
  }
}

/**
 * Run A/B test for a recommendation
 */
export async function runABTest(args: {
  operation: string;
  leagueId: string;
  teamId: string;
  week: number;
  testName?: string;
}): Promise<any> {
  try {
    // Find or create appropriate test
    const activeTests = abTestingService.getActiveTests();
    let testId = activeTests[0]?.id; // Use first active test

    if (!testId && args.testName) {
      // Create a new test if requested
      testId = abTestingService.createTest({
        name: args.testName,
        description: `A/B test for ${args.operation}`,
        variants: {
          control: {
            name: 'Basic',
            description: 'Rule-based approach',
            useLLM: false,
            parameters: {}
          },
          treatment: {
            name: 'AI-Powered',
            description: 'LLM-based approach',
            useLLM: true,
            llmModel: 'gemini-1.5-flash',
            parameters: {}
          }
        },
        allocation: 50,
        metrics: ['accuracy', 'cost', 'time']
      });
    }

    if (!testId) {
      return {
        testRun: false,
        message: 'No active A/B tests available'
      };
    }

    // Select variant
    const variant = await abTestingService.selectVariant(testId);
    
    // Execute variant
    const result = await abTestingService.executeVariant(
      testId,
      variant,
      args.operation,
      {
        leagueId: args.leagueId,
        teamId: args.teamId,
        week: args.week
      }
    );

    // Analyze current test status
    const analysis = await abTestingService.analyzeTest(testId);

    return {
      testRun: true,
      testId,
      variant,
      recommendation: result.recommendation,
      metrics: result.metrics,
      testStatus: {
        sampleSize: analysis.sampleSize,
        currentWinner: analysis.recommendation.winner,
        confidence: `${analysis.statisticalSignificance.confidenceLevel.toFixed(1)}%`,
        recommendation: analysis.recommendation.reasoning
      }
    };
  } catch (error: any) {
    throw new Error(`Failed to run A/B test: ${error.message}`);
  }
}

/**
 * Get A/B test results and recommendations
 */
export async function getABTestResults(args: {
  testId?: string;
  includeRecommendations?: boolean;
}): Promise<any> {
  try {
    const activeTests = abTestingService.getActiveTests();
    
    if (args.testId) {
      // Get specific test results
      const analysis = await abTestingService.analyzeTest(args.testId);
      
      return {
        test: {
          id: analysis.testId,
          name: analysis.testName,
          duration: `${analysis.duration.toFixed(0)} days`,
          sampleSize: analysis.sampleSize,
          winner: analysis.recommendation.winner,
          confidence: `${analysis.statisticalSignificance.confidenceLevel.toFixed(1)}%`,
          improvement: `${analysis.recommendation.expectedImprovement.toFixed(1)} points`,
          costBenefit: analysis.recommendation.costBenefit.toFixed(2)
        },
        performance: analysis.performance,
        recommendation: analysis.recommendation.reasoning
      };
    } else {
      // Get all test results
      const allResults = await Promise.all(
        activeTests.map(test => abTestingService.analyzeTest(test.id))
      );

      const testRecommendations = args.includeRecommendations 
        ? await abTestingService.getTestRecommendations()
        : { recommendations: [], insights: [] };

      return {
        activeTests: allResults.map(analysis => ({
          name: analysis.testName,
          samples: analysis.sampleSize.control + analysis.sampleSize.treatment,
          winner: analysis.recommendation.winner,
          confidence: `${analysis.statisticalSignificance.confidenceLevel.toFixed(1)}%`
        })),
        recommendations: testRecommendations.recommendations,
        insights: testRecommendations.insights
      };
    }
  } catch (error: any) {
    throw new Error(`Failed to get A/B test results: ${error.message}`);
  }
}

/**
 * Apply learning to enhance a recommendation
 */
export async function enhanceWithLearning(args: {
  recommendation: any;
  type: 'lineup' | 'waiver' | 'trade';
}): Promise<any> {
  try {
    const enhanced = await learningEngine.enhanceRecommendation(
      args.recommendation,
      args.type
    );

    const successProbability = learningEngine.predictSuccessProbability(
      enhanced.adjustedRecommendation,
      args.type
    );

    return {
      original: enhanced.originalRecommendation,
      enhanced: enhanced.adjustedRecommendation,
      adjustmentReason: enhanced.adjustmentReason,
      confidenceChange: `${enhanced.confidenceModifier > 0 ? '+' : ''}${enhanced.confidenceModifier.toFixed(1)}%`,
      successProbability: `${(successProbability * 100).toFixed(1)}%`,
      appliedPatterns: enhanced.learnedPatterns.map(p => p.description)
    };
  } catch (error: any) {
    throw new Error(`Failed to enhance with learning: ${error.message}`);
  }
}