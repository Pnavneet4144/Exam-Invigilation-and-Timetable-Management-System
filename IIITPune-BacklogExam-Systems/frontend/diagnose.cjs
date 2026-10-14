const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('PAGE LOG ERROR:', msg.text());
  });
  
  page.on('pageerror', err => {
    console.log('PAGE ERROR (Exception):', err.message);
    console.log('STACK:', err.stack);
  });
  
  console.log("Navigating to /login/admin");
  await page.goto('http://localhost:5173/login/admin', { waitUntil: 'networkidle2' });
  
  console.log("Logging in...");
  await page.type('input[type="email"]', 'admin@iiitpune.ac.in');
  await page.type('input[type="password"]', 'Admin@123');
  await page.click('button[type="submit"]');
  
  await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(()=>null);
  await new Promise(r => setTimeout(r, 1000));
  
  console.log("Current URL:", page.url());
  
  console.log("Logging out...");
  // Attempt to click logout if it exists
  try {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const logout = btns.find(b => b.textContent.includes('Logout'));
      if(logout) logout.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    console.log("After logout URL:", page.url());
  } catch(e) {
    console.log("Logout failed:", e);
  }

  console.log("Navigating to /login/staff");
  await page.goto('http://localhost:5173/login/staff', { waitUntil: 'networkidle2' });
  
  await new Promise(r => setTimeout(r, 1000));
  console.log("Final URL:", page.url());

  await browser.close();
})();
