import { writeFileSync, existsSync, readFileSync } from 'fs';
import { loadProductionConfig } from '../config/production.js';

export interface SystemMetrics {
  timestamp: string;
  system: {
    status: 'healthy' | 'warning' | 'critical';
    uptime: number;
    version: string;
  };
  espn: {
    connectivity: 'connected' | 'degraded' | 'failed';
    lastSuccessfulCall: string;
    errorRate: number;
  };
  llm: {
    provider: string;
    status: 'active' | 'fallback' | 'failed';
    costToday: number;
    responseTime: number;
  };
  performance: {
    successRate: number;
    averageExecutionTime: number;
    lastSuccessfulRun: string;
  };
  alerts: Alert[];
}

export interface Alert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  component: string;
  message: string;
  timestamp: string;
  resolved?: boolean;
}

export class SystemMonitor {
  private config = loadProductionConfig();
  private metricsFile = 'system-metrics.json';
  private alertsFile = 'active-alerts.json';

  async collectMetrics(): Promise<SystemMetrics> {
    const timestamp = new Date().toISOString();
    
    const metrics: SystemMetrics = {
      timestamp,
      system: await this.getSystemMetrics(),
      espn: await this.getESPNMetrics(),
      llm: await this.getLLMMetrics(),
      performance: await this.getPerformanceMetrics(),
      alerts: await this.getActiveAlerts()
    };

    // Save metrics
    writeFileSync(this.metricsFile, JSON.stringify(metrics, null, 2));
    
    return metrics;
  }

  private async getSystemMetrics() {
    return {
      status: 'healthy' as const,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    };
  }

  private async getESPNMetrics() {
    try {
      const { espnApi } = await import('@fantasy-ai/shared');
      
      // Test ESPN connectivity
      const startTime = Date.now();
      const leagueId = this.config.leagues[0]?.id;
      
      if (!leagueId) {
        return {
          connectivity: 'failed' as const,
          lastSuccessfulCall: 'never',
          errorRate: 100
        };
      }
      
      await espnApi.getLeagueInfo(leagueId);
      const responseTime = Date.now() - startTime;
      
      return {
        connectivity: responseTime < 5000 ? 'connected' as const : 'degraded' as const,
        lastSuccessfulCall: new Date().toISOString(),
        errorRate: 0
      };
      
    } catch (error) {
      return {
        connectivity: 'failed' as const,
        lastSuccessfulCall: this.getLastSuccessfulCall('espn'),
        errorRate: 100
      };
    }
  }

  private async getLLMMetrics() {
    try {
      const { llmConfig, getCostSummary } = await import('@fantasy-ai/shared');
      
      // Get current LLM info
      const currentInfo = llmConfig.getCurrentInfo();
      
      // Get cost information
      const costInfo = await getCostSummary();
      
      // Test response time
      const startTime = Date.now();
      const testResult = await llmConfig.testConfiguration();
      const responseTime = Date.now() - startTime;
      
      return {
        provider: currentInfo?.provider || 'unknown',
        status: testResult.success ? 'active' as const : 'failed' as const,
        costToday: costInfo?.dailyCost || 0,
        responseTime
      };
      
    } catch (error) {
      return {
        provider: this.config.llm.primaryProvider,
        status: 'failed' as const,
        costToday: 0,
        responseTime: 0
      };
    }
  }

  private async getPerformanceMetrics() {
    try {
      const { getPerformanceMetrics } = await import('@fantasy-ai/shared');
      const perfData = await getPerformanceMetrics({});
      
      return {
        successRate: perfData.metrics?.successRate || 0,
        averageExecutionTime: 0, // Would be calculated from execution history
        lastSuccessfulRun: this.getLastSuccessfulCall('automation')
      };
      
    } catch (error) {
      return {
        successRate: 0,
        averageExecutionTime: 0,
        lastSuccessfulRun: 'unknown'
      };
    }
  }

  private async getActiveAlerts(): Promise<Alert[]> {
    try {
      if (existsSync(this.alertsFile)) {
        const alertsData = readFileSync(this.alertsFile, 'utf8');
        return JSON.parse(alertsData).filter((alert: Alert) => !alert.resolved);
      }
    } catch (error) {
      console.warn('Could not load alerts:', error);
    }
    
    return [];
  }

  private getLastSuccessfulCall(component: string): string {
    try {
      if (existsSync(this.metricsFile)) {
        const metricsData = JSON.parse(readFileSync(this.metricsFile, 'utf8'));
        
        if (component === 'espn' && metricsData.espn?.connectivity === 'connected') {
          return metricsData.timestamp;
        }
        
        if (component === 'automation' && metricsData.system?.status === 'healthy') {
          return metricsData.timestamp;
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return 'unknown';
  }

  async checkThresholds(metrics: SystemMetrics): Promise<Alert[]> {
    const newAlerts: Alert[] = [];
    
    // ESPN connectivity alerts
    if (metrics.espn.connectivity === 'failed') {
      newAlerts.push({
        id: `espn-failed-${Date.now()}`,
        level: 'critical',
        component: 'ESPN API',
        message: 'ESPN API connectivity failed. Check authentication cookies.',
        timestamp: metrics.timestamp
      });
    } else if (metrics.espn.connectivity === 'degraded') {
      newAlerts.push({
        id: `espn-slow-${Date.now()}`,
        level: 'warning',
        component: 'ESPN API',
        message: 'ESPN API response time is slow. Performance may be impacted.',
        timestamp: metrics.timestamp
      });
    }
    
    // LLM provider alerts
    if (metrics.llm.status === 'failed') {
      newAlerts.push({
        id: `llm-failed-${Date.now()}`,
        level: 'critical',
        component: 'LLM Provider',
        message: `LLM provider ${metrics.llm.provider} is not responding. Check API keys and quotas.`,
        timestamp: metrics.timestamp
      });
    }
    
    // Cost threshold alerts
    if (metrics.llm.costToday > this.config.llm.costLimits.daily * 0.8) {
      newAlerts.push({
        id: `cost-warning-${Date.now()}`,
        level: 'warning',
        component: 'Cost Management',
        message: `Daily LLM costs ($${metrics.llm.costToday.toFixed(2)}) approaching limit ($${this.config.llm.costLimits.daily}).`,
        timestamp: metrics.timestamp
      });
    }
    
    if (metrics.llm.costToday >= this.config.llm.costLimits.daily) {
      newAlerts.push({
        id: `cost-exceeded-${Date.now()}`,
        level: 'critical',
        component: 'Cost Management',
        message: `Daily LLM cost limit exceeded! Current: $${metrics.llm.costToday.toFixed(2)}, Limit: $${this.config.llm.costLimits.daily}`,
        timestamp: metrics.timestamp
      });
    }
    
    // Performance alerts
    if (metrics.performance.successRate < 70) {
      newAlerts.push({
        id: `performance-poor-${Date.now()}`,
        level: 'warning',
        component: 'Performance',
        message: `Success rate (${metrics.performance.successRate}%) is below acceptable threshold.`,
        timestamp: metrics.timestamp
      });
    }
    
    // Response time alerts
    if (metrics.llm.responseTime > 30000) { // 30 seconds
      newAlerts.push({
        id: `response-slow-${Date.now()}`,
        level: 'warning',
        component: 'LLM Response Time',
        message: `LLM response time (${(metrics.llm.responseTime / 1000).toFixed(1)}s) is very slow.`,
        timestamp: metrics.timestamp
      });
    }
    
    return newAlerts;
  }

  async saveAlerts(alerts: Alert[]): Promise<void> {
    try {
      // Load existing alerts
      let existingAlerts: Alert[] = [];
      if (existsSync(this.alertsFile)) {
        existingAlerts = JSON.parse(readFileSync(this.alertsFile, 'utf8'));
      }
      
      // Add new alerts
      const allAlerts = [...existingAlerts, ...alerts];
      
      // Save alerts
      writeFileSync(this.alertsFile, JSON.stringify(allAlerts, null, 2));
      
    } catch (error) {
      console.error('Failed to save alerts:', error);
    }
  }

  async sendNotifications(alerts: Alert[]): Promise<void> {
    const criticalAlerts = alerts.filter(a => a.level === 'critical');
    const warningAlerts = alerts.filter(a => a.level === 'warning');
    
    if (criticalAlerts.length === 0 && warningAlerts.length === 0) {
      return;
    }
    
    // Send Discord notification if webhook is configured
    if (this.config.schedule.notifications.discord) {
      await this.sendDiscordAlert(criticalAlerts, warningAlerts);
    }
    
    // Send Slack notification if webhook is configured
    if (this.config.schedule.notifications.slack) {
      await this.sendSlackAlert(criticalAlerts, warningAlerts);
    }
  }

  private async sendDiscordAlert(criticalAlerts: Alert[], warningAlerts: Alert[]): Promise<void> {
    try {
      const webhookUrl = this.config.schedule.notifications.discord!;
      
      const color = criticalAlerts.length > 0 ? 15158332 : 16776960; // Red or Yellow
      const emoji = criticalAlerts.length > 0 ? '🚨' : '⚠️';
      
      const alertSummary = [
        ...criticalAlerts.map(a => `🚨 **${a.component}**: ${a.message}`),
        ...warningAlerts.map(a => `⚠️ **${a.component}**: ${a.message}`)
      ].join('\n');
      
      const message = {
        embeds: [{
          title: `${emoji} Fantasy AI System Alert`,
          description: `**System Health Issues Detected**\n\n${alertSummary}`,
          color,
          fields: [
            {
              name: '🚨 Critical',
              value: criticalAlerts.length.toString(),
              inline: true
            },
            {
              name: '⚠️ Warnings', 
              value: warningAlerts.length.toString(),
              inline: true
            },
            {
              name: '📅 Time',
              value: new Date().toLocaleString(),
              inline: true
            }
          ],
          footer: {
            text: 'Fantasy AI Production Monitoring'
          }
        }]
      };
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
      
      if (!response.ok) {
        console.error('Failed to send Discord alert:', response.statusText);
      }
      
    } catch (error) {
      console.error('Error sending Discord alert:', error);
    }
  }

  private async sendSlackAlert(criticalAlerts: Alert[], warningAlerts: Alert[]): Promise<void> {
    try {
      const webhookUrl = this.config.schedule.notifications.slack!;
      
      const emoji = criticalAlerts.length > 0 ? ':rotating_light:' : ':warning:';
      const alertText = [
        ...criticalAlerts.map(a => `:rotating_light: *${a.component}*: ${a.message}`),
        ...warningAlerts.map(a => `:warning: *${a.component}*: ${a.message}`)
      ].join('\n');
      
      const message = {
        text: `${emoji} Fantasy AI System Alert`,
        attachments: [{
          color: criticalAlerts.length > 0 ? 'danger' : 'warning',
          fields: [
            {
              title: 'System Health Issues',
              value: alertText,
              short: false
            },
            {
              title: 'Critical Alerts',
              value: criticalAlerts.length.toString(),
              short: true
            },
            {
              title: 'Warning Alerts', 
              value: warningAlerts.length.toString(),
              short: true
            }
          ],
          footer: 'Fantasy AI Production Monitoring',
          ts: Math.floor(Date.now() / 1000)
        }]
      };
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
      
      if (!response.ok) {
        console.error('Failed to send Slack alert:', response.statusText);
      }
      
    } catch (error) {
      console.error('Error sending Slack alert:', error);
    }
  }

  async generateHealthReport(): Promise<string> {
    const metrics = await this.collectMetrics();
    const alerts = await this.checkThresholds(metrics);
    
    let report = '🏥 Fantasy AI System Health Report\n';
    report += '=====================================\n\n';
    
    // System status
    report += `🖥️  **System Status**: ${metrics.system.status.toUpperCase()}\n`;
    report += `📅 **Timestamp**: ${metrics.timestamp}\n`;
    report += `⏱️  **Uptime**: ${Math.floor(metrics.system.uptime / 3600)}h ${Math.floor((metrics.system.uptime % 3600) / 60)}m\n\n`;
    
    // ESPN status
    report += `🏈 **ESPN API**: ${metrics.espn.connectivity.toUpperCase()}\n`;
    report += `   Last Success: ${metrics.espn.lastSuccessfulCall}\n`;
    report += `   Error Rate: ${metrics.espn.errorRate}%\n\n`;
    
    // LLM status
    report += `🤖 **LLM Provider**: ${metrics.llm.provider} (${metrics.llm.status.toUpperCase()})\n`;
    report += `   Daily Cost: $${metrics.llm.costToday.toFixed(2)}\n`;
    report += `   Response Time: ${metrics.llm.responseTime}ms\n\n`;
    
    // Performance
    report += `📊 **Performance**\n`;
    report += `   Success Rate: ${metrics.performance.successRate}%\n`;
    report += `   Last Success: ${metrics.performance.lastSuccessfulRun}\n\n`;
    
    // Alerts
    if (alerts.length > 0) {
      report += `🚨 **Active Alerts** (${alerts.length})\n`;
      alerts.forEach(alert => {
        const icon = alert.level === 'critical' ? '🚨' : alert.level === 'warning' ? '⚠️' : 'ℹ️';
        report += `   ${icon} ${alert.component}: ${alert.message}\n`;
      });
    } else {
      report += `✅ **No Active Alerts**\n`;
    }
    
    return report;
  }
}

// Standalone monitoring runner
export async function runSystemMonitoring(): Promise<void> {
  const monitor = new SystemMonitor();
  
  console.log('🏥 Running system health monitoring...');
  
  const metrics = await monitor.collectMetrics();
  const alerts = await monitor.checkThresholds(metrics);
  
  if (alerts.length > 0) {
    console.log(`🚨 Found ${alerts.length} alerts`);
    await monitor.saveAlerts(alerts);
    await monitor.sendNotifications(alerts);
  } else {
    console.log('✅ No alerts detected');
  }
  
  const report = await monitor.generateHealthReport();
  console.log('\n' + report);
  
  writeFileSync('health-report.txt', report);
}