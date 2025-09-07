import { llmConfig } from '../config/llm-config.js';
import { mcpClient } from './mcpClient.js';

export interface WebSearchLLMOptions {
  maxSearches?: number;
  searchTimeout?: number;
  enableWebSearch?: boolean;
}

export class WebSearchLLM {
  private searchCount = 0;
  private maxSearches: number;
  private searchTimeout: number;
  private enableWebSearch: boolean;

  constructor(options: WebSearchLLMOptions = {}) {
    // Read configuration from environment variables or options
    this.maxSearches = options.maxSearches || parseInt(process.env.MAX_WEB_SEARCHES || '10');
    this.searchTimeout = options.searchTimeout || 15000; // 15 second timeout
    this.enableWebSearch = options.enableWebSearch !== false && 
                          process.env.WEB_SEARCH_ENABLED !== 'false'; // Default enabled unless explicitly disabled
  }

  async initialize(): Promise<boolean> {
    if (!this.enableWebSearch) {
      console.log('🔍 Web search disabled, LLM will work without search capabilities');
      return true;
    }

    console.log('🔍 Initializing web search LLM integration...');
    const mcpConnected = await mcpClient.initialize();
    
    if (mcpConnected) {
      console.log('✅ Web search LLM integration ready with MCP server');
    } else {
      console.log('✅ Web search LLM integration ready with fallback search');
    }
    
    return true;
  }

  async generateResponseWithWebSearch(prompt: string): Promise<{ content: string; cost?: number; searchesPerformed: number }> {
    this.searchCount = 0;
    
    console.log('🧠 Starting LLM analysis with web search capabilities...');
    console.log(`🔍 Web search enabled: ${this.enableWebSearch}, Max searches: ${this.maxSearches}`);
    
    // Enhanced prompt to encourage web search usage when helpful
    const enhancedPrompt = this.enableWebSearch ? 
      `${prompt}

IMPORTANT: You have access to real-time web search capabilities. Use web search whenever you need current information about:
- Player injuries and injury reports
- Weather conditions for games
- Breaking NFL news
- Recent player performance updates
- Coaching decisions or depth chart changes
- Any other current information that would improve your fantasy analysis

To search the web, simply state what you want to search for, and I will perform the search and provide you with the results.

Make as many searches as needed to provide comprehensive, up-to-date analysis.` 
      : prompt;

    // Start with initial LLM call
    let llmResponse = await llmConfig.generateResponse(enhancedPrompt);
    let conversationHistory = [
      { role: 'user', content: enhancedPrompt },
      { role: 'assistant', content: llmResponse.content }
    ];

    // Look for search requests in the response and perform iterative searches
    let finalResponse = llmResponse.content;
    let totalCost = llmResponse.cost || 0;
    
    if (this.enableWebSearch) {
      const searchResults = await this.processSearchRequests(finalResponse, conversationHistory);
      if (searchResults.updatedContent) {
        finalResponse = searchResults.updatedContent;
        totalCost += searchResults.additionalCost;
      }
    }

    console.log(`✅ LLM analysis complete. Searches performed: ${this.searchCount}/${this.maxSearches}`);
    
    return {
      content: finalResponse,
      cost: totalCost,
      searchesPerformed: this.searchCount
    };
  }

  private async processSearchRequests(content: string, history: any[]): Promise<{ updatedContent?: string; additionalCost: number }> {
    let updatedContent = content;
    let additionalCost = 0;
    let iterationCount = 0;
    const maxIterations = 5; // Prevent infinite loops

    // Look for search requests in various formats
    const searchPatterns = [
      /(?:search for|look up|check|find out about|get current info on)[\s:]+["']?([^."'\n]+?)["']?(?:\.|$)/gi,
      /I (?:need to|should|will) search (?:for )?["']?([^."'\n]+?)["']?(?:\.|$)/gi,
      /Let me search (?:for )?["']?([^."'\n]+?)["']?(?:\.|$)/gi,
      /(?:Current|Recent|Latest) (?:status|news|updates?|info(?:rmation)?) (?:on|about|for)[\s:]+["']?([^."'\n]+?)["']?(?:\.|$)/gi
    ];

    while (iterationCount < maxIterations && this.searchCount < this.maxSearches) {
      let foundSearches = false;
      iterationCount++;

      console.log(`🔍 Iteration ${iterationCount}: Looking for search requests...`);

      // Check all search patterns
      for (const pattern of searchPatterns) {
        pattern.lastIndex = 0; // Reset regex
        let match;
        while ((match = pattern.exec(updatedContent)) !== null && this.searchCount < this.maxSearches) {
          const searchQuery = match[1].trim();
          if (searchQuery.length > 3) { // Only search meaningful queries
            foundSearches = true;
            console.log(`🔎 Search ${this.searchCount + 1}/${this.maxSearches}: "${searchQuery}"`);
            
            const searchResult = await mcpClient.performSearch(searchQuery, 3);
            this.searchCount++;
            
            if (searchResult.success && searchResult.results) {
              // Add search results to conversation and get updated response
              const searchPrompt = `Based on this search result for "${searchQuery}":

${searchResult.results}

Please update your analysis with this current information and continue with any additional searches you need.`;

              history.push(
                { role: 'user', content: searchPrompt },
              );

              const followUpResponse = await llmConfig.generateResponse(
                this.buildConversationPrompt(history)
              );
              
              updatedContent = followUpResponse.content;
              additionalCost += followUpResponse.cost || 0;
              
              history.push({ role: 'assistant', content: updatedContent });
              
              console.log(`✅ Search completed, analysis updated`);
            } else {
              console.log(`❌ Search failed: ${searchResult.error || 'Unknown error'}`);
            }

            // Small delay to avoid overwhelming the search service
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // If no new searches found, break the loop
      if (!foundSearches) {
        console.log('🔍 No more search requests found');
        break;
      }
    }

    if (iterationCount >= maxIterations) {
      console.log('⚠️ Reached maximum search iterations');
    }

    if (this.searchCount >= this.maxSearches) {
      console.log('⚠️ Reached maximum search limit');
    }

    return {
      updatedContent: updatedContent !== content ? updatedContent : undefined,
      additionalCost
    };
  }

  private buildConversationPrompt(history: any[]): string {
    return history.map(msg => 
      `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`
    ).join('\n\n');
  }

  async disconnect(): Promise<void> {
    await mcpClient.disconnect();
  }

  getSearchStats(): { searchesPerformed: number; maxSearches: number; searchesRemaining: number } {
    return {
      searchesPerformed: this.searchCount,
      maxSearches: this.maxSearches,
      searchesRemaining: Math.max(0, this.maxSearches - this.searchCount)
    };
  }
}

// Export a default instance
export const webSearchLLM = new WebSearchLLM();