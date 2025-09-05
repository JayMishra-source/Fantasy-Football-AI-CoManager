const https = require('https');
const url = require('url');

// Test Discord webhook (replace with actual webhook URL)
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/YOUR_WEBHOOK_URL_HERE';

if (DISCORD_WEBHOOK_URL.includes('YOUR_WEBHOOK')) {
  console.log('❌ Please set DISCORD_WEBHOOK_URL environment variable');
  console.log('🔗 To create a Discord webhook:');
  console.log('   1. Go to your Discord server settings');
  console.log('   2. Navigate to Integrations → Webhooks');
  console.log('   3. Create New Webhook and copy the URL');
  console.log('   4. Run: export DISCORD_WEBHOOK_URL="your_webhook_url"');
  process.exit(1);
}

const testMessage = {
  embeds: [{
    title: '🧠 Phase 4 Intelligence Test - SUCCESS',
    description: '**Mode**: test\n**Week**: 5\n**Time**: ' + new Date().toISOString() + '\n\n**Key Insights**:\n• Test insight 1: System operational\n• Test insight 2: Discord integration working\n• Test insight 3: Notifications configured correctly',
    color: 3066993, // Green
    fields: [
      {name: '🎯 Intelligence Mode', value: 'test', inline: true},
      {name: '📅 NFL Week', value: '5', inline: true},
      {name: '📊 Status', value: '✅ SUCCESS', inline: true}
    ],
    footer: {text: 'Fantasy AI Phase 4 Advanced Intelligence'},
    timestamp: new Date().toISOString()
  }]
};

const webhookUrl = new URL(DISCORD_WEBHOOK_URL);
const postData = JSON.stringify(testMessage);

const options = {
  hostname: webhookUrl.hostname,
  port: 443,
  path: webhookUrl.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🧪 Testing Discord webhook integration...');

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  if (res.statusCode === 204) {
    console.log('✅ Discord webhook test successful!');
    console.log('🎯 Your Phase 4 notifications are configured correctly');
  } else {
    console.log('❌ Discord webhook test failed');
    console.log('🔍 Check your webhook URL and Discord server permissions');
  }
});

req.on('error', (e) => {
  console.error('❌ Discord webhook test failed:', e.message);
  console.log('🔍 Troubleshooting tips:');
  console.log('   • Verify webhook URL is correct');
  console.log('   • Check Discord server permissions');
  console.log('   • Ensure webhook is not deleted');
});

req.write(postData);
req.end();
