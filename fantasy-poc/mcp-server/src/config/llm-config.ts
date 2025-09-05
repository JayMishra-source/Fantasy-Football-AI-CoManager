import { LLMConfig } from '../services/llm/types.js';
import { llmManager } from '../services/llm/manager.js';
import fs from 'fs';
import path from 'path';

export interface LLMConfigOption {
  provider: string;
  name: string;
  models: string[];
  description: string;
  pricing_note: string;
  setup_instructions: string;
  env_variables: string[];
}

export class LLMConfigManager {
  private configPath: string;
  private currentConfig: LLMConfig | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), '.env.llm');
  }

  /**
   * Get all available LLM provider options
   */
  getAvailableProviders(): LLMConfigOption[] {
    return [
      {
        provider: 'claude',
        name: 'Claude (Anthropic)',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
        description: 'Anthropic\'s Claude models - excellent for complex reasoning and analysis',
        pricing_note: 'Pay-per-use: $3-15 per million tokens (separate from Claude subscription)',
        setup_instructions: 'Get API key from https://console.anthropic.com/',
        env_variables: ['CLAUDE_API_KEY', 'CLAUDE_MODEL']
      },
      {
        provider: 'openai',
        name: 'OpenAI GPT',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        description: 'OpenAI\'s GPT models - great general purpose with function calling',
        pricing_note: 'Pay-per-use: $0.15-30 per million tokens depending on model',
        setup_instructions: 'Get API key from https://platform.openai.com/api-keys',
        env_variables: ['OPENAI_API_KEY', 'OPENAI_MODEL']
      },
      {
        provider: 'perplexity',
        name: 'Perplexity AI',
        models: ['llama-3.1-sonar-large-128k-online', 'llama-3.1-sonar-small-128k-online'],
        description: 'Perplexity\'s models with real-time web access - good for current data',
        pricing_note: 'Pay-per-use: $0.20-5 per million tokens with web search capability',
        setup_instructions: 'Get API key from https://www.perplexity.ai/settings/api',
        env_variables: ['PERPLEXITY_API_KEY', 'PERPLEXITY_MODEL']
      },
      {
        provider: 'gemini',
        name: 'Google Gemini',
        models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp', 'gemini-1.0-pro'],
        description: 'Google\'s Gemini models - strong multimodal capabilities, Gemini 2.5 Flash is latest',
        pricing_note: 'Pay-per-use: $0.075-10.50 per million tokens with generous free tier',
        setup_instructions: 'Get API key from https://aistudio.google.com/app/apikey',
        env_variables: ['GEMINI_API_KEY', 'GEMINI_MODEL']
      }
    ];
  }

  /**
   * Load LLM configuration from environment or config file
   */
  loadConfig(): LLMConfig | null {
    // Try environment variables first
    const envConfig = this.loadFromEnvironment();
    if (envConfig) {
      this.currentConfig = envConfig;
      return envConfig;
    }

    // Try config file
    const fileConfig = this.loadFromFile();
    if (fileConfig) {
      this.currentConfig = fileConfig;
      return fileConfig;
    }

    return null;
  }

  private loadFromEnvironment(): LLMConfig | null {
    // Check for Claude
    if (process.env.CLAUDE_API_KEY) {
      return {
        provider: 'claude',
        model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
        api_key: process.env.CLAUDE_API_KEY,
        max_tokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4000'),
        temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0.7')
      };
    }

    // Check for OpenAI
    if (process.env.OPENAI_API_KEY) {
      return {
        provider: 'openai',
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        api_key: process.env.OPENAI_API_KEY,
        max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000'),
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7')
      };
    }

    // Check for Perplexity
    if (process.env.PERPLEXITY_API_KEY) {
      return {
        provider: 'perplexity',
        model: process.env.PERPLEXITY_MODEL || 'llama-3.1-sonar-large-128k-online',
        api_key: process.env.PERPLEXITY_API_KEY,
        max_tokens: parseInt(process.env.PERPLEXITY_MAX_TOKENS || '4000'),
        temperature: parseFloat(process.env.PERPLEXITY_TEMPERATURE || '0.7')
      };
    }

    // Check for Gemini
    if (process.env.GEMINI_API_KEY) {
      return {
        provider: 'gemini',
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
        api_key: process.env.GEMINI_API_KEY,
        max_tokens: parseInt(process.env.GEMINI_MAX_TOKENS || '4000'),
        temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7')
      };
    }

    return null;
  }

  private loadFromFile(): LLMConfig | null {
    try {
      if (!fs.existsSync(this.configPath)) return null;
      
      const content = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(content) as LLMConfig;
    } catch (error) {
      console.warn('Failed to load LLM config from file:', error);
      return null;
    }
  }

  /**
   * Save configuration to file
   */
  saveConfig(config: LLMConfig): boolean {
    try {
      this.currentConfig = config;
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to save LLM config:', error);
      return false;
    }
  }

  /**
   * Initialize LLM manager with current config
   */
  async initializeLLM(): Promise<boolean> {
    const config = this.currentConfig || this.loadConfig();
    if (!config) {
      console.error('❌ No LLM configuration found. Please configure an LLM provider.');
      this.showSetupInstructions();
      return false;
    }

    const success = await llmManager.initialize(config);
    if (success) {
      console.log(`🤖 LLM initialized: ${config.provider} (${config.model})`);
    }
    
    return success;
  }

  /**
   * Interactive configuration setup
   */
  async setupInteractive(): Promise<boolean> {
    console.log('\n🤖 LLM Provider Setup\n');
    console.log('Available providers:');
    
    const providers = this.getAvailableProviders();
    providers.forEach((provider, index) => {
      console.log(`${index + 1}. ${provider.name}`);
      console.log(`   ${provider.description}`);
      console.log(`   💰 ${provider.pricing_note}`);
      console.log('');
    });

    // This would typically use readline for interactive input
    // For now, just show instructions
    this.showSetupInstructions();
    return false;
  }

  private showSetupInstructions(): void {
    console.log('\n📝 Setup Instructions:');
    console.log('Add one of these configurations to your .env file:\n');

    const providers = this.getAvailableProviders();
    providers.forEach(provider => {
      console.log(`# ${provider.name}`);
      provider.env_variables.forEach(envVar => {
        const value = envVar.includes('MODEL') ? provider.models[0] : 'your_api_key_here';
        console.log(`${envVar}=${value}`);
      });
      console.log(`# Get API key: ${provider.setup_instructions}`);
      console.log('');
    });

    console.log('Then restart the application to use your chosen LLM provider.');
  }

  /**
   * Get current configuration info
   */
  getCurrentInfo(): any {
    if (!this.currentConfig) return null;

    const pricing = llmManager.getCurrentPricing();
    return {
      provider: this.currentConfig.provider,
      model: this.currentConfig.model,
      pricing: pricing?.pricing,
      status: 'active'
    };
  }

  /**
   * Switch to a different provider
   */
  async switchProvider(newConfig: LLMConfig): Promise<boolean> {
    const success = await llmManager.switchProvider(newConfig);
    if (success) {
      this.currentConfig = newConfig;
      this.saveConfig(newConfig);
    }
    return success;
  }

  /**
   * Test current configuration
   */
  async testConfiguration(): Promise<{ success: boolean; response?: string; cost?: number; error?: string }> {
    if (!this.currentConfig) {
      return { success: false, error: 'No configuration loaded' };
    }

    try {
      const testRequest = {
        context: {
          week: 1,
          day_of_week: 'Thursday',
          action_type: 'lineup' as const,
          priority: 'medium' as const
        },
        data: {
          rosters: [],
          injuries: [],
          waiver_targets: []
        }
      };

      const response = await llmManager.analyzeFantasyData(testRequest);
      
      return {
        success: true,
        response: response.summary.substring(0, 200) + '...',
        cost: response.cost_estimate.estimated_cost
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Singleton instance
export const llmConfig = new LLMConfigManager();