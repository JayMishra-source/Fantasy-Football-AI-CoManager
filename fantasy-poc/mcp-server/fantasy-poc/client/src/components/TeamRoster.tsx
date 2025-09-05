import type { FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { espnApi } from '../services/api';
import type { RosterEntry } from '../types/espn';

interface TeamRosterProps {
  leagueId: string;
  teamId: string;
}

const POSITION_MAP: { [key: number]: string } = {
  0: 'QB',
  2: 'RB',
  4: 'WR',
  6: 'TE',
  16: 'D/ST',
  17: 'K',
  20: 'BENCH',
  21: 'IR',
  23: 'FLEX'
};

const PlayerCard: FC<{ entry: RosterEntry }> = ({ entry }) => {
  const player = entry.playerPoolEntry?.player;
  if (!player) return null;

  const position = POSITION_MAP[entry.lineupSlotId] || 'UNKNOWN';
  
  return (
    <div className="player-card">
      <div className="player-info">
        <h4>{player.fullName}</h4>
        <p className="position">{position}</p>
        {player.injuryStatus && (
          <span className="injury-badge">{player.injuryStatus}</span>
        )}
      </div>
      <div className="player-stats">
        {player.stats?.[0]?.appliedTotal && (
          <p className="points">{player.stats[0].appliedTotal.toFixed(1)} pts</p>
        )}
      </div>
    </div>
  );
};

export const TeamRoster: FC<TeamRosterProps> = ({ leagueId, teamId }) => {
  const { data: roster, isLoading, error } = useQuery({
    queryKey: ['roster', leagueId, teamId],
    queryFn: () => espnApi.getRoster(leagueId, teamId),
    retry: 1
  });

  if (isLoading) return <div className="loading">Loading roster...</div>;
  if (error) return <div className="error">Error loading roster: {(error as Error).message}</div>;
  if (!roster || !roster.entries) return <div>No roster data available</div>;

  const starters = roster.entries.filter(e => e.lineupSlotId < 20);
  const bench = roster.entries.filter(e => e.lineupSlotId === 20);
  const ir = roster.entries.filter(e => e.lineupSlotId === 21);

  return (
    <div className="team-roster">
      <h2>Team Roster</h2>
      
      <div className="roster-section">
        <h3>Starters</h3>
        <div className="player-list">
          {starters.map((entry, idx) => (
            <PlayerCard key={idx} entry={entry} />
          ))}
        </div>
      </div>

      {bench.length > 0 && (
        <div className="roster-section">
          <h3>Bench</h3>
          <div className="player-list">
            {bench.map((entry, idx) => (
              <PlayerCard key={idx} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {ir.length > 0 && (
        <div className="roster-section">
          <h3>Injured Reserve</h3>
          <div className="player-list">
            {ir.map((entry, idx) => (
              <PlayerCard key={idx} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};