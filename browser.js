const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Activate Stealth Mode
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: false, 
    defaultViewport: { width: 1280, height: 720 },
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--start-fullscreen',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  const page = await browser.newPage();
  
  // Real Windows 10 Chrome User-Agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

  // Anti-hotlink Bypass Headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://dlstreams.com/',
    'Origin': 'https://dlstreams.com'
  });
  
  // Target URL (Stream 598)
  const targetUrl = 'https://dlstreams.com/stream/stream-598.php'; 
  
  console.log(`Navigating to: ${targetUrl} in Stealth Mode...`);
  
  // Long timeout for Cloudflare/bot check delays
  await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 90000 });

  console.log("Page loaded. Attempting to click play...");
  
  // Click in the center of the screen to start video if it's paused
  await page.mouse.click(640, 360);
  
  console.log("Keep browser open for 75 seconds for FFmpeg recording...");
  
  // Wait 75 seconds so FFmpeg finishes its 60-second task properly
  await new Promise(resolve => setTimeout(resolve, 75000)); 
  
  await browser.close();
})();
