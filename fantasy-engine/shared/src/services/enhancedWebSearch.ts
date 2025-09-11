// Enhanced web search service with multiple providers and fantasy football optimizations
import axios from 'axios';

export interface WebSearchResult {
  success: boolean;
  results?: string;
  error?: string;
  source?: string;
}

export interface SearchConfig {
  // API Keys (optional, will use free tiers if not provided)
  serperApiKey?: string;
  scrapingDogApiKey?: string;
  
  // Search limits
  maxSearches?: number;
  maxResultsPerSearch?: number;
  
  // Fantasy football specific settings
  enableFantasyOptimization?: boolean;
  preferRealTimeNews?: boolean;
}

export class EnhancedWebSearch {
  private searchCount = 0;
  private config: SearchConfig;
  
  // Fantasy football specific sources for direct scraping
  private fantasyFootballSources = [
    'fantasypros.com',
    'rotoballer.com',
    'draftsharks.com',
    'nfl.com/injuries',
    'nbcsports.com/fantasy',
    'espn.com/fantasy',
  ];

  constructor(config: SearchConfig = {}) {
    this.config = {
      maxSearches: config.maxSearches || 5,
      maxResultsPerSearch: config.maxResultsPerSearch || 5,
      enableFantasyOptimization: config.enableFantasyOptimization ?? true,
      preferRealTimeNews: config.preferRealTimeNews ?? true,
      ...config
    };
  }

  /**
   * Enhanced search with multiple fallback providers
   */
  async search(query: string): Promise<WebSearchResult> {
    if (this.searchCount >= this.config.maxSearches!) {
      return {
        success: false,
        error: `Maximum searches (${this.config.maxSearches}) reached`
      };
    }

    console.log(`🔍 Enhanced web search ${this.searchCount + 1}/${this.config.maxSearches}: "${query}"`);

    // Optimize query for fantasy football if enabled
    const optimizedQuery = this.config.enableFantasyOptimization 
      ? this.optimizeFantasyQuery(query)
      : query;

    console.log(`🎯 Optimized query: "${optimizedQuery}"`);

    // Try search providers in order of preference
    const providers = [
      () => this.searchWithSerper(optimizedQuery),
      () => this.searchWithScrapingDog(optimizedQuery),
      () => this.searchWithCustomScraper(optimizedQuery),
      () => this.fallbackToDuckDuckGo(optimizedQuery)
    ];

    for (const provider of providers) {
      try {
        const result = await provider();
        if (result.success && result.results) {
          this.searchCount++;
          return result;
        }
      } catch (error) {
        console.warn(`Provider failed, trying next...`, error);
        continue;
      }
    }

    this.searchCount++;
    return {
      success: false,
      error: 'All search providers failed',
      source: 'fallback'
    };
  }

  /**
   * Optimize queries specifically for fantasy football searches
   */
  private optimizeFantasyQuery(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    // Add current year for recent info
    const currentYear = new Date().getFullYear();
    if (!lowerQuery.includes(currentYear.toString()) && !lowerQuery.includes((currentYear - 1).toString())) {
      query += ` ${currentYear}`;
    }

    // Add "NFL" prefix for football queries if not present
    if (lowerQuery.includes('fantasy') && lowerQuery.includes('football') && !lowerQuery.includes('nfl')) {
      query = `NFL ${query}`;
    }

    // Add "latest" or "today" for injury/news queries
    if ((lowerQuery.includes('injury') || lowerQuery.includes('news') || lowerQuery.includes('report')) 
        && !lowerQuery.includes('latest') && !lowerQuery.includes('today')) {
      query = `latest ${query}`;
    }

    // Add specific site restrictions for more reliable results
    if (lowerQuery.includes('injury')) {
      query += ' site:fantasypros.com OR site:rotoballer.com OR site:nfl.com';
    }

    return query;
  }

  /**
   * Search using Serper API (fastest, 2500 free searches)
   */
  private async searchWithSerper(query: string): Promise<WebSearchResult> {
    if (!this.config.serperApiKey) {
      throw new Error('Serper API key not configured');
    }

    console.log('🚀 Trying Serper API...');
    
    const response = await axios.post('https://google.serper.dev/search', 
      {
        q: query,
        num: this.config.maxResultsPerSearch,
        gl: 'us',
        hl: 'en'
      },
      {
        headers: {
          'X-API-KEY': this.config.serperApiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    const data = response.data;
    let searchResults = '';

    // Process organic results
    if (data.organic && data.organic.length > 0) {
      searchResults += '🌐 Latest Web Results:\n';
      data.organic.slice(0, this.config.maxResultsPerSearch).forEach((result: any, index: number) => {
        searchResults += `${index + 1}. **${result.title}**\n`;
        if (result.snippet) {
          searchResults += `   ${result.snippet}\n`;
        }
        if (result.date) {
          searchResults += `   📅 ${result.date}\n`;
        }
        searchResults += `   🔗 ${result.link}\n\n`;
      });
    }

    // Process news results for current events
    if (data.news && data.news.length > 0) {
      searchResults += '📰 Latest News:\n';
      data.news.slice(0, 3).forEach((article: any, index: number) => {
        searchResults += `${index + 1}. **${article.title}**\n`;
        if (article.snippet) {
          searchResults += `   ${article.snippet}\n`;
        }
        if (article.date) {
          searchResults += `   📅 ${article.date}\n`;
        }
        searchResults += `   🔗 ${article.link}\n\n`;
      });
    }

    // Process answer box for immediate info
    if (data.answerBox && data.answerBox.answer) {
      searchResults = `📍 Quick Answer: ${data.answerBox.answer}\n\n${searchResults}`;
    }

    return {
      success: searchResults.length > 0,
      results: searchResults.trim() || 'No results found',
      source: 'serper'
    };
  }

  /**
   * Search using ScrapingDog API (1000 free credits, very fast)
   */
  private async searchWithScrapingDog(query: string): Promise<WebSearchResult> {
    if (!this.config.scrapingDogApiKey) {
      throw new Error('ScrapingDog API key not configured');
    }

    console.log('🐕 Trying ScrapingDog API...');

    const response = await axios.get('https://api.scrapingdog.com/google', {
      params: {
        api_key: this.config.scrapingDogApiKey,
        query: query,
        results: this.config.maxResultsPerSearch
      },
      timeout: 10000
    });

    const data = response.data;
    let searchResults = '';

    if (data.organic_data && data.organic_data.length > 0) {
      searchResults += '🌐 Web Results:\n';
      data.organic_data.slice(0, this.config.maxResultsPerSearch).forEach((result: any, index: number) => {
        searchResults += `${index + 1}. **${result.title}**\n`;
        if (result.snippet) {
          searchResults += `   ${result.snippet}\n`;
        }
        searchResults += `   🔗 ${result.link}\n\n`;
      });
    }

    return {
      success: searchResults.length > 0,
      results: searchResults.trim() || 'No results found',
      source: 'scrapingdog'
    };
  }

  /**
   * Custom scraper for fantasy football specific sites
   */
  private async searchWithCustomScraper(query: string): Promise<WebSearchResult> {
    console.log('🕷️ Trying custom fantasy football scraper...');

    const lowerQuery = query.toLowerCase();
    let searchResults = '';

    // Fantasy football injury reports
    if (lowerQuery.includes('injury')) {
      try {
        const injuryData = await this.scrapeFantasyProsInjuries();
        if (injuryData) {
          searchResults += '🏥 Current NFL Injury Reports:\n';
          searchResults += injuryData;
          searchResults += '\n';
        }
      } catch (error) {
        console.warn('Failed to scrape FantasyPros injuries:', error);
      }
    }

    // Fantasy football waiver wire
    if (lowerQuery.includes('waiver')) {
      try {
        const waiverData = await this.scrapeWaiverWireTargets();
        if (waiverData) {
          searchResults += '🎯 Waiver Wire Targets:\n';
          searchResults += waiverData;
          searchResults += '\n';
        }
      } catch (error) {
        console.warn('Failed to scrape waiver targets:', error);
      }
    }

    return {
      success: searchResults.length > 0,
      results: searchResults.trim() || 'Custom scraper found no relevant data',
      source: 'custom-scraper'
    };
  }

  /**
   * Fallback to improved DuckDuckGo search
   */
  private async fallbackToDuckDuckGo(query: string): Promise<WebSearchResult> {
    console.log('🦆 Falling back to DuckDuckGo...');

    try {
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

      const data = response.data;
      let searchResults = '';

      // Same logic as original but with better formatting
      if (data.Answer) {
        searchResults += `📍 Answer: ${data.Answer}\n\n`;
      }

      if (data.Definition) {
        searchResults += `📖 Definition: ${data.Definition}\n\n`;
      }

      if (data.Abstract) {
        searchResults += `📝 Summary: ${data.Abstract}\n\n`;
      }

      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        searchResults += '🔗 Related Information:\n';
        data.RelatedTopics.slice(0, 3).forEach((topic: any, index: number) => {
          if (topic.Text) {
            searchResults += `${index + 1}. ${topic.Text.substring(0, 300)}\n`;
          }
        });
        searchResults += '\n';
      }

      if (!searchResults.trim()) {
        searchResults = `ℹ️ DuckDuckGo found limited information for "${query}". This suggests the topic is very current or specific. The information may be available on specialized fantasy football sites.`;
      }

      return {
        success: true,
        results: searchResults.trim(),
        source: 'duckduckgo'
      };

    } catch (error) {
      return {
        success: false,
        error: `DuckDuckGo search failed: ${error}`,
        source: 'duckduckgo'
      };
    }
  }

  /**
   * Scrape FantasyPros injury reports (simplified version)
   */
  private async scrapeFantasyProsInjuries(): Promise<string | null> {
    try {
      // This would require actual HTML scraping, returning placeholder for now
      // In a real implementation, you'd use cheerio to parse HTML from fantasypros.com/nfl/injury-news.php
      return 'Injury scraping would be implemented here with cheerio/puppeteer';
    } catch (error) {
      return null;
    }
  }

  /**
   * Scrape waiver wire targets
   */
  private async scrapeWaiverWireTargets(): Promise<string | null> {
    try {
      // Placeholder for waiver wire scraping
      return 'Waiver wire scraping would be implemented here';
    } catch (error) {
      return null;
    }
  }

  /**
   * Process LLM response and execute web searches
   */
  async processWebSearchRequests(llmResponse: string): Promise<string> {
    let processedResponse = llmResponse;
    
    const searchPattern = /web_search\(['"](.*?)['"]\)/gi;
    const searches = [...llmResponse.matchAll(searchPattern)];
    
    if (searches.length === 0) {
      return processedResponse;
    }
    
    console.log(`🔍 Found ${searches.length} enhanced web search requests`);
    
    for (const match of searches) {
      const fullMatch = match[0];
      const query = match[1];
      
      if (query && query.length > 3) {
        const searchResult = await this.search(query);
        
        if (searchResult.success && searchResult.results) {
          const replacement = `\n**🔍 Web Search Results for "${query}" (via ${searchResult.source}):**\n${searchResult.results}\n`;
          processedResponse = processedResponse.replace(fullMatch, replacement);
        } else {
          const replacement = `[Enhanced web search for "${query}" failed: ${searchResult.error}]`;
          processedResponse = processedResponse.replace(fullMatch, replacement);
        }
      } else {
        processedResponse = processedResponse.replace(fullMatch, '[Invalid web search query]');
      }
    }
    
    return processedResponse;
  }

  /**
   * Get search statistics and configuration
   */
  getSearchStats(): { 
    performed: number; 
    max: number; 
    remaining: number;
    config: SearchConfig;
    availableProviders: string[];
  } {
    const availableProviders = [];
    if (this.config.serperApiKey) availableProviders.push('Serper API');
    if (this.config.scrapingDogApiKey) availableProviders.push('ScrapingDog API');
    availableProviders.push('Custom Scraper', 'DuckDuckGo');

    return {
      performed: this.searchCount,
      max: this.config.maxSearches!,
      remaining: Math.max(0, this.config.maxSearches! - this.searchCount),
      config: this.config,
      availableProviders
    };
  }

  /**
   * Reset search count for new session
   */
  resetSearchCount(): void {
    this.searchCount = 0;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SearchConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Export configured instances
export const enhancedWebSearch = new EnhancedWebSearch({
  enableFantasyOptimization: true,
  preferRealTimeNews: true,
  maxSearches: 5,
  maxResultsPerSearch: 5
});

// Export with API keys if available in environment
export const configuredWebSearch = new EnhancedWebSearch({
  serperApiKey: process.env.SERPER_API_KEY,
  scrapingDogApiKey: process.env.SCRAPINGDOG_API_KEY,
  enableFantasyOptimization: true,
  preferRealTimeNews: true,
  maxSearches: 10,
  maxResultsPerSearch: 5
});