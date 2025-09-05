# Cost Monitoring System

The LLM-agnostic fantasy automation now includes built-in cost monitoring with configurable limits and automatic alerts.

## 🚨 Automatic Alerts

The system automatically monitors your LLM usage costs and sends **Slack notifications** when limits are approached or exceeded.

### Default Limits

| Period | Default Limit | Purpose |
|--------|---------------|---------|
| Per Analysis | $1.00 | Prevents expensive single calls |
| Daily | $2.00 | Daily spending cap |
| Weekly | $10.00 | Weekly budget control |
| Monthly | $35.00 | Monthly cost management |

### Alert Types

- **🟡 Approaching Limit**: 80%+ of limit used
- **🔴 Limit Exceeded**: 100%+ of limit used
- **🚨 Critical**: Per-analysis limit exceeded

## 📊 Monitoring Tools

### MCP Tools (Use with Claude Desktop)

```bash
# Get current cost summary
get_cost_summary

# Get cost-optimized provider recommendations  
get_provider_recommendations

# Reset cost tracking (admin only)
reset_cost_tracking
```

### Manual Testing

```bash
# Test cost monitoring system
npm run build
node test-cost-monitoring.js
```

## ⚙️ Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Cost limits (in USD)
COST_DAILY_LIMIT=2.00
COST_WEEKLY_LIMIT=10.00  
COST_MONTHLY_LIMIT=35.00
COST_PER_ANALYSIS_LIMIT=1.00

# Slack notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
```

### GitHub Secrets

For automated runs, add these to GitHub repository secrets:

```
COST_DAILY_LIMIT=2.00
COST_WEEKLY_LIMIT=10.00
COST_MONTHLY_LIMIT=35.00
COST_PER_ANALYSIS_LIMIT=1.00
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

## 📈 Cost Tracking

### Data Storage

- Costs are logged to `cost-log.json` in the MCP server directory
- Last 1000 entries are kept to prevent file bloat
- Automatic cleanup and rotation

### Tracked Information

Each analysis logs:
- Provider and model used
- Cost in USD
- Tokens consumed
- Analysis type (lineup, waivers, etc.)
- NFL week number
- Timestamp

## 💰 Cost Examples by Provider

| Provider | Model | Per Analysis | Weekly (4 runs) | Monthly |
|----------|-------|--------------|-----------------|---------|
| **Gemini** | gemini-1.5-flash | $0.01-0.03 | $0.04-0.12 | $0.16-0.48 |
| **OpenAI** | gpt-4o-mini | $0.02-0.05 | $0.08-0.20 | $0.32-0.80 |
| **Perplexity** | sonar-large-online | $0.05-0.10 | $0.20-0.40 | $0.80-1.60 |
| **Claude** | claude-3.5-sonnet | $0.10-0.25 | $0.40-1.00 | $1.60-4.00 |

## 🔔 Slack Notifications

### Setup Slack Webhook

1. Go to https://api.slack.com/apps
2. Create new app → "From scratch"
3. Add "Incoming Webhooks" feature
4. Create webhook for your channel
5. Copy webhook URL to `SLACK_WEBHOOK_URL`

### Sample Alert Message

```
🚨 CRITICAL: Fantasy Football Cost Limit Alert

Provider: claude-3.5-sonnet-20241022
Period: single analysis
Current Cost: $1.2500
Limit: $1.00
Usage: 125.0% of limit

Recommendation: This analysis cost $1.2500, which exceeds your 
per-analysis limit of $1.00. Consider switching to a cheaper 
model like gemini-1.5-flash.

💡 Cost-saving options:
• Switch to gemini-1.5-flash ($0.075/$0.30 per 1M tokens)
• Use notification-only mode (free)
• Reduce analysis frequency
• Increase cost limits in environment variables
```

## 🛡️ Cost Protection Features

### Automatic Safeguards

- **Real-time monitoring**: Every analysis is tracked
- **Multi-level alerts**: Per-analysis, daily, weekly, monthly
- **Intelligent recommendations**: Suggests cheaper providers
- **Historical tracking**: View usage trends over time

### Emergency Stops

The system will recommend:
- ⚠️ **Switch to cheaper model** at 80% of limits
- 🛑 **Pause automation** at 100% of monthly limit
- 📱 **Immediate notification** for critical alerts

## 📊 Usage Reports

### MCP Tool: `get_cost_summary`

```json
{
  "costs": {
    "today": "$0.0450",
    "this_week": "$0.1800", 
    "this_month": "$0.7200",
    "total_all_time": "$2.4300"
  },
  "limits": {
    "daily": "$2.00",
    "weekly": "$10.00", 
    "monthly": "$35.00",
    "per_analysis": "$1.00"
  },
  "usage_percentage": {
    "daily": "2.3%",
    "weekly": "1.8%", 
    "monthly": "2.1%"
  },
  "stats": {
    "total_analyses": 54,
    "average_cost_per_analysis": "$0.0450"
  }
}
```

### MCP Tool: `get_provider_recommendations`

```json
[
  {
    "provider": "gemini",
    "model": "gemini-1.5-flash",
    "estimated_cost_per_analysis": "$0.01-0.03",
    "best_for": "Budget-conscious users"
  },
  {
    "provider": "openai", 
    "model": "gpt-4o-mini",
    "estimated_cost_per_analysis": "$0.02-0.05",
    "best_for": "Balanced cost/quality"
  }
]
```

## 🚨 Troubleshooting

### Common Issues

**"Cost log file not found"**
- Normal on first run - file is created automatically

**"Slack notification failed"** 
- Check webhook URL is correct
- Verify webhook has permission to post to channel

**"High costs detected"**
- Review provider pricing
- Consider switching to cheaper model
- Check for unnecessary tool calls

### Reset Cost Tracking

```bash
# Via MCP tool
reset_cost_tracking

# Or manually delete
rm cost-log.json
```

## 📱 Integration

### GitHub Actions

Cost monitoring is automatically included in the LLM-agnostic workflow:
- Costs are tracked for every automated analysis
- Alerts are included in Slack notifications
- Cost data is saved in workflow artifacts

### Claude Desktop

Use the MCP tools directly:
```
get_cost_summary
get_provider_recommendations
```

The cost monitoring system provides comprehensive protection against unexpected LLM costs while maintaining full transparency into your fantasy football automation spending.