import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

router.post('/test-cookies', async (req: Request, res: Response) => {
  try {
    const { espn_s2, swid, leagueId } = req.body;
    
    if (!espn_s2 || !swid || !leagueId) {
      return res.status(400).json({ 
        error: 'espn_s2, swid, and leagueId are required' 
      });
    }

    // Clean up cookies
    const cleanEspnS2 = espn_s2.trim().replace(/^["']|["']$/g, '');
    const cleanSwid = swid.trim().replace(/^["']|["']$/g, '');
    
    console.log('Testing cookies directly...');
    console.log('League ID:', leagueId);
    console.log('espn_s2 (first 10 chars):', cleanEspnS2.substring(0, 10));
    console.log('SWID:', cleanSwid);

    // Test with a simple ESPN API call using the new API base URL (changed in April 2024)
    const year = 2024;
    const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}`;
    
    console.log('Testing URL:', url);

    const response = await axios.get(url, {
      headers: {
        'Cookie': `espn_s2=${cleanEspnS2}; SWID=${cleanSwid}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    // Check if response is HTML (like the league endpoint does)
    if (typeof response.data === 'string' && response.data.trim().startsWith('<')) {
      console.error('Cookie test received HTML instead of JSON');
      throw new Error('ESPN API returned HTML - cookies may be invalid or expired');
    }

    console.log('Test successful! League data retrieved.');
    console.log('Response data type:', typeof response.data);
    console.log('Response data keys:', Object.keys(response.data || {}));
    console.log('Response data:', JSON.stringify(response.data).substring(0, 500));
    
    res.json({
      success: true,
      message: 'Cookies are valid!',
      leagueInfo: {
        id: response.data.id,
        name: response.data.settings?.name,
        seasonId: response.data.seasonId,
        status: response.data.status,
        teams: response.data.teams?.length,
        members: response.data.members?.length
      },
      rawData: response.data // Include the full response for debugging
    });

  } catch (error: any) {
    console.error('Cookie test failed:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      
      if (error.response.status === 401) {
        return res.status(401).json({
          success: false,
          error: 'Authentication failed. Cookies may be invalid or expired.',
          hint: 'Make sure you copied the entire cookie values including any special characters.'
        });
      } else if (error.response.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'League not found. Check your League ID.',
          leagueId: req.body.leagueId
        });
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Check if cookies are valid and league ID is correct'
    });
  }
});

router.post('/test-public-league', async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.body;
    
    if (!leagueId) {
      return res.status(400).json({ 
        error: 'leagueId is required' 
      });
    }

    console.log('Testing public league access...');
    console.log('League ID:', leagueId);

    const year = 2024; // Use 2024 since 2025 season hasn't started  
    const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}`;
    
    console.log('Testing URL:', url);

    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    console.log('Public league access successful!');
    
    res.json({
      success: true,
      message: 'Public league accessed successfully!',
      leagueInfo: {
        id: response.data.id,
        name: response.data.settings?.name,
        seasonId: response.data.seasonId,
        isPublic: true
      }
    });

  } catch (error: any) {
    console.error('Public league test failed:', error.message);
    
    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'This is a private league. Authentication required.',
        requiresCookies: true
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'League may be private or ID may be incorrect'
    });
  }
});

export default router;