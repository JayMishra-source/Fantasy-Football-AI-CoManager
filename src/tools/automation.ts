import { automationService, AutomationReport } from '../services/automationService.js';

export async function generateAutomationReport(args: {
  leagueId: string;
  teamId: string;
  week?: number;
}): Promise<{
  success: boolean;
  report?: AutomationReport;
  error?: string;
}> {
  try {
    const currentWeek = args.week || getCurrentNFLWeek();
    const report = await automationService.generateWeeklyReport(
      args.leagueId,
      args.teamId,
      currentWeek
    );

    return {
      success: true,
      report
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function getLineupRecommendations(args: {
  leagueId: string;
  teamId: string;
  week?: number;
}): Promise<{
  success: boolean;
  recommendations?: any[];
  error?: string;
}> {
  try {
    const report = await automationService.generateWeeklyReport(
      args.leagueId,
      args.teamId,
      args.week || getCurrentNFLWeek()
    );

    const highConfidenceChanges = report.lineupChanges
      .filter(change => change.confidence > 70)
      .map(change => ({
        player: change.player.fullName,
        position: change.player.position,
        team: change.player.team,
        action: change.action,
        confidence: `${change.confidence.toFixed(0)}%`,
        reasoning: change.reasoning,
        projectedPoints: change.projectedPoints,
        risk: change.riskFactor
      }));

    return {
      success: true,
      recommendations: highConfidenceChanges
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function getWaiverTargets(args: {
  leagueId: string;
  teamId: string;
  maxResults?: number;
}): Promise<{
  success: boolean;
  targets?: any[];
  error?: string;
}> {
  try {
    const report = await automationService.generateWeeklyReport(
      args.leagueId,
      args.teamId,
      getCurrentNFLWeek()
    );

    const topTargets = report.waiverRecommendations
      .filter(rec => rec.action === 'claim' || rec.action === 'monitor')
      .slice(0, args.maxResults || 10)
      .map(rec => ({
        player: rec.player.fullName,
        position: rec.player.position,
        team: rec.player.team,
        priority: rec.priority,
        action: rec.action,
        reasoning: rec.reasoning,
        projectedPoints: rec.player.projectedPoints,
        percentOwned: rec.player.percentOwned,
        dropCandidate: rec.dropCandidate?.fullName,
        suggestedBid: rec.faabBid
      }));

    return {
      success: true,
      targets: topTargets
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function getInjuryAlert(args: {
  leagueId: string;
  teamId: string;
}): Promise<{
  success: boolean;
  alerts?: any[];
  error?: string;
}> {
  try {
    const report = await automationService.generateWeeklyReport(
      args.leagueId,
      args.teamId,
      getCurrentNFLWeek()
    );

    const alerts = report.injuryAlerts.map(player => ({
      player: player.fullName,
      position: player.position,
      team: player.team,
      status: player.injuryStatus,
      projectedPoints: player.projectedPoints,
      severity: player.injuryStatus === 'OUT' ? 'CRITICAL' : 
                player.injuryStatus === 'DOUBTFUL' ? 'HIGH' : 'MEDIUM'
    }));

    return {
      success: true,
      alerts
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function getWeeklyProjection(args: {
  leagueId: string;
  teamId: string;
}): Promise<{
  success: boolean;
  projection?: {
    totalPoints: number;
    riskAssessment: string;
    confidence: string;
    breakdown: any[];
  };
  error?: string;
}> {
  try {
    const report = await automationService.generateWeeklyReport(
      args.leagueId,
      args.teamId,
      getCurrentNFLWeek()
    );

    // Calculate confidence based on risk and injuries
    const injuryCount = report.injuryAlerts.length;
    const highRiskCount = report.lineupChanges.filter(c => c.riskFactor === 'high').length;
    
    let confidence = 'HIGH';
    if (injuryCount >= 2 || highRiskCount >= 3) confidence = 'LOW';
    else if (injuryCount >= 1 || highRiskCount >= 1) confidence = 'MEDIUM';

    return {
      success: true,
      projection: {
        totalPoints: Math.round(report.weeklyProjection * 100) / 100,
        riskAssessment: report.riskAssessment,
        confidence,
        breakdown: report.lineupChanges.map(change => ({
          player: change.player.fullName,
          position: change.player.position,
          projectedPoints: change.projectedPoints,
          risk: change.riskFactor
        }))
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Utility function to calculate current NFL week
function getCurrentNFLWeek(): number {
  const now = new Date();
  const seasonStart = new Date('2025-09-04'); // NFL season start
  const timeDiff = now.getTime() - seasonStart.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  if (daysDiff <= 0) return 1;
  return Math.min(Math.ceil(daysDiff / 7), 18);
}