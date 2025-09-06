export class LLMConfigManager {
  async initializeLLM(): Promise<boolean> {
    throw new Error('LLM configuration not implemented in shared library. Use MCP server for LLM functionality.');
  }

  getCurrentInfo(): any {
    throw new Error('LLM configuration not implemented in shared library. Use MCP server for LLM functionality.');
  }

  async testConfiguration(): Promise<{ success: boolean; response?: string; error?: string }> {
    throw new Error('LLM configuration not implemented in shared library. Use MCP server for LLM functionality.');
  }

  async switchProvider(config: any): Promise<boolean> {
    throw new Error('LLM configuration not implemented in shared library. Use MCP server for LLM functionality.');
  }
}

export const llmConfig = new LLMConfigManager();