#!/usr/bin/env node
/**
 * Inventory the declared public surface, including transitive re-exports.
 * Each entry point needs an explicit guide mapping. This checks navigation
 * coverage, not the completeness or correctness of prose for every symbol.
 */
import {readFileSync, writeFileSync, readdirSync, existsSync} from 'node:fs';
import {resolve, join, relative} from 'node:path';
import ts from 'typescript';
import catalog from './api-guides.mjs';

const root = resolve(import.meta.dirname, '..');
const repoArgument = process.argv.slice(2).find(argument => !argument.startsWith('--'));
const repo = repoArgument && resolve(repoArgument);
if (!repo || !existsSync(join(repo, 'packages/titan/package.json'))) {
  throw new Error('usage: node scripts/build-api-index.mjs <omni-root> [--check]');
}
const entries = [];
const packages = [];
for (const folder of ['packages', 'apps']) {
  for (const dir of readdirSync(join(repo, folder), {withFileTypes: true})) {
    if (!dir.isDirectory()) continue;
    const base = join(repo, folder, dir.name);
    if (!existsSync(join(base, 'package.json'))) continue;
    const pkg = JSON.parse(readFileSync(join(base, 'package.json'), 'utf8'));
    if (pkg.private || !pkg.name?.startsWith('@omnitron-dev/')) continue;
    const guides = catalog[pkg.name];
    if (!guides) throw new Error(`Package needs a guide mapping: ${pkg.name}`);
    const exports = pkg.exports ?? {'.': {types: pkg.types ?? pkg.main}};
    const publicKeys = Object.keys(exports).filter(key => !key.endsWith('.json'));
    for (const key of Object.keys(guides)) {
      if (!publicKeys.includes(key)) throw new Error(`Stale guide mapping: ${pkg.name}/${key}`);
    }
    for (const key of publicKeys) {
      const guide = guides[key];
      if (!guide || !existsSync(join(root, 'docs', guide))) throw new Error(`Missing guide: ${pkg.name}${key} → ${guide}`);
      const entry = exports[key];
      const target = typeof entry === 'string' ? entry : entry.types ?? entry.import?.types ?? entry.import ?? entry.default;
      if (typeof target !== 'string') throw new Error(`Unrecognised export target: ${pkg.name}${key}`);
      const stem = target.replace(/^(?:\.\/)?dist\//, './src/').replace(/\.d\.ts$/, '.ts').replace(/\.js$/, '.ts');
      const source = [stem, stem.replace(/\.ts$/, '.tsx')].map(p => join(base, p)).find(existsSync);
      if (!source) throw new Error(`No source for ${pkg.name}${key}: ${target}`);
      entries.push({package: pkg.name, path: key === '.' ? pkg.name : `${pkg.name}/${key.slice(2)}`, source, guide});
    }
    packages.push(pkg.name);
  }
}
for (const pkg of Object.keys(catalog)) if (!packages.includes(pkg)) throw new Error(`Stale package: ${pkg}`);
const paths = Object.fromEntries(entries.map(entry => [entry.path, [entry.source]]));
const compilerOptions = {
  target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
  paths, skipLibCheck: true, noEmit: true, noLib: true, types: [],
};
// Resolve this repository's public graph, not whichever third-party
// node_modules happens to be installed on the documentation author's machine.
const host = ts.createCompilerHost(compilerOptions);
const allowed = file => {
  const rel = relative(repo, resolve(file));
  return !rel.startsWith('..') && !rel.split(/[\\/]/).includes('node_modules');
};
const fileExists = host.fileExists;
const readFile = host.readFile;
host.fileExists = file => allowed(file) && fileExists(file);
host.readFile = file => allowed(file) ? readFile(file) : undefined;
host.getSourceFile = (file, languageVersion) => {
  const text = host.readFile(file);
  return text === undefined ? undefined : ts.createSourceFile(file, text, languageVersion, true);
};
const program = ts.createProgram(entries.map(entry => entry.source), compilerOptions, host);
const checker = program.getTypeChecker();
const rows = new Map();
const corpus = [];
function readDocs(dir) {
  for (const file of readdirSync(dir, {withFileTypes: true})) {
    if (file.isDirectory()) readDocs(join(dir, file.name));
    else if (/\.mdx?$/.test(file.name)) corpus.push(readFileSync(join(dir, file.name), 'utf8'));
  }
}
readDocs(join(root, 'docs'));
const namedInProse = new Set(corpus.join('\n').match(/[A-Za-z_$][\w$]*/g));
function docRoute(guide) {
  const text = readFileSync(join(root, 'docs', guide), 'utf8');
  const id = text.match(/^id:\s*(.+)$/m)?.[1];
  const parts = guide.replace(/\.mdx?$/, '').split('/');
  if (id) parts[parts.length - 1] = id.trim();
  else parts[parts.length - 1] = parts.at(-1).replace(/^\d+-/, '');
  if (parts.at(-1) === 'index') parts.pop();
  return `/docs/${parts.join('/')}`;
}
for (const entry of entries) {
  const source = program.getSourceFile(entry.source);
  const module = source && checker.getSymbolAtLocation(source);
  const symbols = module && checker.getExportsOfModule(module);
  if (!symbols?.length) throw new Error(`Empty export extraction: ${entry.path}`);
  for (const exported of symbols) {
    const actual = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    const declaration = actual.declarations?.[0] ?? exported.declarations?.[0];
    const name = exported.getName();
    const sourceFile = declaration?.getSourceFile();
    const sourcePath = sourceFile && relative(repo, sourceFile.fileName);
    const local = sourcePath && !sourcePath.startsWith('..') && !sourcePath.includes('node_modules');
    const line = declaration && sourceFile ? sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).line + 1 : 1;
    const typeOnly = exported.declarations?.some(d => ts.isExportSpecifier(d) && (d.isTypeOnly || d.parent.parent.isTypeOnly));
    const isValue = !typeOnly && !!(actual.flags & ts.SymbolFlags.Value);
    const kind = actual.flags & ts.SymbolFlags.Class ? 'class'
      : actual.flags & ts.SymbolFlags.Interface ? 'interface'
      : actual.flags & ts.SymbolFlags.TypeAlias ? 'type'
      : actual.flags & ts.SymbolFlags.Enum ? 'enum'
      : actual.flags & ts.SymbolFlags.Function ? 'function' : isValue ? 'value' : 'type';
    const key = `${entry.package}:${name}:${sourcePath}`;
    if (!rows.has(key)) rows.set(key, {
      name, package: entry.package, kind,
      source: local ? `https://github.com/omnitron-dev/omni/blob/main/${sourcePath}#L${line}` : null,
      imports: [],
    });
    rows.get(key).imports.push({path: entry.path, guide: docRoute(entry.guide)});
  }
}
const symbols = [...rows.values()].sort((a, b) => a.package.localeCompare(b.package, 'en') || a.name.localeCompare(b.name, 'en'));
for (const row of symbols) row.imports.sort((a, b) => a.path.localeCompare(b.path, 'en'));
const data = {
  packages: packages.sort(),
  entryPoints: entries.map(({path, guide}) => ({path, guide: docRoute(guide)})).sort((a, b) => a.path.localeCompare(b.path, 'en')),
  symbols,
};
const serialized = `${JSON.stringify(data, null, 2)}\n`;
const output = join(root, 'src/data/api-index.json');
if (process.argv.includes('--check')) {
  if (!existsSync(output) || readFileSync(output, 'utf8') !== serialized) {
    throw new Error('API index is stale. Run pnpm docs:api <omni-root> and review the diff.');
  }
} else writeFileSync(output, serialized);
const proseNames = symbols.filter(row => namedInProse.has(row.name)).length;
console.log(`${packages.length} packages; ${entries.length} public entry points; ${symbols.length} exported symbols indexed`);
console.log(`${proseNames} symbol names also appear in narrative pages. An indexed name is not proof of a complete usage guide.`);
