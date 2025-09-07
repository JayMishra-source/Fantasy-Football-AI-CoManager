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
  console.log(`📌 Initial prompt preview: "${prompt.substring(0, 100)}..."`);
  console.log(`📊 Leagues to analyze: ${leagues.map(l => l.name || l.leagueId).join(', ')}`);
  
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
${position.toUpperCase()} TOP 15 RANKINGS:
${rankings.players?.slice(0, 15).map((p: any, i: number) => 
  `${i+1}. ${p.player.name} (${p.player.team}) - Expert Rank: ${p.rank} | Tier: ${p.tier} | Consensus: ${p.expertConsensus || 'N/A'}% | Range: ${p.bestRank || 'N/A'}-${p.worstRank || 'N/A'}`
).join('\n') || 'No rankings available'}

`).join('\n')}

FANTASY ANALYSIS GUIDELINES:
• Lower Expert Rank = Better (1 is best)
• Higher Expert Consensus % = More experts agree
• Tier 1-2 = Elite players, Tier 3-4 = Good options, Tier 5+ = Risky
• Smaller Rank Range (bestRank-worstRank) = More expert agreement
• Compare your roster players against these expert rankings and tiers` : '\n⚠️ FantasyPros expert rankings not available - using ESPN data only\n';

    const enhancedPrompt = `${prompt}

CURRENT ROSTER DATA:
${leagueData.map(league => `
${league.leagueName} (${league.teamName}):

STARTERS:
${league.starters.map((p: any) => {
  // Fix projected points (limit to reasonable weekly range and avoid GitHub redaction)
  const projPoints = p.projectedPoints && p.projectedPoints < 100 ? p.projectedPoints.toFixed(1) : 'N/A';
  // Format percentages safely to avoid GitHub secret detection
  const ownedPct = p.percentOwned ? `${Math.round(p.percentOwned)}%` : 'N/A';
  const startedPct = p.percentStarted ? `${Math.round(p.percentStarted)}%` : 'N/A';
  
  return `• ${p.fullName} (${p.position}) - Proj: ${projPoints} pts | Owned: ${ownedPct} | Started: ${startedPct}`;
}).join('\n') || 'No starters found'}

BENCH:
${league.bench.map((p: any) => {
  // Fix projected points (limit to reasonable weekly range and avoid GitHub redaction)
  const projPoints = p.projectedPoints && p.projectedPoints < 100 ? p.projectedPoints.toFixed(1) : 'N/A';
  // Format percentages safely to avoid GitHub secret detection
  const ownedPct = p.percentOwned ? `${Math.round(p.percentOwned)}%` : 'N/A';
  const startedPct = p.percentStarted ? `${Math.round(p.percentStarted)}%` : 'N/A';
  
  return `• ${p.fullName} (${p.position}) - Proj: ${projPoints} pts | Owned: ${ownedPct} | Started: ${startedPct}`;
}).join('\n') || 'No bench players found'}
`).join('\n')}
${expertDataSection}

ANALYSIS INSTRUCTIONS:
Using the CURRENT ROSTER DATA and EXPERT CONSENSUS RANKINGS above, provide specific recommendations by:

1. **Projected Points Analysis**: Compare each player's ESPN projected points
2. **Ownership Analysis**: Consider % owned and % started for popularity insights  
3. **Expert Validation**: Cross-reference with FantasyPros expert ranks and tiers
4. **Consensus Check**: Prioritize players with high expert consensus %
5. **Tier Comparison**: Prefer Tier 1-2 players, be cautious with Tier 5+
6. **Opportunity Identification**: Look for low-owned players with high projections

Provide SPECIFIC start/sit decisions with reasoning that references these metrics.`;

    console.log('🧠 Generating analysis with real LLM...');
    
    // Debug player data to understand projection values
    console.log('\n🔍 ========== SAMPLE PLAYER DATA DEBUG ==========');
    if (leagueData[0]?.starters?.length > 0) {
      const samplePlayer = leagueData[0].starters[0];
      console.log('Sample player:', samplePlayer.fullName);
      console.log('Projected Points:', samplePlayer.projectedPoints);
      console.log('Percent Owned:', samplePlayer.percentOwned);
      console.log('Percent Started:', samplePlayer.percentStarted);
      console.log('Raw stats data:', (samplePlayer as any).stats || 'No stats');
    }
    console.log('🔍 ========== DEBUG END ==========\n');
    
    // Log the full prompt being sent to LLM for debugging
    console.log('\n📝 ========== LLM PROMPT START ==========');
    console.log('Prompt length:', enhancedPrompt.length, 'characters');
    console.log('---');
    console.log(enhancedPrompt);
    console.log('📝 ========== LLM PROMPT END ==========\n');
    
    // Use real LLM for analysis
    const llmResponse = await llmConfig.generateResponse(enhancedPrompt);
    
    // Log the LLM response for debugging
    console.log('\n🤖 ========== LLM RESPONSE START ==========');
    console.log('Response length:', (llmResponse.content || '').length, 'characters');
    if (llmResponse.cost) {
      console.log('Estimated cost: $', llmResponse.cost.toFixed(4));
    }
    console.log('---');
    console.log(llmResponse.content || JSON.stringify(llmResponse));
    console.log('🤖 ========== LLM RESPONSE END ==========\n');

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
  
  // Extract league-specific recommendations with better fallback
  leagueData.forEach((league, index) => {
    // Try multiple patterns to find league-specific content
    let leagueText = '';
    
    // Pattern 1: Exact league name match
    const exactPattern = new RegExp(`${league.leagueName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=\\n\\n|${leagueData.map(l => l.leagueName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}|$)`, 'i');
    const exactMatch = responseText.match(exactPattern);
    
    // Pattern 2: Generic league indicators (League 1, League 2, Main, Secondary)
    const genericPatterns = [
      new RegExp(`(?:league\\s*${index + 1}|${index === 0 ? 'main|first' : 'secondary|second'})\\s*league?[\\s\\S]*?(?=\\n\\n|league\\s*\\d|$)`, 'i'),
      new RegExp(`\\b${league.leagueName.split(' ')[0]}\\b[\\s\\S]*?(?=\\n\\n|\\b(?:${leagueData.map(l => l.leagueName.split(' ')[0]).filter(n => n !== league.leagueName.split(' ')[0]).join('|')})\\b|$)`, 'i')
    ];
    
    if (exactMatch) {
      leagueText = exactMatch[0];
      console.log(`✅ Found exact match for ${league.leagueName}`);
    } else {
      // Try generic patterns
      for (const pattern of genericPatterns) {
        const genericMatch = responseText.match(pattern);
        if (genericMatch) {
          leagueText = genericMatch[0];
          console.log(`✅ Found generic match for ${league.leagueName}`);
          break;
        }
      }
    }
    
    // If no league-specific text found, use portion of the overall response
    if (!leagueText && index < leagueData.length) {
      const responseLines = responseText.split('\n').filter((line: string) => line.trim());
      const startIndex = Math.floor((responseLines.length / leagueData.length) * index);
      const endIndex = Math.floor((responseLines.length / leagueData.length) * (index + 1));
      leagueText = responseLines.slice(startIndex, endIndex).join('\n');
      console.log(`⚠️ Using portion of response for ${league.leagueName} (lines ${startIndex}-${endIndex})`);
    }
    
    if (leagueText) {
      
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
  
  // If no specific recommendations found, extract general insights with more flexible patterns
  if (insights.length === 0) {
    console.log('🔍 No league-specific insights found, trying general extraction...');
    const lines = responseText.split('\n');
    lines.forEach((line: string) => {
      const cleanLine = line.trim();
      if (cleanLine && cleanLine.length > 10 && cleanLine.length < 200) {
        // Look for actionable statements with more flexible patterns
        if (/\b(start|sit|target|pickup|trade|drop|consider|bench|play|add|waiver|claim)\b/i.test(cleanLine)) {
          // Remove bullet points and formatting
          const processedLine = cleanLine.replace(/^[•\-\*]\s*/, '').replace(/^\d+\.\s*/, '');
          if (processedLine.length > 5) {
            insights.push(processedLine);
          }
        }
      }
    });
    
    // If still no insights, try to extract any meaningful content
    if (insights.length === 0) {
      console.log('🔍 No actionable insights found, extracting any meaningful content...');
      const sentences = responseText.split(/[.!?]\s+/);
      sentences.forEach((sentence: string) => {
        const cleanSentence = sentence.trim();
        if (cleanSentence.length > 20 && cleanSentence.length < 150) {
          // Check for player names pattern (capitalized words)
          if (/[A-Z][a-z]+\s+[A-Z][a-z]+/.test(cleanSentence)) {
            insights.push(cleanSentence);
          }
        }
      });
    }
  }
  
  // More forgiving fallback - provide some insight even if extraction fails
  if (insights.length === 0) {
    console.warn(`⚠️ No actionable insights extracted from LLM response. Raw response: ${responseText.substring(0, 300)}`);
    // Instead of throwing error, provide a generic but informative message
    insights.push(`Analysis completed but no specific recommendations extracted. Check logs for details.`);
  }
  
  return {
    keyInsights: insights.slice(0, 5), // Limit for display
    recommendations: recommendations,
    confidence: insights.length > 2 ? 85 : 70,
    analysis: responseText
  };
}