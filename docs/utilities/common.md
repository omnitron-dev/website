---
sidebar_position: 2
title: common
description: Type predicates, promise helpers, object tools, data structures.
---

# @omnitron-dev/common

```bash
pnpm add @omnitron-dev/common
```

A focused TypeScript utility library. Type predicates with proper
narrowing, promise lifecycle helpers, ergonomic object tools,
small high-performance data structures. Works in Node.js and Bun.

Verified against `packages/common/src/`.

## Modules

| Module | Surface |
| ------ | ------- |
| `predicates` | 50+ type predicates (`isString`, `isPlainObject`, `isPromise`, …) + platform flags |
| `promise` | `defer`, `delay`, `timeout`, `retry`, `props`, `promisify`, `callbackify` |
| `omit` | Deep / path-based / predicate-based property omission |
| `entries` | Typed `entries` / `keys` / `values` |
| `primitives` | `noop`, `identity`, `truly`, `falsely`, `arrify` |
| `list-buffer` | O(1) FIFO queue with bounded capacity |
| `timed-map` | TTL Map (auto-expiring entries) |
| `p-limit` | Promise concurrency limiter |
| `decimal` | Lossless decimal arithmetic |

## Type predicates

50+ predicates with proper `is X` return types that narrow:

```typescript
import {
  isString, isNumber, isBoolean, isArray, isFunction,
  isPlainObject, isObject, isPromise, isError, isDate,
  isBuffer, isNull, isUndefined, isNil, isClass, isAsyncFunction,
} from '@omnitron-dev/common';

function process(value: unknown) {
  if (isString(value))     return value.toUpperCase();   // ← narrowed to string
  if (isPlainObject(value)) return Object.keys(value);   // ← narrowed to object
  if (isPromise(value))    return value.then(handle);    // ← narrowed to Promise
  return value;
}
```

Plus platform flags (set once at import):

```typescript
import { isWindows, linux, darwin, isNodejs } from '@omnitron-dev/common';

if (darwin && isNodejs) {
  // macOS + Node.js — both true / false constants
}
```

## Promise helpers

### `delay(ms, value?, opts?)`

```typescript
await delay(1_000);                                  // sleep 1s
const result = await delay(500, 'hello');           // sleep 500ms then resolve 'hello'
await delay(60_000, undefined, { unref: true });    // doesn't block event loop
```

### `defer()` — externally-controlled promise

```typescript
import { defer } from '@omnitron-dev/common';

const d = defer<User>();
// somewhere else:
d.resolve(user);
// or:
d.reject(new Error('cancelled'));

const user = await d.promise;
```

Useful when you need to expose `.resolve` / `.reject` to code
that isn't inside the promise's executor.

### `timeout(promise, ms, opts?)`

```typescript
import { timeout } from '@omnitron-dev/common';

const result = await timeout(
  fetchData(),
  5_000,
  { name: 'fetchData', signal: abortController.signal },
);
```

Wraps a promise; rejects with `TimeoutError` if it doesn't
settle in time. Optional `signal` lets external code cancel.

### `retry(fn, opts)`

```typescript
import { retry } from '@omnitron-dev/common';

const data = await retry(
  () => fetch(url).then(r => r.json()),
  {
    attempts:    5,
    delay:       500,
    backoff:     'exponential',
    maxDelay:    8_000,
    jitter:      true,
    onRetry:     (err, attempt) => log(`retry ${attempt}: ${err.message}`),
    shouldRetry: (err) => err instanceof NetworkError,
  },
);
```

Exponential backoff with optional jitter, custom predicate, and
per-attempt hook.

### `props(obj)`

```typescript
const result = await props({
  user:    fetchUser(id),
  posts:   fetchPosts(id),
  friends: fetchFriends(id),
});
// { user: User, posts: Post[], friends: User[] } — all awaited
```

`Promise.all` for objects — preserves keys.

### `promisify(fn)` / `callbackify(fn)`

Bridge Node-style callbacks ↔ promises.

```typescript
import { promisify } from '@omnitron-dev/common';
import { exec } from 'node:child_process';

const execAsync = promisify(exec);
const { stdout } = await execAsync('git log');
```

## Object tools

### `omit(obj, keys | predicate | path)`

```typescript
import { omit } from '@omnitron-dev/common';

omit(user, ['password', 'salt']);                  // remove specific keys
omit(payload, (k, v) => v == null);                // predicate
omit(deep, 'user.credentials');                    // dotted path
omit(state, /^_/);                                  // regex
```

### `entries(obj, opts?)` / `keys(obj, opts?)` / `values(obj, opts?)`

```typescript
import { entries, keys } from '@omnitron-dev/common';

entries({ a: 1, b: 2 });                           // [['a', 1], ['b', 2]] — typed
entries(map);                                       // works on Map too
keys(obj, { sort: true });                          // sorted keys
```

## Data structures

### `ListBuffer<T>` — O(1) bounded FIFO

```typescript
import { ListBuffer } from '@omnitron-dev/common';

const buffer = new ListBuffer<LogEntry>(1_000);
buffer.push(entry);                  // O(1)
const oldest = buffer.shift();       // O(1)
buffer.size;                          // current count
buffer.toArray();                     // snapshot
```

When full, oldest entries are evicted automatically. Backed by a
linked-list; no array reallocation.

### `TimedMap<K, V>` — auto-expiring map

```typescript
import { TimedMap } from '@omnitron-dev/common';

const cache = new TimedMap<string, User>({ defaultTtl: 60_000 });
cache.set('u_42', user);                              // default 60s TTL
cache.set('u_43', user, 300_000);                     // custom 5min TTL
cache.get('u_42');                                    // returns User or undefined
cache.dispose();                                       // stop the GC timer
```

Internal GC sweep on a configurable interval; `.dispose()` is
mandatory if you don't want a hanging timer.

### `pLimit(n)` — concurrency limiter

```typescript
import { pLimit } from '@omnitron-dev/common';

const limit = pLimit(5);
const results = await Promise.all(
  urls.map(url => limit(() => fetch(url))),
);
// At most 5 fetches in flight at any moment.
```

### `Decimal` — lossless decimal arithmetic

```typescript
import { Decimal } from '@omnitron-dev/common';

const total = new Decimal('0.1').plus('0.2');   // exact 0.3
const tax   = new Decimal(amount).times('0.08');
const cents = total.toFixed(2);                  // string
```

For money / currency. Never trust `Number` for those.

## Primitives

```typescript
import { noop, identity, truly, falsely, arrify } from '@omnitron-dev/common';

noop();                                  // returns undefined
identity(x);                              // returns x
truly();                                  // returns true
falsely();                                // returns false
arrify(value);                            // [value] if not array, else value
arrify(null);                             // []
arrify([1, 2]);                          // [1, 2]
```

`arrify` is the one you'll reach for most — coalescing
"single-or-many" args into a consistent array.

## Use across the stack

- Titan's lifecycle hooks use `delay` for graceful drain.
- Netron's middleware uses `retry` for transient errors.
- Omnitron's daemon uses `TimedMap` for the token cache.
- `titan-cache` ships its own LRU but uses `TimedMap` for
  auxiliary structures.
- `titan-events` uses `defer` for the request/response pattern.

## See also

- [eventemitter](./eventemitter.md) — sibling utility, async emission patterns
- [cuid](./cuid.md) — ID generation
- [msgpack](./msgpack.md) — wire format
