export async function trainModel(args: any) {
  const { learningEngine } = await import('../services/learningEngine.js');
  await learningEngine.train();
  return { success: true, message: 'Model training completed' };
}

export async function runABTest(args: any) {
  const { abTestingService } = await import('../services/abTesting.js');
  
  // Find or create appropriate test
  const activeTests = abTestingService.getActiveTests();
  let testId = args.testId;
  
  if (!testId) {
    // Create default test based on operation
    testId = abTestingService.createTest({
      name: `${args.operation} A/B Test`,
      description: `Compare LLM vs basic approach for ${args.operation}`,
      variants: {
        control: {
          name: 'Basic Logic',
          description: 'Rule-based approach',
          useLLM: false,
          parameters: {}
        },
        treatment: {
          name: 'AI Enhancement',
          description: 'LLM-powered approach',
          useLLM: true,
          llmModel: 'gemini-1.5-flash',
          parameters: {}
        }
      },
      allocation: 50,
      metrics: ['success_rate', 'accuracy', 'cost']
    });
  }
  
  const variant = await abTestingService.selectVariant(testId);
  const result = await abTestingService.executeVariant(testId, variant, args.operation, args);
  
  return {
    testId,
    variant,
    recommendation: result.recommendation,
    metrics: result.metrics
  };
}

export async function trackPerformance(args: any) {
  const { performanceTracker } = await import('../services/performanceTracker.js');
  
  const recommendationId = await performanceTracker.trackRecommendation({
    type: args.type,
    week: args.week,
    leagueId: args.leagueId,
    teamId: args.teamId,
    recommendation: args.recommendation,
    confidence: args.confidence,
    dataSourcesUsed: args.dataSourcesUsed || [],
    llmUsed: args.llmUsed || false,
    llmModel: args.llmModel,
    cost: args.cost || 0
  });
  
  return { recommendationId, tracked: true };
}

export async function recordOutcome(args: any) {
  const { performanceTracker } = await import('../services/performanceTracker.js');
  
  await performanceTracker.recordOutcome({
    recommendationId: args.recommendationId,
    actualPoints: args.actualPoints,
    projectedPoints: args.projectedPoints,
    accuracy: args.accuracy,
    success: args.success,
    notes: args.notes
  });
  
  return { recorded: true };
}

export async function getPersonalizedInsights(args: any) {
  const { learningEngine } = await import('../services/learningEngine.js');
  
  const insights = await learningEngine.getPersonalizedInsights(
    args.leagueId,
    args.teamId
  );
  
  return insights;
}

export async function getPerformanceMetrics(args: any) {
  const { performanceTracker } = await import('../services/performanceTracker.js');
  
  const metrics = await performanceTracker.getMetrics(
    args.startDate ? new Date(args.startDate) : undefined,
    args.endDate ? new Date(args.endDate) : undefined
  );
  
  return {
    summary: {
      totalRecommendations: metrics.totalRecommendations,
      successRate: metrics.successRate,
      averageAccuracy: metrics.averageAccuracy,
      averageConfidence: metrics.averageConfidence,
      costPerRecommendation: metrics.costPerRecommendation
    },
    metrics
  };
}

export async function getCostAnalysis(args: any) {
  const { enhancedCostMonitor } = await import('../services/enhancedCostMonitor.js');
  
  const summary = await enhancedCostMonitor.getCostSummary(
    args.startDate ? new Date(args.startDate) : undefined,
    args.endDate ? new Date(args.endDate) : undefined
  );
  
  const usage = enhancedCostMonitor.getCurrentUsage();
  const optimizations = await enhancedCostMonitor.getOptimizationStrategies();
  
  return {
    summary: {
      totalCost: summary.totalCost,
      dailyCost: usage.daily.used,
      weeklyCost: usage.weekly.used,
      monthlyCost: usage.monthly.used,
      projectedMonthlyCost: summary.costTrends.projectedMonthly
    },
    usage,
    optimizations: optimizations.slice(0, 3), // Top 3 recommendations
    recommendations: summary.recommendations
  };
}

export async function getABTestResults(args: any) {
  const { abTestingService } = await import('../services/abTesting.js');
  
  if (args.testId) {
    const analysis = await abTestingService.analyzeTest(args.testId);
    return analysis;
  } else {
    // Get insights from all tests
    const insights = await abTestingService.getTestRecommendations();
    return insights;
  }
}