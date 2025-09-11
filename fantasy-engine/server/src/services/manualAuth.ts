import NodeCache from 'node-cache';

interface ESPNCookies {
  espn_s2: string;
  swid: string;
}

export class ManualAuthService {
  private cache: NodeCache;
  
  constructor() {
    this.cache = new NodeCache({ stdTTL: 7200 }); // 2 hour TTL for manual cookies
  }

  /**
   * Store manually provided cookies
   * Users can get these from browser DevTools after logging into ESPN
   */
  storeCookies(username: string, espn_s2: string, swid: string): ESPNCookies {
    const cookies: ESPNCookies = { espn_s2, swid };
    this.cache.set(username, cookies);
    return cookies;
  }

  getCookies(username: string): ESPNCookies | undefined {
    return this.cache.get<ESPNCookies>(username);
  }

  clearCookies(username: string): void {
    this.cache.del(username);
  }

  /**
   * Instructions for users to get cookies manually
   */
  getInstructions(): string {
    return `
To get your ESPN cookies manually:
1. Open ESPN Fantasy Football in your browser
2. Log in to your account
3. Open Developer Tools (F12 or right-click > Inspect)
4. Go to the Application/Storage tab
5. Find Cookies > fantasy.espn.com
6. Look for:
   - espn_s2: Copy the entire value
   - SWID: Copy the value (including curly braces)
7. Use these values in the manual authentication endpoint
    `.trim();
  }
}

export const manualAuth = new ManualAuthService();