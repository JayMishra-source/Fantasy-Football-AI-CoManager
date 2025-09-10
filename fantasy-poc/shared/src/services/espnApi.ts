import axios, { AxiosInstance } from 'axios';
import { ESPNCookies, LeagueInfo, TeamRoster, Player } from '../types/espn.js';
import { 
  isStartingPosition, 
  isBenchPosition, 
  isIRPosition, 
  getPositionName,
  LINEUP_SLOT_NAMES,
  detectLeagueSettings 
} from '../constants/espnSlots.js';

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
        
        // Debug: Log all available stats to understand ESPN's data structure
        if (process.env.DEBUG_ESPN && playerData.fullName) {
          console.log(`\n🔍 DEBUG ${playerData.fullName} - All stats:`, JSON.stringify(stats, null, 2));
        }
        
        // Look for weekly projections first (statSourceId 1 with current week)
        const weeklyProjectionStat = stats.find((stat: any) => 
          stat.statSourceId === 1 && 
          stat.scoringPeriodId === currentWeek
        );
        
        if (weeklyProjectionStat) {
          weeklyProjection = weeklyProjectionStat.appliedTotal || 0;
          if (process.env.DEBUG_ESPN && playerData.fullName) {
            console.log(`✅ Found weekly projection for week ${currentWeek}:`, weeklyProjection);
          }
        } else {
          if (process.env.DEBUG_ESPN && playerData.fullName) {
            console.log(`❌ No weekly projection found for week ${currentWeek} with statSourceId=1`);
          }
          
          // Try different approaches to find weekly data
          // 1. Look for projection stat with current week (but NOT actual points - statSourceId 0)
          const currentWeekProjectionStat = stats.find((stat: any) => 
            stat.scoringPeriodId === currentWeek && 
            stat.statSourceId === 1 && 
            stat.appliedTotal > 0 && 
            stat.appliedTotal < 100
          );
          if (currentWeekProjectionStat) {
            weeklyProjection = currentWeekProjectionStat.appliedTotal;
            if (process.env.DEBUG_ESPN && playerData.fullName) {
              console.log(`📊 Using current week projection stat:`, weeklyProjection);
            }
          } else {
            // 2. Fallback: Find the smallest reasonable projection (likely weekly)
            const projectionStats = stats.filter((stat: any) => 
              stat.statSourceId === 1 && stat.appliedTotal > 0
            ).sort((a: any, b: any) => a.appliedTotal - b.appliedTotal);
            
            if (projectionStats.length > 0) {
              const smallestProjection = projectionStats[0].appliedTotal;
              if (smallestProjection < 50) {
                // This looks like a reasonable weekly projection
                weeklyProjection = smallestProjection;
                if (process.env.DEBUG_ESPN && playerData.fullName) {
                  console.log(`🎯 Using smallest projection as weekly:`, weeklyProjection);
                }
              } else {
                // All projections are large, they're likely season totals
                // Use the largest one as season total and estimate weekly
                const largestProjection = projectionStats[projectionStats.length - 1].appliedTotal;
                weeklyProjection = largestProjection / 17;
                if (process.env.DEBUG_ESPN && playerData.fullName) {
                  console.log(`📉 No weekly projection found, estimated from largest season total (${largestProjection}):`, weeklyProjection.toFixed(1));
                }
              }
            } else {
              // No projection stats at all, use a conservative default
              weeklyProjection = 0;
              if (process.env.DEBUG_ESPN && playerData.fullName) {
                console.log(`❌ No projection stats found, using 0`);
              }
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
        
        // IMPROVED: More intelligent weekly vs season projection detection
        // Only convert if projection is clearly a season total (much higher thresholds)
        const playerPosition = this.getPositionName(playerData.defaultPositionId || 0);
        
        // Set realistic but generous weekly maximums - allow for breakout performances
        const reasonableWeeklyMax = {
          'QB': 50,    // Elite QBs can score 40+ in good matchups
          'RB': 40,    // Top RBs can have 35+ point games
          'WR': 40,    // Elite WRs can have explosive games
          'TE': 30,    // Top TEs can have big games
          'D/ST': 35,  // Defenses can have huge games
          'K': 25      // Kickers rarely exceed 20
        }[playerPosition] || 35; // Default for unknown positions
        
        // Additional check: if we have a season total and weekly projection, 
        // use that to determine if the weekly projection seems reasonable
        let projectionSeemsSeasonal = false;
        
        if (seasonTotal > 0 && weeklyProjection > 0) {
          // If weekly projection is more than 30% of season total, it's likely seasonal
          const weeklyPercentOfSeason = (weeklyProjection / seasonTotal) * 100;
          if (weeklyPercentOfSeason > 30) {
            projectionSeemsSeasonal = true;
            console.warn(`⚠️ PROJECTION ANALYSIS: ${playerData.fullName} weekly projection (${weeklyProjection}) is ${weeklyPercentOfSeason.toFixed(1)}% of season total (${seasonTotal})`);
          }
        }
        
        // Only convert if BOTH conditions are met: exceeds threshold AND seems seasonal
        if (weeklyProjection > reasonableWeeklyMax && 
            (projectionSeemsSeasonal || weeklyProjection > 100)) { // 100+ is almost certainly seasonal
          console.warn(`⚠️ PROJECTION TRANSFORM: ${playerData.fullName} (${playerPosition})`);
          console.warn(`   Original weekly projection: ${weeklyProjection}`);
          console.warn(`   Threshold for ${playerPosition}: ${reasonableWeeklyMax}`);
          console.warn(`   Season analysis: ${projectionSeemsSeasonal ? 'Seems seasonal' : 'Extremely high (>100)'}`);
          console.warn(`   Converting to weekly estimate`);
          
          // Store as season total and estimate weekly
          if (seasonTotal === 0) {
            seasonTotal = weeklyProjection;
          }
          weeklyProjection = weeklyProjection / 17; // Estimate weekly from season total
          
          console.warn(`   New weekly estimate: ${weeklyProjection.toFixed(1)}`);
          console.warn(`   Season total stored: ${seasonTotal}`);
        } else if (weeklyProjection > reasonableWeeklyMax) {
          // Log high but plausible projections without converting
          console.log(`ℹ️ HIGH PROJECTION KEPT: ${playerData.fullName} (${playerPosition}) - ${weeklyProjection} pts (above ${reasonableWeeklyMax} threshold but seems legitimate)`);
        }
        
        // Final safety check: Only cap extremely unrealistic projections (200+)
        if (weeklyProjection > 200) {
          console.warn(`⚠️ EXTREME PROJECTION CAP: ${playerData.fullName} has unrealistic projection (${weeklyProjection}), capping at 200`);
          weeklyProjection = 200;
        }
        
        if (process.env.DEBUG_ESPN && playerData.fullName) {
          console.log(`Final values - Weekly: ${weeklyProjection}, Season: ${seasonTotal}, Actual: ${actualPoints}`);
          console.log('=== END DEBUG ===\n');
        }
        
        const finalProjectedPoints = weeklyProjection > 0 ? weeklyProjection : (seasonTotal > 0 ? seasonTotal / 17 : 0);
        
        // Log final player data creation for validation
        if (finalProjectedPoints !== weeklyProjection || seasonTotal > 0) {
          console.log(`📊 FINAL PLAYER DATA: ${playerData.fullName || 'Unknown'}`);
          console.log(`   Position: ${this.getPositionName(playerData.defaultPositionId || 0)}`);
          console.log(`   Final projected points (weekly): ${finalProjectedPoints.toFixed(1)}`);
          console.log(`   Season projected points: ${seasonTotal || 'Not set'}`);
          console.log(`   Actual points: ${actualPoints}`);
          console.log(`   Data source: ${weeklyProjection > 0 ? 'Weekly projection' : 'Estimated from season'}`);
        }

        return {
          id: playerData.id?.toString() || '',
          firstName: playerData.firstName || '',
          lastName: playerData.lastName || '',
          fullName: playerData.fullName || 'Unknown Player',
          position: this.getPositionName(playerData.defaultPositionId || 0),
          team: playerData.proTeamId ? this.getTeamAbbreviation(playerData.proTeamId) : 'FA',
          points: actualPoints,
          projectedPoints: finalProjectedPoints, // Use weekly if available, otherwise estimate from season
          seasonProjectedPoints: seasonTotal, // Add season total as separate field
          injuryStatus: playerData.injuryStatus || undefined,
          percentStarted: playerData.ownership?.percentStarted || 0,
          percentOwned: playerData.ownership?.percentOwned || 0
        };
      };

      // Process all players first to get injury status information
      const processedRoster = roster.map(processPlayer);
      
      // Detect league configuration for better categorization
      const usedSlotIds = roster.map((entry: any) => entry.lineupSlotId);
      const leagueSettings = detectLeagueSettings(usedSlotIds);
      
      console.log(`📊 League configuration detected:`, {
        hasIDP: leagueSettings.hasIDP,
        hasSuperflex: leagueSettings.hasSuperflex,
        hasTeamQB: leagueSettings.hasTeamQB,
        uniqueSlots: [...new Set(usedSlotIds)].sort() as number[]
      });

      // Enhanced roster categorization with proper slot validation
      const starters: Player[] = [];
      const bench: Player[] = [];
      const injuredReserve: Player[] = [];
      const unknownSlots: Player[] = [];

      processedRoster.forEach((player: Player, index: number) => {
        const entry = roster[index];
        const slotId = entry.lineupSlotId;
        const slotName = getPositionName(slotId);
        
        // Handle IR validation (existing robust logic)
        if (isIRPosition(slotId)) {
          const hasRealInjury = player.injuryStatus && 
            !['ACTIVE', 'PROBABLE'].includes(player.injuryStatus.toString().toUpperCase());
          
          if (hasRealInjury) {
            console.log(`✅ IR: ${player.fullName} properly in IR slot with injury status: ${player.injuryStatus}`);
            injuredReserve.push(player);
          } else {
            console.warn(`⚠️ IR FIX: ${player.fullName} in IR slot but injury status '${player.injuryStatus}' - moving to bench`);
            bench.push(player);
          }
          return;
        }
        
        // Handle bench players
        if (isBenchPosition(slotId)) {
          console.log(`🪑 BENCH: ${player.fullName} in bench slot`);
          bench.push(player);
          return;
        }
        
        // Handle known starting positions
        if (isStartingPosition(slotId)) {
          console.log(`🏁 STARTER: ${player.fullName} in starting ${slotName} slot (${slotId})`);
          starters.push(player);
          return;
        }
        
        // Handle unknown/unsupported slot IDs
        console.warn(`❓ UNKNOWN SLOT: ${player.fullName} in unrecognized slot ID ${slotId} - adding to bench for safety`);
        unknownSlots.push(player);
        bench.push(player); // Default unknown slots to bench for safety
      });

      // Log final categorization summary
      console.log(`📋 ROSTER SUMMARY for team ${teamId}:`);
      console.log(`   Starters: ${starters.length} players`);
      console.log(`   Bench: ${bench.length} players (${unknownSlots.length} from unknown slots)`);
      console.log(`   IR: ${injuredReserve.length} players`);
      
      if (unknownSlots.length > 0) {
        console.warn(`⚠️ WARNING: ${unknownSlots.length} players had unknown slot IDs and were moved to bench:`);
        unknownSlots.forEach(player => {
          const entry = roster[processedRoster.indexOf(player)];
          console.warn(`   - ${player.fullName}: slot ID ${entry.lineupSlotId}`);
        });
      }

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
        // If this looks like a season total (>100), estimate weekly
        if (weeklyProjection > 100) {
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
    // ESPN Player Position IDs (different from lineup slot IDs)
    const playerPositions: { [key: number]: string } = {
      0: 'QB',   // Quarterback
      1: 'QB',   // Quarterback (alternative mapping)
      2: 'RB',   // Running Back
      3: 'WR',   // Wide Receiver  
      4: 'TE',   // Tight End
      5: 'K',    // Kicker
      16: 'D/ST', // Defense/Special Teams
      
      // IDP positions
      6: 'DT',   // Defensive Tackle
      7: 'DE',   // Defensive End
      8: 'LB',   // Linebacker  
      9: 'DL',   // Defensive Line
      10: 'CB',  // Cornerback
      11: 'S',   // Safety
      12: 'DB',  // Defensive Back
      13: 'DP',  // Defensive Player
      
      // Special positions
      14: 'P',   // Punter
      15: 'HC'   // Head Coach
    };
    return playerPositions[positionId] || `UNKNOWN_POS_${positionId}`;
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