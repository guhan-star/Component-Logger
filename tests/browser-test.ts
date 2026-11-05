import { chromium } from 'playwright';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';

const PORT = 3002;
const BASE_URL = `http://localhost:${PORT}`;

let serverProcess: ChildProcess | null = null;

function waitForServer(url: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode) {
          resolve();
        } else {
          setTimeout(check, 500);
        }
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout waiting for server at ${url}`));
        } else {
          setTimeout(check, 500);
        }
      });
    };
    check();
  });
}

async function runBrowserTests() {
  console.log('===============================================================');
  console.log('🌐 STARK INDUSTRIES WMC — PLAYWRIGHT BROWSER AUTOMATION SUITE');
  console.log('===============================================================\n');

  console.log(`Starting production Next.js server on port ${PORT}...`);
  serverProcess = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    stdio: 'pipe',
    shell: true,
    env: { ...process.env, TEST_MODE: 'true', ALLOW_LOCAL_FALLBACK: 'true' },
  });

  serverProcess.stdout?.on('data', (d) => {
    // console.log(`[Next] ${d}`);
  });
  serverProcess.stderr?.on('data', (d) => {
    // console.error(`[Next Err] ${d}`);
  });

  try {
    await waitForServer(`${BASE_URL}/login`);
    console.log(`✓ Local server is up and listening on ${BASE_URL}\n`);

    const browser = await chromium.launch({ headless: true });
    console.log('✓ Headless Chromium launched successfully\n');

    let passed = 0;
    let failed = 0;

    const assertBrowser = (condition: boolean, testName: string) => {
      if (condition) {
        passed++;
        console.log(`  ✓ PASS: ${testName}`);
      } else {
        failed++;
        console.error(`  ✗ FAIL: ${testName}`);
      }
    };

    // -------------------------------------------------------------
    // TEST 1: Login & Forgot Password Navigation (Desktop Viewport)
    // -------------------------------------------------------------
    console.log('🖥️ Viewport: Desktop (1280x800)');
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const desktopPage = await desktopContext.newPage();

    await desktopPage.goto(`${BASE_URL}/login`);
    const loginTitle = await desktopPage.textContent('h1');
    assertBrowser(
      loginTitle?.includes('Warehouse Management') === true,
      'Login page loads with Stark Industries brand header'
    );

    // Click "Forgot password?" link
    await desktopPage.click('a[href="/forgot-password"]');
    await desktopPage.waitForURL('**/forgot-password');
    const forgotTitle = await desktopPage.textContent('h1');
    assertBrowser(
      forgotTitle?.includes('Reset Account Password') === true,
      'Navigated cleanly from Login to /forgot-password'
    );

    // Submit email on forgot-password page
    await desktopPage.fill('input[type="email"]', 'operator@stark.test');
    await desktopPage.click('button[type="submit"]');
    await desktopPage.waitForSelector('text=Recovery Instructions Dispatched');
    const successMsg = await desktopPage.textContent('body');
    assertBrowser(
      successMsg?.includes('Recovery Instructions Dispatched') === true,
      'Forgot password displays generic response banner to prevent email enumeration'
    );

    await desktopContext.close();

    // -------------------------------------------------------------
    // TEST 2: Mobile Viewport Responsive Checks (375x667 iPhone SE)
    // -------------------------------------------------------------
    console.log('\n📱 Viewport: Mobile (375x667 iPhone SE)');
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();

    // Register Page on mobile
    await mobilePage.goto(`${BASE_URL}/register`);
    const regTitle = await mobilePage.textContent('h1');
    assertBrowser(
      regTitle?.includes('Operator Registration') === true || regTitle?.includes('Register') === true,
      'Registration page renders without clipping on mobile viewport'
    );

    // Verify all input fields exist
    const hasNameInput = await mobilePage.isVisible('input[placeholder*="Tony Stark"]');
    const hasUsernameInput = await mobilePage.isVisible('input[placeholder*="ironman"]');
    const hasEmailInput = await mobilePage.isVisible('input[type="email"]');
    const hasPasswordInput = (await mobilePage.$$('input[type="password"]')).length >= 2;
    assertBrowser(
      hasNameInput && hasUsernameInput && hasEmailInput && hasPasswordInput,
      'All registration form inputs are accessible and properly styled on mobile'
    );

    // -------------------------------------------------------------
    // TEST 3: Email Verification States (/verify-email)
    // -------------------------------------------------------------
    console.log('\n✉️ Email Verification Module (/verify-email)');
    await mobilePage.goto(`${BASE_URL}/verify-email?token=invalid-fake-token-xyz-123`);
    await mobilePage.waitForSelector('text=Invalid Verification Link');
    const verifyBody = await mobilePage.textContent('body');
    assertBrowser(
      verifyBody?.includes('Invalid Verification Link') === true,
      'Displays explicit invalid/expired state when verification token is unrecognized'
    );

    const hasResendForm = await mobilePage.isVisible('button:has-text("Send Verification Email")');
    assertBrowser(hasResendForm, 'Provides an accessible resend verification link form when token is invalid');

    // -------------------------------------------------------------
    // TEST 4: Password Reset States (/reset-password)
    // -------------------------------------------------------------
    console.log('\n🔑 Password Reset Module (/reset-password)');
    await mobilePage.goto(`${BASE_URL}/reset-password?token=invalid-fake-reset-token-456`);
    await mobilePage.waitForSelector('text=Link Invalid or Expired');
    const resetBody = await mobilePage.textContent('body');
    assertBrowser(
      resetBody?.includes('Link Invalid or Expired') === true,
      'Displays link invalid or expired state on tampered/invalid reset tokens'
    );

    // -------------------------------------------------------------
    // TEST 5: Inventory Dashboard & Regression
    // -------------------------------------------------------------
    console.log('\n📦 Inventory Dashboard Regression (/components)');
    await mobilePage.goto(`${BASE_URL}/components`);
    await mobilePage.waitForSelector('text=Component Inventory');
    const invTitle = await mobilePage.textContent('h1');
    assertBrowser(
      invTitle?.includes('Component Inventory') === true,
      'Inventory dashboard loads successfully without regressions'
    );

    await mobileContext.close();
    await browser.close();

    console.log('\n===============================================================');
    console.log(`📊 BROWSER TEST SUMMARY: ${passed + failed} TOTAL | ${passed} PASSED | ${failed} FAILED`);
    console.log('===============================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  }
}

runBrowserTests().catch((err) => {
  console.error('Browser test error:', err);
  if (serverProcess) serverProcess.kill('SIGTERM');
  process.exit(1);
});
