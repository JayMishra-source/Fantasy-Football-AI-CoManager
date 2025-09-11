import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CostRecord {
  id: string;
  timestamp: Date;
  provider: 'openai' | 'anthropic' | 'google' | 'basic';
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  leagueId?: string;
  teamId?: string;
  week?: number;
  success?: boolean;
  metadata?: any;
}

export interface CostSummary {
  totalCost: number;
  totalOperations: number;
  averageCostPerOperation: number;
  byProvider: {
    [key: string]: {
      cost: number;
      operations: number;
      averageCost: number;
      tokens: {
        input: number;
        output: number;
      };
    };
  };
  byOperation: {
    [key: string]: {
      cost: number;
      count: number;
      averageCost: number;
      successRate: number;
    };
  };
  byWeek: {
    [key: number]: {
      cost: number;
      operations: number;
    };
  };
  costTrends: {
    daily: number[];
    weekly: number[];
    projectedMonthly: number;
  };
  recommendations: string[];
}

export interface CostOptimization {
  strategy: string;
  estimatedSavings: number;
  impactOnPerformance: 'high' | 'medium' | 'low';
  implementation: string;
}

class EnhancedCostMonitor {
  private dataDir: string;
  private costFile: string;
  private records: CostRecord[];
  private readonly costLimits = {
    daily: 1.0,      // $1.00 per day
    weekly: 5.0,     // $5.00 per week
    monthly: 20.0    // $20.00 per month
  };

  // Pricing per 1K tokens (approximate)
  private readonly pricing = {
    openai: {
      'gpt-4o': { input: 0.005, output: 0.015 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 }
    },
    anthropic: {
      'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
      'claude-3-5-haiku-20241022': { input: 0.001, output: 0.005 },
      'claude-3-opus-20240229': { input: 0.015, output: 0.075 }
    },
    google: {
      'gemini-2.0-flash-exp': { input: 0.000075, output: 0.0003 },
      'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
      'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
      'gemini-1.0-pro': { input: 0.0005, output: 0.0015 }
    }
  };

  constructor() {
    this.dataDir = path.join(__dirname, '../../data/costs');
    this.costFile = path.join(this.dataDir, 'cost_records.json');
    this.records = [];
    
    this.initializeStorage();
    this.loadRecords();
  }

  private initializeStorage(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      console.log('📁 Created cost monitoring directory');
    }
  }

  private loadRecords(): void {
    try {
      if (fs.existsSync(this.costFile)) {
        const data = JSON.parse(fs.readFileSync(this.costFile, 'utf-8'));
        this.records = data.map((r: any) => ({
          ...r,
          timestamp: new Date(r.timestamp)
        }));
        console.log(`💰 Loaded ${this.records.length} cost records`);
      }
    } catch (error) {
      console.error('Failed to load cost records:', error);
    }
  }

  private saveRecords(): void {
    try {
      fs.writeFileSync(
        this.costFile,
        JSON.stringify(this.records, null, 2)
      );
    } catch (error) {
      console.error('Failed to save cost records:', error);
    }
  }

  /**
   * Record a new LLM operation cost
   */
  async recordCost(record: Omit<CostRecord, 'id' | 'timestamp'>): Promise<void> {
    const id = `cost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullRecord: CostRecord = {
      id,
      timestamp: new Date(),
      ...record
    };

    // Calculate cost if not provided
    if (fullRecord.cost === 0 && fullRecord.provider !== 'basic') {
      fullRecord.cost = this.calculateCost(
        fullRecord.provider,
        fullRecord.model,
        fullRecord.inputTokens,
        fullRecord.outputTokens
      );
    }

    this.records.push(fullRecord);
    this.saveRecords();

    // Check for cost alerts
    await this.checkCostAlerts(fullRecord);

    console.log(`💰 Recorded cost: $${fullRecord.cost.toFixed(4)} for ${fullRecord.operation}`);
  }

  private calculateCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const pricing = (this.pricing as any)[provider]?.[model];
    
    if (!pricing) {
      console.warn(`Unknown pricing for ${provider}/${model}, using default`);
      return (inputTokens * 0.001 + outputTokens * 0.003) / 1000;
    }

    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;
    
    return inputCost + outputCost;
  }

  private async checkCostAlerts(record: CostRecord): Promise<void> {
    const today = new Date().toDateString();
    const todaysCost = this.records
      .filter(r => r.timestamp.toDateString() === today)
      .reduce((sum, r) => sum + r.cost, 0);

    if (todaysCost > this.costLimits.daily) {
      console.warn(`⚠️  COST ALERT: Daily limit exceeded! ($${todaysCost.toFixed(2)}/${this.costLimits.daily})`);
    } else if (todaysCost > this.costLimits.daily * 0.8) {
      console.warn(`⚠️  Cost warning: Approaching daily limit ($${todaysCost.toFixed(2)}/${this.costLimits.daily})`);
    }
  }

  /**
   * Get comprehensive cost summary
   */
  async getCostSummary(startDate?: Date, endDate?: Date): Promise<CostSummary> {
    const filteredRecords = this.records.filter(r => {
      if (startDate && r.timestamp < startDate) return false;
      if (endDate && r.timestamp > endDate) return false;
      return true;
    });

    const summary: CostSummary = {
      totalCost: 0,
      totalOperations: filteredRecords.length,
      averageCostPerOperation: 0,
      byProvider: {},
      byOperation: {},
      byWeek: {},
      costTrends: {
        daily: [],
        weekly: [],
        projectedMonthly: 0
      },
      recommendations: []
    };

    if (filteredRecords.length === 0) {
      return summary;
    }

    // Calculate totals
    summary.totalCost = filteredRecords.reduce((sum, r) => sum + r.cost, 0);
    summary.averageCostPerOperation = summary.totalCost / filteredRecords.length;

    // Group by provider
    for (const record of filteredRecords) {
      if (!summary.byProvider[record.provider]) {
        summary.byProvider[record.provider] = {
          cost: 0,
          operations: 0,
          averageCost: 0,
          tokens: { input: 0, output: 0 }
        };
      }
      
      const provider = summary.byProvider[record.provider];
      provider.cost += record.cost;
      provider.operations++;
      provider.tokens.input += record.inputTokens;
      provider.tokens.output += record.outputTokens;
    }

    // Calculate provider averages
    for (const provider in summary.byProvider) {
      const data = summary.byProvider[provider];
      data.averageCost = data.cost / data.operations;
    }

    // Group by operation
    for (const record of filteredRecords) {
      if (!summary.byOperation[record.operation]) {
        summary.byOperation[record.operation] = {
          cost: 0,
          count: 0,
          averageCost: 0,
          successRate: 0
        };
      }
      
      const operation = summary.byOperation[record.operation];
      operation.cost += record.cost;
      operation.count++;
      if (record.success) operation.successRate++;
    }

    // Calculate operation metrics
    for (const operation in summary.byOperation) {
      const data = summary.byOperation[operation];
      data.averageCost = data.cost / data.count;
      data.successRate = (data.successRate / data.count) * 100;
    }

    // Group by week
    for (const record of filteredRecords) {
      const week = record.week || 0;
      if (!summary.byWeek[week]) {
        summary.byWeek[week] = { cost: 0, operations: 0 };
      }
      summary.byWeek[week].cost += record.cost;
      summary.byWeek[week].operations++;
    }

    // Calculate trends
    summary.costTrends = this.calculateTrends(filteredRecords);

    // Generate recommendations
    summary.recommendations = this.generateCostRecommendations(summary);

    return summary;
  }

  private calculateTrends(records: CostRecord[]): {
    daily: number[];
    weekly: number[];
    projectedMonthly: number;
  } {
    const dailyCosts: { [key: string]: number } = {};
    const weeklyCosts: { [key: string]: number } = {};

    for (const record of records) {
      const day = record.timestamp.toISOString().split('T')[0];
      const week = this.getWeekNumber(record.timestamp);
      
      dailyCosts[day] = (dailyCosts[day] || 0) + record.cost;
      weeklyCosts[week] = (weeklyCosts[week] || 0) + record.cost;
    }

    const dailyArray = Object.values(dailyCosts).slice(-30); // Last 30 days
    const weeklyArray = Object.values(weeklyCosts).slice(-12); // Last 12 weeks

    // Project monthly cost based on recent average
    const recentDailyAvg = dailyArray.slice(-7).reduce((a, b) => a + b, 0) / 7 || 0;
    const projectedMonthly = recentDailyAvg * 30;

    return {
      daily: dailyArray,
      weekly: weeklyArray,
      projectedMonthly
    };
  }

  private getWeekNumber(date: Date): string {
    const firstDay = new Date(date.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((date.getTime() - firstDay.getTime()) / 86400000 + firstDay.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${weekNum}`;
  }

  private generateCostRecommendations(summary: CostSummary): string[] {
    const recommendations: string[] = [];

    // Check if costs are too high
    if (summary.costTrends.projectedMonthly > this.costLimits.monthly) {
      recommendations.push(
        `⚠️ Projected monthly cost ($${summary.costTrends.projectedMonthly.toFixed(2)}) exceeds limit`
      );
    }

    // Recommend cheaper providers
    const providers = Object.entries(summary.byProvider)
      .sort((a, b) => a[1].averageCost - b[1].averageCost);
    
    if (providers.length > 1 && providers[0][1].averageCost < providers[providers.length - 1][1].averageCost * 0.5) {
      recommendations.push(
        `💡 Switch to ${providers[0][0]} for ${((1 - providers[0][1].averageCost / summary.averageCostPerOperation) * 100).toFixed(0)}% cost reduction`
      );
    }

    // Identify expensive operations
    const expensiveOps = Object.entries(summary.byOperation)
      .filter(([_, data]) => data.averageCost > summary.averageCostPerOperation * 1.5)
      .sort((a, b) => b[1].cost - a[1].cost);
    
    if (expensiveOps.length > 0) {
      recommendations.push(
        `🎯 Optimize "${expensiveOps[0][0]}" operations (${expensiveOps[0][1].count} calls, $${expensiveOps[0][1].cost.toFixed(2)} total)`
      );
    }

    // Suggest caching for frequent operations
    const frequentOps = Object.entries(summary.byOperation)
      .filter(([_, data]) => data.count > 10)
      .sort((a, b) => b[1].count - a[1].count);
    
    if (frequentOps.length > 0) {
      recommendations.push(
        `💾 Consider caching "${frequentOps[0][0]}" results (${frequentOps[0][1].count} calls)`
      );
    }

    return recommendations;
  }

  /**
   * Get cost optimization strategies
   */
  async getOptimizationStrategies(): Promise<CostOptimization[]> {
    const summary = await this.getCostSummary();
    const strategies: CostOptimization[] = [];

    // Strategy 1: Use cheaper models for simple tasks
    if (summary.byProvider['openai']?.operations > 10) {
      const potentialSavings = summary.byProvider['openai'].cost * 0.7;
      strategies.push({
        strategy: 'Use GPT-4o-mini for simple decisions',
        estimatedSavings: potentialSavings,
        impactOnPerformance: 'low',
        implementation: 'Switch to gpt-4o-mini for lineup optimization and basic queries'
      });
    }

    // Strategy 2: Batch operations
    const totalOps = summary.totalOperations;
    if (totalOps > 50) {
      strategies.push({
        strategy: 'Batch similar operations',
        estimatedSavings: summary.totalCost * 0.2,
        impactOnPerformance: 'low',
        implementation: 'Combine multiple team analyses into single LLM calls'
      });
    }

    // Strategy 3: Implement caching
    const repeatableOps = Object.entries(summary.byOperation)
      .filter(([_, data]) => data.count > 5);
    
    if (repeatableOps.length > 0) {
      const cacheSavings = repeatableOps.reduce((sum, [_, data]) => sum + data.cost * 0.5, 0);
      strategies.push({
        strategy: 'Implement intelligent caching',
        estimatedSavings: cacheSavings,
        impactOnPerformance: 'medium',
        implementation: 'Cache player rankings and weather data for 24 hours'
      });
    }

    // Strategy 4: Use basic logic for low-value decisions
    if (summary.averageCostPerOperation > 0.01) {
      strategies.push({
        strategy: 'Use rule-based logic for routine decisions',
        estimatedSavings: summary.totalCost * 0.3,
        impactOnPerformance: 'medium',
        implementation: 'Apply LLM only to complex multi-variable decisions'
      });
    }

    // Strategy 5: Optimize token usage
    const avgTokens = Object.values(summary.byProvider)
      .reduce((sum, p) => sum + p.tokens.input + p.tokens.output, 0) / (totalOps || 1);
    
    if (avgTokens > 1000) {
      strategies.push({
        strategy: 'Optimize prompt engineering',
        estimatedSavings: summary.totalCost * 0.15,
        impactOnPerformance: 'low',
        implementation: 'Use concise prompts and structured outputs to reduce token usage'
      });
    }

    return strategies.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
  }

  /**
   * Check if operation should use LLM based on cost-benefit
   */
  shouldUseLLM(operation: string, expectedValue: number): boolean {
    const operationStats = this.records
      .filter(r => r.operation === operation)
      .slice(-10); // Last 10 operations

    if (operationStats.length === 0) {
      // No history, use LLM if expected value is high
      return expectedValue > 10;
    }

    const avgCost = operationStats.reduce((sum, r) => sum + r.cost, 0) / operationStats.length;
    const successRate = operationStats.filter(r => r.success).length / operationStats.length;

    // Calculate cost-benefit ratio
    const expectedBenefit = expectedValue * successRate;
    const costBenefitRatio = expectedBenefit / avgCost;

    // Use LLM if benefit is at least 10x the cost
    return costBenefitRatio > 10;
  }

  /**
   * Get current usage against limits
   */
  getCurrentUsage(): {
    daily: { used: number; limit: number; percentage: number };
    weekly: { used: number; limit: number; percentage: number };
    monthly: { used: number; limit: number; percentage: number };
  } {
    const now = new Date();
    const today = now.toDateString();
    const weekStart = new Date(now.getTime() - (now.getDay() * 24 * 60 * 60 * 1000));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const dailyUsed = this.records
      .filter(r => r.timestamp.toDateString() === today)
      .reduce((sum, r) => sum + r.cost, 0);

    const weeklyUsed = this.records
      .filter(r => r.timestamp >= weekStart)
      .reduce((sum, r) => sum + r.cost, 0);

    const monthlyUsed = this.records
      .filter(r => r.timestamp >= monthStart)
      .reduce((sum, r) => sum + r.cost, 0);

    return {
      daily: {
        used: dailyUsed,
        limit: this.costLimits.daily,
        percentage: (dailyUsed / this.costLimits.daily) * 100
      },
      weekly: {
        used: weeklyUsed,
        limit: this.costLimits.weekly,
        percentage: (weeklyUsed / this.costLimits.weekly) * 100
      },
      monthly: {
        used: monthlyUsed,
        limit: this.costLimits.monthly,
        percentage: (monthlyUsed / this.costLimits.monthly) * 100
      }
    };
  }
}

export const enhancedCostMonitor = new EnhancedCostMonitor();