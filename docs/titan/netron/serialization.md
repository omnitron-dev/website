---
sidebar_position: 7
title: Serialization
description: msgpack as the wire format — types, custom codecs, when to override.
---

# Serialization

Netron serialises every payload (arguments, return values, errors)
into a compact binary form via `@omnitron-dev/msgpack` — an in-house,
`SmartBuffer`-based serializer that follows the msgpack format. It is
**not** the npm `@msgpack/msgpack` library and is **not**
wire-compatible with it. The serializer is binary, self-describing, and
shared across every runtime Titan targets. Netron's wire layer keeps a
single shared instance, `serializer`, in
`packages/titan/src/netron/packet/serializer.ts`; the core
encode/decode and the common-type registrations live in
`packages/msgpack/src/`.

## What the serializer handles natively

| Type                | Wire form                              |
| ------------------- | -------------------------------------- |
| `null` / `undefined`| nil                                    |
| `boolean`           | true / false                           |
| `number`            | int (8/16/32/64) or float (32/64)      |
| `string`            | utf-8 with length prefix               |
| `Buffer` / `Uint8Array` | bin (raw bytes)                    |
| Plain objects       | map                                    |
| Arrays              | array                                  |

Anything else — `Date`, `BigInt`, `Map`, `Set`, custom classes —
is handled through *registered types* (below).

## Registered types Titan ships

A registered ("extension") type is a single-byte code paired with an
`encode`/`decode` callback. Codes are a single byte, `0..127`, and the
registration map (`packages/msgpack/src/index.ts:11`) partitions the
range like this:

- **`119..126`** — standard library / runtime types (the common-type
  registrations).
- **`110..118`** — reserved (`TitanError` is registered here, at
  `110`, by the Titan wire layer).
- **`100..109`** — Netron's own proxy/stream wiring.
- **`1..99`** — free for your own custom types.

The common types registered by
`registerCommonTypesFor` (`packages/msgpack/src/index.ts:7`):

| Type    | Code  | Wire form                                                       |
| ------- | ----- | --------------------------------------------------------------- |
| `Long`  | `119` | unsigned flag + 64-bit int (the `long` package)                 |
| `BigInt`| `120` | encoded as a decimal string                                     |
| `RegExp`| `121` | `source` + `flags`                                              |
| `Set`   | `123` | size prefix + each value                                        |
| `Map`   | `124` | size prefix + each `key`, `value`                               |
| `Date`  | `125` | epoch millis as `UInt64` (not ISO)                              |
| `Error` | `126` | std-error id + `name` / `stack` / `message` + own custom fields |

(`122` is reserved and unused.)

The Titan wire layer
(`packages/titan/src/netron/packet/serializer.ts`) registers the rest:

| Type              | Code  | Notes                                              |
| ----------------- | ----- | -------------------------------------------------- |
| `TitanError`      | `110` | Full structured error, preserving class + code     |
| `Definition`      | `109` | Service definition metadata (internal)             |
| `Reference`       | `108` | Service reference (internal proxy wiring)           |
| `StreamReference` | `107` | Stream handle (internal; see [Streaming](./streaming.md)) |

`TitanError` (code `110`) is what makes typed errors travel across the
wire intact. It is registered **before** the common types
(`serializer.ts:113`) precisely so its handler is checked ahead of the
generic `Error` handler (`126`) — `TitanError` extends `Error`, so the
more specific codec must win. On decode it reconstructs the matching
error with its `code`, `message`, tracing fields, `cause` chain, and
any subclass-specific fields (`serviceId`, `requiredPermission`,
`retryAfter`, …). Stack traces are **omitted on the wire by default**
(`serializer.ts:150`, security policy T#38) to avoid leaking
server-internal paths; dev tooling can opt in via
`setSerializerErrorOptions({ includeStackTraces: true })`.

## Custom types

For domain types you want to send as themselves (preserving class
identity on the receiver), register a type on the shared `serializer`.
The signature is **positional**:

```
serializer.register(typeCode, constructor, encode, decode)
```

(`packages/msgpack/src/serializer.ts:41`). `typeCode` must be in
`0..127` or `register` throws a `RangeError`; pick one in the
**`1..99`** user band, since `100..126` are reserved (see the tables
above). The `encode` callback is `(value, buf) => void` and the
`decode` callback is `(buf) => value` — neither returns bytes. `buf` is
a `SmartBuffer`: write fields with `serializer.encode(field, buf)` and
read them back, in the **same order**, with `serializer.decode(buf)`
(or use the buffer's typed primitives directly, like the built-in
`Date` codec does with `writeUInt64BE`/`readUInt64BE`).

```typescript
import { serializer } from '@omnitron-dev/titan/netron';

class Money {
  constructor(public readonly amount: bigint, public readonly currency: string) {}
}

serializer.register(
  32,                                       // user-defined code in the 1..99 band
  Money,
  (m: Money, buf) => {                      // encode: write fields into buf
    serializer.encode(m.amount.toString(), buf);
    serializer.encode(m.currency, buf);
  },
  (buf) => {                                // decode: read fields back, same order
    const amount   = serializer.decode(buf) as string;
    const currency = serializer.decode(buf) as string;
    return new Money(BigInt(amount), currency);
  },
);
```

Both peers must register the same constructor against the same code,
with codecs that agree on field order. If only one side registers it,
or the codes differ, the receiver cannot reconstruct the value.

## When NOT to use a custom codec

- **For JSON-shaped data.** Plain objects and arrays serialise
  natively. A custom codec for `User` or `Order` adds overhead
  without changing semantics.
- **For one-off types.** Custom codecs are infrastructure. If only
  one method uses a type, just send a plain object and reconstruct
  on the other side.
- **When you can't update both sides.** Codec mismatches are
  silent — the receiver will get raw bytes and not know what to do.

## Payload limits

The default packet ceiling is **16 MiB**
(`DEFAULT_MAX_PACKET_SIZE`, `packet/index.ts:204`), overridable per
transport via the `maxPacketSize` option (`transport/types.ts:107`). It
is checked inside `decodePacket` **before** the msgpack decoder runs
(`packet/index.ts:209`), so an oversized frame can't force a matching
scratch allocation and OOM the host. Over the limit, decoding throws a
`TitanError` with code `PAYLOAD_TOO_LARGE` (HTTP 413). TCP additionally
rejects on the *declared* length before reading the body
(`tcp-transport.ts:148`).

Each transport also has its own body/frame cap layered on top: the
HTTP transport caps request bodies (default **10 MB**; the public
option is `maxRequestSize` as a human string like `'10mb'` —
`transport/types.ts:152`), and WebSocket has its own numeric
`maxPayload` (`websocket/types.ts:25`). There is no `maxPayloadBytes`
option.

For larger transfers (file uploads, bulk data), use:

- **Streaming methods** — yield chunks instead of one big array.
- **Out-of-band transfer** — pass a URL or storage key over Netron;
  fetch/upload bytes via a separate HTTP path.

## Round-trip type fidelity

Most types round-trip cleanly:

- `Date` → encoded as timestamp → decoded as `Date`.
- `BigInt(123n)` → encoded as string → decoded as `123n`.
- `new Map([['a', 1]])` → encoded as `[['a', 1]]` → decoded as `Map`.

A few traps:

- **`undefined` in an object.** Encoded as `null`. The receiver
  cannot distinguish "key was set to undefined" from "key was
  null". Use `?:` optional fields and omit instead.
- **Function-valued properties.** Functions cannot be serialised.
  msgpack throws.
- **Cyclic references.** msgpack throws on cycles. Don't send
  graphs with `parent` back-references.
- **Class methods.** Only data is sent. The receiver gets a plain
  object unless a custom codec reconstructs.

## Performance

For typical service payloads (small objects with primitive fields),
msgpack encode/decode is under 10 µs per call. For large nested
payloads with many strings, expect tens of microseconds.

If serialisation is on your hot path, profile. Common wins:

- **Cache encoded payloads** for repeated identical responses.
- **Trim payloads** — only include fields the client needs.
- **Use streaming** for large collections.

## Anti-patterns

- **Sending entire DB rows.** Repository fetch returns a row with
  every column; the client needs three of them. Project to a smaller
  shape on the server.
- **String IDs as `BigInt`.** msgpack `BigInt` encoding is a
  string conversion both ways. If the value fits in a `Number`
  (≤ 2^53), use `number`; if it's a 64-bit DB ID, use `string`.
- **Encoding errors as plain objects.** Strips class identity. Use
  `TitanError` subclasses; the framework's codec preserves them.

→ Back to [Netron Overview](../netron.md).
