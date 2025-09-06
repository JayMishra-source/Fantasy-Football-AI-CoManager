import { LLMManager } from '../services/llm/manager.js';
import { LLMConfig } from '../services/llm/types.js';

let llmManager: LLMManager | null = null;

export class LLMConfigManager {
  private async detectAndCreateConfig(): Promise<LLMConfig> {
    // Try to create config from environment variables
    const geminiKey = process.env.GEMINI_API_KEY;
    const claudeKey = process.env.CLAUDE_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const perplexityKey = process.env.PERPLEXITY_API_KEY;
    
    // Primary provider preference from env or default to gemini
    const primaryProvider = (process.env.PRIMARY_LLM_PROVIDER || 'gemini') as 'gemini' | 'claude' | 'openai' | 'perplexity';
    
    // Create config for primary provider if key exists
    if (primaryProvider === 'gemini' && geminiKey) {
      return {
        provider: 'gemini',
        model: 'gemini-2.0-flash-exp',
        api_key: geminiKey,
        max_tokens: 1000,
        temperature: 0.7
      };
    } else if (primaryProvider === 'claude' && claudeKey) {
      return {
        provider: 'claude',
        model: 'claude-3-sonnet-20240229',
        api_key: claudeKey,
        max_tokens: 1000,
        temperature: 0.7
      };
    } else if (primaryProvider === 'openai' && openaiKey) {
      return {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        api_key: openaiKey,
        max_tokens: 1000,
        temperature: 0.7
      };
    } else if (primaryProvider === 'perplexity' && perplexityKey) {
      return {
        provider: 'perplexity',
        model: 'llama-3.1-sonar-small-128k-online',
        api_key: perplexityKey,
        max_tokens: 1000,
        temperature: 0.7
      };
    }
    
    // Fallback to any available provider
    if (geminiKey) {
      return {
        provider: 'gemini',
        model: 'gemini-2.0-flash-exp',
        api_key: geminiKey,
        max_tokens: 1000,
        temperature: 0.7
      };
    } else if (claudeKey) {
      return {
        provider: 'claude',
        model: 'claude-3-sonnet-20240229',
        api_key: claudeKey,
        max_tokens: 1000,
        temperature: 0.7
      };
    } else if (openaiKey) {
      return {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        api_key: openaiKey,
        max_tokens: 1000,
        temperature: 0.7
      };
    } else if (perplexityKey) {
      return {
        provider: 'perplexity',
        model: 'llama-3.1-sonar-small-128k-online',
        api_key: perplexityKey,
        max_tokens: 1000,
        temperature: 0.7
      };
    }
    
    throw new Error('No LLM API keys found in environment variables (GEMINI_API_KEY, CLAUDE_API_KEY, OPENAI_API_KEY, PERPLEXITY_API_KEY)');
  }

  private async getLLMManager(): Promise<LLMManager> {
    if (!llmManager) {
      llmManager = new LLMManager();
      const config = await this.detectAndCreateConfig();
      console.log(`🤖 Initializing LLM with provider: ${config.provider}`);
      const success = await llmManager.initialize(config);
      if (!success) {
        throw new Error(`Failed to initialize LLM manager with ${config.provider}`);
      }
    }
    return llmManager;
  }

  async initializeLLM(): Promise<boolean> {
    try {
      await this.getLLMManager();
      return true;
    } catch (error) {
      console.error('Failed to initialize LLM:', error);
      return false;
    }
  }

  getCurrentInfo(): any {
    if (!llmManager) {
      return { provider: 'none', initialized: false };
    }
    const pricing = llmManager.getCurrentPricing();
    return {
      provider: pricing?.provider || 'unknown',
      model: pricing?.model || 'unknown',
      initialized: true
    };
  }

  async testConfiguration(): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      const manager = await this.getLLMManager();
      const testPrompt = 'Say "LLM test successful" if you can read this.';
      const response = await manager.analyzeFantasyData({
        context: {
          week: 1,
          day_of_week: 'Monday',
          action_type: 'analysis',
          priority: 'low'
        },
        data: {
          rosters: [],
          injuries: [],
          waiver_targets: [],
          league_info: [{ test_prompt: testPrompt }]
        }
      });
      
      return {
        success: true,
        response: response.summary
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateResponse(prompt: string): Promise<{ content: string; cost?: number }> {
    const manager = await this.getLLMManager();
    
    // Use direct LLM provider chat for simple text generation
    // This bypasses the complex fantasy analysis tools that might be causing issues
    try {
      const provider = manager.getCurrentProvider();
      if (!provider) {
        throw new Error('No LLM provider initialized');
      }
      
      const response = await provider.chat([
        { role: 'user', content: prompt }
      ], {
        max_tokens: 1000,
        temperature: 0.7
      });
      
      return {
        content: response.content || 'No response generated',
        cost: response.usage?.total_tokens ? response.usage.total_tokens * 0.000001 : 0.001 // Rough estimate
      };
    } catch (directError: any) {
      console.warn('Direct LLM call failed, trying fantasy analysis method:', directError.message);
      
      // Fallback to fantasy analysis method
      const response = await manager.analyzeFantasyData({
        context: {
          week: 1,
          day_of_week: 'Monday', 
          action_type: 'analysis',
          priority: 'medium'
        },
        data: {
          rosters: [],
          injuries: [],
          waiver_targets: [],
          league_info: [{ custom_prompt: prompt }]
        }
      });
      
      return {
        content: response.summary || 'Analysis completed',
        cost: response.cost_estimate?.estimated_cost
      };
    }
  }

  async switchProvider(provider: 'gemini' | 'claude' | 'openai' | 'perplexity'): Promise<boolean> {
    try {
      const config = await this.detectAndCreateConfig();
      config.provider = provider;
      
      // Get the correct API key for the provider
      switch (provider) {
        case 'gemini':
          config.api_key = process.env.GEMINI_API_KEY || '';
          config.model = 'gemini-2.0-flash-exp';
          break;
        case 'claude':
          config.api_key = process.env.CLAUDE_API_KEY || '';
          config.model = 'claude-3-sonnet-20240229';
          break;
        case 'openai':
          config.api_key = process.env.OPENAI_API_KEY || '';
          config.model = 'gpt-3.5-turbo';
          break;
        case 'perplexity':
          config.api_key = process.env.PERPLEXITY_API_KEY || '';
          config.model = 'llama-3.1-sonar-small-128k-online';
          break;
      }
      
      if (!config.api_key) {
        throw new Error(`No API key found for ${provider}`);
      }
      
      llmManager = new LLMManager();
      const success = await llmManager.initialize(config);
      return success;
    } catch (error) {
      console.error('Failed to switch provider:', error);
      return false;
    }
  }
}

export const llmConfig = new LLMConfigManager();