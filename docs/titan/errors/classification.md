---
sidebar_position: 4
title: Error Classification
description: Categorise errors for telemetry, retry, and alerting decisions.
---

# Error Classification

Different kinds of failure deserve different responses. A 404 is not
a 500. A timeout is not an auth failure. Titan provides classifier
helpers in two places.

## `ErrorCode`-driven classification

The fastest classification uses the error code itself. For a known
`ErrorCode`:

```typescript
import {
  ErrorCode,
  ErrorCategory,
  getErrorCategory,
  isClientError,
  isServerError,
  isRetryableError,
  getErrorName,
  getDefaultMessage,
} from '@omnitron-dev/titan/errors';

const code = ErrorCode.SERVICE_UNAVAILABLE;

getErrorCategory(code);   // ErrorCategory.ServerError (or similar)
isClientError(code);      // false  — 5xx
isServerError(code);      // true
isRetryableError(code);   // true   — 503 is retryable
getErrorName(code);       // 'SERVICE_UNAVAILABLE'
getDefaultMessage(code);  // 'Service is currently unavailable'
```

These helpers operate on the code alone — no need for the full error
instance. Useful in middleware and telemetry where you only have the
code.

## `ErrorCategory` enum

```typescript
import { ErrorCategory } from '@omnitron-dev/titan/errors';

ErrorCategory.ClientError    // 4xx-equivalent
ErrorCategory.ServerError    // 5xx-equivalent
// …additional categories as needed
```

The mapping from `ErrorCode` to `ErrorCategory` is the
implementation's responsibility (`getErrorCategory(code)`); the
enum is the vocabulary.

## `isOperationalError(error)` — for retry decisions

Operational errors are those caused by external systems (network,
disk, database, third-party API) — distinct from programming bugs.
They are typically retryable.

```typescript
import { isOperationalError } from '@omnitron-dev/titan/utils';

if (isOperationalError(e)) {
  // Retry, log, alert as transient.
} else {
  // Programming error — log with full stack and fix the bug.
}
```

The classifier recognises:

- Postgres `SQLSTATE` codes in the operational set (connection
  failure, timeout, serialization, etc.).
- Network error codes (`ECONNREFUSED`, `ETIMEDOUT`, `EHOSTUNREACH`,
  `ENETUNREACH`, …).
- Specific framework errors with retry hints.

You can extend the operational set with
`createOperationalErrorRecorder` — see the source in
`utils/error-classification.ts`.

## Putting it together

A typical retry / telemetry pattern:

```typescript
import { isOperationalError } from '@omnitron-dev/titan/utils';
import { TitanError, isRetryableError } from '@omnitron-dev/titan/errors';

async function callWithRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const retryable =
        isOperationalError(e) ||
        (e instanceof TitanError && isRetryableError(e.code));
      if (!retryable) throw e;
      await sleep(computeBackoff({ attempt, baseMs: 100, maxMs: 5_000 }));
    }
  }
  throw lastError;
}
```

For ready-made resilience, use `retry()` and `CircuitBreaker` from
`@omnitron-dev/titan/utils/resilience.ts` — see
[Resilience](../resilience/overview.md).

## Telemetry partitioning

```typescript
catch (e) {
  const code =
    e instanceof TitanError ? e.code : ErrorCode.INTERNAL_ERROR;
  metrics.counter('rpc.errors', {
    code:    String(code),
    category: getErrorCategory(code),
  }).inc();
  throw e;
}
```

Now your dashboards can show "client errors" separately from "server
errors" — the former are usually client bugs; the latter usually
indicate something wrong on your side.

## Alerting policy

```typescript
app.on(ApplicationEvent.Error, ({ error }) => {
  const code = error instanceof TitanError ? error.code : ErrorCode.INTERNAL_ERROR;

  if (isServerError(code) || isRetryableError(code)) {
    oncall.page({ error });
  }
  if (code === ErrorCode.UNAUTHORIZED || code === ErrorCode.FORBIDDEN) {
    securityFeed.report(error);
  }
});
```

## Anti-patterns

- **Retrying based on `instanceof Error`.** Catches everything,
  including programming bugs (which will fail again) and validation
  errors (which won't change). Classify before retrying.
- **String-matching error messages.** Brittle. If the message
  changes (i18n, library upgrade), classification breaks silently.
  Use codes.
- **Treating all 5xx as transient.** A 500 is usually a bug, not a
  transient failure. Be specific about which codes warrant retry
  (`isRetryableError(code)` is the safe default).

→ Back to [Errors Overview](./overview.md).
