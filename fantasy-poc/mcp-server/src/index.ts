#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Import from shared library
import {
  espnApi,
  llmConfig,
  getRosterTool,
  getMyRoster,
  executeAIWorkflow
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
  console.error('Warning: ESPN cookies not found in environment');
}

// Initialize LLM configuration
await llmConfig.initializeLLM();

// Web search function using DuckDuckGo Instant Answer API
async function webSearch(query: string, maxResults: number = 5): Promise<string> {
  try {
    // Use DuckDuckGo Instant Answer API (free, no API key needed)
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FantasyAI/1.0)'
      }
    });
    
    const data = response.data;
    let results = [];
    
    // Check for instant answer
    if (data.Answer) {
      results.push(`Direct Answer: ${data.Answer}`);
    }
    
    if (data.Definition) {
      results.push(`Definition: ${data.Definition}`);
    }
    
    // Add related topics if available
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      results.push('Related Information:');
      data.RelatedTopics.slice(0, maxResults).forEach((topic: any, index: number) => {
        if (topic.Text) {
          results.push(`${index + 1}. ${topic.Text}`);
          if (topic.FirstURL) {
            results.push(`   Source: ${topic.FirstURL}`);
          }
        }
      });
    }
    
    // If no results from DuckDuckGo, try alternative search
    if (results.length === 0) {
      return await alternativeSearch(query);
    }
    
    return results.join('\n');
    
  } catch (error: any) {
    console.error('Web search error:', error.message);
    return `Web search failed: ${error.message}`;
  }
}

// Alternative search using web scraping (as fallback)
async function alternativeSearch(query: string): Promise<string> {
  try {
    // Search ESPN fantasy news as fallback for fantasy-related queries
    if (query.toLowerCase().includes('fantasy') || query.toLowerCase().includes('injury') || query.toLowerCase().includes('nfl')) {
      const espnUrl = `https://www.espn.com/search/_/q/${encodeURIComponent(query)}`;
      
      const response = await axios.get(espnUrl, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const results = [];
      
      // Extract search results
      $('.search-results article').slice(0, 3).each((index, element) => {
        const title = $(element).find('h2 a').text().trim();
        const summary = $(element).find('p').first().text().trim();
        const url = $(element).find('h2 a').attr('href');
        
        if (title) {
          results.push(`${index + 1}. ${title}`);
          if (summary) {
            results.push(`   ${summary.substring(0, 150)}...`);
          }
          if (url && url.startsWith('http')) {
            results.push(`   Source: ${url}`);
          }
        }
      });
      
      if (results.length > 0) {
        return `ESPN Search Results for "${query}":\n${results.join('\n')}`;
      }
    }
    
    return `No specific results found for "${query}". Try a more specific search term.`;
    
  } catch (error: any) {
    return `Alternative search failed: ${error.message}`;
  }
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
  },
  {
    name: 'web_search',
    description: 'Search the internet for current information about players, injuries, weather, news, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { 
          type: 'string', 
          description: 'Search query (e.g., "Justin Jefferson injury report week 5", "Bills vs Chiefs weather forecast", "fantasy football waiver wire week 5")' 
        },
        maxResults: { 
          type: 'number', 
          description: 'Maximum number of results to return (default: 5)',
          default: 5 
        }
      },
      required: ['query']
    }
  }
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      case 'my_roster':
        result = await getMyRoster(args as any);
        break;
      case 'web_search':
        const { query, maxResults = 5 } = args as { query: string; maxResults?: number };
        result = await webSearch(query, maxResults);
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