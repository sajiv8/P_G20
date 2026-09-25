/**
 * JMeter runner.
 *
 *   node tests/jmeter/run.mjs                    # full run: 50 users, 5 min
 *   node tests/jmeter/run.mjs --smoke            # 5 users, 30s — just proves it works
 *   node tests/jmeter/run.mjs --users=100 --duration=600
 *
 * Reads credentials from the gitignored cypress.env.json so there is one place
 * to keep them. Writes a .jtl plus a browsable HTML report.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const args = process.argv.slice(2);
const smoke = args.includes('--smoke');
const flag = (name, fallback) => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};

// ---------------------------------------------------------------------------
function findJMeter() {
  for (const candidate of ['jmeter', '/opt/homebrew/bin/jmeter', '/usr/local/bin/jmeter']) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (!probe.error) return candidate;
  }
  console.error('JMeter not found. Install it with:  brew install jmeter');
  process.exit(1);
}

function loadCredentials() {
  const path = resolve(repoRoot, 'cypress.env.json');
  if (!existsSync(path)) {
    console.error('Missing cypress.env.json. Copy cypress.env.example.json and fill it in.');
    process.exit(1);
  }
  const env = JSON.parse(readFileSync(path, 'utf8'));

  // The plan needs the Firebase web API key, which the frontend also carries.
  const firebaseSource = readFileSync(resolve(repoRoot, 'frontend/src/lib/firebase.ts'), 'utf8');
  const apiKey = env.firebaseApiKey || (firebaseSource.match(/apiKey:[^']*'([^']+)'/) || [])[1];

  if (!apiKey || !env.studentEmail || !env.studentPassword) {
    console.error('Need firebaseApiKey (or the frontend fallback), studentEmail and studentPassword.');
    process.exit(1);
  }
  return { apiKey, email: env.studentEmail, password: env.studentPassword };
}

// ---------------------------------------------------------------------------
const jmeter = findJMeter();
const { apiKey, email, password } = loadCredentials();

const users = flag('users', smoke ? '5' : '50');
const duration = flag('duration', smoke ? '30' : '300');
const rampUp = flag('rampUp', smoke ? '5' : '30');
const rateUsers = flag('rateUsers', smoke ? '10' : '20');
const rateDuration = flag('rateDuration', smoke ? '10' : '20');
const baseUrl = flag('host', 'localhost');
const basePort = flag('port', '80');

const outDir = resolve(here, 'results');
const jtl = resolve(outDir, 'results.jtl');
const reportDir = resolve(outDir, 'html-report');

// JMeter refuses to write into a non-empty results directory.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const jmeterArgs = [
  '-n',
  '-t', resolve(here, 'campus-rso-load.jmx'),
  '-l', jtl,
  '-e', '-o', reportDir,
  `-JbaseUrl=${baseUrl}`,
  `-JbasePort=${basePort}`,
  `-JfirebaseApiKey=${apiKey}`,
  `-JstudentEmail=${email}`,
  `-JstudentPassword=${password}`,
  `-Jusers=${users}`,
  `-JrampUp=${rampUp}`,
  `-Jduration=${duration}`,
  `-JrateUsers=${rateUsers}`,
  `-JrateDuration=${rateDuration}`,
  `-JresultsFile=${jtl}`,
];

console.log(`JMeter load test${smoke ? ' (smoke)' : ''}`);
console.log(`  target    http://${baseUrl}:${basePort}`);
console.log(`  browsing  ${users} users, ${duration}s (ramp ${rampUp}s)`);
console.log(`  ratelimit ${rateUsers} users, ${rateDuration}s`);
console.log('');

const run = spawnSync(jmeter, jmeterArgs, { stdio: 'inherit', cwd: repoRoot });

if (run.status !== 0) {
  console.error('\nJMeter exited non-zero.');
  process.exit(run.status ?? 1);
}

// ---------------------------------------------------------------------------
// Summarise the .jtl ourselves — the pass/fail thresholds live in the test
// plan document, not in JMeter.
// ---------------------------------------------------------------------------
const lines = readFileSync(jtl, 'utf8').trim().split('\n');
const header = lines[0].split(',');
const idx = name => header.indexOf(name);

const rows = lines.slice(1).map(l => l.split(','));
const byLabel = new Map();

for (const row of rows) {
  const label = row[idx('label')];
  const elapsed = Number(row[idx('elapsed')]);
  const code = row[idx('responseCode')];
  const ok = row[idx('success')] === 'true';

  if (!byLabel.has(label)) byLabel.set(label, { times: [], codes: new Map(), fail: 0 });
  const entry = byLabel.get(label);
  entry.times.push(elapsed);
  entry.codes.set(code, (entry.codes.get(code) || 0) + 1);
  if (!ok) entry.fail++;
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

console.log(`\n${'═'.repeat(78)}`);
console.log('Summary');
console.log('─'.repeat(78));
console.log('  sampler'.padEnd(34) + 'n'.padStart(7) + 'p50'.padStart(8) + 'p95'.padStart(8) + 'p99'.padStart(8) + 'errors'.padStart(9));

for (const [label, entry] of byLabel) {
  const sorted = entry.times.sort((a, b) => a - b);
  const errRate = ((entry.fail / sorted.length) * 100).toFixed(1);
  console.log(
    `  ${label}`.padEnd(34) +
      String(sorted.length).padStart(7) +
      `${percentile(sorted, 50)}ms`.padStart(8) +
      `${percentile(sorted, 95)}ms`.padStart(8) +
      `${percentile(sorted, 99)}ms`.padStart(8) +
      `${errRate}%`.padStart(9),
  );
}

console.log('─'.repeat(78));
console.log('Response codes per sampler:');
for (const [label, entry] of byLabel) {
  const codes = [...entry.codes.entries()].map(([c, n]) => `${c}×${n}`).join('  ');
  console.log(`  ${label}: ${codes}`);
}

console.log(`\nHTML report: ${reportDir}/index.html`);
