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
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ESPN Fantasy MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});