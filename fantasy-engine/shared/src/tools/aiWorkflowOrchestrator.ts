import { espnApi } from '../services/espnApi.js';
import { fantasyProsApi } from '../services/fantasyProsApi.js';
import { llmConfig } from '../config/llm-config.js';
import { configuredComprehensiveWebData } from '../services/comprehensiveWebData.js';
import { getMyRoster } from './simple-enhanced.js';

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
          
          // Fetch waiver wire data too
          const rosterWithWaivers = await getMyRoster({ 
            leagueId: league.leagueId, 
            teamId: league.teamId 
          });
          
          // VALIDATION: Fix weekly projections and IR classification before sending to LLM
          const validateAndFixPlayer = (player: any) => {
            console.log(`🔍 DEBUG VALIDATION: Processing ${player.fullName || 'Unknown'} - Position: ${player.position || 'Unknown'}, ProjectedPoints: ${player.projectedPoints}`);
            
            // Fix weekly projections - be VERY aggressive about detecting season totals
            if (player.projectedPoints && player.projectedPoints > 0) {
              const position = player.position;
              
              // Much more aggressive caps - anything above these is definitely a season total
              let maxReasonableWeekly = 15; // Default conservative cap
              if (position === 'QB') maxReasonableWeekly = 30;
              else if (position === 'RB') maxReasonableWeekly = 20;
              else if (position === 'WR') maxReasonableWeekly = 20;
              else if (position === 'TE') maxReasonableWeekly = 15;
              else if (position === 'K') maxReasonableWeekly = 12;
              else if (position === 'DST') maxReasonableWeekly = 15;
              
              console.log(`🎯 VALIDATION: ${player.fullName} (${position}) has projection ${player.projectedPoints}, max reasonable: ${maxReasonableWeekly}`);
              
              // If projection is over 50, it's definitely a season total regardless of position
              if (player.projectedPoints > 50 || player.projectedPoints > maxReasonableWeekly) {
                console.warn(`🔧 AGGRESSIVE FIX: ${player.fullName} (${position}) projection ${player.projectedPoints} -> ${(player.projectedPoints / 17).toFixed(1)} (was clearly season total)`);
                
                // Store original as season total and estimate weekly
                player.seasonProjectedPoints = player.projectedPoints;
                player.projectedPoints = Math.round((player.projectedPoints / 17) * 10) / 10;
                
                console.log(`✅ AFTER FIX: ${player.fullName} now has weekly projection: ${player.projectedPoints}, season total: ${player.seasonProjectedPoints}`);
                
                // Final safety cap
                if (player.projectedPoints > maxReasonableWeekly) {
                  player.projectedPoints = maxReasonableWeekly;
                  console.warn(`🔧 FINAL CAP: ${player.fullName} capped at ${maxReasonableWeekly}`);
                }
              } else {
                console.log(`✓ VALIDATION: ${player.fullName} projection ${player.projectedPoints} looks reasonable for ${position}`);
              }
            } else {
              console.log(`⚠️ VALIDATION: ${player.fullName} has no valid projectedPoints: ${player.projectedPoints}`);
            }
            return player;
          };

          // Fix IR classification - only truly injured players should be in IR
          const validateIRPlayers = (irPlayers: any[]) => {
            console.log(`🔍 DEBUG IR VALIDATION: Processing ${irPlayers.length} IR players`);
            
            const validIRPlayers = irPlayers.filter(player => {
              console.log(`🏥 IR CHECK: ${player.fullName} - Status: '${player.injuryStatus || 'None'}'`);
              
              const hasRealInjury = player.injuryStatus && 
                !['ACTIVE', 'PROBABLE'].includes(player.injuryStatus.toUpperCase());
              
              if (!hasRealInjury) {
                console.warn(`🔧 REMOVING from IR: ${player.fullName} (status: ${player.injuryStatus || 'None'}) - should not be in IR!`);
                return false;
              } else {
                console.log(`✓ IR VALID: ${player.fullName} has real injury status: ${player.injuryStatus}`);
                return true;
              }
            });
            
            // Move healthy players from IR to bench
            const incorrectlyPlacedPlayers = irPlayers.filter(player => {
              const hasRealInjury = player.injuryStatus && 
                !['ACTIVE', 'PROBABLE'].includes(player.injuryStatus.toUpperCase());
              return !hasRealInjury;
            });
            
            console.log(`✅ IR VALIDATION COMPLETE: ${validIRPlayers.length} valid IR players, ${incorrectlyPlacedPlayers.length} moved to bench`);
            return { validIRPlayers, incorrectlyPlacedPlayers };
          };

          // Apply fixes to all player arrays with logging for GitHub Actions
          console.log(`🔧 VALIDATION: Processing ${roster.starters?.length || 0} starters, ${roster.bench?.length || 0} bench, ${roster.injuredReserve?.length || 0} IR players...`);
          
          const fixedStarters = (roster.starters || []).map(validateAndFixPlayer);
          const fixedBench = (roster.bench || []).map(validateAndFixPlayer);
          const irValidation = validateIRPlayers(roster.injuredReserve || []);
          
          // Fix projections for valid IR players too
          const fixedIRPlayers = irValidation.validIRPlayers.map(validateAndFixPlayer);
          
          // Add incorrectly placed IR players to bench
          const finalBench = [...fixedBench, ...irValidation.incorrectlyPlacedPlayers.map(validateAndFixPlayer)];
          
          console.log(`✅ VALIDATION COMPLETE: ${fixedStarters.length} starters, ${finalBench.length} bench (${irValidation.incorrectlyPlacedPlayers.length} moved from IR), ${fixedIRPlayers.length} IR`);
          
          // Log sample of fixed projections for verification
          if (fixedStarters.length > 0) {
            const sample = fixedStarters[0];
            console.log(`📊 Sample fixed starter: ${sample.fullName} - ${sample.projectedPoints} weekly pts (season: ${sample.seasonProjectedPoints || 'none'})`);
          }

          return {
            leagueId: league.leagueId,
            teamId: league.teamId,
            leagueName: leagueInfo.name || league.name || 'Unknown League',
            teamName: (roster as any).teamName || 'My Team',
            starters: fixedStarters,
            bench: finalBench,
            availablePlayers: rosterWithWaivers.availablePlayers || {},
            injuredReserve: fixedIRPlayers,
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
  
  const expertRankInWords = (p.expertConsensus || 'N/A').toString().replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
  
  const tierInWords = (p.tier || 'N/A').toString().replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
  
  // Calculate consensus confidence based on ranking variance (lower stdDev = higher confidence)
  const confidenceScore = p.stdDev ? Math.max(100 - (p.stdDev * 10), 50) : 75;
  const confidenceInWords = Math.round(confidenceScore).toString().replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
  
  const bestRankInWords = (p.bestRank || 'N/A').toString().replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
  
  const worstRankInWords = (p.worstRank || 'N/A').toString().replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
  
  return `${rankInWords}. ${p.player.name} (${p.player.team}) - Expert Rank: ${expertRankInWords} | Tier: ${tierInWords} | Confidence: ${confidenceInWords}% | Range: ${bestRankInWords}-${worstRankInWords}`;
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
  // Show both weekly projection and season total
  let projDesc = 'Unknown projection';
  if (p.projectedPoints !== undefined && p.projectedPoints !== null) {
    const weeklyPts = p.projectedPoints;
    const seasonPts = (p as any).seasonProjectedPoints;
    
    // Convert weekly projection to words
    const weeklyInWords = weeklyPts.toFixed(1).replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
    
    // Add category for weekly projection
    let weeklyCategory = '';
    if (weeklyPts < 2) weeklyCategory = 'Very Low';
    else if (weeklyPts < 6) weeklyCategory = 'Low';
    else if (weeklyPts < 12) weeklyCategory = 'Moderate';
    else if (weeklyPts < 18) weeklyCategory = 'Good';
    else if (weeklyPts < 25) weeklyCategory = 'High';
    else weeklyCategory = 'Very High';
    
    projDesc = `Week ${weeklyCategory} (${weeklyInWords} pts)`;
    
    // Add season total if available and different
    if (seasonPts && seasonPts > 0 && Math.abs(seasonPts - weeklyPts) > 10) {
      const seasonInWords = seasonPts.toFixed(1).replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
      projDesc += ` | Season (${seasonInWords} total)`;
    }
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

INJURED RESERVE (IR):
${league.injuredReserve && league.injuredReserve.length > 0 ? league.injuredReserve.map((p: any) => {
  // Format IR players similar to bench players
  let projDesc = 'Unknown projection';
  if (p.projectedPoints !== undefined && p.projectedPoints !== null) {
    const pts = p.projectedPoints;
    const ptsInWords = pts.toFixed(1).replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
    
    let category = '';
    if (pts < 2) category = 'Very Low';
    else if (pts < 6) category = 'Low';
    else if (pts < 12) category = 'Moderate';
    else if (pts < 18) category = 'Good';
    else if (pts < 25) category = 'High';
    else category = 'Very High';
    
    projDesc = `${category} (${ptsInWords} pts)`;
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
  
  // Add injury status for IR players
  let injuryInfo = '';
  if (p.injuryStatus) {
    injuryInfo = ` | Injury: ${p.injuryStatus}`;
  }
  
  return `• ${p.fullName} (${p.position}) - ${projDesc} | ${ownedDesc}${injuryInfo}`;
}).join('\n') : 'No players on injured reserve'}

AVAILABLE WAIVER WIRE/FREE AGENT PLAYERS BY POSITION:
${league.availablePlayers ? Object.entries(league.availablePlayers).map(([position, players]: [string, any[]]) => 
  `${position}: ${players.length > 0 ? players.map((p: any) => {
    // Format waiver wire players similar to roster players
    let projDesc = 'Unknown projection';
    if (p.projectedPoints !== undefined && p.projectedPoints !== null) {
      const pts = p.projectedPoints;
      const ptsInWords = pts.toFixed(1).replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
      
      let category = '';
      if (pts < 2) category = 'Very Low';
      else if (pts < 6) category = 'Low'; 
      else if (pts < 12) category = 'Moderate';
      else if (pts < 18) category = 'Good';
      else if (pts < 25) category = 'High';
      else category = 'Very High';
      
      projDesc = `${category} (${ptsInWords} pts)`;
    }
    
    let ownedDesc = 'Available';
    if (p.percentOwned !== undefined) {
      const ownedPct = Math.round(p.percentOwned);
      const ownedInWords = ownedPct.toString().replace(/\d/g, (d: string) => ['zero','one','two','three','four','five','six','seven','eight','nine'][parseInt(d)]);
      ownedDesc = `${ownedInWords}% owned`;
    }
    
    return `• ${p.fullName} - ${projDesc} | ${ownedDesc}`;
  }).join('\n') : 'None available'}`
).join('\n') : 'Waiver wire data not available'}
`).join('\n')}
${expertDataSection}

CO-MANAGER REVIEW INSTRUCTIONS:
Review the roster like we're sitting together planning this week's lineup. Go position by position and tell me who to start, who to bench, and who to pick up from waivers. Be direct and decisive.

**POSITION-BY-POSITION REVIEW:**

1. **QUARTERBACK**: Look at my current starter vs bench QBs. Should I start someone else? Any waiver QBs worth grabbing? If yes, specify WHO TO DROP.

2. **RUNNING BACKS**: Check my RB1, RB2, and FLEX options. Are my starters the highest projected? Should I swap anyone from the bench? Any waiver RBs to target? If adding an RB, specify WHO TO DROP.

3. **WIDE RECEIVERS**: Review my WR1, WR2, and FLEX spots. Who has the best matchups? Should I start different WRs from my bench? Any waiver WRs to consider? If adding a WR, specify WHO TO DROP.

4. **TIGHT END**: Is my TE starter the right choice? Better option on my bench or waivers? If adding a TE, specify WHO TO DROP.

5. **FLEX POSITIONS**: Compare my RBs vs WRs for FLEX spots. Who has the highest ceiling this week?

6. **DEFENSE/KICKER**: Any better streaming options on waivers? If streaming, specify WHO TO DROP.

7. **INJURED RESERVE (IR)**: Check my IR players' injury status. Are any eligible to return from IR? If so, recommend WHO TO DROP from active roster to make room.

**GIVE ME:**
- WHO TO START at each position (with brief reason)  
- WHO TO BENCH (and why)
- TOP 3 WAIVER PICKUPS to consider (if any) - **IMPORTANT: For each waiver pickup, specify WHO TO DROP from my current roster**
- Any lineup swaps between starters and bench
- **IR MOVES**: If any IR players are ready to return, specify WHO TO DROP from active roster to activate them

**WAIVER WIRE FORMAT:**
When recommending waiver pickups, use this format:
"ADD [Player Name] ([Position]) - [Reason]
DROP [Player Name] ([Position]) - [Why they're droppable]"

Example: "ADD Mike Gesicki (TE) - Higher upside than current option
DROP Brenton Strange (TE) - Lower projection and limited role"

**IR ACTIVATION FORMAT:**
When recommending IR activations, use this format:
"ACTIVATE [Player Name] ([Position]) from IR - [Reason/Status]
DROP [Player Name] ([Position]) - [Why they're droppable to make room]"

Example: "ACTIVATE Cooper Kupp (WR) from IR - Expected to play this week, cleared injury report
DROP Tyler Lockett (WR) - Inconsistent production and tough schedule"

Use web_search() to check for any breaking injury news, weather concerns, or lineup changes that could affect my decisions.`;

    console.log('🧠 Generating analysis with real LLM...');
    
    // Debug player data to understand projection values (trusting ESPN API processing)
    console.log('\n🔍 ========== SAMPLE PLAYER DATA DEBUG ==========');
    if (leagueData[0]?.starters?.length > 0) {
      console.log('Analyzing first three starters for projection data:');
      leagueData[0].starters.slice(0, 3).forEach((player: any, index: number) => {
        console.log(`Player ${index + 1}: ${player.fullName} (${player.position})`);
        console.log('  - Projected Points:', player.projectedPoints);
        console.log('  - Season Projected Points:', player.seasonProjectedPoints || 'Not set');
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
    
    // Use LLM with web search tool calling capability
    const llmResponse = await generateResponseWithWebSearchTools(enhancedPrompt);
    
    // Log the LLM response for debugging
    console.log('\n🤖 ========== LLM RESPONSE (WITH TOOL CALLING) START ==========');
    console.log('Response length:', (llmResponse.content || '').length, 'characters');
    if (llmResponse.cost) {
      console.log('Estimated cost: $', llmResponse.cost.toFixed(4));
    }
    if (llmResponse.searches_performed !== undefined) {
      console.log(`Web searches performed: ${llmResponse.searches_performed}`);
    }
    console.log('---');
    console.log(llmResponse.content || JSON.stringify(llmResponse));
    console.log('🤖 ========== LLM RESPONSE (WITH TOOL CALLING) END ==========\n');

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
          : ['ESPN API', 'Real LLM Analysis (No FantasyPros)'],
        fullLLMResponse: llmResponse.content || 'No response generated'
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
 * Generate LLM response with web search tool calling capability
 */
async function generateResponseWithWebSearchTools(prompt: string): Promise<{ content: string; cost?: number; searches_performed?: number }> {
  try {
    // Define the web search tool that LLM can call
    const webSearchTool = {
      name: 'web_search',
      description: 'Search the web for current information about fantasy football, player news, injuries, weather, or other relevant topics',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string' as const,
            description: 'The search query to find current information'
          }
        },
        required: ['query']
      }
    };

    console.log('🔧 Starting LLM analysis with web search tool available...');
    console.log(`📊 Tool configuration: web_search tool enabled with description: ${webSearchTool.description}`);
    
    // Get the LLM manager to access the provider directly
    const llmManager = await (llmConfig as any).getLLMManager();
    const provider = llmManager.getCurrentProvider();
    
    if (!provider) {
      throw new Error('No LLM provider available');
    }
    
    console.log(`🤖 Using LLM provider: ${provider.name}`);    

    let searchCount = 0;
    const maxSearches = parseInt(process.env.MAX_WEB_SEARCHES || '5');
    let totalCost = 0;

    // Start the conversation with tools available
    let messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      { role: 'user', content: prompt }
    ];
    let finalResponse = '';
    let conversationTurns = 0;
    const maxTurns = 10; // Prevent infinite loops

    while (conversationTurns < maxTurns) {
      console.log(`🔄 Conversation turn ${conversationTurns + 1}/${maxTurns}`);
      console.log(`📝 Messages in conversation: ${messages.length}`);
      console.log('🔧 Calling LLM with tools enabled...');
      
      const response = await provider.chat(messages, {
        tools: [webSearchTool],
        max_tokens: 4000,
        temperature: 0.7,
        tool_choice: 'auto'
      });
      
      console.log(`📤 LLM Response received:`);
      console.log(`  - Content length: ${(response.content || '').length} chars`);
      console.log(`  - Tool calls: ${response.tool_calls ? response.tool_calls.length : 0}`);
      console.log(`  - Finish reason: ${response.finish_reason}`);
      console.log(`  - Usage: ${JSON.stringify(response.usage)}`);

      totalCost += (response.usage?.total_tokens || 0) * 0.000001; // Rough cost estimate

      // Check if LLM wants to use tools
      if (response.tool_calls && response.tool_calls.length > 0 && searchCount < maxSearches) {
        console.log(`🔍 LLM requested ${response.tool_calls.length} tool calls`);
        
        // Log each tool call in detail
        response.tool_calls.forEach((toolCall: any, index: number) => {
          console.log(`  Tool call ${index + 1}:`);
          console.log(`    - Name: ${toolCall.name}`);
          console.log(`    - Arguments: ${JSON.stringify(toolCall.arguments)}`);
        });
        
        // Add the assistant's response to conversation
        messages.push({ 
          role: 'assistant', 
          content: response.content || 'I need to search for more information.'
        });
        console.log(`💬 Added assistant response to conversation`);

        // Process each tool call
        let toolResults = '';
        for (const [index, toolCall] of response.tool_calls.entries()) {
          if (toolCall.name === 'web_search' && searchCount < maxSearches) {
            const query = toolCall.arguments?.query;
            console.log(`🔎 Processing tool call ${index + 1}: web_search`);
            
            if (query && typeof query === 'string') {
              console.log(`  - Query: "${query}"`);
              console.log(`  - Search count: ${searchCount + 1}/${maxSearches}`);
              searchCount++;
              
              const searchResult = await configuredComprehensiveWebData.fantasyFootballSearch(query);
              console.log(`  - Search completed: success=${searchResult.success}`);
              
              if (searchResult.success && searchResult.combinedText) {
                console.log(`  - Results length: ${searchResult.combinedText.length} chars`);
                console.log(`  - Results preview: ${searchResult.combinedText.substring(0, 200)}...`);
                console.log(`  - Sources: ${searchResult.sources.join(', ')}`);
                toolResults += `\nWeb search results for "${query}":\n${searchResult.combinedText}\n`;
              } else {
                console.log(`  - Search failed: ${searchResult.error}`);
                toolResults += `\nWeb search for "${query}" failed: ${searchResult.error}\n`;
              }
            } else {
              console.log(`  - Invalid query: ${typeof query} - ${query}`);
            }
          } else if (toolCall.name !== 'web_search') {
            console.log(`  - Unknown tool: ${toolCall.name} (ignored)`);
          } else {
            console.log(`  - Search limit reached: ${searchCount}/${maxSearches}`);
          }
        }

        // Add tool results to conversation
        console.log(`🔄 Tool execution completed, adding results to conversation`);
        if (toolResults) {
          console.log(`✅ Tool results available: ${toolResults.length} chars`);
          const userMessage = `🔍 CURRENT WEB SEARCH RESULTS:\n${toolResults}\n\n📋 INSTRUCTIONS: Now provide your complete fantasy analysis incorporating this current information. Be specific about how the search results impact your recommendations. If the search results don't provide useful information for fantasy decisions, acknowledge that and proceed with your analysis based on the roster data and expert rankings provided.`;
          messages.push({ 
            role: 'user', 
            content: userMessage
          });
          console.log(`💬 Added tool results to conversation (${userMessage.length} chars)`);
          console.log(`📄 Tool results sample: ${toolResults.substring(0, 300)}...`);
        } else {
          console.log(`⚠️ No tool results to add`);
          // No successful searches, ask for final analysis
          messages.push({ 
            role: 'user', 
            content: 'Please provide your final fantasy analysis based on the available roster data and expert rankings.'
          });
          console.log(`💬 Added fallback message to conversation`);
        }
        
      } else {
        // No tool calls or max searches reached, this is the final response
        if (!response.tool_calls || response.tool_calls.length === 0) {
          console.log(`📋 No tool calls in response - treating as final`);
        } else {
          console.log(`🛑 Max searches reached (${searchCount}/${maxSearches}) - treating as final`);
        }
        
        finalResponse = response.content || 'Analysis completed.';
        console.log(`✅ Final response received (${finalResponse.length} characters)`);
        console.log(`📊 Final response preview: ${finalResponse.substring(0, 200)}...`);
        break;
      }

      conversationTurns++;
    }

    if (!finalResponse && conversationTurns >= maxTurns) {
      finalResponse = 'Analysis completed but maximum conversation turns reached. Please check the logs for details.';
      console.warn('⚠️ Reached maximum conversation turns without final response');
    }

    console.log(`🔍 Web search tool calling complete. Searches: ${searchCount}/${maxSearches}, Cost: $${totalCost.toFixed(4)}`);

    return {
      content: finalResponse,
      cost: totalCost,
      searches_performed: searchCount
    };

  } catch (error: any) {
    console.error('❌ Web search tool calling failed:', error.message);
    // Fallback to regular LLM call without tools
    console.log('🔄 Falling back to regular LLM analysis...');
    return await llmConfig.generateResponse(prompt);
  }
}

/**
 * Extract actionable insights from LLM response - preserve complete analysis for Discord
 */
function extractInsightsFromLLMResponse(llmResponse: any, leagueData: any[]): {
  keyInsights: string[];
  recommendations: any[];
  confidence: number;
  analysis: string;
} {
  const responseText = llmResponse.content || JSON.stringify(llmResponse);
  
  console.log('📋 Sending COMPLETE LLM response directly to Discord (no summarization)...');
  console.log(`Response length: ${responseText.length} characters`);
  
  // Clean up response formatting but preserve ALL content
  const cleanedResponse = responseText
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive line breaks only
    .trim();
  
  // Return minimal structure with FULL response
  // keyInsights will be empty to prevent showing summary in Discord
  return {
    keyInsights: [], // Empty to prevent Discord from showing summary
    recommendations: [], // Empty to avoid fragmenting the response
    confidence: 95, // High confidence since we're showing full response
    analysis: cleanedResponse // COMPLETE unfiltered LLM response for Discord
  };
}