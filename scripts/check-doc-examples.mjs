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
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = path.resolve(process.argv[2] ?? '');
if (!fs.existsSync(path.join(ROOT, 'packages/titan/package.json'))) {
  console.error(
    `not an omni checkout: ${ROOT || '(no path given)'}\n` +
      'usage: node scripts/check-doc-examples.mjs <path-to-omni-repo> <doc dirs…>\n' +
      '   e.g. node scripts/check-doc-examples.mjs ../omni docs/titan docs/auth'
  );
  process.exit(2);
}

// TS 5.9 from the store: TypeScript 7 no longer exposes the compiler API to JS,
// and this is only used to PARSE snippets, never to check them.
const ts = createRequire(import.meta.url)(
  path.join(ROOT, 'node_modules/.pnpm/typescript@5.9.3/node_modules/typescript')
);

/**
 * Does this snippet parse at all?
 *
 * Doc examples are fragments — a bare decorator at top level, an elided body,
 * a `…` placeholder. tsc reports their syntax errors and then STOPS: a program
 * with any parse error gets no semantic checking at all. So a single malformed
 * snippet silenced the type checking of all 292, and the probe called that
 * "no problems found". Drop the unparseable ones and check the rest.
 */
function parses(code) {
  const sf = ts.createSourceFile('s.ts', code, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  return (sf.parseDiagnostics ?? []).length === 0;
}

const DOCS = process.argv.slice(3);
if (DOCS.length === 0) {
  console.error('usage: node scripts/check-doc-examples.mjs <path-to-omni-repo> <doc dirs…>');
  console.error('   e.g. node scripts/check-doc-examples.mjs . docs/titan docs/auth');
  process.exit(2);
}

const OUT = '/tmp/doc-typecheck';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

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
let skipped = 0;
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  let i = 0;
  for (const m of text.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/g)) {
    const code = m[1];
    if (!/from '@omnitron-dev\//.test(code)) continue;
    if (/^\s*\/\/\s*…|\.\.\./m.test(code) && code.split('\n').length < 6) continue;
    const line = text.slice(0, m.index).split('\n').length;
    if (!parses(code)) { skipped++; continue; }
    // Name from the FULL relative path, not the basename. With basenames,
    // titan/application/index.md and testing/index.md both produced
    // "index__0.ts": the second write clobbered the first (so one snippet was
    // never checked while the count still claimed it was), and findings were
    // attributed by `cases.find(name)` to whichever page came first. Eleven
    // basenames collide in this docs tree.
    const name = `${path.relative(process.cwd(), f).replace(/\.mdx?$/, '').replace(/[^A-Za-z0-9]+/g, '_')}__${i++}.ts`;
    if (cases.some((c) => c.name === name)) {
      console.error(`NAME COLLISION: ${name} — two snippets would share one file. Aborting.`);
      process.exit(2);
    }
    cases.push({ file: f, line, name, code });
    fs.writeFileSync(path.join(OUT, name), wrapMethodBody(code));
  }
}

if (cases.length === 0) {
  console.error('EXTRACTION FAILED: no importing ts blocks found — the probe is broken.');
  process.exit(1);
}

fs.writeFileSync(path.join(OUT, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler',
    lib: ['ES2022', 'DOM'], strict: false, noEmit: true, skipLibCheck: true,
    experimentalDecorators: true, emitDecoratorMetadata: true,
    allowJs: false, noUnusedLocals: false, noImplicitAny: false,
    // No `baseUrl`: TypeScript 7 removed it, and leaving it in is a HARD
    // config error (TS5102) that makes tsc refuse to run at all — which the
    // probe reported as "0 problems across 292 examples". `paths` resolves
    // relative to this tsconfig without it.
    types: [], paths: buildPaths(),
  },
  include: ['*.ts'],
}, null, 2));

/**
 * One path entry per real entry point, read from each package's `exports`.
 *
 * The first version used a single wildcard entry mapping every specifier to
 * the package's own index, which sends `@omnitron-dev/titan/errors` to a
 * nested path under the package that does not exist. Every import failed to
 * resolve, everything downstream became `any`, and the probe reported zero
 * problems across 292 examples while checking nothing at all. The
 * fail-on-empty guard did not catch it because the EXAMPLES extracted fine;
 * what was empty was the resolved API surface. Guard the thing you measure,
 * not the thing you read.
 */
function buildPaths() {
  const paths = {};
  const pkgRoot = path.join(ROOT, 'packages');
  for (const dir of fs.readdirSync(pkgRoot)) {
    const pjPath = path.join(pkgRoot, dir, 'package.json');
    if (!fs.existsSync(pjPath)) continue;
    let pj;
    try { pj = JSON.parse(fs.readFileSync(pjPath, 'utf8')); } catch { continue; }
    if (!pj.name || !pj.exports) continue;
    for (const [sub, val] of Object.entries(pj.exports)) {
      const cands = [];
      const push = (v) => { if (typeof v === 'string') cands.push(v); };
      if (typeof val === 'string') push(val);
      else if (val && typeof val === 'object') {
        for (const k of ['types', 'import', 'require', 'default']) push(val[k]);
        if (val.import && typeof val.import === 'object') for (const k of ['types', 'default']) push(val.import[k]);
      }
      for (const c of cands) {
        const asSrc = path.join(pkgRoot, dir,
          c.replace(/^\.\//, '').replace(/^dist\//, 'src/').replace(/\.(d\.ts|js|mjs|cjs)$/, '.ts'));
        const cand = fs.existsSync(asSrc) ? asSrc
          : fs.existsSync(asSrc.replace(/\.ts$/, '/index.ts')) ? asSrc.replace(/\.ts$/, '/index.ts')
          : null;
        if (cand) {
          paths[sub === '.' ? pj.name : `${pj.name}/${sub.slice(2)}`] = [cand];
          break;
        }
      }
    }
  }
  return paths;
}

/**
 * A control file with two deliberate API errors. If the compiler does not
 * report both, the probe is not resolving the packages and every "clean"
 * result below is meaningless — so that is a hard failure, not a warning.
 */
const CONTROL = '__control__.ts';
fs.writeFileSync(path.join(OUT, CONTROL), [
  "import { Errors } from '@omnitron-dev/titan/errors';",
  "export const a = Errors.badRequest('m', {}, 'extra', 'args');",
  // Was `(Errors as { noSuchFactory?: () => void }).noSuchFactory!()`, which the
  // cast and the `!` made perfectly legal — a control line that could not fail,
  // so the control only ever proved that ARITY checking worked. Member
  // existence is the other half of what this probe looks for, and it was
  // unguarded. Written plainly, it reports TS2339.
  'export const b = Errors.noSuchFactory();',
  '',
].join('\n'));

let raw = '';
try {
  raw = execFileSync('npx', ['tsc', '-p', path.join(OUT, 'tsconfig.json')], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  raw = (e.stdout || '') + (e.stderr || '');
}

// Errors that mean "the example is a fragment", not "the API is wrong".
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
  // Snippets legitimately use Node globals; the harness has no @types/node.
  '2591', // Cannot find name 'Buffer'
  '2580', // Cannot find name 'process'
  '2868', // Cannot find name 'Bun' — same class as the two above, for the
          // runtime-specific snippets on the cross-runtime pages.
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
  if (FRAGMENT.has(code)) continue;
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
// The control file carries exactly this many deliberate errors. Accepting "at
// least one" is how one of the two went unnoticed for as long as it existed:
// the run printed "1 deliberate error(s) detected" on every invocation, next to
// a file with two lines in it, and nobody — including the people maintaining
// this script — read that number as a claim. A control that reports a bare "ok"
// cannot be contradicted; one that prints what it got beside what it expected
// can be.
// Checked by CODE, not by count. The two control lines exercise different
// things — TS2554 is arity, TS2339 is member existence — and a count alone
// passes when one of them stops firing while some unrelated error takes its
// place. That is not hypothetical: this control already spent its whole life
// reporting "1 deliberate error(s)" beside a file with two in it.
const CONTROL_EXPECTED = ['TS2554', 'TS2339'];
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
// Findings are REVIEWED, not gated on. Roughly two thirds of what survives
// the filters is still an artefact of a snippet being a fragment — a local the
// prose typed, a helper the reader is expected to supply — and a check that
// always fails is a check people learn to skip. The one hard failure is the
// control above: if the deliberate errors stop being reported, the packages
// are not resolving and a clean run means nothing.
if (byCase.size > 0) {
  console.log('\nEach finding needs a look: a wrong option name or arity is real,');
  console.log('a missing helper the example deliberately elided is not.');
}
console.log(`\n${cases.length} importing examples typechecked (${skipped} skipped as unparseable fragments); ${byCase.size} with API-shaped errors (${reported} total)`);
