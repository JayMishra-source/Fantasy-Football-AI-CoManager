import axios, { AxiosInstance } from 'axios';
import { ESPNCookies, LeagueInfo, TeamRoster, Player } from '../types/espn.js';

export class ESPNApiService {
  private axios: AxiosInstance;
  private baseURL = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl';
  private cookies: ESPNCookies | null = null;
  private year: number = 2025;

  // Get current NFL week for 2025 season
  private getCurrentWeek(): number {
    const now = new Date();
    const seasonStart = new Date('2025-09-04'); // NFL season typically starts first Thursday of September
    const timeDiff = now.getTime() - seasonStart.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    // If before season starts, return 1. Otherwise calculate week
    if (daysDiff <= 0) return 1;
    return Math.min(Math.ceil(daysDiff / 7), 18); // Cap at week 18
  }

  constructor() {
    this.axios = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
  }

  setCookies(cookies: ESPNCookies) {
    this.cookies = cookies;
    if (cookies.espn_s2 && cookies.swid) {
      this.axios.defaults.headers.common['Cookie'] = `espn_s2=${cookies.espn_s2}; SWID=${cookies.swid}`;
    } else {
      delete this.axios.defaults.headers.common['Cookie'];
    }
  }

  getCookies(): ESPNCookies | null {
    return this.cookies;
  }

  async getLeagueInfo(leagueId: string): Promise<LeagueInfo> {
    const fullUrl = `${this.baseURL}/seasons/${this.year}/segments/0/leagues/${leagueId}`;
    
    const headers: any = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    };
    
    if (this.cookies?.espn_s2 && this.cookies?.swid) {
      headers['Cookie'] = `espn_s2=${this.cookies.espn_s2}; SWID=${this.cookies.swid}`;
    }
    
    try {
      const response = await axios.get(fullUrl, { headers });
      
      if (typeof response.data === 'string' && response.data.trim().startsWith('<')) {
        throw new Error('ESPN API returned HTML instead of JSON - authentication required');
      }
      
      return {
        id: response.data.id,
        name: response.data.settings?.name || 'Unknown League',
        seasonId: response.data.seasonId,
        currentWeek: response.data.scoringPeriodId || 1,
        teams: response.data.teams || [],
        settings: response.data.settings
      };
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error(`ESPN Authentication Failed (401): ESPN cookies (ESPN_S2/SWID) are invalid or expired. Please refresh cookies from https://fantasy.espn.com/`);
      } else if (error.response?.status === 403) {
        throw new Error(`ESPN Access Forbidden (403): You don't have permission to access league ${leagueId}. Check if league is private and requires authentication.`);
      } else if (error.response?.status === 404) {
        throw new Error(`ESPN League Not Found (404): League ${leagueId} doesn't exist or is not accessible.`);
      } else if (error.response) {
        throw new Error(`ESPN API Error (${error.response.status}): ${error.response.statusText || 'Unknown error'} - URL: ${fullUrl}`);
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error(`ESPN Network Error: Cannot connect to ESPN servers. Check internet connection.`);
      } else {
        throw new Error(`ESPN API Request Failed: ${error.message} - League: ${leagueId}`);
      }
    }
  }

  async getTeamRoster(leagueId: string, teamId: string): Promise<TeamRoster> {
    try {
      const currentWeek = this.getCurrentWeek();
      
      const response = await this.axios.get(
        `/seasons/${this.year}/segments/0/leagues/${leagueId}`,
        { 
          params: { 
            view: 'mRoster,mMatchup,mSettings',
            scoringPeriodId: currentWeek
          } 
        }
      );
      
      const team = response.data.teams?.find((t: any) => t.id === parseInt(teamId));
      if (!team) {
        throw new Error(`Team ${teamId} not found in league ${leagueId}. Available teams: ${response.data.teams?.map((t: any) => t.id).join(', ') || 'none'}`);
      }
      
      const roster = team.roster?.entries || [];
      
      const processPlayer = (entry: any): Player => {
        const playerData = entry.playerPoolEntry?.player || {};
        const stats = playerData.stats || [];
        
        // ESPN stats structure:
        // stats[0] = actual stats for current period
        // stats[1] = projected stats for current period (weekly projections)
        // Different periods may have season totals vs weekly projections
        
        let weeklyProjection = 0;
        let seasonTotal = 0;
        let actualPoints = 0;
        
        // Look for current week projections first
        for (const stat of stats) {
          if (stat.scoringPeriodId === currentWeek && stat.statSourceId === 1) {
            // statSourceId 1 is usually projections
            weeklyProjection = stat.appliedTotal || 0;
          } else if (stat.scoringPeriodId === currentWeek && stat.statSourceId === 0) {
            // statSourceId 0 is usually actual stats
            actualPoints = stat.appliedTotal || 0;
          } else if (stat.seasonId === this.year && stat.statSourceId === 1 && !stat.scoringPeriodId) {
            // Season-long projections
            seasonTotal = stat.appliedTotal || 0;
          }
        }
        
        // Fallback to basic array indexing if structured lookup fails
        if (weeklyProjection === 0 && stats.length > 1) {
          weeklyProjection = stats[1].appliedTotal || 0;
        }
        if (actualPoints === 0 && stats.length > 0) {
          actualPoints = stats[0].appliedTotal || 0;
        }
        
        return {
          id: playerData.id?.toString() || '',
          firstName: playerData.firstName || '',
          lastName: playerData.lastName || '',
          fullName: playerData.fullName || 'Unknown Player',
          position: this.getPositionName(playerData.defaultPositionId || 0),
          team: playerData.proTeamId ? this.getTeamAbbreviation(playerData.proTeamId) : 'FA',
          points: actualPoints,
          projectedPoints: weeklyProjection > 0 ? weeklyProjection : (seasonTotal > 0 ? seasonTotal / 17 : 0), // Use weekly if available, otherwise estimate from season
          seasonProjectedPoints: seasonTotal, // Add season total as separate field
          injuryStatus: playerData.injuryStatus || undefined,
          percentStarted: playerData.ownership?.percentStarted || 0,
          percentOwned: playerData.ownership?.percentOwned || 0
        };
      };

      return {
        teamId: parseInt(teamId),
        teamName: team.name || `Team ${teamId}`,
        starters: roster.filter((entry: any) => entry.lineupSlotId !== 20 && entry.lineupSlotId !== 23).map(processPlayer),
        bench: roster.filter((entry: any) => entry.lineupSlotId === 20).map(processPlayer),
        injuredReserve: roster.filter((entry: any) => entry.lineupSlotId === 23).map(processPlayer)
      };
    } catch (error: any) {
      if (error.message.includes('Team') && error.message.includes('not found')) {
        throw error; // Re-throw team not found error as-is
      } else if (error.response?.status === 401) {
        throw new Error(`ESPN Authentication Failed (401): Cannot access roster for team ${teamId} in league ${leagueId}. ESPN cookies (ESPN_S2/SWID) are invalid or expired.`);
      } else if (error.response?.status === 403) {
        throw new Error(`ESPN Access Forbidden (403): No permission to view roster for team ${teamId} in league ${leagueId}.`);
      } else if (error.response?.status === 404) {
        throw new Error(`ESPN Resource Not Found (404): League ${leagueId} or team ${teamId} doesn't exist.`);
      } else if (error.response) {
        throw new Error(`ESPN Roster API Error (${error.response.status}): ${error.response.statusText || 'Unknown error'} - League: ${leagueId}, Team: ${teamId}`);
      } else {
        throw new Error(`ESPN Roster Request Failed: ${error.message} - League: ${leagueId}, Team: ${teamId}`);
      }
    }
  }

  async getPlayers(leagueId: string): Promise<Player[]> {
    const response = await this.axios.get(
      `/seasons/${this.year}/segments/0/leagues/${leagueId}`,
      { 
        params: { 
          view: 'kona_player_info'
          // Remove scoringPeriodId: 0 to get current season data
        } 
      }
    );
    
    const players = response.data.players || [];
    return players.map((p: any) => this.processPlayerData(p));
  }

  async getAvailablePlayers(leagueId: string): Promise<Player[]> {
    try {
      const response = await this.axios.get(
        `/seasons/${this.year}/segments/0/leagues/${leagueId}`,
        { 
          params: { 
            view: 'kona_player_info'
          },
          headers: {
            'X-Fantasy-Filter': JSON.stringify({
              players: {
                filterStatus: {
                  value: ['FREEAGENT', 'WAIVERS']
                }
              }
            })
          }
        }
      );
      
      const players = response.data.players || [];
      return players
        .map((p: any) => this.processPlayerData(p))
        .filter((p: Player) => (p.percentOwned || 0) < 50); // Focus on widely available players
    } catch (error: any) {
      if (error.response?.status === 400) {
        // Try alternative approach without the filter for troubleshooting
        console.warn('⚠️ Fantasy filter failed, trying without filter...');
        try {
          const response = await this.axios.get(
            `/seasons/${this.year}/segments/0/leagues/${leagueId}`,
            { 
              params: { 
                view: 'kona_player_info'
              }
            }
          );
          
          const players = response.data.players || [];
          return players
            .map((p: any) => this.processPlayerData(p))
            .filter((p: Player) => (p.percentOwned || 0) < 95) // Only exclude universally owned players
            .slice(0, 200); // Limit to reasonable number of players
        } catch (fallbackError: any) {
          throw new Error(`ESPN Available Players API failed: ${error.message} (Status: ${error.response?.status})`);
        }
      } else if (error.response?.status === 401) {
        throw new Error(`ESPN Authentication Failed (401): Cannot access available players for league ${leagueId}. ESPN cookies (ESPN_S2/SWID) are invalid or expired.`);
      } else if (error.response?.status === 403) {
        throw new Error(`ESPN Access Forbidden (403): No permission to view available players for league ${leagueId}.`);
      } else if (error.response?.status === 404) {
        throw new Error(`ESPN League Not Found (404): League ${leagueId} doesn't exist or is not accessible.`);
      } else if (error.response) {
        throw new Error(`ESPN Available Players API Error (${error.response.status}): ${error.response.statusText || 'Unknown error'} - League: ${leagueId}`);
      } else {
        throw new Error(`ESPN Available Players Request Failed: ${error.message} - League: ${leagueId}`);
      }
    }
  }

  async getMatchups(leagueId: string, week: number) {
    const response = await this.axios.get(
      `/seasons/${this.year}/segments/0/leagues/${leagueId}`,
      { 
        params: { 
          view: 'mMatchup',
          scoringPeriodId: week
        } 
      }
    );
    return response.data.schedule || [];
  }

  async getTransactions(leagueId: string) {
    const response = await this.axios.get(
      `/seasons/${this.year}/segments/0/leagues/${leagueId}/transactions`
    );
    return response.data.transactions || [];
  }

  private processPlayerData(playerData: any): Player {
    const player = playerData.player || playerData;
    return {
      id: player.id?.toString() || '',
      firstName: player.firstName || '',
      lastName: player.lastName || '',
      fullName: player.fullName || '',
      position: player.defaultPositionId ? this.getPositionName(player.defaultPositionId) : 'Unknown',
      team: player.proTeamId ? this.getTeamAbbreviation(player.proTeamId) : 'FA',
      points: player.stats?.[0]?.appliedTotal || 0,
      projectedPoints: player.stats?.[1]?.appliedTotal || 0,
      injuryStatus: player.injuryStatus || undefined,
      percentStarted: player.ownership?.percentStarted || 0,
      percentOwned: player.ownership?.percentOwned || 0
    };
  }

  private getPositionName(positionId: number): string {
    const positions: { [key: number]: string } = {
      1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'DST'
    };
    return positions[positionId] || 'Unknown';
  }

  private getTeamAbbreviation(teamId: number): string {
    const teams: { [key: number]: string } = {
      1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL',
      7: 'DEN', 8: 'DET', 9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC',
      13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN', 17: 'NE', 18: 'NO',
      19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC',
      25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WSH', 29: 'CAR', 30: 'JAX',
      33: 'BAL', 34: 'HOU'
    };
    return teams[teamId] || 'FA';
  }
}

export const espnApi = new ESPNApiService();