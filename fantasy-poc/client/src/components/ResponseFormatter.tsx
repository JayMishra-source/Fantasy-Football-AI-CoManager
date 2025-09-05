import { type FC } from 'react';

interface ResponseFormatterProps {
  data: any;
  endpoint: string;
}

interface Player {
  id?: number;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  proTeamId?: number;
  defaultPositionId?: number;
  injuryStatus?: string;
  stats?: Array<{
    scoringPeriodId: number;
    appliedTotal: number;
    appliedAverage?: number;
  }>;
}

interface Team {
  id?: number;
  location?: string;
  nickname?: string;
  abbrev?: string;
  owners?: Array<{ firstName?: string; lastName?: string }>;
  record?: {
    overall?: { wins?: number; losses?: number; ties?: number };
  };
  points?: number;
  pointsAgainst?: number;
  roster?: {
    entries?: Array<{
      playerId?: number;
      playerPoolEntry?: { player?: Player };
      lineupSlotId?: number;
    }>;
  };
}

const POSITION_MAP: { [key: number]: string } = {
  0: 'QB', 1: 'TQB', 2: 'RB', 3: 'RB/WR', 4: 'WR', 5: 'WR/TE', 
  6: 'TE', 7: 'OP', 8: 'DT', 9: 'DE', 10: 'LB', 11: 'DL', 
  12: 'CB', 13: 'S', 14: 'DB', 15: 'DP', 16: 'D/ST', 17: 'K', 
  18: 'P', 19: 'HC', 20: 'BE', 21: 'IR', 22: '', 23: 'FLEX'
};

const LINEUP_SLOT_MAP: { [key: number]: string } = {
  0: 'QB', 2: 'RB', 4: 'WR', 6: 'TE', 16: 'D/ST', 17: 'K',
  20: 'BENCH', 21: 'IR', 23: 'FLEX'
};

const formatLeagueInfo = (data: any) => {
  const league = data;
  return (
    <div className="league-info">
      <h3>🏈 League Information</h3>
      <div className="info-grid">
        <div className="info-item">
          <strong>League Name:</strong> {league.settings?.name || 'N/A'}
        </div>
        <div className="info-item">
          <strong>Season:</strong> {league.seasonId}
        </div>
        <div className="info-item">
          <strong>League ID:</strong> {league.id}
        </div>
        <div className="info-item">
          <strong>Size:</strong> {league.settings?.size || league.teams?.length || 'N/A'} teams
        </div>
        <div className="info-item">
          <strong>Scoring Type:</strong> {league.settings?.scoringType === 0 ? 'Standard' : 'PPR'}
        </div>
        <div className="info-item">
          <strong>Current Week:</strong> {league.scoringPeriodId}
        </div>
      </div>
    </div>
  );
};

const formatTeams = (data: any) => {
  const teams: Team[] = data.teams || [];
  return (
    <div className="teams-list">
      <h3>👥 Teams ({teams.length})</h3>
      <div className="teams-grid">
        {teams.map((team, index) => (
          <div key={team.id || index} className="team-card">
            <div className="team-header">
              <h4>{team.location} {team.nickname}</h4>
              <span className="team-abbrev">{team.abbrev}</span>
            </div>
            <div className="team-stats">
              <div className="record">
                <strong>Record:</strong> {team.record?.overall?.wins || 0}-{team.record?.overall?.losses || 0}-{team.record?.overall?.ties || 0}
              </div>
              <div className="points">
                <strong>Points For:</strong> {team.points?.toFixed(1) || '0.0'}
              </div>
              <div className="points-against">
                <strong>Points Against:</strong> {team.pointsAgainst?.toFixed(1) || '0.0'}
              </div>
            </div>
            {team.owners && team.owners.length > 0 && (
              <div className="owners">
                <strong>Owner(s):</strong> {team.owners.map(owner => 
                  `${owner.firstName || ''} ${owner.lastName || ''}`.trim()
                ).join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const formatRoster = (data: any) => {
  const roster = data.entries || [];
  const starters = roster.filter((entry: any) => entry.lineupSlotId < 20);
  const bench = roster.filter((entry: any) => entry.lineupSlotId === 20);
  const ir = roster.filter((entry: any) => entry.lineupSlotId === 21);

  const formatPlayer = (entry: any) => {
    const player = entry.playerPoolEntry?.player;
    if (!player) return null;
    
    const position = LINEUP_SLOT_MAP[entry.lineupSlotId] || 'UNKNOWN';
    const stats = player.stats?.[0];
    
    return (
      <div key={entry.playerId} className="player-entry">
        <div className="player-position">{position}</div>
        <div className="player-details">
          <div className="player-name">{player.fullName}</div>
          <div className="player-meta">
            {POSITION_MAP[player.defaultPositionId]} 
            {player.injuryStatus && <span className="injury"> - {player.injuryStatus}</span>}
          </div>
        </div>
        <div className="player-points">
          {stats?.appliedTotal?.toFixed(1) || '0.0'} pts
        </div>
      </div>
    );
  };

  return (
    <div className="roster-display">
      <h3>📋 Team Roster</h3>
      
      {starters.length > 0 && (
        <div className="roster-section">
          <h4>Starting Lineup</h4>
          <div className="players-list">
            {starters.map(formatPlayer)}
          </div>
        </div>
      )}
      
      {bench.length > 0 && (
        <div className="roster-section">
          <h4>Bench</h4>
          <div className="players-list">
            {bench.map(formatPlayer)}
          </div>
        </div>
      )}
      
      {ir.length > 0 && (
        <div className="roster-section">
          <h4>Injured Reserve</h4>
          <div className="players-list">
            {ir.map(formatPlayer)}
          </div>
        </div>
      )}
    </div>
  );
};

const formatPlayers = (data: any) => {
  const players: Player[] = data.players || [];
  const limitedPlayers = players.slice(0, 50); // Show first 50 to avoid overwhelming UI
  
  return (
    <div className="players-list">
      <h3>⭐ Players ({players.length} total, showing first 50)</h3>
      <div className="players-grid">
        {limitedPlayers.map((player, index) => (
          <div key={player.id || index} className="player-card">
            <div className="player-name">{player.fullName}</div>
            <div className="player-position">{POSITION_MAP[player.defaultPositionId || 0]}</div>
            {player.injuryStatus && (
              <div className="injury-status">{player.injuryStatus}</div>
            )}
            {player.stats?.[0] && (
              <div className="player-stats">
                <div>Points: {player.stats[0].appliedTotal?.toFixed(1) || '0.0'}</div>
                {player.stats[0].appliedAverage && (
                  <div>Avg: {player.stats[0].appliedAverage.toFixed(1)}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const formatMatchups = (data: any) => {
  const matchups = data.schedule || [];
  
  return (
    <div className="matchups-list">
      <h3>🏟️ Matchups</h3>
      <div className="matchups-grid">
        {matchups.map((matchup: any, index: number) => (
          <div key={index} className="matchup-card">
            <div className="matchup-header">Week {matchup.matchupPeriodId}</div>
            <div className="matchup-teams">
              <div className="team-score">
                <span className="team-name">Team {matchup.home?.teamId || 'N/A'}</span>
                <span className="score">{matchup.home?.totalPoints?.toFixed(1) || '0.0'}</span>
              </div>
              <div className="vs">vs</div>
              <div className="team-score">
                <span className="team-name">Team {matchup.away?.teamId || 'N/A'}</span>
                <span className="score">{matchup.away?.totalPoints?.toFixed(1) || '0.0'}</span>
              </div>
            </div>
            {matchup.winner && (
              <div className="winner">Winner: {matchup.winner === 'HOME' ? 'Home' : 'Away'}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const formatTransactions = (data: any) => {
  const transactions = data.transactions || [];
  
  return (
    <div className="transactions-list">
      <h3>💼 Recent Transactions</h3>
      <div className="transactions-grid">
        {transactions.slice(0, 20).map((transaction: any, index: number) => (
          <div key={index} className="transaction-card">
            <div className="transaction-type">
              {transaction.type === 'WAIVER' ? '📝 Waiver' : 
               transaction.type === 'FREEAGENT' ? '🆓 Free Agent' : 
               transaction.type === 'TRADE' ? '🔄 Trade' : 
               transaction.type}
            </div>
            <div className="transaction-details">
              Team {transaction.teamId} - {new Date(transaction.processDate).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ResponseFormatter: FC<ResponseFormatterProps> = ({ data, endpoint }) => {
  if (!data) {
    return <div className="no-data">No data to display</div>;
  }

  const renderFormattedData = () => {
    switch (endpoint) {
      case 'getLeague':
        return formatLeagueInfo(data);
      case 'getTeams':
        return formatTeams(data);
      case 'getRoster':
        return formatRoster(data);
      case 'getPlayers':
        return formatPlayers(data);
      case 'getMatchups':
        return formatMatchups(data);
      case 'getTransactions':
        return formatTransactions(data);
      default:
        return (
          <div className="raw-data">
            <h3>📊 Raw Data</h3>
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        );
    }
  };

  return (
    <div className="response-formatter">
      {renderFormattedData()}
      
      <details className="raw-data-toggle">
        <summary>🔍 View Raw JSON Data</summary>
        <pre className="raw-json">{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  );
};