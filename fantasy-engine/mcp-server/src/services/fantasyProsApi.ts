import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';

export interface FantasyProsPlayer {
  player: {
    name: string;
    team: string;
    position: string;
  };
  adp: number;
  expertConsensus: number;
  tier: number;
  bestRank: number;
  worstRank: number;
  avgRank: number;
  stdDev: number;
}

export interface FantasyProsRankings {
  lastUpdated: Date;
  format: string;
  position: string;
  players: FantasyProsPlayer[];
}

export class FantasyProsApiService {
  private client: AxiosInstance;
  private isAuthenticated = false;
  private cookies: string = '';
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests
  private cache = new Map<string, {data: FantasyProsRankings, expiry: number}>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.client = axios.create({
      baseURL: 'https://www.fantasypros.com',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
  }

  /**
   * Throttle requests to prevent anti-scraping measures
   */
  private async throttledRequest(url: string, config?: any): Promise<any> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`⏳ Throttling request to ${url}, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    return this.client.get(url, config);
  }

  /**
   * Generate cache key for rankings
   */
  private getCacheKey(position: string, format: string): string {
    return `rankings_${position}_${format}`;
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(cacheEntry: {data: FantasyProsRankings, expiry: number}): boolean {
    return Date.now() < cacheEntry.expiry;
  }

  /**
   * Get cached rankings if available and valid
   */
  private getCachedRankings(position: string, format: string): FantasyProsRankings | null {
    const cacheKey = this.getCacheKey(position, format);
    const cacheEntry = this.cache.get(cacheKey);
    
    if (cacheEntry && this.isCacheValid(cacheEntry)) {
      console.log(`📦 Using cached rankings for ${position} ${format}`);
      return cacheEntry.data;
    }
    
    // Clean up expired cache entry
    if (cacheEntry) {
      this.cache.delete(cacheKey);
    }
    
    return null;
  }

  /**
   * Cache rankings data
   */
  private cacheRankings(position: string, format: string, data: FantasyProsRankings): void {
    const cacheKey = this.getCacheKey(position, format);
    const expiry = Date.now() + this.CACHE_TTL;
    this.cache.set(cacheKey, { data, expiry });
    console.log(`💾 Cached rankings for ${position} ${format}, expires in ${this.CACHE_TTL/1000/60} minutes`);
  }

  /**
   * Build position-specific URL for FantasyPros rankings
   * Uses FantasyPros URL structure for optimal server-side filtering
   */
  private buildPositionSpecificUrl(position: string, format: string): string {
    const baseFormat = format.toLowerCase();
    
    // FantasyPros position-specific URLs for better performance
    const positionUrls: { [key: string]: string } = {
      'QB': `/nfl/rankings/qb-cheatsheets.php`,
      'RB': `/nfl/rankings/rb-cheatsheets.php`, 
      'WR': `/nfl/rankings/wr-cheatsheets.php`,
      'TE': `/nfl/rankings/te-cheatsheets.php`,
      'K': `/nfl/rankings/k-cheatsheets.php`,
      'DST': `/nfl/rankings/dst-cheatsheets.php`
    };

    // Use position-specific URL if available
    if (position !== 'ALL' && positionUrls[position]) {
      const specificUrl = positionUrls[position];
      
      // Add format parameter for non-standard scoring
      if (baseFormat !== 'ppr') {
        return `${specificUrl}?scoring=${baseFormat}`;
      }
      
      return specificUrl;
    }

    // Fallback to general cheatsheet with format
    const generalUrl = `/nfl/rankings/${baseFormat}-cheatsheets.php`;
    
    // Add position filter as parameter for general URL
    if (position !== 'ALL') {
      return `${generalUrl}?pos=${position.toLowerCase()}`;
    }
    
    return generalUrl;
  }

  /**
   * Enhanced extraction with basic fallback strategies
   */
  private async extractWithBasicFallback(html: string, position: string, format: string): Promise<FantasyProsRankings> {
    // Strategy 1: Try primary ecrData extraction
    try {
      const ecrDataMatch = html.match(/var\s+ecrData\s*=\s*({[^;]+});/);
      
      if (ecrDataMatch) {
        const ecrData = JSON.parse(ecrDataMatch[1]);
        const playersData = ecrData.players || [];
        
        const players: FantasyProsPlayer[] = playersData
          .filter((p: any) => !position || position === 'ALL' || p.player_position_id === position)
          .map((p: any) => ({
            player: {
              name: p.player_name,
              team: p.player_team_id,
              position: p.player_position_id
            },
            adp: parseFloat(p.rank_ave) || p.rank_ecr,
            expertConsensus: p.rank_ecr,
            tier: p.tier || Math.ceil(p.rank_ecr / 12),
            bestRank: parseInt(p.rank_min) || p.rank_ecr,
            worstRank: parseInt(p.rank_max) || p.rank_ecr,
            avgRank: parseFloat(p.rank_ave) || p.rank_ecr,
            stdDev: parseFloat(p.rank_std) || 0
          }));
        
        if (players.length > 0) {
          console.log('✅ Rankings extracted using primary strategy');
          return {
            lastUpdated: new Date(),
            format,
            position,
            players
          };
        }
      }
    } catch (error) {
      console.warn('⚠️ Primary extraction failed, trying fallback');
    }

    // Strategy 2: Fallback to HTML table parsing
    const $ = cheerio.load(html);
    const players: FantasyProsPlayer[] = [];
    
    const tableSelectors = ['#ranking-table tbody tr', '.rankings-table tbody tr', 'table tbody tr'];
    
    for (const selector of tableSelectors) {
      if ($(selector).length > 0) {
        $(selector).each((index, element) => {
          const $row = $(element);
          const rank = parseInt($row.find('.rank, td:first').text()) || index + 1;
          
          const playerName = $row.find('.player-label a, .player-name, a[href*="/players/"]').first().text().trim();
          const teamPos = $row.find('.player-label small, .team-position').text().trim();
          
          if (playerName) {
            const [team, pos] = teamPos.split(/[\s-]+/);
            
            players.push({
              player: {
                name: playerName,
                team: team || 'FA',
                position: pos || position || 'Unknown'
              },
              adp: rank,
              expertConsensus: rank,
              tier: Math.ceil(rank / 12),
              bestRank: rank,
              worstRank: rank,
              avgRank: rank,
              stdDev: 0
            });
          }
        });
        
        if (players.length > 0) break;
      }
    }

    if (players.length > 0) {
      console.log('✅ Rankings extracted using fallback strategy');
      return {
        lastUpdated: new Date(),
        format,
        position,
        players
      };
    }

    throw new Error('All extraction strategies failed - no ranking data found');
  }

  async authenticate(email: string, password: string): Promise<boolean> {
    try {
      // Get login page to extract CSRF token
      const loginPage = await this.client.get('/accounts/login/');
      const $ = cheerio.load(loginPage.data);
      const csrfToken = $('input[name="csrfmiddlewaretoken"]').attr('value');

      if (!csrfToken) {
        throw new Error('Could not find CSRF token');
      }

      // Perform login
      const loginResponse = await this.client.post('/accounts/login/', {
        email,
        password,
        csrfmiddlewaretoken: csrfToken
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://www.fantasypros.com/accounts/login/',
          'Cookie': loginPage.headers['set-cookie']?.join('; ') || ''
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 400 // Accept redirects as success
      });

      // Store authentication cookies
      this.cookies = loginResponse.headers['set-cookie']?.join('; ') || '';
      this.client.defaults.headers['Cookie'] = this.cookies;
      this.isAuthenticated = true;

      console.log('✅ FantasyPros authentication successful');
      return true;
    } catch (error: any) {
      console.error('❌ FantasyPros authentication failed:', error.message);
      return false;
    }
  }

  async authenticateWithSession(sessionId: string, additionalCookies?: string): Promise<boolean> {
    try {
      // Build cookie string with session ID and any additional cookies
      const cookieString = additionalCookies ? 
        `sessionid=${sessionId}; ${additionalCookies}` : 
        `sessionid=${sessionId}; is5vHOtZn65zpLqA=${sessionId}`;
      
      this.cookies = cookieString;
      this.client.defaults.headers['Cookie'] = this.cookies;
      
      // Add additional headers to mimic browser request
      this.client.defaults.headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
      this.client.defaults.headers['Accept-Language'] = 'en-US,en;q=0.5';
      this.client.defaults.headers['Cache-Control'] = 'no-cache';
      this.client.defaults.headers['Pragma'] = 'no-cache';
      
      // Test authentication by fetching rankings page
      const testResponse = await this.client.get('/nfl/rankings/ppr-cheatsheets.php', {
        maxRedirects: 5,
        validateStatus: (status) => status < 500
      });
      
      // Check if we get redirected to login (indicates auth failed)
      const finalUrl = testResponse.request?.res?.responseUrl || testResponse.config.url;
      if (finalUrl && finalUrl.includes('/accounts/login')) {
        throw new Error('Session redirected to login - invalid or expired');
      }
      
      // Check for specific ECR data availability  
      const $ = cheerio.load(testResponse.data);
      const html = testResponse.data;
      
      // Primary check: ECR JavaScript data (most reliable)
      const hasEcrData = /var\s+ecrData\s*=/.test(html);
      
      // Secondary checks: HTML table elements
      const hasRankingTables = $('#ranking-table').length > 0 || 
                              $('.rankings-table').length > 0 ||
                              $('.player-table').length > 0 ||
                              $('[data-player-id]').length > 0;
      
      // Tertiary check: Premium content access
      const hasUserInfo = $('.user-info').length > 0 || 
                         $('.username').length > 0 ||
                         $('[class*="user"]').length > 0;
      
      // Enhanced validation logic
      if (!hasEcrData && !hasRankingTables) {
        throw new Error('No ECR data or ranking tables found - authentication may have failed or MVP access unavailable');
      }
      
      if (!hasEcrData && testResponse.data.length < 2000) {
        throw new Error('Response too small and no ECR data - likely blocked or redirected');
      }
      
      this.isAuthenticated = true;
      console.log('✅ FantasyPros session authentication successful');
      return true;
    } catch (error: any) {
      console.error('❌ FantasyPros session authentication failed:', error.message);
      console.error('Debug: Response length:', error.response?.data?.length || 0);
      return false;
    }
  }

  async getRankings(position: 'ALL' | 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST' = 'ALL', format: 'STD' | 'HALF' | 'PPR' = 'PPR'): Promise<FantasyProsRankings> {
    // Check cache first (works for both premium and fallback data)
    const cachedRankings = this.getCachedRankings(position, format);
    if (cachedRankings) {
      return cachedRankings;
    }

    // Try premium FantasyPros data first
    if (this.isAuthenticated) {
      try {
        console.log(`🏆 Fetching premium FantasyPros ${position} rankings for ${format}`);
        const rankings = await this.getPremiumRankings(position, format);
        
        // Cache the results
        this.cacheRankings(position, format, rankings);
        return rankings;
      } catch (error: any) {
        console.warn(`⚠️ Premium FantasyPros failed (${error.message}), falling back to basic rankings`);
      }
    } else {
      console.log(`🔓 No FantasyPros authentication, using fallback rankings`);
    }

    // Fallback to basic ranking data
    try {
      console.log(`📊 Using fallback ranking data for ${position} ${format}`);
      const rankings = await this.getBasicFallbackRankings(position, format);
      
      // Cache the fallback results too
      this.cacheRankings(position, format, rankings);
      return rankings;
    } catch (error: any) {
      throw new Error(`All ranking sources failed. FantasyPros: ${this.isAuthenticated ? 'authenticated but failed' : 'not authenticated'}, Fallback: ${error.message}`);
    }
  }

  /**
   * Get premium FantasyPros rankings (requires authentication)
   */
  private async getPremiumRankings(position: string, format: string): Promise<FantasyProsRankings> {
    // Build position-specific URL for better server-side filtering
    const url = this.buildPositionSpecificUrl(position, format);
    
    const response = await this.throttledRequest(url);
    const html = response.data;
    
    // Use enhanced extraction strategies
    return await this.extractWithBasicFallback(html, position, format);
  }

  /**
   * Get basic fallback rankings (simplified static data when no premium access)
   */
  private async getBasicFallbackRankings(position: string, format: string): Promise<FantasyProsRankings> {
    console.log(`🔧 Generating basic fallback rankings for ${position} ${format}`);
    
    // Basic tier-based rankings when premium data unavailable
    const basicRankings = this.generateBasicRankingsByPosition(position);
    
    const players: FantasyProsPlayer[] = basicRankings.map((playerData, index) => ({
      player: {
        name: playerData.name,
        team: playerData.team,
        position: playerData.position
      },
      adp: index + 1,
      expertConsensus: index + 1,
      tier: Math.ceil((index + 1) / 12), // 12-player tiers
      bestRank: index + 1,
      worstRank: index + 1,
      avgRank: index + 1,
      stdDev: 0
    }));

    console.log(`✅ Generated ${players.length} basic ${position} rankings for ${format}`);

    return {
      lastUpdated: new Date(),
      format,
      position,
      players
    };
  }

  /**
   * Generate basic position rankings (static data for fallback)
   */
  private generateBasicRankingsByPosition(position: string): Array<{name: string, team: string, position: string}> {
    const basicData: { [key: string]: Array<{name: string, team: string, position: string}> } = {
      'QB': [
        {name: 'Josh Allen', team: 'BUF', position: 'QB'},
        {name: 'Lamar Jackson', team: 'BAL', position: 'QB'},
        {name: 'Jalen Hurts', team: 'PHI', position: 'QB'},
        {name: 'Josh Jacobs', team: 'GB', position: 'QB'},
        {name: 'Dak Prescott', team: 'DAL', position: 'QB'},
        {name: 'Joe Burrow', team: 'CIN', position: 'QB'},
        {name: 'Tua Tagovailoa', team: 'MIA', position: 'QB'},
        {name: 'Kyler Murray', team: 'ARI', position: 'QB'},
        {name: 'Brock Purdy', team: 'SF', position: 'QB'},
        {name: 'CJ Stroud', team: 'HOU', position: 'QB'},
        {name: 'Anthony Richardson', team: 'IND', position: 'QB'},
        {name: 'Patrick Mahomes', team: 'KC', position: 'QB'}
      ],
      'RB': [
        {name: 'Christian McCaffrey', team: 'SF', position: 'RB'},
        {name: 'Breece Hall', team: 'NYJ', position: 'RB'},
        {name: 'Bijan Robinson', team: 'ATL', position: 'RB'},
        {name: 'Jonathan Taylor', team: 'IND', position: 'RB'},
        {name: 'Derrick Henry', team: 'BAL', position: 'RB'},
        {name: 'Saquon Barkley', team: 'PHI', position: 'RB'},
        {name: 'Josh Jacobs', team: 'GB', position: 'RB'},
        {name: 'Kenneth Walker III', team: 'SEA', position: 'RB'},
        {name: 'De\'Von Achane', team: 'MIA', position: 'RB'},
        {name: 'Alvin Kamara', team: 'NO', position: 'RB'},
        {name: 'Joe Mixon', team: 'HOU', position: 'RB'},
        {name: 'Jahmyr Gibbs', team: 'DET', position: 'RB'}
      ],
      'WR': [
        {name: 'CeeDee Lamb', team: 'DAL', position: 'WR'},
        {name: 'Tyreek Hill', team: 'MIA', position: 'WR'},
        {name: 'Amon-Ra St. Brown', team: 'DET', position: 'WR'},
        {name: 'A.J. Brown', team: 'PHI', position: 'WR'},
        {name: 'Ja\'Marr Chase', team: 'CIN', position: 'WR'},
        {name: 'Justin Jefferson', team: 'MIN', position: 'WR'},
        {name: 'Stefon Diggs', team: 'HOU', position: 'WR'},
        {name: 'Puka Nacua', team: 'LAR', position: 'WR'},
        {name: 'DK Metcalf', team: 'SEA', position: 'WR'},
        {name: 'DeVonta Smith', team: 'PHI', position: 'WR'},
        {name: 'Mike Evans', team: 'TB', position: 'WR'},
        {name: 'Chris Godwin', team: 'TB', position: 'WR'}
      ],
      'TE': [
        {name: 'Travis Kelce', team: 'KC', position: 'TE'},
        {name: 'Mark Andrews', team: 'BAL', position: 'TE'},
        {name: 'Sam LaPorta', team: 'DET', position: 'TE'},
        {name: 'Trey McBride', team: 'ARI', position: 'TE'},
        {name: 'George Kittle', team: 'SF', position: 'TE'},
        {name: 'Evan Engram', team: 'JAX', position: 'TE'},
        {name: 'Kyle Pitts', team: 'ATL', position: 'TE'},
        {name: 'Dallas Goedert', team: 'PHI', position: 'TE'},
        {name: 'Dalton Kincaid', team: 'BUF', position: 'TE'},
        {name: 'Jake Ferguson', team: 'DAL', position: 'TE'},
        {name: 'David Njoku', team: 'CLE', position: 'TE'},
        {name: 'T.J. Hockenson', team: 'MIN', position: 'TE'}
      ]
    };

    if (position === 'ALL') {
      // Return mix of all positions for ALL
      return [
        ...basicData.QB.slice(0, 3),
        ...basicData.RB.slice(0, 4), 
        ...basicData.WR.slice(0, 4),
        ...basicData.TE.slice(0, 2)
      ];
    }

    return basicData[position] || [];
  }

  async getADP(format: 'STD' | 'HALF' | 'PPR' = 'PPR'): Promise<{ [playerName: string]: number }> {
    try {
      const rankings = await this.getRankings('ALL', format);
      const adpMap: { [playerName: string]: number } = {};
      
      rankings.players.forEach(player => {
        adpMap[player.player.name] = player.adp || player.expertConsensus;
      });
      
      return adpMap;
    } catch (error: any) {
      throw new Error(`Failed to fetch FantasyPros ADP: ${error.message}`);
    }
  }

  async getPlayerTiers(position: 'QB' | 'RB' | 'WR' | 'TE', format: 'STD' | 'HALF' | 'PPR' = 'PPR'): Promise<{ [tier: number]: FantasyProsPlayer[] }> {
    try {
      const rankings = await this.getRankings(position, format);
      const tiers: { [tier: number]: FantasyProsPlayer[] } = {};
      
      rankings.players.forEach(player => {
        if (!tiers[player.tier]) {
          tiers[player.tier] = [];
        }
        tiers[player.tier].push(player);
      });
      
      return tiers;
    } catch (error: any) {
      throw new Error(`Failed to fetch FantasyPros tiers: ${error.message}`);
    }
  }

  // Get start/sit recommendations (MVP feature)
  async getStartSitRecommendations(week: number = 1): Promise<any> {
    if (!this.isAuthenticated) {
      throw new Error('Must authenticate with FantasyPros first');
    }

    try {
      const url = `/nfl/start-sit.php?week=${week}`;
      const response = await this.throttledRequest(url);
      const $ = cheerio.load(response.data);

      const recommendations: any = {
        starts: [],
        sits: []
      };

      // Parse start recommendations
      $('.start-sit-start .player-label').each((index, element) => {
        const $player = $(element);
        const name = $player.find('a').text().trim();
        const teamPos = $player.find('small').text().trim();
        
        if (name && teamPos) {
          recommendations.starts.push({ name, teamPos });
        }
      });

      // Parse sit recommendations
      $('.start-sit-sit .player-label').each((index, element) => {
        const $player = $(element);
        const name = $player.find('a').text().trim();
        const teamPos = $player.find('small').text().trim();
        
        if (name && teamPos) {
          recommendations.sits.push({ name, teamPos });
        }
      });

      return recommendations;
    } catch (error: any) {
      throw new Error(`Failed to fetch start/sit recommendations: ${error.message}`);
    }
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated;
  }
}

export const fantasyProsApi = new FantasyProsApiService();