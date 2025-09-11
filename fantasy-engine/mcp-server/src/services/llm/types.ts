// Core interfaces for LLM provider abstraction

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface LLMToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface LLMToolResult {
  tool_call_id?: string;
  name: string;
  result: string;
  error?: string;
}

export interface LLMResponse {
  content: string;
  tool_calls?: LLMToolCall[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  finish_reason?: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

export interface LLMConfig {
  provider: 'claude' | 'openai' | 'perplexity' | 'gemini';
  model: string;
  api_key: string;
  max_tokens?: number;
  temperature?: number;
  base_url?: string; // For custom endpoints
}

export interface LLMProvider {
  name: string;
  models: string[];
  
  /**
   * Send a message to the LLM with optional tools
   */
  chat(
    messages: LLMMessage[],
    options?: {
      tools?: LLMTool[];
      max_tokens?: number;
      temperature?: number;
      tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    }
  ): Promise<LLMResponse>;
  
  /**
   * Execute tool calls and continue conversation
   */
  executeToolsAndContinue?(
    messages: LLMMessage[],
    toolCalls: LLMToolCall[],
    toolResults: LLMToolResult[],
    tools: LLMTool[]
  ): Promise<LLMResponse>;
  
  /**
   * Get pricing information per token
   */
  getPricing(): {
    input_cost_per_token: number;
    output_cost_per_token: number;
    currency: string;
  };
  
  /**
   * Validate configuration
   */
  validateConfig(config: Partial<LLMConfig>): Promise<boolean>;
}

export interface LLMAnalysisRequest {
  context: {
    week: number;
    day_of_week: string;
    action_type: 'lineup' | 'waivers' | 'analysis' | 'urgent';
    priority: 'low' | 'medium' | 'high' | 'critical';
  };
  data: {
    rosters?: any[];
    injuries?: any[];
    waiver_targets?: any[];
    league_info?: any[];
  };
  user_preferences?: {
    risk_tolerance: 'conservative' | 'balanced' | 'aggressive';
    focus_areas?: string[];
    notification_style: 'brief' | 'detailed' | 'comprehensive';
  };
}

export interface LLMAnalysisResponse {
  summary: string;
  recommendations: {
    type: 'lineup' | 'waiver' | 'trade' | 'alert';
    action: string;
    player?: string;
    confidence: number;
    reasoning: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  }[];
  cost_estimate: {
    tokens_used: number;
    estimated_cost: number;
    currency: string;
  };
  metadata: {
    provider: string;
    model: string;
    response_time_ms: number;
    tool_calls_made: number;
  };
}