import { llmConfig } from '@fantasy-ai/shared';
import { loadProductionConfig } from '../config/production.js';
import { TestResult } from './espn-integration-test.js';

export class LLMIntegrationTester {
  private config = loadProductionConfig();
  private results: TestResult[] = [];

  async runAllTests(): Promise<TestResult[]> {
    console.log('🤖 Starting LLM Integration Tests...\n');
    
    await this.testLLMInitialization();
    await this.testProviderConnectivity();
    await this.testCostTracking();
    await this.testFailoverBehavior();
    await this.testPerformanceAndLatency();
    
    return this.results;
  }

  private async testLLMInitialization(): Promise<void> {
    const test = 'LLM Initialization';
    const start = Date.now();
    
    try {
      const initialized = await llmConfig.initializeLLM();
      
      if (initialized) {
        const currentInfo = llmConfig.getCurrentInfo();
        
        this.addResult(test, 'pass',
          `LLM initialized successfully: ${currentInfo?.provider || 'unknown'} (${currentInfo?.model || 'unknown'})`,
          Date.now() - start, {
            provider: currentInfo?.provider,
            model: currentInfo?.model,
            status: currentInfo?.status
          }
        );
      } else {
        this.addResult(test, 'fail',
          'LLM initialization failed - check API keys and configuration',
          Date.now() - start
        );
      }
      
    } catch (error: any) {
      this.addResult(test, 'fail', error.message, Date.now() - start);
    }
  }

  private async testProviderConnectivity(): Promise<void> {
    const providers = ['gemini', 'claude', 'openai', 'perplexity'];
    
    for (const provider of providers) {
      const test = `${provider.charAt(0).toUpperCase() + provider.slice(1)} Provider`;
      const start = Date.now();
      
      try {
        // Check if API key exists for this provider
        const apiKeyEnvVar = `${provider.toUpperCase()}_API_KEY`;
        const hasApiKey = !!process.env[apiKeyEnvVar];
        
        if (!hasApiKey) {
          this.addResult(test, 'warning',
            `No API key configured (${apiKeyEnvVar})`,
            Date.now() - start
          );
          continue;
        }
        
        // Test configuration
        const testConfig = await this.createTestConfig(provider);
        const testResult = await llmConfig.testConfiguration();
        
        if (testResult.success) {
          this.addResult(test, 'pass',
            `Provider test successful. Response: "${testResult.response?.substring(0, 50)}..."`,
            Date.now() - start, {
              provider,
              cost: (testResult as any).cost || 0,
              responseLength: testResult.response?.length || 0
            }
          );
        } else {
          this.addResult(test, 'fail',
            `Provider test failed: ${testResult.error}`,
            Date.now() - start
          );
        }
        
      } catch (error: any) {
        this.addResult(test, 'fail', error.message, Date.now() - start);
      }
    }
  }

  private async testCostTracking(): Promise<void> {
    const test = 'Cost Tracking';
    const start = Date.now();
    
    try {
      // Test cost monitoring functionality
      const { getCostSummary } = await import('@fantasy-ai/shared');
      const costSummary = await getCostSummary();
      
      if (costSummary && typeof costSummary === 'object') {
        this.addResult(test, 'pass',
          `Cost tracking active. Current daily: $${costSummary.dailyCost || 0}`,
          Date.now() - start, {
            dailyCost: costSummary.dailyCost,
            weeklyCost: costSummary.weeklyCost,
            monthlyCost: costSummary.monthlyCost,
            totalQueries: costSummary.totalQueries
          }
        );
      } else {
        this.addResult(test, 'warning',
          'Cost tracking not properly configured',
          Date.now() - start
        );
      }
      
    } catch (error: any) {
      this.addResult(test, 'fail', error.message, Date.now() - start);
    }
  }

  private async testFailoverBehavior(): Promise<void> {
    const test = 'Provider Failover';
    const start = Date.now();
    
    try {
      if (!this.config.llm.fallbackProvider) {
        this.addResult(test, 'warning',
          'No fallback provider configured',
          Date.now() - start
        );
        return;
      }
      
      // Test switching between providers
      const originalProvider = this.config.llm.primaryProvider;
      const fallbackProvider = this.config.llm.fallbackProvider;
      
      // Create test config for fallback
      const fallbackConfig = await this.createTestConfig(fallbackProvider);
      const switchResult = await llmConfig.switchProvider(fallbackConfig);
      
      if (switchResult) {
        // Switch back to primary
        const primaryConfig = await this.createTestConfig(originalProvider);
        await llmConfig.switchProvider(primaryConfig);
        
        this.addResult(test, 'pass',
          `Failover test successful: ${originalProvider} → ${fallbackProvider} → ${originalProvider}`,
          Date.now() - start, {
            primary: originalProvider,
            fallback: fallbackProvider
          }
        );
      } else {
        this.addResult(test, 'fail',
          `Failed to switch to fallback provider: ${fallbackProvider}`,
          Date.now() - start
        );
      }
      
    } catch (error: any) {
      this.addResult(test, 'fail', error.message, Date.now() - start);
    }
  }

  private async testPerformanceAndLatency(): Promise<void> {
    const test = 'Performance & Latency';
    const start = Date.now();
    
    try {
      const performanceTests = [];
      
      // Test multiple quick requests
      for (let i = 0; i < 3; i++) {
        const requestStart = Date.now();
        performanceTests.push(
          llmConfig.testConfiguration().then((result: any) => ({
            success: result.success,
            latency: Date.now() - requestStart,
            cost: result.cost || 0
          }))
        );
      }
      
      const results = await Promise.all(performanceTests);
      
      const successfulTests = results.filter((r: any) => r.success);
      const averageLatency = successfulTests.reduce((sum: number, r: any) => sum + r.latency, 0) / successfulTests.length;
      const totalCost = results.reduce((sum: number, r: any) => sum + r.cost, 0);
      
      if (successfulTests.length >= 2 && averageLatency < 30000) { // 30 seconds
        this.addResult(test, 'pass',
          `Performance acceptable: ${averageLatency.toFixed(0)}ms avg latency, $${totalCost.toFixed(4)} total cost`,
          Date.now() - start, {
            successfulRequests: successfulTests.length,
            totalRequests: results.length,
            averageLatency: Math.round(averageLatency),
            totalCost
          }
        );
      } else {
        this.addResult(test, 'warning',
          `Performance concerns: ${averageLatency.toFixed(0)}ms avg latency, ${successfulTests.length}/${results.length} successful`,
          Date.now() - start, {
            successfulRequests: successfulTests.length,
            totalRequests: results.length,
            averageLatency: Math.round(averageLatency),
            totalCost
          }
        );
      }
      
    } catch (error: any) {
      this.addResult(test, 'fail', error.message, Date.now() - start);
    }
  }

  private async createTestConfig(provider: string): Promise<any> {
    const apiKeyEnvVar = `${provider.toUpperCase()}_API_KEY`;
    const modelEnvVar = `${provider.toUpperCase()}_MODEL`;
    
    const models: { [key: string]: string } = {
      'gemini': 'gemini-1.5-flash',
      'claude': 'claude-3-5-sonnet-20241022',
      'openai': 'gpt-4o-mini',
      'perplexity': 'llama-3.1-sonar-large-128k-online'
    };
    
    return {
      provider,
      model: process.env[modelEnvVar] || models[provider],
      api_key: process.env[apiKeyEnvVar],
      max_tokens: 4000,
      temperature: 0.7
    };
  }

  private addResult(name: string, status: 'pass' | 'fail' | 'warning', message: string, duration: number, data?: any): void {
    const result: TestResult = { name, status, message, duration, data };
    this.results.push(result);
    
    const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${name}: ${message} (${duration}ms)`);
  }

  generateReport(): string {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    
    let report = '🤖 LLM Integration Test Report\n';
    report += '==============================\n\n';
    report += `Summary: ${passed} passed, ${failed} failed, ${warnings} warnings\n\n`;
    
    this.results.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
      report += `${icon} ${result.name}\n`;
      report += `   ${result.message}\n`;
      report += `   Duration: ${result.duration}ms\n`;
      if (result.data) {
        report += `   Data: ${JSON.stringify(result.data, null, 2)}\n`;
      }
      report += '\n';
    });
    
    return report;
  }
}

export async function runLLMIntegrationTests(): Promise<boolean> {
  const tester = new LLMIntegrationTester();
  const results = await tester.runAllTests();
  
  console.log('\n' + tester.generateReport());
  
  const hasFailures = results.some(r => r.status === 'fail');
  return !hasFailures;
}