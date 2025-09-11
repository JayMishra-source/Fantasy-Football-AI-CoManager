import { espnApi } from '@fantasy-ai/shared';
import { loadProductionConfig, validateProductionConfig } from '../config/production.js';

export interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  duration: number;
  data?: any;
}

export class ESPNIntegrationTester {
  private config = loadProductionConfig();
  private results: TestResult[] = [];

  async runAllTests(): Promise<TestResult[]> {
    console.log('🧪 Starting ESPN Integration Tests...\n');
    
    await this.testEnvironmentSetup();
    await this.testESPNAuthentication();
    await this.testLeagueAccess();
    await this.testRosterRetrieval();
    await this.testPlayerData();
    await this.testAPIRateLimits();
    
    return this.results;
  }

  private async testEnvironmentSetup(): Promise<void> {
    const test = 'Environment Configuration';
    const start = Date.now();
    
    try {
      const validation = validateProductionConfig(this.config);
      
      if (validation.valid) {
        this.addResult(test, 'pass', 
          `Configuration valid. ${this.config.leagues.length} leagues configured.`,
          Date.now() - start, {
            leagues: this.config.leagues.length,
            features: Object.keys(this.config.features).filter(f => this.config.features[f as keyof typeof this.config.features]).length,
            provider: this.config.llm.primaryProvider
          }
        );
      } else {
        this.addResult(test, 'fail',
          `Configuration errors: ${validation.errors.join(', ')}`,
          Date.now() - start
        );
      }
      
      if (validation.warnings.length > 0) {
        this.addResult(`${test} - Warnings`, 'warning',
          validation.warnings.join('; '),
          0
        );
      }
      
    } catch (error: any) {
      this.addResult(test, 'fail', error.message, Date.now() - start);
    }
  }

  private async testESPNAuthentication(): Promise<void> {
    const test = 'ESPN Authentication';
    const start = Date.now();
    
    try {
      // Set ESPN cookies
      espnApi.setCookies({
        espn_s2: this.config.espn.s2,
        swid: this.config.espn.swid
      });
      
      // Verify cookies are set
      const cookies = espnApi.getCookies();
      if (!cookies || !cookies.espn_s2 || !cookies.swid) {
        throw new Error('ESPN cookies not properly set');
      }
      
      this.addResult(test, 'pass',
        'ESPN cookies configured successfully',
        Date.now() - start, {
          s2Length: cookies.espn_s2.length,
          swidValid: cookies.swid.includes('{') && cookies.swid.includes('}')
        }
      );
      
    } catch (error: any) {
      this.addResult(test, 'fail', error.message, Date.now() - start);
    }
  }

  private async testLeagueAccess(): Promise<void> {
    for (const league of this.config.leagues) {
      const test = `League Access - ${league.name}`;
      const start = Date.now();
      
      try {
        const leagueInfo = await espnApi.getLeagueInfo(league.id);
        
        this.addResult(test, 'pass',
          `Accessed league: ${leagueInfo.name}`,
          Date.now() - start, {
            leagueId: leagueInfo.id,
            currentWeek: leagueInfo.currentWeek,
            teams: leagueInfo.teams?.length || 0
          }
        );
        
      } catch (error: any) {
        // Check if it's an authentication error
        if (error.message.includes('authentication') || error.message.includes('HTML')) {
          this.addResult(test, 'fail',
            `Authentication failed for private league. Check ESPN cookies.`,
            Date.now() - start
          );
        } else {
          this.addResult(test, 'fail', error.message, Date.now() - start);
        }
      }
    }
  }

  private async testRosterRetrieval(): Promise<void> {
    for (const league of this.config.leagues) {
      const test = `Roster Retrieval - ${league.name}`;
      const start = Date.now();
      
      try {
        const roster = await espnApi.getTeamRoster(league.id, league.teamId);
        
        const startingCount = roster.starters?.length || 0;
        const benchCount = roster.bench?.length || 0;
        
        this.addResult(test, 'pass',
          `Retrieved roster: ${startingCount} starters, ${benchCount} bench`,
          Date.now() - start, {
            starters: startingCount,
            bench: benchCount,
            totalPlayers: startingCount + benchCount
          }
        );
        
      } catch (error: any) {
        this.addResult(test, 'fail', error.message, Date.now() - start);
      }
    }
  }

  private async testPlayerData(): Promise<void> {
    const test = 'Player Data Quality';
    const start = Date.now();
    
    try {
      // Test with first configured league
      if (this.config.leagues.length === 0) {
        throw new Error('No leagues configured for player data test');
      }
      
      const league = this.config.leagues[0];
      const roster = await espnApi.getTeamRoster(league.id, league.teamId);
      
      const allPlayers = [...(roster.starters || []), ...(roster.bench || [])];
      
      if (allPlayers.length === 0) {
        throw new Error('No players found in roster');
      }
      
      // Check data quality
      const playersWithNames = allPlayers.filter((p: any) => p.fullName || (p.firstName && p.lastName));
      const playersWithPositions = allPlayers.filter((p: any) => p.position && p.position !== 'Unknown');
      const playersWithTeams = allPlayers.filter((p: any) => p.team && p.team !== 'FA');
      
      const namePercentage = (playersWithNames.length / allPlayers.length) * 100;
      const positionPercentage = (playersWithPositions.length / allPlayers.length) * 100;
      const teamPercentage = (playersWithTeams.length / allPlayers.length) * 100;
      
      if (namePercentage >= 95 && positionPercentage >= 90) {
        this.addResult(test, 'pass',
          `Player data quality good: ${namePercentage.toFixed(1)}% names, ${positionPercentage.toFixed(1)}% positions`,
          Date.now() - start, {
            totalPlayers: allPlayers.length,
            namePercentage,
            positionPercentage,
            teamPercentage
          }
        );
      } else {
        this.addResult(test, 'warning',
          `Player data quality issues: ${namePercentage.toFixed(1)}% names, ${positionPercentage.toFixed(1)}% positions`,
          Date.now() - start, {
            totalPlayers: allPlayers.length,
            namePercentage,
            positionPercentage,
            teamPercentage
          }
        );
      }
      
    } catch (error: any) {
      this.addResult(test, 'fail', error.message, Date.now() - start);
    }
  }

  private async testAPIRateLimits(): Promise<void> {
    const test = 'API Rate Limit Behavior';
    const start = Date.now();
    
    try {
      // Make multiple rapid requests to test rate limiting
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(espnApi.getLeagueInfo(this.config.leagues[0].id));
      }
      
      const results = await Promise.allSettled(requests);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      this.addResult(test, successful >= 3 ? 'pass' : 'warning',
        `Rate limit test: ${successful}/${requests.length} requests successful`,
        Date.now() - start, {
          successful,
          failed,
          totalRequests: requests.length
        }
      );
      
    } catch (error: any) {
      this.addResult(test, 'fail', error.message, Date.now() - start);
    }
  }

  private addResult(name: string, status: 'pass' | 'fail' | 'warning', message: string, duration: number, data?: any): void {
    const result: TestResult = { name, status, message, duration, data };
    this.results.push(result);
    
    const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${name}: ${message} (${duration}ms)`);
  }

  generateReport(): string {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    
    let report = '📊 ESPN Integration Test Report\n';
    report += '================================\n\n';
    report += `Summary: ${passed} passed, ${failed} failed, ${warnings} warnings\n\n`;
    
    this.results.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
      report += `${icon} ${result.name}\n`;
      report += `   ${result.message}\n`;
      report += `   Duration: ${result.duration}ms\n`;
      if (result.data) {
        report += `   Data: ${JSON.stringify(result.data, null, 2)}\n`;
      }
      report += '\n';
    });
    
    return report;
  }
}

// Standalone test runner
export async function runESPNIntegrationTests(): Promise<boolean> {
  const tester = new ESPNIntegrationTester();
  const results = await tester.runAllTests();
  
  console.log('\n' + tester.generateReport());
  
  const hasFailures = results.some(r => r.status === 'fail');
  return !hasFailures;
}