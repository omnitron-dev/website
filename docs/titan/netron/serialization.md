---
sidebar_position: 7
title: Serialization
description: msgpack as the wire format — types, custom codecs, when to override.
---

# Serialization

Netron serialises every payload (arguments, return values, errors) as
msgpack. The choice is deliberate: msgpack is binary, compact,
self-describing, and supported across every runtime Titan targets.

## What msgpack handles natively

| Type                | Wire form                              |
| ------------------- | -------------------------------------- |
| `null` / `undefined`| nil                                    |
| `boolean`           | true / false                           |
| `number`            | int (8/16/32/64) or float (32/64)      |
| `string`            | utf-8 with length prefix               |
| `Buffer` / `Uint8Array` | bin (raw bytes)                    |
| Plain objects       | map                                    |
| Arrays              | array                                  |
| `Date`              | timestamp (extension type -1)          |

Anything else — `BigInt`, `Map`, `Set`, custom classes — needs
explicit handling.

## Extensions Titan ships

Titan registers msgpack extension types for common cases:

| Type           | Extension code | Notes                                     |
| -------------- | -------------- | ----------------------------------------- |
| `Date`         | -1             | ISO timestamp, microsecond precision      |
| `BigInt`       | 0x10           | Encoded as a string                       |
| `Map`          | 0x11           | Encoded as `[key, value][]`               |
| `Set`          | 0x12           | Encoded as `value[]`                      |
| `Error`        | 0x13           | Encoded as `{ name, message, stack }`     |
| `TitanError`   | 0x14           | Full structured error preserving class    |

The `TitanError` extension is what makes typed errors travel across
the wire intact. When the receiver decodes a packet with extension
0x14, it instantiates the matching error class.

## Custom types

For domain types you want to send as themselves (preserving class
identity on the receiver), register a custom codec:

```typescript
import { registerCodec } from '@omnitron-dev/titan/netron';

class Money {
  constructor(public readonly amount: bigint, public readonly currency: string) {}
}

registerCodec({
  code:   0x20,
  type:   Money,
  encode: (m: Money) => msgpack.encode([m.amount.toString(), m.currency]),
  decode: (buf: Uint8Array) => {
    const [amount, currency] = msgpack.decode(buf) as [string, string];
    return new Money(BigInt(amount), currency);
  },
});
```

Both sides must register the same codec. Otherwise the receiver
sees an unknown extension and falls back to the raw byte form.

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

The default max payload size is 10 MB per call. Over that, the
transport rejects with `ProtocolError`. Configurable per transport
(`maxPayloadBytes`).

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
