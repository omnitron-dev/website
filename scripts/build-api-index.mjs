#!/usr/bin/env node
/**
 * Inventory the declared public surface, including transitive re-exports.
 * Each entry point needs an explicit guide mapping. This checks navigation
 * coverage, not the completeness or correctness of prose for every symbol.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, readdirSync, existsSync} from 'node:fs';
import {resolve, join, relative, sep} from 'node:path';
import ts from 'typescript';
import { platformExamples } from './platform-examples.mjs';
import { platformEntries } from './platform-entries.mjs';

const root = resolve(import.meta.dirname, '..');
const repoArgument = process.argv.slice(2).find(argument => !argument.startsWith('--'));
const repo = repoArgument && resolve(repoArgument);
if (!repo || !existsSync(join(repo, 'packages/titan/package.json'))) {
  throw new Error('usage: node scripts/build-api-index.mjs <omni-root> [--check]');
}
const git = (...args) => execFileSync('git', ['-C', repo, ...args], {encoding: 'utf8'}).trim();
const revision = git('rev-parse', '--verify', 'HEAD^{commit}');
const sourceInputs = ['packages', 'apps'].flatMap(dir =>
  [`:(glob)${dir}/*/package.json`, `:(glob)${dir}/*/src/**`]);
if (!/^[a-f0-9]{40}$/.test(revision) || git('status', '--porcelain', '--untracked-files=all', '--', ...sourceInputs)) {
  throw new Error('Use a clean Omnitron source checkout so that indexed files and line numbers belong to its commit.');
}
const sourcePath = file => relative(repo, file).split(sep).join('/');
const { entries, packages } = platformEntries(repo, root);
const modules = entries.filter(entry => entry.kind !== 'stylesheet');
const paths = Object.fromEntries(modules.map(entry => [entry.path, [entry.source]]));
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
const program = ts.createProgram(modules.map(entry => entry.source), compilerOptions, host);
const checker = program.getTypeChecker();
const rows = new Map();
const corpus = new Map();
for (const directory of ['docs', 'pages']) {
  for (const path of readdirSync(join(root, directory), { recursive: true })) {
    if (/\.mdx?$/.test(path)) corpus.set(join(directory, path), readFileSync(join(root, directory, path), 'utf8'));
  }
}
const namedInProse = new Set([...corpus.values()].join('\n').match(/[A-Za-z_$][\w$]*/g));
function docRoute(guide) {
  const source = readFileSync(join(root, 'docs', guide), 'utf8');
  const frontmatter = source.startsWith('---\n') ? source.split('---', 3)[1] : '';
  const slug = frontmatter.match(/^slug:\s*(.+)$/m)?.[1].trim();
  if (!slug) throw new Error(`Missing public route for ${guide}`);
  return slug.startsWith('"') ? JSON.parse(slug) : slug.replace(/^'|'$/g, '');
}

for (const entry of modules) {
  const source = program.getSourceFile(entry.source);
  const module = source && checker.getSymbolAtLocation(source);
  const symbols = module && checker.getExportsOfModule(module);
  if (!symbols?.length) throw new Error(`Empty export extraction: ${entry.path}`);
  for (const exported of symbols) {
    const actual = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    const declaration = actual.declarations?.[0] ?? exported.declarations?.[0];
    const name = exported.getName();
    const sourceFile = declaration?.getSourceFile();
    const declarationPath = sourceFile && sourcePath(sourceFile.fileName);
    const local = declarationPath && !declarationPath.startsWith('..') && !declarationPath.includes('node_modules');
    const line = declaration && sourceFile ? sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).line + 1 : 1;
    const typeOnly = exported.declarations?.some(d => ts.isExportSpecifier(d) && (d.isTypeOnly || d.parent.parent.isTypeOnly));
    const isValue = !typeOnly && !!(actual.flags & ts.SymbolFlags.Value);
    const kind = actual.flags & ts.SymbolFlags.Class ? 'class'
      : actual.flags & ts.SymbolFlags.Interface ? 'interface'
      : actual.flags & ts.SymbolFlags.TypeAlias ? 'type'
      : actual.flags & ts.SymbolFlags.Enum ? 'enum'
      : actual.flags & ts.SymbolFlags.Function ? 'function' : isValue ? 'value' : 'type';
    const key = `${entry.package}:${name}:${declarationPath}`;
    if (!rows.has(key)) rows.set(key, {
      name, package: entry.package, kind,
      source: local ? `${declarationPath}#L${line}` : null,
      imports: [],
    });
    rows.get(key).imports.push({path: entry.path, guide: docRoute(entry.guide)});
  }
}
const symbols = [...rows.values()].sort((a, b) => a.package.localeCompare(b.package, 'en') || a.name.localeCompare(b.name, 'en'));
for (const row of symbols) row.imports.sort((a, b) => a.path.localeCompare(b.path, 'en'));
const data = {
  revision,
  packages: packages.sort(),
  entryPoints: entries.map(({path, guide, kind, source}) => ({path, guide: docRoute(guide), ...(kind ? {kind, source: sourcePath(source)} : {})})).sort((a, b) => a.path.localeCompare(b.path, 'en')),
  symbols,
};
// Read the same code blocks that Lumen publishes, including nested directives.
const publicNames = new Map(entries.map(entry => [entry.path, new Set()]));
for (const symbol of symbols) {
  for (const entry of symbol.imports) publicNames.get(entry.path).add(symbol.name);
}
const imports = new Set();
const examplePages = new Set();
const problems = [];
for (const [file, text] of corpus) {
  for (const example of platformExamples(text, file)) {
    for (const statement of example.imports) {
      const path = statement.moduleSpecifier.text;
      const line = example.line + example.source.getLineAndCharacterOfPosition(statement.getStart()).line;
      const exported = publicNames.get(path);
      examplePages.add(file);
      if (!exported) {
        problems.push(`${file}:${line} — missing entry point ${path}`);
        continue;
      }
      const bindings = statement.importClause?.namedBindings;
      const names = bindings && ts.isNamedImports(bindings) ? bindings.elements.map(name => (name.propertyName ?? name.name).text) : [];
      if (statement.importClause?.name) names.push('default');
      for (const name of names) {
        if (exported.has(name)) imports.add(`${path}:${name}`);
        else problems.push(`${file}:${line} — ${path} does not export ${name}`);
      }
    }
  }
}
if (problems.length) throw Error(problems.join('\n'));
console.log(`${imports.size} distinct example imports verified across ${examplePages.size} published pages`);
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
