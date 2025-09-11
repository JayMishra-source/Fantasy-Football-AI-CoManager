#!/usr/bin/env node

/**
 * Weekly Analysis Script
 * Runs on Monday after games to analyze performance and plan for next week
 */

import { enhancedAutomationService } from '../services/enhancedAutomationService.js';
import { notificationService, getNotificationConfigFromEnv } from '../services/notificationService.js';
import fs from 'fs';

async function weeklyAnalysis() {
  console.log('📈 Starting weekly performance analysis...');
  
  // Initialize FantasyPros if available (optional)
  if (process.env.FANTASYPROS_SESSION_ID) {
    await enhancedAutomationService.initializeFantasyPros(process.env.FANTASYPROS_SESSION_ID);
  }
  
  const results = {
    timestamp: new Date().toISOString(),
    task: 'weekly_analysis',
    leagues: []
  };

  try {
    const notificationConfig = getNotificationConfigFromEnv();
    const notifications = new notificationService(notificationConfig);
    
    const currentWeek = Math.ceil((new Date() - new Date('2024-09-05')) / (7 * 24 * 60 * 60 * 1000));
    
    // Process League 1
    if (process.env.LEAGUE_1_ID && process.env.LEAGUE_1_TEAM_ID) {
      console.log(`📊 Analyzing League 1 performance...`);
      
      const report = await enhancedAutomationService.generateEnhancedWeeklyReport(
        process.env.LEAGUE_1_ID,
        process.env.LEAGUE_1_TEAM_ID,
        currentWeek
      );
      
      results.leagues.push({
        leagueId: process.env.LEAGUE_1_ID,
        teamId: process.env.LEAGUE_1_TEAM_ID,
        name: 'League 1',
        weeklyProjection: report.weeklyProjection,
        riskAssessment: report.riskAssessment,
        lineupChangesNeeded: report.lineupChanges.length,
        injuryCount: report.injuryAlerts.length,
        waiverTargets: report.waiverRecommendations.filter(r => r.priority >= 7).length
      });
      
      // Send comprehensive weekly report
      await notifications.sendAutomationReport(report, 'League 1');
    }

    // Process League 2
    if (process.env.LEAGUE_2_ID && process.env.LEAGUE_2_TEAM_ID) {
      console.log(`📊 Analyzing League 2 performance...`);
      
      const report = await enhancedAutomationService.generateEnhancedWeeklyReport(
        process.env.LEAGUE_2_ID,
        process.env.LEAGUE_2_TEAM_ID,
        currentWeek
      );
      
      results.leagues.push({
        leagueId: process.env.LEAGUE_2_ID,
        teamId: process.env.LEAGUE_2_TEAM_ID,
        name: 'League 2',
        weeklyProjection: report.weeklyProjection,
        riskAssessment: report.riskAssessment,
        lineupChangesNeeded: report.lineupChanges.length,
        injuryCount: report.injuryAlerts.length,
        waiverTargets: report.waiverRecommendations.filter(r => r.priority >= 7).length
      });
      
      await notifications.sendAutomationReport(report, 'League 2');
    }
    
    results.status = 'success';
    const avgProjection = results.leagues.reduce((sum, l) => sum + l.weeklyProjection, 0) / results.leagues.length;
    results.summary = `Week ${currentWeek} analysis complete. Average projection: ${avgProjection.toFixed(1)} points`;
    
    console.log('✅ Weekly analysis completed successfully');
    
    // Send summary notification
    if (notificationConfig?.slack) {
      let summaryMessage = `📈 **Week ${currentWeek} Summary**\n\n`;
      
      results.leagues.forEach(league => {
        summaryMessage += `**${league.name}**:\n`;
        summaryMessage += `- Projection: ${league.weeklyProjection.toFixed(1)} pts\n`;
        summaryMessage += `- Risk: ${league.riskAssessment}\n`;
        summaryMessage += `- Changes needed: ${league.lineupChangesNeeded}\n`;
        summaryMessage += `- Injuries: ${league.injuryCount}\n\n`;
      });
      
      const notifications = new notificationService(notificationConfig);
      // This would be sent as a less urgent summary
      if (results.leagues.some(l => l.injuryCount > 0)) {
        await notifications.sendUrgentAlert({
          type: 'lineup',
          message: summaryMessage,
          severity: 'medium'
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Weekly analysis failed:', error);
    results.status = 'error';
    results.error = error.message;
  }
  
  // Save results
  fs.writeFileSync('automation-output.json', JSON.stringify(results, null, 2));
  console.log('📄 Results saved to automation-output.json');
}

// Run the analysis
if (import.meta.url === `file://${process.argv[1]}`) {
  weeklyAnalysis().catch(console.error);
}

export default weeklyAnalysis;