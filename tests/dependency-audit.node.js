import assert from 'node:assert/strict';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { checkInstalled, checkReport } from '../scripts/check-dependency-audit.js';

const known = {
  advisories: { '1247710': {
    findings: [{
      version: '4.0.7', dev: false, optional: false, bundled: false, paths: [
        '.>vite>tinyglobby>picomatch', '.>vite>tinyglobby>fdir>picomatch', '.>vite>picomatch',
        '.>@omnitron-dev/lumen>vite>picomatch', '.>@omnitron-dev/lumen>vite>tinyglobby>fdir>picomatch',
        '.>@omnitron-dev/lumen>vite>tinyglobby>picomatch',
      ],
    }],
    id: 1247710, title: 'picomatch vulnerable to ReDoS through single-branch repeated extglobs',
    module_name: 'picomatch', vulnerable_versions: '<=4.0.7', patched_versions: null, patched_versions_unpublished: true,
    severity: 'high', cwe: 'CWE-1333', github_advisory_id: 'GHSA-fc5q-39xc-vjpf',
    url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf',
  } },
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 },
    dependencies: 561, devDependencies: 27, optionalDependencies: 93, totalDependencies: 681 },
};

test('recognizes only the reported version, advisory, paths and severity counts', () => {
  checkReport(known, 1);
  for (const change of [
    report => { report.advisories['99'] = { severity: 'low', module_name: 'another-package' }; },
    report => { report.metadata.vulnerabilities.low = 1; },
    report => { report.advisories['1247710'].github_advisory_id = 'GHSA-unknown'; },
    report => { report.advisories['1247710'].patched_versions = '4.0.8'; },
    report => { report.advisories['1247710'].findings[0].version = '4.0.6'; },
    report => { report.advisories['1247710'].findings[0].paths.push('.>new-consumer>picomatch'); },
  ]) {
    const report = structuredClone(known);
    change(report);
    assert.throws(() => checkReport(report, 1));
  }
  assert.throws(() => checkReport({ error: { code: 'ENOTFOUND' } }, 1));
  assert.throws(() => checkReport({ advisories: {}, metadata: {} }, 0));
  assert.throws(() => checkReport(known, 2));
});

test('both installed distributions support the site glob syntax after verification', () => {
  const require = createRequire(import.meta.url);
  const installed = checkInstalled(process.cwd());
  assert.equal(installed.length, 2);
  for (const directory of installed) {
    const match = require(directory);
    assert.equal(match.isMatch('docs/intro/guide.mdx', 'docs/**/*.{md,mdx}'), true);
    assert.equal(match.isMatch('docs/intro/guide.ts', 'docs/**/*.{md,mdx}'), false);
    assert.equal(match.isMatch('ui/docsdocs.svg', 'ui/+(docs|art).svg'), true);
    assert.equal(match.isMatch('ui/art.svg', 'ui/@(docs|art).svg'), true);
    const unsupported = /Repeated extglobs require literal alternatives/;
    assert.throws(() => match.parse('+(release notes)'), unsupported);
    assert.throws(() => match.makeRe('+(docs|design)'), unsupported);
  }
});

function fixture(t) {
  const tmp = mkdtempSync(join(tmpdir(), 'website-picomatch-'));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const site = join(tmp, 'site'), modules = join(site, 'node_modules'), store = join(tmp, 'external-store');
  const project = createRequire(resolve('package.json'));
  const seed = dirname(createRequire(project.resolve('vite')).resolve('picomatch/package.json'));
  const pkg = (parent, name) => {
    const dir = join(parent, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, main: 'index.js' }));
    writeFileSync(join(dir, 'index.js'), '');
    return dir;
  };
  const vite = pkg(join(store, 'vite@8.3.8', 'node_modules'), 'vite');
  const outer = join(store, 'picomatch@4.0.7', 'node_modules', 'picomatch');
  cpSync(seed, outer, { recursive: true });
  symlinkSync(outer, join(dirname(vite), 'picomatch'), 'dir');
  pkg(modules, '@omnitron-dev/lumen');
  pkg(modules, '@omnitron-dev/lumen-ui');
  symlinkSync(vite, join(modules, 'vite'), 'dir');
  const kb = pkg(modules, '@omnitron-dev/kb');
  const deps = join(kb, 'node_modules');
  for (const name of ['ts-morph', '@ts-morph/common', 'tinyglobby']) pkg(deps, name);
  const bundled = join(deps, 'picomatch');
  cpSync(seed, bundled, { recursive: true });
  writeFileSync(join(modules, '.modules.yaml'), JSON.stringify({ nodeLinker: 'isolated', virtualStoreDir: '../../external-store' }));
  return { site, bundled, outer, store };
}

test('custom virtual store, nested bundle and third unreferenced or aliased copies', t => {
  const { site, bundled, outer, store } = fixture(t);
  assert.equal(checkInstalled(site).length, 2);
  for (const destination of [
    join(store, 'unreferenced', 'node_modules', 'picomatch'),
    join(bundled, 'fixtures', 'node_modules', 'alternate-name'),
  ]) {
    cpSync(outer, destination, { recursive: true });
    assert.throws(() => checkInstalled(site));
    rmSync(destination, { recursive: true });
  }
});

test('changing either installed parser or another package entry fails verification', t => {
  const { site, outer, bundled } = fixture(t);
  for (const [path, clean] of [[outer, bundled], [bundled, outer]]) {
    for (const file of ['lib/parse.js', 'index.js']) {
      appendFileSync(join(path, file), '\n// Different bytes\n');
      assert.throws(() => checkInstalled(site), /Unreviewed picomatch files/);
      cpSync(join(clean, file), join(path, file));
    }
  }
});
