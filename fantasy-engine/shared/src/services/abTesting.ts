import { performanceTracker } from './performanceTracker.js';
import { learningEngine } from './learningEngine.js';

export interface ABTestConfig {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  variants: {
    control: TestVariant;
    treatment: TestVariant;
  };
  allocation: number; // Percentage allocated to treatment (0-100)
  metrics: string[];
  status: 'active' | 'paused' | 'completed';
}

export interface TestVariant {
  name: string;
  description: string;
  useLLM: boolean;
  llmModel?: string;
  parameters: any;
}

export interface ABTestResult {
  testId: string;
  variant: 'control' | 'treatment';
  recommendationId: string;
  timestamp: Date;
  metrics: {
    [key: string]: number;
  };
  outcome?: {
    success: boolean;
    actualValue: number;
    expectedValue: number;
  };
}

export interface ABTestAnalysis {
  testId: string;
  testName: string;
  duration: number; // days
  sampleSize: {
    control: number;
    treatment: number;
  };
  performance: {
    control: {
      successRate: number;
      averageValue: number;
      cost: number;
      confidence: number;
    };
    treatment: {
      successRate: number;
      averageValue: number;
      cost: number;
      confidence: number;
    };
  };
  statisticalSignificance: {
    pValue: number;
    isSignificant: boolean;
    confidenceLevel: number;
  };
  recommendation: {
    winner: 'control' | 'treatment' | 'inconclusive';
    reasoning: string;
    expectedImprovement: number;
    costBenefit: number;
  };
}

class ABTestingService {
  private activeTests: Map<string, ABTestConfig>;
  private testResults: Map<string, ABTestResult[]>;
  private readonly minSampleSize = 30;
  private readonly confidenceThreshold = 0.95;

  constructor() {
    this.activeTests = new Map();
    this.testResults = new Map();
    this.initializeDefaultTests();
  }

  private initializeDefaultTests(): void {
    // Default test: LLM vs Basic for lineup optimization
    this.createTest({
      name: 'LLM vs Basic Lineup Optimization',
      description: 'Compare AI-powered lineup optimization against rule-based approach',
      variants: {
        control: {
          name: 'Basic Rules',
          description: 'Traditional projection-based optimization',
          useLLM: false,
          parameters: {
            strategy: 'highest_projected_points'
          }
        },
        treatment: {
          name: 'AI Orchestration',
          description: 'LLM-powered multi-factor optimization',
          useLLM: true,
          llmModel: 'gemini-1.5-flash',
          parameters: {
            strategy: 'ai_workflow',
            dataSources: ['espn', 'fantasypros', 'weather', 'news']
          }
        }
      },
      allocation: 50,
      metrics: ['projected_points', 'actual_points', 'cost', 'decision_time']
    });

    // Test 2: Model comparison
    this.createTest({
      name: 'LLM Model Comparison',
      description: 'Compare different LLM models for cost-effectiveness',
      variants: {
        control: {
          name: 'GPT-4o-mini',
          description: 'Cheaper, faster model',
          useLLM: true,
          llmModel: 'gpt-4o-mini',
          parameters: {}
        },
        treatment: {
          name: 'Gemini 1.5 Flash',
          description: 'Google\'s efficient model',
          useLLM: true,
          llmModel: 'gemini-1.5-flash',
          parameters: {}
        }
      },
      allocation: 50,
      metrics: ['cost', 'response_time', 'accuracy', 'token_usage']
    });
  }

  /**
   * Create a new A/B test
   */
  createTest(config: Omit<ABTestConfig, 'id' | 'startDate' | 'status'>): string {
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullConfig: ABTestConfig = {
      id: testId,
      startDate: new Date(),
      status: 'active',
      ...config
    };

    this.activeTests.set(testId, fullConfig);
    this.testResults.set(testId, []);

    console.log(`🧪 Created A/B test: ${config.name} (${testId})`);
    
    return testId;
  }

  /**
   * Determine which variant to use for a recommendation
   */
  async selectVariant(testId: string, context?: any): Promise<'control' | 'treatment'> {
    const test = this.activeTests.get(testId);
    
    if (!test || test.status !== 'active') {
      return 'control'; // Default to control if test not found or inactive
    }

    // Check if we need more samples for statistical significance
    const results = this.testResults.get(testId) || [];
    const controlCount = results.filter(r => r.variant === 'control').length;
    const treatmentCount = results.filter(r => r.variant === 'treatment').length;

    // Ensure minimum samples for each variant
    if (controlCount < this.minSampleSize / 2) {
      return 'control';
    }
    if (treatmentCount < this.minSampleSize / 2) {
      return 'treatment';
    }

    // Random allocation based on configured percentage
    const random = Math.random() * 100;
    return random < test.allocation ? 'treatment' : 'control';
  }

  /**
   * Execute a recommendation using the selected variant
   */
  async executeVariant(
    testId: string,
    variant: 'control' | 'treatment',
    operation: string,
    args: any
  ): Promise<{
    recommendation: any;
    metrics: { [key: string]: number };
    variant: 'control' | 'treatment';
  }> {
    const test = this.activeTests.get(testId);
    
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    const variantConfig = test.variants[variant];
    const startTime = Date.now();
    let recommendation: any;
    let cost = 0;
    let tokens = { input: 0, output: 0 };

    if (variantConfig.useLLM) {
      // Execute with LLM
      // This would integrate with your existing LLM workflow
      recommendation = await this.executeLLMVariant(operation, args, variantConfig);
      
      // Simple cost estimation for now
      cost = 0.001 + Math.random() * 0.01; // $0.001-0.011
    } else {
      // Execute basic variant
      recommendation = await this.executeBasicVariant(operation, args, variantConfig);
    }

    const executionTime = Date.now() - startTime;

    // Collect metrics
    const metrics: { [key: string]: number } = {
      execution_time: executionTime,
      cost,
      confidence: recommendation.confidence || 50
    };

    // Record test result
    const result: ABTestResult = {
      testId,
      variant,
      recommendationId: recommendation.id || `rec_${Date.now()}`,
      timestamp: new Date(),
      metrics
    };

    const results = this.testResults.get(testId) || [];
    results.push(result);
    this.testResults.set(testId, results);

    // Track in performance tracker
    await performanceTracker.trackRecommendation({
      type: operation as any,
      week: args.week || 0,
      leagueId: args.leagueId,
      teamId: args.teamId,
      recommendation,
      confidence: metrics.confidence,
      dataSourcesUsed: variantConfig.useLLM ? ['llm'] : ['basic'],
      llmUsed: variantConfig.useLLM,
      llmModel: variantConfig.llmModel,
      cost
    });

    return {
      recommendation,
      metrics,
      variant
    };
  }

  private async executeLLMVariant(operation: string, args: any, config: TestVariant): Promise<any> {
    // Simplified - in production, this would call your actual LLM workflow
    return {
      id: `llm_rec_${Date.now()}`,
      type: operation,
      confidence: 75 + Math.random() * 20,
      recommendation: `AI-powered ${operation} recommendation`,
      details: {
        model: config.llmModel,
        parameters: config.parameters
      }
    };
  }

  private async executeBasicVariant(operation: string, args: any, config: TestVariant): Promise<any> {
    // Simplified - in production, this would call your basic recommendation logic
    return {
      id: `basic_rec_${Date.now()}`,
      type: operation,
      confidence: 60 + Math.random() * 20,
      recommendation: `Rule-based ${operation} recommendation`,
      details: {
        strategy: config.parameters.strategy
      }
    };
  }

  /**
   * Record the outcome of a test variant
   */
  async recordOutcome(
    testId: string,
    recommendationId: string,
    outcome: {
      success: boolean;
      actualValue: number;
      expectedValue: number;
    }
  ): Promise<void> {
    const results = this.testResults.get(testId) || [];
    const result = results.find(r => r.recommendationId === recommendationId);
    
    if (result) {
      result.outcome = outcome;
      
      // Also record in performance tracker
      await performanceTracker.recordOutcome({
        recommendationId,
        actualPoints: outcome.actualValue,
        projectedPoints: outcome.expectedValue,
        accuracy: outcome.expectedValue > 0 
          ? (outcome.actualValue / outcome.expectedValue) * 100 
          : 0,
        success: outcome.success
      });
    }
  }

  /**
   * Analyze test results
   */
  async analyzeTest(testId: string): Promise<ABTestAnalysis> {
    const test = this.activeTests.get(testId);
    const results = this.testResults.get(testId) || [];

    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    const controlResults = results.filter(r => r.variant === 'control');
    const treatmentResults = results.filter(r => r.variant === 'treatment');

    // Calculate performance metrics
    const controlPerf = this.calculatePerformance(controlResults);
    const treatmentPerf = this.calculatePerformance(treatmentResults);

    // Calculate statistical significance
    const significance = this.calculateStatisticalSignificance(
      controlResults,
      treatmentResults
    );

    // Determine winner
    const recommendation = this.determineWinner(
      controlPerf,
      treatmentPerf,
      significance
    );

    const duration = test.endDate 
      ? (test.endDate.getTime() - test.startDate.getTime()) / (1000 * 60 * 60 * 24)
      : (Date.now() - test.startDate.getTime()) / (1000 * 60 * 60 * 24);

    return {
      testId,
      testName: test.name,
      duration,
      sampleSize: {
        control: controlResults.length,
        treatment: treatmentResults.length
      },
      performance: {
        control: controlPerf,
        treatment: treatmentPerf
      },
      statisticalSignificance: significance,
      recommendation
    };
  }

  private calculatePerformance(results: ABTestResult[]): {
    successRate: number;
    averageValue: number;
    cost: number;
    confidence: number;
  } {
    if (results.length === 0) {
      return { successRate: 0, averageValue: 0, cost: 0, confidence: 0 };
    }

    const withOutcomes = results.filter(r => r.outcome);
    const successCount = withOutcomes.filter(r => r.outcome!.success).length;
    const totalValue = withOutcomes.reduce((sum, r) => sum + (r.outcome?.actualValue || 0), 0);
    const totalCost = results.reduce((sum, r) => sum + (r.metrics.cost || 0), 0);
    const totalConfidence = results.reduce((sum, r) => sum + (r.metrics.confidence || 0), 0);

    return {
      successRate: withOutcomes.length > 0 ? (successCount / withOutcomes.length) * 100 : 0,
      averageValue: withOutcomes.length > 0 ? totalValue / withOutcomes.length : 0,
      cost: totalCost,
      confidence: results.length > 0 ? totalConfidence / results.length : 0
    };
  }

  private calculateStatisticalSignificance(
    control: ABTestResult[],
    treatment: ABTestResult[]
  ): {
    pValue: number;
    isSignificant: boolean;
    confidenceLevel: number;
  } {
    // Simplified statistical test - in production, use proper statistical library
    const controlSuccess = control.filter(r => r.outcome?.success).length;
    const treatmentSuccess = treatment.filter(r => r.outcome?.success).length;
    
    const controlRate = control.length > 0 ? controlSuccess / control.length : 0;
    const treatmentRate = treatment.length > 0 ? treatmentSuccess / treatment.length : 0;
    
    // Simplified z-test for proportions
    const pooledRate = (controlSuccess + treatmentSuccess) / (control.length + treatment.length);
    const se = Math.sqrt(pooledRate * (1 - pooledRate) * (1/control.length + 1/treatment.length));
    const z = se > 0 ? (treatmentRate - controlRate) / se : 0;
    
    // Approximate p-value from z-score
    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));
    
    return {
      pValue,
      isSignificant: pValue < 0.05,
      confidenceLevel: (1 - pValue) * 100
    };
  }

  private normalCDF(x: number): number {
    // Approximation of normal CDF
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
  }

  private determineWinner(
    controlPerf: any,
    treatmentPerf: any,
    significance: any
  ): {
    winner: 'control' | 'treatment' | 'inconclusive';
    reasoning: string;
    expectedImprovement: number;
    costBenefit: number;
  } {
    const valueDiff = treatmentPerf.averageValue - controlPerf.averageValue;
    const costDiff = treatmentPerf.cost - controlPerf.cost;
    const successDiff = treatmentPerf.successRate - controlPerf.successRate;
    
    let winner: 'control' | 'treatment' | 'inconclusive' = 'inconclusive';
    let reasoning = '';
    
    if (!significance.isSignificant) {
      reasoning = 'Results not statistically significant';
    } else if (valueDiff > 0 && costDiff < valueDiff * 0.1) {
      winner = 'treatment';
      reasoning = `Treatment shows ${successDiff.toFixed(1)}% better success rate with acceptable cost increase`;
    } else if (valueDiff < 0 || costDiff > valueDiff) {
      winner = 'control';
      reasoning = `Control performs better or has superior cost-benefit ratio`;
    } else {
      reasoning = 'Results are mixed, continue testing';
    }
    
    const expectedImprovement = valueDiff;
    const costBenefit = costDiff !== 0 ? valueDiff / costDiff : valueDiff;
    
    return {
      winner,
      reasoning,
      expectedImprovement,
      costBenefit
    };
  }

  /**
   * Get active tests
   */
  getActiveTests(): ABTestConfig[] {
    return Array.from(this.activeTests.values()).filter(t => t.status === 'active');
  }

  /**
   * Pause or resume a test
   */
  setTestStatus(testId: string, status: 'active' | 'paused' | 'completed'): void {
    const test = this.activeTests.get(testId);
    if (test) {
      test.status = status;
      if (status === 'completed') {
        test.endDate = new Date();
      }
      console.log(`🧪 Test ${test.name} status changed to ${status}`);
    }
  }

  /**
   * Get recommendations based on test results
   */
  async getTestRecommendations(): Promise<{
    recommendations: string[];
    insights: string[];
  }> {
    const recommendations: string[] = [];
    const insights: string[] = [];

    for (const test of this.activeTests.values()) {
      if (test.status === 'active') {
        const analysis = await this.analyzeTest(test.id);
        
        if (analysis.sampleSize.control + analysis.sampleSize.treatment > this.minSampleSize) {
          if (analysis.recommendation.winner !== 'inconclusive') {
            recommendations.push(
              `Switch to ${analysis.recommendation.winner} for ${test.name}: ${analysis.recommendation.reasoning}`
            );
          }
          
          if (analysis.statisticalSignificance.isSignificant) {
            insights.push(
              `${test.name}: ${analysis.recommendation.winner} variant shows ${analysis.recommendation.expectedImprovement.toFixed(1)} point improvement`
            );
          }
        }
      }
    }

    // Add general insights
    const allResults = Array.from(this.testResults.values()).flat();
    const llmResults = allResults.filter(r => {
      const test = this.activeTests.get(r.testId);
      return test?.variants[r.variant].useLLM;
    });
    
    const basicResults = allResults.filter(r => {
      const test = this.activeTests.get(r.testId);
      return !test?.variants[r.variant].useLLM;
    });

    if (llmResults.length > 0 && basicResults.length > 0) {
      const avgLLMCost = llmResults.reduce((sum, r) => sum + (r.metrics.cost || 0), 0) / llmResults.length;
      const avgBasicCost = basicResults.reduce((sum, r) => sum + (r.metrics.cost || 0), 0) / basicResults.length;
      
      insights.push(
        `LLM recommendations cost ${(avgLLMCost / (avgBasicCost || 0.001)).toFixed(1)}x more than basic logic`
      );
    }

    return { recommendations, insights };
  }
}

export const abTestingService = new ABTestingService();