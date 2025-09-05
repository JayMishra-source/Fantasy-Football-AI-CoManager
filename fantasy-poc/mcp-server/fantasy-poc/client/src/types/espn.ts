export interface Player {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  proTeamId: number;
  defaultPositionId: number;
  eligibleSlots: number[];
  stats?: PlayerStats[];
  injured?: boolean;
  injuryStatus?: string;
}

export interface PlayerStats {
  scoringPeriodId: number;
  seasonId: number;
  points: number;
  appliedTotal: number;
}

export interface Team {
  id: number;
  name: string;
  abbrev: string;
  owners: string[];
  roster?: Roster;
  record?: TeamRecord;
  points?: number;
  pointsAgainst?: number;
}

export interface Roster {
  entries: RosterEntry[];
}

export interface RosterEntry {
  playerId: number;
  playerPoolEntry: {
    player: Player;
  };
  lineupSlotId: number;
  acquisitionType?: string;
}

export interface TeamRecord {
  overall: {
    wins: number;
    losses: number;
    ties: number;
  };
}

export interface League {
  id: string;
  name: string;
  seasonId: number;
  teams: Team[];
  settings?: LeagueSettings;
}

export interface LeagueSettings {
  name: string;
  scoringType: string;
  playoffTeams: number;
  regularSeasonMatchupPeriods: number;
}