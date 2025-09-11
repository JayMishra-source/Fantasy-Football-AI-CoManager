import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Recommendation {
  id: string;
  timestamp: Date;
  type: 'lineup' | 'waiver' | 'trade' | 'draft';
  week: number;
  leagueId: string;
  teamId: string;
  recommendation: any;
  confidence: number;
  dataSourcesUsed: string[];
  llmUsed: boolean;
  llmModel?: string;
  cost?: number;
}

export interface Outcome {
  recommendationId: string;
  actualPoints?: number;
  projectedPoints?: number;
  accuracy?: number;
  playerPerformance?: Array<{
    playerId: string;
    playerName: string;
    projectedPoints: number;
    actualPoints: number;
    percentError: number;
  }>;
  success: boolean;
  notes?: string;
}

export interface PerformanceMetrics {
  totalRecommendations: number;
  successRate: number;
  averageAccuracy: number;
  averageConfidence: number;
  costPerRecommendation: number;
  byType: {
    [key: string]: {
      count: number;
      successRate: number;
      averageAccuracy: number;
    };
  };
  byWeek: {
    [key: number]: {
      recommendations: number;
      successRate: number;
      totalPoints: number;
    };
  };
  llmVsBasic: {
    llm: {
      count: number;
      successRate: number;
      averageCost: number;
      averageConfidence: number;
    };
    basic: {
      count: number;
      successRate: number;
    };
  };
}

class PerformanceTracker {
  private dataDir: string;
  private recommendationsFile: string;
  private outcomesFile: string;
  private recommendations: Map<string, Recommendation>;
  private outcomes: Map<string, Outcome>;

  constructor() {
    this.dataDir = path.join(__dirname, '../../data/performance');
    this.recommendationsFile = path.join(this.dataDir, 'recommendations.json');
    this.outcomesFile = path.join(this.dataDir, 'outcomes.json');
    this.recommendations = new Map();
    this.outcomes = new Map();
    
    this.initializeStorage();
    this.loadData();
  }

  private initializeStorage(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      console.log('📁 Created performance tracking directory');
    }
  }

  private loadData(): void {
    try {
      if (fs.existsSync(this.recommendationsFile)) {
        const data = JSON.parse(fs.readFileSync(this.recommendationsFile, 'utf-8'));
        this.recommendations = new Map(data.map((r: Recommendation) => [r.id, r]));
        console.log(`📊 Loaded ${this.recommendations.size} recommendations`);
      }

      if (fs.existsSync(this.outcomesFile)) {
        const data = JSON.parse(fs.readFileSync(this.outcomesFile, 'utf-8'));
        this.outcomes = new Map(data.map((o: Outcome) => [o.recommendationId, o]));
        console.log(`📊 Loaded ${this.outcomes.size} outcomes`);
      }
    } catch (error) {
      console.error('Failed to load performance data:', error);
    }
  }

  private saveData(): void {
    try {
      fs.writeFileSync(
        this.recommendationsFile, 
        JSON.stringify(Array.from(this.recommendations.values()), null, 2)
      );
      
      fs.writeFileSync(
        this.outcomesFile,
        JSON.stringify(Array.from(this.outcomes.values()), null, 2)
      );
    } catch (error) {
      console.error('Failed to save performance data:', error);
    }
  }

  /**
   * Track a new recommendation
   */
  async trackRecommendation(recommendation: Omit<Recommendation, 'id' | 'timestamp'>): Promise<string> {
    const id = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullRecommendation: Recommendation = {
      id,
      timestamp: new Date(),
      ...recommendation
    };

    this.recommendations.set(id, fullRecommendation);
    this.saveData();

    console.log(`📝 Tracked recommendation ${id} (${recommendation.type}, confidence: ${recommendation.confidence}%)`);
    
    return id;
  }

  /**
   * Record the outcome of a recommendation
   */
  async recordOutcome(outcome: Outcome): Promise<void> {
    const recommendation = this.recommendations.get(outcome.recommendationId);
    
    if (!recommendation) {
      throw new Error(`Recommendation ${outcome.recommendationId} not found`);
    }

    this.outcomes.set(outcome.recommendationId, outcome);
    this.saveData();

    console.log(`✅ Recorded outcome for ${outcome.recommendationId} (success: ${outcome.success})`);
  }

  /**
   * Get performance metrics for a time period
   */
  async getMetrics(startDate?: Date, endDate?: Date): Promise<PerformanceMetrics> {
    const filteredRecommendations = Array.from(this.recommendations.values()).filter(r => {
      if (startDate && r.timestamp < startDate) return false;
      if (endDate && r.timestamp > endDate) return false;
      return true;
    });

    const metrics: PerformanceMetrics = {
      totalRecommendations: filteredRecommendations.length,
      successRate: 0,
      averageAccuracy: 0,
      averageConfidence: 0,
      costPerRecommendation: 0,
      byType: {},
      byWeek: {},
      llmVsBasic: {
        llm: { count: 0, successRate: 0, averageCost: 0, averageConfidence: 0 },
        basic: { count: 0, successRate: 0 }
      }
    };

    if (filteredRecommendations.length === 0) {
      return metrics;
    }

    let totalSuccess = 0;
    let totalAccuracy = 0;
    let totalConfidence = 0;
    let totalCost = 0;
    let accuracyCount = 0;

    for (const rec of filteredRecommendations) {
      const outcome = this.outcomes.get(rec.id);
      
      // Overall metrics
      totalConfidence += rec.confidence;
      if (rec.cost) totalCost += rec.cost;
      
      if (outcome) {
        if (outcome.success) totalSuccess++;
        if (outcome.accuracy !== undefined) {
          totalAccuracy += outcome.accuracy;
          accuracyCount++;
        }
      }

      // By type metrics
      if (!metrics.byType[rec.type]) {
        metrics.byType[rec.type] = { count: 0, successRate: 0, averageAccuracy: 0 };
      }
      metrics.byType[rec.type].count++;

      // By week metrics
      if (!metrics.byWeek[rec.week]) {
        metrics.byWeek[rec.week] = { recommendations: 0, successRate: 0, totalPoints: 0 };
      }
      metrics.byWeek[rec.week].recommendations++;

      // LLM vs Basic
      if (rec.llmUsed) {
        metrics.llmVsBasic.llm.count++;
        metrics.llmVsBasic.llm.averageConfidence += rec.confidence;
        if (rec.cost) metrics.llmVsBasic.llm.averageCost += rec.cost;
        if (outcome?.success) metrics.llmVsBasic.llm.successRate++;
      } else {
        metrics.llmVsBasic.basic.count++;
        if (outcome?.success) metrics.llmVsBasic.basic.successRate++;
      }
    }

    // Calculate averages
    metrics.successRate = (totalSuccess / filteredRecommendations.length) * 100;
    metrics.averageAccuracy = accuracyCount > 0 ? totalAccuracy / accuracyCount : 0;
    metrics.averageConfidence = totalConfidence / filteredRecommendations.length;
    metrics.costPerRecommendation = totalCost / filteredRecommendations.length;

    // Calculate type-specific metrics
    for (const type in metrics.byType) {
      const typeRecs = filteredRecommendations.filter(r => r.type === type);
      const typeSuccesses = typeRecs.filter(r => this.outcomes.get(r.id)?.success).length;
      const typeAccuracies = typeRecs
        .map(r => this.outcomes.get(r.id)?.accuracy)
        .filter(a => a !== undefined) as number[];
      
      metrics.byType[type].successRate = (typeSuccesses / typeRecs.length) * 100;
      metrics.byType[type].averageAccuracy = typeAccuracies.length > 0 
        ? typeAccuracies.reduce((a, b) => a + b, 0) / typeAccuracies.length 
        : 0;
    }

    // Calculate week-specific metrics
    for (const week in metrics.byWeek) {
      const weekRecs = filteredRecommendations.filter(r => r.week === parseInt(week));
      const weekSuccesses = weekRecs.filter(r => this.outcomes.get(r.id)?.success).length;
      const weekPoints = weekRecs
        .map(r => this.outcomes.get(r.id)?.actualPoints || 0)
        .reduce((a, b) => a + b, 0);
      
      metrics.byWeek[week].successRate = (weekSuccesses / weekRecs.length) * 100;
      metrics.byWeek[week].totalPoints = weekPoints;
    }

    // Finalize LLM vs Basic metrics
    if (metrics.llmVsBasic.llm.count > 0) {
      metrics.llmVsBasic.llm.successRate = 
        (metrics.llmVsBasic.llm.successRate / metrics.llmVsBasic.llm.count) * 100;
      metrics.llmVsBasic.llm.averageConfidence /= metrics.llmVsBasic.llm.count;
      metrics.llmVsBasic.llm.averageCost /= metrics.llmVsBasic.llm.count;
    }

    if (metrics.llmVsBasic.basic.count > 0) {
      metrics.llmVsBasic.basic.successRate = 
        (metrics.llmVsBasic.basic.successRate / metrics.llmVsBasic.basic.count) * 100;
    }

    return metrics;
  }

  /**
   * Get recommendations that need outcome tracking
   */
  async getPendingOutcomes(week?: number): Promise<Recommendation[]> {
    const pending = Array.from(this.recommendations.values()).filter(r => {
      if (week !== undefined && r.week !== week) return false;
      return !this.outcomes.has(r.id);
    });

    return pending.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Compare LLM vs basic recommendations for A/B testing
   */
  async compareApproaches(week: number, leagueId: string): Promise<{
    llmPerformance: number;
    basicPerformance: number;
    improvement: number;
    costBenefit: number;
  }> {
    const recommendations = Array.from(this.recommendations.values()).filter(r => 
      r.week === week && r.leagueId === leagueId
    );

    const llmRecs = recommendations.filter(r => r.llmUsed);
    const basicRecs = recommendations.filter(r => !r.llmUsed);

    const llmPoints = llmRecs
      .map(r => this.outcomes.get(r.id)?.actualPoints || 0)
      .reduce((a, b) => a + b, 0);

    const basicPoints = basicRecs
      .map(r => this.outcomes.get(r.id)?.actualPoints || 0)
      .reduce((a, b) => a + b, 0);

    const llmCost = llmRecs
      .map(r => r.cost || 0)
      .reduce((a, b) => a + b, 0);

    const llmAvg = llmRecs.length > 0 ? llmPoints / llmRecs.length : 0;
    const basicAvg = basicRecs.length > 0 ? basicPoints / basicRecs.length : 0;

    const improvement = basicAvg > 0 ? ((llmAvg - basicAvg) / basicAvg) * 100 : 0;
    const costBenefit = llmCost > 0 ? (llmAvg - basicAvg) / llmCost : 0;

    return {
      llmPerformance: llmAvg,
      basicPerformance: basicAvg,
      improvement,
      costBenefit
    };
  }

  /**
   * Get learning insights from historical data
   */
  async getLearningInsights(): Promise<{
    bestPerformingStrategies: string[];
    commonMistakes: string[];
    optimalConfidenceRange: { min: number; max: number };
    recommendedDataSources: string[];
  }> {
    const allRecommendations = Array.from(this.recommendations.values());
    const successfulRecs = allRecommendations.filter(r => 
      this.outcomes.get(r.id)?.success === true
    );

    // Analyze successful strategies
    const typeSuccess: { [key: string]: number } = {};
    successfulRecs.forEach(r => {
      typeSuccess[r.type] = (typeSuccess[r.type] || 0) + 1;
    });

    const bestPerformingStrategies = Object.entries(typeSuccess)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => `${type} (${count} successes)`);

    // Find common mistakes
    const failedRecs = allRecommendations.filter(r => 
      this.outcomes.get(r.id)?.success === false
    );

    const commonMistakes: string[] = [];
    if (failedRecs.filter(r => r.confidence > 90).length > 5) {
      commonMistakes.push('Overconfidence in predictions (90%+ confidence with failures)');
    }
    if (failedRecs.filter(r => r.dataSourcesUsed.length < 2).length > 10) {
      commonMistakes.push('Insufficient data sources (single source decisions failing)');
    }

    // Find optimal confidence range
    const confidentSuccesses = successfulRecs.map(r => r.confidence);
    const minConfidence = Math.min(...confidentSuccesses);
    const maxConfidence = Math.max(...confidentSuccesses);
    const avgConfidence = confidentSuccesses.reduce((a, b) => a + b, 0) / confidentSuccesses.length;

    // Analyze data source effectiveness
    const sourceSuccess: { [key: string]: number } = {};
    successfulRecs.forEach(r => {
      r.dataSourcesUsed.forEach(source => {
        sourceSuccess[source] = (sourceSuccess[source] || 0) + 1;
      });
    });

    const recommendedDataSources = Object.entries(sourceSuccess)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([source]) => source);

    return {
      bestPerformingStrategies,
      commonMistakes,
      optimalConfidenceRange: {
        min: avgConfidence - 10,
        max: avgConfidence + 10
      },
      recommendedDataSources
    };
  }
}

export const performanceTracker = new PerformanceTracker();