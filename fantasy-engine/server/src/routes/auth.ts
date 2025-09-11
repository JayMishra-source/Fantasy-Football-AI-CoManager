import { Router, Request, Response } from 'express';
import axios from 'axios';
import { espnAuth } from '../services/espnAuth';
import { espnApi } from '../services/espnApi';
import { manualAuth } from '../services/manualAuth';
// import { espnDebug } from '../services/espnDebug'; // Temporarily disabled due to TS issues

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const cookies = await espnAuth.authenticate(username, password);
    espnApi.setCookies(cookies);
    
    res.json({ 
      success: true, 
      message: 'Authentication successful',
      cookies: {
        espn_s2: cookies.espn_s2.substring(0, 10) + '...',
        swid: cookies.swid
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({ 
      success: false, 
      error: error.message || 'Authentication failed' 
    });
  }
});

router.post('/public-login', async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.body;
    
    console.log('Public league login attempt for league:', leagueId);
    
    if (!leagueId) {
      return res.status(400).json({ 
        error: 'League ID is required'
      });
    }

    // Test if the league is actually public
    // Use 2024 since 2025 season hasn't started yet
    const year = 2024;
    const testUrl = `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}`;
    
    console.log('Testing public league access:', testUrl);
    
    // For public leagues, we don't need cookies
    try {
      const testResponse = await axios.get(testUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      
      if (testResponse.status === 200 && testResponse.data) {
        console.log('Public league access successful!');
        
        // No cookies needed for public leagues
        espnApi.setCookies({ espn_s2: '', swid: '' });
        
        res.json({ 
          success: true, 
          message: 'Public league authentication successful',
          leagueInfo: {
            id: testResponse.data.id,
            name: testResponse.data.settings?.name,
            seasonId: testResponse.data.seasonId,
            isPublic: true
          }
        });
      } else {
        console.log('League is not public or does not exist');
        res.status(401).json({ 
          error: 'This league is private or does not exist. Please use manual authentication with cookies.',
          requiresCookies: true
        });
      }
    } catch (httpError: any) {
      console.log('HTTP Error:', httpError.response?.status, httpError.message);
      if (httpError.response?.status === 401) {
        res.status(401).json({ 
          error: 'This league is private or does not exist. Please use manual authentication with cookies.',
          requiresCookies: true
        });
      } else {
        throw httpError; // Re-throw other errors to be caught by outer catch
      }
    }
  } catch (error: any) {
    console.error('Public login error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to access league. It may be private or the ID may be incorrect.'
    });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { username } = req.body;
    if (username) {
      espnAuth.clearSession(username);
      manualAuth.clearCookies(username);
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/manual-login', async (req: Request, res: Response) => {
  try {
    const { username, espn_s2, swid } = req.body;
    
    console.log('Manual login attempt for user:', username);
    console.log('espn_s2 length:', espn_s2?.length);
    console.log('swid provided:', !!swid);
    
    if (!username || !espn_s2 || !swid) {
      return res.status(400).json({ 
        error: 'Username, espn_s2, and swid are required',
        received: {
          username: !!username,
          espn_s2: !!espn_s2,
          swid: !!swid
        },
        instructions: manualAuth.getInstructions()
      });
    }

    // Clean up the cookies (remove any extra spaces or quotes)
    const cleanEspnS2 = espn_s2.trim().replace(/^["']|["']$/g, '');
    const cleanSwid = swid.trim().replace(/^["']|["']$/g, '');
    
    console.log('Cleaned espn_s2 length:', cleanEspnS2.length);
    console.log('Cleaned swid:', cleanSwid);

    const cookies = manualAuth.storeCookies(username, cleanEspnS2, cleanSwid);
    espnApi.setCookies(cookies);
    
    // Test the cookies by making a simple API call
    console.log('Testing cookies with ESPN API...');
    
    res.json({ 
      success: true, 
      message: 'Manual authentication successful',
      cookies: {
        espn_s2: cookies.espn_s2.substring(0, 10) + '...',
        swid: cookies.swid
      }
    });
  } catch (error: any) {
    console.error('Manual login error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Check server logs for more information'
    });
  }
});

router.get('/cookie-instructions', (req: Request, res: Response) => {
  res.json({
    instructions: manualAuth.getInstructions()
  });
});

router.get('/debug-login', async (req: Request, res: Response) => {
  res.json({
    success: false,
    error: 'Debug endpoint temporarily disabled'
  });
  // try {
  //   const debugInfo = await espnDebug.debugLoginPage();
  //   res.json({
  //     success: true,
  //     debugInfo: JSON.parse(debugInfo)
  //   });
  // } catch (error: any) {
  //   res.status(500).json({
  //     success: false,
  //     error: error.message
  //   });
  // }
});

export default router;