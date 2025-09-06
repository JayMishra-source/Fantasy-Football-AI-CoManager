import { performanceTracker } from './performanceTracker.js';

export interface LearningModel {
  version: string;
  lastUpdated: Date;
  trainingData: {
    totalSamples: number;
    successRate: number;
    features: FeatureWeights;
  };
  patterns: Pattern[];
  adjustments: Adjustment[];
}

export interface FeatureWeights {
  projectedPoints: number;
  expertConsensus: number;
  recentPerformance: number;
  injuryStatus: number;
  weatherImpact: number;
  matchupDifficulty: number;
  homeAway: number;
  restDays: number;
}

export interface Pattern {
  id: string;
  description: string;
  condition: string;
  impact: number;
  confidence: number;
  examples: number;
}

export interface Adjustment {
  type: 'lineup' | 'waiver' | 'trade';
  factor: string;
  adjustment: number;
  reasoning: string;
  basedOnSamples: number;
}

export interface LearningRecommendation {
  originalRecommendation: any;
  adjustedRecommendation: any;
  adjustmentReason: string;
  confidenceModifier: number;
  learnedPatterns: Pattern[];
}

class LearningEngine {
  private model: LearningModel;
  private readonly minSamplesForLearning = 10;
  private readonly confidenceThreshold = 0.7;

  constructor() {
    this.model = this.initializeModel();
    this.loadModel();
  }

  private initializeModel(): LearningModel {
    return {
      version: '1.0.0',
      lastUpdated: new Date(),
      trainingData: {
        totalSamples: 0,
        successRate: 0,
        features: {
          projectedPoints: 1.0,
          expertConsensus: 0.8,
          recentPerformance: 0.7,
          injuryStatus: 0.9,
          weatherImpact: 0.3,
          matchupDifficulty: 0.5,
          homeAway: 0.2,
          restDays: 0.1
        }
      },
      patterns: [],
      adjustments: []
    };
  }

  private async loadModel(): Promise<void> {
    // In production, this would load from a database
    // For now, we'll use the performance tracker data to build patterns
    try {
      const insights = await performanceTracker.getLearningInsights();
      this.updateModelFromInsights(insights);
    } catch (error) {
      console.log('📚 Initializing learning engine with default model');
    }
  }

  private updateModelFromInsights(insights: any): void {
    // Update patterns based on insights
    if (insights.bestPerformingStrategies.length > 0) {
      insights.bestPerformingStrategies.forEach((strategy: string, index: number) => {
        this.model.patterns.push({
          id: `pattern_${Date.now()}_${index}`,
          description: `Successful strategy: ${strategy}`,
          condition: strategy.split(' ')[0].toLowerCase(),
          impact: 0.8 - (index * 0.1),
          confidence: 0.85,
          examples: 10
        });
      });
    }

    console.log(`📊 Learning engine updated with ${this.model.patterns.length} patterns`);
  }

  /**
   * Train the model with new performance data
   */
  async train(): Promise<void> {
    console.log('🧠 Training learning model...');

    const metrics = await performanceTracker.getMetrics();
    
    if (metrics.totalRecommendations < this.minSamplesForLearning) {
      console.log(`⏳ Insufficient data for training (${metrics.totalRecommendations}/${this.minSamplesForLearning} samples)`);
      return;
    }

    // Update feature weights based on performance
    await this.updateFeatureWeights(metrics);

    // Discover new patterns
    await this.discoverPatterns(metrics);

    // Generate adjustments
    await this.generateAdjustments(metrics);

    this.model.lastUpdated = new Date();
    this.model.trainingData.totalSamples = metrics.totalRecommendations;
    this.model.trainingData.successRate = metrics.successRate;

    console.log(`✅ Model trained with ${metrics.totalRecommendations} samples (${metrics.successRate.toFixed(1)}% success rate)`);
  }

  private async updateFeatureWeights(metrics: any): Promise<void> {
    // Analyze which features correlate with success
    // This is a simplified version - in production, use ML algorithms

    // Adjust weights based on LLM vs Basic performance
    if (metrics.llmVsBasic.llm.successRate > metrics.llmVsBasic.basic.successRate) {
      // LLM is performing better, increase weight for advanced features
      this.model.trainingData.features.expertConsensus *= 1.1;
      this.model.trainingData.features.matchupDifficulty *= 1.05;
    } else {
      // Basic is performing better, focus on fundamentals
      this.model.trainingData.features.projectedPoints *= 1.1;
      this.model.trainingData.features.recentPerformance *= 1.05;
    }

    // Normalize weights
    const totalWeight = Object.values(this.model.trainingData.features)
      .reduce((sum, weight) => sum + weight, 0);
    
    Object.keys(this.model.trainingData.features).forEach(key => {
      (this.model.trainingData.features as any)[key] /= totalWeight;
    });
  }

  private async discoverPatterns(metrics: any): Promise<void> {
    const patterns: Pattern[] = [];

    // Pattern: High confidence correlates with success
    if (metrics.averageConfidence > 70 && metrics.successRate > 60) {
      patterns.push({
        id: `pattern_confidence_${Date.now()}`,
        description: 'High confidence predictions are generally accurate',
        condition: 'confidence > 70',
        impact: 0.8,
        confidence: metrics.successRate / 100,
        examples: metrics.totalRecommendations
      });
    }

    // Pattern: Certain recommendation types perform better
    for (const [type, data] of Object.entries(metrics.byType)) {
      const typeData = data as any;
      if (typeData.successRate > metrics.successRate + 10) {
        patterns.push({
          id: `pattern_type_${type}_${Date.now()}`,
          description: `${type} recommendations outperform average`,
          condition: `type === '${type}'`,
          impact: (typeData.successRate - metrics.successRate) / 100,
          confidence: Math.min(typeData.count / 20, 1),
          examples: typeData.count
        });
      }
    }

    // Pattern: Weekly trends
    const weeklySuccess = Object.entries(metrics.byWeek)
      .map(([week, data]: [string, any]) => ({
        week: parseInt(week),
        successRate: data.successRate
      }))
      .sort((a, b) => b.successRate - a.successRate);

    if (weeklySuccess.length > 3) {
      const bestWeeks = weeklySuccess.slice(0, 3);
      patterns.push({
        id: `pattern_weekly_${Date.now()}`,
        description: `Best performance in weeks ${bestWeeks.map(w => w.week).join(', ')}`,
        condition: 'weekly_performance',
        impact: 0.5,
        confidence: 0.7,
        examples: weeklySuccess.length
      });
    }

    // Add discovered patterns to model
    this.model.patterns = [
      ...this.model.patterns.filter(p => p.examples >= this.minSamplesForLearning),
      ...patterns
    ];
  }

  private async generateAdjustments(metrics: any): Promise<void> {
    const adjustments: Adjustment[] = [];

    // Adjustment: Lineup optimization
    if (metrics.byType.lineup?.successRate) {
      const lineupSuccess = metrics.byType.lineup.successRate;
      if (lineupSuccess < 50) {
        adjustments.push({
          type: 'lineup',
          factor: 'conservative_projections',
          adjustment: -0.1,
          reasoning: 'Lineup predictions overoptimistic, reducing projection weight',
          basedOnSamples: metrics.byType.lineup.count
        });
      } else if (lineupSuccess > 70) {
        adjustments.push({
          type: 'lineup',
          factor: 'aggressive_optimization',
          adjustment: 0.1,
          reasoning: 'Lineup predictions performing well, increasing confidence',
          basedOnSamples: metrics.byType.lineup.count
        });
      }
    }

    // Adjustment: Waiver recommendations
    if (metrics.byType.waiver?.successRate) {
      const waiverSuccess = metrics.byType.waiver.successRate;
      if (waiverSuccess < 40) {
        adjustments.push({
          type: 'waiver',
          factor: 'priority_threshold',
          adjustment: 0.2,
          reasoning: 'Waiver picks underperforming, raising quality threshold',
          basedOnSamples: metrics.byType.waiver.count
        });
      }
    }

    // Adjustment: Cost-benefit optimization
    if (metrics.costPerRecommendation > 0.01 && metrics.successRate < 60) {
      adjustments.push({
        type: 'lineup',
        factor: 'llm_usage',
        adjustment: -0.3,
        reasoning: 'High cost with low success, reduce LLM usage for simple decisions',
        basedOnSamples: metrics.totalRecommendations
      });
    }

    this.model.adjustments = adjustments;
  }

  /**
   * Apply learning to enhance a recommendation
   */
  async enhanceRecommendation(
    recommendation: any,
    type: 'lineup' | 'waiver' | 'trade'
  ): Promise<LearningRecommendation> {
    const applicablePatterns = this.model.patterns.filter(p => {
      // Simple pattern matching - in production, use more sophisticated matching
      if (p.condition.includes(type)) return true;
      if (p.condition.includes('confidence') && recommendation.confidence) {
        const confidenceCheck = eval(p.condition.replace('confidence', recommendation.confidence));
        return confidenceCheck;
      }
      return false;
    });

    const applicableAdjustments = this.model.adjustments.filter(a => a.type === type);
    
    let adjustedRecommendation = { ...recommendation };
    let confidenceModifier = 0;
    let adjustmentReason = '';

    // Apply patterns
    for (const pattern of applicablePatterns) {
      confidenceModifier += pattern.impact * pattern.confidence;
      adjustmentReason += `Applied pattern: ${pattern.description}. `;
    }

    // Apply adjustments
    for (const adjustment of applicableAdjustments) {
      if (adjustment.factor === 'conservative_projections' && adjustedRecommendation.projectedPoints) {
        adjustedRecommendation.projectedPoints *= (1 + adjustment.adjustment);
        adjustmentReason += adjustment.reasoning + '. ';
      }
      
      if (adjustment.factor === 'priority_threshold' && adjustedRecommendation.priority) {
        adjustedRecommendation.priority *= (1 + adjustment.adjustment);
        adjustmentReason += adjustment.reasoning + '. ';
      }

      confidenceModifier += adjustment.adjustment * 10;
    }

    // Apply feature weights to scoring
    if (adjustedRecommendation.score !== undefined) {
      let weightedScore = 0;
      const features = this.model.trainingData.features;

      if (adjustedRecommendation.projectedPoints) {
        weightedScore += adjustedRecommendation.projectedPoints * features.projectedPoints;
      }
      if (adjustedRecommendation.expertRank) {
        weightedScore += (100 - adjustedRecommendation.expertRank) * features.expertConsensus;
      }
      
      adjustedRecommendation.adjustedScore = weightedScore;
    }

    // Adjust confidence based on learning
    if (adjustedRecommendation.confidence) {
      adjustedRecommendation.confidence = Math.max(
        10,
        Math.min(95, adjustedRecommendation.confidence + confidenceModifier)
      );
    }

    return {
      originalRecommendation: recommendation,
      adjustedRecommendation,
      adjustmentReason: adjustmentReason || 'No adjustments needed based on current learning',
      confidenceModifier,
      learnedPatterns: applicablePatterns
    };
  }

  /**
   * Get personalized insights based on learning
   */
  async getPersonalizedInsights(leagueId: string, teamId: string): Promise<{
    strengths: string[];
    improvements: string[];
    recommendations: string[];
  }> {
    const insights = await performanceTracker.getLearningInsights();
    const metrics = await performanceTracker.getMetrics();

    const strengths: string[] = [];
    const improvements: string[] = [];
    const recommendations: string[] = [];

    // Identify strengths
    if (metrics.successRate > 60) {
      strengths.push(`Strong overall performance with ${metrics.successRate.toFixed(1)}% success rate`);
    }
    
    for (const [type, data] of Object.entries(metrics.byType)) {
      const typeData = data as any;
      if (typeData.successRate > 65) {
        strengths.push(`Excellent ${type} decisions (${typeData.successRate.toFixed(1)}% success)`);
      }
    }

    // Identify areas for improvement
    if (insights.commonMistakes.length > 0) {
      improvements.push(...insights.commonMistakes);
    }

    if (metrics.llmVsBasic.basic.successRate > metrics.llmVsBasic.llm.successRate) {
      improvements.push('Consider using simpler decision models for routine choices');
    }

    // Generate recommendations
    if (insights.optimalConfidenceRange) {
      recommendations.push(
        `Target confidence range: ${insights.optimalConfidenceRange.min.toFixed(0)}-${insights.optimalConfidenceRange.max.toFixed(0)}%`
      );
    }

    if (insights.recommendedDataSources.length > 0) {
      recommendations.push(
        `Prioritize these data sources: ${insights.recommendedDataSources.join(', ')}`
      );
    }

    // Add pattern-based recommendations
    const highImpactPatterns = this.model.patterns
      .filter(p => p.impact > 0.5)
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 3);

    for (const pattern of highImpactPatterns) {
      recommendations.push(`Strategy insight: ${pattern.description}`);
    }

    return {
      strengths,
      improvements,
      recommendations
    };
  }

  /**
   * Predict success probability for a recommendation
   */
  predictSuccessProbability(recommendation: any, type: string): number {
    let probability = 0.5; // Base probability

    // Adjust based on historical success rate
    const historicalRate = this.model.trainingData.successRate / 100;
    probability = probability * 0.3 + historicalRate * 0.7;

    // Apply pattern-based adjustments
    const patterns = this.model.patterns.filter(p => 
      p.condition.includes(type) || p.condition === 'weekly_performance'
    );

    for (const pattern of patterns) {
      probability += pattern.impact * pattern.confidence * 0.1;
    }

    // Apply confidence-based adjustment
    if (recommendation.confidence) {
      const confidenceBoost = (recommendation.confidence - 50) / 100;
      probability += confidenceBoost * 0.2;
    }

    // Ensure probability is within bounds
    return Math.max(0.1, Math.min(0.95, probability));
  }
}

export const learningEngine = new LearningEngine();