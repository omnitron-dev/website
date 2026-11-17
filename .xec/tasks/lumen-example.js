// Captured API results for the architecture explorer, never a browser build simulation.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Xec supplies the original script directory and explicit step arguments.
const root = resolve(__dirname, '../..');
const writeFixture = args.includes('write');
import {
  defineLumenConfig, loadCorpusFromDirectory, projectCorpus,
  linksGate, anchorsGate, runCorpusGates, buildSearchIndex, generateRouteMirrors,
  generateLlmsTxt,
} from '@omnitron-dev/lumen';
import { toHtmlSsr, toCleanMarkdown } from '@omnitron-dev/lumen-ast';

const sources = {
  'start.md': `---
id: walkthrough/start
slug: /walkthrough/start
title: Shipping a guide
---
# Shipping a guide {#shipping}

Read [verification](./verify.md#acceptance).

:::note{title="Team note" access="internal"}
Coordinate the draft with the team.
:::
`,
  'verify.md': `---
id: walkthrough/verify
slug: /walkthrough/verify
title: Verification
---
# Verification

## Acceptance {#acceptance}

Check the published page, its links and its Markdown mirror.
`,
};
const config = defineLumenConfig({
  title: 'Pipeline example', tagline: 'A two-document teaching corpus.',
  url: 'https://example.invalid', srcDir: 'docs', outDir: 'build',
  onBrokenLinks: 'throw', onBrokenAnchors: 'throw',
});
const temporary = await mkdtemp(join(tmpdir(), 'lumen-pipeline-'));
try {
  await mkdir(join(temporary, 'docs'));
  for (const [name, source] of Object.entries(sources)) await writeFile(join(temporary, 'docs', name), source);
  const { graph, astDiagnostics } = await loadCorpusFromDirectory(temporary, config);
  assert.deepEqual(astDiagnostics, []);
  const run = corpus => runCorpusGates({ documents: corpus.getAllDocuments(), graph: corpus, config, reportDiagnostic() {} }, [linksGate, anchorsGate]);
  const valid = await run(graph);
  assert.equal(valid.passed, true);
  const brokenSource = sources['start.md'].replace('./verify.md#acceptance', './missing.md#acceptance');
  await writeFile(join(temporary, 'docs', 'start.md'), brokenSource);
  const { graph: brokenGraph, astDiagnostics: brokenParsing } = await loadCorpusFromDirectory(temporary, config);
  assert.deepEqual(brokenParsing, []);
  const broken = await run(brokenGraph);
  assert.equal(broken.passed, false);
  assert(broken.diagnostics.some(diagnostic => diagnostic.code === 'ERR_BROKEN_LINK'));

  const publicGraph = projectCorpus(graph, { roles: ['anonymous'] });
  const original = graph.getDocument('walkthrough/start');
  const projected = publicGraph.getDocument('walkthrough/start');
  assert(original?.ast && projected?.ast);
  const markdown = generateRouteMirrors(graph, config).get('/walkthrough/start.md');
  const html = toHtmlSsr(projected.ast);
  const search = await buildSearchIndex(graph, config);
  const agentIndex = generateLlmsTxt(graph, config);
  for (const output of [markdown, html, JSON.stringify(search.entries), agentIndex]) {
    assert(output && !output.includes('Coordinate the draft'), 'Public projection leaked the example-only team note');
  }
  const nodeSummary = node => Object.fromEntries(Object.entries(node).filter(([key]) =>
    ['type', 'id', 'depth', 'value', 'title', 'url', 'access', 'children'].includes(key)
  ).map(([key, value]) => [key, key === 'children' ? value.map(nodeSummary) : value]));
  const version = JSON.parse(await readFile(join(root, 'node_modules/@omnitron-dev/lumen/package.json'), 'utf8')).version;
  const fixture = {
    sdkVersion: version,
    sources,
    parsed: { frontmatter: original.ast.frontmatter, nodes: original.ast.children.map(nodeSummary), diagnostics: original.ast.diagnostics },
    corpus: graph.getAllDocuments().map(({ id, path, routePath, anchors }) => ({ id, path, routePath, anchors })),
    resolution: graph.resolveAnchor('./verify.md#acceptance', 'walkthrough/start'),
    checks: { valid, broken, brokenSource },
    projection: { original: toCleanMarkdown(original.ast), public: toCleanMarkdown(projected.ast), beforeNodes: original.ast.children.length, afterNodes: projected.ast.children.length },
    outputs: { html, markdown, search: search.entries, searchFiles: Object.keys(search.files).sort(), agentIndex },
  };
  const target = join(root, 'src/data/lumen-pipeline.json');
  const serialized = JSON.stringify(fixture, null, 2) + '\n';
  if (!writeFixture) {
    assert.equal(await readFile(target, 'utf8'), serialized, 'Lumen example changed: regenerate and review its captured output');
    console.log(`Lumen ${version}: fixture matches; valid/broken gates, public projection, HTML, Markdown and Pagefind verified`);
  } else {
    await writeFile(target, serialized);
    console.log(`Captured Lumen ${version} results for the architecture explorer`);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
