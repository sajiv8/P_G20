/**
 * Cross-browser smoke journey — Selenium WebDriver.
 *
 * Cypress runs in a single Chromium engine, so it cannot catch a rendering or
 * API difference between browsers. This suite runs one core journey across
 * every installed browser instead of re-testing logic that Cypress covers.
 *
 *   node tests/selenium/run.mjs                 # all available browsers
 *   node tests/selenium/run.mjs --browser=chrome
 *   node tests/selenium/run.mjs --headed
 *
 * Drivers are resolved automatically by Selenium Manager. Safari additionally
 * needs `sudo safaridriver --enable` once per machine.
 */

import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import firefox from 'selenium-webdriver/firefox.js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const BASE_URL = process.env.SELENIUM_BASE_URL || 'http://localhost';
const TIMEOUT = 20000;

const args = process.argv.slice(2);
const headed = args.includes('--headed');
const only = args.find(a => a.startsWith('--browser='))?.split('=')[1];

// ---------------------------------------------------------------------------
// Credentials — reuse the gitignored Cypress env file
// ---------------------------------------------------------------------------
function loadCredentials() {
  const path = resolve(repoRoot, 'cypress.env.json');
  if (!existsSync(path)) {
    console.error('Missing cypress.env.json. Copy cypress.env.example.json and fill it in.');
    process.exit(1);
  }
  const env = JSON.parse(readFileSync(path, 'utf8'));
  if (!env.studentEmail || !env.studentPassword) {
    console.error('cypress.env.json is missing studentEmail or studentPassword.');
    process.exit(1);
  }
  return { email: env.studentEmail, password: env.studentPassword };
}

// ---------------------------------------------------------------------------
// Tiny assertion helper
// ---------------------------------------------------------------------------
function makeRecorder(browser) {
  const results = [];
  return {
    results,
    check(name, condition, detail = '') {
      results.push({ name, passed: Boolean(condition) });
      console.log(`  ${condition ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Driver construction
// ---------------------------------------------------------------------------
function buildDriver(browser) {
  const builder = new Builder().forBrowser(browser);

  if (browser === 'chrome') {
    const options = new chrome.Options();
    if (!headed) options.addArguments('--headless=new');
    options.addArguments('--window-size=1280,900', '--disable-gpu');
    builder.setChromeOptions(options);
  }

  if (browser === 'firefox') {
    const options = new firefox.Options();
    if (!headed) options.addArguments('-headless');
    options.addArguments('--width=1280', '--height=900');
    builder.setFirefoxOptions(options);
  }

  // Safari cannot run headless and allows only one session at a time.
  return builder.build();
}

// ---------------------------------------------------------------------------
// The journey
// ---------------------------------------------------------------------------
async function runJourney(browser, credentials) {
  console.log(`\n── ${browser} ${'─'.repeat(Math.max(0, 40 - browser.length))}`);

  let driver;
  const recorder = makeRecorder(browser);

  try {
    driver = await buildDriver(browser);
    await driver.manage().setTimeouts({ implicit: 0, pageLoad: TIMEOUT });

    // 1. A signed-out visitor is redirected to the login page
    await driver.get(`${BASE_URL}/bookings`);
    await driver.wait(until.elementLocated(By.id('login-email')), TIMEOUT);
    const redirected = await driver.getCurrentUrl();
    recorder.check('TC-GUI-01 redirects to login when signed out', redirected.includes('/login'));

    // 2. The login form renders
    const heading = await driver.findElement(By.css('.auth-title')).getText();
    recorder.check('login form renders', heading.includes('Welcome Back'), heading);

    // 3. Sign in
    await driver.findElement(By.id('login-email')).sendKeys(credentials.email);
    await driver.findElement(By.id('login-password')).sendKeys(credentials.password);
    await driver.findElement(By.css('form.auth-form button[type="submit"]')).click();

    // 4. The app shell appears
    await driver.wait(until.elementLocated(By.css('.sidebar')), TIMEOUT);
    recorder.check('signs in and loads the app shell', true);

    // 5. Navigate to Bookings through the sidebar
    const bookingsLink = await driver.wait(
      until.elementLocated(By.xpath("//span[contains(@class,'nav-label')][text()='Bookings']")),
      TIMEOUT,
    );
    await bookingsLink.click();
    await driver.wait(until.urlContains('/bookings'), TIMEOUT);
    recorder.check('navigates to the bookings page', true);

    // 6. No error toast was raised along the way
    const errorToasts = await driver.findElements(By.css('.toast-error'));
    recorder.check('no error toast during the journey', errorToasts.length === 0);

    // 7. The page does not scroll sideways
    const overflows = await driver.executeScript(
      'return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;',
    );
    recorder.check('no horizontal overflow', !overflows);
  } catch (err) {
    const message = err.message.split('\n')[0];

    // A browser we cannot drive on this machine is skipped, not failed —
    // Safari needs remote automation enabled by hand, and CI runners rarely
    // have more than Chrome installed.
    if (/Allow remote automation|Unable to obtain|cannot find|not found|no such file/i.test(message)) {
      console.log(`  – skipped: ${message}`);
      return { skipped: true, reason: message, results: [] };
    }
    recorder.check('journey completed without error', false, message);
  } finally {
    if (driver) await driver.quit().catch(() => {});
  }

  return { skipped: false, results: recorder.results };
}

// ---------------------------------------------------------------------------
// Which browsers can we actually drive?
// ---------------------------------------------------------------------------
function candidateBrowsers() {
  if (only) return [only];

  const available = [];
  if (existsSync('/Applications/Google Chrome.app')) available.push('chrome');
  if (existsSync('/Applications/Firefox.app')) available.push('firefox');
  if (existsSync('/Applications/Microsoft Edge.app')) available.push('MicrosoftEdge');
  if (process.platform === 'darwin' && existsSync('/Applications/Safari.app')) {
    available.push('safari');
  }
  // On Linux CI, Chrome is normally on PATH rather than in /Applications.
  if (available.length === 0) available.push('chrome');

  return available;
}

// ---------------------------------------------------------------------------
async function main() {
  const credentials = loadCredentials();
  const browsers = candidateBrowsers();

  console.log('Cross-browser smoke journey');
  console.log(`Target:   ${BASE_URL}`);
  console.log(`Browsers: ${browsers.join(', ')}`);

  const summary = [];

  for (const browser of browsers) {
    const { skipped, reason, results } = await runJourney(browser, credentials);
    summary.push({
      browser,
      skipped,
      reason,
      passed: results.filter(r => r.passed).length,
      total: results.length,
    });
  }

  console.log(`\n${'═'.repeat(46)}`);
  let failed = 0;
  let ran = 0;

  for (const row of summary) {
    if (row.skipped) {
      console.log(`  – ${row.browser.padEnd(16)} skipped`);
      continue;
    }
    ran++;
    const ok = row.passed === row.total && row.total > 0;
    if (!ok) failed++;
    console.log(`  ${ok ? '✓' : '✗'} ${row.browser.padEnd(16)} ${row.passed}/${row.total}`);
  }

  if (ran === 0) {
    console.log('\nNo browser could be driven — nothing was verified.');
    process.exit(1);
  }
  if (failed > 0) {
    console.log(`\n${failed} browser(s) failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${ran} browser(s) passed.`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
