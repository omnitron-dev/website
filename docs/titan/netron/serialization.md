---
sidebar_position: 7
title: Serialization
description: msgpack as the wire format — types, custom codecs, when to override.
---

# Serialization

:::warning Verify before relying on specifics
Netron uses a custom binary serializer
(`@omnitron-dev/msgpack`), **not** the npm `@msgpack/msgpack`
library. The custom-codec API and the extension-code table below were
corrected against source on review, but the registration surface is
low-level; confirm against `packages/msgpack/src/serializer.ts` and
`packages/titan/src/netron/packet/serializer.ts` for the version you
target.
:::

Netron serialises every payload (arguments, return values, errors)
into a compact binary form via `@omnitron-dev/msgpack` — an in-house
serializer (SmartBuffer-based, msgpack-style). It is **not**
wire-compatible with the standard `@msgpack/msgpack` package. The
serializer is binary, self-describing, and shared across every runtime
Titan targets.

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

Titan registers extension types for common cases. Type codes are a
single byte in the range `0..127`; the standard library types occupy
the high band (`119..126`) and Netron's own types sit at `100..118`:

| Type           | Type code | Notes                                          |
| -------------- | --------- | ---------------------------------------------- |
| `TitanError`   | `110`     | Full structured error, preserving class + code |
| `Long`         | `119`     | 64-bit integer (the `long` package)            |
| `BigInt`       | `120`     | Encoded as a decimal string                    |
| `RegExp`       | `121`     | `source` + `flags`                             |
| `Set`          | `123`     | Encoded as `value[]`                            |
| `Map`          | `124`     | Encoded as `[key, value][]`                     |
| `Date`         | `125`     | Epoch millis as `UInt64` (not ISO)              |
| `Error`        | `126`     | `name` / `message` / `stack` + own fields       |

(Netron also registers `Reference` = `108`, `Definition` = `109`, and
`StreamReference` = `107` for its internal proxy/stream wiring.)

The `TitanError` type (code `110`) is what makes typed errors travel
across the wire intact, and it is registered **before** `Error` so the
more specific handler wins. When the receiver decodes a value tagged
`110`, it reconstructs the matching error class with its `code`.

## Custom types

For domain types you want to send as themselves (preserving class
identity on the receiver), register a type on the shared `serializer`.
The API is `serializer.register(typeCode, constructor, encode, decode)`
— **positional args**, and the `encode`/`decode` callbacks read and
write a `SmartBuffer` (they do not return bytes):

```typescript
import { serializer } from '@omnitron-dev/titan/netron';

class Money {
  constructor(public readonly amount: bigint, public readonly currency: string) {}
}

serializer.register(
  32,                                  // user-defined code in the 1..99 band
  Money,
  (m: Money, buf) => {                 // encode: write into buf
    serializer.encode(m.amount.toString(), buf);
    serializer.encode(m.currency, buf);
  },
  (buf) => {                           // decode: read from buf
    const amount   = serializer.decode(buf) as string;
    const currency = serializer.decode(buf) as string;
    return new Money(BigInt(amount), currency);
  },
);
```

Pick a code in the **`1..99`** user band (the `100..126` range is
reserved). Both sides must register the same type with the same code.
Otherwise the receiver cannot reconstruct the value.

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

The default packet ceiling is **16 MiB** (`maxPacketSize`), checked at
`decodePacket` before the decoder runs so an oversized frame can't
force a matching scratch allocation. Over the limit, decoding throws a
`TitanError` with code `PAYLOAD_TOO_LARGE` (HTTP 413). The HTTP
transport additionally caps request bodies at 10 MB (`maxRequestSize`,
e.g. `'10mb'`); WebSocket has its own `maxPayload`. There is no
`maxPayloadBytes` option.

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
