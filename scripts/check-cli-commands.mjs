#!/usr/bin/env node
/**
 * Every top-level `omnitron` command must be named somewhere in the docs.
 *
 * `omnitron doctor` went unmentioned for as long as it existed and was
 * documented only when someone happened to run it. `omnitron service` — which
 * hands daemon supervision to launchd or systemd, and is the difference
 * between a crashed daemon coming back and every managed app staying down
 * until a human notices — was in the same position: forty top-level commands,
 * thirty-nine reachable from the docs.
 *
 * This is the second checker here that looks for ABSENCE rather than for a
 * false claim. It works for the same reason as the first: the CLI carries a
 * machine-readable inventory of itself, in the `program.command('…')` calls.
 *
 *   node scripts/check-cli-commands.mjs ../omni
 *
 * Exits non-zero on an undocumented command, and on its own failure to
 * extract.
 */

import fs from 'node:fs';
import path from 'node:path';

const repo = process.argv[2];
if (!repo) {
  console.error('usage: node scripts/check-cli-commands.mjs <path-to-omni-repo>');
  process.exit(2);
}

const cliPath = path.join(repo, 'apps/omnitron/src/cli/omnitron.ts');
const docsRoot = path.join(import.meta.dirname, '..', 'docs');
for (const p of [cliPath, docsRoot]) {
  if (!fs.existsSync(p)) {
    console.error(`missing: ${p}`);
    process.exit(2);
  }
}

const cli = fs.readFileSync(cliPath, 'utf8');

/**
 * Only the commands hung off `program`. Sub-commands of a group (`infra up`,
 * `stack list`) are a different claim: the group is what a reader looks up,
 * and requiring every leaf would report `omnitron backup full` as missing
 * while the backup page documents it in a table under another heading.
 */
const commands = [...cli.matchAll(/program\s*\n?\s*\.command\('([a-z][a-z0-9-]*)/g)].map((m) => m[1]);
const top = [...new Set(commands)].sort();

/** `.aliases(['ls'])` on the same chain — `omnitron ls` documents `list`. */
const aliases = new Map();
for (const m of cli.matchAll(/\.command\('([a-z][a-z0-9-]*)'[^\n]*\)\s*\n?\s*\.aliases\(\[([^\]]*)\]/g)) {
  aliases.set(m[1], [...m[2].matchAll(/'([a-z-]+)'/g)].map((a) => a[1]));
}

function readDocs(dir) {
  let text = '';
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) text += readDocs(p);
    else if (entry.name.endsWith('.md')) text += fs.readFileSync(p, 'utf8');
  }
  return text;
}
const docs = readDocs(docsRoot);

/**
 * Named inside code markup, which is how a writer separates naming a command
 * from using the word. Without the backtick `omnitron config` matches every
 * sentence about configuring omnitron.
 */
function documentedIn(text, cmd) {
  return [cmd, ...(aliases.get(cmd) ?? [])].some((n) =>
    new RegExp('`omnitron ' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(text)
  );
}

// A zero must be able to mean only "agrees", never "the extraction broke".
if (top.length < 30) {
  console.error(`the checker is broken, not the docs: only ${top.length} top-level commands extracted`);
  process.exit(2);
}
const CONTROL_DOCUMENTED = ['doctor', 'up', 'logs', 'list'];
const controlMissed = CONTROL_DOCUMENTED.filter((c) => !documentedIn(docs, c));
if (controlMissed.length > 0) {
  console.error(`the checker is broken, not the docs: it cannot find ${controlMissed.join(', ')}`);
  process.exit(2);
}
console.log(`control ok — the matcher finds all ${CONTROL_DOCUMENTED.length} commands known to be documented`);

// Planted defect: a command whose mentions are removed must be reported.
const withoutList = docs.replace(/`omnitron (list|ls)\b/g, '`omnitron REDACTED');
if (documentedIn(withoutList, 'list')) {
  console.error('the checker is broken: a command with no mention left was still reported as documented');
  process.exit(2);
}
console.log('control ok — a command stripped from the docs is reported');

const undocumented = top.filter((c) => !documentedIn(docs, c));
for (const c of undocumented) {
  const a = aliases.get(c);
  console.error(`\`omnitron ${c}\`${a ? ` (alias ${a.join(', ')})` : ''} is not named anywhere in docs/`);
}
if (undocumented.length > 0) process.exit(1);
console.log(`ok — all ${top.length} top-level commands are named in the docs`);
