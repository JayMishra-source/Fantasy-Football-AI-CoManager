# Fantasy Football AI Manager - Production Deployment Guide

## 🚀 Phase 3: Production Ready

This guide covers the complete production deployment of the Fantasy Football AI Manager with real ESPN integration, LLM providers, monitoring, and automated scheduling.

## 📋 Pre-Deployment Checklist

### ✅ **Required Secrets Configuration**

Configure these secrets in your GitHub repository settings (`Settings → Secrets and variables → Actions`):

#### **ESPN Authentication (Required)**
```bash
ESPN_S2=AASessionToken...    # ~200+ character ESPN session token
ESPN_SWID={UUID-HERE}        # ESPN user ID in curly braces format
```

#### **League Configuration (Required - at least one league)**
```bash
# Primary League
LEAGUE_1_ID=123456          # Your ESPN league ID
LEAGUE_1_TEAM_ID=1          # Your team ID in the league
LEAGUE_1_NAME=Main League   # Optional display name
LEAGUE_1_FAAB_BUDGET=100    # Optional FAAB budget

# Secondary League (Optional)
LEAGUE_2_ID=789012          # Second league ID
LEAGUE_2_TEAM_ID=3          # Your team ID in second league
LEAGUE_2_NAME=Work League   # Optional display name
```

#### **LLM Provider Keys (Required - at least one)**
```bash
# Recommended: Gemini (most cost-effective)
GEMINI_API_KEY=your_gemini_api_key_here

# Optional additional providers for fallback
CLAUDE_API_KEY=sk-ant-your_claude_key_here
OPENAI_API_KEY=sk-proj-your_openai_key_here
PERPLEXITY_API_KEY=pplx-your_perplexity_key_here
```

#### **Optional Enhancements**
```bash
# FantasyPros MVP subscription (expert consensus)
FANTASYPROS_SESSION_ID=your_session_cookie_here

# Weather data integration
OPENWEATHER_API_KEY=your_openweather_key_here

# News integration
NEWS_API_KEY=your_news_api_key_here

# Notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your/webhook
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook
```

### 📊 **Configuration Verification**

Use the built-in validation tools:

```bash
# Test environment setup
cd fantasy-poc/automation
npm run build
npx tsx src/testing/espn-integration-test.ts
npx tsx src/testing/llm-integration-test.ts
```

## 🏗️ **Production Architecture**

### **Automated Schedule**
```
Thursday 6PM ET  → Pre-game lineup optimization
Sunday 11AM ET   → Final lineup adjustments  
Monday 6PM ET    → Post-game analysis & waiver prep
Tuesday 3AM ET   → Waiver wire processing
Daily 8AM ET     → System health check
```

### **Data Flow**
```
GitHub Actions → CLI Commands → Shared Library → ESPN/LLM APIs
       ↓              ↓              ↓              ↓
   Cron Schedule  Direct Calls   Business Logic   Real Data
```

### **Safety Features**
- **Preflight checks**: Validate environment before execution
- **Timeout protection**: Max execution time limits
- **Cost monitoring**: Automatic limits and alerts  
- **Error handling**: Graceful failure and notifications
- **Dry run mode**: Test without making changes

## 🚀 **Deployment Steps**

### **1. Fork and Configure Repository**

```bash
# Fork the repository to your GitHub account
# Clone to your local machine for testing
git clone https://github.com/YOUR_USERNAME/Fantasy-Football-AI-CoManager
cd Fantasy-Football-AI-CoManager
```

### **2. Set Up ESPN Authentication**

#### Option A: Browser Cookie Method (Recommended)
1. Login to ESPN Fantasy Football in your browser
2. Open Developer Tools (F12) → Application/Storage → Cookies
3. Find `fantasy.espn.com` cookies
4. Copy `espn_s2` and `SWID` values
5. Add to GitHub Secrets

#### Option B: Automated Authentication (Advanced)
- The system can handle automated login if credentials are provided
- Less reliable due to ESPN's changing login process

### **3. Configure GitHub Secrets**

Go to `Settings → Secrets and variables → Actions` and add all required secrets from the checklist above.

### **4. Test Integration**

Enable the GitHub Actions workflow and run a manual test:

```bash
# Go to Actions tab in GitHub
# Select "Fantasy Football Production Automation"
# Click "Run workflow"
# Choose "test-espn" or "test-llm" for validation
```

### **5. Enable Production Schedule**

The production workflow is automatically scheduled. To enable:

1. Ensure all secrets are configured
2. The workflow will run on the automated schedule
3. Monitor the Actions tab for execution logs

## 📈 **Monitoring and Alerting**

### **Built-in Monitoring**

The system includes comprehensive monitoring:

- **System Health**: Daily automated health checks
- **ESPN Connectivity**: Real-time API status monitoring  
- **LLM Performance**: Response time and cost tracking
- **Success Rates**: Historical performance analysis
- **Cost Management**: Automatic limits and alerts

### **Alert Notifications**

Configure webhooks for instant notifications:

#### **Discord Integration**
```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR/WEBHOOK
```

#### **Slack Integration**
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK
```

### **Alert Types**

- 🚨 **Critical**: ESPN authentication failure, LLM provider down, cost limits exceeded
- ⚠️ **Warning**: Slow response times, high error rates, approaching cost limits
- ℹ️ **Info**: Successful executions, performance milestones

### **Automatic Issue Creation**

Failed scheduled runs automatically create GitHub issues with:
- Error details and logs
- System status information
- Troubleshooting recommendations
- Links to workflow execution

## 💰 **Cost Management**

### **Default Cost Limits**
```bash
Per Analysis: $1.00
Daily Limit: $2.00  
Weekly Limit: $10.00
Monthly Limit: $35.00
```

### **Cost Optimization Tips**

1. **Use Gemini**: Most cost-effective provider (~$0.05 per analysis)
2. **Enable Limits**: Automatic stopping when limits are reached
3. **Monitor Daily**: Check cost reports in notifications
4. **Adjust Frequency**: Reduce schedule if costs are too high

### **Provider Costs (Approximate)**
- **Gemini Flash**: $0.05 per analysis
- **Claude Haiku**: $0.15 per analysis  
- **GPT-4o Mini**: $0.10 per analysis
- **Perplexity**: $0.20 per analysis (includes web search)

## 🔧 **Troubleshooting**

### **Common Issues**

#### **ESPN Authentication Errors**
```
❌ Error: ESPN API returned HTML instead of JSON
```
**Solution**: ESPN cookies have expired
1. Get fresh cookies from browser
2. Update `ESPN_S2` and `ESPN_SWID` secrets
3. Re-run workflow

#### **LLM Provider Failures**
```
❌ Error: LLM provider not responding
```
**Solution**: Check API keys and quotas
1. Verify API key in secrets
2. Check provider's usage dashboard
3. Ensure billing is current

#### **League Access Issues**
```
❌ Error: Team not found in league
```
**Solution**: Verify league and team IDs
1. Check ESPN league URL for correct ID
2. Verify you're a member of the league
3. Confirm team ID matches your team

### **Manual Testing Commands**

```bash
# Test individual components
cd fantasy-poc/automation

# Check roster access
node dist/cli.js roster --league LEAGUE_ID --team TEAM_ID

# Test cost monitoring  
node dist/cli.js cost

# Run health check
node dist/cli.js health-check

# Dry run mode
ENABLE_DRY_RUN=true node dist/cli.js thursday
```

### **Log Analysis**

Check GitHub Actions logs for detailed error information:
1. Go to Actions tab
2. Click on failed workflow run
3. Expand step logs for error details
4. Check "Upload Production Results" for data files

## 📊 **Performance Optimization**

### **Execution Speed**
- Direct CLI calls eliminate JSON-RPC overhead
- Shared library reduces initialization time
- Parallel API calls where possible
- Optimized dependency loading

### **Resource Usage**
- Memory-efficient execution (no persistent server)
- Minimal Docker image footprint
- Efficient GitHub Actions usage
- Smart caching strategies

### **Accuracy Improvements**
- Multi-source data validation
- Expert consensus integration (FantasyPros)
- Weather and news context
- Historical performance learning

## 🔒 **Security Best Practices**

### **Secrets Management**
- Never commit API keys to repository
- Use GitHub Secrets for all credentials
- Rotate ESPN cookies regularly (~30 days)
- Monitor access logs for unusual activity

### **Access Control**
- Repository should be private for production use
- Limit collaborators to trusted users
- Review GitHub Actions permissions
- Monitor third-party app access

### **Data Protection**
- No sensitive data stored in logs
- Results uploaded to secure artifacts
- Automatic cleanup of temporary files
- Encrypted communication with all APIs

## 📈 **Success Metrics**

### **Weekly Performance Report**

The system automatically tracks:
- **Lineup Optimization Accuracy**: % of recommendations that improved scores
- **Waiver Wire Success**: % of recommended pickups that performed well
- **Cost Efficiency**: Total cost per week vs performance gained
- **Response Time**: Average execution time for each workflow
- **Uptime**: % of scheduled executions that completed successfully

### **Continuous Improvement**

The system learns and improves through:
- **A/B Testing**: Automatically tests different strategies
- **Performance Feedback**: Records outcomes vs predictions
- **Model Training**: Updates recommendations based on results
- **Strategy Optimization**: Adapts to your league's scoring system

## 🎯 **Production Checklist**

Before going live, ensure:

- [ ] All GitHub Secrets configured
- [ ] ESPN authentication tested
- [ ] At least one LLM provider working
- [ ] League and team IDs verified
- [ ] Notification webhooks configured
- [ ] Cost limits set appropriately
- [ ] Manual test run successful
- [ ] Monitoring alerts working

## 📞 **Support and Maintenance**

### **Regular Maintenance**
- **Monthly**: Refresh ESPN cookies
- **Weekly**: Review cost reports and performance
- **As needed**: Update API keys when they expire
- **Season start**: Verify league configurations

### **Version Updates**
The system automatically uses the latest code from your repository. To update:
1. Pull latest changes from main repository
2. Test in your fork
3. Workflows will automatically use updated code

### **Emergency Procedures**
- **Disable automation**: Disable the GitHub Actions workflow
- **Emergency contact**: Check GitHub issues for system alerts
- **Quick fixes**: Use manual workflow runs for immediate needs

---

## 🎉 **You're Ready for Production!**

Your Fantasy Football AI Manager is now configured for fully automated production operation with:

✅ **Real-time ESPN integration**
✅ **Multi-provider LLM intelligence** 
✅ **Automated scheduling**
✅ **Comprehensive monitoring**
✅ **Cost management**
✅ **Performance tracking**

The system will now automatically optimize your lineups, analyze waiver opportunities, coordinate trades, and provide data-driven recommendations 24/7 throughout the fantasy football season.

**Good luck and may your lineups be ever optimal!** 🏆