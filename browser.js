

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

(async () => {
  console.log("Launching Browser on GitHub Actions Virtual Screen with Proxy...");

  // Hardcoded Proxy Details
  const proxyIpPort = '31.59.20.176:6754';
  const proxyUser = 'cjasfidu';
  const proxyPass = 'qhnyvm0qpf6p';
  
  const browser = await puppeteer.launch({
    headless: false, // False rakha hai taake Xvfb par render ho
    defaultViewport: { width: 1280, height: 720 },
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1280,720',
      '--autoplay-policy=no-user-gesture-required', // Auto-play allow karne ke liye
      `--proxy-server=http://${proxyIpPort}` // Proxy IP aur Port yahan attach kiya
    ]
  });

  const page = await browser.newPage();
  
  // Proxy Authentication (Username aur Password)
  await page.authenticate({
      username: proxyUser,
      password: proxyPass
  });
  console.log("Proxy credentials applied successfully.");

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

  try {
    console.log("Navigating to Homepage using Proxy...");
    await page.goto('https://dlstreams.com/', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 4000));

    const cricketSelector = 'a[href="/index.php?cat=Cricket"]';
    await page.waitForSelector(cricketSelector, { visible: true, timeout: 10000 });
    const cricketBtn = await page.$(cricketSelector);
    if (cricketBtn) {
        const box = await cricketBtn.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
        await new Promise(r => setTimeout(r, 1000)); 
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }), 
            page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
        ]);
    }

    console.log("Scrolling and clicking IPL match...");
    await page.waitForSelector('div.schedule__event', { visible: true, timeout: 15000 });
    await page.mouse.wheel({ deltaY: 600 });
    await new Promise(r => setTimeout(r, 2000));

    const targetMatch = await page.evaluateHandle(() => {
        const events = Array.from(document.querySelectorAll('div.schedule__event'));
        return events.find(el => el.textContent.includes('Indian Premier League'));
    });

    const box = await targetMatch.boundingBox();
    if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
        await new Promise(r => setTimeout(r, 1000)); 
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        
        console.log("Clicking 'Willow 2 Cricket'...");
        const willowSelector = 'a[data-ch="willow 2 cricket"]'; 
        await page.waitForSelector(willowSelector, { visible: true, timeout: 10000 });
        const willowBtn = await page.$(willowSelector);
        
        if (willowBtn) {
            const wBox = await willowBtn.boundingBox();
            await page.mouse.move(wBox.x + wBox.width / 2, wBox.y + wBox.height / 2, { steps: 15 });
            await new Promise(r => setTimeout(r, 1000)); 

            const newPagePromise = new Promise(x => browser.once('targetcreated', target => x(target.page())));
            await page.mouse.click(wBox.x + wBox.width / 2, wBox.y + wBox.height / 2);
            
            const streamPage = await newPagePromise;
            if (streamPage) {
                console.log("Shifted to Stream Tab! Injecting Anti-Popup...");
                await streamPage.bringToFront();
                await streamPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
                
                await streamPage.evaluateOnNewDocument(() => { window.open = () => null; });

                console.log("Waiting 12 seconds for auto-refreshes...");
                await new Promise(r => setTimeout(r, 12000)); 
                
                console.log("Destroying Ad-Trap & clicking player...");
                await streamPage.evaluate(() => {
                    const trap = document.querySelector('div#dontfoid');
                    if (trap) trap.remove();
                    window.scrollBy({ top: 400, behavior: 'smooth' });
                });
                
                await new Promise(r => setTimeout(r, 2000));
                
                await streamPage.mouse.move(640, 360, { steps: 20 });
                await streamPage.mouse.click(640, 360);
                
                console.log("SUCCESS! Video should be playing. Recording next 30 seconds...");
                
                // 30 Seconds wait karega taake FFmpeg aram se video record kar sake
                await new Promise(r => setTimeout(r, 30000));
            }
        }
    } else {
        console.log("IPL Match nahi mila.");
    }

  } catch (error) {
    console.log("Execution stopped or error occurred:", error.message);
  }

  console.log("Closing browser...");
  await browser.close();
})();


























// =====================================================




// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// puppeteer.use(StealthPlugin());

// (async () => {
//   console.log("Launching Browser on GitHub Actions Virtual Screen...");
  
//   const browser = await puppeteer.launch({
//     headless: false, // False rakha hai taake Xvfb par render ho
//     defaultViewport: { width: 1280, height: 720 },
//     args: [
//       '--no-sandbox', 
//       '--disable-setuid-sandbox',
//       '--disable-web-security',
//       '--disable-features=IsolateOrigins,site-per-process',
//       '--window-size=1280,720',
//       '--autoplay-policy=no-user-gesture-required' // Auto-play allow karne ke liye
//     ]
//   });

//   const page = await browser.newPage();
//   await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

//   try {
//     console.log("Navigating to Homepage...");
//     await page.goto('https://dlstreams.com/', { waitUntil: 'networkidle2', timeout: 60000 });
//     await new Promise(r => setTimeout(r, 4000));

//     const cricketSelector = 'a[href="/index.php?cat=Cricket"]';
//     await page.waitForSelector(cricketSelector, { visible: true, timeout: 10000 });
//     const cricketBtn = await page.$(cricketSelector);
//     if (cricketBtn) {
//         const box = await cricketBtn.boundingBox();
//         await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
//         await new Promise(r => setTimeout(r, 1000)); 
//         await Promise.all([
//             page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }), 
//             page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
//         ]);
//     }

//     console.log("Scrolling and clicking IPL match...");
//     await page.waitForSelector('div.schedule__event', { visible: true, timeout: 15000 });
//     await page.mouse.wheel({ deltaY: 600 });
//     await new Promise(r => setTimeout(r, 2000));

//     const targetMatch = await page.evaluateHandle(() => {
//         const events = Array.from(document.querySelectorAll('div.schedule__event'));
//         return events.find(el => el.textContent.includes('Indian Premier League'));
//     });

//     const box = await targetMatch.boundingBox();
//     if (box) {
//         await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
//         await new Promise(r => setTimeout(r, 1000)); 
//         await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        
//         console.log("Clicking 'Willow 2 Cricket'...");
//         const willowSelector = 'a[data-ch="willow 2 cricket"]'; 
//         await page.waitForSelector(willowSelector, { visible: true, timeout: 10000 });
//         const willowBtn = await page.$(willowSelector);
        
//         if (willowBtn) {
//             const wBox = await willowBtn.boundingBox();
//             await page.mouse.move(wBox.x + wBox.width / 2, wBox.y + wBox.height / 2, { steps: 15 });
//             await new Promise(r => setTimeout(r, 1000)); 

//             const newPagePromise = new Promise(x => browser.once('targetcreated', target => x(target.page())));
//             await page.mouse.click(wBox.x + wBox.width / 2, wBox.y + wBox.height / 2);
            
//             const streamPage = await newPagePromise;
//             if (streamPage) {
//                 console.log("Shifted to Stream Tab! Injecting Anti-Popup...");
//                 await streamPage.bringToFront();
//                 await streamPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
                
//                 await streamPage.evaluateOnNewDocument(() => { window.open = () => null; });

//                 console.log("Waiting 12 seconds for auto-refreshes...");
//                 await new Promise(r => setTimeout(r, 12000)); 
                
//                 console.log("Destroying Ad-Trap & clicking player...");
//                 await streamPage.evaluate(() => {
//                     const trap = document.querySelector('div#dontfoid');
//                     if (trap) trap.remove();
//                     window.scrollBy({ top: 400, behavior: 'smooth' });
//                 });
                
//                 await new Promise(r => setTimeout(r, 2000));
                
//                 await streamPage.mouse.move(640, 360, { steps: 20 });
//                 await streamPage.mouse.click(640, 360);
                
//                 console.log("SUCCESS! Video should be playing. Recording next 30 seconds...");
                
//                 // 30 Seconds wait karega taake FFmpeg aram se video record kar sake
//                 await new Promise(r => setTimeout(r, 30000));
//             }
//         }
//     } else {
//         console.log("IPL Match nahi mila.");
//     }

//   } catch (error) {
//     console.log("Execution stopped or error occurred:", error.message);
//   }

//   console.log("Closing browser...");
//   await browser.close();
// })();
