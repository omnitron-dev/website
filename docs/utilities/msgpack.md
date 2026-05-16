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

| Type | Wire | Notes |
| ---- | ---- | ----- |
| `Date` | ext type 0 (uint64 ms epoch + ns) | Sub-millisecond precision optional |
| `Map<K, V>` | ext type 1 | Keys can be any encodable type |
| `Set<T>` | ext type 2 | |
| `RegExp` | ext type 3 | Source + flags |
| `BigInt` | ext type 4 | Arbitrary precision |
| `Error` (incl. subclasses) | ext type 5 | Message + name + stack + custom fields |
| `Buffer` / `Uint8Array` | bin format | Native — no wrapping |
| `undefined` | nil + ext flag | Preserved (distinct from `null`) |

## Custom extensions

Register your own type with a unique ext-type id (16–127):

```typescript
import { Serializer } from '@omnitron-dev/msgpack';

class GeoPoint {
  constructor(public lat: number, public lng: number) {}
}

const serializer = new Serializer();
serializer.register(
  20,                                          // ext type id (you choose 16-127)
  GeoPoint,                                    // class constructor
  (point) => Buffer.from(`${point.lat},${point.lng}`),         // encode
  (buf)   => {
    const [lat, lng] = buf.toString().split(',').map(parseFloat);
    return new GeoPoint(lat, lng);
  },
);

const buf = serializer.encode(new GeoPoint(51.5, -0.12));
const point = serializer.decode(buf);   // GeoPoint { lat: 51.5, lng: -0.12 }
```

The receiver needs the same registration to decode the type
correctly — otherwise it sees an opaque ext object.

## Streaming / incremental decoding

For partial buffers (incoming network chunks):

```typescript
import { tryDecode } from '@omnitron-dev/msgpack';

let buf = Buffer.alloc(0);

socket.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk]);

  let result;
  while ((result = tryDecode(buf)) !== undefined) {
    const { value, bytesRead } = result;
    handleMessage(value);
    buf = buf.subarray(bytesRead);
  }
});
```

`tryDecode`:
- Returns `{ value, bytesRead }` if a complete message is at the
  buffer start.
- Returns `undefined` if more bytes are needed.
- Throws on malformed data.

Used by Netron's WebSocket / TCP transports for the
length-prefixed wire framing.

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

The killer feature for RPC:

```typescript
class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const serializer = new Serializer();
serializer.registerError(ValidationError, 50);

// Server throws:
throw new ValidationError('email', 'must be a valid email');

// Wire — encoded by serializer ↓

// Client decodes:
catch (e) {
  e instanceof ValidationError;   // true — class identity preserved
  e.field === 'email';            // true
  e.stack;                         // server-side stack (with frame markers)
}
```

The stack is preserved with server-side path markers — useful
for distributed debugging.

## SmartBuffer

Internal buffer-builder optimised for incremental writes:

```typescript
import { SmartBuffer } from '@omnitron-dev/msgpack';

const buf = new SmartBuffer();
buf.writeUInt32BE(0xdeadbeef);
buf.writeString('hello');
buf.writeBuffer(Buffer.from([1, 2, 3]));
const out = buf.toBuffer();
```

Auto-grows; no upfront sizing needed; faster than chained
`Buffer.concat`.

## API surface

```typescript
// Stateless top-level (uses default serializer):
function encode(value: unknown):      Uint8Array;
function decode<T = unknown>(buf):    T;
function tryDecode<T = unknown>(buf): { value: T; bytesRead: number } | undefined;

// Stateful (custom types):
class Serializer {
  register<T>(id: number, ctor: Constructor<T>, encode: (v: T) => Buffer, decode: (b: Buffer) => T): this;
  registerError<E extends Error>(ctor: Constructor<E>, id: number): this;
  unregister(id: number): this;
  encode(value: unknown): Uint8Array;
  decode<T>(buf): T;
  tryDecode<T>(buf): { value: T; bytesRead: number } | undefined;
}

// Low-level (advanced):
class Encoder { /* ... */ }
class Decoder { /* ... */ }
class SmartBuffer { /* ... */ }
```

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
