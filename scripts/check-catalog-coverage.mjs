#!/usr/bin/env node
/**
 * A page that catalogues a subpath's exports must name all of them.
 *
 * `@omnitron-dev/prism/hooks` exports 48 hooks; the catalog named 27 and the
 * overview said "25+". Nothing was false — the missing hooks simply could not
 * be found, which is the failure mode no other checker here detects. The
 * others verify that what the docs SAY is true; this one asks whether what the
 * code DOES is said.
 *
 *   node scripts/check-catalog-coverage.mjs ../omni
 *
 * Exits non-zero on an export no page names, and on its own failure to
 * extract.
 */

import fs from 'node:fs';
import path from 'node:path';

const repo = process.argv[2];
if (!repo) {
  console.error('usage: node scripts/check-catalog-coverage.mjs <path-to-omni-repo>');
  process.exit(2);
}

/**
 * Each pair is (barrel file, page that catalogues it, what to match).
 *
 * `only` exists because a barrel re-exports types and helpers alongside the
 * things a catalogue is about; demanding a page name `UseArrayReturn` would be
 * demanding the wrong thing.
 */
const CATALOGUES = [
  {
    barrel: 'packages/prism/src/hooks/index.ts',
    page: 'docs/frontend/prism/hooks-catalog.md',
    only: /^use[A-Z][A-Za-z0-9]*$/,
    label: 'prism hooks',
  },
];

/** Named exports of a barrel: `export { a, b as c } from …` and direct declarations. */
function barrelExports(source, only) {
  const names = new Set();
  for (const block of source.matchAll(/export\s*\{([^}]*)\}\s*from/gs)) {
    // Line comments first. A grouped barrel writes
    //
    //   export {
    //     // State Management
    //     useBoolean,
    //
    // and splitting on commas hands the comment and the name that follows it
    // to the same iteration, so the name fails the identifier test and is
    // dropped in silence. Seven were, here, five of them undocumented — and
    // the checker reported the page complete, because a lost name is a name
    // it never asks about.
    const body = block[1].replace(/\/\/[^\n]*/g, '');
    for (const part of body.split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name && only.test(name)) names.add(name);
    }
  }
  for (const m of source.matchAll(/export\s+(?:function|const|class)\s+([A-Za-z0-9_]+)/g)) {
    if (only.test(m[1])) names.add(m[1]);
  }
  return names;
}

/**
 * Names the page mentions inside code markup.
 *
 * Deliberately matches a PREFIX inside the backticks, not the whole span:
 * headings are written `` `useArray<T>` ``, and a whole-span match reports a
 * hook with a documented section of its own as undocumented. That was this
 * checker's first result — two of the four "missing" hooks were the two at the
 * top of the page.
 */
function namesOnPage(markdown, only) {
  const names = new Set();
  for (const m of markdown.matchAll(/`([A-Za-z0-9_]+)/g)) {
    if (only.test(m[1])) names.add(m[1]);
  }
  return names;
}

let failures = 0;
for (const cat of CATALOGUES) {
  const barrelPath = path.join(repo, cat.barrel);
  const pagePath = path.join(import.meta.dirname, '..', cat.page);
  for (const p of [barrelPath, pagePath]) {
    if (!fs.existsSync(p)) {
      console.error(`missing: ${p}`);
      process.exit(2);
    }
  }

  const barrelSource = fs.readFileSync(barrelPath, 'utf8');
  const exported = barrelExports(barrelSource, cat.only);
  const page = fs.readFileSync(pagePath, 'utf8');
  const named = namesOnPage(page, cat.only);

  /**
   * Every extracted name must appear VERBATIM in the text it came from.
   *
   * A checker that mangles its input reports invented symbols and reports them
   * confidently — a peer's `lstrip('type ')` stripped the CHARACTER SET
   * {t,y,p,e,space} rather than the prefix, so `percentOf` came out as
   * `rcentOf` and was duly reported as undocumented. Nothing above catches
   * that: extraction was non-empty, and a hand-picked control name survives
   * unless it happens to start with an affected character.
   *
   * This does, for any mangling, because it tests the property that matters
   * rather than an example of it: a name that is not in the source is a name
   * this checker made up.
   */
  /**
   * And the other direction, which the invariant below cannot see.
   *
   * "Every extracted name is in the source" catches a checker that INVENTS.
   * It says nothing about one that LOSES, and for a checker that reports
   * absence, losing is the dangerous direction: fewer names extracted means
   * fewer questions asked means a greener report. Every threshold guard here
   * is gross — it catches losing most, never losing seven.
   *
   * So cross-check against a deliberately naive second reading: every token
   * shaped like a hook, anywhere in the barrel, must either have been
   * extracted or be excluded for a reason that can be stated. The only
   * legitimate exclusion is a mention in a comment, which is why the comments
   * are stripped for this pass too and compared against the same stripped
   * text.
   */
  const withoutComments = barrelSource.replace(/\/\/[^\n]*/g, '');
  const naive = new Set(
    [...withoutComments.matchAll(/\b[A-Za-z_][A-Za-z0-9_]*\b/g)].map((m) => m[0]).filter((n) => cat.only.test(n))
  );
  const lost = [...naive].filter((n) => !exported.has(n));
  if (lost.length > 0) {
    console.error(
      `the checker is broken, not the docs: a plain scan of ${cat.barrel} finds ` +
        `${lost.slice(0, 6).join(', ')}${lost.length > 6 ? ` and ${lost.length - 6} more` : ''}, ` +
        'which the export parse did not extract'
    );
    process.exit(2);
  }

  const invented = [...exported].filter((n) => !barrelSource.includes(n));
  if (invented.length > 0) {
    console.error(
      `the checker is broken, not the docs: it extracted ${invented
        .slice(0, 5)
        .map((n) => `\`${n}\``)
        .join(', ')}, which do not appear in ${cat.barrel}`
    );
    process.exit(2);
  }

  // A zero must be able to mean only "agrees", never "the extraction broke".
  if (exported.size < 10) {
    console.error(`the checker is broken, not the docs: only ${exported.size} exports read from ${cat.barrel}`);
    process.exit(2);
  }

  // The generic trap, as a control rather than a comment: a heading written
  // with a type parameter must still count as naming the hook.
  const generic = namesOnPage('### `useSomething<T>`', /^use[A-Z][A-Za-z0-9]*$/);
  if (!generic.has('useSomething')) {
    console.error('the checker is broken: a name written with a generic was not recognised');
    process.exit(2);
  }
  // And a planted export must be reported.
  const planted = barrelExports("export { usePlantedControlHook } from './x.js';", cat.only);
  if (!planted.has('usePlantedControlHook') || named.has('usePlantedControlHook')) {
    console.error('the checker is broken: a planted export was not reported as missing');
    process.exit(2);
  }
  console.log(`control ok — a generic heading counts, and a planted export is reported (${cat.label})`);

  const missing = [...exported].filter((n) => !named.has(n)).sort();
  for (const n of missing) {
    console.error(`${cat.page} does not name \`${n}\`, exported from ${cat.barrel}`);
    failures++;
  }
  if (missing.length === 0) {
    console.log(`ok — all ${exported.size} ${cat.label} are named on the page`);
  }
}

process.exit(failures > 0 ? 1 : 0);
