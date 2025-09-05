import OpenAI from 'openai'; // Perplexity uses OpenAI-compatible API
import { BaseLLMProvider } from './base.js';
import { LLMMessage, LLMTool, LLMResponse, LLMConfig } from '../types.js';

export class PerplexityProvider extends BaseLLMProvider {
  private client: OpenAI;
  
  constructor(config: LLMConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.api_key,
      baseURL: config.base_url || 'https://api.perplexity.ai'
    });
  }
  
  get name(): string {
    return 'Perplexity';
  }
  
  get models(): string[] {
    return [
      'llama-3.1-sonar-huge-128k-online',
      'llama-3.1-sonar-large-128k-online',
      'llama-3.1-sonar-small-128k-online',
      'llama-3.1-sonar-huge-128k-chat',
      'llama-3.1-sonar-large-128k-chat',
      'llama-3.1-sonar-small-128k-chat'
    ];
  }
  
  async chat(
    messages: LLMMessage[],
    options?: {
      tools?: LLMTool[];
      max_tokens?: number;
      temperature?: number;
      tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    }
  ): Promise<LLMResponse> {
    return this.withRetry(async () => {
      const startTime = Date.now();
      
      // Convert messages to Perplexity format
      const perplexityMessages = this.standardizeMessages(messages).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      const requestOptions: any = {
        model: this.config.model,
        messages: perplexityMessages,
        max_tokens: options?.max_tokens || this.config.max_tokens || 4000,
        temperature: options?.temperature || this.config.temperature || 0.7,
        stream: false
      };
      
      // Perplexity doesn't support function calling yet, so we'll simulate it
      // by including tool descriptions in the system message
      if (options?.tools && options.tools.length > 0) {
        const toolDescriptions = options.tools.map(tool => 
          `${tool.name}: ${tool.description}`
        ).join('\n');
        
        // Add tool information to the last message
        const lastMessage = perplexityMessages[perplexityMessages.length - 1];
        if (lastMessage.role === 'user') {
          lastMessage.content += `\n\nAvailable tools:\n${toolDescriptions}\n\nIf you need to use any tools, please indicate which tool you want to use and provide the required parameters in JSON format.`;
        }
      }
      
      const response = await this.client.chat.completions.create(requestOptions);
      const responseTime = Date.now() - startTime;
      
      const message = response.choices[0]?.message;
      if (!message) {
        throw new Error('No message in Perplexity response');
      }
      
      // Parse potential tool calls from the response text
      let tool_calls;
      let content = message.content || '';
      
      if (options?.tools && content.includes('{') && content.includes('}')) {
        // Try to extract tool usage from response
        const toolMatches = content.match(/(\w+):\s*({[^}]+})/g);
        if (toolMatches) {
          tool_calls = [];
          toolMatches.forEach(match => {
            const [, toolName, argsStr] = match.match(/(\w+):\s*({.+})/) || [];
            if (toolName && options.tools?.find(t => t.name === toolName)) {
              try {
                const args = JSON.parse(argsStr);
                tool_calls.push({ name: toolName, arguments: args });
                // Remove tool call from content
                content = content.replace(match, '').trim();
              } catch (e) {
                // Ignore JSON parse errors
              }
            }
          });
        }
      }
      
      return {
        content: content,
        tool_calls,
        usage: {
          input_tokens: response.usage?.prompt_tokens,
          output_tokens: response.usage?.completion_tokens,
          total_tokens: response.usage?.total_tokens
        },
        finish_reason: response.choices[0]?.finish_reason as any,
        metadata: {
          provider: this.name,
          model: this.config.model,
          response_time_ms: responseTime
        }
      };
    });
  }
  
  getPricing(): { input_cost_per_token: number; output_cost_per_token: number; currency: string } {
    // Perplexity pricing as of early 2025 (in USD per million tokens, converted to per token)
    const pricingMap: Record<string, any> = {
      'llama-3.1-sonar-huge-128k-online': { input: 5.00, output: 5.00 },
      'llama-3.1-sonar-large-128k-online': { input: 1.00, output: 1.00 },
      'llama-3.1-sonar-small-128k-online': { input: 0.20, output: 0.20 },
      'llama-3.1-sonar-huge-128k-chat': { input: 5.00, output: 5.00 },
      'llama-3.1-sonar-large-128k-chat': { input: 1.00, output: 1.00 },
      'llama-3.1-sonar-small-128k-chat': { input: 0.20, output: 0.20 }
    };
    
    const pricing = pricingMap[this.config.model] || pricingMap['llama-3.1-sonar-large-128k-online'];
    
    return {
      input_cost_per_token: pricing.input / 1000000,
      output_cost_per_token: pricing.output / 1000000,
      currency: 'USD'
    };
  }
}