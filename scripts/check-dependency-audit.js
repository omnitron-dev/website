import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

const advisoryId = 'GHSA-fc5q-39xc-vjpf';
const paths = ['>picomatch', '>tinyglobby>fdir>picomatch', '>tinyglobby>picomatch']
  .map(suffix => '.>vite' + suffix).sort();
const permittedAdvisory = {
  id: 1247710, title: 'picomatch vulnerable to ReDoS through single-branch repeated extglobs',
  module_name: 'picomatch', github_advisory_id: advisoryId, url: 'https://github.com/advisories/' + advisoryId,
  vulnerable_versions: '<=4.0.7', patched_versions: null, patched_versions_unpublished: true,
  severity: 'high', cwe: 'CWE-1333',
  findings: [{ version: '4.0.7', paths, dev: false, optional: false, bundled: false }],
};
const counts = { info: 0, low: 0, moderate: 0, high: 1, critical: 0 };

// SHA-256 of the reviewed distribution, including every entry point and package metadata.
const files = {
  LICENSE: 'd0cd141b0c322fded5dfad1d4645bb2fedfc05b7321fe1009469638190d59ef9',
  'README.md': 'a69b87120fe2b9cb8f9057eaef6b9f9887f803e02185ca2f431e8162f6312220',
  'index.js': '02ae26406508e28f9ba0865be16cf77f0b33de6c4d4d49c212c4176df1d5625a',
  'lib/constants.js': 'c28f952d2758261fe5428a121add485cc25b03e0193633f649de903dc0e5e222',
  'lib/parse.js': '5c59ac7e1f7d43917b7f6419d79dfc7d62a9a53ecd2c67183180497455de0fd5',
  'lib/picomatch.js': 'fdd249d7ffff853f3bb1c77eafc8baa1a437bea85a94c35877b83c6a40d9ca94',
  'lib/scan.js': '6457a1764e5c2e543cc3a0c00ce12ebb3764097628868198370b64d4e642aaae',
  'lib/utils.js': 'f04604f70cd1a3f6ace80b84766468674ff38b4bb83818d2ef1d81fc6355f935',
  'package.json': '479b70b87aa7b44344d62c8a459ae7e53dd2bca6c61f1396bd55e63e9de73fc6',
  'posix.js': '5695ff5dfcd5a338a40630bd506056f2950bcb08fe1cc068519cbbfe60add480',
};

export function checkReport(report, exitCode) {
  assert.deepEqual(Object.keys(report).sort(), ['advisories', 'metadata']);
  if (Object.keys(report.advisories).length === 0) {
    assert.equal(exitCode, 0, 'An empty audit must have a successful exit status');
    assert.deepEqual(report.advisories, {});
    assert.deepEqual(report.metadata.vulnerabilities,
      { info: 0, low: 0, moderate: 0, high: 0, critical: 0 });
  } else {
    assert.equal(exitCode, 1, 'A finding must have the audit failure exit status');
    assert.deepEqual(Object.keys(report.advisories), [String(permittedAdvisory.id)]);
    const actual = report.advisories[permittedAdvisory.id];
    const findings = actual.findings.map(finding => ({ ...finding, paths: [...finding.paths].sort() }));
    assert.deepEqual({ ...actual, findings }, permittedAdvisory);
    assert.deepEqual(report.metadata.vulnerabilities, counts);
  }
  const categories = ['dependencies', 'devDependencies', 'optionalDependencies'].map(key => {
    const count = report.metadata[key];
    assert.ok(Number.isSafeInteger(count) && count >= 0, 'Invalid audit package count (' + key + ')');
    return count;
  });
  // Dependency categories can overlap; their sum is not the unique package count.
  const total = report.metadata.totalDependencies;
  assert.ok(Number.isSafeInteger(total) && total > 0, 'Invalid total audit package count');
  assert.ok(total >= Math.max(...categories) && total <= categories.reduce((sum, count) => sum + count, 0),
    'Total audit package count is outside its category bounds');
}

function from(parent, name) {
  return createRequire(parent.resolve(name));
}
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const matcherRoot = loader => dirname(realpathSync(loader.resolve('picomatch/package.json')));
const inside = (path, root) => path === root || path.startsWith(root + sep);

// pnpm's physical virtual store can live outside the checkout. Bundled dependencies
// live inside published packages and need not have their own lockfile entries.
function installedMatchers(modules) {
  const layout = readJson(join(modules, '.modules.yaml'));
  assert.equal(layout.nodeLinker, 'isolated');
  const roots = [modules, realpathSync(resolve(modules, layout.virtualStoreDir))];
  const visited = new Set(), matches = new Set();
  function scan(directory) {
    if (visited.has(directory)) return;
    visited.add(directory);
    const inModules = basename(directory) === 'node_modules';
    const inScope = basename(directory).startsWith('@') && basename(dirname(directory)) === 'node_modules';
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const packageSlot = inScope || (inModules && !entry.name.startsWith('.') && !entry.name.startsWith('@'));
      const linked = entry.isSymbolicLink() && (packageSlot || entry.name === 'node_modules' || (inModules && entry.name.startsWith('@')));
      if (!entry.isDirectory() && !linked) continue;
      const real = linked ? realpathSync(path) : path;
      assert.ok(roots.some(root => inside(real, root)), 'Uninventoried dependency link: ' + path);
      if (packageSlot && (entry.name === 'picomatch' || existsSync(join(real, 'package.json')))) {
        const name = readJson(join(real, 'package.json')).name;
        if (entry.name === 'picomatch') assert.equal(name, 'picomatch', path);
        if (name === 'picomatch') matches.add(real);
      }
      scan(real);
    }
  }
  for (const root of roots) scan(root);
  return matches;
}

export function checkInstalled(root) {
  const loader = createRequire(resolve(root, 'package.json'));
  const vite = matcherRoot(from(loader, 'vite'));
  const bundled = matcherRoot(from(from(loader, '@omnitron-dev/lumen'), 'vite'));
  const expected = new Set([vite, bundled]);
  assert.equal(expected.size, 2, 'Expected separate site Vite and bundled Lumen copies');
  const installed = installedMatchers(realpathSync(join(root, 'node_modules')));
  for (const directory of installed) {
    assert.ok(expected.has(directory), 'Unexpected picomatch installation: ' + directory);
  }
  for (const directory of expected) {
    assert.ok(installed.has(directory), 'Missing picomatch installation: ' + directory);
  }
  for (const directory of expected) {
    const actual = {};
    for (const entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
      if (entry.isDirectory()) continue;
      const path = join(entry.parentPath, entry.name);
      assert.ok(entry.isFile(), 'Unexpected non-file in picomatch: ' + path);
      actual[relative(directory, path).split(sep).join('/')] = createHash('sha256').update(readFileSync(path)).digest('hex');
    }
    assert.deepEqual(actual, files, 'Unreviewed picomatch files in ' + directory);
  }
  return [...expected];
}

if (import.meta.main) {
  const result = spawnSync('pnpm', ['audit', '--audit-level', 'low', '--json'], {
    encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.signal) throw Error('pnpm audit terminated by ' + result.signal);
  checkReport(JSON.parse(result.stdout), result.status);
  for (const path of checkInstalled(process.cwd())) console.log('Verified picomatch backport at ' + path);
}
