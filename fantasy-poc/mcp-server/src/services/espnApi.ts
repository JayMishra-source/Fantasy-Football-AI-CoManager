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
      
      // Try to get both current week and projected stats
      const response = await this.axios.get(
        `/seasons/${this.year}/segments/0/leagues/${leagueId}`,
        { 
          params: { 
            view: 'mRoster',
            scoringPeriodId: currentWeek // Request specific week data
          } 
        }
      );
      
      console.log(`🔍 ESPN API Request - League: ${leagueId}, Current Week: ${currentWeek}, Year: ${this.year}`);
      
      const team = response.data.teams?.find((t: any) => t.id === parseInt(teamId));
      if (!team) {
        throw new Error(`Team ${teamId} not found in league ${leagueId}. Available teams: ${response.data.teams?.map((t: any) => t.id).join(', ') || 'none'}`);
      }
      
      const roster = team.roster?.entries || [];
      
      const processPlayer = (entry: any): Player => {
        const playerData = entry.playerPoolEntry?.player || {};
        const stats = playerData.stats || [];
        
        // Optional debug logging (enable by setting DEBUG_ESPN environment variable)
        if (process.env.DEBUG_ESPN && playerData.fullName) {
          console.log(`\n=== DEBUG: ${playerData.fullName} (${this.getPositionName(playerData.defaultPositionId || 0)}) ===`);
          console.log('Raw stats array length:', stats.length);
          stats.forEach((stat: any, index: number) => {
            console.log(`Stats[${index}]:`, {
              seasonId: stat.seasonId,
              scoringPeriodId: stat.scoringPeriodId,
              statSourceId: stat.statSourceId,
              statSplitTypeId: stat.statSplitTypeId,
              appliedTotal: stat.appliedTotal,
              appliedAverage: stat.appliedAverage
            });
          });
        }
        
        // ESPN stats structure analysis:
        // We need to find the correct weekly projection stat
        // Different statSourceId values mean different things:
        // - statSourceId 0 = actual stats
        // - statSourceId 1 = projected stats
        // Different scoringPeriodId values:
        // - specific week number = that week's data
        // - 0 or null = season total
        
        let weeklyProjection = 0;
        let seasonTotal = 0;
        let actualPoints = 0;
        
        // Find current week for better projection targeting
        const currentWeek = this.getCurrentWeek();
        
        // Look for weekly projections first (statSourceId 1 with current week)
        const weeklyProjectionStat = stats.find((stat: any) => 
          stat.statSourceId === 1 && 
          stat.scoringPeriodId === currentWeek
        );
        
        if (weeklyProjectionStat) {
          weeklyProjection = weeklyProjectionStat.appliedTotal || 0;
          if (process.env.DEBUG_ESPN && playerData.fullName) {
            console.log(`Found weekly projection for week ${currentWeek}:`, weeklyProjection);
          }
        } else {
          // Fallback: Look for any projection stat
          const anyProjectionStat = stats.find((stat: any) => stat.statSourceId === 1);
          if (anyProjectionStat) {
            weeklyProjection = anyProjectionStat.appliedTotal || 0;
            if (process.env.DEBUG_ESPN && playerData.fullName) {
              console.log(`Using fallback projection (scoringPeriodId: ${anyProjectionStat.scoringPeriodId}):`, weeklyProjection);
            }
          }
        }
        
        // Find actual points for current week
        const actualStat = stats.find((stat: any) => 
          stat.statSourceId === 0 && 
          stat.scoringPeriodId === currentWeek
        );
        
        if (actualStat) {
          actualPoints = actualStat.appliedTotal || 0;
        }
        
        // Find season total projections (statSourceId 1, no specific scoring period)
        const seasonProjectionStat = stats.find((stat: any) => 
          stat.statSourceId === 1 && 
          (!stat.scoringPeriodId || stat.scoringPeriodId === 0)
        );
        
        if (seasonProjectionStat) {
          seasonTotal = seasonProjectionStat.appliedTotal || 0;
          if (process.env.DEBUG_ESPN && playerData.fullName) {
            console.log(`Season total projection:`, seasonTotal);
          }
        }
        
        // Validate weekly projection makes sense (should be 0-50 for most players)
        // Be more aggressive - anything over 30 is likely a season total for most positions
        // QBs can project 25-35, WRs/RBs typically 10-25, TEs 8-20
        const playerPosition = this.getPositionName(playerData.defaultPositionId || 0);
        const reasonableWeeklyMax = playerPosition === 'QB' ? 35 : 25;
        
        if (weeklyProjection > reasonableWeeklyMax) {
          console.warn(`⚠️ ${playerData.fullName}: Weekly projection too high (${weeklyProjection}), treating as season total`);
          
          // Store as season total and estimate weekly
          if (seasonTotal === 0) {
            seasonTotal = weeklyProjection;
          }
          weeklyProjection = weeklyProjection / 17; // Estimate weekly from season total
          
          if (process.env.DEBUG_ESPN && playerData.fullName) {
            console.log(`🔄 Converted season total to weekly estimate: ${weeklyProjection.toFixed(1)}`);
          }
        }
        
        // Additional validation: Cap weekly projections at reasonable levels
        if (weeklyProjection > reasonableWeeklyMax) {
          console.warn(`⚠️ ${playerData.fullName}: Still too high (${weeklyProjection}), capping at ${reasonableWeeklyMax}`);
          weeklyProjection = Math.min(weeklyProjection, reasonableWeeklyMax);
        }
        
        if (process.env.DEBUG_ESPN && playerData.fullName) {
          console.log(`Final values - Weekly: ${weeklyProjection}, Season: ${seasonTotal}, Actual: ${actualPoints}`);
          console.log('=== END DEBUG ===\n');
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
          injuryStatus: playerData.injuryStatus || undefined,
          percentStarted: playerData.ownership?.percentStarted || 0,
          percentOwned: playerData.ownership?.percentOwned || 0
        };
      };

      // Process all players first to get injury status information
      const processedRoster = roster.map(processPlayer);
      
      // Filter into categories with proper injury status validation
      const starters = processedRoster.filter((player: Player, index: number) => {
        const entry = roster[index];
        return entry.lineupSlotId !== 20 && entry.lineupSlotId !== 21;
      });
      
      const bench = processedRoster.filter((player: Player, index: number) => {
        const entry = roster[index];
        return entry.lineupSlotId === 20;
      });
      
      // IR: Only include players who are ACTUALLY injured (not just in IR slot)
      const injuredReserve = processedRoster.filter((player: Player, index: number) => {
        const entry = roster[index];
        const isInIRSlot = entry.lineupSlotId === 21;
        const hasInjuryStatus = player.injuryStatus && 
          !['ACTIVE', 'PROBABLE'].includes(player.injuryStatus.toString().toUpperCase());
        
        // Player must be BOTH in IR slot AND have actual injury status
        if (isInIRSlot && !hasInjuryStatus) {
          console.warn(`⚠️ ${player.fullName} is in IR slot but has injury status '${player.injuryStatus}' - should not be in IR section`);
          return false; // Don't include in IR
        }
        
        return isInIRSlot && hasInjuryStatus;
      });
      
      // Move players incorrectly placed in IR slot to bench if they're healthy
      const incorrectlyPlacedPlayers = processedRoster.filter((player: Player, index: number) => {
        const entry = roster[index];
        const isInIRSlot = entry.lineupSlotId === 21;
        const hasInjuryStatus = player.injuryStatus && 
          !['ACTIVE', 'PROBABLE'].includes(player.injuryStatus.toString().toUpperCase());
        
        return isInIRSlot && !hasInjuryStatus;
      });
      
      // Add incorrectly placed healthy players to bench
      bench.push(...incorrectlyPlacedPlayers);

      return {
        teamId: parseInt(teamId),
        teamName: team.name || `Team ${teamId}`,
        starters,
        bench,
        injuredReserve
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
    const currentWeek = this.getCurrentWeek();
    const response = await this.axios.get(
      `/seasons/${this.year}/segments/0/leagues/${leagueId}`,
      { 
        params: { 
          view: 'kona_player_info',
          scoringPeriodId: currentWeek // Request current week data
        } 
      }
    );
    
    const players = response.data.players || [];
    return players.map((p: any) => this.processPlayerData(p));
  }

  async getAvailablePlayers(leagueId: string): Promise<Player[]> {
    try {
      const currentWeek = this.getCurrentWeek();
      const response = await this.axios.get(
        `/seasons/${this.year}/segments/0/leagues/${leagueId}`,
        { 
          params: { 
            view: 'kona_player_info',
            scoringPeriodId: currentWeek // Request current week data
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
          const currentWeek = this.getCurrentWeek();
          const response = await this.axios.get(
            `/seasons/${this.year}/segments/0/leagues/${leagueId}`,
            { 
              params: { 
                view: 'kona_player_info',
                scoringPeriodId: currentWeek // Request current week data
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
    const stats = player.stats || [];
    
    // Use same logic as roster processing for consistency
    const currentWeek = this.getCurrentWeek();
    let weeklyProjection = 0;
    let actualPoints = 0;
    
    // Look for weekly projections first
    const weeklyProjectionStat = stats.find((stat: any) => 
      stat.statSourceId === 1 && 
      stat.scoringPeriodId === currentWeek
    );
    
    if (weeklyProjectionStat) {
      weeklyProjection = weeklyProjectionStat.appliedTotal || 0;
    } else {
      // Fallback to any projection stat
      const anyProjectionStat = stats.find((stat: any) => stat.statSourceId === 1);
      if (anyProjectionStat) {
        weeklyProjection = anyProjectionStat.appliedTotal || 0;
        
        // Apply same validation logic as main roster processing
        const playerPosition = player.defaultPositionId ? this.getPositionName(player.defaultPositionId) : 'Unknown';
        const reasonableWeeklyMax = playerPosition === 'QB' ? 35 : 25;
        
        // If this looks like a season total, estimate weekly
        if (weeklyProjection > reasonableWeeklyMax) {
          weeklyProjection = weeklyProjection / 17;
        }
      }
    }
    
    // Find actual points
    const actualStat = stats.find((stat: any) => 
      stat.statSourceId === 0 && 
      stat.scoringPeriodId === currentWeek
    );
    
    if (actualStat) {
      actualPoints = actualStat.appliedTotal || 0;
    }
    
    return {
      id: player.id?.toString() || '',
      firstName: player.firstName || '',
      lastName: player.lastName || '',
      fullName: player.fullName || '',
      position: player.defaultPositionId ? this.getPositionName(player.defaultPositionId) : 'Unknown',
      team: player.proTeamId ? this.getTeamAbbreviation(player.proTeamId) : 'FA',
      points: actualPoints,
      projectedPoints: weeklyProjection,
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