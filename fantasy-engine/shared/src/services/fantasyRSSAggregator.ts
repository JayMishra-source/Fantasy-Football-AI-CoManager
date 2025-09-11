// Fantasy Football RSS Feed Aggregator for real-time news and injury updates
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

export interface RSSItem {
  title: string;
  description?: string;
  link: string;
  pubDate: string;
  source: string;
  category?: string;
}

export interface RSSFeedResult {
  success: boolean;
  items?: RSSItem[];
  error?: string;
  source: string;
}

export class FantasyRSSAggregator {
  private xmlParser: XMLParser;
  
  // Fantasy football RSS feeds (publicly available)
  private rssFeeds = [
    {
      name: 'ESPN Fantasy Football',
      url: 'https://www.espn.com/espn/rss/fantasy/football/news',
      category: 'news'
    },
    {
      name: 'NFL News',
      url: 'https://www.nfl.com/news/rss.xml',
      category: 'news'
    },
    {
      name: 'FantasyPros News',
      url: 'https://www.fantasypros.com/nfl/news/rss/',
      category: 'news'
    },
    {
      name: 'Rotoworld Fantasy Football',
      url: 'https://www.nbcsports.com/fantasy/football/rss',
      category: 'fantasy'
    },
    {
      name: 'Fantasy Footballers',
      url: 'https://www.thefantasyfootballers.com/feed/',
      category: 'analysis'
    }
  ];

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
  }

  /**
   * Fetch and parse a single RSS feed
   */
  async fetchRSSFeed(feedUrl: string, sourceName: string): Promise<RSSFeedResult> {
    try {
      console.log(`📡 Fetching RSS feed: ${sourceName}`);
      
      const response = await axios.get(feedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FantasyAI/1.0)',
          'Accept': 'application/rss+xml, application/xml, text/xml'
        },
        timeout: 10000
      });

      const parsed = this.xmlParser.parse(response.data);
      const channel = parsed.rss?.channel || parsed.feed;
      
      if (!channel) {
        throw new Error('Invalid RSS format');
      }

      const items = channel.item || channel.entry || [];
      const rssItems: RSSItem[] = Array.isArray(items) ? items : [items];

      const processedItems = rssItems.slice(0, 10).map((item: any) => ({
        title: item.title?.['#text'] || item.title || 'No title',
        description: this.cleanDescription(
          item.description?.['#text'] || 
          item.description || 
          item.summary?.['#text'] || 
          item.summary ||
          item.content?.['#text'] ||
          item.content
        ),
        link: item.link?.['@_href'] || item.link || item.guid?.['#text'] || item.guid || '#',
        pubDate: item.pubDate || item.published || item.updated || 'Unknown date',
        source: sourceName
      }));

      return {
        success: true,
        items: processedItems,
        source: sourceName
      };

    } catch (error: any) {
      console.error(`❌ RSS feed failed for ${sourceName}:`, error.message);
      return {
        success: false,
        error: error.message,
        source: sourceName
      };
    }
  }

  /**
   * Fetch multiple RSS feeds and aggregate results
   */
  async aggregateFantasyNews(maxItemsPerFeed: number = 5): Promise<{
    success: boolean;
    allItems: RSSItem[];
    feedResults: RSSFeedResult[];
    summary: string;
  }> {
    console.log('📰 Aggregating fantasy football RSS feeds...');

    const feedPromises = this.rssFeeds.map(feed => 
      this.fetchRSSFeed(feed.url, feed.name)
    );

    const feedResults = await Promise.allSettled(feedPromises);
    const successfulFeeds: RSSFeedResult[] = [];
    const allItems: RSSItem[] = [];

    feedResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        const feedResult = result.value;
        successfulFeeds.push(feedResult);
        
        if (feedResult.items) {
          // Add category from feed configuration
          const feedConfig = this.rssFeeds[index];
          const categorizedItems = feedResult.items
            .slice(0, maxItemsPerFeed)
            .map(item => ({
              ...item,
              category: feedConfig.category
            }));
          
          allItems.push(...categorizedItems);
        }
      }
    });

    // Sort by publication date (most recent first)
    allItems.sort((a, b) => {
      const dateA = new Date(a.pubDate).getTime();
      const dateB = new Date(b.pubDate).getTime();
      return dateB - dateA;
    });

    // Generate summary
    const summary = this.generateNewsSummary(allItems, successfulFeeds.length);

    return {
      success: successfulFeeds.length > 0,
      allItems: allItems.slice(0, 25), // Limit total items
      feedResults: successfulFeeds,
      summary
    };
  }

  /**
   * Search for specific topics in aggregated news
   */
  async searchFantasyNews(searchTerm: string, maxResults: number = 10): Promise<{
    success: boolean;
    matchingItems: RSSItem[];
    summary: string;
  }> {
    console.log(`🔍 Searching fantasy news for: ${searchTerm}`);

    const newsData = await this.aggregateFantasyNews();
    
    if (!newsData.success) {
      return {
        success: false,
        matchingItems: [],
        summary: 'Failed to fetch fantasy news feeds'
      };
    }

    const searchLower = searchTerm.toLowerCase();
    const matchingItems = newsData.allItems.filter(item => {
      const titleMatch = item.title.toLowerCase().includes(searchLower);
      const descMatch = item.description?.toLowerCase().includes(searchLower);
      return titleMatch || descMatch;
    }).slice(0, maxResults);

    const summary = matchingItems.length > 0
      ? `Found ${matchingItems.length} recent news items about "${searchTerm}":`
      : `No recent news found for "${searchTerm}" in fantasy football feeds.`;

    return {
      success: true,
      matchingItems,
      summary
    };
  }

  /**
   * Get injury-specific news
   */
  async getInjuryReports(): Promise<{
    success: boolean;
    injuryItems: RSSItem[];
    summary: string;
  }> {
    console.log('🏥 Fetching injury reports...');

    const newsData = await this.aggregateFantasyNews();
    
    if (!newsData.success) {
      return {
        success: false,
        injuryItems: [],
        summary: 'Failed to fetch injury news'
      };
    }

    const injuryKeywords = ['injury', 'injured', 'hurt', 'questionable', 'doubtful', 'out', 'ir', 'inactive'];
    
    const injuryItems = newsData.allItems.filter(item => {
      const text = (item.title + ' ' + (item.description || '')).toLowerCase();
      return injuryKeywords.some(keyword => text.includes(keyword));
    }).slice(0, 15);

    const summary = injuryItems.length > 0
      ? `📊 Found ${injuryItems.length} recent injury-related news items:`
      : 'No recent injury reports found in fantasy football feeds.';

    return {
      success: true,
      injuryItems,
      summary
    };
  }

  /**
   * Clean HTML and truncate description text
   */
  private cleanDescription(description?: string): string {
    if (!description) return '';
    
    // Remove HTML tags
    const cleaned = description.replace(/<[^>]*>/g, '');
    
    // Decode common HTML entities
    const decoded = cleaned
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ');

    // Truncate and clean up whitespace
    return decoded.substring(0, 300).replace(/\s+/g, ' ').trim();
  }

  /**
   * Generate a summary of the news aggregation
   */
  private generateNewsSummary(items: RSSItem[], successfulFeeds: number): string {
    if (items.length === 0) {
      return 'No fantasy football news items found from RSS feeds.';
    }

    const categories = items.reduce((acc, item) => {
      const cat = item.category || 'general';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const categoryText = Object.entries(categories)
      .map(([cat, count]) => `${count} ${cat}`)
      .join(', ');

    const timeRange = this.getTimeRange(items);

    return `📰 Aggregated ${items.length} fantasy football news items from ${successfulFeeds} sources (${categoryText}) ${timeRange}`;
  }

  /**
   * Determine time range of news items
   */
  private getTimeRange(items: RSSItem[]): string {
    if (items.length === 0) return '';

    const dates = items
      .map(item => new Date(item.pubDate))
      .filter(date => !isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());

    if (dates.length === 0) return '';

    const newest = dates[0];
    const now = new Date();
    const hoursAgo = Math.floor((now.getTime() - newest.getTime()) / (1000 * 60 * 60));

    if (hoursAgo < 1) return '(within the last hour)';
    if (hoursAgo < 24) return `(newest from ${hoursAgo} hours ago)`;
    return `(newest from ${Math.floor(hoursAgo / 24)} days ago)`;
  }

  /**
   * Format RSS items for display
   */
  formatItemsForDisplay(items: RSSItem[], maxItems: number = 10): string {
    if (items.length === 0) {
      return 'No news items to display.';
    }

    let formatted = '';
    
    items.slice(0, maxItems).forEach((item, index) => {
      formatted += `${index + 1}. **${item.title}**\n`;
      
      if (item.description) {
        formatted += `   ${item.description}\n`;
      }
      
      formatted += `   📅 ${this.formatDate(item.pubDate)} | 📰 ${item.source}\n`;
      formatted += `   🔗 ${item.link}\n\n`;
    });

    return formatted;
  }

  /**
   * Format date for display
   */
  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      const now = new Date();
      const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      
      if (diffHours < 1) return 'Just now';
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffHours < 48) return 'Yesterday';
      
      return date.toLocaleDateString();
    } catch (error) {
      return dateString;
    }
  }
}

// Export singleton instance
export const fantasyRSSAggregator = new FantasyRSSAggregator();