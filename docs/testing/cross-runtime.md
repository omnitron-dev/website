---
sidebar_position: 4
title: Cross-runtime testing
description: One test source running unchanged on Node, Bun, and Deno.
---

# Cross-runtime testing

The platform's utility packages (`common`, `cuid`, `eventemitter`,
`msgpack`) and Titan itself target three runtimes:

| Runtime | Test runner |
| ------- | ----------- |
| Node 22+ | Vitest |
| Bun 1.x | `bun test` (vitest-compatible) |
| Deno 2.x | `Deno.test` |

The same test source runs in all three when written through
`@omnitron-dev/testing`'s runtime adapter.

## Why bother

| Why | When |
| --- | ---- |
| **Catch runtime divergence** in TS features (decorators, top-level await, ESM resolution) | Library authors |
| **Validate Bun-specific perf paths** without Node-only assumptions | Performance-critical code |
| **Run on Deno's permissioned model** to surface implicit file/network access | Security-critical code |

For application code (a Titan app running on Node only), one
runtime is fine. For **libraries** consumed by all three, the
cross-runtime test layer is the safety net.

## The adapter

```typescript
import { loadRuntimeAdapter, RUNTIME } from '@omnitron-dev/testing';

const t = await loadRuntimeAdapter();   // resolves to the right runtime's test() + expect()

t.test('basics', () => {
  t.expect(1 + 1).toBe(2);
});

t.test('async', async () => {
  const result = await Promise.resolve(42);
  t.expect(result).toBe(42);
});

t.test('isolation', () => {
  // Each test gets fresh state — same semantics across runtimes
});

t.describe('grouped', () => {
  t.beforeEach(() => { /* ... */ });
  t.test('child', () => { /* ... */ });
});
```

`RUNTIME` is one of `'node' | 'bun' | 'deno'` — useful for the
rare runtime-specific assertion:

```typescript
import { RUNTIME } from '@omnitron-dev/testing';

t.test('uses correct platform API', () => {
  if (RUNTIME === 'bun') {
    t.expect(Bun.version).toBeDefined();
  } else if (RUNTIME === 'node') {
    t.expect(process.versions.node).toBeDefined();
  }
});
```

## Running the suite

Same file, three commands:

```bash
# Node + Vitest:
vitest run test/cross.test.ts

# Bun:
bun test test/cross.test.ts

# Deno:
deno test --allow-read --allow-write --allow-env test/cross.test.ts
```

In CI, run all three:

```yaml
# .github/workflows/test.yml
matrix:
  include:
    - { runtime: 'node', cmd: 'vitest run' }
    - { runtime: 'bun',  cmd: 'bun test' }
    - { runtime: 'deno', cmd: 'deno test --allow-all' }
```

A test that passes on all three is portable.

## Common pitfalls

### ESM resolution

Node + Bun + Deno all support ESM, but with subtle differences:

| Feature | Node | Bun | Deno |
| ------- | :--: | :-: | :--: |
| `node:` prefix | required | optional | required |
| `npm:` prefix | n/a | n/a | required for npm |
| TypeScript directly | flagged | yes | yes |
| Top-level await | yes | yes | yes |

Stick to `node:` prefixed imports for built-ins:

```typescript
import path from 'node:path';        // ✓ all three
import { readFile } from 'node:fs/promises';
```

Avoid bare `'path'` — works on Node + Bun, fails on Deno.

### File-system access

Deno requires explicit `--allow-read` / `--allow-write`. Tests
that touch the FS need:

```bash
deno test --allow-read --allow-write test/...
```

Or scope:

```bash
deno test --allow-read=./fixtures --allow-write=./tmp
```

Node + Bun have no equivalent — they always allow.

### Process / Environment

```typescript
// Works on all three (when env access is allowed):
import { env } from 'node:process';

env.NODE_ENV;                // string | undefined
env.NODE_ENV ??= 'test';     // assignment works
```

Deno needs `--allow-env` for `process.env` reads.

### Performance APIs

`performance.now()` works on all three; `process.hrtime` is
Node-only. Use `performance` for cross-runtime timing:

```typescript
const start = performance.now();
await work();
const elapsed = performance.now() - start;
```

### Crypto

```typescript
import { randomUUID } from 'node:crypto';     // ✓ all three
crypto.randomUUID();                            // also ✓ — global Web Crypto
```

Web Crypto is the universal path.

## Conditional skips

When a test genuinely can't run on a runtime:

```typescript
import { RUNTIME } from '@omnitron-dev/testing';

t.test.skipIf(RUNTIME === 'deno')('uses Node-only API', () => {
  // ... Node-specific test
});
```

Or:

```typescript
if (RUNTIME !== 'bun') t.test.skip('Bun-only feature', ...);
```

Document **why** in a comment. Skips without explanation rot.

## Suite-level configuration

### Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include:     ['**/*.test.ts'],
    pool:        'forks',
  },
});
```

### Bun

```toml
# bunfig.toml
[test]
preload = ["./test/setup.ts"]
timeout = 10000
```

### Deno

```jsonc
// deno.json
{
  "test": {
    "include": ["**/*.test.ts"]
  }
}
```

## Benchmarks across runtimes

```typescript
import { bench } from '@omnitron-dev/testing/performance';
import { RUNTIME } from '@omnitron-dev/testing';

bench(`parse on ${RUNTIME}`, {
  variant1: () => parseV1(input),
  variant2: () => parseV2(input),
}, { runs: 10_000 });
```

Run all three; compare. Bun usually wins raw JS work; Node wins
ecosystem maturity; Deno wins startup time.

## Where the platform itself uses this

The utility packages (`common`, `cuid`, `eventemitter`,
`msgpack`) have cross-runtime test suites — `test/cross/*.test.ts`
files run on all three CI matrices.

Titan + Omnitron target Node only (Bun + Deno work for the
runtime; the daemon assumes Node's child_process model).

## Best practices

- **Default to cross-runtime** for library packages.
- **Node-only** for application code unless the app explicitly
  targets Bun/Deno.
- **Use `node:` prefixes** for built-ins everywhere.
- **Prefer Web standards** (Web Crypto, `fetch`, `performance`,
  `URL`) over Node-specific APIs when both exist.
- **Document skips** with `// skipIf bun: reason`.

## Anti-patterns

- **`process.platform === 'darwin'`** checks in tests that
  should be portable. Push platform-specific logic to the
  module under test, then assert behaviour generically.
- **Bun-only API in cross-runtime tests** without skip guard —
  hidden failure on Node.
- **`__dirname` / `__filename`.** Replace with
  `fileURLToPath(import.meta.url)`.

## See also

- [Testing overview](./index.md)
- [Testing package](./testing-package.md) — adapter API
- [Bun docs](https://bun.sh/docs/cli/test)
- [Deno test docs](https://docs.deno.com/runtime/manual/basics/testing/)
