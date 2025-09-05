// Minimal LLM config for testing
export class LLMConfigManager {
  async initializeLLM(): Promise<boolean> {
    console.log('LLM initialized (test mode)');
    return true;
  }

  getCurrentInfo(): any {
    return {
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      status: 'active'
    };
  }

  async testConfiguration(): Promise<{ success: boolean; response?: string; error?: string }> {
    console.log('Testing LLM configuration (test mode)');
    return { 
      success: true, 
      response: 'Test successful' 
    };
  }

  async switchProvider(config: any): Promise<boolean> {
    console.log('Switching LLM provider (test mode):', config.provider);
    return true;
  }
}

export const llmConfig = new LLMConfigManager();