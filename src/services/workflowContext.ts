import { WorkflowContext, WorkflowTask, LeagueTeamInfo, LLMWorkflowPrompt } from '../types/workflow.js';
import { espnApi } from './espnApi.js';

export class WorkflowContextBuilder {
  
  /**
   * Build comprehensive context for LLM workflow analysis
   */
  async buildContext(
    task: WorkflowTask,
    leagues: LeagueTeamInfo[],
    week: number,
    previousResults?: any
  ): Promise<WorkflowContext> {
    
    // Enrich league info with names
    const enrichedLeagues = await Promise.all(
      leagues.map(async (league) => {
        try {
          const leagueInfo = await espnApi.getLeagueInfo(league.leagueId);
          const roster = await espnApi.getTeamRoster(league.leagueId, league.teamId);
          
          return {
            ...league,
            leagueName: leagueInfo.name,
            teamName: roster.teamName
          };
        } catch (error) {
          console.warn(`Failed to enrich league ${league.leagueId}:`, error);
          return league;
        }
      })
    );

    return {
      week,
      leagues: enrichedLeagues,
      task,
      previousResults,
      additionalContext: {
        // TODO: Add weather, news, injury data integrations
      }
    };
  }

  /**
   * Generate LLM prompts based on workflow context
   */
  generatePrompts(context: WorkflowContext, userPrompt: string): LLMWorkflowPrompt {
    const systemPrompt = this.buildSystemPrompt(context);
    const enhancedUserPrompt = this.buildUserPrompt(context, userPrompt);
    const availableTools = this.getAvailableTools(context.task);

    return {
      systemPrompt,
      userPrompt: enhancedUserPrompt,
      availableTools,
      context
    };
  }

  private buildSystemPrompt(context: WorkflowContext): string {
    const basePrompt = `You are an elite fantasy football AI co-manager with deep expertise in:
- NFL player analysis and projections
- Matchup evaluation and game script analysis  
- Injury impact assessment and risk management
- Waiver wire strategy and FAAB optimization
- Multi-league portfolio management
- Advanced fantasy football analytics

CRITICAL: You have access to powerful fantasy football tools that you MUST use to make informed decisions. 
Never provide analysis without first gathering data using the available tools.

Available Tools for Analysis:
- get_roster: Get current roster and player details
- analyze_roster: Analyze team composition and strengths/weaknesses  
- optimize_lineup: Generate optimal lineup recommendations
- find_waiver_targets: Find and rank available waiver wire players
- analyze_player: Deep dive analysis on specific players
- get_fantasypros_rankings: Get expert consensus rankings (when available)

WORKFLOW REQUIREMENT: Always start by using get_roster for each league, then use additional tools based on your analysis needs.

Current Context:
- Week: ${context.week}
- Task: ${context.task}
- Managing ${context.leagues.length} teams across different leagues
- Season phase: ${this.getSeasonPhase(context.week)}

League Information:
${context.leagues.map(league => 
  `- ${league.leagueName || 'League ' + league.leagueId}: ${league.teamName || 'Team ' + league.teamId}`
).join('\n')}`;

    return basePrompt + '\n\n' + this.getTaskSpecificSystemPrompt(context.task, context.week);
  }

  private getTaskSpecificSystemPrompt(task: WorkflowTask, week: number): string {
    switch (task) {
      case 'thursday_optimization':
        return `THURSDAY LINEUP OPTIMIZATION (Week ${week}):
Your goal is to set optimal lineups 2+ days before games start. Focus on:

1. INJURY ANALYSIS: Thoroughly evaluate all questionable/doubtful players
2. THURSDAY NIGHT GAMES: Special attention to TNF players and their impact
3. WEATHER FORECASTING: Consider outdoor games with poor weather predictions
4. MATCHUP EVALUATION: Analyze opponent defenses and expected game scripts
5. BYE WEEK MANAGEMENT: Handle bye weeks strategically
6. CEILING vs FLOOR: Balance upside potential with consistency needs

Key Principles:
- Be proactive with injury-prone players
- Consider both leagues holistically for strategic alignment
- Prioritize players with clear roles and target share
- Factor in rest advantages and short-week disadvantages
- Use expert consensus data when available (FantasyPros)`;

      case 'sunday_check':
        return `SUNDAY FINAL ADJUSTMENTS (Week ${week}):
Your goal is last-minute lineup optimization before 1pm ET games. Focus on:

1. INJURY UPDATES: Process inactives lists and late-breaking news
2. WEATHER CHANGES: Updated forecasts for game-day conditions  
3. LINEUP PIVOT OPPORTUNITIES: Leverage against less-informed opponents
4. START/SIT BORDERLINE CALLS: Make confident decisions on close calls
5. GAME THEORY: Consider what others might do in your league

Key Principles:
- Only make changes with strong conviction
- Compare against your Thursday analysis for consistency
- Prioritize injury replacements over minor optimizations
- Consider your playoff positioning and risk tolerance`;

      case 'monday_analysis':
        return `POST-GAME ANALYSIS & WAIVER STRATEGY (Week ${week}):
Your goal is comprehensive performance review and strategic waiver planning. Focus on:

1. PERFORMANCE EVALUATION: Analyze hits/misses from your recommendations
2. ROSTER GAP ANALYSIS: Identify weaknesses exposed by this week's games
3. WAIVER TARGET IDENTIFICATION: Find players who address specific needs
4. FAAB STRATEGY: Recommend bid amounts based on league activity
5. DROP CANDIDATES: Identify expendable roster pieces
6. FORWARD PLANNING: Consider next week's matchups and bye weeks

Key Principles:
- Learn from both successes and failures
- Balance immediate needs vs long-term value
- Consider league competitiveness and waiver activity patterns
- Coordinate strategy across multiple leagues`;

      case 'tuesday_waivers':
        return `WAIVER WIRE ADAPTATION (Week ${week}):
Your goal is to adjust strategy based on Monday's waiver results. Focus on:

1. AVAILABILITY ASSESSMENT: Review which targets were claimed vs available
2. NEW OPPORTUNITIES: Analyze players dropped by other teams
3. STREAMING STRATEGY: Identify short-term plays for next week
4. FAAB REALLOCATION: Adjust bidding strategy based on league patterns
5. LEVERAGE PLAYS: Find undervalued players others might miss

Key Principles:
- Adapt quickly to changed circumstances
- Find value in the chaos of post-waiver wire
- Balance aggression with budget conservation
- Look ahead to future weeks and playoffs`;

      default:
        return 'General fantasy football analysis focusing on optimal decision-making.';
    }
  }

  private buildUserPrompt(context: WorkflowContext, userPrompt: string): string {
    let enhancedPrompt = userPrompt;

    // Add contextual information
    if (context.previousResults) {
      enhancedPrompt += `\n\nPrevious Analysis Results:\n${JSON.stringify(context.previousResults, null, 2)}`;
    }

    // Add week-specific context
    const weekContext = this.getWeekContext(context.week);
    if (weekContext) {
      enhancedPrompt += `\n\n${weekContext}`;
    }

    return enhancedPrompt;
  }

  private getAvailableTools(task: WorkflowTask): string[] {
    const baseMCPTools = [
      'get_roster',
      'analyze_roster', 
      'optimize_lineup',
      'get_start_sit_advice',
      'find_waiver_targets',
      'analyze_player'
    ];

    const enhancedTools = [
      'get_fantasypros_rankings',
      'get_player_tiers',
      'compare_player_value',
      'get_enhanced_draft_recommendations'
    ];

    switch (task) {
      case 'thursday_optimization':
      case 'sunday_check':
        return [...baseMCPTools, ...enhancedTools.slice(0, 3)];
        
      case 'monday_analysis':
      case 'tuesday_waivers':
        return baseMCPTools;
        
      default:
        return baseMCPTools;
    }
  }

  private getSeasonPhase(week: number): string {
    if (week <= 4) return 'Early Season - Sample Size Building';
    if (week <= 8) return 'Mid Season - Trends Establishing'; 
    if (week <= 12) return 'Late Season - Playoff Push';
    if (week <= 17) return 'Playoffs - Championship Mode';
    return 'Championship Week - Final Push';
  }

  private getWeekContext(week: number): string | null {
    // Add week-specific context like common bye weeks, playoff implications, etc.
    const commonByeWeeks: { [key: number]: string[] } = {
      4: ['Some early bye weeks'],
      6: ['Peak bye week period begins'],
      7: ['Heavy bye weeks - roster management critical'],
      11: ['Bye week period ends'],
      14: ['Fantasy playoffs typically begin'],
      15: ['Fantasy semifinals'],
      16: ['Fantasy championships'],
      17: ['NFL regular season finale']
    };

    return commonByeWeeks[week] ? `Week ${week} Context: ${commonByeWeeks[week][0]}` : null;
  }
}

export const workflowContextBuilder = new WorkflowContextBuilder();