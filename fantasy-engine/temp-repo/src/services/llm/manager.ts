import { LLMProvider, LLMConfig, LLMAnalysisRequest, LLMAnalysisResponse, LLMMessage, LLMTool } from './types.js';
import { ClaudeProvider } from './providers/claude.js';
import { OpenAIProvider } from './providers/openai.js';
import { PerplexityProvider } from './providers/perplexity.js';
import { GeminiProvider } from './providers/gemini.js';
import { costMonitor } from '../costMonitor.js';
import { SYSTEM_PROMPTS, formatPromptForProvider } from '../../config/systemPrompts.js';

export class LLMManager {
  private providers: Map<string, LLMProvider> = new Map();
  private currentProvider: LLMProvider | null = null;
  private config: LLMConfig | null = null;

  /**
   * Initialize LLM manager with configuration
   */
  async initialize(config: LLMConfig): Promise<boolean> {
    try {
      this.config = config;
      
      // Create provider instance
      let provider: LLMProvider;
      
      switch (config.provider) {
        case 'claude':
          provider = new ClaudeProvider(config);
          break;
        case 'openai':
          provider = new OpenAIProvider(config);
          break;
        case 'perplexity':
          provider = new PerplexityProvider(config);
          break;
        case 'gemini':
          provider = new GeminiProvider(config);
          break;
        default:
          throw new Error(`Unsupported provider: ${config.provider}`);
      }

      // Validate configuration
      const isValid = await provider.validateConfig(config);
      if (!isValid) {
        throw new Error(`Failed to validate ${config.provider} configuration`);
      }

      this.providers.set(config.provider, provider);
      this.currentProvider = provider;
      
      console.log(`✅ ${provider.name} initialized successfully with model ${config.model}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Failed to initialize ${config.provider}:`, error.message);
      return false;
    }
  }

  /**
   * Switch to a different provider
   */
  async switchProvider(newConfig: LLMConfig): Promise<boolean> {
    const success = await this.initialize(newConfig);
    if (success) {
      console.log(`🔄 Switched to ${newConfig.provider} (${newConfig.model})`);
    }
    return success;
  }

  /**
   * Get available models for a provider
   */
  getAvailableModels(providerName: string): string[] {
    const tempConfig: LLMConfig = {
      provider: providerName as any,
      model: '',
      api_key: 'temp'
    };

    let provider: LLMProvider;
    switch (providerName) {
      case 'claude':
        provider = new ClaudeProvider(tempConfig);
        break;
      case 'openai':
        provider = new OpenAIProvider(tempConfig);
        break;
      case 'perplexity':
        provider = new PerplexityProvider(tempConfig);
        break;
      case 'gemini':
        provider = new GeminiProvider(tempConfig);
        break;
      default:
        return [];
    }

    return provider.models;
  }

  /**
   * Get pricing for current provider
   */
  getCurrentPricing(): { provider: string; model: string; pricing: any } | null {
    if (!this.currentProvider || !this.config) return null;

    return {
      provider: this.config.provider,
      model: this.config.model,
      pricing: this.currentProvider.getPricing()
    };
  }

  /**
   * Analyze fantasy football data with current provider
   */
  async analyzeFantasyData(request: LLMAnalysisRequest): Promise<LLMAnalysisResponse> {
    if (!this.currentProvider || !this.config) {
      throw new Error('LLM manager not initialized');
    }

    const startTime = Date.now();

    // Build context-rich system message
    const systemPrompt = this.buildSystemPrompt(request);
    
    // Build user message with data
    const userPrompt = this.buildUserPrompt(request);

    // Create messages
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    // Define available tools
    const tools = this.getFantasyTools();

    try {
      // Make initial request
      let response = await this.currentProvider.chat(messages, {
        tools,
        max_tokens: 4000,
        temperature: 0.3, // Lower temperature for more consistent fantasy advice
        tool_choice: 'auto'
      });

      let toolCallCount = 0;
      
      // Handle tool calls
      if (response.tool_calls && response.tool_calls.length > 0) {
        // Execute tools and continue conversation
        const toolResults = await this.executeFantasyTools(response.tool_calls);
        toolCallCount = response.tool_calls.length;

        // Continue conversation with tool results
        if (this.currentProvider.executeToolsAndContinue) {
          response = await this.currentProvider.executeToolsAndContinue(
            messages,
            response.tool_calls,
            toolResults,
            tools
          );
        }
      }

      // Parse response for recommendations
      const recommendations = this.parseRecommendations(response.content);

      // Calculate cost
      const pricing = this.currentProvider.getPricing();
      const tokensUsed = response.usage?.total_tokens || 0;
      const estimatedCost = (response.usage?.input_tokens || 0) * pricing.input_cost_per_token +
                           (response.usage?.output_tokens || 0) * pricing.output_cost_per_token;

      // Log cost and check for alerts
      const costAlerts = await costMonitor.logCost({
        provider: this.config.provider,
        model: this.config.model,
        cost: estimatedCost,
        tokens_used: tokensUsed,
        action_type: request.context.action_type,
        week: request.context.week
      });

      // Add cost alerts to recommendations if any
      if (costAlerts.length > 0) {
        costAlerts.forEach(alert => {
          const alertRec: any = {
            type: 'alert',
            action: `COST ALERT: ${alert.type} limit ${alert.percentage > 100 ? 'exceeded' : 'approaching'}`,
            confidence: 100,
            reasoning: alert.recommendation,
            urgency: alert.percentage > 100 ? 'critical' : 'high'
          };
          recommendations.push(alertRec);
        });
      }

      return {
        summary: response.content,
        recommendations,
        cost_estimate: {
          tokens_used: tokensUsed,
          estimated_cost: estimatedCost,
          currency: pricing.currency
        },
        metadata: {
          provider: this.currentProvider.name,
          model: this.config.model,
          response_time_ms: Date.now() - startTime,
          tool_calls_made: toolCallCount
        }
      };

    } catch (error: any) {
      throw new Error(`Fantasy analysis failed: ${error.message}`);
    }
  }

  private buildSystemPrompt(request: LLMAnalysisRequest): string {
    const { context, user_preferences } = request;
    
    // Select appropriate system prompt based on action type
    let basePrompt: string;
    switch (context.action_type?.toLowerCase()) {
      case 'waiver_analysis':
        basePrompt = SYSTEM_PROMPTS.WAIVER_ANALYSIS;
        break;
      case 'lineup_optimization':
        basePrompt = SYSTEM_PROMPTS.LINEUP_OPTIMIZATION;
        break;
      case 'trade_analysis':
        basePrompt = SYSTEM_PROMPTS.TRADE_ANALYSIS;
        break;
      case 'weekly_analysis':
        basePrompt = SYSTEM_PROMPTS.WEEKLY_ANALYSIS;
        break;
      default:
        basePrompt = SYSTEM_PROMPTS.BASE;
    }
    
    // Add current context
    const contextualPrompt = basePrompt + `

## Current Session Context
- **Week ${context.week}** of the 2025 NFL season
- **Day**: ${context.day_of_week}
- **Analysis Type**: ${context.action_type}
- **Priority Level**: ${context.priority}

## User Preferences
- **Risk Tolerance**: ${user_preferences?.risk_tolerance || 'balanced'}
- **Focus Areas**: ${user_preferences?.focus_areas?.join(', ') || 'general optimization'}
- **Notification Style**: ${user_preferences?.notification_style || 'detailed'}

## Data Sources Available
- Real-time ESPN Fantasy Football API data
- Current roster compositions and player status
- Waiver wire availability and ownership percentages
- Injury reports and player news updates
- Weekly projections and matchup analysis
- Optional FantasyPros expert consensus (when enabled)

## Response Requirements
- Provide specific, actionable recommendations
- Include confidence levels (High/Medium/Low)
- Reference data sources supporting decisions
- Flag injury concerns and game-time decisions
- Suggest alternative options for risky plays

Begin your analysis with the most critical recommendations and provide clear reasoning for each decision.`;

    // Format for specific provider if needed
    return formatPromptForProvider(
      contextualPrompt, 
      '', 
      this.config?.provider || 'generic'
    );
  }

  private buildUserPrompt(request: LLMAnalysisRequest): string {
    const { context, data } = request;
    
    let prompt = `Please analyze my fantasy football situation for Week ${context.week}.\n\n`;

    if (context.action_type === 'lineup') {
      prompt += '**OBJECTIVE: Optimize my starting lineup**\n';
      prompt += '- Check for injuries or questionable players\n';
      prompt += '- Identify best matchups\n';
      prompt += '- Recommend any lineup changes\n\n';
    } else if (context.action_type === 'waivers') {
      prompt += '**OBJECTIVE: Identify waiver wire opportunities**\n';
      prompt += '- Find players to add\n';
      prompt += '- Suggest players to drop\n';
      prompt += '- Prioritize claims by value\n\n';
    } else if (context.action_type === 'analysis') {
      prompt += '**OBJECTIVE: Post-game analysis and planning**\n';
      prompt += '- Review week performance\n';
      prompt += '- Identify trends and concerns\n';
      prompt += '- Plan for upcoming week\n\n';
    }

    // Add data context if available
    if (data.rosters && data.rosters.length > 0) {
      prompt += `**ROSTER DATA AVAILABLE**\n`;
      prompt += `I have ${data.rosters.length} team roster(s) to analyze.\n\n`;
    }

    if (data.injuries && data.injuries.length > 0) {
      prompt += `**INJURY ALERTS**\n`;
      data.injuries.forEach((injury: any) => {
        prompt += `- ${injury.fullName} (${injury.position}): ${injury.injuryStatus}\n`;
      });
      prompt += '\n';
    }

    if (data.waiver_targets && data.waiver_targets.length > 0) {
      prompt += `**WAIVER WIRE DATA AVAILABLE**\n`;
      prompt += `Top available players have been identified for analysis.\n\n`;
    }

    prompt += 'Please use the available tools to get the latest data and provide your recommendations.';

    return prompt;
  }

  private getFantasyTools(): LLMTool[] {
    return [
      {
        name: 'get_roster',
        description: 'Get current roster for a fantasy team with all player details',
        input_schema: {
          type: 'object',
          properties: {
            leagueId: { type: 'string', description: 'ESPN Fantasy league ID' },
            teamId: { type: 'string', description: 'Team ID within the league' }
          },
          required: ['leagueId', 'teamId']
        }
      },
      {
        name: 'optimize_lineup',
        description: 'Get optimal lineup recommendations based on projections and matchups',
        input_schema: {
          type: 'object',
          properties: {
            leagueId: { type: 'string' },
            teamId: { type: 'string' },
            week: { type: 'number', description: 'Week number (optional)' }
          },
          required: ['leagueId', 'teamId']
        }
      },
      {
        name: 'find_waiver_targets',
        description: 'Find and rank available players on waivers with pickup recommendations',
        input_schema: {
          type: 'object',
          properties: {
            leagueId: { type: 'string' },
            teamId: { type: 'string', description: 'Optional - provides drop candidates' },
            position: { type: 'string', description: 'Filter by position (QB, RB, WR, TE, K, DST)' },
            maxResults: { type: 'number', description: 'Maximum number of results (default 10)' }
          },
          required: ['leagueId']
        }
      },
      {
        name: 'my_roster',
        description: 'Get YOUR roster using team aliases - specify "league 1" or "league 2"',
        input_schema: {
          type: 'object',
          properties: {
            team: { type: 'string', description: 'Optional: "league 1" (default) or "league 2"' }
          }
        }
      }
    ];
  }

  private async executeFantasyTools(toolCalls: any[]): Promise<any[]> {
    // This would integrate with your existing MCP tool execution
    // For now, return mock results
    return toolCalls.map(call => ({
      name: call.name,
      result: `Tool ${call.name} executed with args: ${JSON.stringify(call.arguments)}`,
      tool_call_id: `call_${Date.now()}`
    }));
  }

  private parseRecommendations(content: string): any[] {
    // Parse the LLM response for structured recommendations
    const recommendations = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Look for recommendation patterns
      if (line.includes('START:') || line.includes('BENCH:') || line.includes('ADD:') || line.includes('DROP:')) {
        const confidence = this.extractConfidence(line);
        
        recommendations.push({
          type: this.determineRecommendationType(line),
          action: line.trim(),
          confidence: confidence,
          reasoning: this.extractReasoning(line),
          urgency: this.determineUrgency(line, confidence)
        });
      }
    }
    
    return recommendations;
  }

  private extractConfidence(line: string): number {
    const match = line.match(/(\d+)%/);
    if (match) return parseInt(match[1]);
    
    // Default confidence based on keywords
    if (line.includes('MUST') || line.includes('CRITICAL')) return 95;
    if (line.includes('SHOULD') || line.includes('RECOMMEND')) return 80;
    if (line.includes('CONSIDER') || line.includes('MIGHT')) return 60;
    return 70;
  }

  private determineRecommendationType(line: string): string {
    if (line.includes('START') || line.includes('BENCH')) return 'lineup';
    if (line.includes('ADD') || line.includes('DROP')) return 'waiver';
    if (line.includes('TRADE')) return 'trade';
    return 'alert';
  }

  private extractReasoning(line: string): string {
    // Extract reasoning from parentheses or after dash
    const reasonMatch = line.match(/\((.*?)\)|-(.*?)$/);
    return reasonMatch ? (reasonMatch[1] || reasonMatch[2]).trim() : 'See analysis above';
  }

  private determineUrgency(line: string, confidence: number): 'low' | 'medium' | 'high' | 'critical' {
    if (line.includes('INJURY') || line.includes('OUT') || confidence >= 90) return 'critical';
    if (line.includes('QUESTIONABLE') || confidence >= 80) return 'high';
    if (confidence >= 70) return 'medium';
    return 'low';
  }
}

// Singleton instance
export const llmManager = new LLMManager();