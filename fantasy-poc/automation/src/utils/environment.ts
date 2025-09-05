import { espnApi, llmConfig } from '@fantasy-ai/shared';

export async function initializeEnvironment(): Promise<void> {
  // Initialize ESPN API with cookies
  const ESPN_S2 = process.env.ESPN_S2;
  const ESPN_SWID = process.env.ESPN_SWID;
  
  if (!ESPN_S2 || !ESPN_SWID) {
    throw new Error('ESPN_S2 and ESPN_SWID environment variables are required');
  }
  
  espnApi.setCookies({
    espn_s2: ESPN_S2,
    swid: ESPN_SWID
  });
  
  console.log('✅ ESPN cookies configured');
  
  // Initialize LLM configuration
  const llmInitialized = await llmConfig.initializeLLM();
  if (!llmInitialized) {
    throw new Error('Failed to initialize LLM provider. Check API keys in environment variables.');
  }
  
  console.log('✅ LLM provider initialized');
  
  // Test ESPN connection with a simple API call
  try {
    const leagueId = process.env.LEAGUE_1_ID || process.env.LEAGUE_ID_1;
    if (leagueId) {
      const leagueInfo = await espnApi.getLeagueInfo(leagueId);
      console.log(`✅ ESPN connection verified - League: ${leagueInfo.name}`);
    } else {
      console.log('⚠️ No league ID provided for connection test');
    }
  } catch (error: any) {
    console.warn(`⚠️ ESPN connection test failed: ${error.message}`);
  }
}

export function validateEnvironment(): {
  valid: boolean;
  missing: string[];
} {
  const required = [
    'ESPN_S2',
    'ESPN_SWID'
  ];
  
  const optional = [
    'LEAGUE_1_ID',
    'LEAGUE_1_TEAM_ID',
    'GEMINI_API_KEY',
    'CLAUDE_API_KEY',
    'OPENAI_API_KEY'
  ];
  
  const missing = required.filter(env => !process.env[env]);
  const hasLLM = optional.slice(2).some(env => process.env[env]); // Check for any LLM key
  
  if (!hasLLM) {
    missing.push('At least one LLM API key (GEMINI_API_KEY, CLAUDE_API_KEY, or OPENAI_API_KEY)');
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

export function getCurrentWeek(): number {
  const now = new Date();
  const seasonStart = new Date('2025-09-04'); // 2025 NFL season start
  const timeDiff = now.getTime() - seasonStart.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  if (daysDiff <= 0) return 1;
  return Math.min(Math.ceil(daysDiff / 7), 18);
}