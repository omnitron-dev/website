#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join, resolve} from 'node:path';

const repo = process.argv[2] && resolve(process.argv[2]);
if (!repo || !existsSync(join(repo, 'packages/titan/package.json'))) {
  console.error('usage: pnpm check:source <path-to-omni>');
  process.exit(2);
}
const checks = [
  'check-catalog-coverage', 'check-cli-commands', 'check-doc-defaults',
  'check-doctor-areas', 'check-package-subpaths', 'check-services-reference',
  'check-titan-inventories',
  'build-api-index',
];
let failures = 0;
for (const name of checks) {
  const run = spawnSync(process.execPath, [join(import.meta.dirname, `${name}.mjs`), repo, ...(name === 'build-api-index' ? ['--check'] : [])], {stdio: 'inherit'});
  if (run.error || run.status !== 0) failures++;
}
console.log(`${checks.length} source checks; ${failures} failed`);
process.exitCode = failures ? 1 : 0;
