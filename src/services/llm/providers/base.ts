import { LLMProvider, LLMConfig, LLMMessage, LLMTool, LLMResponse, LLMToolCall, LLMToolResult } from '../types.js';

export abstract class BaseLLMProvider implements LLMProvider {
  protected config: LLMConfig;
  
  constructor(config: LLMConfig) {
    this.config = config;
  }
  
  abstract get name(): string;
  abstract get models(): string[];
  
  abstract chat(
    messages: LLMMessage[],
    options?: {
      tools?: LLMTool[];
      max_tokens?: number;
      temperature?: number;
      tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    }
  ): Promise<LLMResponse>;
  
  abstract getPricing(): {
    input_cost_per_token: number;
    output_cost_per_token: number;
    currency: string;
  };
  
  async validateConfig(config: Partial<LLMConfig>): Promise<boolean> {
    try {
      if (!config.api_key) return false;
      
      // Basic test with a simple message
      const testMessages: LLMMessage[] = [
        { role: 'user', content: 'Hello, this is a test. Please respond with just "OK".' }
      ];
      
      const response = await this.chat(testMessages, { max_tokens: 10 });
      return response.content.toLowerCase().includes('ok');
    } catch (error) {
      console.error(`${this.name} config validation failed:`, error);
      return false;
    }
  }
  
  /**
   * Default implementation for tool execution continuation
   */
  async executeToolsAndContinue(
    messages: LLMMessage[],
    toolCalls: LLMToolCall[],
    toolResults: LLMToolResult[],
    tools: LLMTool[]
  ): Promise<LLMResponse> {
    // Add tool results to conversation
    const updatedMessages: LLMMessage[] = [
      ...messages,
      {
        role: 'assistant',
        content: `I need to use ${toolCalls.length} tools to help with your fantasy football analysis.`
      }
    ];
    
    // Add tool results as context
    for (let i = 0; i < toolResults.length; i++) {
      const result = toolResults[i];
      updatedMessages.push({
        role: 'user',
        content: `Tool "${result.name}" result: ${result.result}`
      });
    }
    
    // Continue conversation with tool context
    return this.chat(updatedMessages, { tools });
  }
  
  /**
   * Calculate cost estimate for a response
   */
  protected calculateCost(response: LLMResponse): number {
    const pricing = this.getPricing();
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    
    return (inputTokens * pricing.input_cost_per_token) + 
           (outputTokens * pricing.output_cost_per_token);
  }
  
  /**
   * Standardize messages for provider-specific formats
   */
  protected standardizeMessages(messages: LLMMessage[]): LLMMessage[] {
    return messages.map(msg => ({
      ...msg,
      content: msg.content.trim()
    }));
  }
  
  /**
   * Convert MCP tools to provider-specific format
   */
  protected convertTools(tools?: LLMTool[]): any[] {
    if (!tools) return [];
    
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      }
    }));
  }
  
  /**
   * Handle rate limiting with exponential backoff
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on auth errors or client errors
        if (error.status && (error.status < 500 && error.status !== 429)) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
          console.warn(`${this.name} request failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }
}