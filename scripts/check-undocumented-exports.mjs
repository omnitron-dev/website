#!/usr/bin/env node
/**
 * Which exports do consumers actually IMPORT that the documentation never
 * names?
 *
 * The other checkers verify what the pages SAY. None of them can see what the
 * pages omit — a page is not wrong for leaving a symbol out, so every
 * presence-based probe reports agreement. This asks the complementary
 * question, and it found two real gaps on its first run: the token-issuance
 * mechanism (`issueTokens`, `clearTokens`, `readRequestCookie`,
 * `ITokenTransport` — how every sign-in on this platform reaches the client)
 * had no page anywhere, and `utilities/common.md` named four of the thirty-one
 * decimal helpers with the rest behind an ellipsis.
 *
 * Evidence that a symbol is consumer-facing comes from REAL imports in the
 * daos backends, not from a name looking public. An internal helper nobody
 * imports is not accused.
 *
 * The question is deliberately the weakest one that still finds the defect —
 * "is this name mentioned at all", not "is it described correctly". The
 * stronger form needs to resolve which declaration a name refers to, and a
 * probe built without that resolution produced three false positives in a row
 * (a heading naming a parameter; two decorators sharing a name; a union
 * parameter accepting both shapes).
 *
 * Usage:
 *   node scripts/check-undocumented-exports.mjs <omni-root> <daos-apps-dir> <docs-dir…>
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const [, , DAOS, ...DOCS] = process.argv.slice(1);
if (!DAOS || DOCS.length === 0) {
  console.error('usage: check-undocumented-exports.mjs <omni-root> <daos-apps-dir> <docs-dir…>');
  process.exit(2);
}

const SKIP = ['node_modules', 'dist', '.omnitron-build', 'build'];
function walk(dir, exts, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP.includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => entry.endsWith(e)) && !entry.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

// `export { … } from` counts too: an app that re-exports a symbol through its
// own barrel is surfacing it deliberately, which is the same evidence of
// consumer-facing API as importing it. Excluding re-exports was the first
// draft's choice and it discarded real signal — three barrels in paysys and
// storage re-export the lock and health surfaces and import them nowhere else.
const IMPORT = /(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'(@omnitron-dev\/[^']+)'/gs;
/** Every mention of the package family, however it is written. */
const ANY_MENTION = /from\s*'(@omnitron-dev\/[^']+)'/g;
/** Forms this probe deliberately does not read, each with a reason. */
const EXCLUDED = [
  [/import\s*\(/, 'a dynamic import — the specifier list is not static'],
  // A comment naming the package tells a reader where something lives; it
  // imports nothing. Both live instances say exactly that ("For direct usage,
  // import from …"), which is prose about the API, not use of it.
  [/^\s*(\/\/|\*|\/\*)/, 'a comment mentioning the package, not an import'],
];
const used = new Map(); // package -> Set<symbol>
const invented = [];
const unaccounted = [];

for (const file of walk(DAOS, ['.ts', '.tsx'])) {
  const text = readFileSync(file, 'utf8');

  // A DELIBERATELY NAIVE second reading. The structured regex above requires
  // `{ … }`, so a default or namespace import is not merely mis-parsed — it is
  // never seen, and an unseen import is a question the probe never asks. The
  // "verbatim" invariant cannot help: it catches names INVENTED, and this is
  // the opposite failure. Loss is the more dangerous direction for a probe
  // that hunts omissions, because less extracted means fewer questions asked
  // means a greener report.
  //
  // So: every mention of the package family must be either matched by the
  // structured read or excluded for a reason named in EXCLUDED.
  const structured = [...text.matchAll(IMPORT)].map((m) => m.index);
  for (const m of text.matchAll(ANY_MENTION)) {
    const lineStart = text.lastIndexOf('\n', m.index) + 1;
    const line = text.slice(lineStart, text.indexOf('\n', m.index) + 1 || undefined);
    if (EXCLUDED.some(([re]) => re.test(line))) continue;
    const covered = structured.some((start) => start <= m.index && m.index <= start + 4000);
    if (!covered) unaccounted.push([line.trim().slice(0, 70), relative(DAOS, file)]);
  }

  for (const m of text.matchAll(IMPORT)) {
    const pkg = m[2].split('/')[1];
    for (const raw of m[1].split(',')) {
      // trim BEFORE stripping the modifier: `{ RedisService, type RedisClient }`
      // splits to ' type RedisClient', where `^type` cannot match the leading
      // space, so the name survives as 'type RedisClient', fails the
      // identifier test, and is dropped in silence. Found by diffing this
      // against the prototype it was ported from — 26 imports apart.
      const name = raw.split(/\s+as\s+/)[0].trim().replace(/^type\s+/, '').trim();
      if (!/^[A-Za-z_$][\w$]*$/.test(name)) continue;

      // INVARIANT: a name the probe produced must appear VERBATIM in the text
      // it was read from. A transformation that mangles its input invents
      // symbols and then reports them as undocumented — with a plausible
      // count, past every emptiness guard, because the extraction is non-empty
      // and confidently wrong. (A real instance: `lstrip('type ')` in an
      // earlier draft stripped CHARACTERS rather than the prefix, so
      // `percentOf` became `rcentOf`.) Checking the PROPERTY holds whatever
      // the mangling mechanism turns out to be — which matters, because a
      // corruption can also miss your data by luck and leave a mutation green.
      if (!new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) {
        invented.push([name, relative(DAOS, file)]);
        continue;
      }
      if (!used.has(pkg)) used.set(pkg, new Set());
      used.get(pkg).add(name);
    }
  }
}

const mentioned = new Set();
for (const dir of DOCS) {
  for (const file of walk(dir, ['.md', '.mdx'])) {
    for (const word of readFileSync(file, 'utf8').match(/[A-Za-z_$][\w$]{2,}/g) ?? []) {
      mentioned.add(word);
    }
  }
}

if (unaccounted.length) {
  console.error('PROBE IS BROKEN, not the docs — these imports were neither read nor excluded:');
  for (const [line, where] of unaccounted.slice(0, 10)) console.error(`    ${where}: ${line}`);
  process.exit(2);
}
if (invented.length) {
  console.error('PROBE IS BROKEN, not the docs — it produced names absent from the source it read:');
  for (const [name, where] of invented.slice(0, 10)) console.error(`    '${name}'  (not found in ${where})`);
  process.exit(2);
}
const totalUsed = [...used.values()].reduce((n, s) => n + s.size, 0);
if (mentioned.size < 2000) {
  console.error(`PROBE IS BROKEN: only ${mentioned.size} names read from the docs`);
  process.exit(2);
}
if (totalUsed < 100) {
  console.error(`PROBE IS BROKEN: only ${totalUsed} imported symbols found under ${DAOS}`);
  process.exit(2);
}
for (const control of ['Injectable', 'Module', 'Public']) {
  if (!mentioned.has(control)) {
    console.error(`PROBE IS BROKEN: control name '${control}' absent from the docs`);
    process.exit(2);
  }
}

const MINE = new Set([
  'titan', 'titan-events', 'titan-ratelimit', 'titan-lock', 'titan-auth', 'titan-scheduler',
  'titan-cache', 'titan-database', 'titan-redis', 'titan-pm', 'titan-metrics', 'titan-health',
  'titan-notifications', 'titan-discovery', 'common', 'msgpack', 'eventemitter', 'cuid', 'testing',
]);

console.log(
  `${totalUsed} symbols imported by daos from ${used.size} packages · ` +
    `${mentioned.size} names mentioned across the docs\n`
);
let gaps = 0;
for (const pkg of [...used.keys()].sort()) {
  if (!MINE.has(pkg)) continue;
  const missing = [...used.get(pkg)].filter((s) => !mentioned.has(s)).sort();
  if (!missing.length) continue;
  gaps += missing.length;
  console.log(`  ${pkg}: ${missing.length} imported but never mentioned`);
  console.log(`      ${missing.slice(0, 14).join(', ')}${missing.length > 14 ? ' …' : ''}`);
}
console.log(`\n${gaps} symbol(s) that consumers import and the docs never name`);
