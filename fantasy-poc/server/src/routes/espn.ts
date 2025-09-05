import { Router, Request, Response } from 'express';
import axios from 'axios';
import { espnApi } from '../services/espnApi';

const router = Router();

router.get('/league/:leagueId', async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.params;
    
    // Try to get cookies from the espnApi service first (set during login)
    const storedCookies = espnApi.getCookies();
    let espn_s2 = storedCookies?.espn_s2 || req.headers['x-espn-s2'] as string;
    let swid = storedCookies?.swid || req.headers['x-espn-swid'] as string;
    
    console.log('League endpoint called for league:', leagueId);
    console.log('Using cookies:', {
      'espn_s2': espn_s2 ? 'Present (first 10 chars: ' + espn_s2.substring(0, 10) + ')' : 'Missing',
      'swid': swid ? 'Present' : 'Missing',
      'source': storedCookies?.espn_s2 ? 'Stored from login' : 'From request headers'
    });
    
    if (!espn_s2 || !swid) {
      return res.status(401).json({ 
        error: 'Authentication required. Please login first using Manual Login with your ESPN cookies.' 
      });
    }
    
    // Use 2024 season and the new ESPN API base URL (changed in April 2024)
    const year = 2024;
    const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}`;
    
    // Clean the cookies
    const cleanEspnS2 = espn_s2.trim().replace(/^["']|["']$/g, '');
    const cleanSwid = swid.trim().replace(/^["']|["']$/g, '');
    
    console.log('Making request to:', url);
    
    const response = await axios.get(url, {
      headers: {
        'Cookie': `espn_s2=${cleanEspnS2}; SWID=${cleanSwid}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://fantasy.espn.com/',
        'X-Fantasy-Filter': JSON.stringify({"players":{"filterStatsForExternalIds":{"value":[2024,2023,2022,2021,2020,2019,2018,2017]}}})
      }
    });
    
    if (typeof response.data === 'string' && response.data.trim().startsWith('<')) {
      console.error('Received HTML instead of JSON');
      console.log('HTTP Status:', response.status);
      console.log('Response headers:', response.headers);
      console.log('First 1000 chars of HTML response:', response.data.substring(0, 1000));
      throw new Error('ESPN API returned HTML - cookies may be invalid or expired');
    }
    
    console.log('Successfully retrieved league data');
    res.json(response.data);
  } catch (error: any) {
    console.error('League API error:', error.message);
    if (error.response?.status === 401) {
      res.status(401).json({ 
        error: 'Authentication failed. Your ESPN cookies may have expired. Please get fresh cookies from ESPN.' 
      });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.get('/league/:leagueId/teams', async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.params;
    // Get cookies from headers if sent from client
    const espn_s2 = req.headers['x-espn-s2'] as string;
    const swid = req.headers['x-espn-swid'] as string;
    
    if (espn_s2 && swid) {
      espnApi.setCookies({ espn_s2, swid });
    }
    
    const data = await espnApi.getTeams(leagueId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/league/:leagueId/team/:teamId/roster', async (req: Request, res: Response) => {
  try {
    const { leagueId, teamId } = req.params;
    const data = await espnApi.getRoster(leagueId, teamId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/league/:leagueId/players', async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.params;
    const data = await espnApi.getPlayers(leagueId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/league/:leagueId/matchups/:week', async (req: Request, res: Response) => {
  try {
    const { leagueId, week } = req.params;
    const data = await espnApi.getMatchups(leagueId, parseInt(week));
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/league/:leagueId/transactions', async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.params;
    const data = await espnApi.getTransactions(leagueId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/test-endpoint', async (req: Request, res: Response) => {
  try {
    const { endpoint, params } = req.body;
    const data = await espnApi.testEndpoint(endpoint, params);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;