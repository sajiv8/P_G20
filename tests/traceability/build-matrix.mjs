/**
 * Requirement Traceability Matrix generator.
 *
 *   node tests/traceability/build-matrix.mjs            # print the report
 *   node tests/traceability/build-matrix.mjs --json     # machine-readable
 *   node tests/traceability/build-matrix.mjs --md > rtm.md
 *
 * Scans every suite for the TC-IDs they reference and cross-references those
 * against the catalogue in test-cases.json. The point is that coverage is
 * measured rather than asserted: a case in the plan with no matching test shows
 * up as a hole, and a test referencing an unknown ID shows up as an orphan.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const asJson = process.argv.includes('--json');
const asMarkdown = process.argv.includes('--md');

const ID_PATTERN = /TC-[A-Z0-9]+-\d+/g;

// ---------------------------------------------------------------------------
// Where each suite lives. A case is "covered" if its ID appears in one of these.
// ---------------------------------------------------------------------------
// Service test files are discovered rather than listed, so adding tests to a
// new service counts automatically instead of silently going unnoticed.
const SERVICES_ROOT = 'backend/services';

function serviceTestDirs() {
  const abs = resolve(repoRoot, SERVICES_ROOT);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .map(service => join(SERVICES_ROOT, service, 'src'))
    .filter(dir => existsSync(resolve(repoRoot, dir)));
}

const SUITES = [
  // testOnly: a TC-ID mentioned in production source must not count as
  // coverage — only an actual test file does.
  { name: 'Jest (services)', level: 'L1/L2', paths: serviceTestDirs(), testOnly: true },
  { name: 'Newman API', level: 'L3', paths: ['tests/postman/campus-rso.postman_collection.json'] },
  { name: 'Cypress GUI', level: 'L4', paths: ['tests/cypress/e2e'] },
  { name: 'Selenium', level: 'L5', paths: ['tests/selenium'] },
  { name: 'JMeter', level: 'NFR', paths: ['tests/jmeter/campus-rso-load.jmx'] },
];

function filesUnder(target) {
  const abs = resolve(repoRoot, target);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs).flatMap(entry => filesUnder(join(target, entry)));
}

function idsIn(paths, testOnly = false) {
  const found = new Set();
  for (const path of paths) {
    for (const file of filesUnder(path)) {
      if (testOnly && !/\.(test|spec)\.[cm]?[jt]s$/.test(file)) continue;
      const text = readFileSync(file, 'utf8');
      for (const id of text.match(ID_PATTERN) || []) found.add(id);
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
const catalogue = JSON.parse(readFileSync(resolve(here, 'test-cases.json'), 'utf8'));
const byId = new Map(catalogue.cases.map(c => [c.id, c]));

const coverage = new Map(); // id -> [suite names]
const orphans = new Set(); // ids referenced by a test but absent from the catalogue

for (const suite of SUITES) {
  for (const id of idsIn(suite.paths, suite.testOnly)) {
    if (!byId.has(id)) {
      orphans.add(`${id} (${suite.name})`);
      continue;
    }
    if (!coverage.has(id)) coverage.set(id, []);
    coverage.get(id).push(suite.name);
  }
}

// ---------------------------------------------------------------------------
// A case flagged as needing a human stays Manual even if a suite mentions its
// ID — specs sometimes name a case in a comment precisely to say it cannot be
// automated, and counting that as coverage would overstate the numbers.
const miscounted = [];

const rows = catalogue.cases.map(c => {
  const suites = coverage.get(c.id) || [];
  let status;
  if (c.automatable === false) {
    status = 'Manual';
    if (suites.length > 0) miscounted.push(`${c.id} mentioned in ${suites.join(', ')}`);
  } else if (suites.length > 0) {
    status = 'Automated';
  } else {
    status = 'Not covered';
  }
  return { ...c, suites: status === 'Manual' ? [] : suites, status };
});

const counts = {
  total: rows.length,
  automated: rows.filter(r => r.status === 'Automated').length,
  manual: rows.filter(r => r.status === 'Manual').length,
  notCovered: rows.filter(r => r.status === 'Not covered').length,
};
counts.automatable = rows.filter(r => r.automatable !== false).length;
counts.automationRate = ((counts.automated / counts.automatable) * 100).toFixed(1);

// Requirement-level rollup
const requirements = catalogue.requirements.map(req => {
  const cases = req.cases.map(id => rows.find(r => r.id === id)).filter(Boolean);
  const automated = cases.filter(c => c.status === 'Automated').length;
  const uncovered = cases.filter(c => c.status === 'Not covered').map(c => c.id);
  const manual = cases.filter(c => c.status === 'Manual').length;

  let verdict;
  if (uncovered.length > 0) verdict = 'Partial';
  else if (automated === 0) verdict = 'Manual, pending execution';
  else if (manual > 0) verdict = 'Covered, manual part pending';
  else verdict = 'Covered';

  return { id: req.id, title: req.title, caseCount: cases.length, automated, manual, uncovered, verdict };
});

// Cases named in a requirement but missing from the catalogue entirely.
const danglingRefs = catalogue.requirements
  .flatMap(r => r.cases.filter(id => !byId.has(id)).map(id => `${r.id} → ${id}`));

// ---------------------------------------------------------------------------
if (asJson) {
  console.log(JSON.stringify({ counts, requirements, rows, orphans: [...orphans], danglingRefs }, null, 2));
  process.exit(0);
}

const pct = n => `${((n / counts.total) * 100).toFixed(0)}%`;

if (asMarkdown) {
  console.log('# Requirement Traceability Matrix\n');
  console.log(`Generated ${new Date().toISOString().slice(0, 10)} from the committed suites.\n`);
  console.log(`- Test cases in the plan: **${counts.total}**`);
  console.log(`- Automated: **${counts.automated}** (${counts.automationRate}% of the ${counts.automatable} automatable)`);
  console.log(`- Manual by design: **${counts.manual}**`);
  console.log(`- Not yet covered: **${counts.notCovered}**\n`);

  console.log('## Requirements\n');
  console.log('| Req | Requirement | Cases | Automated | Manual | Verdict |');
  console.log('|---|---|---|---|---|---|');
  for (const r of requirements) {
    console.log(`| ${r.id} | ${r.title} | ${r.caseCount} | ${r.automated} | ${r.manual} | ${r.verdict} |`);
  }

  console.log('\n## Test cases\n');
  console.log('| ID | Area | Case | Priority | Status | Covered by |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rows) {
    console.log(`| ${r.id} | ${r.area} | ${r.title} | ${r.priority} | ${r.status} | ${r.suites.join(', ') || (r.method ?? '—')} |`);
  }
  process.exit(0);
}

// Default: human-readable console report
const line = '─'.repeat(74);
console.log('\nRequirement Traceability Matrix');
console.log(line);
console.log(`  Test cases in the plan   ${counts.total}`);
console.log(`  Automated                ${counts.automated}  (${pct(counts.automated)} of all, ${counts.automationRate}% of automatable)`);
console.log(`  Manual by design         ${counts.manual}  (${pct(counts.manual)})`);
console.log(`  Not yet covered          ${counts.notCovered}  (${pct(counts.notCovered)})`);
console.log(line);

console.log('\nCoverage by area');
const areas = [...new Set(rows.map(r => r.area))];
for (const area of areas) {
  const inArea = rows.filter(r => r.area === area);
  const auto = inArea.filter(r => r.status === 'Automated').length;
  const man = inArea.filter(r => r.status === 'Manual').length;
  const none = inArea.filter(r => r.status === 'Not covered').length;
  const bar = '█'.repeat(Math.round((auto / inArea.length) * 20)).padEnd(20, '·');
  console.log(
    `  ${area.padEnd(18)} ${bar} ${String(auto).padStart(3)}/${String(inArea.length).padEnd(3)} automated` +
      (man ? `, ${man} manual` : '') +
      (none ? `, ${none} open` : ''),
  );
}

console.log('\nRequirements');
for (const r of requirements) {
  const mark = r.verdict === 'Covered' ? '✓' : r.verdict === 'Partial' ? '○' : '◐';
  console.log(`  ${mark} ${r.id.padEnd(7)} ${r.title}`);
  console.log(`      ${r.automated}/${r.caseCount} automated${r.manual ? `, ${r.manual} manual` : ''}` +
    (r.uncovered.length ? `, open: ${r.uncovered.join(' ')}` : ''));
}

const holes = rows.filter(r => r.status === 'Not covered');
if (holes.length > 0) {
  console.log(`\nCoverage holes — automatable but no test references them (${holes.length})`);
  for (const area of areas) {
    const inArea = holes.filter(h => h.area === area);
    if (inArea.length === 0) continue;
    console.log(`  ${area}:`);
    for (const h of inArea) console.log(`    ${h.id.padEnd(13)} [${h.priority}] ${h.title}`);
  }
}

if (orphans.size > 0) {
  console.log(`\nOrphan IDs — referenced by a test but absent from the catalogue (${orphans.size})`);
  for (const o of orphans) console.log(`  ${o}`);
}

if (miscounted.length > 0) {
  console.log(`\nManual cases mentioned by a suite (counted as manual, not automated)`);
  for (const m of miscounted) console.log(`  ${m}`);
}

if (danglingRefs.length > 0) {
  console.log(`\nRequirements pointing at unknown case IDs (${danglingRefs.length})`);
  for (const d of danglingRefs) console.log(`  ${d}`);
}

console.log('');
