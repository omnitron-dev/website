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
/**
 * A command registered by some other means would be invisible here, and the
 * report would simply get shorter — the failure direction a threshold cannot
 * see. Commander offers `addCommand()` alongside `.command()`, so this asserts
 * that the file uses one mechanism, rather than assuming it.
 */
if (/\.addCommand\s*\(|\.command\s*\(\s*new\s/.test(cli)) {
  console.error(
    'the checker is broken, not the CLI: commands are registered through addCommand() ' +
      'or a Command instance, which this checker does not read'
  );
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

/**
 * Sub-command leaves, checked separately.
 *
 * The top-level scan misses the case that actually bit: `omnitron backup`
 * exists and is documented, while four of its seven leaves — `full`,
 * `schedule`, `schedules`, `unschedule` — were absent from the reference
 * table, and `backup full` was named nowhere at all. That is the command
 * which takes the object storage, the Tor keys and the daemon state: the
 * parts a restored stack is useless without.
 *
 * The receiver variable is not the command path. `k8sDeploy.command('scale')`
 * is `omnitron k8s deploy scale`, and reading the variable name reports a
 * command that does not exist, under a name nobody would search for. So the
 * chain is resolved back through the `const x = y.command('name')`
 * declarations, and a leaf whose path does not reach `program` is skipped
 * rather than guessed at.
 */
const chain = new Map();
for (const m of cli.matchAll(/const\s+(\w+)\s*=\s*(\w+)\s*\.command\('([a-z][a-z0-9-]*)'/g)) {
  chain.set(m[1], { parent: m[2], name: m[3] });
}
function pathOf(receiver) {
  const parts = [];
  let cur = receiver;
  while (chain.has(cur)) {
    const link = chain.get(cur);
    parts.unshift(link.name);
    cur = link.parent;
  }
  return cur === 'program' && parts.length > 0 ? parts : null;
}

const leaves = [];
for (const m of cli.matchAll(/(\w+)\s*\n?\s*\.command\('([a-z][a-z0-9-]*)/g)) {
  if (m[1] === 'program') continue;
  const path = pathOf(m[1]);
  if (path) leaves.push([...path, m[2]].join(' '));
}
const uniqueLeaves = [...new Set(leaves)];
if (uniqueLeaves.length < 40) {
  console.error(`the checker is broken, not the CLI: only ${uniqueLeaves.length} sub-command leaves resolved`);
  process.exit(2);
}
/**
 * The control must not depend on the state being tested.
 *
 * This first read `if (!documentedIn(docs, 'backup full'))` — a leaf that was
 * documented in the same commit that added this check. Run against the docs as
 * they were before it, the control fired "the checker is broken" and MASKED the
 * four real findings it exists to surface. A control naming a specific
 * documented thing asserts the docs, not the checker.
 *
 * These two do not. If the matcher answered false for everything, all 65 leaves
 * would be reported; if it answered true for everything, the planted name would
 * pass. Neither depends on what any page currently says.
 */
if (documentedIn(docs, 'backup nosuchleafplanted')) {
  console.error('the checker is broken: an invented leaf matched the documentation');
  process.exit(2);
}
const matchedLeaves = uniqueLeaves.filter((l) => documentedIn(docs, l)).length;
if (matchedLeaves < uniqueLeaves.length / 2) {
  console.error(
    `the checker is broken: only ${matchedLeaves} of ${uniqueLeaves.length} leaves matched — ` +
      'the matcher is not finding documentation that exists'
  );
  process.exit(2);
}
console.log(
  `control ok — ${uniqueLeaves.length} leaves resolved, ${matchedLeaves} matched, an invented one did not`
);

const undocumentedLeaves = uniqueLeaves.filter((l) => !documentedIn(docs, l));
for (const l of undocumentedLeaves) {
  console.error(`\`omnitron ${l}\` is not named anywhere in docs/`);
}

const undocumented = top.filter((c) => !documentedIn(docs, c));
for (const c of undocumented) {
  const a = aliases.get(c);
  console.error(`\`omnitron ${c}\`${a ? ` (alias ${a.join(', ')})` : ''} is not named anywhere in docs/`);
}
if (undocumented.length > 0 || undocumentedLeaves.length > 0) process.exit(1);
console.log(
  `ok — all ${top.length} top-level commands and ${uniqueLeaves.length} sub-command leaves are named in the docs`
);
