import { spawn } from 'child_process';

export interface MCPSearchResult {
  success: boolean;
  results?: string;
  error?: string;
}

export class MCPClient {
  private serverProcess: any = null;
  private isConnected: boolean = false;

  async initialize(): Promise<boolean> {
    try {
      console.log('🔍 Initializing MCP web search client...');
      
      // Test if MCP server is available
      const testResult = await this.performSearch('test query');
      this.isConnected = testResult.success;
      
      if (this.isConnected) {
        console.log('✅ MCP web search client connected successfully');
      } else {
        console.log('⚠️ MCP web search client not available, will fallback to direct search');
      }
      
      return this.isConnected;
    } catch (error: any) {
      console.warn('MCP client initialization failed:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  async performSearch(query: string, maxResults: number = 5): Promise<MCPSearchResult> {
    if (!query || query.trim().length === 0) {
      return { success: false, error: 'Empty query provided' };
    }

    try {
      // Try MCP server first if available
      const mcpResult = await this.mcpSearch(query, maxResults);
      if (mcpResult.success) {
        return mcpResult;
      }
      
      // Fallback to direct DuckDuckGo API
      console.log('🔄 MCP server unavailable, using direct DuckDuckGo search...');
      return await this.fallbackSearch(query, maxResults);
      
    } catch (error: any) {
      console.error('Search failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  private async mcpSearch(query: string, maxResults: number): Promise<MCPSearchResult> {
    return new Promise((resolve) => {
      try {
        // Simulate MCP JSON-RPC call to ddg_search server
        const mcpRequest = {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'web_search',
            arguments: { query, max_results: maxResults }
          },
          id: Date.now()
        };

        // Use npx to call the MCP server directly
        const serverProcess = spawn('npx', ['@oevortex/ddg_search'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';

        serverProcess.stdout?.on('data', (data) => {
          output += data.toString();
        });

        serverProcess.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });

        serverProcess.on('close', (code) => {
          if (code === 0 && output.trim()) {
            try {
              const response = JSON.parse(output);
              if (response.result && response.result.content) {
                resolve({ 
                  success: true, 
                  results: Array.isArray(response.result.content) 
                    ? response.result.content.map((c: any) => c.text).join('\n')
                    : response.result.content
                });
              } else {
                resolve({ success: false, error: 'No results in MCP response' });
              }
            } catch (parseError) {
              resolve({ success: false, error: 'Failed to parse MCP response' });
            }
          } else {
            resolve({ success: false, error: `MCP server failed: ${errorOutput || 'Unknown error'}` });
          }
        });

        // Send the request
        serverProcess.stdin?.write(JSON.stringify(mcpRequest) + '\n');
        serverProcess.stdin?.end();

        // Timeout after 15 seconds
        setTimeout(() => {
          serverProcess.kill();
          resolve({ success: false, error: 'MCP search timeout' });
        }, 15000);

      } catch (error: any) {
        resolve({ success: false, error: `MCP search failed: ${error.message}` });
      }
    });
  }

  private async fallbackSearch(query: string, maxResults: number): Promise<MCPSearchResult> {
    try {
      const axios = await import('axios');
      const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      
      const response = await axios.default.get(searchUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FantasyAI-GitHub/1.0)'
        }
      });
      
      const data = response.data;
      const results = [];
      
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
      
      if (results.length === 0) {
        return { 
          success: true, 
          results: `No specific results found for "${query}". This may be a very specific or recent topic.`
        };
      }
      
      return { success: true, results: results.join('\n') };
      
    } catch (error: any) {
      console.error('Fallback search error:', error.message);
      return { success: false, error: `Search failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
    this.isConnected = false;
    console.log('🔌 MCP client disconnected');
  }

  isAvailable(): boolean {
    return this.isConnected;
  }
}

// Global MCP client instance
export const mcpClient = new MCPClient();