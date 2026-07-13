#!/usr/bin/env node
/**
 * check-contacts — fails the build if a tel: link does not dial the number
 * printed next to it.
 *
 * Why this exists
 * ---------------
 * Twice now a mini-site has shipped an agent card whose visible details were
 * correct and whose underlying href was not:
 *
 *   Bristol (2026-07-13, cloned from 5000 North Ocean / Wolf):
 *     <a href="tel:5613853564">📞 561.603.4329</a>
 *     ...printed Patrick's number, dialled Wolf's. Live on bristolpalmbeach.com.
 *
 *   City Palms (2026-07-13, cloned from Bristol / Patrick):
 *     Jonathan's headshot above Patrick's name, phone and email.
 *
 * Both are the same failure: a clone transform updates what a human can SEE and
 * misses what they can't. Nobody eyeballs an href. And the damage is silent and
 * permanent — a seller taps the specialist's number and reaches a different
 * agent, forever, with no error anywhere.
 *
 * So it gets asserted at build time instead of trusted to review.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';
const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(p)) files.push(p);
  }
})(ROOT);

const digits = (s) => s.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
const problems = [];

for (const f of files) {
  const src = readFileSync(f, 'utf8');

  // An anchor whose href is a tel: and whose visible text contains a phone
  // number. If both are present they must be the same number.
  const re = /href=["']tel:([+\d().\-\s]+)["'][^>]*>([^<]*)</g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const href = digits(m[1]);
    const shownRaw = m[2];
    const shownMatch = shownRaw.match(/[+(]?\d[\d().\-\s]{8,}\d/);
    if (!shownMatch) continue;           // link text isn't a number (e.g. "Call us")
    const shown = digits(shownMatch[0]);
    if (!href || !shown) continue;
    if (href !== shown) {
      const line = src.slice(0, m.index).split('\n').length;
      problems.push(
        `  ${f}:${line}\n` +
        `      href dials  ${href}\n` +
        `      text shows  ${shown}\n`
      );
    }
  }
}

if (problems.length) {
  console.error('\n✗ check-contacts: tel: link does not match the number displayed\n');
  console.error(problems.join('\n'));
  console.error('A visitor tapping this number reaches someone other than the person named.\n');
  process.exit(1);
}

console.log('✓ check-contacts: every tel: link dials the number it displays');
