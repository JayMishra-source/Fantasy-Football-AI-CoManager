#!/usr/bin/env node

/**
 * Lineup Optimization Script
 * Runs on Thursday (pre-TNF) and Sunday (pre-games) to optimize lineups
 */

import { automationService } from '../dist/services/automationService.js';
import { notificationService } from '../dist/services/notificationService.js';
import { getNotificationConfigFromEnv } from '../dist/services/notificationService.js';
import fs from 'fs';

async function optimizeLineups() {
  console.log('🏈 Starting lineup optimization...');
  
  const results = {
    timestamp: new Date().toISOString(),
    task: 'lineup_optimization',
    leagues: []
  };

  try {
    const notificationConfig = getNotificationConfigFromEnv();
    const notifications = new notificationService(notificationConfig);
    
    // Get current week
    const currentWeek = Math.ceil((new Date() - new Date('2024-09-05')) / (7 * 24 * 60 * 60 * 1000));
    
    // Process League 1
    if (process.env.LEAGUE_1_ID && process.env.LEAGUE_1_TEAM_ID) {
      console.log(`📊 Analyzing League 1 (${process.env.LEAGUE_1_ID})...`);
      
      const report = await automationService.generateWeeklyReport(
        process.env.LEAGUE_1_ID,
        process.env.LEAGUE_1_TEAM_ID,
        currentWeek
      );
      
      results.leagues.push({
        leagueId: process.env.LEAGUE_1_ID,
        teamId: process.env.LEAGUE_1_TEAM_ID,
        name: 'League 1',
        report
      });
      
      // Send notifications for significant changes
      if (report.lineupChanges.length > 0) {
        await notifications.sendAutomationReport(report, 'League 1');
      }
      
      // Send urgent alerts for injuries
      for (const injury of report.injuryAlerts) {
        await notifications.sendUrgentAlert({
          type: 'injury',
          player: injury.fullName,
          message: `${injury.fullName} status: ${injury.injuryStatus}`,
          severity: injury.injuryStatus === 'OUT' ? 'critical' : 'high'
        });
      }
    }

    // Process League 2
    if (process.env.LEAGUE_2_ID && process.env.LEAGUE_2_TEAM_ID) {
      console.log(`📊 Analyzing League 2 (${process.env.LEAGUE_2_ID})...`);
      
      const report = await automationService.generateWeeklyReport(
        process.env.LEAGUE_2_ID,
        process.env.LEAGUE_2_TEAM_ID,
        currentWeek
      );
      
      results.leagues.push({
        leagueId: process.env.LEAGUE_2_ID,
        teamId: process.env.LEAGUE_2_TEAM_ID,
        name: 'League 2',
        report
      });
      
      if (report.lineupChanges.length > 0) {
        await notifications.sendAutomationReport(report, 'League 2');
      }
      
      for (const injury of report.injuryAlerts) {
        await notifications.sendUrgentAlert({
          type: 'injury',
          player: injury.fullName,
          message: `${injury.fullName} status: ${injury.injuryStatus}`,
          severity: injury.injuryStatus === 'OUT' ? 'critical' : 'high'
        });
      }
    }
    
    results.status = 'success';
    results.summary = `Processed ${results.leagues.length} leagues. Total lineup changes: ${results.leagues.reduce((sum, l) => sum + l.report.lineupChanges.length, 0)}`;
    
    console.log('✅ Lineup optimization completed successfully');
    
  } catch (error) {
    console.error('❌ Lineup optimization failed:', error);
    results.status = 'error';
    results.error = error.message;
    
    // Send error notification
    if (notificationConfig?.slack) {
      await notifications.sendUrgentAlert({
        type: 'lineup',
        message: `Lineup optimization failed: ${error.message}`,
        severity: 'high'
      });
    }
  }
  
  // Save results
  fs.writeFileSync('automation-output.json', JSON.stringify(results, null, 2));
  console.log('📄 Results saved to automation-output.json');
}

// Run the optimization
if (import.meta.url === `file://${process.argv[1]}`) {
  optimizeLineups().catch(console.error);
}

export default optimizeLineups;