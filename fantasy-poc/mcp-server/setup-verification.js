#!/usr/bin/env node

// Setup verification script for MCP testing

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

console.log('🔍 MCP Server Setup Verification\n');

// Check 1: Environment file
console.log('1. Checking .env file...');
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log('✅ .env file exists');
} else {
  console.log('❌ .env file missing');
  console.log('   Create .env file in the mcp-server directory');
}

// Check 2: ESPN Configuration
console.log('\n2. Checking ESPN configuration...');
const ESPN_S2 = process.env.ESPN_S2;
const ESPN_SWID = process.env.ESPN_SWID;
const LEAGUE_ID_1 = process.env.LEAGUE_ID_1;
const TEAM_ID_1 = process.env.TEAM_ID_1;

if (ESPN_S2 && ESPN_SWID) {
  console.log('✅ ESPN cookies configured');
  console.log(`   ESPN_S2: ${ESPN_S2.substring(0, 20)}...`);
  console.log(`   ESPN_SWID: ${ESPN_SWID.substring(0, 20)}...`);
} else {
  console.log('❌ ESPN cookies missing');
  console.log('   Add ESPN_S2 and ESPN_SWID to .env file');
}

if (LEAGUE_ID_1 && TEAM_ID_1) {
  console.log('✅ League/Team IDs configured');
  console.log(`   League 1: ${LEAGUE_ID_1}, Team: ${TEAM_ID_1}`);
} else {
  console.log('❌ League/Team IDs missing');
  console.log('   Add LEAGUE_ID_1 and TEAM_ID_1 to .env file');
}

// Check 3: LLM Provider Configuration
console.log('\n3. Checking LLM provider configuration...');
const providers = [
  { name: 'OpenAI', key: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL },
  { name: 'Claude', key: process.env.CLAUDE_API_KEY, model: process.env.CLAUDE_MODEL },
  { name: 'Gemini', key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL },
  { name: 'Perplexity', key: process.env.PERPLEXITY_API_KEY, model: process.env.PERPLEXITY_MODEL }
];

let configuredProviders = 0;
providers.forEach(provider => {
  if (provider.key) {
    console.log(`✅ ${provider.name} configured`);
    console.log(`   Model: ${provider.model || 'default'}`);
    console.log(`   API Key: ${provider.key.substring(0, 20)}...`);
    configuredProviders++;
  }
});

if (configuredProviders === 0) {
  console.log('❌ No LLM providers configured');
  console.log('   Add at least one: OPENAI_API_KEY, CLAUDE_API_KEY, GEMINI_API_KEY, or PERPLEXITY_API_KEY');
}

// Check 4: Cost Monitoring Configuration
console.log('\n4. Checking cost monitoring configuration...');
const costLimits = {
  daily: process.env.COST_DAILY_LIMIT || '2.00',
  weekly: process.env.COST_WEEKLY_LIMIT || '10.00',
  monthly: process.env.COST_MONTHLY_LIMIT || '35.00',
  per_analysis: process.env.COST_PER_ANALYSIS_LIMIT || '1.00'
};

console.log('✅ Cost limits configured (using defaults if not set):');
Object.entries(costLimits).forEach(([period, limit]) => {
  console.log(`   ${period}: $${limit}`);
});

// Check 5: Notification Configuration
console.log('\n5. Checking notification configuration...');
if (process.env.SLACK_WEBHOOK_URL) {
  console.log('✅ Slack webhook configured');
  console.log(`   Webhook: ${process.env.SLACK_WEBHOOK_URL.substring(0, 40)}...`);
} else {
  console.log('⚠️  Slack webhook not configured (optional)');
  console.log('   Set SLACK_WEBHOOK_URL for cost alerts');
}

// Check 6: Dependencies
console.log('\n6. Checking dependencies...');
const requiredPackages = [
  '@anthropic-ai/sdk',
  'openai', 
  '@google/generative-ai',
  '@modelcontextprotocol/sdk'
];

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

requiredPackages.forEach(pkg => {
  if (dependencies[pkg]) {
    console.log(`✅ ${pkg} installed (${dependencies[pkg]})`);
  } else {
    console.log(`❌ ${pkg} missing - run: npm install ${pkg}`);
  }
});

// Summary
console.log('\n📋 SETUP SUMMARY');
console.log('================');
if (ESPN_S2 && ESPN_SWID && configuredProviders > 0) {
  console.log('🎉 Ready for testing!');
  console.log(`   LLM providers: ${configuredProviders}`);
  console.log('   ESPN auth: configured');
  console.log('   MCP server: ready');
} else {
  console.log('⚠️  Setup incomplete');
  console.log('   Please configure missing items above');
}

console.log('\n🚀 Next steps:');
console.log('1. Complete any missing configuration above');
console.log('2. Run: npm run build');
console.log('3. Run: node test-mcp-integration.js');
console.log('4. Run: node test-cost-monitoring.js');