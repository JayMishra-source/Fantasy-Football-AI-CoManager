// Minimal roster tool for testing
import { espnApi } from '../services/espnApi.js';

export async function getMyRoster(args: { leagueId: string; teamId: string }) {
  const { leagueId, teamId } = args;
  
  if (!leagueId || !teamId) {
    throw new Error('League ID and Team ID are required');
  }
  
  console.log(`🔍 Fetching roster and waiver wire data for league ${leagueId}, team ${teamId}...`);
  
  // Get current roster
  const roster = await espnApi.getTeamRoster(leagueId, teamId);
  console.log(`✅ Roster fetched: ${roster.starters.length} starters, ${roster.bench.length} bench`);
  
  // Get available players (waiver wire + free agents)
  console.log(`🔍 Fetching available players from waiver wire...`);
  const availablePlayers = await espnApi.getAvailablePlayers(leagueId);
  console.log(`✅ Available players fetched: ${availablePlayers.length} total`);
  
  // Sort and filter available players by position and relevance
  const topAvailableByPosition: Record<string, any[]> = {
    QB: availablePlayers
      .filter(p => p.position === 'QB')
      .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0))
      .slice(0, 5), // Top 5 QBs
    RB: availablePlayers
      .filter(p => p.position === 'RB') 
      .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0))
      .slice(0, 8), // Top 8 RBs
    WR: availablePlayers
      .filter(p => p.position === 'WR')
      .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0))
      .slice(0, 8), // Top 8 WRs  
    TE: availablePlayers
      .filter(p => p.position === 'TE')
      .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0))
      .slice(0, 5), // Top 5 TEs
    'D/ST': availablePlayers
      .filter(p => p.position === 'D/ST')
      .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0))
      .slice(0, 5), // Top 5 defenses
    K: availablePlayers
      .filter(p => p.position === 'K')
      .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0))
      .slice(0, 5) // Top 5 kickers
  };
  
  const totalWaiverPlayers = Object.values(topAvailableByPosition).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`📊 Top waiver wire players by position: QB(${topAvailableByPosition.QB.length}), RB(${topAvailableByPosition.RB.length}), WR(${topAvailableByPosition.WR.length}), TE(${topAvailableByPosition.TE.length}), D/ST(${topAvailableByPosition['D/ST'].length}), K(${topAvailableByPosition.K.length}) = ${totalWaiverPlayers} total`);
  
  return {
    success: true,
    leagueId,
    teamId,
    starters: roster.starters,
    bench: roster.bench,
    injuredReserve: roster.injuredReserve || [],
    availablePlayers: topAvailableByPosition,
    message: `Roster retrieved with ${totalWaiverPlayers} top waiver wire options by position`
  };
}