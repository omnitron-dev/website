#!/usr/bin/env node
/**
 * Typecheck the TypeScript examples in the docs against the real packages.
 *
 * The import probe answers "does this name exist". This answers the next
 * question: does the example USE it correctly — right method, right arity,
 * right option keys. Those are the errors an import check cannot see and a
 * reader hits on their first paste.
 *
 * Doc snippets are fragments, so this is deliberately permissive: only errors
 * that indicate a genuine API mismatch are reported. Everything caused by the
 * snippet being a fragment (undeclared locals, missing imports for symbols the
 * prose introduced) is filtered out by code.
 */
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { platformExamples } from './platform-examples.mjs';
import { platformEntries } from './platform-entries.mjs';

const ROOT = path.resolve(process.argv[2] ?? '');
if (!fs.existsSync(path.join(ROOT, 'packages/titan/package.json'))) {
  console.error(
    `not an omni checkout: ${ROOT || '(no path given)'}\n` +
      'usage: node scripts/check-doc-examples.mjs <path-to-omni-repo> <doc dirs…>\n' +
      '   e.g. node scripts/check-doc-examples.mjs "/absolute/path/to/omni-source" docs/titan docs/auth'
  );
  process.exit(2);
}

const ts = createRequire(import.meta.url)('typescript');

function checkableSource(source) {
  const { text, scriptKind, parseDiagnostics } = source;
  if (!parseDiagnostics.length) {
    const hasDeclaration = source.statements.some(statement => ts.isClassDeclaration(statement)
      || ts.isFunctionDeclaration(statement) || statement.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword));
    return hasDeclaration ? text : wrapMethodBody(text);
  }
  const parses = code => !ts.createSourceFile('snippet', code, ts.ScriptTarget.Latest, false, scriptKind).parseDiagnostics.length;
  // Tutorials often show adjacent JSX components as separate alternatives.
  if (scriptKind === ts.ScriptKind.TSX && parseDiagnostics.every(error => error.code === 2657)) {
    let code = text;
    for (const { start, length } of [...parseDiagnostics].reverse()) {
      code = code.slice(0, start) + '<>' + code.slice(start, start + length) + '</>' + code.slice(start + length);
    }
    if (parses(code)) return code;
  }
  // Method, field and constructor excerpts keep their decorators and parameter types.
  const end = source.statements.filter(ts.isImportDeclaration).at(-1)?.end ?? 0;
  const member = text.slice(0, end) + '\nclass Example { [member: string]: any;\n' + text.slice(end) + '\n}';
  if (parses(member)) return member;
}

const DOCS = process.argv.slice(3);
if (DOCS.length === 0) {
  console.error('usage: node scripts/check-doc-examples.mjs <path-to-omni-repo> <doc dirs…>');
  console.error('   e.g. node scripts/check-doc-examples.mjs "/absolute/path/to/omni-source" docs/titan docs/auth');
  process.exit(2);
}

const OUT = fs.mkdtempSync(path.join(tmpdir(), 'omnitron-doc-typecheck-'));
process.on('exit', () => fs.rmSync(OUT, { recursive: true, force: true }));
// Use the source installation for the same JSX and test-library resolution as a consumer.
fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(OUT, 'node_modules'), 'dir');

const files = [];
for (const root of DOCS) {
  if (!fs.existsSync(root)) continue;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.mdx?$/.test(e.name)) files.push(p);
    }
  })(root);
}

/**
 * A snippet that uses `this` outside a class is the body of a method, printed
 * without the class around it. At module scope TypeScript types `this` as
 * `undefined`, so every such line reported TS2532 "Object is possibly
 * 'undefined'" — six of them in this docs tree, none of them a defect in the
 * example.
 *
 * A checker with a known false positive is worse than a stricter one: the
 * response to it becomes skimming, and skimming is what every real finding
 * depends on not happening. So give those snippets the context they were
 * written inside — imports stay at the top, the rest becomes a method body on a
 * class whose members are open. `this.*` was never checkable in a fragment that
 * elides its class; everything else on those lines still is.
 */
function wrapMethodBody(code) {
  const usesThis = /(^|[^\w.$'"`])this\s*\./.test(code.replace(/^\s*(?:import|export)\b.*$/gm, ''));
  if (!usesThis) return code;

  const lines = code.split('\n');
  const head = [];
  let i = 0;
  // An import can span several lines, so consuming only lines that START with
  // `import` cut them in half and produced a syntax error — which tsc reports
  // and then STOPS on, taking the control file's deliberate errors with it. The
  // control caught that immediately, which is the whole reason it exists.
  let insideImport = false;
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (insideImport) {
      head.push(lines[i]);
      if (/\bfrom\s+['"]/.test(t) || t.endsWith(';')) insideImport = false;
      continue;
    }
    if (t === '' || t.startsWith('//')) { head.push(lines[i]); continue; }
    if (/^import\b/.test(t)) {
      head.push(lines[i]);
      if (!/\bfrom\s+['"]/.test(t) && !t.endsWith(';')) insideImport = true;
      continue;
    }
    break;
  }
  if (insideImport) return code; // unterminated — leave the snippet alone
  const body = lines.slice(i);
  return [
    ...head,
    'declare class __DocFragmentHost { [member: string]: any; }',
    'async function __docFragment(this: __DocFragmentHost) {',
    ...body.map((l) => (l.trim() ? `  ${l}` : l)),
    '}',
    'void __docFragment;',
  ].join('\n');
}

// Only blocks that import from the packages — those are the checkable ones.
const cases = [];
const skipped = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const { source, line } of platformExamples(text, file)) {
    if (source.scriptKind !== ts.ScriptKind.TS && source.scriptKind !== ts.ScriptKind.TSX) continue;
    const code = checkableSource(source);
    if (code === undefined) {
      skipped.push(`${file}:${line}`);
      continue;
    }
    const name = `example_${cases.length}.${source.scriptKind === ts.ScriptKind.TSX ? 'tsx' : 'ts'}`;
    cases.push({ file, line, name, code });
    fs.writeFileSync(path.join(OUT, name), code);
  }
}

if (cases.length === 0) {
  console.error('EXTRACTION FAILED: no importing ts blocks found — the probe is broken.');
  process.exit(1);
}

fs.writeFileSync(path.join(OUT, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler',
    lib: ['ES2022', 'DOM'], jsx: 'react-jsx', strict: false, noEmit: true, skipLibCheck: true,
    experimentalDecorators: true, emitDecoratorMetadata: true,
    allowJs: false, noUnusedLocals: false, noImplicitAny: false,
    // No `baseUrl`: TypeScript 7 removed it, and leaving it in is a HARD
    // config error (TS5102) that makes tsc refuse to run at all — which the
    // probe reported as "0 problems across 292 examples". `paths` resolves
    // relative to this tsconfig without it.
    types: [], paths: buildPaths(),
  },
  include: ['*.ts', '*.tsx'],
}, null, 2));

function buildPaths() {
  const reactTypes = path.dirname(createRequire(import.meta.url).resolve('@types/react/package.json'));
  const paths = { react: [path.join(reactTypes, 'index.d.ts')], 'react/jsx-runtime': [path.join(reactTypes, 'jsx-runtime.d.ts')] };
  const styles = [];
  for (const entry of platformEntries(ROOT, path.resolve(import.meta.dirname, '..')).entries) {
    if (entry.kind === 'stylesheet') styles.push(`declare module '${entry.path}';`);
    else paths[entry.path] = [entry.source];
  }
  fs.writeFileSync(path.join(OUT, 'styles.d.ts'), styles.join('\n'));
  return paths;
}

// Fail independently when method names, arity or JSX props stop resolving.
const CONTROL = '__control__.tsx';
fs.writeFileSync(path.join(OUT, CONTROL), [
  "import { Errors } from '@omnitron-dev/titan/errors';",
  "import { ProviderStack } from '@omnitron-dev/prism/core';",
  "export const arity = Errors.badRequest('m', {}, 'extra', 'args');",
  'export const member = Errors.noSuchFactory();',
  'export const props = <ProviderStack providers={123}><div /></ProviderStack>;',
].join('\n'));

// Use the compiler installed by the source checkout's lockfile, including aliases.
const sourceRequire = createRequire(path.join(ROOT, 'package.json'));
const { devDependencies } = sourceRequire('./package.json');
const compiler = devDependencies?.['@typescript/native'] ? '@typescript/native' : 'typescript';
const manifest = sourceRequire.resolve(`${compiler}/package.json`);
const { bin } = sourceRequire(manifest);
const tsc = path.resolve(path.dirname(manifest), bin.tsc ?? bin.tsc6);
let raw = '';
try {
  raw = execFileSync(process.execPath, [tsc, '--pretty', 'false', '-p', path.join(OUT, 'tsconfig.json')], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  raw = (e.stdout || '') + (e.stderr || '');
}

// A fragment can refer to application code and globals supplied by its surrounding project.
const FRAGMENT = new Set([
  '2304', // Cannot find name — an undeclared local from the prose
  '2307', // Cannot find module — a made-up app path like '../src/app.module.js'
  '2503', // Cannot find namespace
  '2552', // Cannot find name, did you mean
  '2580', // Cannot find name 'process'
  '2868', // Cannot find name 'Bun' — same class as the two above, for the
          // runtime-specific snippets on the cross-runtime pages./'require'
  '2688', // Cannot find type definition file
  '7016', // implicitly has an 'any' type (untyped import)
  '1208', // isolatedModules
  '6133', // declared but never read
  // "API surface" blocks list signatures with no bodies on purpose — a
  // documentation style, not a defect.
  '2390', // Constructor implementation is missing
  '2391', // Function implementation is missing
  '2591', // Node globals in fragments without @types/node
  // A fragment's locals are frequently `unknown` because the prose, not the
  // code, said what they were.
  '2571', // Object is of type 'unknown'
  // Test snippets use the runner's globals, which this harness does not load.
  // TS2593 is raised ONLY for those names (it is the diagnostic that suggests
  // @types/jest or @types/mocha), so ignoring it costs no coverage of the API
  // surface — and leaving it in buried real findings under describe/it/beforeEach.
  '2593', // Cannot find name 'describe' / 'it' / 'beforeEach' — test runner globals
]);

const byCase = new Map();
for (const line of raw.split('\n')) {
  const m = line.match(/^(.+?)\((\d+),(\d+)\): error TS(\d+): (.*)$/);
  if (!m) continue;
  const [, file, ln, , code, msg] = m;
  if (FRAGMENT.has(code) && !(code === '2307' && msg.includes("'@omnitron-dev/"))) continue;
  // TS1xxx are syntax errors. A doc snippet is a fragment — a bare decorator
  // at top level, an elided body — so these say the extraction produced
  // non-compiling text, not that the API is wrong. Only semantic errors
  // (TS2xxx) can mean the example uses the API incorrectly.
  if (code.startsWith("1")) continue;
  const base = path.basename(file);
  if (base === CONTROL) continue;
  const c = cases.find((x) => x.name === base);
  if (!c) continue;
  // "Property 'x' does not exist on type 'T'" where T is declared BY THE
  // SNIPPET is the reader's own elided method — recipes routinely write
  // `await this.deleteExpired()` and leave the body to the reader. Only a
  // missing property on a type from the PACKAGES is an API claim.
  const own = msg.match(/does not exist on type '([A-Za-z_$][\w$]*)'/);
  if (own && new RegExp(`\\b(class|interface|type)\\s+${own[1]}\\b`).test(c.code)) continue;
  // Same for locals the prose typed and the snippet left as `unknown`.
  if (/on type 'unknown'/.test(msg)) continue;
  // `import.meta.env` is Vite's, injected by the bundler through
  // `vite/client` — the same class as `Buffer` and `process` above, which
  // this harness also does not load. Narrowed to `ImportMeta` rather than
  // added to the blanket TS2339 ignore, because that code is the one that
  // catches a real wrong method name.
  if (/does not exist on type 'ImportMeta'/.test(msg)) continue;
  if (!byCase.has(base)) byCase.set(base, { c, errors: [] });
  byCase.get(base).errors.push(`    L${ln}  TS${code}: ${msg}`);
}

const controlErrors = raw
  .split('\n')
  .filter((l) => l.includes(CONTROL) && /error TS2\d+/.test(l));
const CONTROL_EXPECTED = ['TS2554', 'TS2339', 'TS2322'];
const controlCodes = [...new Set(controlErrors.map((l) => (l.match(/error (TS\d+)/) ?? [])[1]).filter(Boolean))].sort();
const controlMissing = CONTROL_EXPECTED.filter((c) => !controlCodes.includes(c));
if (controlMissing.length > 0) {
  console.error(
    `CONTROL FAILED: got [${controlCodes.join(', ') || 'nothing'}], expected [${CONTROL_EXPECTED.join(', ')}].\n` +
      (controlCodes.length === 0
        ? 'The packages are not resolving, so every result below would be a false clean.'
        : `${controlMissing.join(', ')} stopped being reported — this probe now checks less than it claims.`)
  );
  process.exit(1);
}
console.log(`control ok — deliberate errors [${controlCodes.join(', ')}] detected as expected\n`);

let reported = 0;
for (const { c, errors } of [...byCase.values()].sort((a, b) => a.c.file.localeCompare(b.c.file))) {
  console.log(`${path.relative(process.cwd(), c.file)}:${c.line}`);
  for (const e of errors.slice(0, 6)) console.log(e);
  reported += errors.length;
}
if (reported || skipped.length) process.exitCode = 1;
if (skipped.length) console.log('Incomplete fragments:', skipped.join(', '));
console.log(`\n${cases.length} importing examples typechecked (${skipped.length} incomplete fragments); ${byCase.size} with API-shaped errors (${reported} total)`);
