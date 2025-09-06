import OpenAI from 'openai';
import { BaseLLMProvider } from './base.js';
import { LLMMessage, LLMTool, LLMResponse, LLMConfig } from '../types.js';

export class OpenAIProvider extends BaseLLMProvider {
  private client: OpenAI;
  
  constructor(config: LLMConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.api_key,
      baseURL: config.base_url
    });
  }
  
  get name(): string {
    return 'OpenAI';
  }
  
  get models(): string[] {
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'o1-preview',
      'o1-mini'
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
      
      // Convert messages to OpenAI format
      const openaiMessages = this.standardizeMessages(messages).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      const requestOptions: any = {
        model: this.config.model,
        messages: openaiMessages,
        max_tokens: options?.max_tokens || this.config.max_tokens || 4000,
        temperature: options?.temperature || this.config.temperature || 0.7
      };
      
      // Add tools if provided
      if (options?.tools && options.tools.length > 0) {
        requestOptions.tools = this.convertTools(options.tools);
        
        if (options.tool_choice) {
          if (options.tool_choice === 'auto' || options.tool_choice === 'none') {
            requestOptions.tool_choice = options.tool_choice;
          } else {
            requestOptions.tool_choice = {
              type: 'function',
              function: { name: options.tool_choice.function.name }
            };
          }
        }
      }
      
      const response = await this.client.chat.completions.create(requestOptions);
      const responseTime = Date.now() - startTime;
      
      const message = response.choices[0]?.message;
      if (!message) {
        throw new Error('No message in OpenAI response');
      }
      
      // Extract tool calls
      const tool_calls = message.tool_calls?.map(tc => {
        if ('function' in tc) {
          return {
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments)
          };
        }
        return null;
      }).filter((tc): tc is { name: string; arguments: any } => tc !== null);
      
      return {
        content: message.content || '',
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
    // Pricing as of early 2025 (in USD per million tokens, converted to per token)
    const pricingMap: Record<string, any> = {
      'gpt-4o': { input: 2.50, output: 10.00 },
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'gpt-4-turbo': { input: 10.00, output: 30.00 },
      'gpt-4': { input: 30.00, output: 60.00 },
      'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
      'o1-preview': { input: 15.00, output: 60.00 },
      'o1-mini': { input: 3.00, output: 12.00 }
    };
    
    const pricing = pricingMap[this.config.model] || pricingMap['gpt-4o'];
    
    return {
      input_cost_per_token: pricing.input / 1000000,
      output_cost_per_token: pricing.output / 1000000,
      currency: 'USD'
    };
  }
}