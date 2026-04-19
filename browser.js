const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { spawn } = require('child_process');

puppeteer.use(StealthPlugin());

(async () => {
  console.log("Launching Browser for ZERO-LAG Live Broadcast to ok.ru...");

  const proxyIpPort = '31.59.20.176:6754';
  const proxyUser = 'cjasfidu';
  const proxyPass = 'qhnyvm0qpf6p';
  
  // Aapka ok.ru ka URL aur Stream Key
  const rtmpUrl = 'rtmp://vsu.okcdn.ru/input/14601603391083_14040893622891_puxzrwjniu';

  // FFmpeg process with ok.ru specific flags
  const ffmpeg = spawn('ffmpeg', [
      '-re', // Read input at native frame rate
      '-i', 'pipe:0', 
      '-c:v', 'libx264', 
      '-preset', 'veryfast', // 'ultrafast' kabhi ok.ru reject kar deta hai
      '-crf', '28', 
      '-g', '60', // Keyframe interval (ok.ru requires this for live streams)
      '-c:a', 'aac', 
      '-b:a', '128k', 
      '-f', 'flv', 
      rtmpUrl 
  ]);

  // UPDATE: Ab FFmpeg ke errors terminal mein show honge!
  ffmpeg.stderr.on('data', (data) => {
      console.log(`[FFMPEG LOG] ${data.toString().trim()}`); 
  });

  const browser = await puppeteer.launch({
    headless: false, 
    defaultViewport: { width: 1280, height: 720 },
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-web-security', 
      '--disable-features=IsolateOrigins,site-per-process',
      '--enable-experimental-web-platform-features', 
      '--window-size=1280,720',
      '--autoplay-policy=no-user-gesture-required', 
      `--proxy-server=http://${proxyIpPort}`
    ]
  });

  const page = await browser.newPage();
  
  await page.authenticate({ username: proxyUser, password: proxyPass });
  console.log("Proxy credentials applied.");

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

  // Video ke chunks pipe karne ka function
  await page.exposeFunction('sendChunkToFFmpeg', (base64Chunk) => {
      const buffer = Buffer.from(base64Chunk, 'base64');
      // Pata chalega ke kitne bytes ki video FFmpeg ko bheji ja rahi hai
      console.log(`-> Pushed chunk of size: ${buffer.length} bytes to ok.ru`);
      ffmpeg.stdin.write(buffer); 
  });

  try {
    console.log("Navigating to Homepage...");
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
                
                await streamPage.evaluateOnNewDocument(() => { window.open = () => null; });

                console.log("Waiting 12 seconds for auto-refreshes...");
                await new Promise(r => setTimeout(r, 12000)); 
                
                console.log("Destroying Ad-Trap and unmuting...");
                await streamPage.evaluate(() => {
                    const trap = document.querySelector('div#dontfoid');
                    if (trap) trap.remove();
                });
                
                await new Promise(r => setTimeout(r, 3000));
                
                for (const frame of streamPage.frames()) {
                    try {
                        await frame.evaluate(() => {
                            const unmuteBtn = document.querySelector('#UnMutePlayer button');
                            if (unmuteBtn) unmuteBtn.click();
                        });
                    } catch (error) {}
                }
                
                console.log("SUCCESS! Video unmuted. Piping stream to ok.ru...");
                
                let playerFound = false;
                for (const frame of streamPage.frames()) {
                    try {
                        await frame.evaluate(() => {
                            const video = document.querySelector('video');
                            if (video) {
                                window.playerFound = true;
                                const stream = video.captureStream();
                                const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp8,opus' });
                                
                                recorder.ondataavailable = async (e) => {
                                    if (e.data.size > 0) {
                                        const reader = new FileReader();
                                        reader.readAsDataURL(e.data);
                                        reader.onloadend = () => {
                                            const base64 = reader.result.split(',')[1];
                                            window.sendChunkToFFmpeg(base64); 
                                        }
                                    } else {
                                        console.log("Warning: Empty chunk captured!");
                                    }
                                };
                                recorder.start(1000); 
                            }
                        });
                        
                        const found = await frame.evaluate(() => window.playerFound);
                        if (found) {
                            playerFound = true;
                            console.log("Video element hooked successfully!");
                            break; 
                        }
                    } catch (e) {}
                }

                if (!playerFound) {
                    console.log("[ERROR] Video element nahi mila! Iframe security restrict kar rahi hai.");
                }

                await new Promise(r => setTimeout(r, 18000000)); // 5 Hours
            }
        }
    } else {
        console.log("IPL Match nahi mila.");
    }

  } catch (error) {
    console.log("Execution stopped or error occurred:", error.message);
  }

  console.log("Closing browser and stopping stream...");
  ffmpeg.stdin.end();
  await browser.close();
})();





































// 1


// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// const { spawn } = require('child_process');

// puppeteer.use(StealthPlugin());

// (async () => {
//   console.log("Launching Browser for ZERO-LAG Live Broadcast to ok.ru...");

//   const proxyIpPort = '31.59.20.176:6754';
//   const proxyUser = 'cjasfidu';
//   const proxyPass = 'qhnyvm0qpf6p';
  
//   // UPDATE: Yahan aapka asali ok.ru ka RTMP URL aur Stream Key lag gaya hai
//   const rtmpUrl = 'rtmp://vsu.okcdn.ru/input/14601603391083_14040893622891_puxzrwjniu';

//   // FFmpeg ka Live Streaming process start karna
//   const ffmpeg = spawn('ffmpeg', [
//       '-i', 'pipe:0', 
//       '-c:v', 'libx264', 
//       '-preset', 'ultrafast', 
//       '-crf', '28', 
//       '-c:a', 'aac', 
//       '-b:a', '128k', 
//       '-f', 'flv', 
//       rtmpUrl // Direct apke ok.ru channel par jayega
//   ]);

//   ffmpeg.stderr.on('data', (data) => {
//       // Agar streaming mein masla aye toh isko uncomment karein error dekhne ke liye
//       // console.log(`FFmpeg: ${data}`); 
//   });

//   const browser = await puppeteer.launch({
//     headless: false, 
//     defaultViewport: { width: 1280, height: 720 },
//     args: [
//       '--no-sandbox', 
//       '--disable-setuid-sandbox',
//       '--disable-web-security', 
//       '--disable-features=IsolateOrigins,site-per-process',
//       '--enable-experimental-web-platform-features', 
//       '--window-size=1280,720',
//       '--autoplay-policy=no-user-gesture-required', 
//       `--proxy-server=http://${proxyIpPort}`
//     ]
//   });

//   const page = await browser.newPage();
  
//   await page.authenticate({ username: proxyUser, password: proxyPass });
//   console.log("Proxy credentials applied.");

//   await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

//   // Video ke chunks pakar kar ok.ru (FFmpeg) ko bhejna
//   await page.exposeFunction('sendChunkToFFmpeg', (base64Chunk) => {
//       const buffer = Buffer.from(base64Chunk, 'base64');
//       ffmpeg.stdin.write(buffer); 
//   });

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
                
//                 await streamPage.evaluateOnNewDocument(() => { window.open = () => null; });

//                 console.log("Waiting 12 seconds for auto-refreshes...");
//                 await new Promise(r => setTimeout(r, 12000)); 
                
//                 console.log("Destroying Ad-Trap and unmuting...");
//                 await streamPage.evaluate(() => {
//                     const trap = document.querySelector('div#dontfoid');
//                     if (trap) trap.remove();
//                 });
                
//                 await new Promise(r => setTimeout(r, 3000));
                
//                 for (const frame of streamPage.frames()) {
//                     try {
//                         await frame.evaluate(() => {
//                             const unmuteBtn = document.querySelector('#UnMutePlayer button');
//                             if (unmuteBtn) unmuteBtn.click();
//                         });
//                     } catch (error) {}
//                 }
                
//                 console.log("SUCCESS! Video unmuted. Piping stream to ok.ru...");
                
//                 // Live Stream ka Asal Jadu
//                 for (const frame of streamPage.frames()) {
//                     try {
//                         await frame.evaluate(() => {
//                             const video = document.querySelector('video');
//                             if (video) {
//                                 const stream = video.captureStream();
//                                 const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
                                
//                                 recorder.ondataavailable = async (e) => {
//                                     if (e.data.size > 0) {
//                                         const reader = new FileReader();
//                                         reader.readAsDataURL(e.data);
//                                         reader.onloadend = () => {
//                                             const base64 = reader.result.split(',')[1];
//                                             window.sendChunkToFFmpeg(base64); 
//                                         }
//                                     }
//                                 };
//                                 recorder.start(1000); // 1-1 second ke video tukray ok.ru ko bhejna
//                             }
//                         });
//                     } catch (e) {}
//                 }

//                 // GitHub free action maximum 6 ghante chalta hai, hum 5 ghante ka timer laga dete hain
//                 console.log("Stream is LIVE! You can now watch it on your ok.ru channel.");
//                 await new Promise(r => setTimeout(r, 18000000)); // 5 Hours
//             }
//         }
//     } else {
//         console.log("IPL Match nahi mila.");
//     }

//   } catch (error) {
//     console.log("Execution stopped or error occurred:", error.message);
//   }

//   console.log("Closing browser and stopping stream...");
//   ffmpeg.stdin.end();
//   await browser.close();
// })();

































 

// ======*****222222 ============== Great new 2026 technolgy iss correct karleyaa video + audio . New tecnology is Native MediaRecorder, lekin abbey beey eek issue hai RAM k jokey ok.ru k liye 24hours stream k hai , opper isko solve karney k try karty hai =======================================






// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// const fs = require('fs'); // Update: File save karne ke liye

// puppeteer.use(StealthPlugin());

// (async () => {
//   console.log("Launching Browser on GitHub Actions with Native Recorder...");

//   const proxyIpPort = '31.59.20.176:6754';
//   const proxyUser = 'cjasfidu';
//   const proxyPass = 'qhnyvm0qpf6p';
  
//   const browser = await puppeteer.launch({
//     headless: false, 
//     defaultViewport: { width: 1280, height: 720 },
//     args: [
//       '--no-sandbox', 
//       '--disable-setuid-sandbox',
//       '--disable-web-security', // CORS bypass ke liye zaroori hai
//       '--disable-features=IsolateOrigins,site-per-process',
//       '--enable-experimental-web-platform-features', // Native WebM support
//       '--window-size=1280,720',
//       '--autoplay-policy=no-user-gesture-required', 
//       `--proxy-server=http://${proxyIpPort}`
//     ]
//   });

//   const page = await browser.newPage();
  
//   await page.authenticate({
//       username: proxyUser,
//       password: proxyPass
//   });
//   console.log("Proxy credentials applied successfully.");

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
                
//                 console.log("Destroying Ad-Trap and scrolling...");
//                 await streamPage.evaluate(() => {
//                     const trap = document.querySelector('div#dontfoid');
//                     if (trap) trap.remove();
//                     window.scrollBy({ top: 400, behavior: 'smooth' });
//                 });
                
//                 console.log("Waiting 3 seconds before unmuting...");
//                 await new Promise(r => setTimeout(r, 3000));
                
//                 console.log("Bypassing ads and unmuting safely...");
//                 for (const frame of streamPage.frames()) {
//                     try {
//                         await frame.evaluate(() => {
//                             const unmuteBtn = document.querySelector('#UnMutePlayer button');
//                             if (unmuteBtn) unmuteBtn.click();
//                         });
//                     } catch (error) {}
//                 }
                
//                 console.log("SUCCESS! Starting 50-second ZERO-LAG Native Recording...");
                
//                 // UPDATE: Advanced Native MediaRecorder Logic
//                 let videoRecorded = false;
//                 for (const frame of streamPage.frames()) {
//                     if (videoRecorded) break;
//                     try {
//                         const base64Video = await frame.evaluate(async () => {
//                             return new Promise((resolve) => {
//                                 const video = document.querySelector('video');
//                                 if (!video) return resolve(null);

//                                 try {
//                                     // Player se direct video aur audio stream grab karna
//                                     const stream = video.captureStream();
//                                     const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
//                                     const chunks = [];

//                                     recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
//                                     recorder.onstop = () => {
//                                         const blob = new Blob(chunks, { type: 'video/webm' });
//                                         const reader = new FileReader();
//                                         reader.readAsDataURL(blob);
//                                         reader.onloadend = () => resolve(reader.result);
//                                     };

//                                     recorder.start();
//                                     // Theek 50 seconds tak record karega
//                                     setTimeout(() => recorder.stop(), 50000); 
//                                 } catch (err) {
//                                     resolve(null);
//                                 }
//                             });
//                         });

//                         // Agar video mili toh usko raw_video.webm ke naam se save kar lo
//                         if (base64Video) {
//                             const base64Data = base64Video.split(',')[1];
//                             fs.writeFileSync('raw_video.webm', Buffer.from(base64Data, 'base64'));
//                             console.log("Perfect Native Match Recording Saved!");
//                             videoRecorded = true;
//                         }
//                     } catch (e) {}
//                 }

//                 if (!videoRecorded) {
//                     console.log("Video player not found. Fallback wait.");
//                     await new Promise(r => setTimeout(r, 50000));
//                 }
//             }
//         }
//     } else {
//         console.log("IPL Match nahi mila.");
//     }

//   } catch (error) {
//     console.log("Execution stopped or error occurred:", error.message);
//   }

//   console.log("Closing browser to free up CPU...");
//   await browser.close();
// })();






























































//***************** ========= yeh code bilkul zabdst tareky see unmute kar deta hai =======================================



// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// puppeteer.use(StealthPlugin());

// (async () => {
//   console.log("Launching Browser on GitHub Actions Virtual Screen with Proxy...");

//   // Hardcoded Proxy Details
//   const proxyIpPort = '31.59.20.176:6754';
//   const proxyUser = 'cjasfidu';
//   const proxyPass = 'qhnyvm0qpf6p';
  
//   const browser = await puppeteer.launch({
//     headless: false, // False rakha hai taake Xvfb par render ho
//     defaultViewport: { width: 1280, height: 720 },
//     args: [
//       '--no-sandbox', 
//       '--disable-setuid-sandbox',
//       '--disable-web-security',
//       '--disable-features=IsolateOrigins,site-per-process',
//       '--window-size=1280,720',
//       '--autoplay-policy=no-user-gesture-required', // Auto-play allow karne ke liye
//       `--proxy-server=http://${proxyIpPort}` // Proxy IP aur Port yahan attach kiya
//     ]
//   });

//   const page = await browser.newPage();
  
//   // Proxy Authentication (Username aur Password)
//   await page.authenticate({
//       username: proxyUser,
//       password: proxyPass
//   });
//   console.log("Proxy credentials applied successfully.");

//   await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

//   try {
//     console.log("Navigating to Homepage using Proxy...");
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
                
//                 console.log("Destroying Ad-Trap and scrolling...");
//                 await streamPage.evaluate(() => {
//                     const trap = document.querySelector('div#dontfoid');
//                     if (trap) trap.remove();
//                     window.scrollBy({ top: 400, behavior: 'smooth' });
//                 });
                
//                 // Aapki requirement ke mutabiq 3 seconds ka wait
//                 console.log("Waiting 3 seconds before unmuting...");
//                 await new Promise(r => setTimeout(r, 3000));
                
//                 console.log("Bypassing ads and unmuting safely...");
                
//                 // Hum page ke tamaam iframes ko check karenge kyunke player iframes ke andar hai
//                 for (const frame of streamPage.frames()) {
//                     try {
//                         await frame.evaluate(() => {
//                             // DOM mein se button dhoondh kar direct click karna (No Mouse Click)
//                             const unmuteBtn = document.querySelector('#UnMutePlayer button');
//                             if (unmuteBtn) {
//                                 unmuteBtn.click(); // Yeh ad overlays ko completely ignore kar dega
//                             }
//                         });
//                     } catch (error) {
//                         // Agar koi cross-origin iframe issue aye toh usko ignore karo
//                     }
//                 }
                
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
































































































































// ======== great great yaha taaak sab kuch ready hai , bas audio ko unmute karna hai jokey ooper code mei test karty hai and yml file mei koi change nahey kyahai ok , yml mei iss stament ko copy and paste ky hai  =============================




// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// puppeteer.use(StealthPlugin());

// (async () => {
//   console.log("Launching Browser on GitHub Actions Virtual Screen with Proxy...");

//   // Hardcoded Proxy Details
//   const proxyIpPort = '31.59.20.176:6754';
//   const proxyUser = 'cjasfidu';
//   const proxyPass = 'qhnyvm0qpf6p';
  
//   const browser = await puppeteer.launch({
//     headless: false, // False rakha hai taake Xvfb par render ho
//     defaultViewport: { width: 1280, height: 720 },
//     args: [
//       '--no-sandbox', 
//       '--disable-setuid-sandbox',
//       '--disable-web-security',
//       '--disable-features=IsolateOrigins,site-per-process',
//       '--window-size=1280,720',
//       '--autoplay-policy=no-user-gesture-required', // Auto-play allow karne ke liye
//       `--proxy-server=http://${proxyIpPort}` // Proxy IP aur Port yahan attach kiya
//     ]
//   });

//   const page = await browser.newPage();
  
//   // Proxy Authentication (Username aur Password)
//   await page.authenticate({
//       username: proxyUser,
//       password: proxyPass
//   });
//   console.log("Proxy credentials applied successfully.");

//   await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

//   try {
//     console.log("Navigating to Homepage using Proxy...");
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
