#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';

// Import all tools from shared library
import {
  espnApi,
  llmConfig,
  getRosterTool,
  analyzeRosterTool,
  optimizeLineupTool,
  getStartSitAdviceTool,
  findWaiverTargetsTool,
  analyzePlayerTool,
  analyzeTradesTool,
  findTradeTargetsTool,
  getMyRoster,
  getDraftInfo,
  analyzeDraft,
  getDraftRecommendations,
  getPlayerRankings,
  getAuctionRecommendation,
  getBudgetStrategy,
  shouldAutoBid,
  initializeFantasyPros,
  getEnhancedDraftRecommendations,
  getFantasyProsRankings,
  getPlayerTiers,
  comparePlayerValue,
  getCostSummary,
  getProviderRecommendations,
  resetCostTracking,
  executeAIWorkflow,
  directLLMAnalysis,
  getGameContextTool,
  getPlayerNewsTool,
  analyzeCrossLeagueStrategy,
  coordinateWaiverClaims,
  trackPerformance,
  recordOutcome,
  getPerformanceMetrics,
  getCostAnalysis,
  trainModel,
  getPersonalizedInsights,
  runABTest,
  getABTestResults,
  enhanceWithLearning
} from '@fantasy-ai/shared';

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

// Initialize LLM configuration
await llmConfig.initializeLLM();

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

// Define available tools (same tool definitions as before)
const tools: Tool[] = [
  {
    name: 'get_roster',
    description: 'Get the current roster for a fantasy team with all player details',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { type: 'string', description: 'ESPN Fantasy league ID' },
        teamId: { type: 'string', description: 'Team ID within the league' }
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
        week: { type: 'number', description: 'Week number (optional, defaults to current week)' }
      },
      required: ['leagueId', 'teamId']
    }
  },
  {
    name: 'my_roster',
    description: 'Get simplified current roster information',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { type: 'string' },
        teamId: { type: 'string' }
      },
      required: ['leagueId', 'teamId']
    }
  }
  // Add more tool definitions as needed...
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Call tool handler - simplified routing
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

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
      case 'my_roster':
        result = await getMyRoster(args as any);
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
      case 'execute_ai_workflow':
        result = await executeAIWorkflow(args as any);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ESPN Fantasy MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});