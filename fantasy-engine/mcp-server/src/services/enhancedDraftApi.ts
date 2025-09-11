import { draftApi } from './draftApi.js';
import { fantasyProsApi, FantasyProsPlayer } from './fantasyProsApi.js';
import { espnApi } from './espnApi.js';

export interface EnhancedPlayer {
  // ESPN data
  id: string;
  name: string;
  position: string;
  team: string;
  projectedPoints: number;
  
  // FantasyPros data
  fpRank?: number;
  fpADP?: number;
  fpTier?: number;
  expertConsensus?: number;
  rankingVariance?: number;
  
  // Combined analysis
  value: 'elite' | 'great' | 'good' | 'fair' | 'reach' | 'avoid';
  confidence: 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface EnhancedDraftRecommendation {
  topRecommendations: EnhancedPlayer[];
  positionNeeds: string[];
  tierBreaks: {
    position: string;
    currentTier: number;
    nextTierAt: number;
    recommendation: string;
  }[];
  strategy: string;
  riskAssessment: {
    safePlay: EnhancedPlayer;
    upsidePick: EnhancedPlayer;
    valuePick: EnhancedPlayer;
  };
}

export class EnhancedDraftApiService {
  private fpRankings: { [position: string]: FantasyProsPlayer[] } = {};
  private lastUpdate = 0;
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  async initialize(email: string, password: string): Promise<boolean> {
    const success = await fantasyProsApi.authenticate(email, password);
    if (success) {
      await this.loadFantasyProsData();
    }
    return success;
  }

  async initializeWithSession(): Promise<boolean> {
    // Session is already authenticated in fantasyProsApi
    if (fantasyProsApi.isLoggedIn()) {
      await this.loadFantasyProsData();
      return true;
    }
    return false;
  }

  private async loadFantasyProsData(): Promise<void> {
    const now = Date.now();
    if (now - this.lastUpdate < this.CACHE_DURATION) return;

    try {
      console.log('📊 Loading FantasyPros rankings...');
      
      // Load rankings for all positions
      const positions = ['QB', 'RB', 'WR', 'TE'] as const;
      
      for (const position of positions) {
        const rankings = await fantasyProsApi.getRankings(position, 'PPR');
        this.fpRankings[position] = rankings.players;
      }
      
      this.lastUpdate = now;
      console.log('✅ FantasyPros rankings loaded');
    } catch (error: any) {
      console.error('❌ Failed to load FantasyPros data:', error.message);
    }
  }

  private findFantasyProPlayer(playerName: string, position: string): FantasyProsPlayer | undefined {
    const positionPlayers = this.fpRankings[position] || [];
    
    // Try exact match first
    let match = positionPlayers.find(fp => 
      fp.player.name.toLowerCase() === playerName.toLowerCase()
    );
    
    if (!match) {
      // Try partial match (handles different name formats)
      const nameParts = playerName.toLowerCase().split(' ');
      match = positionPlayers.find(fp => {
        const fpName = fp.player.name.toLowerCase();
        return nameParts.every(part => fpName.includes(part));
      });
    }
    
    return match;
  }

  private calculateValue(espnPlayer: any, fpPlayer?: FantasyProsPlayer, currentPick: number = 1): EnhancedPlayer['value'] {
    if (!fpPlayer) return 'fair';
    
    const adp = fpPlayer.adp || fpPlayer.expertConsensus;
    const pickDifference = adp - currentPick;
    
    if (pickDifference > 25) return 'elite';
    if (pickDifference > 15) return 'great';
    if (pickDifference > 8) return 'good';
    if (pickDifference > -5) return 'fair';
    if (pickDifference > -15) return 'reach';
    return 'avoid';
  }

  private calculateConfidence(fpPlayer?: FantasyProsPlayer): EnhancedPlayer['confidence'] {
    if (!fpPlayer) return 'low';
    
    const variance = fpPlayer.stdDev || 0;
    if (variance < 5) return 'high';
    if (variance < 10) return 'medium';
    return 'low';
  }

  private generateRecommendation(player: EnhancedPlayer, currentPick: number, positionNeed: boolean): string {
    const needText = positionNeed ? 'fills position need' : 'depth pick';
    const valueText = {
      elite: 'MUST DRAFT - elite value',
      great: 'excellent value',
      good: 'good value', 
      fair: 'fair value',
      reach: 'slight reach',
      avoid: 'significant reach'
    }[player.value];
    
    const tierText = player.fpTier ? ` (Tier ${player.fpTier})` : '';
    
    return `${valueText}, ${needText}${tierText}`;
  }

  async getEnhancedRecommendations(leagueId: string, teamId: string, round: number = 1): Promise<EnhancedDraftRecommendation> {
    await this.loadFantasyProsData();
    
    // Get ESPN data
    const draftInfo = await draftApi.getDraftInfo(leagueId);
    const availablePlayers = await draftApi.getAvailablePlayers(leagueId);
    
    // Calculate current pick
    const currentPick = draftInfo.picks.length + 1;
    
    // Analyze team needs
    const teamPicks = draftInfo.picks.filter(p => p.teamId === parseInt(teamId));
    const positionCounts: { [position: string]: number } = {};
    teamPicks.forEach(pick => {
      positionCounts[pick.position] = (positionCounts[pick.position] || 0) + 1;
    });

    const positionNeeds: string[] = [];
    if ((positionCounts['RB'] || 0) < 2) positionNeeds.push('RB');
    if ((positionCounts['WR'] || 0) < 2) positionNeeds.push('WR');
    if ((positionCounts['QB'] || 0) === 0 && round >= 4) positionNeeds.push('QB');
    if ((positionCounts['TE'] || 0) === 0 && round >= 6) positionNeeds.push('TE');

    // Get drafted player IDs
    const draftedPlayerIds = new Set(draftInfo.picks.map(p => p.playerId));
    const stillAvailable = availablePlayers.filter(p => !draftedPlayerIds.has(p.id));

    // Enhance players with FantasyPros data
    const enhancedPlayers: EnhancedPlayer[] = stillAvailable.slice(0, 50).map(espnPlayer => {
      const fpPlayer = this.findFantasyProPlayer(espnPlayer.fullName, espnPlayer.position);
      const value = this.calculateValue(espnPlayer, fpPlayer, currentPick);
      const confidence = this.calculateConfidence(fpPlayer);
      const positionNeed = positionNeeds.includes(espnPlayer.position);
      
      const enhanced: EnhancedPlayer = {
        id: espnPlayer.id,
        name: espnPlayer.fullName,
        position: espnPlayer.position,
        team: espnPlayer.team,
        projectedPoints: espnPlayer.projectedPoints,
        fpRank: fpPlayer?.expertConsensus,
        fpADP: fpPlayer?.adp || fpPlayer?.expertConsensus,
        fpTier: fpPlayer?.tier,
        expertConsensus: fpPlayer?.expertConsensus,
        rankingVariance: fpPlayer?.stdDev,
        value,
        confidence,
        recommendation: ''
      };
      
      enhanced.recommendation = this.generateRecommendation(enhanced, currentPick, positionNeed);
      return enhanced;
    });

    // Sort by combination of value, position need, and confidence
    const topRecommendations = enhancedPlayers
      .sort((a, b) => {
        const aScore = this.getPlayerScore(a, positionNeeds);
        const bScore = this.getPlayerScore(b, positionNeeds);
        return bScore - aScore;
      })
      .slice(0, 12);

    // Analyze tier breaks
    const tierBreaks = this.analyzeTierBreaks(enhancedPlayers, currentPick);

    // Generate strategy
    const strategy = this.generateStrategy(round, positionNeeds, currentPick, topRecommendations);

    // Risk assessment
    const riskAssessment = this.getRiskAssessment(topRecommendations);

    return {
      topRecommendations,
      positionNeeds,
      tierBreaks,
      strategy,
      riskAssessment
    };
  }

  private getPlayerScore(player: EnhancedPlayer, positionNeeds: string[]): number {
    let score = 0;
    
    // Value scoring
    const valueScores = { elite: 50, great: 35, good: 20, fair: 10, reach: -10, avoid: -30 };
    score += valueScores[player.value];
    
    // Position need bonus
    if (positionNeeds.includes(player.position)) {
      score += 20;
    }
    
    // Confidence bonus
    const confidenceScores = { high: 10, medium: 5, low: 0 };
    score += confidenceScores[player.confidence];
    
    // ADP adjustment (prefer higher ADP)
    if (player.fpADP) {
      score += Math.max(0, 200 - player.fpADP) / 10;
    }
    
    return score;
  }

  private analyzeTierBreaks(players: EnhancedPlayer[], currentPick: number): EnhancedDraftRecommendation['tierBreaks'] {
    const tierBreaks: EnhancedDraftRecommendation['tierBreaks'] = [];
    const positions = ['QB', 'RB', 'WR', 'TE'];
    
    for (const position of positions) {
      const positionPlayers = players.filter(p => p.position === position);
      if (positionPlayers.length === 0) continue;
      
      // Find current tier and next tier break
      const currentTier = positionPlayers[0]?.fpTier || 1;
      const nextTierPlayer = positionPlayers.find(p => p.fpTier && p.fpTier > currentTier);
      const nextTierAt = nextTierPlayer?.fpADP || 999;
      
      let recommendation = '';
      if (nextTierAt - currentPick < 15) {
        recommendation = `Tier break coming soon - consider ${position} now`;
      } else if (nextTierAt - currentPick > 30) {
        recommendation = `Safe to wait on ${position}`;
      } else {
        recommendation = `Monitor ${position} tier closely`;
      }
      
      tierBreaks.push({
        position,
        currentTier,
        nextTierAt,
        recommendation
      });
    }
    
    return tierBreaks;
  }

  private generateStrategy(round: number, positionNeeds: string[], currentPick: number, recommendations: EnhancedPlayer[]): string {
    if (round <= 2) {
      const hasElite = recommendations.some(p => p.value === 'elite');
      if (hasElite) return 'Elite value available - prioritize best player available';
      return 'Build foundation with RB/WR studs';
    }
    
    if (round <= 6) {
      if (positionNeeds.includes('QB') && recommendations.some(p => p.position === 'QB' && p.value === 'good')) {
        return 'Consider premium QB if good value';
      }
      if (positionNeeds.includes('TE') && recommendations.some(p => p.position === 'TE' && p.fpTier && p.fpTier <= 2)) {
        return 'Elite TE available - strong consideration';
      }
      return 'Fill remaining core needs, target value';
    }
    
    return 'Build depth, target upside plays and handcuffs';
  }

  private getRiskAssessment(recommendations: EnhancedPlayer[]): EnhancedDraftRecommendation['riskAssessment'] {
    const safePlay = recommendations.find(p => p.confidence === 'high') || recommendations[0];
    const upsidePick = recommendations.find(p => p.confidence === 'low' && p.value === 'good') || recommendations[0];
    const valuePick = recommendations.find(p => p.value === 'great' || p.value === 'elite') || recommendations[0];
    
    return { safePlay, upsidePick, valuePick };
  }
}

export const enhancedDraftApi = new EnhancedDraftApiService();