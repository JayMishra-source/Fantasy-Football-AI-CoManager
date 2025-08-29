import { automationService, LineupDecision, WaiverRecommendation, AutomationReport } from './automationService.js';
import { fantasyProsApi, FantasyProsRankings } from './fantasyProsApi.js';
import { Player } from '../types/espn.js';

export interface EnhancedLineupDecision extends LineupDecision {
  expertRank?: number;
  expertTier?: number;
  expertConsensus?: number;
  confidenceBoost?: string;
}

export interface EnhancedWaiverRecommendation extends WaiverRecommendation {
  expertRank?: number;
  adp?: number;
  tierDifference?: number;
  valueScore?: number;
}

export interface EnhancedAutomationReport extends AutomationReport {
  fantasyProsEnabled: boolean;
  expertInsights?: {
    topValuePlays: any[];
    tierBreakdowns: any;
    consensusWarnings: string[];
  };
}

export class EnhancedAutomationService {
  private fantasyProsEnabled: boolean = false;
  private fantasyProsData: FantasyProsRankings | null = null;
  private playerRankings: Map<string, any> = new Map();

  /**
   * Initialize FantasyPros integration if credentials are available
   * This is optional - the service works without it
   */
  async initializeFantasyPros(sessionId?: string): Promise<boolean> {
    if (!sessionId) {
      console.log('📊 FantasyPros integration disabled - no session ID provided');
      this.fantasyProsEnabled = false;
      return false;
    }

    try {
      console.log('🔄 Initializing optional FantasyPros integration...');
      const success = await fantasyProsApi.authenticateWithSession(sessionId);
      
      if (success) {
        // Pre-load rankings for faster access
        this.fantasyProsData = await fantasyProsApi.getRankings('ALL', 'PPR');
        
        // Build player lookup map
        this.fantasyProsData.players.forEach(player => {
          const normalizedName = this.normalizePlayerName(player.player.name);
          this.playerRankings.set(normalizedName, player);
        });
        
        this.fantasyProsEnabled = true;
        console.log('✅ FantasyPros integration enabled - decisions will include expert consensus');
        return true;
      }
    } catch (error: any) {
      console.log('⚠️ FantasyPros initialization failed, continuing without expert data:', error.message);
    }
    
    this.fantasyProsEnabled = false;
    return false;
  }

  /**
   * Generate enhanced weekly report with optional FantasyPros data
   */
  async generateEnhancedWeeklyReport(
    leagueId: string, 
    teamId: string, 
    week: number
  ): Promise<EnhancedAutomationReport> {
    console.log(`🏈 Generating ${this.fantasyProsEnabled ? 'ENHANCED' : 'standard'} automation report for Week ${week}`);
    
    // Get base report from standard automation service
    const baseReport = await automationService.generateWeeklyReport(leagueId, teamId, week);
    
    // If FantasyPros is not enabled, return standard report
    if (!this.fantasyProsEnabled) {
      return {
        ...baseReport,
        fantasyProsEnabled: false
      };
    }
    
    // Enhance with FantasyPros data
    const enhancedLineupChanges = this.enhanceLineupDecisions(baseReport.lineupChanges);
    const enhancedWaiverRecommendations = await this.enhanceWaiverRecommendations(baseReport.waiverRecommendations);
    const expertInsights = this.generateExpertInsights(enhancedLineupChanges, enhancedWaiverRecommendations);
    
    return {
      ...baseReport,
      lineupChanges: enhancedLineupChanges,
      waiverRecommendations: enhancedWaiverRecommendations,
      fantasyProsEnabled: true,
      expertInsights
    };
  }

  /**
   * Enhance lineup decisions with expert consensus data
   */
  private enhanceLineupDecisions(decisions: LineupDecision[]): EnhancedLineupDecision[] {
    return decisions.map(decision => {
      const enhanced: EnhancedLineupDecision = { ...decision };
      
      if (this.fantasyProsEnabled) {
        const expertData = this.getExpertData(decision.player.fullName);
        
        if (expertData) {
          enhanced.expertRank = expertData.rank;
          enhanced.expertTier = expertData.tier;
          enhanced.expertConsensus = expertData.expertConsensus;
          
          // Adjust confidence based on expert agreement
          const expertAgreement = expertData.stdDev < 5;
          if (expertAgreement) {
            enhanced.confidence = Math.min(95, enhanced.confidence + 15);
            enhanced.confidenceBoost = 'High expert agreement';
          }
          
          // Enhance reasoning with expert data
          enhanced.reasoning += ` | Expert Rank: #${expertData.rank} (Tier ${expertData.tier})`;
          
          // Override action if expert consensus strongly disagrees
          if (decision.action === 'bench' && expertData.tier <= 2) {
            enhanced.action = 'start';
            enhanced.reasoning = `EXPERT OVERRIDE: Top-tier player (Tier ${expertData.tier}) should start despite projections`;
            enhanced.confidence = 90;
          }
        }
      }
      
      return enhanced;
    });
  }

  /**
   * Enhance waiver recommendations with ADP and tier data
   */
  private async enhanceWaiverRecommendations(
    recommendations: WaiverRecommendation[]
  ): Promise<EnhancedWaiverRecommendation[]> {
    return recommendations.map(rec => {
      const enhanced: EnhancedWaiverRecommendation = { ...rec };
      
      if (this.fantasyProsEnabled) {
        const playerData = this.getExpertData(rec.player.fullName);
        const dropData = rec.dropCandidate ? this.getExpertData(rec.dropCandidate.fullName) : null;
        
        if (playerData) {
          enhanced.expertRank = playerData.rank;
          enhanced.adp = playerData.adp;
          
          // Calculate value score based on availability vs expert rank
          const percentOwned = rec.player.percentOwned ?? 0;
          const valueScore = (100 - percentOwned) * (200 - playerData.rank) / 200;
          enhanced.valueScore = Math.round(valueScore);
          
          // Adjust priority based on expert data
          if (playerData.tier <= 5 && percentOwned < 50) {
            enhanced.priority = Math.min(10, enhanced.priority + 3);
            enhanced.reasoning += ` | HIGH VALUE: Expert Tier ${playerData.tier} available`;
          }
          
          // Compare tiers if dropping a player
          if (dropData) {
            enhanced.tierDifference = dropData.tier - playerData.tier;
            if (enhanced.tierDifference >= 2) {
              enhanced.action = 'claim';
              enhanced.priority = Math.min(10, enhanced.priority + 2);
              enhanced.reasoning += ` | ${enhanced.tierDifference} tier upgrade`;
            }
          }
          
          // Adjust FAAB bid based on ADP value
          if (enhanced.faabBid && playerData.adp < 100) {
            enhanced.faabBid = Math.min(50, Math.round(enhanced.faabBid * 1.5));
          }
        }
      }
      
      return enhanced;
    });
  }

  /**
   * Generate expert insights summary
   */
  private generateExpertInsights(
    lineupDecisions: EnhancedLineupDecision[],
    waiverRecs: EnhancedWaiverRecommendation[]
  ): any {
    if (!this.fantasyProsEnabled || !this.fantasyProsData) {
      return undefined;
    }
    
    // Find top value plays (high tier players with low ownership)
    const topValuePlays = waiverRecs
      .filter(rec => rec.expertRank && rec.expertRank < 150 && (rec.player.percentOwned ?? 0) < 30)
      .sort((a, b) => (a.valueScore ?? 0) - (b.valueScore ?? 0))
      .slice(0, 5)
      .map(rec => ({
        player: rec.player.fullName,
        expertRank: rec.expertRank,
        ownership: rec.player.percentOwned,
        valueScore: rec.valueScore,
        action: `CLAIM - Priority ${rec.priority}`
      }));
    
    // Tier breakdown for lineup decisions
    const tierBreakdowns: any = {};
    lineupDecisions.forEach(decision => {
      const tier = decision.expertTier || 99;
      if (!tierBreakdowns[decision.player.position]) {
        tierBreakdowns[decision.player.position] = [];
      }
      tierBreakdowns[decision.player.position].push({
        player: decision.player.fullName,
        tier,
        action: decision.action,
        confidence: decision.confidence
      });
    });
    
    // Consensus warnings (big disagreements between projections and experts)
    const consensusWarnings: string[] = [];
    lineupDecisions.forEach(decision => {
      if (decision.expertTier && decision.expertTier <= 3 && decision.action === 'bench') {
        consensusWarnings.push(
          `⚠️ ${decision.player.fullName} is Tier ${decision.expertTier} but recommended to bench`
        );
      }
    });
    
    return {
      topValuePlays,
      tierBreakdowns,
      consensusWarnings
    };
  }

  /**
   * Get expert data for a player by name
   */
  private getExpertData(playerName: string): any {
    if (!this.fantasyProsEnabled || !playerName) return null;
    
    const normalized = this.normalizePlayerName(playerName);
    return this.playerRankings.get(normalized) || null;
  }

  /**
   * Normalize player names for matching
   */
  private normalizePlayerName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/jr$|sr$|ii$|iii$|iv$/g, '');
  }

  /**
   * Check if FantasyPros is enabled
   */
  isFantasyProsEnabled(): boolean {
    return this.fantasyProsEnabled;
  }

  /**
   * Get summary of FantasyPros status
   */
  getFantasyProsStatus(): { enabled: boolean; playerCount?: number; lastUpdated?: Date } {
    if (!this.fantasyProsEnabled || !this.fantasyProsData) {
      return { enabled: false };
    }
    
    return {
      enabled: true,
      playerCount: this.fantasyProsData.players.length,
      lastUpdated: this.fantasyProsData.lastUpdated
    };
  }
}

// Export singleton instance
export const enhancedAutomationService = new EnhancedAutomationService();