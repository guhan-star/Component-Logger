const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testThemeTransition() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const outDir = 'C:\\Users\\guhan\\.gemini\\antigravity\\brain\\bce19c20-e03c-4e9b-81c4-f222c64ad7c8\\verification_screenshots';
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Navigating to profile preferences...');
  await page.goto('http://localhost:3000/profile?tab=preferences', { waitUntil: 'networkidle' });

  // 1. Capture Dark Mode Profile
  const darkPath = path.join(outDir, '01_profile_dark.png');
  await page.screenshot({ path: darkPath });
  console.log('Saved dark mode screenshot:', darkPath);

  // 2. Click Light Mode button and capture transition stages
  const lightBtn = page.locator('button:has-text("High-Contrast Light")');
  await lightBtn.click();
  console.log('Clicked Light Mode button...');

  // Capture early mid-transition (core formation & branching tendrils)
  await page.waitForTimeout(1600);
  const transPath1 = path.join(outDir, '02_transition_mid_light.png');
  await page.screenshot({ path: transPath1 });
  console.log('Saved mid-transition screenshot 1:', transPath1);

  // Capture late mid-transition (wave expanding across screen)
  await page.waitForTimeout(2000);
  const transPath2 = path.join(outDir, '03_transition_wave_light.png');
  await page.screenshot({ path: transPath2 });
  console.log('Saved mid-transition screenshot 2:', transPath2);

  // Wait for transition completion (6.0s total)
  await page.waitForTimeout(3000);
  const lightPath = path.join(outDir, '04_profile_light.png');
  await page.screenshot({ path: lightPath });
  console.log('Saved light mode screenshot:', lightPath);

  // 3. Inspect text color and contrast in Light Mode
  const computedData = await page.evaluate(() => {
    const h1 = document.querySelector('h1, h2');
    const muted = document.querySelector('.text-\\[var\\(--muted\\)\\]');
    const body = document.body;
    return {
      headingColor: h1 ? window.getComputedStyle(h1).color : null,
      bodyBg: window.getComputedStyle(body).backgroundColor,
      textColor: window.getComputedStyle(body).color,
      mutedColor: muted ? window.getComputedStyle(muted).color : null,
      classList: Array.from(document.documentElement.classList),
    };
  });
  console.log('Light Mode Computed Style Data:', computedData);

  // 4. Capture Dashboard in Light Mode
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  const dashLightPath = path.join(outDir, '05_dashboard_light.png');
  await page.screenshot({ path: dashLightPath });
  console.log('Saved light mode dashboard screenshot:', dashLightPath);

  // 5. Capture Components (Inventory) in Light Mode
  await page.goto('http://localhost:3000/components', { waitUntil: 'networkidle' });
  const compLightPath = path.join(outDir, '06_inventory_light.png');
  await page.screenshot({ path: compLightPath });
  console.log('Saved light mode inventory screenshot:', compLightPath);

  // 6. Return to Profile and test Transition back to Dark Mode
  await page.goto('http://localhost:3000/profile?tab=preferences', { waitUntil: 'networkidle' });
  const darkBtn = page.locator('button:has-text("Stark Dark")');
  await darkBtn.click();
  console.log('Clicked Dark Mode button...');

  await page.waitForTimeout(2000);
  const transDarkPath = path.join(outDir, '07_transition_mid_dark.png');
  await page.screenshot({ path: transDarkPath });
  console.log('Saved dark mid-transition screenshot:', transDarkPath);

  await page.waitForTimeout(4500);
  const returnDarkPath = path.join(outDir, '08_profile_returned_dark.png');
  await page.screenshot({ path: returnDarkPath });
  console.log('Saved returned dark mode screenshot:', returnDarkPath);

  await browser.close();
  console.log('Full theme transition and light mode verification completed successfully!');
}

testThemeTransition().catch(err => {
  console.error('Error during test:', err);
  process.exit(1);
});
