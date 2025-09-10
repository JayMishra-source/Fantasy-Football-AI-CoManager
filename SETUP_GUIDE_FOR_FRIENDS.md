# ESPN Fantasy Football POC - Quick Setup Guide for Friends 🏈

This guide helps you run the ESPN Fantasy Football analysis tool on your own computer. It's like having a personal fantasy assistant that shows your team roster and helps test ESPN's API.

## What This Tool Does

- **View your ESPN Fantasy team roster** with all players and stats
- **Test ESPN API endpoints** to explore league data
- **Support both public and private leagues**
- **Works with any ESPN Fantasy Football league you have access to**

## Prerequisites (What You Need)

Before starting, make sure you have:
- A computer with Windows, Mac, or Linux
- Internet connection
- ESPN Fantasy Football account with at least one league
- About 15 minutes for initial setup

---

## Part 1: Installing Required Software (One-Time Setup)

### Step 1: Install Node.js

Node.js runs the application. Think of it as the engine that makes everything work.

**For Windows:**
1. Go to https://nodejs.org
2. Click the big green button that says "Download Node.js (LTS)"
3. Run the downloaded file (it's probably in your Downloads folder)
4. Click "Next" through all the screens (default options are fine)
5. Click "Install" and then "Finish"

**For Mac:**
1. Go to https://nodejs.org
2. Download the macOS installer
3. Open the downloaded .pkg file
4. Follow the installation wizard (click Continue/Install)
5. Enter your Mac password when asked

**To verify it worked:**
1. Open Terminal (Mac) or Command Prompt (Windows)
   - Windows: Press `Windows key`, type "cmd", press Enter
   - Mac: Press `Cmd+Space`, type "terminal", press Enter
2. Type `node --version` and press Enter
3. You should see something like `v20.11.0` (any version 16+ is fine)

### Step 2: Install Git (To Download the Code)

**For Windows:**
1. Go to https://git-scm.com/download/win
2. Download will start automatically
3. Run the installer
4. Click "Next" through all screens (defaults are fine)
5. Click "Install"

**For Mac:**
1. Open Terminal
2. Type `git --version` and press Enter
3. If not installed, it will prompt you to install - click "Install"

---

## Part 2: Getting the Application Code

### Step 3: Download the Fantasy POC Code

1. **Open Terminal/Command Prompt**
   - Windows: Press `Windows key`, type "cmd", press Enter
   - Mac: Press `Cmd+Space`, type "terminal", press Enter

2. **Navigate to your Desktop** (so it's easy to find):
   ```bash
   cd Desktop
   ```

3. **Download the code**:
   ```bash
   git clone https://github.com/yourusername/FantasyCoManager.git
   ```
   (Replace `yourusername` with the actual GitHub username if provided)

4. **Go into the project folder**:
   ```bash
   cd FantasyCoManager/fantasy-poc
   ```

---

## Part 3: Setting Up the Application

### Step 4: Install Dependencies

The app needs some helper packages. We'll install them for both parts:

1. **Install backend packages**:
   ```bash
   cd server
   npm install
   ```
   Wait for it to finish (might take 1-2 minutes)

2. **Go back and install frontend packages**:
   ```bash
   cd ../client
   npm install
   ```
   Wait for this to finish too

3. **Return to main folder**:
   ```bash
   cd ..
   ```

---

## Part 4: Starting the Application

### Step 5: The Easy Way - Use the Startup Script

**For Mac/Linux:**
```bash
./start-poc.sh
```

**For Windows:**
If the script doesn't work, use the manual method below.

### Alternative: Manual Start (If Script Doesn't Work)

You'll need TWO Terminal/Command Prompt windows:

**Window 1 - Start the Backend:**
1. Open Terminal/Command Prompt
2. Navigate to the project:
   ```bash
   cd Desktop/FantasyCoManager/fantasy-poc/server
   ```
3. Start the backend:
   ```bash
   npm run dev
   ```
4. You should see: `Server running on port 3003`
5. **Leave this window open!**

**Window 2 - Start the Frontend:**
1. Open a NEW Terminal/Command Prompt
2. Navigate to the project:
   ```bash
   cd Desktop/FantasyCoManager/fantasy-poc/client
   ```
3. Start the frontend:
   ```bash
   npm run dev
   ```
4. You should see: `Local: http://localhost:5173`
5. **Leave this window open too!**

---

## Part 5: Using the Application

### Step 6: Open the App in Your Browser

1. Open your web browser (Chrome, Firefox, Safari, etc.)
2. Go to: http://localhost:5173
3. You should see "ESPN Fantasy Football POC" at the top!

### Step 7: Login to Your ESPN League

The app offers three login methods:

#### Option A: Public League (Easiest)
If your league is public:
1. Select "Public League (No Login Required)"
2. Enter your League ID (see "Finding Your League Info" below)
3. Click "Access Public League"

#### Option B: Private League - Manual (Most Reliable)
For private leagues:
1. Select "Private League - Manual (Cookies)"
2. Click "Show Cookie Instructions" and follow them
3. The app will even cache your cookies for next time!

#### Option C: Private League - Automatic
1. Select "Private League - Automatic Login"
2. Enter your ESPN username and password
3. Enter your League ID
4. Click "Login with Credentials"
5. Note: This might fail if ESPN changes their login page

### Finding Your League Info

**League ID:**
1. Go to your ESPN Fantasy Football league page
2. Look at the URL: `fantasy.espn.com/football/league?leagueId=123456`
3. The number after `leagueId=` is your League ID (e.g., 123456)

**Team ID (Optional):**
1. Click on "My Team" in your league
2. Look at the URL: `fantasy.espn.com/football/team?leagueId=123456&teamId=3`
3. The number after `teamId=` is your Team ID (e.g., 3)

### Getting ESPN Cookies (For Private Leagues)

If using manual authentication:

**Chrome/Edge:**
1. Go to https://fantasy.espn.com and log in
2. Press `F12` to open Developer Tools
3. Click "Application" tab (might be under >> if hidden)
4. In left sidebar: Cookies → fantasy.espn.com
5. Find and copy:
   - `espn_s2` value (very long text)
   - `SWID` value (looks like {1234-5678-...})

**Firefox:**
1. Log into ESPN Fantasy
2. Press `F12` for Developer Tools
3. Click "Storage" tab → Cookies → fantasy.espn.com
4. Copy `espn_s2` and `SWID` values

**Safari:**
1. Enable Developer menu: Safari → Preferences → Advanced → "Show Develop menu"
2. Log into ESPN Fantasy
3. Develop menu → Show Web Inspector
4. Storage tab → Cookies
5. Copy the values

---

## Part 6: Viewing Your Team

Once logged in:

1. **Team Roster Tab**: Shows your complete roster with:
   - Starting lineup
   - Bench players
   - Injured Reserve
   - Player points

2. **API Tester Tab**: Test different ESPN endpoints:
   - League Info
   - All Teams
   - Player Data
   - Matchups
   - Transactions

3. **Cookie Tester Tab**: Verify your authentication is working

---

## Troubleshooting

### Common Issues and Solutions

**"Cannot find module" or "npm: command not found"**
- Node.js isn't installed properly
- Solution: Reinstall Node.js from https://nodejs.org

**"Port 3003 already in use"**
- The backend is already running
- Solution: Close all Terminal windows and start fresh

**"Port 5173 already in use"**  
- The frontend is already running
- Solution: Close all Terminal windows and start fresh

**"Authentication failed" or "401 error"**
- Your ESPN cookies expired or are incorrect
- Solution: Get fresh cookies from ESPN (they expire monthly)

**"Cannot GET /" when opening browser**
- You're accessing the wrong port
- Solution: Make sure you go to http://localhost:5173 (not 3003)

**App shows "No roster data available"**
- Wrong Team ID or League ID
- Solution: Double-check your IDs from the ESPN website

**Both terminals show errors immediately**
- Dependencies didn't install properly
- Solution: 
  1. Close everything
  2. Delete `node_modules` folders in both server and client
  3. Run `npm install` again in both folders

---

## Daily Usage (After Initial Setup)

Once everything is set up, daily use is simple:

1. **Open Terminal/Command Prompt**
2. **Navigate to project**:
   ```bash
   cd Desktop/FantasyCoManager/fantasy-poc
   ```
3. **Start the app**:
   ```bash
   ./start-poc.sh
   ```
   Or use the manual two-window method
4. **Open browser** to http://localhost:5173
5. **Your cookies are cached** - just click login!

To stop the app: Press `Ctrl+C` in both Terminal windows

---

## Tips for Success

1. **Keep both Terminal windows open** while using the app
2. **ESPN cookies expire monthly** - you'll need to get new ones
3. **The app caches your cookies** for 7 days for convenience
4. **Bookmark http://localhost:5173** for quick access
5. **Team ID is optional** but needed to see your specific roster

---

## Advanced Features

Once comfortable with basics:
- Test custom ESPN API endpoints in API Tester
- Export roster data for analysis
- Monitor multiple leagues (get cookies for each)
- Check transaction history and matchups

---

## Security Notes

- ESPN cookies give full access to your fantasy account
- The app stores cookies locally on your computer only
- Never share your cookies with others
- Cookies expire automatically after ~30 days

---

## Need Help?

If something isn't working:
1. Make sure both backend (port 3003) and frontend (port 5173) are running
2. Check you're using the right URL: http://localhost:5173
3. Verify your ESPN cookies are fresh (get new ones if it's been over a month)
4. Try closing everything and starting fresh

The most common issue is expired ESPN cookies - when in doubt, get fresh ones!

---

**Remember the key steps:**
1. Install Node.js and Git (one time only)
2. Download the code (one time only)
3. Install dependencies with `npm install` (one time only)
4. Start backend and frontend servers
5. Open http://localhost:5173
6. Login with your ESPN credentials or cookies
7. View your team!

Happy Fantasy Football! 🏈