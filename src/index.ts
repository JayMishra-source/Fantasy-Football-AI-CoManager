#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { espnApi } from './services/espnApi.js';
import { getRosterTool, analyzeRosterTool } from './tools/roster.js';
import { optimizeLineupTool, getStartSitAdviceTool } from './tools/lineup.js';
import { findWaiverTargetsTool, analyzePlayerTool } from './tools/waiver.js';
import { analyzeTradesTool, findTradeTargetsTool } from './tools/trades.js';
import { getMyRoster } from './tools/simple-enhanced.js';
import { getDraftInfo, analyzeDraft, getDraftRecommendations, getPlayerRankings } from './tools/draft.js';
import { getAuctionRecommendation, getBudgetStrategy, shouldAutoBid } from './tools/liveAuction.js';
import { initializeFantasyPros, getEnhancedDraftRecommendations, getFantasyProsRankings, getPlayerTiers, comparePlayerValue } from './tools/enhancedDraft.js';
import { getCostSummary, getProviderRecommendations, resetCostTracking } from './tools/cost.js';
import { executeAIWorkflow } from './tools/aiWorkflowOrchestrator.js';
import { directLLMAnalysis } from './tools/directLLM.js';
import { getGameContextTool, getPlayerNewsTool } from './tools/gameContext.js';
import { analyzeCrossLeagueStrategy, coordinateWaiverClaims } from './tools/crossLeague.js';
import { 
  trackPerformance, 
  recordOutcome, 
  getPerformanceMetrics, 
  getCostAnalysis,
  trainModel,
  getPersonalizedInsights,
  runABTest,
  getABTestResults,
  enhanceWithLearning
} from './tools/feedbackLoop.js';
import { llmConfig } from './config/llm-config.js';

// Load environment variables
dotenv.config();

// Initialize ESPN API with cookies if available
const ESPN_S2 = process.env.ESPN_S2 || '';
const ESPN_SWID = process.env.ESPN_SWID || '';

if (ESPN_S2 && ESPN_SWID) {
  espnApi.setCookies({
    espn_s2: ESPN_S2,
    swid: ESPN_SWID
  });
  console.error('ESPN cookies configured from environment');
} else {
  console.error('Warning: ESPN cookies not found in environment. Private league access will not work.');
  console.error('Set ESPN_S2 and ESPN_SWID environment variables for private league access.');
}

// Create MCP server
const server = new Server(
  {
    name: 'espn-fantasy-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
const tools: Tool[] = [
  {
    name: 'get_roster',
    description: 'Get the current roster for a fantasy team with all player details',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string',
          description: 'ESPN Fantasy league ID'
        },
        teamId: { 
          type: 'string',
          description: 'Team ID within the league'
        }
      },
      required: ['leagueId', 'teamId']
    }
  },
  {
    name: 'analyze_roster',
    description: 'Analyze a team roster for strengths, weaknesses, and recommendations',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { type: 'string' },
        teamId: { type: 'string' }
      },
      required: ['leagueId', 'teamId']
    }
  },
  {
    name: 'optimize_lineup',
    description: 'Get optimal lineup recommendations based on projections and matchups',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { type: 'string' },
        teamId: { type: 'string' },
        week: { 
          type: 'number',
          description: 'Week number (optional, defaults to current week)'
        }
      },
      required: ['leagueId', 'teamId']
    }
  },
  {
    name: 'get_start_sit_advice',
    description: 'Get start/sit recommendation for a specific player',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { type: 'string' },
        teamId: { type: 'string' },
        playerName: { 
          type: 'string',
          description: 'Name of the player (partial match supported)'
        }
      },
      required: ['leagueId', 'teamId', 'playerName']
    }
  },
  {
    name: 'find_waiver_targets',
    description: 'Find and rank available players on waivers with pickup recommendations',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { type: 'string' },
        teamId: { 
          type: 'string',
          description: 'Optional - if provided, will suggest drop candidates'
        },
        position: { 
          type: 'string',
          description: 'Filter by position (QB, RB, WR, TE, K, DST)'
        },
        maxResults: { 
          type: 'number',
          description: 'Maximum number of results (default 10)'
        }
      },
      required: ['leagueId']
    }
  },
  {
    name: 'analyze_player',
    description: 'Analyze a specific player for add/drop/hold decision',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { type: 'string' },
        playerName: { type: 'string' }
      },
      required: ['leagueId', 'playerName']
    }
  },
  {
    name: 'analyze_trade',
    description: 'Analyze a trade proposal for fairness and value',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { type: 'string' },
        teamId: { type: 'string' },
        giving: { 
          type: 'array',
          items: { type: 'string' },
          description: 'Names of players you would give up'
        },
        receiving: { 
          type: 'array',
          items: { type: 'string' },
          description: 'Names of players you would receive'
        }
      },
      required: ['leagueId', 'teamId', 'giving', 'receiving']
    }
  },
  {
    name: 'find_trade_targets',
    description: 'Find potential trade targets based on team needs and surplus',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { type: 'string' },
        teamId: { type: 'string' },
        targetPosition: { 
          type: 'string',
          description: 'Position you want to target (optional)'
        }
      },
      required: ['leagueId', 'teamId']
    }
  },
  
  // Enhanced tool with team aliases
  {
    name: 'my_roster',
    description: 'Get YOUR roster - defaults to League 1 or specify "league 2" for your other team',
    inputSchema: {
      type: 'object',
      properties: {
        team: { 
          type: 'string',
          description: 'Optional: "league 1" (default) or "league 2"'
        }
      }
    }
  },
  
  // Draft tools
  {
    name: 'get_draft_info',
    description: 'Get draft information and status for a league',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string',
          description: 'ESPN Fantasy league ID'
        }
      },
      required: ['leagueId']
    }
  },
  {
    name: 'analyze_completed_draft',
    description: 'Analyze a completed draft with team grades and insights',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string',
          description: 'ESPN Fantasy league ID (must have completed draft)'
        }
      },
      required: ['leagueId']
    }
  },
  {
    name: 'get_draft_recommendations',
    description: 'Get live draft pick recommendations for your team',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { type: 'string' },
        teamId: { type: 'string' },
        round: { 
          type: 'number',
          description: 'Current round (optional, defaults to 1)'
        }
      },
      required: ['leagueId', 'teamId']
    }
  },
  {
    name: 'get_player_rankings',
    description: 'Get player rankings and tiers for draft preparation',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { type: 'string' },
        position: { 
          type: 'string',
          description: 'Filter by position (QB, RB, WR, TE, K, DST)'
        }
      },
      required: ['leagueId']
    }
  },
  
  // FantasyPros Enhanced Tools
  {
    name: 'initialize_fantasypros',
    description: 'Initialize FantasyPros MVP subscription integration with credentials OR session ID',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Your FantasyPros account email (optional if using sessionId)' },
        password: { type: 'string', description: 'Your FantasyPros account password (optional if using sessionId)' },
        sessionId: { type: 'string', description: 'Your FantasyPros session ID from browser cookies (preferred method)' }
      }
    }
  },
  {
    name: 'get_enhanced_draft_recommendations',
    description: 'Get enhanced draft recommendations combining ESPN + FantasyPros expert consensus',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { type: 'string' },
        teamId: { type: 'string' },
        round: { type: 'number', description: 'Current draft round (optional)' }
      },
      required: ['leagueId', 'teamId']
    }
  },
  {
    name: 'get_fantasypros_rankings',
    description: 'Get FantasyPros expert consensus rankings with tiers and ADP',
    inputSchema: {
      type: 'object',
      properties: {
        position: { 
          type: 'string', 
          enum: ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DST'],
          description: 'Position filter (optional, defaults to ALL)'
        },
        format: {
          type: 'string',
          enum: ['STD', 'HALF', 'PPR'], 
          description: 'Scoring format (optional, defaults to PPR)'
        }
      }
    }
  },
  {
    name: 'get_player_tiers',
    description: 'Get FantasyPros player tiers for specific position',
    inputSchema: {
      type: 'object',
      properties: {
        position: { 
          type: 'string', 
          enum: ['QB', 'RB', 'WR', 'TE'],
          description: 'Position to get tiers for'
        },
        format: {
          type: 'string',
          enum: ['STD', 'HALF', 'PPR'],
          description: 'Scoring format (optional, defaults to PPR)'
        }
      },
      required: ['position']
    }
  },
  {
    name: 'compare_player_value',
    description: 'Compare a specific player\'s value vs current draft pick using FantasyPros ADP',
    inputSchema: {
      type: 'object',
      properties: {
        playerName: { type: 'string', description: 'Player name to analyze' },
        currentPick: { type: 'number', description: 'Current draft pick number' },
        leagueId: { type: 'string', description: 'League ID for context' }
      },
      required: ['playerName', 'currentPick', 'leagueId']
    }
  },
  
  // Live Auction Draft Tools
  {
    name: 'get_auction_recommendation',
    description: 'Get bidding recommendation for a specific player in auction draft',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { type: 'string' },
        teamId: { type: 'string' },
        playerName: { 
          type: 'string',
          description: 'Name of player currently being auctioned'
        },
        currentBid: { 
          type: 'number',
          description: 'Current highest bid (optional, defaults to 1)'
        }
      },
      required: ['leagueId', 'teamId', 'playerName']
    }
  },
  {
    name: 'get_budget_strategy',
    description: 'Get budget allocation strategy for auction draft',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { type: 'string' },
        teamId: { type: 'string' }
      },
      required: ['leagueId', 'teamId']
    }
  },
  {
    name: 'should_auto_bid',
    description: 'AI decision on whether to automatically bid on current player',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { type: 'string' },
        teamId: { type: 'string' },
        playerName: { type: 'string' },
        currentBid: { type: 'number' },
        timeRemaining: { 
          type: 'number',
          description: 'Seconds remaining on auction clock'
        }
      },
      required: ['leagueId', 'teamId', 'playerName', 'currentBid', 'timeRemaining']
    }
  },

  // Cost Monitoring Tools
  {
    name: 'get_cost_summary',
    description: 'Get current LLM cost usage and limits summary',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: 'get_provider_recommendations', 
    description: 'Get cost-optimized LLM provider recommendations',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: 'reset_cost_tracking',
    description: 'Reset cost tracking data (admin only)',
    inputSchema: {
      type: 'object', 
      properties: {},
      additionalProperties: false
    }
  },

  // AI Workflow Orchestrator
  {
    name: 'execute_ai_workflow',
    description: 'Execute AI-driven fantasy football workflow with LLM orchestration',
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          enum: ['thursday_optimization', 'sunday_check', 'monday_analysis', 'tuesday_waivers'],
          description: 'Type of workflow to execute'
        },
        leagues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              leagueId: { type: 'string', description: 'ESPN league ID' },
              teamId: { type: 'string', description: 'Team ID within league' }
            },
            required: ['leagueId', 'teamId']
          },
          description: 'Array of leagues and teams to analyze'
        },
        week: {
          type: 'number',
          description: 'NFL week number'
        },
        prompt: {
          type: 'string',
          description: 'Natural language description of what you want to accomplish'
        },
        context: {
          type: 'object',
          description: 'Optional additional context or previous results'
        }
      },
      required: ['task', 'leagues', 'week', 'prompt']
    }
  },

  // Direct LLM Analysis Tool (for testing)
  {
    name: 'direct_llm_analysis',
    description: 'Direct call to LLM manager for testing tool usage',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { type: 'string', description: 'ESPN league ID' },
        teamId: { type: 'string', description: 'Team ID within league' },
        week: { type: 'number', description: 'NFL week number' },
        task: { type: 'string', description: 'Task type for analysis' },
        prompt: { type: 'string', description: 'Analysis prompt for LLM' }
      },
      required: ['leagueId', 'teamId', 'week', 'task', 'prompt']
    }
  },

  // Weather & News Integration Tools
  {
    name: 'get_game_context',
    description: 'Get comprehensive game context including weather, news, and injury reports for enhanced fantasy decisions',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { type: 'string', description: 'ESPN Fantasy league ID' },
        teamId: { 
          type: 'string', 
          description: 'Optional - Team ID to focus on specific players'
        },
        week: { 
          type: 'number', 
          description: 'NFL week number (default: 1)'
        },
        includeWeather: { 
          type: 'boolean', 
          description: 'Include weather data for outdoor games (default: true)'
        },
        includeNews: { 
          type: 'boolean', 
          description: 'Include player news and injury reports (default: true)'
        }
      },
      required: ['leagueId']
    }
  },

  {
    name: 'get_player_news',
    description: 'Get recent news and injury updates for a specific player',
    inputSchema: {
      type: 'object',
      properties: {
        playerName: { 
          type: 'string', 
          description: 'Full name of the player'
        },
        team: { 
          type: 'string', 
          description: 'Optional - Team name for more specific results'
        }
      },
      required: ['playerName']
    }
  },

  // Cross-League Strategy Tools
  {
    name: 'analyze_cross_league_strategy',
    description: 'Analyze strategy across multiple fantasy leagues with coordinated recommendations and risk mitigation',
    inputSchema: {
      type: 'object',
      properties: {
        leagues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              leagueId: { type: 'string', description: 'ESPN league ID' },
              teamId: { type: 'string', description: 'Team ID in the league' },
              leagueName: { type: 'string', description: 'Optional league name for reference' }
            },
            required: ['leagueId', 'teamId']
          },
          description: 'Array of leagues to analyze (minimum 2 required)'
        },
        week: { 
          type: 'number', 
          description: 'NFL week number (default: 1)'
        },
        strategy: { 
          type: 'string', 
          enum: ['conservative', 'balanced', 'aggressive'],
          description: 'Preferred risk strategy (default: balanced)'
        }
      },
      required: ['leagues']
    }
  },

  {
    name: 'coordinate_waiver_claims',
    description: 'Coordinate waiver wire claims across multiple leagues to maximize value and minimize conflicts',
    inputSchema: {
      type: 'object',
      properties: {
        leagues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              leagueId: { type: 'string', description: 'ESPN league ID' },
              teamId: { type: 'string', description: 'Team ID in the league' },
              faabBudget: { type: 'number', description: 'Optional FAAB budget remaining' }
            },
            required: ['leagueId', 'teamId']
          },
          description: 'Array of leagues for waiver coordination'
        },
        maxTargets: { 
          type: 'number', 
          description: 'Maximum targets per league (default: 5)'
        }
      },
      required: ['leagues']
    }
  },

  // Phase 4: Feedback Loop Tools
  {
    name: 'track_performance',
    description: 'Track the performance of a recommendation for learning and improvement',
    inputSchema: {
      type: 'object',
      properties: {
        type: { 
          type: 'string', 
          enum: ['lineup', 'waiver', 'trade', 'draft'],
          description: 'Type of recommendation'
        },
        leagueId: { type: 'string', description: 'ESPN league ID' },
        teamId: { type: 'string', description: 'Team ID' },
        week: { type: 'number', description: 'NFL week number' },
        recommendation: { type: 'object', description: 'The recommendation made' },
        confidence: { type: 'number', description: 'Confidence level (0-100)' },
        llmUsed: { type: 'boolean', description: 'Whether LLM was used' },
        llmModel: { type: 'string', description: 'LLM model used (optional)' },
        cost: { type: 'number', description: 'Cost of the recommendation (optional)' },
        dataSourcesUsed: { 
          type: 'array',
          items: { type: 'string' },
          description: 'Data sources used for the recommendation'
        }
      },
      required: ['type', 'leagueId', 'teamId', 'week', 'recommendation', 'confidence', 'llmUsed', 'dataSourcesUsed']
    }
  },

  {
    name: 'record_outcome',
    description: 'Record the actual outcome of a recommendation for learning',
    inputSchema: {
      type: 'object',
      properties: {
        recommendationId: { type: 'string', description: 'ID of the tracked recommendation' },
        success: { type: 'boolean', description: 'Whether the recommendation was successful' },
        actualPoints: { type: 'number', description: 'Actual points scored (optional)' },
        projectedPoints: { type: 'number', description: 'Projected points (optional)' },
        playerPerformance: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              playerId: { type: 'string' },
              playerName: { type: 'string' },
              projectedPoints: { type: 'number' },
              actualPoints: { type: 'number' }
            }
          },
          description: 'Individual player performance data (optional)'
        },
        notes: { type: 'string', description: 'Additional notes about the outcome' }
      },
      required: ['recommendationId', 'success']
    }
  },

  {
    name: 'get_performance_metrics',
    description: 'Get comprehensive performance metrics and learning insights',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date (ISO format)' },
        endDate: { type: 'string', description: 'End date (ISO format)' },
        leagueId: { type: 'string', description: 'Filter by league (optional)' },
        teamId: { type: 'string', description: 'Filter by team (optional)' }
      }
    }
  },

  {
    name: 'get_cost_analysis',
    description: 'Analyze LLM costs and get optimization strategies',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date (ISO format)' },
        endDate: { type: 'string', description: 'End date (ISO format)' },
        detailed: { type: 'boolean', description: 'Include detailed breakdown (default: false)' }
      }
    }
  },

  {
    name: 'train_model',
    description: 'Train the learning model with recent performance data',
    inputSchema: {
      type: 'object',
      properties: {
        forceRetrain: { type: 'boolean', description: 'Force retraining even with limited data' }
      }
    }
  },

  {
    name: 'get_personalized_insights',
    description: 'Get personalized insights and predictions based on learning',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { type: 'string', description: 'ESPN league ID' },
        teamId: { type: 'string', description: 'Team ID' }
      },
      required: ['leagueId', 'teamId']
    }
  },

  {
    name: 'run_ab_test',
    description: 'Run an A/B test comparing AI vs basic recommendations',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', description: 'Operation to test' },
        leagueId: { type: 'string', description: 'ESPN league ID' },
        teamId: { type: 'string', description: 'Team ID' },
        week: { type: 'number', description: 'NFL week number' },
        testName: { type: 'string', description: 'Name for new test (optional)' }
      },
      required: ['operation', 'leagueId', 'teamId', 'week']
    }
  },

  {
    name: 'get_ab_test_results',
    description: 'Get A/B test results and recommendations',
    inputSchema: {
      type: 'object',
      properties: {
        testId: { type: 'string', description: 'Specific test ID (optional)' },
        includeRecommendations: { type: 'boolean', description: 'Include recommendations (default: false)' }
      }
    }
  },

  {
    name: 'enhance_with_learning',
    description: 'Apply learning to enhance a recommendation',
    inputSchema: {
      type: 'object',
      properties: {
        recommendation: { type: 'object', description: 'Original recommendation' },
        type: { 
          type: 'string',
          enum: ['lineup', 'waiver', 'trade'],
          description: 'Type of recommendation'
        }
      },
      required: ['recommendation', 'type']
    }
  }
];

// Handle tool list requests
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools
}));

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    let result;
    
    switch (name) {
      case 'get_roster':
        result = await getRosterTool(args as any);
        break;
      
      case 'analyze_roster':
        result = await analyzeRosterTool(args as any);
        break;
      
      case 'optimize_lineup':
        result = await optimizeLineupTool(args as any);
        break;
      
      case 'get_start_sit_advice':
        result = await getStartSitAdviceTool(args as any);
        break;
      
      case 'find_waiver_targets':
        result = await findWaiverTargetsTool(args as any);
        break;
      
      case 'analyze_player':
        result = await analyzePlayerTool(args as any);
        break;
      
      case 'analyze_trade':
        result = await analyzeTradesTool(args as any);
        break;
      
      case 'find_trade_targets':
        result = await findTradeTargetsTool(args as any);
        break;
      
      // Enhanced tool
      case 'my_roster':
        result = await getMyRoster(args as any);
        break;
      
      // Draft tools
      case 'get_draft_info':
        result = await getDraftInfo(args as any);
        break;
      
      case 'analyze_completed_draft':
        result = await analyzeDraft(args as any);
        break;
      
      case 'get_draft_recommendations':
        result = await getDraftRecommendations(args as any);
        break;
      
      case 'get_player_rankings':
        result = await getPlayerRankings(args as any);
        break;
      
      // FantasyPros Enhanced tools
      case 'initialize_fantasypros':
        result = await initializeFantasyPros(args as any);
        break;
      
      case 'get_enhanced_draft_recommendations':
        result = await getEnhancedDraftRecommendations(args as any);
        break;
      
      case 'get_fantasypros_rankings':
        result = await getFantasyProsRankings(args as any);
        break;
      
      case 'get_player_tiers':
        result = await getPlayerTiers(args as any);
        break;
      
      case 'compare_player_value':
        result = await comparePlayerValue(args as any);
        break;
      
      // Live Auction Draft tools
      case 'get_auction_recommendation':
        result = await getAuctionRecommendation(args as any);
        break;
      
      case 'get_budget_strategy':
        result = await getBudgetStrategy(args as any);
        break;
      
      case 'should_auto_bid':
        result = await shouldAutoBid(args as any);
        break;
      
      // Cost monitoring tools
      case 'get_cost_summary':
        result = await getCostSummary();
        break;
      
      case 'get_provider_recommendations':
        result = await getProviderRecommendations();
        break;
      
      case 'reset_cost_tracking':
        result = await resetCostTracking();
        break;
      
      // AI Workflow Orchestrator
      case 'execute_ai_workflow':
        result = await executeAIWorkflow(args as any);
        break;
      
      // Direct LLM Analysis (for testing)
      case 'direct_llm_analysis':
        result = await directLLMAnalysis(args as any);
        break;

      case 'get_game_context':
        result = await getGameContextTool(args as any);
        break;

      case 'get_player_news':
        result = await getPlayerNewsTool(args as any);
        break;

      case 'analyze_cross_league_strategy':
        result = await analyzeCrossLeagueStrategy(args as any);
        break;

      case 'coordinate_waiver_claims':
        result = await coordinateWaiverClaims(args as any);
        break;

      // Feedback Loop Tools
      case 'track_performance':
        result = await trackPerformance(args as any);
        break;

      case 'record_outcome':
        result = await recordOutcome(args as any);
        break;

      case 'get_performance_metrics':
        result = await getPerformanceMetrics(args as any);
        break;

      case 'get_cost_analysis':
        result = await getCostAnalysis(args as any);
        break;

      case 'train_model':
        result = await trainModel(args as any);
        break;

      case 'get_personalized_insights':
        result = await getPersonalizedInsights(args as any);
        break;

      case 'run_ab_test':
        result = await runABTest(args as any);
        break;

      case 'get_ab_test_results':
        result = await getABTestResults(args as any);
        break;

      case 'enhance_with_learning':
        result = await enhanceWithLearning(args as any);
        break;
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${name}: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

// Start the server
async function main() {
  // Initialize LLM configuration if available
  try {
    const initialized = await llmConfig.initializeLLM();
    if (initialized) {
      console.error('✅ LLM system initialized successfully');
    } else {
      console.error('⚠️ LLM system not configured - AI workflows will fall back to basic mode');
    }
  } catch (error) {
    console.error('⚠️ LLM initialization failed:', error);
    console.error('AI workflows will fall back to basic mode');
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ESPN Fantasy MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});