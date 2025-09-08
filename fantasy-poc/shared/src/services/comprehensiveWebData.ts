// Comprehensive Web Data Service - Combines enhanced search, RSS feeds, and fantasy optimizations
import { EnhancedWebSearch, WebSearchResult, SearchConfig } from './enhancedWebSearch.js';
import { FantasyRSSAggregator, RSSItem } from './fantasyRSSAggregator.js';

export interface ComprehensiveResult {
  success: boolean;
  searchResults?: WebSearchResult;
  rssResults?: RSSItem[];
  combinedText?: string;
  summary?: string;
  error?: string;
  sources: string[];
}

export interface WebDataConfig extends SearchConfig {
  useRSSFeeds?: boolean;
  combineResultTypes?: boolean;
  prioritizeRecency?: boolean;
  enableFantasyOptimization?: boolean;
  serperApiKey?: string;
  scrapingDogApiKey?: string;
}

export class ComprehensiveWebData {
  private enhancedSearch: EnhancedWebSearch;
  private rssAggregator: FantasyRSSAggregator;
  private config: WebDataConfig;

  constructor(config: WebDataConfig = {}) {
    this.config = {
      useRSSFeeds: config.useRSSFeeds ?? true,
      combineResultTypes: config.combineResultTypes ?? true,
      prioritizeRecency: config.prioritizeRecency ?? true,
      enableFantasyOptimization: config.enableFantasyOptimization ?? true,
      ...config
    };

    this.enhancedSearch = new EnhancedWebSearch(config);
    this.rssAggregator = new FantasyRSSAggregator();
  }

  /**
   * Comprehensive search combining multiple data sources
   */
  async comprehensiveSearch(query: string): Promise<ComprehensiveResult> {
    console.log(`🎯 Starting comprehensive search for: "${query}"`);
    
    const sources: string[] = [];
    let searchResults: WebSearchResult | undefined;
    let rssResults: RSSItem[] = [];
    
    // Determine if this is a fantasy football query
    const isFantasyQuery = this.isFantasyFootballQuery(query);
    
    try {
      // 1. Try enhanced web search first
      console.log('🔍 Phase 1: Enhanced web search...');
      searchResults = await this.enhancedSearch.search(query);
      if (searchResults.success && searchResults.source) {
        sources.push(`Web Search (${searchResults.source})`);
      }

      // 2. If fantasy football related and RSS enabled, get RSS data
      if (isFantasyQuery && this.config.useRSSFeeds) {
        console.log('📰 Phase 2: Fantasy RSS aggregation...');
        
        if (this.isInjuryQuery(query)) {
          const injuryData = await this.rssAggregator.getInjuryReports();
          if (injuryData.success) {
            rssResults = injuryData.injuryItems;
            sources.push('Fantasy RSS (Injury Reports)');
          }
        } else {
          const rssSearch = await this.rssAggregator.searchFantasyNews(query, 8);
          if (rssSearch.success) {
            rssResults = rssSearch.matchingItems;
            sources.push('Fantasy RSS (News Search)');
          }
        }
      }

      // 3. Combine and format results
      if (this.config.combineResultTypes && (searchResults?.success || rssResults.length > 0)) {
        const combinedText = this.combineResults(searchResults, rssResults, query);
        const summary = this.generateComprehensiveSummary(searchResults, rssResults, sources);

        return {
          success: true,
          searchResults,
          rssResults,
          combinedText,
          summary,
          sources
        };
      }

      // 4. Return individual results if combination disabled
      if (searchResults?.success) {
        return {
          success: true,
          searchResults,
          rssResults,
          combinedText: searchResults.results,
          summary: `Web search via ${searchResults.source} found relevant information`,
          sources
        };
      }

      if (rssResults.length > 0) {
        return {
          success: true,
          rssResults,
          combinedText: this.rssAggregator.formatItemsForDisplay(rssResults, 8),
          summary: `Found ${rssResults.length} relevant news items from RSS feeds`,
          sources
        };
      }

      // 5. No results found
      return {
        success: false,
        error: 'No results found from any source',
        sources,
        combinedText: this.generateNoResultsMessage(query, isFantasyQuery)
      };

    } catch (error: any) {
      console.error('❌ Comprehensive search failed:', error);
      return {
        success: false,
        error: error.message,
        sources,
        combinedText: `Search failed: ${error.message}`
      };
    }
  }

  /**
   * Fantasy football optimized search with specialized handling
   */
  async fantasyFootballSearch(query: string): Promise<ComprehensiveResult> {
    console.log(`🏈 Fantasy football optimized search: "${query}"`);

    // Enable all fantasy optimizations
    const originalConfig = { ...this.config };
    this.config = {
      ...this.config,
      enableFantasyOptimization: true,
      useRSSFeeds: true,
      combineResultTypes: true,
      prioritizeRecency: true
    };

    // Determine query type for specialized handling
    const queryType = this.categorizeFantasyQuery(query);
    console.log(`📊 Query categorized as: ${queryType}`);

    let result: ComprehensiveResult;

    switch (queryType) {
      case 'injury':
        result = await this.handleInjuryQuery(query);
        break;
      case 'waiver':
        result = await this.handleWaiverQuery(query);
        break;
      case 'matchup':
        result = await this.handleMatchupQuery(query);
        break;
      case 'weather':
        result = await this.handleWeatherQuery(query);
        break;
      default:
        result = await this.comprehensiveSearch(query);
    }

    // Restore original config
    this.config = originalConfig;

    return result;
  }

  /**
   * Process LLM responses with comprehensive web search
   */
  async processLLMWebSearchRequests(llmResponse: string): Promise<string> {
    let processedResponse = llmResponse;
    
    // Look for web_search() calls
    const searchPattern = /web_search\(['"](.*?)['"]\)/gi;
    const searches = [...llmResponse.matchAll(searchPattern)];
    
    if (searches.length === 0) {
      return processedResponse;
    }
    
    console.log(`🔍 Processing ${searches.length} comprehensive web search requests`);
    
    for (const match of searches) {
      const fullMatch = match[0];
      const query = match[1];
      
      if (query && query.length > 3) {
        const result = await this.fantasyFootballSearch(query);
        
        if (result.success && result.combinedText) {
          const sourceList = result.sources.join(', ');
          const replacement = `\n**🎯 Comprehensive Search Results for "${query}"** (Sources: ${sourceList})\n\n${result.combinedText}\n`;
          processedResponse = processedResponse.replace(fullMatch, replacement);
        } else {
          const replacement = `[Comprehensive search for "${query}" failed: ${result.error}]`;
          processedResponse = processedResponse.replace(fullMatch, replacement);
        }
      } else {
        processedResponse = processedResponse.replace(fullMatch, '[Invalid search query]');
      }
    }
    
    return processedResponse;
  }

  /**
   * Handle injury-specific queries
   */
  private async handleInjuryQuery(query: string): Promise<ComprehensiveResult> {
    console.log('🏥 Handling injury query...');
    
    // Get both search results and RSS injury reports
    const [searchResult, injuryReports] = await Promise.all([
      this.enhancedSearch.search(query),
      this.rssAggregator.getInjuryReports()
    ]);

    const sources: string[] = [];
    if (searchResult.success && searchResult.source) sources.push(`Web Search (${searchResult.source})`);
    if (injuryReports.success) sources.push('Fantasy RSS (Injury Reports)');

    let combinedText = '';
    
    if (injuryReports.success && injuryReports.injuryItems.length > 0) {
      combinedText += '🏥 **Recent Injury Reports:**\n';
      combinedText += this.rssAggregator.formatItemsForDisplay(injuryReports.injuryItems, 8);
      combinedText += '\n';
    }
    
    if (searchResult.success && searchResult.results) {
      combinedText += '🔍 **Additional Injury Information:**\n';
      combinedText += searchResult.results;
    }

    return {
      success: sources.length > 0,
      searchResults: searchResult,
      rssResults: injuryReports.injuryItems,
      combinedText: combinedText || 'No injury information found',
      summary: `Injury search found ${injuryReports.injuryItems?.length || 0} RSS items and ${searchResult.success ? 'web results' : 'no web results'}`,
      sources
    };
  }

  /**
   * Handle waiver wire queries
   */
  private async handleWaiverQuery(query: string): Promise<ComprehensiveResult> {
    console.log('🎯 Handling waiver wire query...');
    
    // Enhance query for waiver wire searches
    const enhancedQuery = `${query} waiver wire targets pickups add drops 2024`;
    
    const searchResult = await this.enhancedSearch.search(enhancedQuery);
    const rssSearch = await this.rssAggregator.searchFantasyNews('waiver wire', 5);
    
    const sources: string[] = [];
    if (searchResult.success && searchResult.source) sources.push(`Web Search (${searchResult.source})`);
    if (rssSearch.success) sources.push('Fantasy RSS (Waiver News)');
    
    let combinedText = '';
    
    if (searchResult.success && searchResult.results) {
      combinedText += searchResult.results;
      combinedText += '\n';
    }
    
    if (rssSearch.success && rssSearch.matchingItems.length > 0) {
      combinedText += '\n📰 **Recent Waiver Wire News:**\n';
      combinedText += this.rssAggregator.formatItemsForDisplay(rssSearch.matchingItems, 5);
    }

    return {
      success: sources.length > 0,
      searchResults: searchResult,
      rssResults: rssSearch.matchingItems,
      combinedText: combinedText || 'No waiver wire information found',
      summary: 'Waiver wire search completed',
      sources
    };
  }

  /**
   * Handle matchup/start-sit queries
   */
  private async handleMatchupQuery(query: string): Promise<ComprehensiveResult> {
    console.log('⚔️ Handling matchup query...');
    
    const enhancedQuery = `${query} start sit matchup analysis rankings 2024`;
    return await this.comprehensiveSearch(enhancedQuery);
  }

  /**
   * Handle weather-related queries
   */
  private async handleWeatherQuery(query: string): Promise<ComprehensiveResult> {
    console.log('🌤️ Handling weather query...');
    
    const enhancedQuery = `${query} NFL weather forecast game conditions`;
    return await this.comprehensiveSearch(enhancedQuery);
  }

  /**
   * Combine search and RSS results intelligently
   */
  private combineResults(searchResults?: WebSearchResult, rssResults?: RSSItem[], query?: string): string {
    let combined = '';
    
    // Prioritize RSS results for fantasy queries if recent
    if (this.config.prioritizeRecency && rssResults && rssResults.length > 0) {
      const recentItems = rssResults.filter(item => {
        const hoursAgo = this.getHoursAgo(item.pubDate);
        return hoursAgo < 24; // Less than 24 hours old
      });
      
      if (recentItems.length > 0) {
        combined += '📰 **Latest Fantasy News (Last 24 Hours):**\n';
        combined += this.rssAggregator.formatItemsForDisplay(recentItems, 5);
        combined += '\n';
      }
    }

    // Add web search results
    if (searchResults?.success && searchResults.results) {
      combined += searchResults.results;
      combined += '\n';
    }

    // Add remaining RSS results if any
    if (rssResults && rssResults.length > 0) {
      const remainingItems = this.config.prioritizeRecency 
        ? rssResults.filter(item => this.getHoursAgo(item.pubDate) >= 24)
        : rssResults;
        
      if (remainingItems.length > 0) {
        combined += '\n📰 **Additional Fantasy News:**\n';
        combined += this.rssAggregator.formatItemsForDisplay(remainingItems, 6);
      }
    }

    return combined.trim() || 'No relevant information found';
  }

  /**
   * Generate comprehensive summary
   */
  private generateComprehensiveSummary(searchResults?: WebSearchResult, rssResults?: RSSItem[], sources?: string[]): string {
    const parts = [];
    
    if (searchResults?.success) {
      parts.push(`web search via ${searchResults.source}`);
    }
    
    if (rssResults && rssResults.length > 0) {
      parts.push(`${rssResults.length} RSS news items`);
    }
    
    const sourceText = sources && sources.length > 0 ? ` from ${sources.join(', ')}` : '';
    
    return `Found information via ${parts.join(' and ')}${sourceText}`;
  }

  /**
   * Generate helpful message when no results found
   */
  private generateNoResultsMessage(query: string, isFantasyQuery: boolean): string {
    let message = `No current information found for "${query}".`;
    
    if (isFantasyQuery) {
      message += '\n\nFor the most up-to-date fantasy football information, try:';
      message += '\n• Visiting FantasyPros.com for expert analysis';
      message += '\n• Checking NFL.com for official injury reports';
      message += '\n• Looking at team social media for breaking news';
      message += '\n• Using more specific player names or team references';
    }
    
    return message;
  }

  /**
   * Utility methods
   */
  private isFantasyFootballQuery(query: string): boolean {
    const fantasyKeywords = ['fantasy', 'football', 'nfl', 'injury', 'waiver', 'start', 'sit', 'matchup', 'player'];
    const lowerQuery = query.toLowerCase();
    return fantasyKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  private isInjuryQuery(query: string): boolean {
    const injuryKeywords = ['injury', 'injured', 'hurt', 'questionable', 'doubtful', 'ir', 'inactive'];
    const lowerQuery = query.toLowerCase();
    return injuryKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  private categorizeFantasyQuery(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (this.isInjuryQuery(query)) return 'injury';
    if (lowerQuery.includes('waiver') || lowerQuery.includes('pickup') || lowerQuery.includes('add')) return 'waiver';
    if (lowerQuery.includes('start') || lowerQuery.includes('sit') || lowerQuery.includes('matchup')) return 'matchup';
    if (lowerQuery.includes('weather') || lowerQuery.includes('forecast')) return 'weather';
    
    return 'general';
  }

  private getHoursAgo(dateString: string): number {
    try {
      const date = new Date(dateString);
      const now = new Date();
      return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    } catch {
      return 999; // Very old if can't parse
    }
  }

  /**
   * Configuration and stats
   */
  getSearchStats() {
    return this.enhancedSearch.getSearchStats();
  }

  resetSearchCount(): void {
    this.enhancedSearch.resetSearchCount();
  }

  updateConfig(newConfig: Partial<WebDataConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.enhancedSearch.updateConfig(newConfig);
  }
}

// Export configured instance
export const comprehensiveWebData = new ComprehensiveWebData({
  enableFantasyOptimization: true,
  useRSSFeeds: true,
  combineResultTypes: true,
  prioritizeRecency: true,
  maxSearches: 10,
  maxResultsPerSearch: 5
});

// Export with API keys if available
export const configuredComprehensiveWebData = new ComprehensiveWebData({
  serperApiKey: process.env.SERPER_API_KEY,
  scrapingDogApiKey: process.env.SCRAPINGDOG_API_KEY,
  enableFantasyOptimization: true,
  useRSSFeeds: true,
  combineResultTypes: true,
  prioritizeRecency: true,
  maxSearches: 15,
  maxResultsPerSearch: 8
});