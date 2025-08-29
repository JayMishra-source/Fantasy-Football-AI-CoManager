export interface ESPNCookies {
  espn_s2: string;
  swid: string;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  position: string;
  team: string;
  points: number;
  projectedPoints?: number;
  injuryStatus?: string;
  percentStarted?: number;
  percentOwned?: number;
}

export interface TeamRoster {
  teamId: number;
  teamName: string;
  starters: Player[];
  bench: Player[];
  injuredReserve?: Player[];
}

export interface LeagueInfo {
  id: string;
  name: string;
  seasonId: number;
  currentWeek: number;
  teams: any[];
  settings?: any;
}

export interface Matchup {
  week: number;
  homeTeam: {
    id: number;
    name: string;
    projectedScore: number;
    actualScore?: number;
  };
  awayTeam: {
    id: number;
    name: string;
    projectedScore: number;
    actualScore?: number;
  };
}

export interface WaiverTarget {
  player: Player;
  reason: string;
  priority: number;
  suggestedFAAB?: number;
  dropCandidate?: Player;
}

export interface TradeAnalysis {
  tradeScore: number;
  recommendation: 'accept' | 'reject' | 'counter';
  reasoning: string;
  fairnessRating: number;
  impact: {
    immediate: string;
    restOfSeason: string;
  };
}