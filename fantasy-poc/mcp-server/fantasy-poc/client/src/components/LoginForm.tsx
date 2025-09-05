import { useState, useEffect, type FC } from 'react';
import { authApi } from '../services/api';

interface LoginFormProps {
  onSuccess: (leagueId: string, teamId?: string) => void;
}

// Cookie cache helper functions
const CACHE_KEY = 'espn-fantasy-cookies';
const CACHE_EXPIRY_DAYS = 7; // Cache for 7 days

interface CachedData {
  username: string;
  espnS2: string;
  swid: string;
  leagueId: string;
  teamId: string;
  cachedAt: number;
}

const saveCookiesToCache = (data: Partial<CachedData>) => {
  try {
    const existingData = loadCookiesFromCache() || {};
    const cacheData: CachedData = {
      ...existingData,
      ...data,
      cachedAt: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to save cookies to cache:', error);
  }
};

const loadCookiesFromCache = (): CachedData | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const data: CachedData = JSON.parse(cached);
    const isExpired = Date.now() - data.cachedAt > CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    
    if (isExpired) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return data;
  } catch (error) {
    console.warn('Failed to load cookies from cache:', error);
    return null;
  }
};

const clearCookieCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn('Failed to clear cookie cache:', error);
  }
};

export const LoginForm: FC<LoginFormProps> = ({ onSuccess }) => {
  const [authMethod, setAuthMethod] = useState<'public' | 'auto' | 'manual'>('public');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [espnS2, setEspnS2] = useState('');
  const [swid, setSwid] = useState('');
  const [leagueId, setLeagueId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [hasCachedData, setHasCachedData] = useState(false);

  // Load cached cookies on component mount
  useEffect(() => {
    const cachedData = loadCookiesFromCache();
    if (cachedData) {
      setUsername(cachedData.username || '');
      setEspnS2(cachedData.espnS2 || '');
      setSwid(cachedData.swid || '');
      setLeagueId(cachedData.leagueId || '');
      setTeamId(cachedData.teamId || '');
      setHasCachedData(true);
      
      // Auto-select manual login if we have cached cookies
      if (cachedData.espnS2 && cachedData.swid) {
        setAuthMethod('manual');
      }
    }
  }, []);

  // Save to cache when key values change (debounced)
  useEffect(() => {
    if (authMethod === 'manual' && (espnS2 || swid || username || leagueId)) {
      const timeoutId = setTimeout(() => {
        saveCookiesToCache({
          username,
          espnS2,
          swid,
          leagueId,
          teamId
        });
      }, 1000); // Debounce for 1 second

      return () => clearTimeout(timeoutId);
    }
  }, [authMethod, username, espnS2, swid, leagueId, teamId]);

  const handleClearCache = () => {
    clearCookieCache();
    setUsername('');
    setEspnS2('');
    setSwid('');
    setLeagueId('');
    setTeamId('');
    setHasCachedData(false);
    setError('');
  };

  const handlePublicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await authApi.publicLogin(leagueId);
      if (result.success) {
        console.log('Public league login successful:', result.leagueInfo);
        onSuccess(leagueId, teamId || undefined);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to access league';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await authApi.login(username, password);
      if (result.success) {
        onSuccess(leagueId, teamId || undefined);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Login failed';
      setError(`Auto login failed: ${errorMsg}. Try manual authentication instead.`);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await authApi.manualLogin(username, espnS2, swid);
      if (result.success) {
        // Save cookies to cache on successful login
        saveCookiesToCache({
          username,
          espnS2,
          swid,
          leagueId,
          teamId
        });
        setHasCachedData(true);
        
        onSuccess(leagueId, teamId || undefined);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Manual login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-form">
      <h2>ESPN Fantasy Football Login</h2>
      
      <div className="auth-method-selector">
        <label>
          <input
            type="radio"
            value="public"
            checked={authMethod === 'public'}
            onChange={(e) => setAuthMethod(e.target.value as 'public' | 'auto' | 'manual')}
          />
          Public League (No Login Required)
        </label>
        <label>
          <input
            type="radio"
            value="auto"
            checked={authMethod === 'auto'}
            onChange={(e) => setAuthMethod(e.target.value as 'public' | 'auto' | 'manual')}
          />
          Private League - Automatic Login
        </label>
        <label>
          <input
            type="radio"
            value="manual"
            checked={authMethod === 'manual'}
            onChange={(e) => setAuthMethod(e.target.value as 'public' | 'auto' | 'manual')}
          />
          Private League - Manual (Cookies) {hasCachedData && <span style={{ color: 'green', fontSize: '12px' }}>✅ Cached</span>}
        </label>
      </div>

      {authMethod === 'public' ? (
        <form onSubmit={handlePublicSubmit}>
          <div className="form-group">
            <label htmlFor="publicLeagueId">League ID:</label>
            <input
              type="text"
              id="publicLeagueId"
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              placeholder="Found in your league URL"
              required
              disabled={loading}
            />
            <small>Example: If your league URL is fantasy.espn.com/football/league?leagueId=123456, enter 123456</small>
          </div>

          <div className="form-group">
            <label htmlFor="publicTeamId">Team ID (optional):</label>
            <input
              type="text"
              id="publicTeamId"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              placeholder="Your team ID"
              disabled={loading}
            />
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading || !leagueId}>
            {loading ? 'Accessing League...' : 'Access Public League'}
          </button>
        </form>
      ) : authMethod === 'auto' ? (
        <form onSubmit={handleAutoSubmit}>
          <div className="form-group">
            <label htmlFor="username">ESPN Username/Email:</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="leagueId">League ID:</label>
            <input
              type="text"
              id="leagueId"
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              placeholder="Found in your league URL"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="teamId">Team ID (optional):</label>
            <input
              type="text"
              id="teamId"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              placeholder="Your team ID"
              disabled={loading}
            />
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login with Credentials'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleManualSubmit}>
          {hasCachedData && (
            <div className="cache-status">
              <p style={{ color: 'green', fontSize: '14px' }}>
                ✅ Using cached cookies and data
              </p>
              <button 
                type="button" 
                onClick={handleClearCache}
                className="clear-cache-button"
                style={{ 
                  background: '#ff6b6b', 
                  color: 'white', 
                  border: 'none', 
                  padding: '4px 8px', 
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  marginBottom: '10px'
                }}
              >
                Clear Cached Data
              </button>
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="manualUsername">Username (for session storage):</label>
            <input
              type="text"
              id="manualUsername"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="espnS2">ESPN_S2 Cookie:</label>
            <textarea
              id="espnS2"
              value={espnS2}
              onChange={(e) => setEspnS2(e.target.value)}
              placeholder="Paste your espn_s2 cookie value here"
              required
              disabled={loading}
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
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="manualLeagueId">League ID:</label>
            <input
              type="text"
              id="manualLeagueId"
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              placeholder="Found in your league URL"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="manualTeamId">Team ID (optional):</label>
            <input
              type="text"
              id="manualTeamId"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              placeholder="Your team ID"
              disabled={loading}
            />
          </div>

          <button 
            type="button" 
            onClick={() => setShowInstructions(!showInstructions)}
            className="help-button"
          >
            {showInstructions ? 'Hide' : 'Show'} Cookie Instructions
          </button>

          {showInstructions && (
            <div className="cookie-instructions">
              <h4>How to get ESPN cookies:</h4>
              <ol>
                <li>Open ESPN Fantasy Football in your browser</li>
                <li>Log in to your account</li>
                <li>Open Developer Tools (F12 or right-click → Inspect)</li>
                <li>Go to Application/Storage → Cookies → fantasy.espn.com</li>
                <li>Find and copy the values for:
                  <ul>
                    <li><strong>espn_s2</strong>: Copy the entire value</li>
                    <li><strong>SWID</strong>: Copy including the curly braces</li>
                  </ul>
                </li>
                <li>Paste the values above</li>
              </ol>
            </div>
          )}

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Authenticating...' : 'Login with Cookies'}
          </button>
        </form>
      )}
    </div>
  );
};