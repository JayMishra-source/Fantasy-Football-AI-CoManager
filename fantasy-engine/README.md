# ESPN Fantasy Football POC

A proof of concept application for integrating with ESPN Fantasy Football private leagues, featuring team roster display and API testing capabilities.

## Features

- **ESPN Authentication**: Secure login using Puppeteer for private league access
- **Team Roster Display**: View complete team rosters with player stats
- **API Testing Interface**: Test various ESPN API endpoints with real-time responses
- **Cookie-based Session Management**: Maintains authentication for private leagues

## Project Structure

```
fantasy-poc/
├── client/          # React frontend
├── server/          # Node.js backend
└── README.md
```

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- ESPN Fantasy Football account with access to a private league

## Setup Instructions

### Quick Start (Recommended)

```bash
cd fantasy-poc

# Install dependencies for both server and client
cd server && npm install && cd ../client && npm install && cd ..

# Start both server and client with one command
./start-poc.sh
```

### Manual Setup

#### 1. Backend Setup

```bash
cd server
npm install

# Create .env file
cp .env.example .env

# Start the server
npm run dev
```

The server will run on `http://localhost:3003`

#### 2. Frontend Setup

In a new terminal:

```bash
cd client
npm install

# Start the React app
npm run dev
```

The app will run on `http://localhost:5173` (or next available port like 5174, 5175)

## Usage

### 1. Login

The app now supports two authentication methods:

#### Option A: Automatic Login (Recommended to try first)
1. Select "Automatic Login (Username/Password)"
2. Enter your ESPN username/email and password
3. Provide your League ID (found in your ESPN league URL)
4. Optionally provide your Team ID
5. Click "Login with Credentials"

#### Option B: Manual Authentication (Fallback)
If automatic login fails due to ESPN's changing login page:

1. Select "Manual Authentication (Cookies)"
2. Click "Show Cookie Instructions" and follow the steps to get your cookies
3. Paste the `espn_s2` and `SWID` cookie values
4. Provide your League ID and Team ID
5. Click "Login with Cookies"

### 2. View Team Roster

Once logged in, if you provided a Team ID, you can view your complete roster including:
- Starting lineup
- Bench players
- Injured Reserve
- Player points

### 3. Test API Endpoints

Switch to the "API Tester" tab to:
- Test predefined ESPN API endpoints
- Use custom endpoints with parameters
- View formatted JSON responses
- Debug API calls

## Available API Endpoints

- **League Info**: Basic league information
- **Teams**: All teams in the league
- **Roster**: Specific team roster
- **Players**: All player information
- **Matchups**: Weekly matchups
- **Transactions**: League transactions

## Important Notes

### Authentication
- The app uses Puppeteer to authenticate with ESPN
- Session cookies are temporarily stored in memory
- You may need to re-authenticate if the session expires

### Private League Access
- Only works with private leagues you have access to
- Requires valid ESPN credentials
- League must be accessible to your account

### Rate Limiting
- ESPN may rate limit API requests
- Implement caching for production use
- Avoid excessive API calls

## Troubleshooting

### Login Issues
- Ensure your ESPN credentials are correct
- Check that you have access to the specified league
- Try logging in to ESPN website first to verify credentials

### Alternative Authentication (Manual Cookie Method)
If Puppeteer authentication fails, you can manually provide cookies:

1. Log into ESPN Fantasy Football in your browser
2. Open Developer Tools (F12)
3. Go to Application/Storage → Cookies → fantasy.espn.com
4. Find and copy:
   - `espn_s2` cookie value
   - `SWID` cookie value (include curly braces)
5. Use the manual authentication endpoint:
   ```bash
   curl -X POST http://localhost:3003/api/auth/manual-login \
     -H "Content-Type: application/json" \
     -d '{
       "username": "your-username",
       "espn_s2": "your-espn-s2-cookie",
       "swid": "{your-swid-cookie}"
     }'
   ```

### API Errors
- Verify the League ID is correct
- Ensure you're authenticated before making API calls
- Check server logs for detailed error messages

### Puppeteer Issues
If Puppeteer fails to launch:
```bash
# Install required dependencies (Ubuntu/Debian)
sudo apt-get install -y chromium-browser

# macOS
brew install chromium
```

## Development

### Server Development
```bash
cd server
npm run dev  # Runs with nodemon for auto-reload
```

### Client Development
```bash
cd client
npm run dev  # Runs Vite dev server
```

### Building for Production

Backend:
```bash
cd server
npm run build
npm start
```

Frontend:
```bash
cd client
npm run build
npm run preview
```

## Security Considerations

- Never commit `.env` files with credentials
- Use environment variables for sensitive data
- Implement proper session management for production
- Add rate limiting and request validation
- Use HTTPS in production

## Next Steps

After validating the POC:
1. Implement robust error handling
2. Add data caching layer
3. Create lineup optimization algorithms
4. Add waiver wire management
5. Implement trade analysis
6. Add real-time notifications
7. Support multiple leagues

## License

This is a proof of concept for educational purposes. Ensure you comply with ESPN's terms of service when using their API.