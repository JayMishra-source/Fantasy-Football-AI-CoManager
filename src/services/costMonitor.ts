import fs from 'fs';
import path from 'path';
import axios from 'axios';

export interface CostEntry {
  timestamp: string;
  provider: string;
  model: string;
  cost: number;
  tokens_used: number;
  action_type: string;
  week: number;
}

export interface CostLimits {
  daily_limit: number;
  weekly_limit: number;
  monthly_limit: number;
  per_analysis_limit: number;
}

export interface CostAlert {
  type: 'daily' | 'weekly' | 'monthly' | 'per_analysis' | 'approaching_limit';
  current_cost: number;
  limit: number;
  percentage: number;
  period: string;
  recommendation: string;
}

export class CostMonitor {
  private costLogPath: string;
  private limits: CostLimits;
  private slackWebhookUrl?: string;

  constructor(costLogPath?: string) {
    this.costLogPath = costLogPath || path.join(process.cwd(), 'cost-log.json');
    
    // Default cost limits (in USD)
    this.limits = {
      daily_limit: parseFloat(process.env.COST_DAILY_LIMIT || '2.00'),      // $2/day
      weekly_limit: parseFloat(process.env.COST_WEEKLY_LIMIT || '10.00'),   // $10/week  
      monthly_limit: parseFloat(process.env.COST_MONTHLY_LIMIT || '35.00'), // $35/month
      per_analysis_limit: parseFloat(process.env.COST_PER_ANALYSIS_LIMIT || '1.00') // $1 per analysis
    };

    this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  }

  /**
   * Log a new cost entry and check for limit violations
   */
  async logCost(entry: Omit<CostEntry, 'timestamp'>): Promise<CostAlert[]> {
    const costEntry: CostEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };

    // Load existing costs
    const costs = this.loadCosts();
    costs.push(costEntry);
    
    // Save updated costs
    this.saveCosts(costs);

    // Check for alerts
    const alerts = this.checkLimits(costs, costEntry);
    
    // Send notifications for any alerts
    for (const alert of alerts) {
      await this.sendAlert(alert, costEntry);
    }

    return alerts;
  }

  /**
   * Get cost summary for different time periods
   */
  getCostSummary(): {
    today: number;
    this_week: number;
    this_month: number;
    total: number;
    entry_count: number;
    average_per_analysis: number;
    limits: CostLimits;
  } {
    const costs = this.loadCosts();
    const now = new Date();
    
    // Calculate periods
    const today = now.toISOString().split('T')[0];
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Start of week
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Filter costs by period
    const todayCosts = costs.filter(c => c.timestamp.startsWith(today));
    const weekCosts = costs.filter(c => new Date(c.timestamp) >= weekStart);
    const monthCosts = costs.filter(c => new Date(c.timestamp) >= monthStart);

    return {
      today: todayCosts.reduce((sum, c) => sum + c.cost, 0),
      this_week: weekCosts.reduce((sum, c) => sum + c.cost, 0),
      this_month: monthCosts.reduce((sum, c) => sum + c.cost, 0),
      total: costs.reduce((sum, c) => sum + c.cost, 0),
      entry_count: costs.length,
      average_per_analysis: costs.length > 0 ? costs.reduce((sum, c) => sum + c.cost, 0) / costs.length : 0,
      limits: this.limits
    };
  }

  /**
   * Check if any cost limits are being approached or exceeded
   */
  private checkLimits(allCosts: CostEntry[], newEntry: CostEntry): CostAlert[] {
    const alerts: CostAlert[] = [];
    const now = new Date();
    
    // Check per-analysis limit
    if (newEntry.cost > this.limits.per_analysis_limit) {
      alerts.push({
        type: 'per_analysis',
        current_cost: newEntry.cost,
        limit: this.limits.per_analysis_limit,
        percentage: (newEntry.cost / this.limits.per_analysis_limit) * 100,
        period: 'single analysis',
        recommendation: `This analysis cost $${newEntry.cost.toFixed(4)}, which exceeds your per-analysis limit of $${this.limits.per_analysis_limit}. Consider switching to a cheaper model like gemini-1.5-flash.`
      });
    }

    // Check daily limit
    const today = now.toISOString().split('T')[0];
    const todayCosts = allCosts.filter(c => c.timestamp.startsWith(today));
    const dailyTotal = todayCosts.reduce((sum, c) => sum + c.cost, 0);
    
    if (dailyTotal > this.limits.daily_limit) {
      alerts.push({
        type: 'daily',
        current_cost: dailyTotal,
        limit: this.limits.daily_limit,
        percentage: (dailyTotal / this.limits.daily_limit) * 100,
        period: 'today',
        recommendation: `Daily spending limit exceeded. Consider pausing automation for today or switching to a cheaper provider.`
      });
    } else if (dailyTotal > this.limits.daily_limit * 0.8) {
      alerts.push({
        type: 'approaching_limit',
        current_cost: dailyTotal,
        limit: this.limits.daily_limit,
        percentage: (dailyTotal / this.limits.daily_limit) * 100,
        period: 'today',
        recommendation: `You're approaching your daily limit. Consider using a cheaper model for remaining analyses today.`
      });
    }

    // Check weekly limit
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekCosts = allCosts.filter(c => new Date(c.timestamp) >= weekStart);
    const weeklyTotal = weekCosts.reduce((sum, c) => sum + c.cost, 0);
    
    if (weeklyTotal > this.limits.weekly_limit) {
      alerts.push({
        type: 'weekly',
        current_cost: weeklyTotal,
        limit: this.limits.weekly_limit,
        percentage: (weeklyTotal / this.limits.weekly_limit) * 100,
        period: 'this week',
        recommendation: `Weekly spending limit exceeded. Consider reducing automation frequency or switching to notification-only mode.`
      });
    }

    // Check monthly limit
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthCosts = allCosts.filter(c => new Date(c.timestamp) >= monthStart);
    const monthlyTotal = monthCosts.reduce((sum, c) => sum + c.cost, 0);
    
    if (monthlyTotal > this.limits.monthly_limit) {
      alerts.push({
        type: 'monthly',
        current_cost: monthlyTotal,
        limit: this.limits.monthly_limit,
        percentage: (monthlyTotal / this.limits.monthly_limit) * 100,
        period: 'this month',
        recommendation: `Monthly spending limit exceeded. Automation should be paused until next month or limits should be increased.`
      });
    }

    return alerts;
  }

  /**
   * Send cost alert notification
   */
  private async sendAlert(alert: CostAlert, entry: CostEntry): Promise<void> {
    const message = this.formatAlertMessage(alert, entry);
    
    if (this.slackWebhookUrl) {
      try {
        await this.sendSlackAlert(message, alert);
        console.log(`💰 Cost alert sent to Slack: ${alert.type}`);
      } catch (error) {
        console.error('Failed to send Slack cost alert:', error);
      }
    } else {
      // Fallback to console logging
      console.warn('\n🚨 COST ALERT 🚨');
      console.warn(message);
      console.warn('Set SLACK_WEBHOOK_URL environment variable to receive notifications\n');
    }
  }

  /**
   * Format alert message for notifications
   */
  private formatAlertMessage(alert: CostAlert, entry: CostEntry): string {
    const emoji = alert.type === 'approaching_limit' ? '⚠️' : '🚨';
    const urgency = alert.percentage > 100 ? 'EXCEEDED' : 'APPROACHING';
    
    let message = `${emoji} **COST LIMIT ${urgency}** ${emoji}\n\n`;
    message += `**Provider:** ${entry.provider} (${entry.model})\n`;
    message += `**Period:** ${alert.period}\n`;
    message += `**Current Cost:** $${alert.current_cost.toFixed(4)}\n`;
    message += `**Limit:** $${alert.limit.toFixed(2)}\n`;
    message += `**Usage:** ${alert.percentage.toFixed(1)}% of limit\n\n`;
    message += `**Recommendation:** ${alert.recommendation}\n\n`;
    
    if (alert.type === 'monthly' && alert.percentage > 100) {
      message += `🛑 **AUTOMATION SHOULD BE PAUSED** 🛑\n`;
      message += `Consider switching to notification-only mode until next month.\n\n`;
    }
    
    message += `💡 **Cost-saving options:**\n`;
    message += `• Switch to gemini-1.5-flash ($0.075/$0.30 per 1M tokens)\n`;
    message += `• Use notification-only mode (free)\n`;
    message += `• Reduce analysis frequency\n`;
    message += `• Increase cost limits in environment variables\n\n`;
    message += `📊 Set limits: COST_DAILY_LIMIT, COST_WEEKLY_LIMIT, COST_MONTHLY_LIMIT`;

    return message;
  }

  /**
   * Send Slack notification
   */
  private async sendSlackAlert(message: string, alert: CostAlert): Promise<void> {
    if (!this.slackWebhookUrl) return;

    const color = alert.percentage > 100 ? '#ff0000' : '#ffa500'; // Red or Orange
    const urgency = alert.percentage > 100 ? 'CRITICAL' : 'WARNING';
    
    const payload = {
      username: 'Fantasy Cost Monitor',
      icon_emoji: ':money_with_wings:',
      text: `🚨 ${urgency}: Fantasy Football Cost Limit Alert`,
      attachments: [{
        color,
        fields: [
          {
            title: 'Cost Alert',
            value: message,
            short: false
          },
          {
            title: 'Current Usage',
            value: `$${alert.current_cost.toFixed(4)} / $${alert.limit.toFixed(2)}`,
            short: true
          },
          {
            title: 'Percentage',
            value: `${alert.percentage.toFixed(1)}%`,
            short: true
          }
        ],
        footer: 'Fantasy Cost Monitor',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    await axios.post(this.slackWebhookUrl, payload);
  }

  /**
   * Load costs from file
   */
  private loadCosts(): CostEntry[] {
    try {
      if (!fs.existsSync(this.costLogPath)) {
        return [];
      }
      
      const content = fs.readFileSync(this.costLogPath, 'utf8');
      return JSON.parse(content) as CostEntry[];
    } catch (error) {
      console.warn('Failed to load cost log, starting fresh:', error);
      return [];
    }
  }

  /**
   * Save costs to file
   */
  private saveCosts(costs: CostEntry[]): void {
    try {
      // Keep only last 1000 entries to prevent file from growing too large
      const recentCosts = costs.slice(-1000);
      fs.writeFileSync(this.costLogPath, JSON.stringify(recentCosts, null, 2));
    } catch (error) {
      console.error('Failed to save cost log:', error);
    }
  }

  /**
   * Reset costs for a new period (for testing or manual reset)
   */
  resetCosts(): void {
    try {
      fs.writeFileSync(this.costLogPath, '[]');
      console.log('Cost log reset successfully');
    } catch (error) {
      console.error('Failed to reset cost log:', error);
    }
  }

  /**
   * Get provider cost recommendations
   */
  getProviderRecommendations(): { provider: string; model: string; cost_per_analysis: string; best_for: string }[] {
    return [
      {
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        cost_per_analysis: '$0.01-0.03',
        best_for: 'Budget-conscious users'
      },
      {
        provider: 'openai', 
        model: 'gpt-4o-mini',
        cost_per_analysis: '$0.02-0.05',
        best_for: 'Balanced cost/quality'
      },
      {
        provider: 'perplexity',
        model: 'llama-3.1-sonar-large-128k-online',
        cost_per_analysis: '$0.05-0.10',
        best_for: 'Real-time data needs'
      },
      {
        provider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        cost_per_analysis: '$0.10-0.25',
        best_for: 'Highest quality analysis'
      }
    ];
  }
}

// Singleton instance
export const costMonitor = new CostMonitor();