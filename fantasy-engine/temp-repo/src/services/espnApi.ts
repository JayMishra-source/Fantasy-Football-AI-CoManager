import axios, { AxiosInstance } from 'axios';
import { ESPNCookies, LeagueInfo, TeamRoster, Player } from '../types/espn.js';

export class ESPNApiService {
  private axios: AxiosInstance;
  private baseURL = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl';
  private cookies: ESPNCookies | null = null;
  private year: number = 2024;

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
    const url = `/seasons/${this.year}/segments/0/leagues/${leagueId}`;
    
    // Use the configured axios instance which already has cookies set
    const response = await this.axios.get(url);
    
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
  }

  async getTeamRoster(leagueId: string, teamId: string): Promise<TeamRoster> {
    const response = await this.axios.get(
      `/seasons/${this.year}/segments/0/leagues/${leagueId}`,
      { 
        params: { 
          view: 'mRoster'
          // Remove scoringPeriodId: 0 to get current season data
        } 
      }
    );
    
    const team = response.data.teams?.find((t: any) => t.id === parseInt(teamId));
    if (!team) {
      throw new Error(`Team ${teamId} not found in league ${leagueId}`);
    }

    const roster = team.roster?.entries || [];
    
    const processPlayer = (entry: any): Player => {
      const playerData = entry.playerPoolEntry?.player || {};
      return {
        id: playerData.id?.toString() || '',
        firstName: playerData.firstName || '',
        lastName: playerData.lastName || '',
        fullName: playerData.fullName || '',
        position: playerData.defaultPositionId ? this.getPositionName(playerData.defaultPositionId) : 'Unknown',
        team: playerData.proTeamId ? this.getTeamAbbreviation(playerData.proTeamId) : 'FA',
        points: entry.playerPoolEntry?.appliedStatTotal || 0,
        projectedPoints: playerData.stats?.[0]?.appliedTotal || 0,
        injuryStatus: playerData.injuryStatus || undefined,
        percentStarted: playerData.ownership?.percentStarted || 0,
        percentOwned: playerData.ownership?.percentOwned || 0
      };
    };

    const starters = roster
      .filter((entry: any) => entry.lineupSlotId !== 20) // 20 is bench slot
      .map(processPlayer);
    
    const bench = roster
      .filter((entry: any) => entry.lineupSlotId === 20)
      .map(processPlayer);

    // Handle various ESPN team name formats
    let teamName = team.name || '';
    if (!teamName && team.location && team.nickname) {
      teamName = `${team.location} ${team.nickname}`;
    } else if (!teamName) {
      teamName = `Team ${team.id}`;
    }
    
    return {
      teamId: team.id,
      teamName: teamName,
      starters,
      bench,
      injuredReserve: []
    };
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
    const response = await this.axios.get(
      `/seasons/${this.year}/segments/0/leagues/${leagueId}`,
      { 
        params: { 
          view: 'kona_player_info',
          'x-fantasy-filter': JSON.stringify({
            players: {
              filterStatus: {
                value: ['FREEAGENT', 'WAIVERS']
              }
            }
          })
          // Remove scoringPeriodId: 0 to get current season data
        } 
      }
    );
    
    const players = response.data.players || [];
    return players
      .map((p: any) => this.processPlayerData(p))
      .filter((p: Player) => (p.percentOwned || 0) < 50); // Focus on widely available players
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