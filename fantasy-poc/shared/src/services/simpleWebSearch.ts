// Simple web search service to support LLM queries without complex MCP integration
import axios from 'axios';

export interface WebSearchResult {
  success: boolean;
  results?: string;
  error?: string;
}

export class SimpleWebSearch {
  private searchCount = 0;
  private maxSearches = parseInt(process.env.MAX_WEB_SEARCHES || '5');

  /**
   * Perform a simple web search using DuckDuckGo API
   */
  async search(query: string): Promise<WebSearchResult> {
    if (this.searchCount >= this.maxSearches) {
      return {
        success: false,
        error: `Maximum searches (${this.maxSearches}) reached`
      };
    }

    try {
      console.log(`🔍 Web search ${this.searchCount + 1}/${this.maxSearches}: "${query}"`);
      
      const response = await axios.get('https://api.duckduckgo.com/', {
        params: {
          q: query,
          format: 'json',
          no_html: '1',
          skip_disambig: '1'
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FantasyAI/1.0)'
        },
        timeout: 10000
      });

      this.searchCount++;

      const data = response.data;
      let searchResults = '';

      // Extract useful information from DuckDuckGo response
      if (data.Answer) {
        searchResults += `Answer: ${data.Answer}\n`;
      }

      if (data.Definition) {
        searchResults += `Definition: ${data.Definition}\n`;
      }

      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        searchResults += 'Related Information:\n';
        data.RelatedTopics.slice(0, 3).forEach((topic: any, index: number) => {
          if (topic.Text) {
            searchResults += `${index + 1}. ${topic.Text.substring(0, 200)}...\n`;
          }
        });
      }

      if (!searchResults.trim()) {
        searchResults = `No specific results found for "${query}", but search was successful.`;
      }

      console.log(`✅ Web search completed: ${searchResults.length} characters of results`);
      
      return {
        success: true,
        results: searchResults.trim()
      };

    } catch (error: any) {
      console.error(`❌ Web search failed for "${query}":`, error.message);
      this.searchCount++; // Still count failed searches
      
      return {
        success: false,
        error: `Search failed: ${error.message}`
      };
    }
  }

  /**
   * Process LLM response and execute any web_search() calls found
   */
  async processWebSearchRequests(llmResponse: string): Promise<string> {
    let processedResponse = llmResponse;
    
    // Look for web_search("query") patterns
    const searchPattern = /web_search\(['"](.*?)['"]\)/gi;
    const searches = [...llmResponse.matchAll(searchPattern)];
    
    if (searches.length === 0) {
      return processedResponse;
    }
    
    console.log(`🔍 Found ${searches.length} web search requests in LLM response`);
    
    // Process each search request
    for (const match of searches) {
      const fullMatch = match[0];
      const query = match[1];
      
      if (query && query.length > 3) {
        const searchResult = await this.search(query);
        
        if (searchResult.success && searchResult.results) {
          // Replace the search call with actual results
          const replacement = `\n**Web Search Results for "${query}":**\n${searchResult.results}\n`;
          processedResponse = processedResponse.replace(fullMatch, replacement);
        } else {
          // Replace with error message
          const replacement = `[Web search for "${query}" failed: ${searchResult.error}]`;
          processedResponse = processedResponse.replace(fullMatch, replacement);
        }
      } else {
        // Replace with message about invalid query
        processedResponse = processedResponse.replace(fullMatch, '[Invalid web search query]');
      }
    }
    
    return processedResponse;
  }

  /**
   * Get current search statistics
   */
  getSearchStats(): { performed: number; max: number; remaining: number } {
    return {
      performed: this.searchCount,
      max: this.maxSearches,
      remaining: Math.max(0, this.maxSearches - this.searchCount)
    };
  }

  /**
   * Reset search count (useful for new analysis sessions)
   */
  resetSearchCount(): void {
    this.searchCount = 0;
  }
}

export const simpleWebSearch = new SimpleWebSearch();