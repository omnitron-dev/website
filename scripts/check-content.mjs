#!/usr/bin/env node
import {readFileSync, readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
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
// Lumen container titles are attributes. Bare Docusaurus-style titles become
// ordinary text; code examples remain free to demonstrate any source syntax.
function unsupportedAdmonitions(source) {
  const issues = [];
  let fence;
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined;
      continue;
    }
    if (fence) continue;
    const header = /^ {0,3}:{3,}(note|tip|warning|danger|info|caution|important)(.*)$/.exec(line);
    if (!header || /^[a-z-]/i.test(header[2])) continue;
    if (header[1] === 'important' || (header[2].trim() && !/^\{.*\}\s*$/.test(header[2]))) issues.push(index + 1);
  }
  return issues;
}
assert.deepEqual(unsupportedAdmonitions(':::tip Bare title\n:::important{title="Boundary"}'), [1, 2]);
assert.deepEqual(unsupportedAdmonitions(':::note\n:::tip{title="Supported"}\n```markdown\n:::tip Example source\n```'), []);
const failures = [];
let count = 0;
function walk(dir) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    if (entry.isSymbolicLink()) continue;
    const file = join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!/\.(mdx?|[cm]?js|tsx?|css|ya?ml|json|svg)$/.test(file)) continue;
    count++;
    const original = readFileSync(file, 'utf8');
    const source = normalize(original);
    if (/\.mdx?$/.test(file)) {
      for (const line of unsupportedAdmonitions(original)) failures.push(`${relative(root, file)}:${line}: unsupported admonition header; use a Lumen kind and {title="..."}`);
    }
    if (excluded.some(pattern => pattern.test(normalize(relative(root, file))))) failures.push(`${relative(root, file)}: private project path`);
    if (excluded.some(pattern => pattern.test(source))) failures.push(`${relative(root, file)}: private project identifier`);
    if (/\.(mdx?|tsx?)$/.test(file) && privatePath.test(original)) failures.push(`${relative(root, file)}: local-only path in public content`);
  }
}
for (const dir of ['docs', 'pages', 'src', 'scripts', 'static']) walk(join(root, dir));
if (!count) throw new Error('No public content was scanned');
for (const failure of failures) console.error(failure);
console.log(`${count} public files scanned; ${failures.length} content violations`);
process.exitCode = failures.length ? 1 : 0;
