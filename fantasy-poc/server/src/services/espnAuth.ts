import puppeteer, { Browser, Page } from 'puppeteer';
import NodeCache from 'node-cache';

interface ESPNCookies {
  espn_s2: string;
  swid: string;
}

interface CachedSession {
  cookies: ESPNCookies;
  leagueId: string;
  teamId?: string;
}

export class ESPNAuthService {
  private cache: NodeCache;
  
  constructor() {
    this.cache = new NodeCache({ stdTTL: 3600 }); // 1 hour TTL
  }

  async authenticate(username: string, password: string): Promise<ESPNCookies> {
    let browser: Browser | null = null;
    
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
      });
      
      const page = await browser.newPage();
      
      // Set viewport for consistency
      await page.setViewport({ width: 1280, height: 800 });
      
      // Increase default timeout
      page.setDefaultTimeout(30000);
      
      await page.goto('https://www.espn.com/login', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait a bit for page to fully load
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('Attempting DisneyID-based login...');

      // Method 1: Try to click the "Log In" button to trigger DisneyID login modal
      try {
        // Look for the Log In button that triggers the DisneyID modal
        const loginButtonSelectors = [
          'button[onclick*="launchLogin"]',
          '.login-button',
          '[data-testid="login-button"]',
          '.btn-login',
          '#login-button'
        ];

        let loginButton = null;
        for (const selector of loginButtonSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 2000 });
            loginButton = selector;
            console.log(`Found login button with selector: ${selector}`);
            break;
          } catch (e) {
            continue;
          }
        }

        if (!loginButton) {
          // Try to find login button by text content
          console.log('Searching for login button by text...');
          try {
            const foundLoginButton = await page.evaluate(() => {
              // @ts-ignore
              const buttons = Array.from(document.querySelectorAll('button'));
              const loginBtn = buttons.find((btn: any) => 
                btn.textContent?.toLowerCase().includes('log in') ||
                btn.textContent?.toLowerCase().includes('login') ||
                btn.textContent?.toLowerCase().includes('sign in')
              );
              if (loginBtn) {
                // @ts-ignore
                loginBtn.click();
                return true;
              }
              return false;
            });
            
            if (foundLoginButton) {
              loginButton = 'found-by-text';
            }
          } catch (e) {
            console.log('Text-based search failed');
          }
        }

        if (!loginButton) {
          // Try JavaScript approach to trigger DisneyID login
          console.log('Trying JavaScript DisneyID trigger...');
          await page.evaluate(() => {
            // @ts-ignore
            if (typeof window.did !== 'undefined') {
              // @ts-ignore
              window.did.launchLogin();
              // @ts-ignore
            } else if (typeof window.launchLoginReauth !== 'undefined') {
              // @ts-ignore
              window.launchLoginReauth();
            }
          });
        } else if (loginButton !== 'found-by-text') {
          await page.click(loginButton);
        }

        // Wait for DisneyID modal/popup to appear
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (e) {
        console.log('Failed to trigger DisneyID login:', e);
        throw new Error('Could not trigger DisneyID login modal. ESPN login page structure may have changed.');
      }

      // Now look for the DisneyID login form (might be in an iframe or modal)
      let frame = null;
      let loginMethod = 'unknown';

      // Method 1: Check for DisneyID iframe
      try {
        const frameSelectors = [
          'iframe[src*="disneyid"]',
          'iframe[src*="disney.com"]',
          'iframe[title*="Disney"]',
          'iframe[name*="login"]'
        ];

        for (const selector of frameSelectors) {
          try {
            const frameHandle = await page.$(selector);
            if (frameHandle) {
              frame = await frameHandle.contentFrame();
              if (frame) {
                loginMethod = 'disney-iframe';
                console.log(`Using DisneyID iframe method with selector: ${selector}`);
                break;
              }
            }
          } catch (e) {
            continue;
          }
        }
      } catch (e) {
        console.log('DisneyID iframe method failed');
      }

      // Method 2: Check if form appeared on main page
      if (!frame) {
        try {
          await page.waitForSelector('input[type="email"], input[placeholder*="email"], input[name="email"]', { timeout: 5000 });
          frame = page;
          loginMethod = 'main-page';
          console.log('Using main page login method');
        } catch (e) {
          console.log('Main page method failed');
        }
      }

      if (!frame) {
        throw new Error('Could not find DisneyID login form. ESPN may have changed their authentication system.');
      }

      // Find email input with multiple possible selectors (including DisneyID specific ones)
      const emailSelectors = [
        'input[type="email"]',
        'input[placeholder*="email"]',
        'input[placeholder*="Email"]',
        'input[name="email"]',
        'input[name="username"]',
        '#email',
        '#username',
        '[data-testid="email"]',
        '[data-testid="username"]',
        '.input-text[name*="email"]',
        '.email-input',
        '#did-username',
        '.did-input-username'
      ];

      let emailInput = null;
      for (const selector of emailSelectors) {
        try {
          await frame.waitForSelector(selector, { timeout: 2000 });
          emailInput = selector;
          break;
        } catch (e) {
          continue;
        }
      }

      if (!emailInput) {
        throw new Error('Email input field not found');
      }

      // Find password input
      const passwordSelectors = [
        'input[type="password"]',
        'input[name="password"]',
        '#password',
        '[data-testid="password"]',
        '.password-input',
        '#did-password',
        '.did-input-password'
      ];

      let passwordInput = null;
      for (const selector of passwordSelectors) {
        try {
          await frame.waitForSelector(selector, { timeout: 2000 });
          passwordInput = selector;
          break;
        } catch (e) {
          continue;
        }
      }

      if (!passwordInput) {
        throw new Error('Password input field not found');
      }

      // Fill in credentials
      console.log('Filling email field...');
      await frame.type(emailInput, username, { delay: 50 });
      console.log('Filling password field...');
      await frame.type(passwordInput, password, { delay: 50 });
      console.log('Credentials filled successfully');

      // Find and click submit button
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button[data-testid="submit"]',
        '.btn-submit',
        '#submit',
        '.did-submit-button',
        '#did-submit',
        '.login-submit'
      ];

      let submitButton = null;
      for (const selector of submitSelectors) {
        try {
          await frame.waitForSelector(selector, { timeout: 2000 });
          submitButton = selector;
          break;
        } catch (e) {
          continue;
        }
      }

      if (!submitButton) {
        // Try to find submit button by text content
        console.log('Searching for submit button by text...');
        try {
          const foundSubmitButton = await frame.evaluate(() => {
            // @ts-ignore
            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
            const submitBtn = buttons.find((btn: any) => 
              btn.textContent?.toLowerCase().includes('sign in') ||
              btn.textContent?.toLowerCase().includes('log in') ||
              btn.textContent?.toLowerCase().includes('continue') ||
              btn.textContent?.toLowerCase().includes('submit') ||
              btn.value?.toLowerCase().includes('sign in') ||
              btn.value?.toLowerCase().includes('log in')
            );
            if (submitBtn) {
              // @ts-ignore
              submitBtn.click();
              return true;
            }
            return false;
          });
          
          if (foundSubmitButton) {
            submitButton = 'found-by-text';
          }
        } catch (e) {
          console.log('Text-based submit search failed');
        }
      }

      if (!submitButton) {
        throw new Error('Submit button not found');
      }

      if (submitButton !== 'found-by-text') {
        console.log('Clicking submit button:', submitButton);
        await frame.click(submitButton);
      } else {
        console.log('Submit button was clicked via text search');
      }
      
      console.log('Login form submitted');
      
      // Wait for login to complete
      console.log('Waiting for navigation after login submission...');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
        console.log('Navigation timeout - checking for cookies anyway');
      });
      
      // Wait a bit longer for cookies to be set
      console.log('Waiting additional time for cookies to be set...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check all cookies and log them
      const cookies = await page.cookies();
      console.log('All cookies found:', cookies.map(c => ({ name: c.name, domain: c.domain, value: c.value.substring(0, 20) + '...' })));
      
      const espn_s2 = cookies.find(c => c.name === 'espn_s2')?.value;
      const swid = cookies.find(c => c.name === 'SWID')?.value;
      
      console.log('ESPN cookies status:', {
        espn_s2: espn_s2 ? 'Found (' + espn_s2.length + ' chars)' : 'NOT FOUND',
        swid: swid ? 'Found (' + swid + ')' : 'NOT FOUND'
      });
      
      if (!espn_s2 || !swid) {
        // Try visiting ESPN fantasy page to trigger cookie setting
        console.log('Cookies not found, trying to visit ESPN fantasy page...');
        await page.goto('https://fantasy.espn.com/', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {
          console.log('Failed to load fantasy page');
        });
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const newCookies = await page.cookies();
        const newEspn_s2 = newCookies.find(c => c.name === 'espn_s2')?.value;
        const newSwid = newCookies.find(c => c.name === 'SWID')?.value;
        
        console.log('After fantasy page visit:', {
          espn_s2: newEspn_s2 ? 'Found (' + newEspn_s2.length + ' chars)' : 'NOT FOUND',
          swid: newSwid ? 'Found (' + newSwid + ')' : 'NOT FOUND'
        });
        
        if (!newEspn_s2 || !newSwid) {
          // Take a screenshot to see what's on the page
          try {
            await page.screenshot({ path: '/tmp/espn-login-debug.png', fullPage: true });
            console.log('Debug screenshot saved to /tmp/espn-login-debug.png');
          } catch (e) {
            console.log('Could not take screenshot:', e);
          }
          
          // Check current page URL and title for debugging
          const currentUrl = page.url();
          const pageTitle = await page.title().catch(() => 'Unknown');
          console.log('Current page after login attempt:', { url: currentUrl, title: pageTitle });
          
          throw new Error('Failed to retrieve authentication cookies. Login may have failed or requires additional verification (captcha/2FA).');
        }
        
        return { espn_s2: newEspn_s2, swid: newSwid };
      }
      
      const sessionData: ESPNCookies = { espn_s2, swid };
      
      this.cache.set(username, sessionData);
      
      return sessionData;
      
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  getSession(username: string): ESPNCookies | undefined {
    return this.cache.get<ESPNCookies>(username);
  }

  clearSession(username: string): void {
    this.cache.del(username);
  }
}

export const espnAuth = new ESPNAuthService();