#!/usr/bin/env node
import {readFileSync, readdirSync} from 'node:fs';
import {join, relative} from 'node:path';

const root = join(import.meta.dirname, '..');
// Code points avoid publishing the private identifiers in the guard itself.
const excluded = [
  [100, 97, 111, 115], [112, 114, 105, 99, 101, 118, 101, 114, 115, 101],
  [112, 97, 121, 115, 121, 115], [104, 111, 108, 111, 110], [118, 101, 114, 117, 109],
  [1076, 1072, 1086, 1089], [111, 122, 97, 114], [115, 121, 110, 97, 114, 99],
].map(chars => new RegExp(chars.map(c => String.fromCodePoint(c)).join('[\\s._/\\\\-]*'), 'iu'));
const lookalikes = new Map([[1076,100],[1281,100],[1072,97],[1086,111],[1109,115],[1089,115]].map(([from,to]) => [String.fromCodePoint(from), String.fromCodePoint(to)]));
const normalize = value => [...value.normalize('NFKC').toLowerCase()].map(c => lookalikes.get(c) ?? c).join('').replace(/[\u200b-\u200d\ufeff]/g, '');
const privatePath = /(?:^|[\s`"'(])(?:\.{0,2}\/)?internal\/|\/Users\/|file:\/\//m;
const failures = [];
let count = 0;
function walk(dir) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    if (entry.isSymbolicLink()) continue;
    const file = join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!/\.(mdx?|[cm]?js|tsx?|css|ya?ml|json|svg)$/.test(file)) continue;
    count++;
    const source = normalize(readFileSync(file, 'utf8'));
    if (excluded.some(pattern => pattern.test(normalize(relative(root, file))))) failures.push(`${relative(root, file)}: private project path`);
    if (excluded.some(pattern => pattern.test(source))) failures.push(`${relative(root, file)}: private project identifier`);
    if (/\.(mdx?|tsx?)$/.test(file) && privatePath.test(readFileSync(file, 'utf8'))) failures.push(`${relative(root, file)}: local-only path in public content`);
  }
}
for (const dir of ['docs', 'blog', 'src', 'scripts', 'static']) walk(join(root, dir));
if (!count) throw new Error('No public content was scanned');
for (const failure of failures) console.error(failure);
console.log(`${count} public files scanned; ${failures.length} boundary violations`);
process.exitCode = failures.length ? 1 : 0;
