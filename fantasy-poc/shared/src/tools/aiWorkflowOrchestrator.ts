import { espnApi } from '../services/espnApi.js';
import { fantasyProsApi } from '../services/fantasyProsApi.js';
import { llmConfig } from '../config/llm-config.js';

export async function executeAIWorkflow(args: {
  task: string;
  leagues: Array<{ leagueId: string; teamId: string; name?: string }>;
  week: number;
  prompt: string;
  context?: any;
}) {
  const { task, leagues, week, prompt } = args;
  
  console.log(`🤖 Executing AI workflow: ${task} for week ${week} with ${leagues.length} leagues`);
  
  try {
    // Fetch FantasyPros expert consensus data for enhanced analysis
    console.log('📊 Fetching FantasyPros expert consensus data...');
    let expertRankings: any = null;
    try {
      // Check if FantasyPros is configured and available
      const isAuthenticated = fantasyProsApi.getAuthenticationStatus();
      if (isAuthenticated) {
        console.log('✅ FantasyPros authenticated - fetching expert rankings');
        expertRankings = {
          qb: await fantasyProsApi.getRankings('QB'),
          rb: await fantasyProsApi.getRankings('RB'),
          wr: await fantasyProsApi.getRankings('WR'),
          te: await fantasyProsApi.getRankings('TE'),
          k: await fantasyProsApi.getRankings('K'),
          dst: await fantasyProsApi.getRankings('DST')
        };
        console.log('📈 Expert rankings fetched successfully');
      } else {
        console.log('⚠️ FantasyPros not authenticated - continuing with ESPN data only');
      }
    } catch (fpError: any) {
      console.warn('⚠️ FantasyPros data unavailable:', fpError.message);
    }

    // Fetch real roster data for each league
    const leagueData = await Promise.all(
      leagues.map(async (league) => {
        try {
          console.log(`📋 Fetching roster for ${league.name || league.leagueId}...`);
          const roster = await espnApi.getTeamRoster(league.leagueId, league.teamId);
          console.log(`📊 Roster fetched - Starters: ${roster.starters?.length || 0}, Bench: ${roster.bench?.length || 0}`);
          const leagueInfo = await espnApi.getLeagueInfo(league.leagueId);
          console.log(`🏈 League info: ${leagueInfo?.name || 'Unknown'}`);
          
          if (!roster.starters || roster.starters.length === 0) {
            throw new Error(`Empty roster returned for league ${league.leagueId}, team ${league.teamId}`);
          }
          
          return {
            leagueId: league.leagueId,
            teamId: league.teamId,
            leagueName: leagueInfo.name || league.name || 'Unknown League',
            teamName: (roster as any).teamName || 'My Team',
            starters: roster.starters || [],
            bench: roster.bench || [],
            roster: roster
          };
        } catch (error: any) {
          console.error(`❌ ESPN API FAILED for ${league.name || league.leagueId}:`, error.message);
          throw new Error(`ESPN API authentication failed for league ${league.leagueId}: ${error.message}`);
        }
      })
    );

    // Create comprehensive prompt with real roster data and expert rankings
    const expertDataSection = expertRankings ? `
EXPERT CONSENSUS RANKINGS (FantasyPros Week ${week}):
${Object.entries(expertRankings).map(([position, rankings]: [string, any]) => `
${position.toUpperCase()} RANKINGS: ${rankings.players?.slice(0, 10).map((p: any, i: number) => 
  `${i+1}. ${p.player.name} (${p.player.team}) - Rank: ${p.rank}, Tier: ${p.tier}`
).join(', ') || 'No rankings available'}
`).join('\n')}` : '\n⚠️ FantasyPros expert rankings not available - using ESPN data only\n';

    const enhancedPrompt = `${prompt}

CURRENT ROSTER DATA:
${leagueData.map(league => `
${league.leagueName} (${league.teamName}):
STARTERS: ${league.starters.map((p: any) => `${p.fullName} (${p.position})`).join(', ') || 'No starters found'}
BENCH: ${league.bench.map((p: any) => `${p.fullName} (${p.position})`).join(', ') || 'No bench players found'}
`).join('\n')}
${expertDataSection}

Based on these ACTUAL rosters and EXPERT CONSENSUS RANKINGS, provide SPECIFIC recommendations with player names.`;

    console.log('🧠 Generating analysis with real LLM...');
    
    // Use real LLM for analysis
    const llmResponse = await llmConfig.generateResponse(enhancedPrompt);

    // Extract specific insights from LLM response
    const insights = extractInsightsFromLLMResponse(llmResponse, leagueData);

    const result = {
      success: true,
      task,
      week,
      leagues: leagueData.map(league => ({
        leagueId: league.leagueId,
        teamId: league.teamId,
        name: league.leagueName
      })),
      summary: {
        keyInsights: insights.keyInsights,
        confidence: insights.confidence,
        dataSourcesUsed: expertRankings 
          ? ['ESPN API', 'FantasyPros Expert Rankings', 'Real LLM Analysis']
          : ['ESPN API', 'Real LLM Analysis (No FantasyPros)']
      },
      recommendations: leagueData.map(league => ({
        leagueId: league.leagueId,
        teamId: league.teamId,
        name: league.leagueName,
        changes: insights.recommendations.filter((r: any) => r.league === league.leagueName),
        analysis: insights.analysis
      })),
      llmResponse: llmResponse,
      timestamp: new Date().toISOString()
    };

    console.log(`✅ AI workflow completed: ${task} with real analysis`);
    return result;

  } catch (error: any) {
    console.error(`❌ AI workflow failed: ${task}`, error);
    
    // Return error with context
    return {
      success: false,
      error: error.message,
      task,
      week,
      leagues,
      summary: {
        keyInsights: [`Analysis failed: ${error.message}`],
        confidence: 0,
        dataSourcesUsed: ['Error']
      },
      recommendations: [],
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Generate mock analysis based on real roster data
 */
async function generateMockAnalysis(prompt: string, leagueData: any[]): Promise<any> {
  console.log(`🤖 Generating mock analysis for ${leagueData.length} leagues...`);
  
  // Generate realistic recommendations based on actual roster data
  const recommendations: string[] = [];
  
  leagueData.forEach(league => {
    console.log(`🔍 Processing ${league.leagueName} - Starters: ${league.starters?.length}, Bench: ${league.bench?.length}`);
    if (league.starters.length > 0) {
      // Pick random starters/bench players for specific actionable recommendations
      const starters = league.starters;
      const bench = league.bench;
      
      if (starters.length > 2) {
        const randomStarter = starters[Math.floor(Math.random() * starters.length)];
        recommendations.push(`Start ${randomStarter.fullName} this week for favorable matchup advantage`);
      }
      
      if (bench.length > 0) {
        const randomBench = bench[Math.floor(Math.random() * bench.length)];
        recommendations.push(`Consider ${randomBench.fullName} as flex option based on target share`);
      }
      
      // Add more actionable recommendations that match extraction patterns
      if (starters.length > 4) {
        const anotherStarter = starters[Math.floor(Math.random() * starters.length)];
        recommendations.push(`Target ${anotherStarter.fullName} for increased workload this week`);
      }
    } else {
      // This should NOT happen if ESPN API is working correctly
      console.error(`⚠️ Empty roster data for ${league.leagueName} - ESPN API authentication issue`);
      throw new Error(`Empty roster returned for ${league.leagueName} - check ESPN_S2/SWID cookies and league/team IDs`);
    }
  });
  
  return {
    text: recommendations.join('\n\n'),
    content: recommendations.join('\n\n'),
    analysis: `Comprehensive analysis completed for ${leagueData.length} leagues with real roster data.`,
    recommendations: recommendations
  };
}

/**
 * Extract actionable insights from LLM response
 */
function extractInsightsFromLLMResponse(llmResponse: any, leagueData: any[]): {
  keyInsights: string[];
  recommendations: any[];
  confidence: number;
  analysis: string;
} {
  const responseText = llmResponse.content || llmResponse.text || JSON.stringify(llmResponse);
  
  const insights: string[] = [];
  const recommendations: any[] = [];
  
  // Extract league-specific recommendations
  leagueData.forEach(league => {
    const leaguePattern = new RegExp(`${league.leagueName}[\\s\\S]*?(?=\\n\\n|${leagueData.map(l => l.leagueName).join('|')}|$)`, 'i');
    const leagueMatch = responseText.match(leaguePattern);
    
    if (leagueMatch) {
      const leagueText = leagueMatch[0];
      
      // Extract specific player recommendations with more flexible patterns
      const startPattern = /start|play|use|consider.*as.*option/gi;
      const sitPattern = /sit|bench|avoid/gi;
      const pickupPattern = /pickup|waiver|target.*on.*waiver|target.*available/gi;
      
      // Match "Start PlayerName" or "Consider PlayerName as flex option"
      if (startPattern.test(leagueText)) {
        const startMatch = leagueText.match(/(?:start|consider)\s+([^.]+?)(?:\s+(?:this week|as|for))/i);
        if (startMatch) {
          const playerName = startMatch[1].trim();
          insights.push(`Start ${playerName}`);
          recommendations.push({
            league: league.leagueName,
            type: 'start',
            player: playerName,
            reasoning: 'Roster analysis recommendation'
          });
        }
      }
      
      if (sitPattern.test(leagueText)) {
        const sitMatch = leagueText.match(/sit\s+([^.]+)/i);
        if (sitMatch) {
          insights.push(`${league.leagueName}: Sit ${sitMatch[1].trim()}`);
          recommendations.push({
            league: league.leagueName,
            type: 'sit',
            player: sitMatch[1].trim(),
            reasoning: 'LLM recommendation'
          });
        }
      }
      
      // Match "Target PlayerName for workload" or "Target available WR on waivers"  
      if (pickupPattern.test(leagueText)) {
        const pickupMatch = leagueText.match(/target\s+([^.]+?)(?:\s+(?:for|on|with))/i);
        if (pickupMatch) {
          const target = pickupMatch[1].trim();
          insights.push(`${league.leagueName}: Target ${target}`);
          recommendations.push({
            league: league.leagueName,
            type: 'target',
            player: target,
            reasoning: 'Strategic opportunity'
          });
        }
      }
    }
  });
  
  // If no specific recommendations found, extract general insights
  if (insights.length === 0) {
    const lines = responseText.split('\n');
    lines.forEach((line: string) => {
      if (line.trim() && line.length > 20 && line.length < 120) {
        // Look for actionable statements
        if (/\b(start|sit|target|pickup|trade|drop|consider)\b/i.test(line)) {
          insights.push(line.trim());
        }
      }
    });
  }
  
  // No fallback - let it fail if no insights found
  if (insights.length === 0) {
    throw new Error(`No actionable insights extracted from LLM response. Response was: ${responseText.substring(0, 200)}...`);
  }
  
  return {
    keyInsights: insights.slice(0, 5), // Limit for display
    recommendations: recommendations,
    confidence: insights.length > 2 ? 85 : 70,
    analysis: responseText
  };
}