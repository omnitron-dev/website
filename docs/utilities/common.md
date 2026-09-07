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

// somewhere else, once the value is known:
d.resolve(currentUser);
// or:
d.reject(new Error('cancelled'));

// wherever it is needed:
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
  { signal: abortController.signal },
);
```

Wraps a promise; rejects with `Error('Timeout of 5000ms exceeded')`
if it doesn't settle in time. Options are `{ unref?, signal? }` —
`signal` lets external code abort early (rejects with
`Error('Timeout aborted')`).

### `retry(callback, opts | max)`

```typescript
import { retry } from '@omnitron-dev/common';

const data = await retry(
  ({ current }) => fetch(url).then(r => r.json()),   // callback gets { current } attempt no.
  {
    max:             5,           // max attempts
    timeout:         8_000,       // per-attempt timeout (ms), optional
    backoffBase:     500,         // base delay (ms), default 100
    backoffExponent: 2,           // multiplier, default 1.1
    match:           [NetworkError, /ECONN/],  // only retry matching errors
    name:            'fetchJson',
    report:          (msg, opts, err) => log(msg),
  },
);

// Shorthand — just a max attempt count:
await retry(() => doThing(), 3);
```

Exponential backoff (`backoffBase * backoffExponent^(attempt-1)`),
optional per-attempt `timeout`, and `match` to restrict which
errors trigger a retry (strings, RegExps, or error classes). Pass a
bare number to set `max` with defaults for the rest.

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

### `omit(obj, keys | predicate | regex | string, opts?)`

```typescript
import { omit } from '@omnitron-dev/common';

omit(user, ['password', 'salt']);                       // remove specific keys
omit(payload, (key, value) => value == null);           // predicate (key, value, object)
omit(state, /^_/);                                       // regex on key
omit(deep, 'user.credentials', { path: true });         // dotted path (requires { path: true })
```

The predicate receives `(key, value, object)`. Dotted-path removal
requires the third-arg flag `{ path: true }`; without it a string is
treated as an exact key name.

### `entries(obj, opts?)` / `keys(obj, opts?)` / `values(obj, opts?)`

```typescript
import { entries, keys } from '@omnitron-dev/common';

entries({ a: 1, b: 2 });                           // [['a', 1], ['b', 2]]
keys(obj, { all: true });                           // include non-enumerable + prototype keys
keys(obj, { followProto: true });                   // walk the prototype chain
```

Options are `{ enumOnly = true, followProto = false, all = false }`.
These operate on plain objects (own/prototype string keys) — they do
**not** iterate `Map`/`Set` entries.

## Data structures

### `ListBuffer<T>` — O(1) FIFO queue

```typescript
import { ListBuffer } from '@omnitron-dev/common';

const buffer = new ListBuffer<LogEntry>();
buffer.push(entry);                  // O(1) enqueue
const oldest = buffer.shift();       // O(1) dequeue (undefined when empty)
buffer.length;                        // current count (getter)
buffer.clear();                       // empty it
```

Backed by a singly-linked list — no array reallocation. It is an
**unbounded** queue: there is no capacity argument and no automatic
eviction; size it by `shift()`-ing as you consume.

### `TimedMap<K, V>` — auto-expiring map

```typescript
import { TimedMap } from '@omnitron-dev/common';

const cache = new TimedMap<string, User>(60_000);      // default 60s TTL per key
cache.set('u_42', user);                               // expires after 60s
cache.set('u_43', user, undefined, 300_000);           // custom 5min TTL (callback, ttl)
cache.get('u_42');                                     // returns User or undefined
```

Constructor is `new TimedMap(timeoutMs?, callback?)`; on expiry the
key is deleted (or `callback(key)` runs if provided). Each entry has
its own `setTimeout` — there is no shared GC sweep and no `.dispose()`.
Pass a per-key `(callback, timeout)` to `set()` to override the default.

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

const total = Decimal.from('0.1').add('0.2');    // exact 0.3 (use Decimal.from, not new)
const tax   = Decimal.from(amount).multiplyBy('0.08');
const cents = total.toString();                   // string
const num   = total.toNumber();                   // number (lossy — use sparingly)
```

Construct via the static `Decimal.from(value, precision?)` /
`Decimal.zero()` (the constructor is private). Methods: `add`,
`subtract`, `multiply(n)` / `multiplyBy(other)`, `divide(n)` /
`divideBy(other)`, `abs`, `negate`, comparisons (`equals`, `gt`,
`gte`, `lt`, `lte`, `compare`), `round`/`floor`/`ceil(decimalPlaces)`,
and `toString` / `toNumber` / `toBigInt`.

For money / currency. Never trust `Number` for those.

#### The standalone helpers

The module also exports 31 string-in / string-out functions for fixed-precision
maths. They are the whole surface, listed rather than sampled, because an
incomplete list of money helpers is an invitation to write a thirty-second one
by hand. Every one takes a trailing `precision` argument defaulting to
`DEFAULT_PRECISION` (12).

| Arithmetic | |
| --- | --- |
| `addDecimals(a, b)` · `subtractDecimals(a, b)` | both operands are strings |
| `multiplyDecimal(a, multiplier: number)` | scale by a plain number |
| `multiplyDecimals(a, b: string)` | multiply two decimal strings |
| `divideDecimal(a, divisor: number)` | divide by a plain number; throws on 0 |
| `divideDecimals(a, b: string)` | divide two decimal strings |
| `sumDecimals(values: string[])` | sum an array |
| `percentOf(amount, percent)` | `percentOf('100', '2.5')` → `'2.500000000000'` |
| `absDecimal(v)` · `minDecimal(a, b)` · `maxDecimal(a, b)` · `zero()` | |

**Watch the singular/plural pair.** `multiplyDecimal` takes a `number`;
`multiplyDecimals` takes a decimal `string`. Same for `divideDecimal` /
`divideDecimals`. One letter apart and a different second argument — the
compiler catches a swap, an `any` does not.

| Comparison | |
| --- | --- |
| `compareDecimals(a, b)` | `-1 \| 0 \| 1` |
| `isGreater` · `isGreaterOrEqual` · `isLess` · `isLessOrEqual` `(a, b)` | |
| `isZero(v)` · `isPositive(v)` · `isNegative(v)` | |

| Rounding and formatting | |
| --- | --- |
| `roundDecimal(v, decimalPlaces)` · `floorDecimal` · `ceilDecimal` | |
| `formatDecimal(v)` | normalise to the precision |
| `parseDecimal(v: string \| number)` | accepts a number at the boundary |

| Crypto units | |
| --- | --- |
| `satoshisToBtc(sat: bigint \| number \| string)` → string | |
| `btcToSatoshis(btc: string)` → `bigint` | |
| `atomicToXmr(atomic: bigint \| number \| string)` → string | |
| `xmrToAtomic(xmr: string)` → `bigint` | |

| Validation | |
| --- | --- |
| `isValidDecimal(v)` | format only |
| `validateAmount(amount, { minAmount?, maxAmount?, precision?, allowZero?, allowNegative? })` | returns `{ valid, error? }`; `allowZero` defaults true, `allowNegative` false |

**Results are padded to the precision**, not trimmed: `percentOf('100', '2.5')`
is `'2.500000000000'`, not `'2.5'`. Compare with `compareDecimals` or
`isZero`, never with `===` against a literal you typed by hand.

The unit converters are the exception — they answer in their coin's own
precision, so `satoshisToBtc(100000000n)` is `'1.00000000'` (8 places), not 12.

They return `bigint` in the atomic direction on purpose: satoshis and piconeros
exceed `Number.MAX_SAFE_INTEGER` for large amounts, so a `number` there is the
same lossy trap `Decimal` exists to avoid.

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
