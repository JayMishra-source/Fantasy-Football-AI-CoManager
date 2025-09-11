# LLM Provider Setup Guide

The fantasy football automation now supports multiple LLM providers. Choose the one that best fits your budget and needs.

## Quick Setup

Add **ONE** of the following configurations to your `.env` file:

### Option 1: Claude (Anthropic) - Recommended
```bash
# Claude API (separate from Claude subscription)
CLAUDE_API_KEY=sk-ant-api03-your-api-key-here
CLAUDE_MODEL=claude-3-5-sonnet-20241022

# Optional settings
CLAUDE_MAX_TOKENS=4000
CLAUDE_TEMPERATURE=0.3
```

### Option 2: OpenAI GPT - Popular Choice
```bash
# OpenAI API
OPENAI_API_KEY=sk-proj-your-api-key-here
OPENAI_MODEL=gpt-4o-mini

# Optional settings
OPENAI_MAX_TOKENS=4000
OPENAI_TEMPERATURE=0.3
```

### Option 3: Gemini - Most Cost-Effective
```bash
# Google Gemini API
GEMINI_API_KEY=your-api-key-here
GEMINI_MODEL=gemini-1.5-flash

# Optional settings
GEMINI_MAX_TOKENS=4000
GEMINI_TEMPERATURE=0.3
```

### Option 4: Perplexity - Real-time Web Access
```bash
# Perplexity API
PERPLEXITY_API_KEY=pplx-your-api-key-here
PERPLEXITY_MODEL=llama-3.1-sonar-large-128k-online

# Optional settings
PERPLEXITY_MAX_TOKENS=4000
PERPLEXITY_TEMPERATURE=0.3
```

## Cost Comparison (Per Million Tokens)

| Provider | Model | Input | Output | Best For |
|----------|-------|--------|--------|----------|
| **Gemini** | gemini-1.5-flash | $0.075 | $0.30 | Budget-conscious users |
| **OpenAI** | gpt-4o-mini | $0.15 | $0.60 | Reliable general use |
| **Perplexity** | sonar-large-online | $1.00 | $1.00 | Real-time data needs |
| **Claude** | claude-3.5-sonnet | $3.00 | $15.00 | Complex analysis |

**Estimated weekly cost for 4 analyses: $0.50 - $3.00**

## Getting API Keys

### Claude (Anthropic)
1. Visit https://console.anthropic.com/
2. Sign up/login to your account
3. Go to "API Keys" section
4. Create a new API key
5. **Note**: This is separate from your Claude subscription

### OpenAI
1. Visit https://platform.openai.com/api-keys
2. Sign up/login to your account
3. Click "Create new secret key"
4. Copy and save the key immediately

### Google Gemini
1. Visit https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Choose existing or create new Google Cloud project

### Perplexity
1. Visit https://www.perplexity.ai/settings/api
2. Sign up/login to your account
3. Subscribe to Pro plan ($20/month)
4. Generate API key in settings

## Testing Your Configuration

After adding your API key to `.env`, test it:

```bash
# Test the configuration
npm run build
node -e "
import { llmConfig } from './dist/config/llm-config.js';
(async () => {
  const result = await llmConfig.testConfiguration();
  console.log(result.success ? '✅ Working!' : '❌ Failed:', result.error);
})();
"
```

Or use the GitHub Actions workflow:
- Go to Actions → LLM-Agnostic Fantasy Automation
- Run workflow → Select "test-llm"

## GitHub Secrets Setup

For automated runs, add your API key as a GitHub secret:

1. Go to your repository → Settings → Secrets and variables → Actions
2. Add your chosen provider's secrets:

**For Claude:**
```
CLAUDE_API_KEY=your-key-here
CLAUDE_MODEL=claude-3-5-sonnet-20241022
```

**For OpenAI:**
```
OPENAI_API_KEY=your-key-here
OPENAI_MODEL=gpt-4o-mini
```

**For Gemini:**
```
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-1.5-flash
```

**For Perplexity:**
```
PERPLEXITY_API_KEY=your-key-here
PERPLEXITY_MODEL=llama-3.1-sonar-large-128k-online
```

## Manual Provider Override

You can override the provider for specific runs:

1. Go to Actions → LLM-Agnostic Fantasy Automation
2. Run workflow manually
3. Choose different provider/model in the inputs

This is useful for:
- Testing different providers
- Cost optimization
- Comparing analysis quality

## Switching Providers

To switch providers permanently:

1. Update your `.env` file with the new provider's credentials
2. Remove the old provider's environment variables
3. Restart the application

The system will auto-detect the new configuration.

## Cost Monitoring

Each analysis includes cost information:
- Check GitHub Actions logs for per-run costs
- Slack/Discord notifications include cost estimates
- Artifacts contain detailed usage statistics

## Troubleshooting

### "No LLM provider configured"
- Check that you have API key environment variables set
- Verify the API key format is correct
- Test the API key manually

### "Failed to validate configuration"
- API key might be invalid or expired
- Check your account has sufficient credits/quota
- Verify the model name is correct

### High costs
- Switch to a cheaper model (gemini-1.5-flash)
- Reduce analysis frequency
- Check for unnecessary tool calls

## Best Practices

1. **Start with Gemini Flash** - Cheapest option for testing
2. **Use Claude Sonnet** - For most accurate fantasy analysis  
3. **Monitor costs** - Check weekly spending in your provider dashboard
4. **Set spending limits** - Configure alerts in your provider account
5. **Test first** - Always test new configurations before scheduling

## Support

- **Claude issues**: https://support.anthropic.com/
- **OpenAI issues**: https://help.openai.com/
- **Gemini issues**: https://support.google.com/generativeai/
- **Perplexity issues**: https://docs.perplexity.ai/

The system is designed to be provider-agnostic, so you can easily switch between providers based on your needs and budget.