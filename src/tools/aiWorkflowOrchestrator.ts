import { WorkflowRequest, WorkflowResult, WorkflowContext, LeagueAnalysisResult } from '../types/workflow.js';
import { workflowContextBuilder } from '../services/workflowContext.js';
import { llmManager } from '../services/llm/manager.js';
import { LLMAnalysisRequest } from '../services/llm/types.js';
import { costMonitor } from '../services/costMonitor.js';

export class AIWorkflowOrchestrator {

  /**
   * Main entry point for AI-driven fantasy football workflow execution
   */
  async executeWorkflow(request: WorkflowRequest): Promise<WorkflowResult> {
    const startTime = Date.now();
    
    console.log(`🤖 Starting AI Workflow: ${request.task} for Week ${request.week}`);
    
    try {
      // Build comprehensive context
      const context = await workflowContextBuilder.buildContext(
        request.task,
        request.leagues,
        request.week,
        request.context
      );

      // Generate LLM prompts
      const prompts = workflowContextBuilder.generatePrompts(context, request.prompt);

      // Execute LLM analysis with MCP tools
      const llmResponse = await this.executeLLMAnalysis(prompts, context);

      // Parse and structure the results
      const workflowResult = await this.parseWorkflowResults(
        llmResponse,
        context,
        startTime
      );

      console.log(`✅ AI Workflow completed: ${request.task} (${Date.now() - startTime}ms)`);
      
      return workflowResult;

    } catch (error: any) {
      console.error(`❌ AI Workflow failed: ${request.task}`, error);
      
      // Return structured error response
      return {
        task: request.task,
        week: request.week,
        timestamp: new Date(),
        leagues: request.leagues.map(league => ({
          leagueId: league.leagueId,
          teamId: league.teamId,
          leagueName: league.leagueName,
          analysis: {},
          recommendations: [`Error occurred during analysis: ${error.message}`],
          confidence: 0
        })),
        summary: {
          keyInsights: [`Analysis failed: ${error.message}`],
          recommendations: ['Please check system status and try again'],
          confidence: 0,
          dataSourcesUsed: []
        },
        llmReasoning: `Error during LLM analysis: ${error.message}`,
        toolsUsed: [],
        costInfo: {
          tokensUsed: 0,
          estimatedCost: 0
        }
      };
    }
  }

  private async executeLLMAnalysis(prompts: any, context: WorkflowContext) {
    // Create LLM analysis request matching the expected interface
    const llmRequest: LLMAnalysisRequest = {
      context: {
        week: context.week,
        day_of_week: this.getDayOfWeek(context.task),
        action_type: this.mapWorkflowTaskToActionType(context.task),
        priority: this.getTaskPriority(context.task)
      },
      data: {
        league_info: context.leagues.map(league => ({
          leagueId: league.leagueId,
          teamId: league.teamId,
          leagueName: league.leagueName,
          teamName: league.teamName
        }))
      },
      user_preferences: {
        risk_tolerance: 'balanced',
        focus_areas: this.getFocusAreas(context.task),
        notification_style: 'comprehensive'
      }
    };

    // Execute with LLM manager
    return await llmManager.analyzeFantasyData(llmRequest);
  }

  private async parseWorkflowResults(
    llmResponse: any,
    context: WorkflowContext,
    startTime: number
  ): Promise<WorkflowResult> {
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;

    // Extract structured data from LLM response
    const leagueResults: LeagueAnalysisResult[] = context.leagues.map(league => {
      return {
        leagueId: league.leagueId,
        teamId: league.teamId,
        leagueName: league.leagueName,
        analysis: this.extractLeagueAnalysis(llmResponse, league.leagueId, context.task),
        recommendations: this.extractLeagueRecommendations(llmResponse, league.leagueId),
        confidence: this.calculateConfidence(llmResponse, context.task)
      };
    });

    // Build summary insights
    const summary = {
      keyInsights: this.extractKeyInsights(llmResponse, context.task),
      recommendations: this.extractGlobalRecommendations(llmResponse),
      confidence: this.calculateOverallConfidence(leagueResults),
      dataSourcesUsed: this.extractDataSources(llmResponse)
    };

    // Track cost information
    const costSummary = costMonitor.getCostSummary();
    const costInfo = {
      tokensUsed: llmResponse.usage?.total_tokens || 0,
      estimatedCost: costSummary.total || 0
    };

    return {
      task: context.task,
      week: context.week,
      timestamp: new Date(),
      leagues: leagueResults,
      summary,
      llmReasoning: llmResponse.content || llmResponse.message || 'LLM analysis completed',
      toolsUsed: llmResponse.toolsUsed || [],
      costInfo
    };
  }

  private getDayOfWeek(task: string): string {
    const dayMap: { [key: string]: string } = {
      'thursday_optimization': 'thursday',
      'sunday_check': 'sunday',
      'monday_analysis': 'monday',
      'tuesday_waivers': 'tuesday'
    };
    
    return dayMap[task] || 'unknown';
  }

  private mapWorkflowTaskToActionType(task: string): 'lineup' | 'waivers' | 'analysis' | 'urgent' {
    const actionMap: { [key: string]: 'lineup' | 'waivers' | 'analysis' | 'urgent' } = {
      'thursday_optimization': 'lineup',
      'sunday_check': 'lineup',
      'monday_analysis': 'analysis',
      'tuesday_waivers': 'waivers'
    };
    
    return actionMap[task] || 'analysis';
  }

  private getTaskPriority(task: string): 'low' | 'medium' | 'high' | 'critical' {
    const priorityMap: { [key: string]: 'low' | 'medium' | 'high' | 'critical' } = {
      'thursday_optimization': 'high',
      'sunday_check': 'critical',
      'monday_analysis': 'medium',
      'tuesday_waivers': 'medium'
    };
    
    return priorityMap[task] || 'medium';
  }

  private getFocusAreas(task: string): string[] {
    const focusMap: { [key: string]: string[] } = {
      'thursday_optimization': ['injuries', 'matchups', 'weather'],
      'sunday_check': ['inactives', 'late_news', 'pivots'],
      'monday_analysis': ['performance', 'waivers', 'roster_gaps'],
      'tuesday_waivers': ['availability', 'faab', 'streaming']
    };
    
    return focusMap[task] || ['general'];
  }

  private mapWorkflowTaskToLLMTask(task: string): string {
    const taskMap: { [key: string]: string } = {
      'thursday_optimization': 'lineup_optimization',
      'sunday_check': 'lineup_optimization',
      'monday_analysis': 'roster_analysis',
      'tuesday_waivers': 'waiver_analysis'
    };
    
    return taskMap[task] || 'general_analysis';
  }

  private getSeasonPhase(week: number): string {
    if (week <= 4) return 'early_season';
    if (week <= 8) return 'mid_season';
    if (week <= 12) return 'late_season';
    if (week <= 17) return 'playoffs';
    return 'championship';
  }

  private extractLeagueAnalysis(llmResponse: any, leagueId: string, task: string) {
    // Parse LLM response for league-specific analysis
    // This would extract structured data from the LLM response
    // For now, return basic structure
    return {
      // Will be populated based on LLM response parsing
    };
  }

  private extractLeagueRecommendations(llmResponse: any, leagueId: string): string[] {
    // Extract league-specific recommendations from LLM response
    const content = llmResponse.content || llmResponse.message || '';
    
    // Simple extraction - in production this would be more sophisticated
    const recommendations: string[] = [];
    const lines = content.split('\n');
    
    let inLeagueSection = false;
    for (const line of lines) {
      if (line.includes(leagueId) || line.includes('League')) {
        inLeagueSection = true;
        continue;
      }
      
      if (inLeagueSection && (line.startsWith('•') || line.startsWith('-') || line.includes('recommend'))) {
        recommendations.push(line.trim());
      }
      
      if (inLeagueSection && line.trim() === '') {
        inLeagueSection = false;
      }
    }
    
    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  private extractKeyInsights(llmResponse: any, task: string): string[] {
    const content = llmResponse.content || llmResponse.message || '';
    const insights: string[] = [];
    
    // Extract key insights based on task type
    const keywordMap: { [key: string]: string[] } = {
      'thursday_optimization': ['injury', 'weather', 'matchup', 'thursday'],
      'sunday_check': ['inactive', 'late', 'pivot', 'final'],
      'monday_analysis': ['performance', 'waiver', 'target', 'drop'],
      'tuesday_waivers': ['available', 'claim', 'budget', 'streaming']
    };
    
    const keywords = keywordMap[task] || [];
    const sentences = content.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      if (keywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
        insights.push(sentence.trim());
      }
    }
    
    return insights.slice(0, 3); // Top 3 insights
  }

  private extractGlobalRecommendations(llmResponse: any): string[] {
    // Extract high-level recommendations that apply across leagues
    const content = llmResponse.content || llmResponse.message || '';
    const lines = content.split('\n');
    
    const recommendations = lines
      .filter((line: string) => 
        line.includes('overall') || 
        line.includes('both leagues') || 
        line.includes('strategy') ||
        line.includes('recommend')
      )
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 10);
    
    return recommendations.slice(0, 3);
  }

  private calculateConfidence(llmResponse: any, task: string): number {
    // Calculate confidence based on response quality and task complexity
    let baseConfidence = 75;
    
    const content = llmResponse.content || llmResponse.message || '';
    
    // Boost confidence for detailed responses
    if (content.length > 1000) baseConfidence += 10;
    
    // Boost for tool usage
    if (llmResponse.toolsUsed && llmResponse.toolsUsed.length > 0) {
      baseConfidence += llmResponse.toolsUsed.length * 5;
    }
    
    // Adjust by task complexity
    const taskComplexity: { [key: string]: number } = {
      'thursday_optimization': 10,
      'sunday_check': 5,
      'monday_analysis': 15,
      'tuesday_waivers': 8
    };
    
    baseConfidence += taskComplexity[task] || 0;
    
    return Math.min(95, Math.max(30, baseConfidence));
  }

  private calculateOverallConfidence(leagueResults: LeagueAnalysisResult[]): number {
    if (leagueResults.length === 0) return 0;
    
    const avgConfidence = leagueResults.reduce((sum, result) => sum + result.confidence, 0) / leagueResults.length;
    return Math.round(avgConfidence);
  }

  private extractDataSources(llmResponse: any): string[] {
    const sources = ['ESPN API'];
    
    // Check if FantasyPros was used
    const content = llmResponse.content || llmResponse.message || '';
    if (content.toLowerCase().includes('fantasypros') || content.toLowerCase().includes('expert consensus')) {
      sources.push('FantasyPros');
    }
    
    // Add other sources based on tools used
    if (llmResponse.toolsUsed) {
      const toolSources: { [key: string]: string } = {
        'get_fantasypros_rankings': 'FantasyPros Rankings',
        'get_player_tiers': 'FantasyPros Tiers',
        'compare_player_value': 'ADP Comparison'
      };
      
      for (const tool of llmResponse.toolsUsed) {
        if (toolSources[tool] && !sources.includes(toolSources[tool])) {
          sources.push(toolSources[tool]);
        }
      }
    }
    
    return sources;
  }
}

// Export the main workflow execution function as an MCP tool
export async function executeAIWorkflow(args: {
  task: string;
  leagues: Array<{leagueId: string, teamId: string}>;
  week: number;
  prompt: string;
  context?: any;
}): Promise<WorkflowResult> {
  
  const orchestrator = new AIWorkflowOrchestrator();
  
  const request: WorkflowRequest = {
    task: args.task as any,
    leagues: args.leagues,
    week: args.week,
    prompt: args.prompt,
    context: args.context
  };
  
  return await orchestrator.executeWorkflow(request);
}

export const aiWorkflowOrchestrator = new AIWorkflowOrchestrator();