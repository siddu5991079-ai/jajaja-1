const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false, 
    defaultViewport: { width: 1280, height: 720 },
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--start-fullscreen',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();
  
  // Yahan apna Target URL dalein
  const targetUrl = 'https://dlstreams.com/stream/stream-598.php'; 
  
  console.log(`Navigating to: ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  // Agar video auto-play nahi hoti, toh hum yahan click emulate kar sakte hain
  // await page.mouse.click(640, 360); 

  console.log("Browser is active and page is loaded. Recording will start now...");
  
  // Browser ko 70 seconds tak khula rakhein (60s recording + buffer)
  await new Promise(resolve => setTimeout(resolve, 70000)); 
  
  await browser.close();
})();
