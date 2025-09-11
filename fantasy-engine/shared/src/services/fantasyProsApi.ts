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
   * Check if the service is authenticated
   */
  getAuthenticationStatus(): boolean {
    return this.isAuthenticated;
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
   * Extract rankings using multiple fallback strategies
   */
  private async extractRankingsWithFallbacks(html: string, position: string, format: string): Promise<FantasyProsRankings> {
    const extractionStrategies = [
      () => this.extractFromEcrData(html, position, format),
      () => this.extractFromAlternativeScripts(html, position, format), 
      () => this.extractFromRankingTable(html, position, format),
      () => this.extractFromPlayerCards(html, position, format)
    ];

    let lastError: Error | null = null;

    for (let i = 0; i < extractionStrategies.length; i++) {
      try {
        const strategy = extractionStrategies[i];
        const result = await strategy();
        if (result && result.players.length > 0) {
          console.log(`✅ Rankings extracted using strategy ${i + 1}`);
          return result;
        }
      } catch (error: any) {
        console.warn(`⚠️ Strategy ${i + 1} failed:`, error.message);
        lastError = error;
        continue;
      }
    }

    throw new Error(`All extraction strategies failed. Last error: ${lastError?.message || 'Unknown'}`);
  }

  /**
   * Strategy 1: Extract from primary ecrData JavaScript variable
   */
  private extractFromEcrData(html: string, position: string, format: string): FantasyProsRankings {
    const ecrDataMatch = html.match(/var\s+ecrData\s*=\s*({[^;]+});/);
    
    if (!ecrDataMatch) {
      throw new Error('ecrData variable not found');
    }

    console.log(`🔍 Found ecrData variable, parsing JSON...`);
    const ecrData = JSON.parse(ecrDataMatch[1]);
    const playersData = ecrData.players || [];
    
    console.log(`📊 Raw ecrData contains ${playersData.length} players`);
    
    // Log first player for debugging
    if (playersData.length > 0) {
      const firstPlayer = playersData[0];
      console.log(`🧪 Sample raw player data:`, {
        player_name: firstPlayer.player_name,
        player_team_id: firstPlayer.player_team_id, 
        player_position_id: firstPlayer.player_position_id,
        rank_ecr: firstPlayer.rank_ecr,
        rank_ave: firstPlayer.rank_ave,
        rank_min: firstPlayer.rank_min,
        rank_max: firstPlayer.rank_max,
        rank_std: firstPlayer.rank_std,
        tier: firstPlayer.tier
      });
    }
    
    const players: FantasyProsPlayer[] = playersData
      .filter((p: any) => !position || position === 'ALL' || p.player_position_id === position)
      .map((p: any, index: number) => {
        const extractedPlayer = {
          player: {
            name: p.player_name || `Unknown Player ${index + 1}`,
            team: p.player_team_id || 'FA',
            position: p.player_position_id || position || 'UNKNOWN'
          },
          adp: parseFloat(p.rank_ave) || p.rank_ecr || (index + 1),
          expertConsensus: p.rank_ecr || (index + 1), // Ensure never undefined
          tier: p.tier || Math.ceil((p.rank_ecr || index + 1) / 12),
          bestRank: parseInt(p.rank_min) || p.rank_ecr || (index + 1),
          worstRank: parseInt(p.rank_max) || p.rank_ecr || (index + 1),
          avgRank: parseFloat(p.rank_ave) || p.rank_ecr || (index + 1),
          stdDev: parseFloat(p.rank_std) || 0
        };
        
        // Log first few extracted players for debugging
        if (index < 3) {
          console.log(`✅ Extracted player ${index + 1}:`, extractedPlayer);
        }
        
        return extractedPlayer;
      });
    
    console.log(`🎯 Extracted ${players.length} ${position} players for ${format}`);
    
    return {
      lastUpdated: new Date(),
      format,
      position,
      players
    };
  }

  /**
   * Strategy 2: Extract from alternative JavaScript patterns
   */
  private extractFromAlternativeScripts(html: string, position: string, format: string): FantasyProsRankings {
    // Try alternative variable names and patterns
    const alternativePatterns = [
      /var\s+rankingsData\s*=\s*({[^;]+});/,
      /var\s+playersData\s*=\s*({[^;]+});/,
      /"players"\s*:\s*(\[[^\]]+\])/,
      /window\.rankingData\s*=\s*({[^;]+});/
    ];

    for (const pattern of alternativePatterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          const playersArray = Array.isArray(data) ? data : data.players || [];
          
          if (playersArray.length > 0) {
            const players: FantasyProsPlayer[] = playersArray.map((p: any, index: number) => ({
              player: {
                name: p.name || p.player_name || p.playerName || 'Unknown',
                team: p.team || p.player_team_id || p.teamId || 'FA',
                position: p.position || p.player_position_id || p.pos || position || 'Unknown'
              },
              adp: p.adp || p.rank_ave || p.rank || index + 1,
              expertConsensus: p.rank_ecr || p.ecr || p.rank || index + 1,
              tier: p.tier || Math.ceil((p.rank_ecr || p.rank || index + 1) / 12),
              bestRank: p.rank_min || p.bestRank || p.rank_ecr || p.rank || index + 1,
              worstRank: p.rank_max || p.worstRank || p.rank_ecr || p.rank || index + 1,
              avgRank: p.rank_ave || p.avgRank || p.rank_ecr || p.rank || index + 1,
              stdDev: p.rank_std || p.stdDev || 0
            }));

            return {
              lastUpdated: new Date(),
              format,
              position,
              players
            };
          }
        } catch (error) {
          continue;
        }
      }
    }

    throw new Error('No alternative script patterns found');
  }

  /**
   * Strategy 3: Extract from HTML ranking table (existing logic)
   */
  private extractFromRankingTable(html: string, position: string, format: string): FantasyProsRankings {
    console.log(`🔍 Attempting HTML table extraction for ${position} ${format}`);
    const $ = cheerio.load(html);
    const players: FantasyProsPlayer[] = [];
    
    const tableSelectors = ['#ranking-table tbody tr', '.rankings-table tbody tr', 'table tbody tr'];
    
    for (const selector of tableSelectors) {
      const rowCount = $(selector).length;
      if (rowCount > 0) {
        console.log(`📊 Found ${rowCount} rows with selector: ${selector}`);
        
        $(selector).each((index, element) => {
          const $row = $(element);
          const rankText = $row.find('.rank, td:first').text().trim();
          const rank = parseInt(rankText) || index + 1;
          
          const playerName = $row.find('.player-label a, .player-name, a[href*="/players/"]').first().text().trim();
          const teamPos = $row.find('.player-label small, .team-position').text().trim();
          
          // Log first few rows for debugging
          if (index < 3) {
            console.log(`🧪 Row ${index + 1}: rank="${rankText}" -> ${rank}, name="${playerName}", teamPos="${teamPos}"`);
          }
          
          if (playerName && playerName.length > 1) {
            const [team, pos] = teamPos.split(/[\s-]+/);
            
            const extractedPlayer = {
              player: {
                name: playerName,
                team: team || 'FA',
                position: pos || position || 'Unknown'
              },
              adp: rank,
              expertConsensus: rank, // HTML fallback: ensure never undefined  
              tier: Math.ceil(rank / 12),
              bestRank: rank,
              worstRank: rank,
              avgRank: rank,
              stdDev: 0
            };
            
            if (index < 3) {
              console.log(`✅ HTML extracted player ${index + 1}:`, extractedPlayer);
            }
            
            players.push(extractedPlayer);
          }
        });
        
        if (players.length > 0) {
          console.log(`🎯 HTML table extraction successful: ${players.length} players`);
          break;
        }
      }
    }

    if (players.length === 0) {
      console.log(`❌ HTML table extraction failed: no players found`);
      throw new Error('No ranking table data found');
    }

    return {
      lastUpdated: new Date(),
      format,
      position,
      players
    };
  }

  /**
   * Strategy 4: Extract from player cards/divs (new fallback)
   */
  private extractFromPlayerCards(html: string, position: string, format: string): FantasyProsRankings {
    const $ = cheerio.load(html);
    const players: FantasyProsPlayer[] = [];
    
    // Try extracting from player card layouts
    const cardSelectors = [
      '.player-card',
      '.rankings-player',
      '[data-player-id]',
      '.fp-player-card'
    ];

    for (const selector of cardSelectors) {
      $(selector).each((index, element) => {
        const $card = $(element);
        const playerName = $card.find('.player-name, .name, h4, h5').first().text().trim();
        const team = $card.find('.team, .player-team').first().text().trim();
        const pos = $card.find('.position, .pos').first().text().trim();
        const rankText = $card.find('.rank, .ranking, .ecr').first().text().trim();
        const rank = parseInt(rankText) || index + 1;
        
        if (playerName && playerName.length > 1) {
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

    if (players.length === 0) {
      throw new Error('No player card data found');
    }

    return {
      lastUpdated: new Date(),
      format,
      position,
      players
    };
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
        console.warn(`⚠️ Premium FantasyPros failed (${error.message}), falling back to public data`);
      }
    } else {
      console.log(`🔓 No FantasyPros authentication, using public rankings`);
    }

    // Fallback to ESPN public rankings
    try {
      console.log(`📊 Fetching public ESPN ${position} rankings for ${format}`);
      const rankings = await this.getESPNFallbackRankings(position, format);
      
      // Cache the fallback results too
      this.cacheRankings(position, format, rankings);
      return rankings;
    } catch (error: any) {
      throw new Error(`All ranking sources failed. FantasyPros: ${this.isAuthenticated ? 'authenticated but failed' : 'not authenticated'}, ESPN: ${error.message}`);
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
    
    // Use enhanced extraction with multiple fallback strategies
    return await this.extractRankingsWithFallbacks(html, position, format);
  }

  /**
   * Get ESPN public rankings as fallback (no authentication required)
   */
  private async getESPNFallbackRankings(position: string, format: string): Promise<FantasyProsRankings> {
    try {
      // ESPN public consensus rankings endpoint
      const scoringMap = { 'STD': 0, 'HALF': 1, 'PPR': 2 };
      const scoringType = scoringMap[format as keyof typeof scoringMap] ?? 2;
      
      // ESPN position filter mapping
      const positionFilter = position === 'ALL' ? '' : `&pos=${this.mapPositionForESPN(position)}`;
      
      // Current season (2025) - using same pattern as main ESPN API
      const espnUrl = `https://fantasy.espn.com/apis/v3/games/ffl/seasons/2025/segments/0/leaguedefaults/3?view=kona_player_info&scoringPeriodId=0&filters=%7B%22players%22:%7B%22limit%22:300%7D%7D${positionFilter}`;
      
      console.log(`🔗 ESPN fallback URL: ${espnUrl}`);
      
      // Use axios directly (no throttling needed for ESPN public API)
      const response = await axios.get(espnUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });

      if (!response.data?.players) {
        throw new Error('No ESPN player data found in response');
      }

      // Convert ESPN data to FantasyProsRankings format
      const espnPlayers = response.data.players;
      console.log(`📊 Raw ESPN data contains ${espnPlayers.length} players`);
      
      const filteredPlayers = espnPlayers.filter((p: any) => p?.player?.stats?.[0]?.appliedTotal !== undefined);
      console.log(`🎯 Filtered to ${filteredPlayers.length} players with stats`);
      
      const players: FantasyProsPlayer[] = filteredPlayers
        .map((p: any, index: number) => {
          const player = p.player;
          const stats = player.stats?.[0] || {};
          const projectedPoints = stats.appliedTotal || 0;
          
          const extractedPlayer = {
            player: {
              name: player.fullName || 'Unknown Player',
              team: this.getESPNTeamAbbrev(player.proTeamId) || 'FA',
              position: this.getESPNPositionName(player.defaultPositionId) || 'UNKNOWN'
            },
            adp: index + 1, // Use rank as ADP approximation  
            expertConsensus: index + 1, // ESPN fallback: ensure never undefined
            tier: Math.ceil((index + 1) / 12), // 12-player tiers
            bestRank: index + 1,
            worstRank: index + 1, 
            avgRank: index + 1,
            stdDev: 0 // ESPN doesn't provide ranking variance
          };
          
          // Log first few players for debugging
          if (index < 3) {
            console.log(`✅ ESPN extracted player ${index + 1}:`, extractedPlayer);
            console.log(`   Raw ESPN data:`, {
              fullName: player.fullName,
              proTeamId: player.proTeamId,
              defaultPositionId: player.defaultPositionId,
              projectedPoints
            });
          }
          
          return extractedPlayer;
        })
        .slice(0, 200); // Limit to top 200 players

      console.log(`✅ ESPN fallback: Generated ${players.length} players for ${position} ${format}`);

      return {
        lastUpdated: new Date(),
        format,
        position,
        players
      };

    } catch (error: any) {
      throw new Error(`ESPN fallback failed: ${error.message}`);
    }
  }

  /**
   * Map fantasy position to ESPN position filter
   */
  private mapPositionForESPN(position: string): string {
    const positionMap: { [key: string]: string } = {
      'QB': '1',
      'RB': '2', 
      'WR': '3',
      'TE': '4',
      'K': '5',
      'DST': '16'
    };
    return positionMap[position] || '';
  }

  /**
   * Get ESPN team abbreviation from team ID
   */
  private getESPNTeamAbbrev(teamId: number): string {
    const teams: { [key: number]: string } = {
      1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET',
      9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN',
      17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC',
      25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WAS', 29: 'CAR', 30: 'JAX', 33: 'BAL', 34: 'HOU'
    };
    return teams[teamId] || 'FA';
  }

  /**
   * Get position name from ESPN position ID
   */
  private getESPNPositionName(positionId: number): string {
    const positions: { [key: number]: string } = {
      1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'DST'
    };
    return positions[positionId] || 'FLEX';
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