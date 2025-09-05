// Minimal ESPN API service for testing
export interface ESPNCookies {
  espn_s2: string;
  swid: string;
}

export class ESPNApiService {
  private cookies: ESPNCookies | null = null;

  setCookies(cookies: ESPNCookies) {
    this.cookies = cookies;
    console.log('ESPN cookies set');
  }

  getCookies(): ESPNCookies | null {
    return this.cookies;
  }

  async getLeagueInfo(leagueId: string) {
    // Mock implementation for testing
    return {
      id: leagueId,
      name: 'Test League',
      seasonId: 2025,
      currentWeek: 1,
      teams: [],
      settings: {}
    };
  }

  async getTeamRoster(leagueId: string, teamId: string) {
    // Mock implementation
    return {
      starters: [],
      bench: [],
      teamId: teamId
    };
  }
}

export const espnApi = new ESPNApiService();