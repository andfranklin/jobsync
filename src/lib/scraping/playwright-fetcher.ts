import "server-only";

const PLAYWRIGHT_TIMEOUT_MS = 30000;
const NAVIGATION_WAIT_MS = 3000;

/**
 * Fetch a page's rendered HTML using a headless Chromium browser.
 * Handles JS-rendered pages and some bot protections that block plain fetch().
 * Requires Chromium to be installed: `npx playwright install chromium`
 */
export async function fetchWithPlaywright(url: string): Promise<string> {
  // Dynamic import so playwright-core isn't loaded unless this function is called
  const { chromium } = await import("playwright-core");

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: PLAYWRIGHT_TIMEOUT_MS,
    });

    // Wait for JS content to render
    await page.waitForTimeout(NAVIGATION_WAIT_MS);

    const html = await page.content();
    return html;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
