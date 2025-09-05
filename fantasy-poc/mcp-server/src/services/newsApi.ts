import axios from 'axios';

interface NewsArticle {
  title: string;
  summary: string;
  source: string;
  publishedAt: Date;
  playerNames: string[];
  impact: 'high' | 'medium' | 'low';
  category: 'injury' | 'trade' | 'performance' | 'depth_chart' | 'general';
}

interface PlayerNews {
  playerName: string;
  team: string;
  position: string;
  articles: NewsArticle[];
  injuryStatus?: string;
  fantasyImpact: string;
  confidenceScore: number;
}

export class NewsApi {
  private readonly newsApiKey: string | undefined;
  private readonly rapidApiKey: string | undefined;

  constructor() {
    this.newsApiKey = process.env.NEWS_API_KEY;
    this.rapidApiKey = process.env.RAPIDAPI_KEY;
  }

  async getPlayerNews(playerName: string, team?: string): Promise<PlayerNews | null> {
    if (!this.newsApiKey) {
      console.log('⚠️ News API key not configured - news data unavailable');
      return null;
    }

    try {
      // Search for recent player news
      const query = team ? `${playerName} ${team} NFL` : `${playerName} NFL`;
      
      const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: query,
          domains: 'espn.com,nfl.com,fantasypros.com,rotoworld.com,profootballrumors.com',
          sortBy: 'publishedAt',
          pageSize: 10,
          from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
          apiKey: this.newsApiKey
        }
      });

      if (!response.data.articles || response.data.articles.length === 0) {
        return null;
      }

      const articles = response.data.articles.map((article: any) => ({
        title: article.title,
        summary: article.description || '',
        source: article.source.name,
        publishedAt: new Date(article.publishedAt),
        playerNames: [playerName],
        impact: this.assessNewsImpact(article.title, article.description),
        category: this.categorizeNews(article.title, article.description)
      }));

      const fantasyImpact = this.generateFantasyImpact(articles);
      const injuryStatus = this.extractInjuryStatus(articles);

      return {
        playerName,
        team: team || '',
        position: '', // Would need to be provided or looked up
        articles,
        injuryStatus,
        fantasyImpact,
        confidenceScore: this.calculateConfidenceScore(articles)
      };

    } catch (error) {
      console.log(`⚠️ Failed to fetch news for ${playerName}: ${error}`);
      return null;
    }
  }

  async getInjuryReports(): Promise<NewsArticle[]> {
    if (!this.newsApiKey) {
      console.log('⚠️ News API key not configured - injury reports unavailable');
      return [];
    }

    try {
      const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: 'NFL injury report OR injured OR questionable OR doubtful OR out',
          domains: 'espn.com,nfl.com,rotoworld.com,profootballrumors.com',
          sortBy: 'publishedAt',
          pageSize: 20,
          from: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // Last 3 days
          apiKey: this.newsApiKey
        }
      });

      return response.data.articles
        .filter((article: any) => this.isInjuryRelated(article.title, article.description))
        .map((article: any) => ({
          title: article.title,
          summary: article.description || '',
          source: article.source.name,
          publishedAt: new Date(article.publishedAt),
          playerNames: this.extractPlayerNames(article.title, article.description),
          impact: this.assessNewsImpact(article.title, article.description),
          category: 'injury' as const
        }));

    } catch (error) {
      console.log(`⚠️ Failed to fetch injury reports: ${error}`);
      return [];
    }
  }

  private assessNewsImpact(title: string, description: string = ''): 'high' | 'medium' | 'low' {
    const text = (title + ' ' + description).toLowerCase();
    
    // High impact keywords
    const highImpactKeywords = ['out', 'ir', 'injured reserve', 'surgery', 'torn', 'fracture', 'suspended'];
    if (highImpactKeywords.some(keyword => text.includes(keyword))) {
      return 'high';
    }

    // Medium impact keywords
    const mediumImpactKeywords = ['questionable', 'doubtful', 'limited', 'trade', 'starting', 'benched'];
    if (mediumImpactKeywords.some(keyword => text.includes(keyword))) {
      return 'medium';
    }

    return 'low';
  }

  private categorizeNews(title: string, description: string = ''): NewsArticle['category'] {
    const text = (title + ' ' + description).toLowerCase();

    if (text.includes('injur') || text.includes('hurt') || text.includes('questionable') || 
        text.includes('doubtful') || text.includes('out') || text.includes('ir')) {
      return 'injury';
    }

    if (text.includes('trade') || text.includes('acquired') || text.includes('released')) {
      return 'trade';
    }

    if (text.includes('start') || text.includes('bench') || text.includes('depth chart') || 
        text.includes('role')) {
      return 'depth_chart';
    }

    if (text.includes('performance') || text.includes('stats') || text.includes('yards') || 
        text.includes('touchdown')) {
      return 'performance';
    }

    return 'general';
  }

  private isInjuryRelated(title: string, description: string = ''): boolean {
    const text = (title + ' ' + description).toLowerCase();
    const injuryKeywords = ['injur', 'hurt', 'questionable', 'doubtful', 'out', 'ir', 'inactive', 'limited'];
    return injuryKeywords.some(keyword => text.includes(keyword));
  }

  private extractPlayerNames(title: string, description: string = ''): string[] {
    // Simple extraction - would need more sophisticated NLP for better accuracy
    const text = title + ' ' + description;
    const words = text.split(' ');
    const playerNames: string[] = [];

    // Look for patterns like "FirstName LastName" where both are capitalized
    for (let i = 0; i < words.length - 1; i++) {
      const word1 = words[i].replace(/[^a-zA-Z]/g, '');
      const word2 = words[i + 1].replace(/[^a-zA-Z]/g, '');
      
      if (word1.length > 2 && word2.length > 2 && 
          word1[0] === word1[0].toUpperCase() && 
          word2[0] === word2[0].toUpperCase()) {
        const fullName = `${word1} ${word2}`;
        if (!playerNames.includes(fullName)) {
          playerNames.push(fullName);
        }
      }
    }

    return playerNames.slice(0, 3); // Limit to first 3 potential names
  }

  private extractInjuryStatus(articles: NewsArticle[]): string | undefined {
    for (const article of articles) {
      const text = (article.title + ' ' + article.summary).toLowerCase();
      
      if (text.includes('out') && (text.includes('week') || text.includes('game'))) {
        return 'OUT';
      }
      if (text.includes('doubtful')) {
        return 'DOUBTFUL';
      }
      if (text.includes('questionable')) {
        return 'QUESTIONABLE';
      }
      if (text.includes('ir') || text.includes('injured reserve')) {
        return 'INJURED_RESERVE';
      }
    }
    
    return undefined;
  }

  private generateFantasyImpact(articles: NewsArticle[]): string {
    const highImpactArticles = articles.filter(a => a.impact === 'high');
    const mediumImpactArticles = articles.filter(a => a.impact === 'medium');

    if (highImpactArticles.length > 0) {
      const categories = highImpactArticles.map(a => a.category);
      if (categories.includes('injury')) {
        return 'Major injury concern - significant fantasy impact expected';
      }
      if (categories.includes('trade')) {
        return 'Major roster move - monitor new situation closely';
      }
    }

    if (mediumImpactArticles.length > 0) {
      return 'Moderate fantasy impact - monitor closely for lineup decisions';
    }

    return 'Minimal fantasy impact based on recent news';
  }

  private calculateConfidenceScore(articles: NewsArticle[]): number {
    if (articles.length === 0) return 0;

    let score = 0;
    const recentCutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

    articles.forEach(article => {
      // Recency bonus
      if (article.publishedAt.getTime() > recentCutoff) {
        score += 30;
      } else {
        score += 10;
      }

      // Source reliability bonus
      const reliableSources = ['espn', 'nfl.com', 'rotoworld'];
      if (reliableSources.some(source => article.source.toLowerCase().includes(source))) {
        score += 20;
      } else {
        score += 10;
      }

      // Impact bonus
      if (article.impact === 'high') score += 25;
      else if (article.impact === 'medium') score += 15;
      else score += 5;
    });

    return Math.min(100, Math.round(score / articles.length));
  }
}

export const newsApi = new NewsApi();