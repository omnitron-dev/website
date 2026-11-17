---
id: "utilities/msgpack"
slug: "/docs/utilities/msgpack"
sidebar_position: 5
title: msgpack
description: Encode binary RPC values, register JavaScript types and read MessagePack frames.
---

# @omnitron-dev/msgpack

```bash
pnpm add @omnitron-dev/msgpack
```

Netron uses this package to encode RPC arguments and results. The default
serializer handles plain data and provides extension codecs for JavaScript
values such as `Date`, `Map`, `Set` and `BigInt`.

## Choosing a wire format {#why-messagepack-not-json}

Use MessagePack when a peer expects binary payloads or both peers share
extension codecs. JSON is convenient for human-readable configuration, logs
and HTTP clients. For a cross-language boundary, agree on the representation
of dates, integers and extension values with the other endpoint.

## Quick start {#quick-start}

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

The default serializer registers the extension types used in this example.

## Built-in native types {#built-in-native-types}

| Type | Ext id | Notes |
| ---- | ------ | ----- |
| `Error` (incl. subclasses) | 126 | name + stack + message + custom own-fields |
| `Date` | 125 | uint64 ms epoch |
| `Map<K, V>` | 124 | Keys can be any encodable type |
| `Set<T>` | 123 | |
| `RegExp` | 121 | Source + flags |
| `BigInt` | 120 | Arbitrary precision (encoded as string) |
| `Long` | 119 | 64-bit ints via the `long` library |
| `Buffer` | bin format | Binary input to the encoder. The decoder also reads encoded bytes from a `Uint8Array` view. |

Registered by `registerCommonTypesFor()` on the default `serializer`
at import time, so `encode`/`decode` handle them out of the box.

## Custom extensions {#custom-extensions}

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

## Reading a message {#safe-decoding--trydecode}

`tryDecode` reads the first value. It returns `null` for incomplete input and
for a decoding error. Use `decode` when you need the error for a complete
frame. The caller owns the input buffer between calls.

On `main`, `bytesConsumed` is the length of the first encoded value. A caller
can keep the remaining bytes for its next read. This example uses two complete
messages so the boundary is visible.

```typescript
import { encode, tryDecode } from '@omnitron-dev/msgpack';

const first = encode({ id: 1 });
const second = encode({ id: 2 });
const batch = new Uint8Array(first.length + second.length);
batch.set(first);
batch.set(second, first.length);

const message = tryDecode(batch);
if (message) {
  console.log(message.value.id); // 1
  const remaining = batch.subarray(message.bytesConsumed);
  console.log(tryDecode(remaining)?.value.id); // 2
}
```

With npm `0.4.12`, give `tryDecode` one complete frame at a time. That release
reports the length of the supplied buffer. On `main` the top-level helpers
also respect a `SmartBuffer`’s current read offset. Use
`serializer.decode(cursor)` to advance the cursor as you read.

## Measuring performance {#performance}

Benchmark the payload and runtime you deploy. A short RPC request, a large
collection and a registered extension exercise different paths. The package
compares encoding and decoding separately. From a built Omni checkout run

```sh
node packages/msgpack/bench/mixed-workload.js
node packages/msgpack/bench/large-arrays.js
```

Decode measurements on `main` use pre-encoded input. Record the Node version,
workload and output size when comparing two revisions.

## Error round-trips {#error-round-trips}

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

## SmartBuffer {#smartbuffer}

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

## API surface {#api-surface}

| Export | Use |
| --- | --- |
| `encode(value)` | Encode one value with the shared default serializer. |
| `decode(bytes)` | Read a value or throw a decoding error. |
| `tryDecode(bytes)` | Read a value and its consumed length, or return `null`. See [Reading a message](#safe-decoding--trydecode) for release-specific framing. |
| `serializer` | Access the shared serializer and its registered extensions. |
| `Serializer` | Create an independent codec registry with this named export. |
| `registerCommonTypesFor(instance)` | Register the package's common JavaScript extensions on an instance. |
| `SmartBuffer` | Build or read byte sequences. Import from `@omnitron-dev/msgpack/smart-buffer`. |

## Where it is used {#where-its-used-in-the-stack}

Titan's Netron packet serializer and the Netron browser client each configure a
`Serializer` with the codecs their peers share. The packet layer also defines
service references and typed errors. [Netron serialization](../titan/netron/serialization.md)

## Wire compatibility {#spec-compliance}

Plain objects encode their own enumerable string keys. On `main`, up to 15
pairs use `fixmap`, 16 through 65,535 use `map16`, and larger objects use
`map32`. Bidirectional tests cover 65,535, 65,536 and 70,000 pairs with
`@msgpack/msgpack`. Each Omnitron peer that sends or receives a map above
65,535 pairs needs the fix from `main`. [MessagePack map formats](https://github.com/msgpack/msgpack/blob/master/spec.md#map-format-family)

A JavaScript `Map` uses extension 124 and preserves the types of its keys.
Peers using another implementation need matching codecs for Omnitron's
extension values.

## When to use vs JSON {#when-to-use-vs-json}

| Use MessagePack | Use JSON |
| --------------- | -------- |
| RPC where types must round-trip | Browser-debuggable HTTP APIs |
| Storage where size matters | Configuration files |
| Binary-heavy payloads | Human-readable logs |
| Cross-language preserving structure | Web standards (REST, GraphQL) |

For Omnitron itself: MessagePack for the wire, JSON for the
config / human inspection layer.

## See also {#see-also}

- [Netron transports](../frontend/netron/transports.md) — uses this as default wire format
- [common](./common.md) — sibling utility
- [eventemitter](./eventemitter.md) — used together in titan-events
