/**
 * System Usability Scale scorer.
 *
 *   node tests/usability/sus-score.mjs                     # reads responses.csv
 *   node tests/usability/sus-score.mjs my-responses.csv
 *
 * The scoring is deliberately counter-intuitive and easy to get wrong:
 *   - odd-numbered items (positive wording)  score = answer - 1
 *   - even-numbered items (negative wording) score = 5 - answer
 *   - sum the ten adjusted scores, multiply by 2.5
 * That yields 0-100. It is NOT a percentage: 68 is the accepted average, so a
 * score of 68 means "about average", not "68% good".
 *
 * Input format — one row per participant, answers 1-5:
 *   participant,role,q1,q2,q3,q4,q5,q6,q7,q8,q9,q10
 *   P01,student,4,2,5,1,4,2,5,1,4,2
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(process.argv[2] ? process.cwd() : here, process.argv[2] || 'responses.csv');

export const SUS_ITEMS = [
  'I think that I would like to use this system frequently',
  'I found the system unnecessarily complex',
  'I thought the system was easy to use',
  'I think that I would need the support of a technical person to be able to use this system',
  'I found the various functions in this system were well integrated',
  'I thought there was too much inconsistency in this system',
  'I would imagine that most people would learn to use this system very quickly',
  'I found the system very cumbersome to use',
  'I felt very confident using the system',
  'I needed to learn a lot of things before I could get going with this system',
];

/** Adjusted score for one participant's ten answers. Returns 0-100. */
export function scoreParticipant(answers) {
  if (answers.length !== 10) throw new Error(`expected 10 answers, got ${answers.length}`);

  let total = 0;
  answers.forEach((answer, index) => {
    if (!Number.isInteger(answer) || answer < 1 || answer > 5) {
      throw new Error(`answer ${index + 1} is ${answer}; must be an integer 1-5`);
    }
    const isOdd = (index + 1) % 2 === 1;
    total += isOdd ? answer - 1 : 5 - answer;
  });
  return total * 2.5;
}

/** Sauro-Lewis curved grade for a SUS score. */
export function grade(score) {
  if (score >= 80.3) return { grade: 'A', label: 'excellent', percentile: 'top 10%' };
  if (score >= 74) return { grade: 'B', label: 'good', percentile: 'top 30%' };
  if (score >= 68) return { grade: 'C', label: 'okay — at the average', percentile: 'top 50%' };
  if (score >= 51) return { grade: 'D', label: 'poor', percentile: 'bottom 35%' };
  return { grade: 'F', label: 'unacceptable', percentile: 'bottom 15%' };
}

// ---------------------------------------------------------------------------
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync(file)) {
    console.error(`No responses file at ${file}`);
    console.error('Copy responses.example.csv to responses.csv and fill in your sessions.');
    process.exit(1);
  }

  const lines = readFileSync(file, 'utf8').trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const header = lines[0].toLowerCase().split(',').map(h => h.trim());
  const hasRole = header.includes('role');

  const participants = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(',').map(c => c.trim());
    const id = cells[0];
    const role = hasRole ? cells[1] : '';
    const answers = cells.slice(hasRole ? 2 : 1, hasRole ? 12 : 11).map(Number);
    try {
      participants.push({ id, role, answers, score: scoreParticipant(answers) });
    } catch (err) {
      console.error(`Skipping ${id}: ${err.message}`);
    }
  }

  if (participants.length === 0) {
    console.error('No valid responses found.');
    process.exit(1);
  }

  const scores = participants.map(p => p.score).sort((a, b) => a - b);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const median = scores.length % 2
    ? scores[(scores.length - 1) / 2]
    : (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2;
  const sd = Math.sqrt(scores.reduce((a, s) => a + (s - mean) ** 2, 0) / scores.length);

  // 95% confidence interval for the mean — a SUS score from 10 people carries
  // real uncertainty, and reporting it without the interval overstates it.
  const margin = 1.96 * (sd / Math.sqrt(scores.length));

  console.log('\nSystem Usability Scale');
  console.log('─'.repeat(62));
  console.log('  participant        role            score   grade');
  for (const p of participants) {
    const g = grade(p.score);
    console.log(
      `  ${p.id.padEnd(18)} ${(p.role || '—').padEnd(15)} ${p.score.toFixed(1).padStart(5)}   ${g.grade}`,
    );
  }
  console.log('─'.repeat(62));
  const g = grade(mean);
  console.log(`  participants        ${participants.length}`);
  console.log(`  mean SUS            ${mean.toFixed(1)}  (grade ${g.grade} — ${g.label})`);
  console.log(`  95% CI              ${(mean - margin).toFixed(1)} to ${(mean + margin).toFixed(1)}`);
  console.log(`  median              ${median.toFixed(1)}`);
  console.log(`  std deviation       ${sd.toFixed(1)}`);
  console.log(`  target (plan)       68.0  →  ${mean >= 68 ? 'MET' : 'NOT MET'}`);
  console.log('─'.repeat(62));

  // Per-item averages point at *which* part of the experience is weak.
  console.log('\nWeakest items (adjusted mean out of 4, lower is worse)');
  const itemScores = SUS_ITEMS.map((text, i) => {
    const adjusted = participants.map(p => ((i + 1) % 2 === 1 ? p.answers[i] - 1 : 5 - p.answers[i]));
    return { text, mean: adjusted.reduce((a, b) => a + b, 0) / adjusted.length };
  }).sort((a, b) => a.mean - b.mean);

  for (const item of itemScores.slice(0, 3)) {
    console.log(`  ${item.mean.toFixed(2)}  ${item.text}`);
  }
  console.log('');
}
