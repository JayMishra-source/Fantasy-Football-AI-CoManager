import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';

export interface FantasyProsPlayer {
  rank: number;
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
      
      // Check for specific MVP content indicators
      const $ = cheerio.load(testResponse.data);
      const hasRankings = $('#ranking-table').length > 0 || 
                         $('.rankings-table').length > 0 ||
                         $('.player-table').length > 0 ||
                         $('[data-player-id]').length > 0;
      
      // Also check for user indicators
      const hasUserInfo = $('.user-info').length > 0 || 
                         $('.username').length > 0 ||
                         $('[class*="user"]').length > 0;
      
      if (!hasRankings && testResponse.data.length < 1000) {
        throw new Error('Cannot access rankings - response too small or no rankings found');
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
    if (!this.isAuthenticated) {
      throw new Error('Must authenticate with FantasyPros first');
    }

    try {
      const url = `/nfl/rankings/${format.toLowerCase()}-cheatsheets.php`;
      const params: any = {};
      
      if (position !== 'ALL') {
        params.position = position;
      }

      const response = await this.client.get(url, { params });
      const html = response.data;
      
      // Try to extract JSON data from JavaScript variable
      const ecrDataMatch = html.match(/var\s+ecrData\s*=\s*({[^;]+});/);
      
      if (ecrDataMatch) {
        // Parse the JSON data
        const ecrData = JSON.parse(ecrDataMatch[1]);
        const playersData = ecrData.players || [];
        
        const players: FantasyProsPlayer[] = playersData
          .filter((p: any) => !position || position === 'ALL' || p.player_position_id === position)
          .map((p: any) => ({
            rank: p.rank_ecr,
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
        
        return {
          lastUpdated: new Date(),
          format,
          position,
          players
        };
      }
      
      // Fallback to HTML parsing if JSON not found
      const $ = cheerio.load(html);
      const players: FantasyProsPlayer[] = [];
      
      // Try various table selectors
      const tableSelectors = ['#ranking-table tbody tr', '.rankings-table tbody tr', 'table tbody tr'];
      
      for (const selector of tableSelectors) {
        if ($(selector).length > 0) {
          $(selector).each((index, element) => {
            const $row = $(element);
            const rank = parseInt($row.find('.rank, td:first').text()) || index + 1;
            
            // Extract player info - try various selectors
            const playerName = $row.find('.player-label a, .player-name, a[href*="/players/"]').first().text().trim();
            const teamPos = $row.find('.player-label small, .team-position').text().trim();
            
            if (playerName) {
              const [team, pos] = teamPos.split(/[\s-]+/);
              
              players.push({
                rank,
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

      return {
        lastUpdated: new Date(),
        format,
        position,
        players
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch FantasyPros rankings: ${error.message}`);
    }
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
      const response = await this.client.get(url);
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