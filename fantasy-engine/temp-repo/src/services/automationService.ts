import { espnApi } from './espnApi.js';
import { fantasyProsApi } from './fantasyProsApi.js';
import { Player } from '../types/espn.js';

export interface LineupDecision {
  player: Player;
  action: 'start' | 'bench' | 'consider';
  confidence: number;
  reasoning: string;
  projectedPoints: number;
  riskFactor: 'low' | 'medium' | 'high';
}

export interface WaiverRecommendation {
  player: Player;
  priority: number;
  action: 'claim' | 'monitor' | 'ignore';
  dropCandidate?: Player;
  reasoning: string;
  faabBid?: number;
}

export interface AutomationReport {
  timestamp: Date;
  week: number;
  lineupChanges: LineupDecision[];
  waiverRecommendations: WaiverRecommendation[];
  injuryAlerts: Player[];
  tradeOpportunities: any[];
  weeklyProjection: number;
  riskAssessment: string;
}

export class AutomationService {
  private readonly INJURY_STATUSES = ['DOUBTFUL', 'QUESTIONABLE', 'OUT'];
  private readonly MIN_PROJECTION_THRESHOLD = 8.0;
  private readonly MAX_RISK_PLAYERS = 2;

  async generateWeeklyReport(leagueId: string, teamId: string, week: number): Promise<AutomationReport> {
    console.log(`🔄 Generating automation report for Week ${week}`);

    // Get current roster
    const roster = await espnApi.getTeamRoster(leagueId, teamId);
    const allPlayers = [...roster.starters, ...roster.bench];

    // Get available players for waiver analysis
    const availablePlayers = await espnApi.getAvailablePlayers(leagueId);

    // Generate lineup decisions
    const lineupChanges = await this.optimizeLineup(allPlayers);

    // Find waiver opportunities
    const waiverRecommendations = await this.analyzeWaiverWire(
      allPlayers,
      availablePlayers.slice(0, 50) // Top 50 available players
    );

    // Check for injuries
    const injuryAlerts = this.findInjuryAlerts(allPlayers);

    // Calculate projections
    const weeklyProjection = this.calculateTeamProjection(roster.starters);
    const riskAssessment = this.assessRosterRisk(roster.starters);

    return {
      timestamp: new Date(),
      week,
      lineupChanges,
      waiverRecommendations,
      injuryAlerts,
      tradeOpportunities: [], // TODO: Implement trade analysis
      weeklyProjection,
      riskAssessment
    };
  }

  private async optimizeLineup(players: Player[]): Promise<LineupDecision[]> {
    const decisions: LineupDecision[] = [];
    const positionGroups = this.groupPlayersByPosition(players);

    // Analyze each position group
    for (const [position, positionPlayers] of Object.entries(positionGroups)) {
      if (positionPlayers.length < 2) continue; // Skip if no competition

      // Sort by projected points and other factors
      const rankedPlayers = positionPlayers
        .map(player => ({
          player,
          score: this.calculatePlayerScore(player),
          risk: this.assessPlayerRisk(player)
        }))
        .sort((a, b) => b.score - a.score);

      // Generate recommendations for position
      rankedPlayers.forEach((playerData, index) => {
        const { player, score, risk } = playerData;
        
        let action: 'start' | 'bench' | 'consider';
        let confidence: number;
        let reasoning: string;

        if (index === 0 && score > this.MIN_PROJECTION_THRESHOLD) {
          action = 'start';
          confidence = Math.min(95, 70 + (score - this.MIN_PROJECTION_THRESHOLD) * 5);
          reasoning = `Highest projected points (${player.projectedPoints}) in ${position} group`;
        } else if (score > this.MIN_PROJECTION_THRESHOLD && risk === 'low') {
          action = 'consider';
          confidence = 60 + Math.random() * 20;
          reasoning = `Solid floor with ${player.projectedPoints} projected points`;
        } else {
          action = 'bench';
          confidence = 40 + Math.random() * 30;
          reasoning = player.injuryStatus 
            ? `Injury concern: ${player.injuryStatus}`
            : `Lower projection (${player.projectedPoints}) compared to alternatives`;
        }

        decisions.push({
          player,
          action,
          confidence,
          reasoning,
          projectedPoints: player.projectedPoints ?? 0,
          riskFactor: risk
        });
      });
    }

    return decisions.filter(d => d.confidence > 50); // Only return confident decisions
  }

  private async analyzeWaiverWire(
    currentRoster: Player[], 
    availablePlayers: Player[]
  ): Promise<WaiverRecommendation[]> {
    const recommendations: WaiverRecommendation[] = [];
    const rosterWeaknesses = this.identifyRosterWeaknesses(currentRoster);

    // Find upgrade opportunities
    for (const availablePlayer of availablePlayers) {
      const playerScore = this.calculatePlayerScore(availablePlayer);
      
      if (playerScore < this.MIN_PROJECTION_THRESHOLD) continue;

      // Find weakest player at same position for potential drop
      const samePositionPlayers = currentRoster
        .filter(p => p.position === availablePlayer.position)
        .sort((a, b) => this.calculatePlayerScore(a) - this.calculatePlayerScore(b));

      const dropCandidate = samePositionPlayers[0];
      const upgrade = dropCandidate ? 
        playerScore > this.calculatePlayerScore(dropCandidate) : false;

      if (upgrade || rosterWeaknesses.includes(availablePlayer.position)) {
        const priority = this.calculateWaiverPriority(availablePlayer, currentRoster);
        
        recommendations.push({
          player: availablePlayer,
          priority,
          action: priority > 7 ? 'claim' : priority > 4 ? 'monitor' : 'ignore',
          dropCandidate: upgrade ? dropCandidate : undefined,
          reasoning: upgrade && dropCandidate
            ? `Significant upgrade over ${dropCandidate.fullName} (+${(playerScore - this.calculatePlayerScore(dropCandidate)).toFixed(1)} pts)`
            : `Addresses roster weakness at ${availablePlayer.position}`,
          faabBid: this.calculateFAABBid(priority, availablePlayer.percentOwned ?? 0)
        });
      }
    }

    return recommendations
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10); // Top 10 recommendations
  }

  private calculatePlayerScore(player: Player): number {
    let score = player.projectedPoints ?? 0;
    
    // Injury penalty
    if (this.INJURY_STATUSES.includes(player.injuryStatus || '')) {
      score *= 0.7;
    }
    
    // Ownership bonus (popular players often safer)
    if ((player.percentOwned ?? 0) > 80) {
      score *= 1.1;
    }
    
    return score;
  }

  private assessPlayerRisk(player: Player): 'low' | 'medium' | 'high' {
    if (player.injuryStatus === 'OUT' || player.injuryStatus === 'DOUBTFUL') {
      return 'high';
    }
    
    if (player.injuryStatus === 'QUESTIONABLE' || (player.percentOwned ?? 0) < 30) {
      return 'medium';
    }
    
    return 'low';
  }

  private groupPlayersByPosition(players: Player[]): { [position: string]: Player[] } {
    return players.reduce((groups, player) => {
      const position = player.position;
      if (!groups[position]) {
        groups[position] = [];
      }
      groups[position].push(player);
      return groups;
    }, {} as { [position: string]: Player[] });
  }

  private findInjuryAlerts(players: Player[]): Player[] {
    return players.filter(player => 
      this.INJURY_STATUSES.includes(player.injuryStatus || '')
    );
  }

  private calculateTeamProjection(starters: Player[]): number {
    return starters.reduce((total, player) => total + (player.projectedPoints ?? 0), 0);
  }

  private assessRosterRisk(starters: Player[]): string {
    const highRiskCount = starters.filter(player => 
      this.assessPlayerRisk(player) === 'high'
    ).length;
    
    if (highRiskCount >= 3) return 'High Risk - Multiple injury concerns';
    if (highRiskCount >= 1) return 'Medium Risk - Some injury concerns';
    return 'Low Risk - Healthy lineup';
  }

  private identifyRosterWeaknesses(roster: Player[]): string[] {
    const positionStrength: { [position: string]: number } = {};
    
    for (const player of roster) {
      const score = this.calculatePlayerScore(player);
      positionStrength[player.position] = (positionStrength[player.position] || 0) + score;
    }
    
    // Identify positions below average
    const avgStrength = Object.values(positionStrength).reduce((a, b) => a + b, 0) / Object.keys(positionStrength).length;
    
    return Object.entries(positionStrength)
      .filter(([_, strength]) => strength < avgStrength * 0.8)
      .map(([position, _]) => position);
  }

  private calculateWaiverPriority(player: Player, roster: Player[]): number {
    let priority = Math.min(10, (player.projectedPoints ?? 0) / 2);
    
    // Boost for positions of need
    const weakPositions = this.identifyRosterWeaknesses(roster);
    if (weakPositions.includes(player.position)) {
      priority += 2;
    }
    
    // Boost for trending players (low ownership, high projections)
    if ((player.percentOwned ?? 0) < 20 && (player.projectedPoints ?? 0) > 12) {
      priority += 3;
    }
    
    return Math.min(10, priority);
  }

  private calculateFAABBid(priority: number, percentOwned: number): number {
    if (priority >= 8) return Math.min(25, 15 + Math.random() * 10); // High priority
    if (priority >= 6) return Math.min(15, 8 + Math.random() * 7);   // Medium priority
    if (priority >= 4) return Math.min(8, 3 + Math.random() * 5);    // Low priority
    return 1; // Minimum bid
  }
}

export const automationService = new AutomationService();