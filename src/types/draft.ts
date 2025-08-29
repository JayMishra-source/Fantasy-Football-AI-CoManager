import { Player } from './espn.js';

export interface DraftPick {
  id: number;
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  teamId: number;
  teamName: string;
  round: number;
  pickNumber: number;
  keeper?: boolean;
  auctionValue?: number;
}

export interface DraftInfo {
  leagueId: string;
  isCompleted: boolean;
  draftDate?: Date;
  draftType: 'snake' | 'linear' | 'auction';
  totalRounds: number;
  totalPicks: number;
  timePerPick?: number;
  keeperCount: number;
  picks: DraftPick[];
  currentPick?: number;
  onTheClock?: number; // team ID currently picking
}

export interface DraftAnalysis {
  draftInfo: DraftInfo;
  teamAnalysis: Array<{
    teamId: number;
    teamName: string;
    grade: string;
    strengths: string[];
    weaknesses: string[];
    bestPick: DraftPick;
    worstPick?: DraftPick;
    positionCounts: { [position: string]: number };
  }>;
  overallInsights: {
    bestValue: DraftPick;
    biggestReach: DraftPick;
    positionTrends: string[];
    sleepers: DraftPick[];
  };
}

export interface DraftRecommendation {
  recommendedPlayers: Array<{
    player: Player;
    reason: string;
    tier: number;
    adp: number;
    value: 'steal' | 'good' | 'fair' | 'reach';
  }>;
  positionNeeds: string[];
  strategy: string;
  nextFewRounds: string[];
}

export interface PlayerRankings {
  overall: Player[];
  byPosition: {
    [position: string]: Player[];
  };
  tiers: Array<{
    tier: number;
    players: Player[];
    description: string;
  }>;
  sleepers: Player[];
  avoids: Player[];
}