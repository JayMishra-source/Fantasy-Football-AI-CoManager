import { espnApi } from './espnApi.js';
import { DraftInfo, DraftPick } from '../types/draft.js';
import axios from 'axios';

export class DraftApiService {
  private baseUrl = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl';
  private year = 2024;

  private getHeaders() {
    const cookies = espnApi.getCookies();
    if (!cookies?.espn_s2 || !cookies?.swid) {
      throw new Error('ESPN authentication required for draft access');
    }
    
    return {
      'Cookie': `espn_s2=${cookies.espn_s2}; SWID=${cookies.swid}`,
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    };
  }

  async getDraftInfo(leagueId: string): Promise<DraftInfo> {
    const url = `${this.baseUrl}/seasons/${this.year}/segments/0/leagues/${leagueId}?view=mDraftDetail&view=mTeam&view=mSettings`;
    
    const response = await axios.get(url, { headers: this.getHeaders() });
    const data = response.data;
    
    // Extract draft settings
    const draftSettings = data.settings?.draftSettings || {};
    const draftDetail = data.draftDetail || {};
    const teams = data.teams || [];
    
    // Process draft picks
    const picks: DraftPick[] = (draftDetail.picks || []).map((pick: any, index: number) => {
      const team = teams.find((t: any) => t.id === pick.teamId);
      const player = pick.playerPoolEntry?.player;
      
      return {
        id: pick.id || index,
        playerId: player?.id?.toString() || '',
        playerName: player?.fullName || 'Unknown Player',
        position: this.getPositionName(player?.defaultPositionId),
        team: this.getTeamAbbreviation(player?.proTeamId),
        teamId: pick.teamId,
        teamName: team?.name || team?.location + ' ' + team?.nickname || `Team ${pick.teamId}`,
        round: Math.floor(index / teams.length) + 1,
        pickNumber: index + 1,
        keeper: pick.keeper || false,
        auctionValue: pick.auctionValue
      };
    });

    return {
      leagueId,
      isCompleted: draftDetail.drafted || false,
      draftDate: draftSettings.date ? new Date(draftSettings.date) : undefined,
      draftType: this.getDraftType(draftSettings.type),
      totalRounds: draftSettings.rounds || 16,
      totalPicks: picks.length,
      timePerPick: draftSettings.timePerPick,
      keeperCount: draftSettings.keeperCount || 0,
      picks,
      currentPick: draftDetail.drafted ? undefined : picks.length + 1,
      onTheClock: draftDetail.drafted ? undefined : this.getNextTeamToPick(picks, teams.length)
    };
  }

  async getAvailablePlayers(leagueId: string, position?: string): Promise<any[]> {
    let url = `${this.baseUrl}/seasons/${this.year}/segments/0/leagues/${leagueId}?view=kona_player_info`;
    
    if (position) {
      const positionId = this.getPositionId(position);
      url += `&players=0`; // Add filter if needed
    }

    const response = await axios.get(url, { headers: this.getHeaders() });
    
    // Filter for available players (not rostered)
    const availablePlayers = (response.data.players || [])
      .filter((p: any) => {
        const player = p.player || p.playerPoolEntry?.player;
        const ownership = player?.ownership;
        return !ownership?.percentOwned || ownership.percentOwned < 100;
      })
      .map((p: any) => {
        const player = p.player || p.playerPoolEntry?.player || {};
        return {
          id: player.id?.toString() || '',
          firstName: player.firstName || '',
          lastName: player.lastName || '',
          fullName: player.fullName || '',
          position: this.getPositionName(player.defaultPositionId),
          team: this.getTeamAbbreviation(player.proTeamId),
          projectedPoints: player.stats?.[1]?.appliedTotal || 0,
          adp: player.draftAuctionValue || 999, // Use as ADP approximation
          percentOwned: player.ownership?.percentOwned || 0,
          injuryStatus: player.injuryStatus
        };
      })
      .filter((p: any) => p.position !== 'Unknown')
      .sort((a: any, b: any) => (a.adp || 999) - (b.adp || 999));

    return position ? 
      availablePlayers.filter((p: any) => p.position === position.toUpperCase()) :
      availablePlayers;
  }

  private getDraftType(type: number): 'snake' | 'linear' | 'auction' {
    switch (type) {
      case 0: return 'snake';
      case 1: return 'linear';
      case 2: return 'auction';
      default: return 'snake';
    }
  }

  private getNextTeamToPick(picks: DraftPick[], teamCount: number): number {
    if (picks.length === 0) return 1;
    
    const currentRound = Math.floor(picks.length / teamCount) + 1;
    const pickInRound = (picks.length % teamCount) + 1;
    
    // For snake draft, reverse order on even rounds
    if (currentRound % 2 === 0) {
      return teamCount - pickInRound + 1;
    } else {
      return pickInRound;
    }
  }

  private getPositionName(positionId: number): string {
    const positions: { [key: number]: string } = {
      1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'DST'
    };
    return positions[positionId] || 'Unknown';
  }

  private getPositionId(position: string): number {
    const positions: { [key: string]: number } = {
      'QB': 1, 'RB': 2, 'WR': 3, 'TE': 4, 'K': 5, 'DST': 16
    };
    return positions[position.toUpperCase()] || 0;
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

export const draftApi = new DraftApiService();