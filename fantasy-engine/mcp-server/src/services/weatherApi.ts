import axios from 'axios';

interface WeatherData {
  location: string;
  temperature: number;
  windSpeed: number;
  windDirection: string;
  precipitation: number;
  humidity: number;
  conditions: string;
  impact: 'high' | 'medium' | 'low';
  fantasyImpact: string;
}

interface GameWeather {
  gameId: string;
  teams: string[];
  stadium: string;
  weather: WeatherData;
}

export class WeatherApi {
  private readonly apiKey: string | undefined;
  private readonly baseUrl = 'http://api.openweathermap.org/data/2.5';

  constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY;
  }

  async getGameWeather(stadium: string, gameDate: Date): Promise<WeatherData | null> {
    if (!this.apiKey) {
      console.log('⚠️ OpenWeather API key not configured - weather data unavailable');
      return null;
    }

    try {
      // Map stadium names to cities (simplified mapping)
      const stadiumToCity = this.getStadiumCityMap();
      const city = stadiumToCity[stadium.toLowerCase()] || stadium;

      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          q: city,
          appid: this.apiKey,
          units: 'imperial'
        }
      });

      const weather = response.data;
      
      return {
        location: city,
        temperature: Math.round(weather.main.temp),
        windSpeed: Math.round(weather.wind?.speed * 2.237), // Convert m/s to mph
        windDirection: this.getWindDirection(weather.wind?.deg || 0),
        precipitation: weather.rain?.['1h'] || weather.snow?.['1h'] || 0,
        humidity: weather.main.humidity,
        conditions: weather.weather[0].main,
        impact: this.assessFantasyImpact(weather),
        fantasyImpact: this.getFantasyImpactDescription(weather)
      };
    } catch (error) {
      console.log(`⚠️ Failed to fetch weather for ${stadium}: ${error}`);
      return null;
    }
  }

  private getStadiumCityMap(): { [key: string]: string } {
    return {
      'lambeau field': 'Green Bay,WI',
      'soldier field': 'Chicago,IL',
      'ford field': 'Detroit,MI',
      'u.s. bank stadium': 'Minneapolis,MN',
      'gillette stadium': 'Foxborough,MA',
      'metlife stadium': 'East Rutherford,NJ',
      'buffalo bills stadium': 'Buffalo,NY',
      'hard rock stadium': 'Miami,FL',
      'm&t bank stadium': 'Baltimore,MD',
      'heinz field': 'Pittsburgh,PA',
      'paul brown stadium': 'Cincinnati,OH',
      'firstenergy stadium': 'Cleveland,OH',
      'lucas oil stadium': 'Indianapolis,IN',
      'nissan stadium': 'Nashville,TN',
      'nrg stadium': 'Houston,TX',
      'tiaa bank field': 'Jacksonville,FL',
      'empower field': 'Denver,CO',
      'arrowhead stadium': 'Kansas City,MO',
      'allegiant stadium': 'Las Vegas,NV',
      'sofi stadium': 'Los Angeles,CA',
      'levi\'s stadium': 'Santa Clara,CA',
      'lumen field': 'Seattle,WA',
      'at&t stadium': 'Dallas,TX',
      'fedexfield': 'Landover,MD',
      'lincoln financial field': 'Philadelphia,PA',
      'mercedes-benz stadium': 'Atlanta,GA',
      'bank of america stadium': 'Charlotte,NC',
      'caesars superdome': 'New Orleans,LA',
      'raymond james stadium': 'Tampa,FL',
      'state farm stadium': 'Glendale,AZ'
    };
  }

  private getWindDirection(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }

  private assessFantasyImpact(weather: any): 'high' | 'medium' | 'low' {
    const temp = weather.main.temp;
    const windSpeed = weather.wind?.speed * 2.237 || 0; // Convert to mph
    const precipitation = weather.rain?.['1h'] || weather.snow?.['1h'] || 0;

    // High impact conditions
    if (temp < 20 || temp > 100 || windSpeed > 20 || precipitation > 0.1) {
      return 'high';
    }
    
    // Medium impact conditions  
    if (temp < 32 || temp > 85 || windSpeed > 10) {
      return 'medium';
    }

    return 'low';
  }

  private getFantasyImpactDescription(weather: any): string {
    const temp = weather.main.temp;
    const windSpeed = weather.wind?.speed * 2.237 || 0;
    const precipitation = weather.rain?.['1h'] || weather.snow?.['1h'] || 0;
    const conditions = weather.weather[0].main.toLowerCase();

    const impacts = [];

    if (temp < 20) {
      impacts.push('Extremely cold - reduced passing efficiency, favor rushing attacks');
    } else if (temp < 32) {
      impacts.push('Cold conditions - slight reduction in passing game');
    } else if (temp > 90) {
      impacts.push('Hot conditions - potential for player fatigue in late game');
    }

    if (windSpeed > 15) {
      impacts.push('High winds - significant impact on passing game and kicking');
    } else if (windSpeed > 10) {
      impacts.push('Moderate winds - slight impact on long passes and field goals');
    }

    if (precipitation > 0.1) {
      impacts.push('Precipitation expected - favor ground game, reduce WR/TE targets');
    }

    if (conditions.includes('snow')) {
      impacts.push('Snow conditions - major boost to running backs, avoid kickers');
    }

    return impacts.length > 0 
      ? impacts.join('. ')
      : 'Ideal weather conditions - minimal fantasy impact';
  }
}

export const weatherApi = new WeatherApi();