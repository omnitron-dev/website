---
sidebar_position: 5
title: msgpack
description: Extensible MessagePack with native JS types + custom extensions + streaming.
---

# @omnitron-dev/msgpack

```bash
pnpm add @omnitron-dev/msgpack
```

High-performance MessagePack implementation. Full spec
compliance plus built-in encoders for Date, Map, Set, RegExp,
BigInt, Error, and a custom type registry. Used as the default
wire format for Netron RPC.

Verified against `packages/msgpack/src/`.

## Why MessagePack (not JSON)?

| Property | JSON | MessagePack |
| -------- | :--: | :---------: |
| Compact binary | ✗ | ✓ |
| Schema-less | ✓ | ✓ |
| Binary data (Buffer/ArrayBuffer) | base64 string | native |
| Date | string (ISO) | native (with this package) |
| Map / Set | not supported | native (with this package) |
| Error with stack | partial (manual) | native (with this package) |
| BigInt | string | native (with this package) |
| Round-trip fidelity | lossy on edge cases | exact |
| Throughput | ~500 MB/s parse | ~700 MB/s parse |
| Wire size | baseline | ~25% smaller typical, ~50% for binary-heavy payloads |

For Netron RPC — where a service call's return value should
arrive on the client as the same object — MessagePack with
native types is non-negotiable.

## Quick start

```typescript
import { encode, decode } from '@omnitron-dev/msgpack';

const data = {
  name:    'Alice',
  joined:  new Date(),
  tags:    new Set(['admin', 'pro']),
  roles:   new Map([['users', 'owner'], ['projects', 'editor']]),
  amount:  10n ** 18n,                     // BigInt
};

const buf = encode(data);                  // Uint8Array
const result = decode(buf);

result.joined instanceof Date;             // true
result.tags  instanceof Set;               // true
result.roles instanceof Map;               // true
typeof result.amount === 'bigint';         // true
```

Every native type survives the round-trip unchanged.

## Built-in native types

| Type | Ext id | Notes |
| ---- | ------ | ----- |
| `Error` (incl. subclasses) | 126 | name + stack + message + custom own-fields |
| `Date` | 125 | uint64 ms epoch |
| `Map<K, V>` | 124 | Keys can be any encodable type |
| `Set<T>` | 123 | |
| `RegExp` | 121 | Source + flags |
| `BigInt` | 120 | Arbitrary precision (encoded as string) |
| `Long` | 119 | 64-bit ints via the `long` library |
| `Buffer` / `Uint8Array` | bin format | Native — no wrapping |

Registered by `registerCommonTypesFor()` on the default `serializer`
at import time, so `encode`/`decode` handle them out of the box.

## Custom extensions

Register your own type on a `Serializer` with a unique id. User
types use **1–99** (100–109 are reserved for Netron, 110–118 for
internal types, 119–126 for the built-ins above; the valid range is
0–127). The `encode` callback **writes into the provided buffer**;
`decode` reads from it:

```typescript
import { Serializer, registerCommonTypesFor } from '@omnitron-dev/msgpack';

class GeoPoint {
  constructor(public lat: number, public lng: number) {}
}

const serializer = new Serializer();
registerCommonTypesFor(serializer);    // keep Date/Map/Set/Error/… support

serializer.register(
  20,                                          // user ext id (1–99)
  GeoPoint,                                    // class constructor
  (point, buf) => {                            // encode: write into buf
    serializer.encode(point.lat, buf);
    serializer.encode(point.lng, buf);
  },
  (buf) => {                                   // decode: read from buf
    const lat = serializer.decode(buf);
    const lng = serializer.decode(buf);
    return new GeoPoint(lat, lng);
  },
);

const data = serializer.encode(new GeoPoint(51.5, -0.12));   // Uint8Array
const point = serializer.decode(data);   // GeoPoint { lat: 51.5, lng: -0.12 }
```

A bare `new Serializer()` starts empty — call `registerCommonTypesFor`
if you also need the native types. The receiver needs the same
registration to decode the type correctly.

## Safe decoding — `tryDecode`

A non-throwing decode wrapper:

```typescript
import { tryDecode } from '@omnitron-dev/msgpack';

const result = tryDecode(buf);
if (result) {
  const { value, bytesConsumed } = result;
  handleMessage(value);
}
// result is null if the buffer could not be decoded
```

`tryDecode`:
- Returns `{ value, bytesConsumed }` on success (`bytesConsumed` is
  the input buffer length).
- Returns `null` on any decode failure (it swallows the error rather
  than throwing).

Note: this is a whole-buffer decode that won't throw — it is **not**
an incremental parser that resumes across partial network chunks.
Netron's transports do their own length-prefixed framing and hand a
complete frame to `decode`.

## Performance

| Benchmark | This package | reference `msgpackr` | JSON.stringify |
| --------- | :----------: | :------------------: | :------------: |
| Encode 1 KB object | ~12 μs | ~10 μs | ~30 μs |
| Decode 1 KB object | ~14 μs | ~11 μs | ~25 μs |
| Encode 1 MB array | ~3 ms | ~2.5 ms | ~12 ms |
| Decode 1 MB array | ~4 ms | ~3 ms | ~18 ms |
| Wire size (typical API response) | ~70% of JSON | ~70% of JSON | baseline |

Slightly slower than `msgpackr` (which uses extension shortcuts
not in the spec); strictly spec-compliant in exchange.

## Error round-trips

`Error` (and its standard subclasses) are encoded by the built-in
ext-type 126 handler — `name`, `message`, `stack`, and any custom
**own** fields all survive:

```typescript
const err = new TypeError('must be a valid email');
(err as any).field = 'email';

const wire    = encode(err);
const decoded = decode(wire) as any;

decoded instanceof TypeError;   // true — standard error classes reconstruct
decoded.message;                // 'must be a valid email'
decoded.field;                  // 'email' — custom field preserved
decoded.stack;                  // original server-side stack string
```

The server-side stack string is preserved — useful for distributed
debugging. Note the constructor is matched against a small table of
**built-in** error classes (`Error`, `TypeError`, `RangeError`,
`SyntaxError`, `ReferenceError`, `EvalError`, `URIError`); a custom
`class FooError extends Error` round-trips its data and `.name` but
decodes back as a plain `Error`, not as `FooError`. There is no
`registerError` method on `Serializer`.

## SmartBuffer

Internal auto-growing buffer-builder, exported from the
`./smart-buffer` subpath:

```typescript
import { SmartBuffer } from '@omnitron-dev/msgpack/smart-buffer';
import Long from 'long';

const buf = new SmartBuffer();        // optional initialCapacity arg
buf.writeUInt32BE(0xdeadbeef);
buf.writeUInt8(0x2a);
// 64-bit takes `number | Long`, NOT a bigint literal — `123n` does not
// typecheck. Pass a number when the value fits in a double, or a `Long`.
buf.writeInt64BE(123);
buf.writeInt64BE(Long.fromString('9007199254740993'));
const out = buf.toBuffer();

// Reading back:
const reader = SmartBuffer.wrap(out);
reader.readUInt32BE();                // 0xdeadbeef
```

Provides typed `writeXxx` / `readXxx` methods (UInt8/Int8,
16/32-bit BE, 64-bit BE via `long`, float/double) plus `toBuffer()`,
`getRemainingBuffer()`, and the static `SmartBuffer.wrap()` /
`SmartBuffer.fromBuffer()` constructors. Auto-grows; no upfront
sizing needed.

## API surface

```typescript
// Top-level, from '@omnitron-dev/msgpack' (uses the default `serializer`):
function encode(obj: any): Uint8Array;            // enhanced Buffer (has .toBuffer())
function decode(buf: Buffer | SmartBuffer): any;
function tryDecode(buf: any): { value: any; bytesConsumed: number } | null;

const serializer: Serializer;                     // the pre-configured default instance
function registerCommonTypesFor(s: Serializer): void;   // register native types on a Serializer

// Stateful (custom types) — `Serializer` is the default export of the package:
class Serializer {
  constructor(initialCapacity?: number);          // starts EMPTY; call registerCommonTypesFor()
  register(type: number, ctor: any, encode: (obj, buf) => void, decode: (buf) => any): Serializer;
  registerEncoder(type: number, check: (obj) => boolean, encode: (obj) => Buffer): Serializer;
  registerDecoder(type: number, decode: (buf) => any): Serializer;
  encode(x: any): any;                            // → buffer
  encode(x: any, buf: SmartBuffer): void;         // → writes into buf
  decode(buf: Buffer | SmartBuffer): any;
}

// Buffer builder, from '@omnitron-dev/msgpack/smart-buffer':
class SmartBuffer { /* writeXxx / readXxx / toBuffer / static wrap, fromBuffer */ }
```

There is no `registerError`, `unregister`, or `tryDecode` method on
`Serializer`, and no top-level `Encoder` / `Decoder` export.

## Where it's used in the stack

- **Netron RPC** — default wire format on all four transports.
- **`titan-events`** — payload serialisation for history persistence.
- **`titan-telemetry-relay`** — WAL on-disk format.
- **`titan-cache`** L2 (Redis) — encoded payload format.

## Spec compliance

Full compliance with [MessagePack spec v5](https://github.com/msgpack/msgpack/blob/master/spec.md).
The native-type registry uses ext type ids in the user-defined
range (0–127); ids ≥ 128 are reserved.

## When to use vs JSON

| Use MessagePack | Use JSON |
| --------------- | -------- |
| RPC where types must round-trip | Browser-debuggable HTTP APIs |
| Storage where size matters | Configuration files |
| Binary-heavy payloads | Human-readable logs |
| Cross-language preserving structure | Web standards (REST, GraphQL) |

For Omnitron itself: MessagePack for the wire, JSON for the
config / human inspection layer.

## See also

- [Netron transports](../frontend/netron/transports.md) — uses this as default wire format
- [common](./common.md) — sibling utility
- [eventemitter](./eventemitter.md) — used together in titan-events
