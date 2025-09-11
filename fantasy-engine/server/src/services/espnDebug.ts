import puppeteer, { Browser, Page } from 'puppeteer';

export class ESPNDebugService {
  async debugLoginPage(): Promise<string> {
    let browser: Browser | null = null;
    
    try {
      browser = await puppeteer.launch({
        headless: false, // Run in visible mode for debugging
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      
      console.log('Navigating to ESPN login page...');
      await page.goto('https://www.espn.com/login', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Take a screenshot
      await page.screenshot({ path: 'espn-login-debug.png', fullPage: true });
      
      // Get page HTML
      const html = await page.content();
      
      // Look for common login elements
      const elements = await page.evaluate(() => {
        const selectors = [
          'iframe',
          'input[type="email"]',
          'input[type="password"]', 
          'input[placeholder*="email"]',
          'button[type="submit"]',
          '.login',
          '#login',
          '[data-testid*="login"]',
          '[data-testid*="email"]',
          '[data-testid*="password"]'
        ];
        
        const found: any[] = [];
        
        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          const elementInfo = Array.from(elements).map((el: any) => ({
            tag: el.tagName,
            attributes: Object.fromEntries(
              Array.from(el.attributes || []).map((attr: any) => [attr.name, attr.value])
            )
          }));
          
          if (elements.length > 0) {
            found.push({
              selector,
              count: elements.length,
              elements: elementInfo
            });
          }
        });
        
        return found;
      });
      
      return JSON.stringify({
        url: page.url(),
        title: await page.title(),
        elements,
        htmlLength: html.length
      }, null, 2);
      
    } catch (error) {
      console.error('Debug error:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

export const espnDebug = new ESPNDebugService();