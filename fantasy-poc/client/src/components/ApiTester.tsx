import { useState, type FC } from 'react';
import { espnApi } from '../services/api';
import { ResponseFormatter } from './ResponseFormatter';

interface ApiTesterProps {
  leagueId: string;
}

const API_ENDPOINTS = [
  { name: 'League Info', endpoint: 'getLeague', params: [] },
  { name: 'Teams', endpoint: 'getTeams', params: [] },
  { name: 'Players', endpoint: 'getPlayers', params: [] },
  { name: 'Transactions', endpoint: 'getTransactions', params: [] },
  { name: 'Matchups', endpoint: 'getMatchups', params: ['week'] },
  { name: 'Roster', endpoint: 'getRoster', params: ['teamId'] },
];

export const ApiTester: FC<ApiTesterProps> = ({ leagueId }) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState(API_ENDPOINTS[0]);
  const [params, setParams] = useState<{ [key: string]: string }>({});
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTest = async () => {
    setLoading(true);
    setError('');
    setResponse(null);

    try {
      let result;
      
      if (selectedEndpoint.endpoint === 'getLeague') {
        result = await espnApi.getLeague(leagueId);
      } else if (selectedEndpoint.endpoint === 'getTeams') {
        result = await espnApi.getTeams(leagueId);
      } else if (selectedEndpoint.endpoint === 'getPlayers') {
        result = await espnApi.getPlayers(leagueId);
      } else if (selectedEndpoint.endpoint === 'getTransactions') {
        result = await espnApi.getTransactions(leagueId);
      } else if (selectedEndpoint.endpoint === 'getMatchups') {
        result = await espnApi.getMatchups(leagueId, parseInt(params.week || '1'));
      } else if (selectedEndpoint.endpoint === 'getRoster') {
        result = await espnApi.getRoster(leagueId, params.teamId || '1');
      }
      
      setResponse(result);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomTest = async () => {
    setLoading(true);
    setError('');
    setResponse(null);

    try {
      const customEndpoint = params.customEndpoint || '';
      const customParams = params.customParams ? JSON.parse(params.customParams) : {};
      const result = await espnApi.testEndpoint(customEndpoint, customParams);
      setResponse(result);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="api-tester">
      <h2>ESPN API Tester</h2>
      
      <div className="tester-controls">
        <div className="form-group">
          <label>Select Endpoint:</label>
          <select 
            value={selectedEndpoint.name}
            onChange={(e) => {
              const endpoint = API_ENDPOINTS.find(ep => ep.name === e.target.value);
              if (endpoint) {
                setSelectedEndpoint(endpoint);
                setParams({});
              }
            }}
          >
            {API_ENDPOINTS.map(ep => (
              <option key={ep.name} value={ep.name}>{ep.name}</option>
            ))}
            <option value="custom">Custom Endpoint</option>
          </select>
        </div>

        {selectedEndpoint.params.map(param => (
          <div key={param} className="form-group">
            <label>{param}:</label>
            <input
              type="text"
              value={params[param] || ''}
              onChange={(e) => setParams({ ...params, [param]: e.target.value })}
              placeholder={`Enter ${param}`}
            />
          </div>
        ))}

        {selectedEndpoint.name === 'custom' && (
          <>
            <div className="form-group">
              <label>Custom Endpoint:</label>
              <input
                type="text"
                value={params.customEndpoint || ''}
                onChange={(e) => setParams({ ...params, customEndpoint: e.target.value })}
                placeholder="/seasons/2024/segments/0/leagues/{leagueId}"
              />
            </div>
            <div className="form-group">
              <label>Parameters (JSON):</label>
              <textarea
                value={params.customParams || ''}
                onChange={(e) => setParams({ ...params, customParams: e.target.value })}
                placeholder='{"view": "mTeam"}'
                rows={3}
              />
            </div>
          </>
        )}

        <button 
          onClick={selectedEndpoint.name === 'custom' ? handleCustomTest : handleTest}
          disabled={loading}
        >
          {loading ? 'Testing...' : 'Test Endpoint'}
        </button>
      </div>

      {error && (
        <div className="error-box">
          <h3>Error:</h3>
          <pre>{error}</pre>
        </div>
      )}

      {response && (
        <div className="response-box">
          <h3>Response:</h3>
          <ResponseFormatter 
            data={response} 
            endpoint={selectedEndpoint.endpoint}
          />
        </div>
      )}
    </div>
  );
};