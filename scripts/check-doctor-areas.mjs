#!/usr/bin/env node
/**
 * Diff the `omnitron doctor` area table in docs/omnitron/cli.md against the
 * areas doctor actually reports from.
 *
 * The page used to open with a sentence enumerating what doctor examines:
 * "daemon, apps, ports, infrastructure containers, the internal database, the
 * disk, the build on disk and the console". A closed list in prose is a claim
 * that decays every time the command grows, and this one had: six commits in
 * three days added checks for alert rules that can never fire, log retry
 * loops, metrics sampling and every registered project's config. Two of those
 * areas — `alerts` and `metrics` — were named nowhere on the page, so an
 * operator reading the overview could not learn that doctor looks at them.
 *
 * Absence is the one thing the other checkers here cannot see. They verify
 * that what the docs say is true; nothing verified that what the code does is
 * said. This does, in the one place where the code carries a machine-readable
 * inventory of itself: every finding's `id` begins with its area.
 *
 *   node scripts/check-doctor-areas.mjs ../omni
 *
 * Exits non-zero on any disagreement, and on its own failure to extract.
 */

import fs from 'node:fs';
import path from 'node:path';

const repo = process.argv[2];
if (!repo) {
  console.error('usage: node scripts/check-doctor-areas.mjs <path-to-omni-repo>');
  process.exit(2);
}

const doctorPath = path.join(repo, 'apps/omnitron/src/commands/doctor.ts');
const docPath = path.join(import.meta.dirname, '..', 'docs/omnitron/cli.md');
for (const p of [doctorPath, docPath]) {
  if (!fs.existsSync(p)) {
    console.error(`missing: ${p}`);
    process.exit(2);
  }
}

/**
 * Read the ids out of `findings.add({ … })` by matching braces, not by a
 * bounded regex.
 *
 * The first version of this used `findings.add\(\{(.{0,400}?)\}\)` and found
 * 12 of the 29 — a finding whose evidence array and remedy run past the limit
 * is simply invisible to it. It then reported six "orphans" that were nothing
 * but its own truncation, including one this file's author had just read in
 * the source with his own eyes. Hence the control below.
 */
function findingIds(source) {
  const ids = new Set();
  const marker = 'findings.add(';
  for (let at = source.indexOf(marker); at !== -1; at = source.indexOf(marker, at + 1)) {
    const open = source.indexOf('{', at);
    if (open === -1) continue;
    let depth = 0;
    let end = open;
    for (; end < source.length; end++) {
      if (source[end] === '{') depth++;
      else if (source[end] === '}' && --depth === 0) break;
    }
    const body = source.slice(open, end + 1);
    const id = body.match(/id:\s*'([a-z][a-z0-9.-]*)'/);
    // `severity` is what separates a finding from an unrelated object that
    // happens to carry an `id` — the RPC request body in `checkAnonymous`
    // sends `id: 'doctor-anon'` and is not a finding.
    if (id && /\bseverity:/.test(body)) ids.add(id[1]);
  }
  return ids;
}

/** `| \`daemon\` | … |` rows of the area table. */
function documentedAreas(doc) {
  const areas = new Set();
  for (const line of doc.split('\n')) {
    const m = line.match(/^\|\s*`([a-z][a-z0-9-]*)`\s*\|/);
    if (m) areas.add(m[1]);
  }
  return areas;
}

const source = fs.readFileSync(doctorPath, 'utf8');
const doc = fs.readFileSync(docPath, 'utf8');

// A zero must be able to mean only "agrees", never "the extraction broke".
const CONTROL_IDS = ['auth.anonymous-surface', 'db.unreachable', 'infra.detached', 'logs.retry-loop'];
const ids = findingIds(source);
const missedControl = CONTROL_IDS.filter((id) => !ids.has(id));
if (missedControl.length > 0) {
  console.error(`the checker is broken, not the code: it did not find ${missedControl.join(', ')}`);
  process.exit(2);
}
if (ids.size < 20) {
  console.error(`the checker is broken, not the code: only ${ids.size} finding ids extracted`);
  process.exit(2);
}
console.log(`control ok — the extractor finds all ${CONTROL_IDS.length} ids known to exist`);

const areas = new Set([...ids].map((id) => id.split('.')[0]));
const documented = documentedAreas(doc);
if (documented.size === 0) {
  // Two different failures reach this line and they need opposite answers.
  // If the table's header is on the page and no rows parsed, the row regex
  // broke and nothing here can be trusted. If the header is absent, the page
  // simply does not carry the inventory — a documentation defect, which is
  // the state this checker was written against and must report as such.
  // Reported as one message either way, the first run of this check called
  // the original page a broken checker.
  const hasHeader = /^\|\s*Area\s*\|\s*What it looks at\s*\|/m.test(doc);
  if (hasHeader) {
    console.error('the checker is broken, not the code: the area table is present and no rows parsed');
    process.exit(2);
  }
  console.error('cli.md carries no `omnitron doctor` area table, so nothing states what it examines');
  process.exit(1);
}

const undocumented = [...areas].filter((a) => !documented.has(a)).sort();
const invented = [...documented].filter((a) => !areas.has(a)).sort();

for (const a of undocumented) {
  console.error(`doctor reports \`${a}.*\` findings and the page does not mention the area`);
}
for (const a of invented) {
  console.error(`the page documents area \`${a}\` and doctor reports no such finding`);
}

// Planted defects: the check must report each direction, not merely run.
const withoutOne = doc.replace(/^\|\s*`alerts`\s*\|.*$/m, '');
const controlA = [...areas].filter((a) => !documentedAreas(withoutOne).has(a));
const withInvented = doc + '\n| `nosuchthing` | planted |\n';
const controlB = [...documentedAreas(withInvented)].filter((a) => !areas.has(a));
if (!controlA.includes('alerts')) {
  console.error('the checker is broken: removing a documented area was not reported');
  process.exit(2);
}
if (!controlB.includes('nosuchthing')) {
  console.error('the checker is broken: an invented area was not reported');
  process.exit(2);
}
console.log('control ok — a removed area and an invented one are both reported');

if (undocumented.length > 0 || invented.length > 0) process.exit(1);
console.log(`ok — ${ids.size} findings across ${areas.size} areas, every area documented`);
