import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, process.env.LUMEN_OUT_DIR || 'build');
const baseline = JSON.parse(readFileSync(join(root, 'migration/url-contract.json'), 'utf8'));
const pages = new Map();
const failures = [];
function scan(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, item.name);
    if (item.isDirectory()) scan(file);
    else if (item.name.endsWith('.html')) {
      const html = readFileSync(file, 'utf8');
      let route = '/' + relative(output, file).replace(/\\/g, '/').replace(/\.html$/, '').replace(/\/index$/, '');
      if (route === '/index') route = '/';
      const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
      const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
      if (duplicates.length) failures.push(`${route}: duplicate ids ${[...new Set(duplicates)].join(', ')}`);
      pages.set(route, { html, ids: new Set(ids) });
    }
  }
}
scan(output);
let anchors = 0;
for (const [route, contract] of Object.entries(baseline.routes)) {
  const page = pages.get(route);
  if (!page) { failures.push(`Missing original route: ${route}`); continue; }
  for (const anchor of contract.anchors) {
    anchors++;
    if (!page.ids.has(anchor)) failures.push(`Missing original anchor: ${route}#${anchor}`);
  }
}
let links = 0;
for (const [route, { html }] of pages) {
  for (const [, attr, raw] of html.matchAll(/\b(href|src)="([^"]+)"/g)) {
    if (!raw || raw.startsWith('//') || /^(?:mailto|tel|data):/.test(raw)) continue;
    const url = new URL(raw.replaceAll('&amp;', '&'), `https://omnitron.dev${route}`);
    if (url.origin !== 'https://omnitron.dev') continue;
    links++;
    const path = decodeURIComponent(url.pathname).replace(/\/$/, '') || '/';
    const target = pages.get(path);
    if (target) {
      if (url.hash && !target.ids.has(decodeURIComponent(url.hash.slice(1)))) failures.push(`${route}: broken anchor ${raw}`);
    } else if (!existsSync(join(output, path))) failures.push(`${route}: missing ${attr} ${raw}`);
  }
}
console.log(`${pages.size} generated pages; ${Object.keys(baseline.routes).length} original routes; ${anchors} original anchors; ${links} local links/assets checked`);
for (const failure of failures) console.error(failure);
if (failures.length) process.exitCode = 1;
