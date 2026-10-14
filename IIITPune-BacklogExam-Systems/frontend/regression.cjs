const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  let hasErrors = false;

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE LOG ERROR:', msg.text());
      hasErrors = true;
    }
  });
  
  page.on('pageerror', err => {
    console.log('PAGE ERROR (Exception):', err.message);
    hasErrors = true;
  });

  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function login(role) {
    console.log(`Logging in as ${role}...`);
    await page.goto(`http://localhost:5173/login/${role}`, { waitUntil: 'networkidle2' });
    await page.type('input[type="email"]', role === 'admin' ? 'admin@iiitpune.ac.in' : 'staff1@iiitpune.ac.in');
    await page.type('input[type="password"]', role === 'admin' ? 'Admin@123' : 'Staff@123');
    await page.click('button[type="submit"]');
    await wait(1000);
  }

  async function logout() {
    console.log(`Logging out...`);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const logout = btns.find(b => b.textContent.includes('Logout'));
      if(logout) logout.click();
    });
    await wait(1000);
  }

  // 1 & 2. Login/logout both roles, multiple times
  await login('admin');
  await logout();
  await login('staff');
  await logout();
  await login('admin'); // stay logged in as admin for rest of tests

  // 8. Navigate rapidly between all sidebar links
  console.log("Navigating sidebar links...");
  const links = [
    '/admin/dashboard',
    '/admin/dashboard/upload',
    '/admin/dashboard/students',
    '/admin/dashboard/subjects',
    '/admin/dashboard/faculty',
    '/admin/dashboard/rooms',
    '/admin/dashboard/scheduling',
    '/admin/dashboard/duty-allocation',
    '/admin/dashboard/regular-duty',
    '/admin/dashboard/approvals'
  ];

  for (const link of links) {
    await page.goto(`http://localhost:5173${link}`, { waitUntil: 'networkidle2' });
    await wait(500);
  }

  // 7. Check Exports (no console errors when clicked)
  console.log("Checking export buttons...");
  for (const link of ['/admin/dashboard/scheduling', '/admin/dashboard/duty-allocation', '/admin/dashboard/regular-duty']) {
    await page.goto(`http://localhost:5173${link}`, { waitUntil: 'networkidle2' });
    await wait(500);
    // Find PDF/Excel buttons
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const pdf = btns.find(b => b.textContent.includes('PDF'));
      const excel = btns.find(b => b.textContent.includes('Excel'));
      // Prevent actual navigation to avoid closing page, just verify they exist and can be clicked without throwing inline errors
      if(pdf) {
        const ogOpen = window.open;
        window.open = () => {};
        pdf.click();
        window.open = ogOpen;
      }
      if(excel) {
        const ogOpen = window.open;
        window.open = () => {};
        excel.click();
        window.open = ogOpen;
      }
    });
    await wait(500);
  }

  console.log("Done.");
  if (hasErrors) {
    console.error("REGRESSION TEST FAILED");
    process.exit(1);
  } else {
    console.log("REGRESSION TEST PASSED");
    process.exit(0);
  }

})();
