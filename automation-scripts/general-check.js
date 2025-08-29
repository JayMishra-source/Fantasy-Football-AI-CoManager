#!/usr/bin/env node

/**
 * General Check Script
 * Fallback script for manual runs or general health checks
 */

import { espnApi } from '../services/espnApi.js';
import { costMonitor } from '../services/costMonitor.js';
import fs from 'fs';

async function generalCheck() {
  console.log('🔍 Running general fantasy health check...');
  
  const results = {
    timestamp: new Date().toISOString(),
    task: 'general_check',
    status: 'running',
    checks: {}
  };

  try {
    // Test ESPN API connectivity
    console.log('🏈 Testing ESPN API connection...');
    if (process.env.LEAGUE_1_ID) {
      const league = await espnApi.getLeague(process.env.LEAGUE_1_ID);
      results.checks.espn_api = {
        status: 'success',
        league_name: league.settings?.name || 'Unknown',
        current_week: league.scoringPeriodId
      };
    }
    
    // Check cost monitoring
    console.log('💰 Checking cost monitoring...');
    const costSummary = await costMonitor.getCostSummary();
    results.checks.cost_monitoring = {
      status: 'success',
      daily_cost: costSummary.costs.today,
      weekly_cost: costSummary.costs.this_week,
      monthly_cost: costSummary.costs.this_month
    };
    
    // Verify environment variables
    console.log('⚙️ Checking environment configuration...');
    const requiredEnvVars = [
      'ESPN_S2', 'ESPN_SWID', 'LEAGUE_1_ID', 'LEAGUE_1_TEAM_ID', 
      'GEMINI_API_KEY', 'DEFAULT_LLM_PROVIDER'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    results.checks.environment = {
      status: missingVars.length === 0 ? 'success' : 'warning',
      missing_variables: missingVars,
      configured_leagues: [
        process.env.LEAGUE_1_ID && 'League 1',
        process.env.LEAGUE_2_ID && 'League 2'
      ].filter(Boolean)
    };
    
    // System health summary
    const allChecksPass = Object.values(results.checks).every(check => 
      check.status === 'success' || check.status === 'warning'
    );
    
    results.status = allChecksPass ? 'success' : 'error';
    results.summary = `System health check completed. ${Object.keys(results.checks).length} checks performed.`;
    
    console.log('✅ General health check completed');
    
  } catch (error) {
    console.error('❌ General check failed:', error);
    results.status = 'error';
    results.error = error.message;
  }
  
  // Save results
  fs.writeFileSync('automation-output.json', JSON.stringify(results, null, 2));
  console.log('📄 Results saved to automation-output.json');
}

// Run the check
if (import.meta.url === `file://${process.argv[1]}`) {
  generalCheck().catch(console.error);
}

export default generalCheck;