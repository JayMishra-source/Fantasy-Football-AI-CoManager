import { weatherApi } from '../services/weatherApi.js';
import { newsApi } from '../services/newsApi.js';
import { espnApi } from '../services/espnApi.js';
import { Player } from '../types/espn.js';

export interface GameContextAnalysis {
  week: number;
  games: GameContext[];
  injuryReports: any[];
  overallRecommendations: string[];
  dataSourcesUsed: {
    weather: boolean;
    news: boolean;
    injuries: boolean;
  };
}

export interface GameContext {
  gameId: string;
  teams: string[];
  stadium: string;
  weather: any | null;
  playerNews: any[];
  fantasyImpact: {
    weatherImpact: string;
    newsImpact: string;
    overallRating: 'high' | 'medium' | 'low';
    recommendations: string[];
  };
}

export async function getGameContextTool(args: {
  leagueId: string;
  teamId?: string;
  week?: number;
  includeWeather?: boolean;
  includeNews?: boolean;
}): Promise<GameContextAnalysis> {
  const { leagueId, teamId, week = 1, includeWeather = true, includeNews = true } = args;

  if (!leagueId) {
    throw new Error('League ID is required');
  }

  try {
    console.log(`🔍 Analyzing game context for week ${week}...`);

    // Get roster if teamId provided to focus on relevant players
    let teamPlayers: Player[] = [];
    if (teamId) {
      const roster = await espnApi.getTeamRoster(leagueId, teamId);
      teamPlayers = [...roster.starters, ...roster.bench];
    }

    // Track data sources used
    const dataSourcesUsed = {
      weather: false,
      news: false,
      injuries: false
    };

    // Get injury reports if news is enabled
    let injuryReports: any[] = [];
    if (includeNews) {
      try {
        console.log('📰 Fetching injury reports...');
        injuryReports = await newsApi.getInjuryReports();
        dataSourcesUsed.injuries = injuryReports.length > 0;
        console.log(`✅ Found ${injuryReports.length} injury-related news articles`);
      } catch (error) {
        console.log(`⚠️ Failed to fetch injury reports: ${error}`);
      }
    }

    // Mock game data for now (would need NFL schedule API)
    const mockGames = [
      { gameId: '1', teams: ['Team A', 'Team B'], stadium: 'Lambeau Field' },
      { gameId: '2', teams: ['Team C', 'Team D'], stadium: 'Soldier Field' },
      { gameId: '3', teams: ['Team E', 'Team F'], stadium: 'Ford Field' }
    ];

    const games: GameContext[] = [];

    for (const game of mockGames) {
      console.log(`🏟️ Analyzing context for ${game.teams[0]} vs ${game.teams[1]}...`);

      let weather = null;
      if (includeWeather) {
        try {
          weather = await weatherApi.getGameWeather(game.stadium, new Date());
          if (weather) {
            dataSourcesUsed.weather = true;
            console.log(`🌤️ Weather data: ${weather.temperature}°F, ${weather.conditions}`);
          }
        } catch (error) {
          console.log(`⚠️ Failed to get weather for ${game.stadium}: ${error}`);
        }
      }

      let playerNews: any[] = [];
      if (includeNews && teamPlayers.length > 0) {
        // Get news for key players
        const keyPlayers = teamPlayers.slice(0, 5); // Focus on top 5 players
        
        for (const player of keyPlayers) {
          try {
            const news = await newsApi.getPlayerNews(player.fullName);
            if (news && news.articles.length > 0) {
              playerNews.push(news);
              dataSourcesUsed.news = true;
            }
          } catch (error) {
            console.log(`⚠️ Failed to get news for ${player.fullName}: ${error}`);
          }
        }
      }

      // Generate fantasy impact analysis
      const fantasyImpact = generateFantasyImpact(weather, playerNews, injuryReports);

      games.push({
        gameId: game.gameId,
        teams: game.teams,
        stadium: game.stadium,
        weather,
        playerNews,
        fantasyImpact
      });
    }

    // Generate overall recommendations
    const overallRecommendations = generateOverallRecommendations(games, injuryReports);

    return {
      week,
      games,
      injuryReports,
      overallRecommendations,
      dataSourcesUsed
    };

  } catch (error: any) {
    throw new Error(`Failed to get game context: ${error.message}`);
  }
}

export async function getPlayerNewsTool(args: {
  playerName: string;
  team?: string;
}): Promise<any> {
  const { playerName, team } = args;

  if (!playerName) {
    throw new Error('Player name is required');
  }

  try {
    console.log(`📰 Fetching news for ${playerName}...`);
    const news = await newsApi.getPlayerNews(playerName, team);
    
    if (!news) {
      return {
        playerName,
        message: 'No recent news found',
        articles: [],
        fantasyImpact: 'No impact based on available news'
      };
    }

    return news;
  } catch (error: any) {
    throw new Error(`Failed to get player news: ${error.message}`);
  }
}

function generateFantasyImpact(weather: any, playerNews: any[], injuryReports: any[]): GameContext['fantasyImpact'] {
  const recommendations: string[] = [];
  let overallRating: 'high' | 'medium' | 'low' = 'low';

  // Weather impact
  let weatherImpact = 'No weather data available';
  if (weather) {
    weatherImpact = weather.fantasyImpact;
    if (weather.impact === 'high') {
      overallRating = 'high';
      recommendations.push(`Weather Alert: ${weather.fantasyImpact}`);
    } else if (weather.impact === 'medium' && overallRating === 'low') {
      overallRating = 'medium';
    }
  }

  // News impact
  let newsImpact = 'No player news available';
  if (playerNews.length > 0) {
    const highImpactNews = playerNews.filter(news => 
      news.articles.some((article: any) => article.impact === 'high')
    );
    
    if (highImpactNews.length > 0) {
      overallRating = 'high';
      newsImpact = `${highImpactNews.length} players with high-impact news`;
      recommendations.push(`Player Alert: Monitor ${highImpactNews.map(n => n.playerName).join(', ')}`);
    } else {
      newsImpact = `${playerNews.length} players with recent news updates`;
    }
  }

  // Injury impact
  if (injuryReports.length > 0) {
    const recentInjuries = injuryReports.filter(report => 
      report.impact === 'high' || report.impact === 'medium'
    );
    if (recentInjuries.length > 0) {
      overallRating = 'high';
      recommendations.push(`Injury Alert: ${recentInjuries.length} significant injury reports this week`);
    }
  }

  return {
    weatherImpact,
    newsImpact,
    overallRating,
    recommendations
  };
}

function generateOverallRecommendations(games: GameContext[], injuryReports: any[]): string[] {
  const recommendations: string[] = [];

  // Weather-based recommendations
  const weatherImpactGames = games.filter(g => g.weather?.impact === 'high');
  if (weatherImpactGames.length > 0) {
    recommendations.push(`Weather Impact: ${weatherImpactGames.length} games with significant weather concerns`);
  }

  // News-based recommendations
  const newsImpactGames = games.filter(g => g.playerNews.length > 0);
  if (newsImpactGames.length > 0) {
    recommendations.push(`Player News: Monitor ${newsImpactGames.length} games with player updates`);
  }

  // Injury-based recommendations
  if (injuryReports.length > 0) {
    const highImpactInjuries = injuryReports.filter(report => report.impact === 'high');
    if (highImpactInjuries.length > 0) {
      recommendations.push(`Critical Injuries: ${highImpactInjuries.length} major injury reports affecting lineups`);
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('No major concerns identified for this week');
  }

  return recommendations;
}