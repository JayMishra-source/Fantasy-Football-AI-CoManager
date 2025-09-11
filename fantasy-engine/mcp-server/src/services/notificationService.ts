import axios from 'axios';
import { AutomationReport } from './automationService.js';

export interface NotificationConfig {
  slack?: {
    webhookUrl: string;
    channel: string;
  };
  email?: {
    service: string;
    user: string;
    pass: string;
    to: string[];
  };
  discord?: {
    webhookUrl: string;
  };
  pushover?: {
    token: string;
    user: string;
  };
}

export class NotificationService {
  private config: NotificationConfig;

  constructor(config: NotificationConfig) {
    this.config = config;
  }

  async sendAutomationReport(report: AutomationReport, leagueName: string = 'League'): Promise<void> {
    const message = this.formatAutomationReport(report, leagueName);
    
    // Send to all configured channels
    const notifications: Promise<void>[] = [];
    
    if (this.config.slack) {
      notifications.push(this.sendSlackMessage(message, report));
    }
    
    if (this.config.discord) {
      notifications.push(this.sendDiscordMessage(message, report));
    }
    
    if (this.config.pushover) {
      notifications.push(this.sendPushoverMessage(message, report));
    }

    await Promise.allSettled(notifications);
  }

  async sendUrgentAlert(alert: {
    type: 'injury' | 'waiver' | 'lineup';
    player?: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<void> {
    const urgentMessage = this.formatUrgentAlert(alert);
    
    // For critical alerts, send to all channels
    if (alert.severity === 'critical') {
      await Promise.allSettled([
        this.config.slack && this.sendSlackMessage(urgentMessage),
        this.config.discord && this.sendDiscordMessage(urgentMessage),
        this.config.pushover && this.sendPushoverMessage(urgentMessage)
      ].filter(Boolean));
    } else {
      // For lower severity, just send to primary channel (Slack)
      if (this.config.slack) {
        await this.sendSlackMessage(urgentMessage);
      }
    }
  }

  private formatAutomationReport(report: AutomationReport, leagueName: string): string {
    const emoji = this.getWeekEmoji(report.week);
    
    let message = `${emoji} **${leagueName} - Week ${report.week} Fantasy Report**\n\n`;
    
    // Weekly projection
    message += `📊 **Team Projection**: ${report.weeklyProjection.toFixed(1)} points\n`;
    message += `⚠️ **Risk Level**: ${report.riskAssessment}\n\n`;

    // Lineup changes
    if (report.lineupChanges.length > 0) {
      message += `🔄 **Recommended Lineup Changes** (${report.lineupChanges.length}):\n`;
      const highConfidence = report.lineupChanges.filter(c => c.confidence > 70);
      
      highConfidence.slice(0, 5).forEach(change => {
        const action = change.action === 'start' ? '✅ START' : '❌ BENCH';
        message += `${action} ${change.player.fullName} (${change.player.position}) - ${change.confidence.toFixed(0)}% confidence\n`;
        message += `  └ ${change.reasoning}\n`;
      });
      
      if (highConfidence.length > 5) {
        message += `  ... and ${highConfidence.length - 5} more recommendations\n`;
      }
      message += '\n';
    }

    // Injury alerts
    if (report.injuryAlerts.length > 0) {
      message += `🏥 **Injury Alerts** (${report.injuryAlerts.length}):\n`;
      report.injuryAlerts.forEach(player => {
        const severity = player.injuryStatus === 'OUT' ? '🔴' : 
                        player.injuryStatus === 'DOUBTFUL' ? '🟡' : '🟠';
        message += `${severity} ${player.fullName} (${player.position}) - ${player.injuryStatus}\n`;
      });
      message += '\n';
    }

    // Top waiver targets
    if (report.waiverRecommendations.length > 0) {
      message += `🎯 **Top Waiver Targets**:\n`;
      const topTargets = report.waiverRecommendations
        .filter(r => r.action === 'claim')
        .slice(0, 3);
      
      topTargets.forEach((target, index) => {
        message += `${index + 1}. ${target.player.fullName} (${target.player.position}) - Priority ${target.priority}/10\n`;
        message += `   💰 Suggested bid: $${target.faabBid}\n`;
        if (target.dropCandidate) {
          message += `   📤 Drop: ${target.dropCandidate.fullName}\n`;
        }
      });
      message += '\n';
    }

    message += `⏰ Generated: ${report.timestamp.toLocaleString()}\n`;
    message += `🤖 Powered by Fantasy AI Manager`;

    return message;
  }

  private formatUrgentAlert(alert: {
    type: 'injury' | 'waiver' | 'lineup';
    player?: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }): string {
    const severityEmojis = {
      low: '🔵',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    };

    const typeEmojis = {
      injury: '🏥',
      waiver: '🎯',
      lineup: '🔄'
    };

    let message = `${severityEmojis[alert.severity]} ${typeEmojis[alert.type]} **FANTASY ALERT**\n\n`;
    
    if (alert.player) {
      message += `👤 **Player**: ${alert.player}\n`;
    }
    
    message += `📝 **Alert**: ${alert.message}\n`;
    message += `⏰ **Time**: ${new Date().toLocaleString()}\n`;
    
    if (alert.severity === 'critical') {
      message += `\n🚨 **ACTION REQUIRED IMMEDIATELY**`;
    }

    return message;
  }

  private async sendSlackMessage(message: string, report?: AutomationReport): Promise<void> {
    if (!this.config.slack) return;

    try {
      const payload: any = {
        channel: this.config.slack.channel || '#fantasy-football',
        username: 'Fantasy AI Manager',
        icon_emoji: ':football:',
        text: message,
      };

      // Add rich formatting for reports
      if (report) {
        payload.attachments = [{
          color: this.getReportColor(report),
          fields: [
            {
              title: 'Weekly Projection',
              value: `${report.weeklyProjection.toFixed(1)} points`,
              short: true
            },
            {
              title: 'Risk Assessment',
              value: report.riskAssessment,
              short: true
            }
          ],
          footer: 'Fantasy AI Manager',
          ts: Math.floor(report.timestamp.getTime() / 1000)
        }];
      }

      await axios.post(this.config.slack.webhookUrl, payload);
    } catch (error: any) {
      console.error('Failed to send Slack notification:', error.message);
    }
  }

  private async sendDiscordMessage(message: string, report?: AutomationReport): Promise<void> {
    if (!this.config.discord) return;

    try {
      const payload: any = {
        username: 'Fantasy AI Manager',
        avatar_url: 'https://cdn-icons-png.flaticon.com/512/3115/3115768.png',
        content: message.substring(0, 2000), // Discord limit
      };

      // Add embed for reports
      if (report) {
        payload.embeds = [{
          title: `Week ${report.week} Fantasy Report`,
          color: parseInt(this.getReportColor(report).replace('#', ''), 16),
          fields: [
            {
              name: 'Projected Points',
              value: report.weeklyProjection.toFixed(1),
              inline: true
            },
            {
              name: 'Risk Level',
              value: report.riskAssessment,
              inline: true
            }
          ],
          timestamp: report.timestamp.toISOString()
        }];
      }

      await axios.post(this.config.discord.webhookUrl, payload);
    } catch (error: any) {
      console.error('Failed to send Discord notification:', error.message);
    }
  }

  private async sendPushoverMessage(message: string, report?: AutomationReport): Promise<void> {
    if (!this.config.pushover) return;

    try {
      const title = report ? `Week ${report.week} Fantasy Report` : 'Fantasy Alert';
      const priority = (report?.injuryAlerts?.length ?? 0) > 0 ? 1 : 0;

      await axios.post('https://api.pushover.net/1/messages.json', {
        token: this.config.pushover.token,
        user: this.config.pushover.user,
        title,
        message: message.substring(0, 1024), // Pushover limit
        priority,
        sound: priority > 0 ? 'siren' : 'pushover'
      });
    } catch (error: any) {
      console.error('Failed to send Pushover notification:', error.message);
    }
  }

  private getReportColor(report: AutomationReport): string {
    const injuryCount = report.injuryAlerts?.length ?? 0;
    if (injuryCount >= 2) return '#ff0000'; // Red for multiple injuries
    if (injuryCount === 1) return '#ffa500'; // Orange for one injury
    if (report.weeklyProjection >= 120) return '#00ff00';   // Green for high projection
    if (report.weeklyProjection >= 100) return '#ffff00';   // Yellow for medium
    return '#ff6600'; // Orange for low projection
  }

  private getWeekEmoji(week: number): string {
    const weekEmojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
    return weekEmojis[week - 1] || '🏈';
  }
}

// Factory function for easy setup
export function createNotificationService(config: NotificationConfig): NotificationService {
  return new NotificationService(config);
}

// Environment-based configuration
export function getNotificationConfigFromEnv(): NotificationConfig {
  const config: NotificationConfig = {};

  // Slack configuration
  if (process.env.SLACK_WEBHOOK_URL) {
    config.slack = {
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_CHANNEL || '#fantasy-football'
    };
  }

  // Discord configuration
  if (process.env.DISCORD_WEBHOOK_URL) {
    config.discord = {
      webhookUrl: process.env.DISCORD_WEBHOOK_URL
    };
  }

  // Pushover configuration
  if (process.env.PUSHOVER_TOKEN && process.env.PUSHOVER_USER) {
    config.pushover = {
      token: process.env.PUSHOVER_TOKEN,
      user: process.env.PUSHOVER_USER
    };
  }

  return config;
}