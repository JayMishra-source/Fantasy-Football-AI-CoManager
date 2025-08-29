#!/usr/bin/env node

/**
 * Waiver Wire Analysis Script  
 * Runs on Tuesday after waivers process to analyze new opportunities
 */

import { enhancedAutomationService } from '../services/enhancedAutomationService.js';
import { notificationService, getNotificationConfigFromEnv } from '../services/notificationService.js';
import fs from 'fs';

async function analyzeWaiverWire() {
  console.log('🎯 Starting waiver wire analysis...');
  
  // Initialize FantasyPros if available (optional)
  if (process.env.FANTASYPROS_SESSION_ID) {
    await enhancedAutomationService.initializeFantasyPros(process.env.FANTASYPROS_SESSION_ID);
  }
  
  const results = {
    timestamp: new Date().toISOString(),
    task: 'waiver_analysis',
    leagues: []
  };

  try {
    const notificationConfig = getNotificationConfigFromEnv();
    const notifications = new notificationService(notificationConfig);
    
    const currentWeek = Math.ceil((new Date() - new Date('2024-09-05')) / (7 * 24 * 60 * 60 * 1000));
    
    // Process League 1
    if (process.env.LEAGUE_1_ID && process.env.LEAGUE_1_TEAM_ID) {
      console.log(`📊 Analyzing waiver wire for League 1...`);
      
      const report = await enhancedAutomationService.generateEnhancedWeeklyReport(
        process.env.LEAGUE_1_ID,
        process.env.LEAGUE_1_TEAM_ID,
        currentWeek
      );
      
      results.leagues.push({
        leagueId: process.env.LEAGUE_1_ID,
        teamId: process.env.LEAGUE_1_TEAM_ID,
        name: 'League 1',
        waiverTargets: report.waiverRecommendations.length,
        highPriorityTargets: report.waiverRecommendations.filter(r => r.priority >= 8).length,
        report: {
          waiverRecommendations: report.waiverRecommendations.slice(0, 5), // Top 5 only
          injuryAlerts: report.injuryAlerts
        }
      });
      
      // Send notification for high-priority waiver targets
      const highPriorityTargets = report.waiverRecommendations.filter(r => r.priority >= 8);
      for (const target of highPriorityTargets.slice(0, 3)) {
        await notifications.sendUrgentAlert({
          type: 'waiver',
          player: target.player.fullName,
          message: `High-priority waiver target: ${target.player.fullName} (Priority: ${target.priority}/10, FAAB: $${target.faabBid})`,
          severity: target.priority >= 9 ? 'critical' : 'high'
        });
      }
    }

    // Process League 2  
    if (process.env.LEAGUE_2_ID && process.env.LEAGUE_2_TEAM_ID) {
      console.log(`📊 Analyzing waiver wire for League 2...`);
      
      const report = await enhancedAutomationService.generateEnhancedWeeklyReport(
        process.env.LEAGUE_2_ID,
        process.env.LEAGUE_2_TEAM_ID,
        currentWeek
      );
      
      results.leagues.push({
        leagueId: process.env.LEAGUE_2_ID,
        teamId: process.env.LEAGUE_2_TEAM_ID,
        name: 'League 2',
        waiverTargets: report.waiverRecommendations.length,
        highPriorityTargets: report.waiverRecommendations.filter(r => r.priority >= 8).length,
        report: {
          waiverRecommendations: report.waiverRecommendations.slice(0, 5),
          injuryAlerts: report.injuryAlerts
        }
      });
      
      const highPriorityTargets = report.waiverRecommendations.filter(r => r.priority >= 8);
      for (const target of highPriorityTargets.slice(0, 3)) {
        await notifications.sendUrgentAlert({
          type: 'waiver',
          player: target.player.fullName,
          message: `High-priority waiver target: ${target.player.fullName} (Priority: ${target.priority}/10, FAAB: $${target.faabBid})`,
          severity: target.priority >= 9 ? 'critical' : 'high'
        });
      }
    }
    
    results.status = 'success';
    const totalHighPriority = results.leagues.reduce((sum, l) => sum + l.highPriorityTargets, 0);
    results.summary = `Found ${totalHighPriority} high-priority waiver targets across ${results.leagues.length} leagues`;
    
    console.log('✅ Waiver wire analysis completed successfully');
    
  } catch (error) {
    console.error('❌ Waiver analysis failed:', error);
    results.status = 'error';
    results.error = error.message;
  }
  
  // Save results
  fs.writeFileSync('automation-output.json', JSON.stringify(results, null, 2));
  console.log('📄 Results saved to automation-output.json');
}

// Run the analysis
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeWaiverWire().catch(console.error);
}

export default analyzeWaiverWire;