import { getRosterTool } from './roster.js';

// Simple enhanced tools for easy access

export async function getMyRoster(args?: { team?: string }) {
  // Default to League 1 (your main team) if no team specified
  let leagueId = '2078910238';
  let teamId = '1';
  
  // Handle team aliases
  if (args?.team) {
    const team = args.team.toLowerCase().trim();
    if (team.includes('league 2') || team.includes('desi') || team.includes('rookie')) {
      leagueId = '21366365';
      teamId = '7';
    }
  }
  
  const result = await getRosterTool({ leagueId, teamId });
  
  // Add context info
  const leagueName = leagueId === '2078910238' ? 'LA Locker Room Boys' : 'Desi Rookies League';
  
  return {
    league: leagueName,
    leagueId,
    selectedTeamId: teamId,
    ...result
  };
}