import { useState, type FC } from 'react';
import axios from 'axios';
import { ResponseFormatter } from './ResponseFormatter';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003';

export const CookieTester: FC = () => {
  const [espnS2, setEspnS2] = useState('');
  const [swid, setSwid] = useState('');
  const [leagueId, setLeagueId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const testCookies = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/test/test-cookies`, {
        espn_s2: espnS2,
        swid: swid,
        leagueId: leagueId
      });

      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
      if (err.response?.data?.hint) {
        setError(prev => `${prev}\n\nHint: ${err.response.data.hint}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const testPublicLeague = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/test/test-public-league`, {
        leagueId: leagueId
      });

      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cookie-tester">
      <h2>ESPN Cookie Tester</h2>
      <p>Use this tool to test if your cookies are working correctly.</p>

      <div className="form-group">
        <label htmlFor="leagueId">League ID:</label>
        <input
          type="text"
          id="leagueId"
          value={leagueId}
          onChange={(e) => setLeagueId(e.target.value)}
          placeholder="Enter your league ID"
        />
      </div>

      <div className="test-section">
        <h3>Test Public Access</h3>
        <p>First, let's check if your league is public:</p>
        <button 
          onClick={testPublicLeague} 
          disabled={loading || !leagueId}
        >
          Test Public League Access
        </button>
      </div>

      <div className="test-section">
        <h3>Test Private League with Cookies</h3>
        <p>If the league is private, test with your cookies:</p>

        <div className="form-group">
          <label htmlFor="espnS2">ESPN_S2 Cookie:</label>
          <textarea
            id="espnS2"
            value={espnS2}
            onChange={(e) => setEspnS2(e.target.value)}
            placeholder="Paste your espn_s2 cookie value here"
            rows={3}
          />
        </div>

        <div className="form-group">
          <label htmlFor="swid">SWID Cookie:</label>
          <input
            type="text"
            id="swid"
            value={swid}
            onChange={(e) => setSwid(e.target.value)}
            placeholder="{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}"
          />
        </div>

        <button 
          onClick={testCookies} 
          disabled={loading || !espnS2 || !swid || !leagueId}
        >
          Test Cookies
        </button>
      </div>

      {loading && <div className="loading">Testing...</div>}

      {error && (
        <div className="error-box">
          <h3>Error:</h3>
          <pre>{error}</pre>
        </div>
      )}

      {result && (
        <div className="success-box">
          <h3>Success!</h3>
          <ResponseFormatter 
            data={result} 
            endpoint="testResult"
          />
        </div>
      )}

      <div className="cookie-help">
        <h3>How to get your cookies:</h3>
        <ol>
          <li>Go to <a href="https://fantasy.espn.com" target="_blank" rel="noopener noreferrer">ESPN Fantasy Football</a></li>
          <li>Log in to your account</li>
          <li>Open Developer Tools (F12)</li>
          <li>Go to Application → Cookies → fantasy.espn.com</li>
          <li>Copy the <strong>espn_s2</strong> value (entire string)</li>
          <li>Copy the <strong>SWID</strong> value (including curly braces)</li>
        </ol>
      </div>
    </div>
  );
};