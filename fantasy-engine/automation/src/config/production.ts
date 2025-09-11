import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface ProductionConfig {
  // ESPN Configuration
  espn: {
    s2: string;
    swid: string;
    season: number;
  };
  
  // League Configuration
  leagues: Array<{
    id: string;
    teamId: string;
    name: string;
    faabBudget?: number;
    priority: 'high' | 'medium' | 'low';
  }>;
  
  // LLM Configuration
  llm: {
    primaryProvider: 'gemini' | 'claude' | 'openai' | 'perplexity';
    fallbackProvider?: 'gemini' | 'claude' | 'openai' | 'perplexity';
    costLimits: {
      perAnalysis: number;
      daily: number;
      weekly: number;
      monthly: number;
    };
  };
  
  // Feature Flags
  features: {
    enableFantasyPros: boolean;
    enableWeatherData: boolean;
    enableNewsIntegration: boolean;
    enableCrossLeagueCoordination: boolean;
    enableABTesting: boolean;
    enablePerformanceTracking: boolean;
  };
  
  // Automation Schedule
  schedule: {
    enabled: boolean;
    timezone: string;
    notifications: {
      discord?: string;
      slack?: string;
      email?: string;
    };
  };
  
  // Safety Limits
  safety: {
    maxExecutionTime: number; // seconds
    maxConcurrentLeagues: number;
    retryAttempts: number;
    enableDryRun: boolean;
  };
}

export function loadProductionConfig(): ProductionConfig {
  const config: ProductionConfig = {
    espn: {
      s2: process.env.ESPN_S2 || '',
      swid: process.env.ESPN_SWID || '',
      season: parseInt(process.env.ESPN_SEASON || '2025')
    },
    
    leagues: [],
    
    llm: {
      primaryProvider: (process.env.PRIMARY_LLM_PROVIDER as any) || 'gemini',
      fallbackProvider: process.env.FALLBACK_LLM_PROVIDER as any,
      costLimits: {
        perAnalysis: parseFloat(process.env.PER_ANALYSIS_LIMIT || '1.00'),
        daily: parseFloat(process.env.DAILY_COST_LIMIT || '2.00'),
        weekly: parseFloat(process.env.WEEKLY_COST_LIMIT || '10.00'),
        monthly: parseFloat(process.env.MONTHLY_COST_LIMIT || '35.00')
      }
    },
    
    features: {
      enableFantasyPros: process.env.ENABLE_FANTASYPROS === 'true',
      enableWeatherData: process.env.ENABLE_WEATHER === 'true',
      enableNewsIntegration: process.env.ENABLE_NEWS === 'true',
      enableCrossLeagueCoordination: process.env.ENABLE_CROSS_LEAGUE === 'true',
      enableABTesting: process.env.ENABLE_AB_TESTING !== 'false', // default true
      enablePerformanceTracking: process.env.ENABLE_PERFORMANCE_TRACKING !== 'false'
    },
    
    schedule: {
      enabled: process.env.SCHEDULE_ENABLED !== 'false',
      timezone: process.env.TIMEZONE || 'America/New_York',
      notifications: {
        discord: process.env.DISCORD_WEBHOOK_URL,
        slack: process.env.SLACK_WEBHOOK_URL,
        email: process.env.EMAIL_WEBHOOK_URL
      }
    },
    
    safety: {
      maxExecutionTime: parseInt(process.env.MAX_EXECUTION_TIME || '600'), // 10 minutes
      maxConcurrentLeagues: parseInt(process.env.MAX_CONCURRENT_LEAGUES || '5'),
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
      enableDryRun: process.env.ENABLE_DRY_RUN === 'true'
    }
  };
  
  // Parse league configurations
  for (let i = 1; i <= 10; i++) { // Support up to 10 leagues
    const leagueId = process.env[`LEAGUE_${i}_ID`];
    const teamId = process.env[`LEAGUE_${i}_TEAM_ID`];
    const name = process.env[`LEAGUE_${i}_NAME`];
    
    if (leagueId && teamId) {
      config.leagues.push({
        id: leagueId,
        teamId: teamId,
        name: name || `League ${i}`,
        faabBudget: parseInt(process.env[`LEAGUE_${i}_FAAB_BUDGET`] || '100'),
        priority: (process.env[`LEAGUE_${i}_PRIORITY`] as any) || 'medium'
      });
    }
  }
  
  return config;
}

export function validateProductionConfig(config: ProductionConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required ESPN configuration
  if (!config.espn.s2) errors.push('ESPN_S2 cookie is required');
  if (!config.espn.swid) errors.push('ESPN_SWID cookie is required');
  
  // At least one league required
  if (config.leagues.length === 0) {
    errors.push('At least one league must be configured (LEAGUE_1_ID, LEAGUE_1_TEAM_ID)');
  }
  
  // LLM provider validation
  const hasLLMKey = 
    process.env.GEMINI_API_KEY ||
    process.env.CLAUDE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.PERPLEXITY_API_KEY;
  
  if (!hasLLMKey) {
    errors.push('At least one LLM API key is required');
  }
  
  // Warnings for optional features
  if (config.features.enableFantasyPros && !process.env.FANTASYPROS_SESSION_ID) {
    warnings.push('FantasyPros enabled but no session ID provided');
  }
  
  if (config.features.enableWeatherData && !process.env.OPENWEATHER_API_KEY) {
    warnings.push('Weather data enabled but no OpenWeather API key provided');
  }
  
  if (config.features.enableNewsIntegration && !process.env.NEWS_API_KEY) {
    warnings.push('News integration enabled but no News API key provided');
  }
  
  // Cost limit validation
  if (config.llm.costLimits.daily < config.llm.costLimits.perAnalysis * 2) {
    warnings.push('Daily cost limit may be too low for regular operation');
  }
  
  // Safety checks
  if (config.safety.maxExecutionTime < 300) {
    warnings.push('Max execution time is quite low (< 5 minutes)');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function getEnvironmentType(): 'production' | 'staging' | 'development' {
  const env = process.env.NODE_ENV || 'development';
  if (env === 'production') return 'production';
  if (env === 'staging') return 'staging';
  return 'development';
}