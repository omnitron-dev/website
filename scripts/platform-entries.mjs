import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import catalog from './api-guides.mjs';

export function platformEntries(repo, root) {
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
        const mapping = guides[key];
        const guide = typeof mapping === 'string' ? mapping : mapping?.guide;
        if (!guide || !existsSync(join(root, 'docs', guide))) throw new Error(`Missing guide: ${pkg.name}${key} → ${guide}`);
        const entry = exports[key];
        const target = typeof entry === 'string' ? entry : entry.types ?? entry.import?.types ?? entry.import ?? entry.default;
        if (typeof target !== 'string') throw new Error(`Unrecognised export target: ${pkg.name}${key}`);
        // Stylesheets are public entry points too, but not TypeScript modules.
        // A bundled asset needs an explicit source mapping: guessing index.css's
        // source would confuse generated output with the authored stylesheet.
        if (target.endsWith('.css')) {
          const source = mapping?.assetSource && resolve(base, mapping.assetSource);
          if (!source || !source.startsWith(base + '/') || !source.endsWith('.css') || !existsSync(source)) {
            throw new Error(`Missing stylesheet source for ${pkg.name}${key}`);
          }
          entries.push({package: pkg.name, path: `${pkg.name}/${key.slice(2)}`, source, guide, kind: 'stylesheet'});
          continue;
        }
        const stem = target.replace(/^(?:\.\/)?dist\//, './src/').replace(/\.d\.ts$/, '.ts').replace(/\.js$/, '.ts');
        const source = [stem, stem.replace(/\.ts$/, '.tsx')].map(p => join(base, p)).find(existsSync);
        if (!source) throw new Error(`No source for ${pkg.name}${key}: ${target}`);
        entries.push({package: pkg.name, path: key === '.' ? pkg.name : `${pkg.name}/${key.slice(2)}`, source, guide});
      }
      packages.push(pkg.name);
    }
  }
  for (const pkg of Object.keys(catalog)) if (!packages.includes(pkg)) throw new Error(`Stale package: ${pkg}`);
  return { entries, packages };
}
