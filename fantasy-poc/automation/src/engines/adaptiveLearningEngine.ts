import { executeAIWorkflow } from '@fantasy-ai/shared';
import { writeFileSync, existsSync, readFileSync } from 'fs';

export interface DecisionHistory {
  id: string;
  timestamp: string;
  week: number;
  type: 'lineup' | 'waiver' | 'trade' | 'urgent';
  decision: any;
  outcome: {
    success: boolean;
    actualPoints: number;
    projectedPoints: number;
    improvement: number;
    confidence: number;
  };
  context: {
    weather?: string;
    injuries?: string[];
    news?: string[];
    opponents?: string[];
  };
  factors: {
    [key: string]: number; // Factor importance scores
  };
}

export interface Pattern {
  id: string;
  name: string;
  description: string;
  conditions: PatternCondition[];
  actions: PatternAction[];
  confidence: number;
  successRate: number;
  usage: number;
  lastUpdated: string;
  examples: string[];
}

export interface PatternCondition {
  factor: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'range';
  value: any;
  weight: number;
}

export interface PatternAction {
  type: string;
  description: string;
  confidence_boost: number;
}

export interface AntiPattern {
  id: string;
  name: string;
  description: string;
  warning_signs: string[];
  avoidance_rules: string[];
  failure_rate: number;
  cost: number; // Average points lost
  examples: string[];
}

export interface EvolutionResult {
  original_strategy: any;
  evolved_strategy: any;
  improvements: string[];
  confidence_adjustments: { [key: string]: number };
  expected_improvement: number;
  reasoning: string;
}

export class AdaptiveLearningEngine {
  private successPatterns: Pattern[] = [];
  private antiPatterns: AntiPattern[] = [];
  private decisionHistory: DecisionHistory[] = [];
  private learningMetrics = {
    patterns_discovered: 0,
    patterns_validated: 0,
    strategy_evolutions: 0,
    average_improvement: 0
  };

  constructor() {
    this.loadLearningData();
  }

  /**
   * Main learning cycle - analyze recent decisions and update patterns
   */
  async runLearningCycle(): Promise<void> {
    console.log('🧠 Starting adaptive learning cycle...');
    
    // Load recent decision history
    const recentDecisions = this.getRecentDecisions(14); // Last 2 weeks
    
    if (recentDecisions.length < 5) {
      console.log('📝 Insufficient decision history for learning cycle');
      return;
    }

    console.log(`📊 Analyzing ${recentDecisions.length} recent decisions`);

    // Identify new success patterns
    const newPatterns = await this.identifySuccessPatterns(recentDecisions);
    if (newPatterns.length > 0) {
      console.log(`✅ Discovered ${newPatterns.length} new success patterns`);
      this.successPatterns.push(...newPatterns);
    }

    // Identify anti-patterns from failures
    const newAntiPatterns = await this.identifyAntiPatterns(recentDecisions);
    if (newAntiPatterns.length > 0) {
      console.log(`⚠️ Identified ${newAntiPatterns.length} new anti-patterns`);
      this.antiPatterns.push(...newAntiPatterns);
    }

    // Update existing pattern confidence based on recent results
    await this.updatePatternConfidence(recentDecisions);

    // Evolve decision-making strategy
    await this.evolveDecisionStrategy(recentDecisions);

    // Save updated learning data
    this.saveLearningData();
    
    console.log('🎓 Learning cycle complete');
    this.printLearningMetrics();
  }

  /**
   * Identify successful decision patterns
   */
  async identifySuccessPatterns(decisions: DecisionHistory[]): Promise<Pattern[]> {
    const successfulDecisions = decisions.filter(d => 
      d.outcome.success && d.outcome.improvement > 3 // Significant improvement
    );

    if (successfulDecisions.length < 3) {
      return [];
    }

    console.log(`🔍 Analyzing ${successfulDecisions.length} successful decisions for patterns...`);

    const patternAnalysis = await executeAIWorkflow({
      task: 'pattern_identification',
      leagues: [], // Not league-specific
      week: 0,
      prompt: `Analyze these successful fantasy football decisions to identify actionable patterns:

              Successful Decisions Data:
              ${JSON.stringify(successfulDecisions.map(d => ({
                type: d.type,
                improvement: d.outcome.improvement,
                context: d.context,
                factors: d.factors,
                decision_summary: d.decision.summary
              })), null, 2)}

              Identify patterns that meet these criteria:
              1. REPEATABLE: Can be applied to future similar situations
              2. SPECIFIC: Clear conditions when pattern applies
              3. ACTIONABLE: Concrete actions to take when pattern is detected
              4. MEASURABLE: Quantifiable success criteria

              For each pattern, provide:
              - Pattern Name: Clear, descriptive name
              - Conditions: Specific factors that trigger this pattern
              - Actions: What to do when pattern is detected
              - Confidence: How reliable this pattern appears (0-100)
              - Examples: References to specific decisions that demonstrate this pattern

              Focus on patterns with at least 70% confidence and 3+ examples.`
    });

    return this.parsePatterns(patternAnalysis);
  }

  /**
   * Identify failure patterns to avoid
   */
  async identifyAntiPatterns(decisions: DecisionHistory[]): Promise<AntiPattern[]> {
    const failedDecisions = decisions.filter(d => 
      !d.outcome.success || d.outcome.improvement < -2 // Significant loss
    );

    if (failedDecisions.length < 2) {
      return [];
    }

    console.log(`🚫 Analyzing ${failedDecisions.length} failed decisions for anti-patterns...`);

    const antiPatternAnalysis = await executeAIWorkflow({
      task: 'antipattern_identification',
      leagues: [],
      week: 0,
      prompt: `Analyze these failed fantasy football decisions to identify anti-patterns to avoid:

              Failed Decisions Data:
              ${JSON.stringify(failedDecisions.map(d => ({
                type: d.type,
                improvement: d.outcome.improvement,
                context: d.context,
                factors: d.factors,
                decision_summary: d.decision.summary,
                failure_reason: d.outcome.improvement < -5 ? 'major_loss' : 'minor_loss'
              })), null, 2)}

              Identify anti-patterns that show:
              1. COMMON MISTAKES: Recurring errors in decision-making
              2. WARNING SIGNS: Early indicators that predict failure
              3. AVOIDANCE RULES: Specific conditions to avoid or approach with caution
              4. COST ANALYSIS: Typical point losses from each anti-pattern

              For each anti-pattern, provide:
              - Anti-Pattern Name: Clear description of the mistake
              - Warning Signs: Early indicators this mistake is about to happen
              - Avoidance Rules: Specific rules to prevent this mistake
              - Failure Rate: How often this pattern leads to poor outcomes
              - Average Cost: Typical point loss when this anti-pattern occurs
              - Examples: Specific failed decisions that demonstrate this anti-pattern

              Focus on anti-patterns that appear in 2+ decisions with significant impact.`
    });

    return this.parseAntiPatterns(antiPatternAnalysis);
  }

  /**
   * Update confidence scores for existing patterns based on recent results
   */
  async updatePatternConfidence(decisions: DecisionHistory[]): Promise<void> {
    console.log(`📈 Updating confidence for ${this.successPatterns.length} existing patterns...`);

    for (const pattern of this.successPatterns) {
      // Find decisions that match this pattern
      const matchingDecisions = decisions.filter(d => 
        this.doesDecisionMatchPattern(d, pattern)
      );

      if (matchingDecisions.length > 0) {
        const successCount = matchingDecisions.filter(d => d.outcome.success).length;
        const successRate = successCount / matchingDecisions.length;
        
        // Update pattern confidence with weighted average
        const oldWeight = pattern.usage;
        const newWeight = matchingDecisions.length;
        const totalWeight = oldWeight + newWeight;
        
        pattern.successRate = (pattern.successRate * oldWeight + successRate * newWeight) / totalWeight;
        pattern.confidence = Math.min(95, pattern.successRate * 100);
        pattern.usage += matchingDecisions.length;
        pattern.lastUpdated = new Date().toISOString();

        console.log(`📊 Pattern "${pattern.name}": ${successCount}/${matchingDecisions.length} success (${(successRate * 100).toFixed(1)}%)`);
      }
    }
  }

  /**
   * Evolve decision-making strategy based on learning
   */
  async evolveDecisionStrategy(decisions: DecisionHistory[]): Promise<EvolutionResult | null> {
    // Load current strategy
    const currentStrategy = this.loadCurrentStrategy();
    
    // Analyze strategy performance
    const performanceAnalysis = this.analyzeStrategyPerformance(decisions);
    
    if (performanceAnalysis.needs_evolution) {
      console.log('🔄 Strategy evolution needed based on performance analysis...');
      
      const evolution = await executeAIWorkflow({
        task: 'strategy_evolution',
        leagues: [],
        week: 0,
        prompt: `Evolve the fantasy football decision-making strategy based on performance analysis:

                Current Strategy:
                ${JSON.stringify(currentStrategy, null, 2)}

                Performance Analysis:
                - Success Rate: ${performanceAnalysis.success_rate}%
                - Average Improvement: ${performanceAnalysis.avg_improvement} points
                - Strong Areas: ${performanceAnalysis.strengths.join(', ')}
                - Weak Areas: ${performanceAnalysis.weaknesses.join(', ')}
                
                Identified Success Patterns:
                ${this.successPatterns.slice(0, 5).map(p => 
                  `- ${p.name}: ${p.successRate * 100}% success rate`
                ).join('\n')}

                Identified Anti-Patterns:
                ${this.antiPatterns.slice(0, 3).map(ap => 
                  `- ${ap.name}: Costs avg ${ap.cost} points`
                ).join('\n')}

                Evolve the strategy to:
                1. AMPLIFY successful patterns by increasing their influence
                2. MINIMIZE anti-patterns through better safeguards
                3. ADJUST confidence thresholds based on actual vs predicted performance
                4. OPTIMIZE risk tolerance based on recent outcomes

                Provide specific strategy modifications with quantified improvements.`
      });

      const evolutionResult = this.parseEvolutionResult(evolution, currentStrategy);
      if (evolutionResult) {
        this.saveEvolvedStrategy(evolutionResult.evolved_strategy);
        this.learningMetrics.strategy_evolutions++;
        
        console.log(`🚀 Strategy evolved: ${evolutionResult.improvements.length} improvements`);
        console.log(`📈 Expected improvement: +${evolutionResult.expected_improvement} points/week`);
        
        return evolutionResult;
      }
    }

    return null;
  }

  /**
   * Apply learned patterns to enhance a new decision
   */
  async enhanceDecisionWithLearning(
    decision: any, 
    context: any
  ): Promise<{ enhanced_decision: any; applied_patterns: string[]; confidence_boost: number }> {
    console.log('🧠 Applying learned patterns to enhance decision...');

    const appliedPatterns: string[] = [];
    let confidenceBoost = 0;

    // Check for matching success patterns
    for (const pattern of this.successPatterns) {
      if (pattern.confidence > 70 && this.doesContextMatchPattern(context, pattern)) {
        appliedPatterns.push(pattern.name);
        confidenceBoost += pattern.confidence / 100 * 0.1; // Small confidence boost per pattern
        
        // Apply pattern-specific enhancements
        decision = this.applyPatternEnhancements(decision, pattern);
      }
    }

    // Check for anti-pattern warnings
    const antiPatternWarnings: string[] = [];
    for (const antiPattern of this.antiPatterns) {
      if (this.doesContextTriggerAntiPattern(context, antiPattern)) {
        antiPatternWarnings.push(antiPattern.name);
        confidenceBoost -= 0.2; // Reduce confidence if anti-pattern detected
      }
    }

    // Add learning-based insights to decision
    const enhancedDecision = {
      ...decision,
      learning_insights: {
        applied_patterns: appliedPatterns,
        anti_pattern_warnings: antiPatternWarnings,
        confidence_adjustment: confidenceBoost,
        pattern_based_recommendations: this.generatePatternRecommendations(appliedPatterns)
      }
    };

    console.log(`✅ Applied ${appliedPatterns.length} patterns, ${antiPatternWarnings.length} warnings`);

    return {
      enhanced_decision: enhancedDecision,
      applied_patterns: appliedPatterns,
      confidence_boost: confidenceBoost
    };
  }

  // Helper methods for pattern matching and data management
  private doesDecisionMatchPattern(decision: DecisionHistory, pattern: Pattern): boolean {
    return pattern.conditions.every(condition => {
      const value = this.extractFactorValue(decision, condition.factor);
      return this.evaluateCondition(value, condition);
    });
  }

  private doesContextMatchPattern(context: any, pattern: Pattern): boolean {
    // Simplified pattern matching for context
    return pattern.conditions.some(condition => {
      const contextValue = context[condition.factor];
      return this.evaluateCondition(contextValue, condition);
    });
  }

  private doesContextTriggerAntiPattern(context: any, antiPattern: AntiPattern): boolean {
    return antiPattern.warning_signs.some(sign => 
      JSON.stringify(context).toLowerCase().includes(sign.toLowerCase())
    );
  }

  private evaluateCondition(value: any, condition: PatternCondition): boolean {
    switch (condition.operator) {
      case 'equals': return value === condition.value;
      case 'greater_than': return value > condition.value;
      case 'less_than': return value < condition.value;
      case 'contains': return String(value).includes(condition.value);
      case 'range': return value >= condition.value[0] && value <= condition.value[1];
      default: return false;
    }
  }

  private extractFactorValue(decision: DecisionHistory, factor: string): any {
    return decision.factors[factor] || decision.context[factor as keyof typeof decision.context];
  }

  private applyPatternEnhancements(decision: any, pattern: Pattern): any {
    // Apply pattern-specific enhancements to the decision
    const enhanced = { ...decision };
    
    for (const action of pattern.actions) {
      if (action.type === 'confidence_boost') {
        enhanced.confidence = Math.min(100, (enhanced.confidence || 70) + action.confidence_boost);
      }
      // Add other enhancement types as needed
    }

    return enhanced;
  }

  private generatePatternRecommendations(appliedPatterns: string[]): string[] {
    return appliedPatterns.map(patternName => {
      const pattern = this.successPatterns.find(p => p.name === patternName);
      return pattern ? `Based on pattern "${pattern.name}": ${pattern.description}` : '';
    }).filter(rec => rec.length > 0);
  }

  // Data persistence and management
  private loadLearningData(): void {
    try {
      if (existsSync('learning_patterns.json')) {
        const data = JSON.parse(readFileSync('learning_patterns.json', 'utf8'));
        this.successPatterns = data.success_patterns || [];
        this.antiPatterns = data.anti_patterns || [];
        this.learningMetrics = data.metrics || this.learningMetrics;
      }

      if (existsSync('decision_history.json')) {
        this.decisionHistory = JSON.parse(readFileSync('decision_history.json', 'utf8'));
      }
    } catch (error) {
      console.warn('Could not load learning data:', error);
    }
  }

  private saveLearningData(): void {
    try {
      const learningData = {
        success_patterns: this.successPatterns,
        anti_patterns: this.antiPatterns,
        metrics: this.learningMetrics,
        last_updated: new Date().toISOString()
      };
      
      writeFileSync('learning_patterns.json', JSON.stringify(learningData, null, 2));
      writeFileSync('decision_history.json', JSON.stringify(this.decisionHistory.slice(0, 500), null, 2));
    } catch (error) {
      console.error('Could not save learning data:', error);
    }
  }

  private getRecentDecisions(days: number): DecisionHistory[] {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.decisionHistory.filter(d => new Date(d.timestamp) > cutoff);
  }

  private loadCurrentStrategy(): any {
    try {
      if (existsSync('current_strategy.json')) {
        return JSON.parse(readFileSync('current_strategy.json', 'utf8'));
      }
    } catch (error) {
      console.warn('Could not load current strategy:', error);
    }
    
    // Default strategy
    return {
      confidence_thresholds: { low: 60, medium: 75, high: 85 },
      risk_tolerance: 'balanced',
      pattern_weights: {},
      decision_factors: {
        expert_consensus: 0.3,
        ai_analysis: 0.4,
        historical_performance: 0.2,
        situational_factors: 0.1
      }
    };
  }

  private saveEvolvedStrategy(strategy: any): void {
    try {
      writeFileSync('current_strategy.json', JSON.stringify(strategy, null, 2));
    } catch (error) {
      console.error('Could not save evolved strategy:', error);
    }
  }

  private analyzeStrategyPerformance(decisions: DecisionHistory[]): any {
    const successfulDecisions = decisions.filter(d => d.outcome.success);
    const successRate = (successfulDecisions.length / decisions.length) * 100;
    const avgImprovement = decisions.reduce((sum, d) => sum + d.outcome.improvement, 0) / decisions.length;

    return {
      success_rate: successRate,
      avg_improvement: avgImprovement,
      needs_evolution: successRate < 70 || avgImprovement < 2,
      strengths: this.identifyStrengths(decisions),
      weaknesses: this.identifyWeaknesses(decisions)
    };
  }

  private identifyStrengths(decisions: DecisionHistory[]): string[] {
    // Analyze what types of decisions are most successful
    const strengths = [];
    const byType = this.groupBy(decisions, 'type');
    
    for (const [type, typeDecisions] of Object.entries(byType)) {
      const successRate = typeDecisions.filter((d: any) => d.outcome.success).length / typeDecisions.length;
      if (successRate > 0.8) {
        strengths.push(`${type}_decisions`);
      }
    }
    
    return strengths;
  }

  private identifyWeaknesses(decisions: DecisionHistory[]): string[] {
    // Analyze what types of decisions are least successful
    const weaknesses = [];
    const byType = this.groupBy(decisions, 'type');
    
    for (const [type, typeDecisions] of Object.entries(byType)) {
      const successRate = typeDecisions.filter((d: any) => d.outcome.success).length / typeDecisions.length;
      if (successRate < 0.6) {
        weaknesses.push(`${type}_decisions`);
      }
    }
    
    return weaknesses;
  }

  private groupBy(array: any[], key: string): { [key: string]: any[] } {
    return array.reduce((groups, item) => {
      const group = item[key];
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  }

  private parsePatterns(analysis: any): Pattern[] {
    // Parse AI response into structured patterns
    // This would be implemented based on the AI response format
    return [];
  }

  private parseAntiPatterns(analysis: any): AntiPattern[] {
    // Parse AI response into structured anti-patterns
    return [];
  }

  private parseEvolutionResult(evolution: any, currentStrategy: any): EvolutionResult | null {
    // Parse AI response into structured evolution result
    return null;
  }

  private printLearningMetrics(): void {
    console.log('\n📊 Learning Metrics Summary:');
    console.log(`   Success Patterns: ${this.successPatterns.length}`);
    console.log(`   Anti-Patterns: ${this.antiPatterns.length}`);
    console.log(`   Strategy Evolutions: ${this.learningMetrics.strategy_evolutions}`);
    console.log(`   Decision History: ${this.decisionHistory.length} records`);
  }
}

// CLI function for running learning cycles
export async function runAdaptiveLearning(): Promise<void> {
  const engine = new AdaptiveLearningEngine();
  await engine.runLearningCycle();
}