# Fantasy Football AI Manager - Setup Guide for Friends 🏈🤖

This guide will help you set up your own Fantasy Football AI Manager that automatically analyzes your ESPN leagues and sends smart recommendations to Discord.

## Quick Overview - What We're Doing

Think of this like setting up a smart assistant for your fantasy team:

1. **Create accounts** (GitHub + Discord) - 10 minutes
2. **Copy the AI code** to your GitHub - 2 minutes  
3. **Get your ESPN league info** - 5 minutes
4. **Get Google's AI key** - 3 minutes
5. **Connect everything** - 10 minutes
6. **Test it** - 2 minutes

**Total time: ~30 minutes** (and then it runs forever!)

---

## What You'll Get

- **Automated fantasy analysis** every day at 8 AM ET
- **Real-time recommendations** during game days (Sunday/Monday/Thursday)
- **Multi-league support** - analyze multiple ESPN leagues simultaneously
- **Expert data integration** - combines ESPN + FantasyPros + Gemini 2.0 AI
- **Discord notifications** with start/sit advice, waiver targets, and more

## Prerequisites

You'll need (don't worry, I'll show you how to get each):
- **ESPN Fantasy Football leagues** (the leagues you're already in)
- **GitHub account** (free - I'll show you how to create one)
- **Discord account** (free - I'll show you how to set up)
- **Google Gemini API key** (free tier - step-by-step instructions below)

---

## Step 1: Create a GitHub Account (Your Code Storage)

GitHub is like Google Drive but for code. You need an account to host your fantasy AI.

### Creating Your GitHub Account:

1. Go to https://github.com
2. Click **"Sign up"** button (top right)
3. Enter:
   - **Username**: Pick something you'll remember (e.g., "JohnSmithFantasy")
   - **Email**: Your regular email address
   - **Password**: Create a strong password
4. Click **"Create account"**
5. **Verify your email**: GitHub will send you an email - click the link to verify
6. **Skip the setup questions** - just click "Skip personalization" at the bottom

### Fork the Fantasy AI Code:

Now that you have GitHub, let's copy the fantasy AI to your account:

1. While logged into GitHub, go to: https://github.com/JayMishra-source/Fantasy-Football-AI-CoManager
2. Click the **"Fork"** button (top right, looks like a Y-shaped symbol)
3. Leave all settings as default and click **"Create fork"**
4. Wait 10 seconds - GitHub is now copying all the code to your account
5. You'll be redirected to YOUR copy at: `https://github.com/[YourUsername]/Fantasy-Football-AI-CoManager`

**Important**: Bookmark this page - this is YOUR fantasy AI control panel!

---

## Step 2: Set Up Discord (Your Notification System)

Discord will send you the fantasy recommendations. Think of it as a private chat room for your fantasy alerts.

### Create a Discord Account:

1. Go to https://discord.com
2. Click **"Open Discord in your browser"** (no download needed)
3. Enter a username (e.g., "John's Fantasy HQ")
4. Click the arrow to continue
5. Enter your birth date (must be 13+)
6. Click **"Create an account"**
7. Enter your email and create a password
8. **Verify your email** - check your inbox and click the verification link

### Create Your Fantasy Server:

A "server" is just Discord's name for your private space:

1. On the left sidebar, click the **"+"** button that says "Add a Server"
2. Choose **"Create My Own"**
3. Click **"For me and my friends"** (skip the template)
4. Server name: **"Fantasy Football AI"** (or whatever you like)
5. Click **"Create"**

### Create a Channel for Notifications:

1. You'll see "# general" channel by default
2. Right-click on **"TEXT CHANNELS"** heading
3. Click **"Create Channel"**
4. Channel name: **"ai-recommendations"** (or "lineup-advice", etc.)
5. Leave type as **"Text"**
6. Click **"Create Channel"**

### Get Your Discord Webhook URL:

This is how the AI sends messages to your Discord:

1. Hover over your **"ai-recommendations"** channel
2. Click the **gear icon** (Edit Channel)
3. In the left menu, click **"Integrations"**
4. Click **"Webhooks"**
5. Click **"New Webhook"**
6. Change the name to **"Fantasy AI Bot"**
7. Click **"Copy Webhook URL"** button
8. **SAVE THIS URL** - paste it in a notepad, you'll need it later!
9. Click **"Save Changes"**

The webhook URL looks like: `https://discord.com/api/webhooks/123456789/abcdefgh...`

## Step 3: Get Your ESPN Authentication (Your League Access)

The AI needs permission to see your ESPN leagues. Think of this like giving someone your ESPN password, but safer.

### Getting Your ESPN Cookies:

**For Chrome/Edge Users:**

1. Open Chrome or Edge browser
2. Go to https://fantasy.espn.com
3. **Log in to your ESPN account** (important!)
4. Once logged in, press **F12** on your keyboard (or right-click anywhere and choose **"Inspect"**)
5. A panel will open - don't panic! Look for tabs at the top of this panel
6. Click on **"Application"** tab (might be hidden under >> arrows)
   - If you don't see "Application", try clicking the **">>"** arrows to find it
7. In the left sidebar of the panel, find **"Cookies"** and click the arrow to expand it
8. Click on **"https://fantasy.espn.com"**
9. You'll see a list - look for these two items:
   - **espn_s2** - Click on it, and copy the long text in the "Value" field (it's really long, 200+ characters)
   - **SWID** - Click on it, and copy the Value (looks like `{12345678-1234-1234-1234-123456789012}`)
10. **SAVE BOTH VALUES** in a notepad - you'll need them soon!

**For Firefox Users:**

1. Open Firefox and go to https://fantasy.espn.com
2. Log in to your ESPN account
3. Press **F12** (or right-click and choose **"Inspect"**)
4. Click the **"Storage"** tab
5. Click **"Cookies"** → **"https://fantasy.espn.com"**
6. Find and copy the values for **espn_s2** and **SWID**

**For Safari Users:**

1. First enable Developer menu: Safari menu → Preferences → Advanced → Check "Show Develop menu"
2. Go to https://fantasy.espn.com and log in
3. Click Develop menu → Show Web Inspector
4. Click **"Storage"** tab → **"Cookies"**
5. Find and copy **espn_s2** and **SWID** values

## Step 4: Get Your League Information (Finding Your Team)

Now let's find your specific league and team numbers:

### Find Your League ID:

1. Go to https://fantasy.espn.com
2. Click on your fantasy football league
3. Look at your browser's address bar (the URL at the top)
4. You'll see something like: `https://fantasy.espn.com/football/league?leagueId=12345678`
5. The number after **"leagueId="** is your League ID
6. **Write this down!** Example: `12345678`

### Find Your Team ID:

1. While in your league, click **"My Team"** (or your team name)
2. Look at the address bar again
3. You'll see: `https://fantasy.espn.com/football/team?leagueId=12345678&teamId=3`
4. The number after **"teamId="** is your Team ID
5. **Write this down!** Example: `3`

**For Multiple Leagues**: Repeat this process for each league you want to analyze.

---

## Step 5: Get Google Gemini API Key (The AI Brain)

Gemini is Google's AI that will analyze your fantasy team. The free tier is perfect for personal use.

### Creating Your Gemini API Key:

1. Go to https://makersuite.google.com/app/apikey
   - You might need to sign in with your Google account
2. Click **"Create API Key"** button (big blue button)
3. If asked, click **"Create API key in new project"**
4. Wait 5 seconds while Google creates your key
5. Your API key will appear - it starts with **"AIza"** followed by random letters/numbers
6. Click the **"Copy"** button next to your key
7. **SAVE THIS KEY** in your notepad - this is important!

**Note**: This API key is FREE and gives you plenty of usage for fantasy analysis (15 requests per minute, which is way more than you need).

## Step 6: Configure GitHub Secrets (Connecting Everything)

Now we'll tell GitHub all your credentials so the AI can access your leagues. These are kept secret and secure.

### Getting to the Right Place:

1. Go back to YOUR GitHub repository (the one you bookmarked)
   - It should be: `https://github.com/[YourUsername]/Fantasy-Football-AI-CoManager`
2. Click the **"Settings"** tab (it's in the top menu bar, on the right)
   - If you don't see Settings, make sure you're on YOUR fork, not the original
3. In the left sidebar, scroll down and find **"Secrets and variables"**
4. Click on it to expand, then click **"Actions"**

### Adding Your Secrets (One by One):

You'll add 6 required secrets. For each one:

1. Click the green **"New repository secret"** button
2. Enter the **Name** exactly as shown (MUST BE IN CAPITALS)
3. Enter the **Value** from your notepad
4. Click **"Add secret"**

**Add these 6 secrets:**

#### Secret #1: ESPN_S2
- **Name**: `ESPN_S2`
- **Value**: [paste your long espn_s2 cookie here]
- Click "Add secret"

#### Secret #2: ESPN_SWID  
- **Name**: `ESPN_SWID`
- **Value**: [paste your SWID with the curly braces like {1234-5678-...}]
- Click "Add secret"

#### Secret #3: LEAGUE_1_ID
- **Name**: `LEAGUE_1_ID`
- **Value**: [your league ID number, like 12345678]
- Click "Add secret"

#### Secret #4: LEAGUE_1_TEAM_ID
- **Name**: `LEAGUE_1_TEAM_ID`
- **Value**: [your team ID number, like 3]
- Click "Add secret"

#### Secret #5: GEMINI_API_KEY
- **Name**: `GEMINI_API_KEY`
- **Value**: [paste your AIza... key from Google]
- Click "Add secret"

#### Secret #6: DISCORD_WEBHOOK_URL
- **Name**: `DISCORD_WEBHOOK_URL`
- **Value**: [paste your Discord webhook URL]
- Click "Add secret"

### For Multiple Leagues (Optional):

If you have a second league, add these too:

- **Name**: `LEAGUE_2_ID` → **Value**: [second league ID]
- **Name**: `LEAGUE_2_TEAM_ID` → **Value**: [second team ID]
- **Name**: `LEAGUE_1_NAME` → **Value**: `Main League` (or whatever you want to call it)
- **Name**: `LEAGUE_2_NAME` → **Value**: `Secondary League` (or your choice)

### Verify Your Secrets:

After adding all secrets, you should see them listed like:
- ESPN_S2 (Updated just now)
- ESPN_SWID (Updated just now)
- LEAGUE_1_ID (Updated just now)
- etc...

**Note**: You can't see the values after saving (for security), but you can update them anytime by clicking on them.

## Step 7: Configure Repository Variables (Optional Settings)

These control costs and preferences. Still in Settings:

1. Click the **"Variables"** tab (next to Secrets)
2. Click **"New repository variable"** for each:

### Add these variables:
- **Name**: `PRIMARY_LLM_PROVIDER` → **Value**: `gemini`
- **Name**: `DAILY_COST_LIMIT` → **Value**: `2.00`
- **Name**: `WEEKLY_COST_LIMIT` → **Value**: `10.00`
- **Name**: `MONTHLY_COST_LIMIT` → **Value**: `35.00`

**Note**: These are safety limits, but you'll likely use less than $0.10 per day!

---

## Step 8: Test Your Setup (The Moment of Truth!)

Let's run your fantasy AI for the first time:

### Starting Your First Analysis:

1. At the top of your GitHub repository, click the **"Actions"** tab
2. You'll see a yellow banner saying "Workflows aren't being run" - click **"I understand my workflows, go ahead and enable them"**
3. On the left sidebar, click **"Fantasy Football Phase 4 - Advanced Intelligence"**
4. On the right, you'll see a blue **"Run workflow"** button - click it
5. A dropdown appears:
   - Leave "Branch" as **main**
   - Intelligence mode: Select **"full"**
   - Leave other fields empty
6. Click the green **"Run workflow"** button

### What Happens Next:

1. GitHub will start running your fantasy AI (takes about 60-90 seconds)
2. You'll see a yellow dot 🟡 spinning - this means it's working
3. After about a minute, it should turn green ✅
4. Check your Discord - you should see your first AI analysis!

### What You Should See in Discord:

```
🧠 Phase 4 Advanced Intelligence - ✅ SUCCESS
Mode: full | Week: 5 | Grade: A

📊 Key Insights:
• Main League: RB: Start Bijan Robinson (ATL) & Tony Pollard (DAL)
• Main League: WR: Start Davante Adams (LV), Brandon Aiyuk (SF)
• Main League: TE: Start Brenton Strange (JAC)
[... more recommendations ...]

Data Sources:
✅ ESPN Fantasy API
✅ gemini (gemini-2.0-flash-exp)
```

### If Something Goes Wrong:

If you see a red ❌ instead:

1. Click on the failed workflow run
2. Click on the job that failed (it'll have a red X)
3. Look for error messages like:
   - "ESPN authentication failed" → Your ESPN cookies might be wrong
   - "Invalid API key" → Check your Gemini key
   - "Webhook failed" → Check your Discord URL

See detailed troubleshooting below!

## Step 9: Understanding the Schedule

Your AI manager runs automatically:

- **Daily Analysis**: Every day at 8 AM ET
- **Real-time Monitoring**: Every hour during game days (Sun/Mon/Thu)
- **Weekly Analysis**: Saturday 10 PM ET
- **Emergency Monitoring**: Every 15 minutes during evening games

## Troubleshooting

### Common Issues and Solutions:

#### 1. "ESPN authentication failed"

**What this means**: The AI can't access your ESPN account.

**How to fix**:
1. Go back to ESPN and make sure you're logged in
2. Get fresh cookies (repeat Step 3)
3. Update your GitHub secrets:
   - Go to Settings → Secrets → Actions
   - Click on `ESPN_S2` → Update secret
   - Paste the new value
   - Do the same for `ESPN_SWID`
4. Run the workflow again

**Note**: ESPN cookies expire every ~30 days, so you'll need to update them monthly.

#### 2. "No insights generated" or "Empty roster"

**What this means**: The AI can't find your team.

**How to fix**:
1. Double-check your League ID and Team ID (Step 4)
2. Make sure you copied the numbers correctly
3. Verify you're looking at the 2024/2025 season
4. Update the secrets in GitHub if needed

#### 3. "Invalid API key" or "LLM not initialized"

**What this means**: Google's AI isn't connected.

**How to fix**:
1. Go to https://makersuite.google.com/app/apikey
2. Create a new API key
3. Update `GEMINI_API_KEY` in GitHub secrets

#### 4. Discord Shows Nothing

**What this means**: Discord webhook isn't working.

**How to fix**:
1. Go to your Discord channel settings
2. Create a new webhook
3. Copy the full URL (must start with https://discord.com/api/webhooks/)
4. Update `DISCORD_WEBHOOK_URL` in GitHub secrets

#### 5. Workflow Says "Skipped"

**What this means**: GitHub Actions aren't enabled.

**How to fix**:
1. Go to Actions tab
2. Click "I understand my workflows, go ahead and enable them"
3. Run the workflow again

### How to See Detailed Error Messages:

1. Go to the **Actions** tab
2. Click on the failed run (red ❌)
3. Click on the job that failed
4. Scroll down to see the error in red text
5. The error usually tells you exactly what's wrong

### Still Stuck?

Most issues are one of these:
- **Wrong cookie values** (ESPN_S2 or SWID)
- **Typo in League ID or Team ID**
- **Expired cookies** (need fresh ones from ESPN)
- **GitHub Actions not enabled**

Double-check each value you entered matches exactly what you copied!

## Advanced Features

Once basic setup works, you can enable:

- **FantasyPros Integration**: Add expert consensus rankings
- **Multiple LLM Providers**: Add Claude, OpenAI, or Perplexity as backups
- **Weather Data**: Enhanced game analysis with weather conditions
- **News Integration**: Breaking news alerts for your players

## Sample Discord Notification

You'll receive notifications like this:

```
🧠 Phase 4 Advanced Intelligence - ✅ SUCCESS
Mode: full | Week: 5 | Grade: A

📊 Key Insights:
• Main League: RB: Start Bijan Robinson (ATL) & Tony Pollard (DAL)
• Main League: WR: Start Davante Adams (LV), Brandon Aiyuk (SF)
• Secondary League: QB: START Lamar Jackson (BAL)
• Secondary League: WR: START Malik Nabers (WR)

Data Sources:
✅ ESPN Fantasy API
✅ FantasyPros Expert Rankings  
✅ gemini (gemini-2.0-flash-exp)
```

## Security Notes

- Keep your ESPN cookies private - they provide full access to your account
- API keys should never be shared or committed to public repositories  
- GitHub Secrets are encrypted and only visible to repository workflows
- Consider using a dedicated Discord channel for fantasy notifications

## Cost Estimation

With Gemini's free tier:
- **Daily analysis**: ~$0.01-0.05 per day
- **Weekly cost**: ~$0.35-1.00
- **Monthly cost**: ~$1.50-4.00

Well within the free tier limits for personal use!

---

## Setup Checklist

Before testing, make sure you have:

- [ ] Created a GitHub account and forked the repository
- [ ] Created a Discord server with a webhook
- [ ] Copied your ESPN cookies (espn_s2 and SWID)
- [ ] Found your League ID and Team ID
- [ ] Created a Google Gemini API key
- [ ] Added all 6 required secrets to GitHub
- [ ] Enabled GitHub Actions

---

## Maintenance

**Monthly**: Update your ESPN cookies (they expire every ~30 days)
1. Log into ESPN
2. Get new cookies (Step 3)
3. Update GitHub secrets

**Weekly**: Check your Discord for recommendations!

---

**Questions?** This setup typically takes 30 minutes for beginners. Once it's running, you'll get automated fantasy analysis for the entire season!

**Remember**: 
- GitHub = Where the code lives
- Discord = Where you see recommendations
- ESPN cookies = How it reads your leagues
- Gemini = The AI brain analyzing everything

Happy fantasy football! 🏈🏆