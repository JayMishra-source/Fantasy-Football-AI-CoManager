import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginForm } from './components/LoginForm';
import { TeamRoster } from './components/TeamRoster';
import { ApiTester } from './components/ApiTester';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false
    }
  }
});

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [leagueId, setLeagueId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [activeTab, setActiveTab] = useState<'roster' | 'tester'>('roster');

  const handleLoginSuccess = (league: string, team?: string) => {
    setIsAuthenticated(true);
    setLeagueId(league);
    setTeamId(team || '');
  };

  if (!isAuthenticated) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="app">
          <header className="app-header">
            <h1>ESPN Fantasy Football POC</h1>
          </header>
          <main className="app-main">
            <LoginForm onSuccess={handleLoginSuccess} />
          </main>
        </div>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app">
        <header className="app-header">
          <h1>ESPN Fantasy Football POC</h1>
          <div className="header-info">
            <span>League: {leagueId}</span>
            {teamId && <span>Team: {teamId}</span>}
          </div>
        </header>

        <nav className="app-nav">
          <button 
            className={activeTab === 'roster' ? 'active' : ''}
            onClick={() => setActiveTab('roster')}
          >
            Team Roster
          </button>
          <button 
            className={activeTab === 'tester' ? 'active' : ''}
            onClick={() => setActiveTab('tester')}
          >
            API Tester
          </button>
        </nav>

        <main className="app-main">
          {activeTab === 'roster' && teamId ? (
            <TeamRoster leagueId={leagueId} teamId={teamId} />
          ) : activeTab === 'tester' ? (
            <ApiTester leagueId={leagueId} />
          ) : (
            <div>Please provide a Team ID to view roster</div>
          )}
        </main>
      </div>
    </QueryClientProvider>
  );
}

export default App
