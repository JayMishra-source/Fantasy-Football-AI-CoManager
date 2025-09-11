export interface LeagueTeamInfo {
  leagueId: string;
  teamId: string;
  leagueName?: string;
  teamName?: string;
}

export interface WorkflowContext {
  week: number;
  leagues: LeagueTeamInfo[];
  task: WorkflowTask;
  previousResults?: any;
  additionalContext?: {
    weather?: any;
    news?: string[];
    injuries?: any[];
    trends?: any;
  };
}

export type WorkflowTask = 
  | 'thursday_optimization'
  | 'sunday_check' 
  | 'monday_analysis'
  | 'tuesday_waivers';

export interface WorkflowResult {
  task: WorkflowTask;
  week: number;
  timestamp: Date;
  leagues: LeagueAnalysisResult[];
  summary: {
    keyInsights: string[];
    recommendations: string[];
    confidence: number;
    dataSourcesUsed: string[];
  };
  llmReasoning: string;
  toolsUsed: string[];
  costInfo?: {
    tokensUsed: number;
    estimatedCost: number;
  };
}

export interface LeagueAnalysisResult {
  leagueId: string;
  teamId: string;
  leagueName?: string;
  analysis: {
    lineup?: LineupAnalysis;
    roster?: RosterAnalysis;
    waivers?: WaiverAnalysis;
    performance?: PerformanceAnalysis;
  };
  recommendations: string[];
  confidence: number;
}

export interface LineupAnalysis {
  currentLineup: any[];
  suggestedLineup: any[];
  changes: Array<{
    action: 'start' | 'bench' | 'consider';
    player: any;
    reason: string;
    confidence: number;
  }>;
  projectedPointsGain: number;
  riskAssessment: 'low' | 'medium' | 'high';
}

export interface RosterAnalysis {
  strengths: string[];
  weaknesses: string[];
  injuryAlert: any[];
  byeWeekIssues: any[];
  recommendations: string[];
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface WaiverAnalysis {
  targets: Array<{
    player: any;
    priority: number;
    reason: string;
    faabBid: number;
    dropCandidate?: any;
  }>;
  strategy: 'aggressive' | 'conservative' | 'streaming';
  budgetRecommendation: number;
}

export interface PerformanceAnalysis {
  weeklyScore: number;
  optimalScore: number;
  pointsLeftOnBench: number;
  startSitAccuracy: number;
  insights: string[];
}

export interface WorkflowRequest {
  task: WorkflowTask;
  leagues: LeagueTeamInfo[];
  week: number;
  prompt: string;
  context?: any;
}

export interface LLMWorkflowPrompt {
  systemPrompt: string;
  userPrompt: string;
  availableTools: string[];
  context: WorkflowContext;
}