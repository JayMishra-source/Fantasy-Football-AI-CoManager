import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { BaseLLMProvider } from './base.js';
import { LLMMessage, LLMTool, LLMResponse, LLMConfig } from '../types.js';

export class GeminiProvider extends BaseLLMProvider {
  private client: GoogleGenerativeAI;
  
  constructor(config: LLMConfig) {
    super(config);
    this.client = new GoogleGenerativeAI(config.api_key);
  }
  
  get name(): string {
    return 'Google Gemini';
  }
  
  get models(): string[] {
    return [
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro', 
      'gemini-1.5-flash',
      'gemini-1.0-pro',
      'gemini-pro'
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
      
      // Get the model
      const model = this.client.getGenerativeModel({
        model: this.config.model,
        generationConfig: {
          temperature: options?.temperature || this.config.temperature || 0.7,
          maxOutputTokens: options?.max_tokens || this.config.max_tokens || 4000,
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      });
      
      // Convert messages to Gemini format
      const geminiMessages = this.convertMessagesToGemini(messages);
      
      // Handle function calling
      let tools: any;
      if (options?.tools && options.tools.length > 0) {
        tools = [{
          functionDeclarations: options.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: {
              type: 'object',
              properties: tool.input_schema.properties,
              required: tool.input_schema.required || []
            }
          }))
        }];
        
        console.log('🔧 Gemini tools configured:', JSON.stringify(tools, null, 2));
      }
      
      // Start chat session
      const chat = model.startChat({
        history: geminiMessages.slice(0, -1), // All messages except the last
        tools: tools
      });
      
      // Send the last message
      const lastMessage = geminiMessages[geminiMessages.length - 1];
      const result = await chat.sendMessage(lastMessage.parts[0].text);
      const responseTime = Date.now() - startTime;
      
      const response = await result.response;
      let content = response.text();
      
      // Debug raw response structure
      console.log('🔍 Raw Gemini response structure:', {
        candidates: response.candidates?.length,
        functionCalls: (response as any).functionCalls?.length || 0,
        finishReason: response.candidates?.[0]?.finishReason,
        hasContent: !!content
      });
      
      // Handle function calls
      let tool_calls;
      const functionCalls = (response as any).functionCalls;
      
      // Also check candidates for function calls (alternative location)
      const candidateFunctionCalls = response.candidates?.[0]?.content?.parts?.filter((part: any) => part.functionCall);
      
      if (functionCalls && Array.isArray(functionCalls) && functionCalls.length > 0) {
        console.log('📞 Found function calls in response.functionCalls');
        tool_calls = functionCalls.map((fc: any) => ({
          name: fc.name,
          arguments: fc.args
        }));
      } else if (candidateFunctionCalls && candidateFunctionCalls.length > 0) {
        console.log('📞 Found function calls in response.candidates[0].content.parts');
        tool_calls = candidateFunctionCalls.map((part: any) => ({
          name: part.functionCall.name,
          arguments: part.functionCall.args
        }));
      } else {
        console.log('📞 No function calls found in response');
      }
      
      return {
        content,
        tool_calls,
        usage: {
          input_tokens: response.usageMetadata?.promptTokenCount,
          output_tokens: response.usageMetadata?.candidatesTokenCount,
          total_tokens: response.usageMetadata?.totalTokenCount
        },
        finish_reason: this.mapFinishReason(response.candidates?.[0]?.finishReason),
        metadata: {
          provider: this.name,
          model: this.config.model,
          response_time_ms: responseTime
        }
      };
    });
  }
  
  private convertMessagesToGemini(messages: LLMMessage[]): any[] {
    const convertedMessages: any[] = [];
    
    for (const message of messages) {
      if (message.role === 'system') {
        // Gemini doesn't have system role, convert to user message
        convertedMessages.push({
          role: 'user',
          parts: [{ text: `System: ${message.content}` }]
        });
      } else {
        convertedMessages.push({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }]
        });
      }
    }
    
    return convertedMessages;
  }
  
  private mapFinishReason(reason: any): 'stop' | 'tool_calls' | 'length' | 'content_filter' {
    switch (reason) {
      case 'STOP': return 'stop';
      case 'MAX_TOKENS': return 'length';
      case 'SAFETY': return 'content_filter';
      case 'RECITATION': return 'content_filter';
      default: return 'stop';
    }
  }
  
  getPricing(): { input_cost_per_token: number; output_cost_per_token: number; currency: string } {
    // Gemini pricing as of early 2025 (in USD per million tokens, converted to per token)
    const pricingMap: Record<string, any> = {
      'gemini-2.0-flash-exp': { input: 0.075, output: 0.30 }, // Same pricing as 1.5-flash during experimental phase
      'gemini-1.5-pro': { input: 3.50, output: 10.50 },
      'gemini-1.5-flash': { input: 0.075, output: 0.30 },
      'gemini-1.0-pro': { input: 0.50, output: 1.50 },
      'gemini-pro': { input: 0.50, output: 1.50 }
    };
    
    const pricing = pricingMap[this.config.model] || pricingMap['gemini-2.0-flash-exp'];
    
    return {
      input_cost_per_token: pricing.input / 1000000,
      output_cost_per_token: pricing.output / 1000000,
      currency: 'USD'
    };
  }
}