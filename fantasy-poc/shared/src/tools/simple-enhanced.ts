// Minimal roster tool for testing
import { espnApi } from '../services/espnApi.js';

export async function getMyRoster(args: { leagueId: string; teamId: string }) {
  const { leagueId, teamId } = args;
  
  if (!leagueId || !teamId) {
    throw new Error('League ID and Team ID are required');
  }
  
  // Mock implementation for testing
  const roster = await espnApi.getTeamRoster(leagueId, teamId);
  
  return {
    success: true,
    leagueId,
    teamId,
    starters: roster.starters,
    bench: roster.bench,
    message: 'Roster retrieved successfully (test mode)'
  };
}