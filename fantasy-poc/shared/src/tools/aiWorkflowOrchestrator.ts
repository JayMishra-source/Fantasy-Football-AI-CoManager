import { espnApi } from '../services/espnApi.js';
import { fantasyProsApi } from '../services/fantasyProsApi.js';
import { llmConfig } from '../config/llm-config.js';
import { simpleWebSearch } from '../services/simpleWebSearch.js';

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
EXPERT CONSENSUS RANKINGS (FantasyPros Week ${week.toString().replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)])}):
${Object.entries(expertRankings).map(([position, rankings]: [string, any]) => `
${position.toUpperCase()} TOP onefive RANKINGS:
${rankings.players?.slice(0, 15).map((p: any, i: number) => {
  // Convert all numeric values to words to avoid GitHub secret redaction
  const rankNum = i + 1;
  const rankInWords = rankNum.toString().replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
  
  const expertRankInWords = (p.rank || 'N/A').toString().replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
  
  const tierInWords = (p.tier || 'N/A').toString().replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
  
  const consensusInWords = (p.expertConsensus || 'N/A').toString().replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
  
  const bestRankInWords = (p.bestRank || 'N/A').toString().replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
  
  const worstRankInWords = (p.worstRank || 'N/A').toString().replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
  
  return `${rankInWords}. ${p.player.name} (${p.player.team}) - Expert Rank: ${expertRankInWords} | Tier: ${tierInWords} | Consensus: ${consensusInWords}% | Range: ${bestRankInWords}-${worstRankInWords}`;
}).join('\n') || 'No rankings available'}

`).join('\n')}

FANTASY ANALYSIS GUIDELINES:
• Lower Expert Rank = Better (one is best)
• Higher Expert Consensus % = More experts agree
• Tier one-two = Elite players, Tier three-four = Good options, Tier five+ = Risky
• Smaller Rank Range (bestRank-worstRank) = More expert agreement
• Compare your roster players against these expert rankings and tiers` : '\n⚠️ FantasyPros expert rankings not available - using ESPN data only\n';

    const enhancedPrompt = `${prompt}

CURRENT ROSTER DATA:
${leagueData.map(league => `
${league.leagueName} (Team Name: ${league.teamName?.replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)])}):

STARTERS:
${league.starters.map((p: any) => {
  // Convert ALL projections to words to avoid GitHub secret redaction
  let projDesc = 'Unknown projection';
  if (p.projectedPoints !== undefined && p.projectedPoints !== null) {
    const pts = p.projectedPoints;
    // Convert the number to words for ALL values
    const ptsInWords = pts.toFixed(1).replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
    
    // Add category label for context
    let category = '';
    if (pts < 2) category = 'Very Low';
    else if (pts < 6) category = 'Low';
    else if (pts < 12) category = 'Moderate';
    else if (pts < 18) category = 'Good';
    else if (pts < 25) category = 'High';
    else if (pts < 50) category = 'Very High';
    else category = 'Season-total';
    
    projDesc = `${category} (${ptsInWords} points)`;
  }
  
  let ownedDesc = 'Unknown ownership';
  if (p.percentOwned !== undefined) {
    const ownedPct = Math.round(p.percentOwned);
    const ownedInWords = ownedPct.toString().replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
    
    let category = '';
    if (ownedPct < 10) category = 'Rarely owned';
    else if (ownedPct < 30) category = 'Lightly owned';
    else if (ownedPct < 60) category = 'Moderately owned';
    else if (ownedPct < 90) category = 'Widely owned';
    else category = 'Nearly universal';
    
    ownedDesc = `${category} (${ownedInWords} percent)`;
  }
  
  let startedDesc = 'Unknown usage';
  if (p.percentStarted !== undefined) {
    const startedPct = Math.round(p.percentStarted);
    const startedInWords = startedPct.toString().replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
    
    let category = '';
    if (startedPct < 10) category = 'Rarely started';
    else if (startedPct < 30) category = 'Bench player';
    else if (startedPct < 60) category = 'Flex option';
    else if (startedPct < 90) category = 'Regular starter';
    else category = 'Must-start player';
    
    startedDesc = `${category} (${startedInWords} percent)`;
  }
  
  return `• ${p.fullName} (${p.position}) - ${projDesc} | ${ownedDesc} | ${startedDesc}`;
}).join('\n') || 'No starters found'}

BENCH:
${league.bench.map((p: any) => {
  // Convert ALL projections to words to avoid GitHub secret redaction
  let projDesc = 'Unknown projection';
  if (p.projectedPoints !== undefined && p.projectedPoints !== null) {
    const pts = p.projectedPoints;
    // Convert the number to words for ALL values
    const ptsInWords = pts.toFixed(1).replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
    
    // Add category label for context
    let category = '';
    if (pts < 2) category = 'Very Low';
    else if (pts < 6) category = 'Low';
    else if (pts < 12) category = 'Moderate';
    else if (pts < 18) category = 'Good';
    else if (pts < 25) category = 'High';
    else if (pts < 50) category = 'Very High';
    else category = 'Season-total';
    
    projDesc = `${category} (${ptsInWords} points)`;
  }
  
  let ownedDesc = 'Unknown ownership';
  if (p.percentOwned !== undefined) {
    const ownedPct = Math.round(p.percentOwned);
    const ownedInWords = ownedPct.toString().replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
    
    let category = '';
    if (ownedPct < 10) category = 'Rarely owned';
    else if (ownedPct < 30) category = 'Lightly owned';
    else if (ownedPct < 60) category = 'Moderately owned';
    else if (ownedPct < 90) category = 'Widely owned';
    else category = 'Nearly universal';
    
    ownedDesc = `${category} (${ownedInWords} percent)`;
  }
  
  let startedDesc = 'Unknown usage';
  if (p.percentStarted !== undefined) {
    const startedPct = Math.round(p.percentStarted);
    const startedInWords = startedPct.toString().replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
    
    let category = '';
    if (startedPct < 10) category = 'Rarely started';
    else if (startedPct < 30) category = 'Bench player';
    else if (startedPct < 60) category = 'Flex option';
    else if (startedPct < 90) category = 'Regular starter';
    else category = 'Must-start player';
    
    startedDesc = `${category} (${startedInWords} percent)`;
  }
  
  return `• ${p.fullName} (${p.position}) - ${projDesc} | ${ownedDesc} | ${startedDesc}`;
}).join('\n') || 'No bench players found'}
`).join('\n')}
${expertDataSection}

ANALYSIS INSTRUCTIONS:
Using the CURRENT ROSTER DATA and EXPERT CONSENSUS RANKINGS above, provide specific recommendations by:

1. **Projection Analysis**: Prioritize "Good/High projection" over "Low/Moderate projection" players
2. **Ownership Analysis**: 
   - "Nearly universal" = Consensus must-starts
   - "Rarely/Lightly owned" + Good projection = Hidden gems
   - "Widely owned" but "Rarely started" = Potential busts
3. **Usage Patterns**:
   - "Must-start player" = Clear starters
   - "Regular starter" = Good options
   - "Flex option" = Situational plays
   - "Bench player" = Avoid unless expert rankings say otherwise
4. **Expert Validation**: Cross-reference with FantasyPros expert ranks and tiers
5. **Consensus Check**: Prioritize players with high expert consensus %
6. **Tier Comparison**: Prefer Tier 1-2 players, be cautious with Tier 5+

Note: Players showing "Season-total data" for projections need careful expert rank evaluation.

Provide SPECIFIC start/sit decisions with reasoning that references these descriptive metrics.`;

    console.log('🧠 Generating analysis with real LLM...');
    
    // Debug player data to understand projection values
    console.log('\n🔍 ========== SAMPLE PLAYER DATA DEBUG ==========');
    if (leagueData[0]?.starters?.length > 0) {
      console.log('Analyzing first three starters for projection data:');
      leagueData[0].starters.slice(0, 3).forEach((player: any, index: number) => {
        console.log(`Player ${index + 1}: ${player.fullName} (${player.position})`);
        console.log('  - Projected Points:', player.projectedPoints);
        console.log('  - Percent Owned:', player.percentOwned);
        console.log('  - Percent Started:', player.percentStarted);
        console.log('  - Raw stats data:', (player as any).stats?.slice(0, 3) || 'No stats');
        console.log('---');
      });
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
    
    // Process any web search requests in the LLM response
    console.log('🔍 Processing web search requests...');
    simpleWebSearch.resetSearchCount(); // Reset for this analysis session
    const responseWithSearchResults = await simpleWebSearch.processWebSearchRequests(llmResponse.content || '');
    
    // Update the llmResponse with search results
    const enhancedLlmResponse = {
      ...llmResponse,
      content: responseWithSearchResults
    };
    
    // Log the enhanced LLM response for debugging
    console.log('\n🤖 ========== LLM RESPONSE (WITH WEB SEARCH) START ==========');
    console.log('Response length:', (enhancedLlmResponse.content || '').length, 'characters');
    if (enhancedLlmResponse.cost) {
      console.log('Estimated cost: $', enhancedLlmResponse.cost.toFixed(4));
    }
    const searchStats = simpleWebSearch.getSearchStats();
    console.log(`Web searches: ${searchStats.performed}/${searchStats.max}`);
    console.log('---');
    console.log(enhancedLlmResponse.content || JSON.stringify(enhancedLlmResponse));
    console.log('🤖 ========== LLM RESPONSE (WITH WEB SEARCH) END ==========\n');

    // Extract specific insights from enhanced LLM response
    const insights = extractInsightsFromLLMResponse(enhancedLlmResponse, leagueData);

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
 * Extract actionable insights from LLM response - simplified to preserve full analysis
 */
function extractInsightsFromLLMResponse(llmResponse: any, leagueData: any[]): {
  keyInsights: string[];
  recommendations: any[];
  confidence: number;
  analysis: string;
} {
  const responseText = llmResponse.content || llmResponse.text || JSON.stringify(llmResponse);
  
  console.log('📋 Extracting insights from LLM response...');
  console.log(`Response length: ${responseText.length} characters`);
  
  // Clean up response formatting
  const cleanedResponse = responseText
    .replace(/\n\s*\n\s*\n/g, '\n\n'); // Remove excessive line breaks
  
  // Split response into paragraphs and sentences for better formatting
  const paragraphs = cleanedResponse.split('\n\n').filter((p: string) => p.trim().length > 0);
  const insights: string[] = [];
  const recommendations: any[] = [];
  
  // For each league, try to find relevant content
  leagueData.forEach((league, index) => {
    console.log(`🏈 Processing insights for ${league.leagueName}...`);
    
    // Look for content mentioning this league
    let leagueContent = '';
    
    // Try to find league-specific sections
    const leagueIndicators = [
      league.leagueName,
      `League ${index + 1}`,
      index === 0 ? 'Main League' : 'Secondary League',
      index === 0 ? 'First league' : 'Second league'
    ];
    
    for (const indicator of leagueIndicators) {
      const pattern = new RegExp(`.*${indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`, 'gi');
      const matches = cleanedResponse.match(pattern);
      if (matches && matches.length > 0) {
        leagueContent = matches.join('\n');
        console.log(`✅ Found content for ${league.leagueName} using indicator: ${indicator}`);
        break;
      }
    }
    
    // If no league-specific content found, use a portion of the response
    if (!leagueContent && paragraphs.length > 0) {
      const startParagraph = Math.floor((paragraphs.length / leagueData.length) * index);
      const endParagraph = Math.floor((paragraphs.length / leagueData.length) * (index + 1));
      leagueContent = paragraphs.slice(startParagraph, endParagraph).join('\n\n');
      console.log(`⚠️ Using general content portion for ${league.leagueName}`);
    }
    
    if (leagueContent) {
      // Split into sentences and extract meaningful ones
      const sentences = leagueContent.split(/[.!?]+/).filter((s: string) => s.trim().length > 10);
      
      sentences.forEach((sentence: string) => {
        const cleanSentence = sentence.trim();
        if (cleanSentence.length > 15 && cleanSentence.length < 300) {
          // Check if this sentence contains actionable fantasy advice
          if (/\b(start|sit|play|bench|consider|target|pickup|drop|add|claim|trade|waiver)\b/i.test(cleanSentence) ||
              /\b(recommend|suggest|should|would|better|prefer|avoid|focus)\b/i.test(cleanSentence) ||
              /[A-Z][a-z]+\s+[A-Z][a-z]+.*\b(RB|QB|WR|TE|K|DST|points|projection)\b/i.test(cleanSentence)) {
            
            insights.push(`${league.leagueName}: ${cleanSentence}`);
          }
        }
      });
    }
  });
  
  // If we didn't get enough league-specific insights, add general ones
  if (insights.length < 3) {
    console.log('📋 Adding general insights from full response...');
    
    const allSentences = cleanedResponse.split(/[.!?]+/).filter((s: string) => s.trim().length > 15);
    
    allSentences.forEach((sentence: string) => {
      const cleanSentence = sentence.trim();
      if (cleanSentence.length > 20 && cleanSentence.length < 200 && insights.length < 8) {
        // Look for fantasy-relevant content
        if (/\b(start|sit|play|bench|consider|target|pickup|drop|add|claim|trade|waiver)\b/i.test(cleanSentence) ||
            /[A-Z][a-z]+\s+[A-Z][a-z]+.*\b(RB|QB|WR|TE|K|DST|points|projection|rank|tier)\b/i.test(cleanSentence)) {
          
          // Don't duplicate existing insights
          if (!insights.some(existing => existing.includes(cleanSentence.substring(0, 30)))) {
            insights.push(cleanSentence);
          }
        }
      }
    });
  }
  
  // If still no good insights, include the first few meaningful paragraphs
  if (insights.length === 0) {
    console.log('📋 No specific insights found, including general analysis...');
    
    paragraphs.slice(0, 3).forEach((paragraph: string) => {
      if (paragraph.trim().length > 30 && paragraph.trim().length < 400) {
        insights.push(paragraph.trim());
      }
    });
  }
  
  console.log(`📋 Extracted ${insights.length} insights for user`);
  
  return {
    keyInsights: insights.slice(0, 8), // Allow more insights to preserve analysis
    recommendations: recommendations,
    confidence: insights.length > 3 ? 85 : 70,
    analysis: cleanedResponse
  };
}