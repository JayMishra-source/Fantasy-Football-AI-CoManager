import axios from 'axios';
import type { League, Team, Roster } from '../types/espn';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Enable cookies to be sent with requests
});

// Store cookies in memory for the session
let sessionCookies: { espn_s2?: string; swid?: string } = {};

export const setSessionCookies = (cookies: { espn_s2: string; swid: string }) => {
  sessionCookies = cookies;
  // Add cookies to default headers
  if (cookies.espn_s2 && cookies.swid) {
    api.defaults.headers.common['X-ESPN-S2'] = cookies.espn_s2;
    api.defaults.headers.common['X-ESPN-SWID'] = cookies.swid;
  }
};

export const getSessionCookies = () => sessionCookies;

export const authApi = {
  login: async (username: string, password: string) => {
    const response = await api.post('/api/auth/login', { username, password });
    return response.data;
  },
  
  publicLogin: async (leagueId: string) => {
    const response = await api.post('/api/auth/public-login', { leagueId });
    return response.data;
  },
  
  manualLogin: async (username: string, espn_s2: string, swid: string) => {
    const response = await api.post('/api/auth/manual-login', { username, espn_s2, swid });
    // Store the cookies for future requests
    if (response.data.success) {
      setSessionCookies({ espn_s2, swid });
    }
    return response.data;
  },
  
  logout: async (username: string) => {
    const response = await api.post('/api/auth/logout', { username });
    return response.data;
  },

  getCookieInstructions: async () => {
    const response = await api.get('/api/auth/cookie-instructions');
    return response.data;
  }
};

export const espnApi = {
  getLeague: async (leagueId: string): Promise<League> => {
    const response = await api.get(`/api/espn/league/${leagueId}`);
    return response.data;
  },
  
  getTeams: async (leagueId: string): Promise<{ teams: Team[] }> => {
    const response = await api.get(`/api/espn/league/${leagueId}/teams`);
    return response.data;
  },
  
  getRoster: async (leagueId: string, teamId: string): Promise<Roster> => {
    const response = await api.get(`/api/espn/league/${leagueId}/team/${teamId}/roster`);
    return response.data;
  },
  
  getPlayers: async (leagueId: string) => {
    const response = await api.get(`/api/espn/league/${leagueId}/players`);
    return response.data;
  },
  
  getMatchups: async (leagueId: string, week: number) => {
    const response = await api.get(`/api/espn/league/${leagueId}/matchups/${week}`);
    return response.data;
  },
  
  getTransactions: async (leagueId: string) => {
    const response = await api.get(`/api/espn/league/${leagueId}/transactions`);
    return response.data;
  },
  
  testEndpoint: async (endpoint: string, params: any) => {
    const response = await api.post('/api/espn/test-endpoint', { endpoint, params });
    return response.data;
  }
};