#!/usr/bin/env node

/**
 * General Check Script
 * Fallback script for manual runs or general health checks
 */

import { espnApi } from '../services/espnApi.js';
import { costMonitor } from '../services/costMonitor.js';
import { NotificationService, getNotificationConfigFromEnv } from '../services/notificationService.js';
import { enhancedAutomationService } from '../services/enhancedAutomationService.js';
import fs from 'fs';

async function generalCheck() {
  console.log('🔍 Running general fantasy health check...');
  
  // Set ESPN cookies if available
  if (process.env.ESPN_S2 && process.env.ESPN_SWID) {
    espnApi.setCookies({
      espn_s2: process.env.ESPN_S2,
      swid: process.env.ESPN_SWID
    });
    console.log('✅ ESPN cookies configured');
  } else {
    console.log('⚠️ ESPN cookies not found in environment');
  }
  
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
      try {
        const league = await espnApi.getLeagueInfo(process.env.LEAGUE_1_ID);
        results.checks.espn_api = {
          status: 'success',
          league_name: league.name || 'Unknown',
          current_week: league.currentWeek || 1
        };
      } catch (espnError) {
        // ESPN API failed, but continue with other checks
        console.log('⚠️ ESPN API connection failed:', espnError.message);
        results.checks.espn_api = {
          status: 'warning',
          league_name: 'API Error',
          current_week: 1,
          error: espnError.message.includes('401') ? 'Authentication failed - cookies may be expired' : espnError.message
        };
      }
    }
    
    // Check cost monitoring
    console.log('💰 Checking cost monitoring...');
    try {
      const costSummary = await costMonitor.getCostSummary();
      results.checks.cost_monitoring = {
        status: 'success',
        daily_cost: costSummary?.costs?.today || 0,
        weekly_cost: costSummary?.costs?.this_week || 0,
        monthly_cost: costSummary?.costs?.this_month || 0
      };
    } catch (costError) {
      results.checks.cost_monitoring = {
        status: 'success',
        daily_cost: 0,
        weekly_cost: 0,
        monthly_cost: 0,
        note: 'No cost data available yet'
      };
    }
    
    // Check FantasyPros integration
    console.log('📊 Testing FantasyPros integration...');
    try {
      if (process.env.FANTASYPROS_SESSION_ID) {
        const fpSuccess = await enhancedAutomationService.initializeFantasyPros(process.env.FANTASYPROS_SESSION_ID);
        if (fpSuccess) {
          const fpStatus = enhancedAutomationService.getFantasyProsStatus();
          results.checks.fantasypros = {
            status: 'success',
            enabled: true,
            playerCount: fpStatus.playerCount || 0,
            lastUpdated: fpStatus.lastUpdated || new Date().toISOString()
          };
        } else {
          results.checks.fantasypros = {
            status: 'warning',
            enabled: false,
            error: 'Authentication failed - session ID may be expired'
          };
        }
      } else {
        results.checks.fantasypros = {
          status: 'info',
          enabled: false,
          note: 'Session ID not provided - FantasyPros integration disabled'
        };
      }
    } catch (fpError) {
      results.checks.fantasypros = {
        status: 'warning',
        enabled: false,
        error: fpError.message
      };
    }
    
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
  
  // Always try to send notification (success or error)
  try {
    const notificationConfig = getNotificationConfigFromEnv();
    console.log('🔧 Notification config:', JSON.stringify(notificationConfig, null, 2));
    if (notificationConfig.discord || notificationConfig.slack) {
      console.log('📨 Sending notification...');
      
      let message;
      if (results.status === 'success') {
        message = `🔍 **Fantasy Football System Health Check**\n\n`;
        message += `📊 **Status**: ✅ Healthy\n`;
        message += `⏰ **Time**: ${new Date().toLocaleString()}\n\n`;
        
        if (results.checks.espn_api) {
          const apiStatus = results.checks.espn_api.status === 'success' ? '✅' : '⚠️';
          message += `**ESPN API**: ${apiStatus}\n`;
          message += `  • League: ${results.checks.espn_api.league_name}\n`;
          message += `  • Current Week: ${results.checks.espn_api.current_week}\n`;
          if (results.checks.espn_api.error) {
            message += `  • Issue: ${results.checks.espn_api.error}\n`;
          }
        }
        
        if (results.checks.cost_monitoring) {
          message += `\n**Cost Monitoring**: ✅\n`;
          message += `  • Daily: $${results.checks.cost_monitoring.daily_cost.toFixed(4)}\n`;
          message += `  • Weekly: $${results.checks.cost_monitoring.weekly_cost.toFixed(4)}\n`;
        }
        
        if (results.checks.fantasypros) {
          const fpStatus = results.checks.fantasypros.status === 'success' ? '✅' : 
                          results.checks.fantasypros.status === 'info' ? '💡' : '⚠️';
          message += `\n**FantasyPros**: ${fpStatus}\n`;
          if (results.checks.fantasypros.enabled) {
            message += `  • Players: ${results.checks.fantasypros.playerCount}\n`;
            message += `  • Data: Enhanced rankings available\n`;
          } else {
            message += `  • Status: ${results.checks.fantasypros.note || results.checks.fantasypros.error || 'Disabled'}\n`;
          }
        }
        
        if (results.checks.environment) {
          const envStatus = results.checks.environment.status === 'success' ? '✅' : '⚠️';
          message += `\n**Environment**: ${envStatus}\n`;
          message += `  • Configured Leagues: ${results.checks.environment.configured_leagues.join(', ')}\n`;
          if (results.checks.environment.missing_variables.length > 0) {
            message += `  • Missing: ${results.checks.environment.missing_variables.join(', ')}\n`;
          }
        }
        
        message += `\n📝 **Summary**: ${results.summary}`;
        
        // Add helpful guidance for ESPN API issues
        if (results.checks.espn_api && results.checks.espn_api.status === 'warning') {
          message += `\n\n💡 **Action Needed**: ESPN cookies may be expired. Update ESPN_S2 and ESPN_SWID secrets with fresh values from your browser.`;
        }
      } else {
        message = `❌ **Fantasy Automation Error**\n\n`;
        message += `📋 **Task**: General Health Check\n`;
        message += `🚨 **Error**: ${results.error}\n`;
        message += `⏰ **Time**: ${new Date().toLocaleString()}\n\n`;
        message += `📊 **Environment Status**: ${process.env.ESPN_S2 ? '✅ ESPN cookies configured' : '❌ ESPN cookies missing'}\n`;
        message += `🤖 **LLM Provider**: ${process.env.DEFAULT_LLM_PROVIDER || 'Not set'}\n`;
      }
      
      // Send to Discord if configured
      if (notificationConfig.discord) {
        try {
          console.log('🔗 Discord webhook URL:', notificationConfig.discord.webhookUrl);
          const axios = (await import('axios')).default;
          const response = await axios.post(notificationConfig.discord.webhookUrl, {
            username: "Fantasy Football AI",
            avatar_url: "https://cdn-icons-png.flaticon.com/512/3659/3659899.png",
            content: message
          });
          console.log('✅ Discord notification sent:', response.status);
        } catch (err) {
          console.error('Failed to send Discord notification:', err.message);
          console.error('Error details:', err.response?.status, err.response?.statusText, err.response?.data);
        }
      }
      
      // Send to Slack if configured
      if (notificationConfig.slack) {
        try {
          const axios = (await import('axios')).default;
          await axios.post(notificationConfig.slack.webhookUrl, {
            text: message,
            channel: notificationConfig.slack.channel
          });
          console.log('✅ Slack notification sent');
        } catch (err) {
          console.error('Failed to send Slack notification:', err.message);
        }
      }
    }
  } catch (notificationError) {
    console.error('Failed to send any notifications:', notificationError.message);
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