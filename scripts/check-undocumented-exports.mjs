#!/usr/bin/env node
/**
 * Report imported public symbols that the manual never names.
 * Usage: node scripts/check-undocumented-exports.mjs <omni-root> <consumer-dir> <docs-dir…>
 * Consumers can be public apps, examples or a separately supplied checkout.
 * This is a review worklist; missing input or an empty extraction is an error.
 */
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import ts from 'typescript';

const [omni, consumers, ...docs] = process.argv.slice(2);
if (!omni || !consumers || !docs.length || !existsSync(join(omni, 'packages/titan/package.json'))) {
  console.error('usage: check-undocumented-exports.mjs <omni-root> <consumer-dir> <docs-dir…>');
  process.exit(2);
}
const skip = new Set(['node_modules', 'dist', 'build', '.git', '.omnitron-build']);
function* walk(dir) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    if (skip.has(entry.name) || entry.isSymbolicLink()) continue;
    const file = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(file);
    else yield file;
  }
}
const used = new Map();
let parsed = 0;
for (const file of walk(consumers)) {
  if (!/\.tsx?$/.test(file) || file.endsWith('.d.ts')) continue;
  parsed++;
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
    const specifier = node.moduleSpecifier;
    if (!specifier || !ts.isStringLiteral(specifier) || !specifier.text.startsWith('@omnitron-dev/')) continue;
    const clause = ts.isImportDeclaration(node) ? node.importClause?.namedBindings : node.exportClause;
    if (!clause) continue;
    // Namespace and export-star forms carry no individual imported names.
    if (!ts.isNamedImports(clause) && !ts.isNamedExports(clause)) continue;
    if (!used.has(specifier.text)) used.set(specifier.text, new Set());
    for (const name of clause.elements) used.get(specifier.text).add((name.propertyName ?? name.name).text);
  }
}
let corpus = '';
let pages = 0;
for (const dir of docs) {
  for (const file of walk(dir)) if (/\.mdx?$/.test(file)) {
    corpus += `\n${readFileSync(file, 'utf8')}`;
    pages++;
  }
}
const names = new Set(corpus.match(/[A-Za-z_$][\w$]*/g) ?? []);
const total = [...used.values()].reduce((sum, symbols) => sum + symbols.size, 0);
if (!total || !pages) throw new Error('No public imports or no documentation found; check the supplied directories');
let gaps = 0;
for (const [pkg, symbols] of [...used].sort()) {
  const missing = [...symbols].filter(name => !names.has(name)).sort();
  if (!missing.length) continue;
  gaps += missing.length;
  console.log(`${pkg}: ${missing.join(', ')}`);
}
console.log(`${parsed} source files; ${pages} pages; ${total} imported symbols; ${gaps} names to review`);
