---
title: Token issuance & transports
sidebar_position: 8
---

# Token issuance & transports

Where the tokens go after a successful sign-in is a **transport** decision, not
a service one. The same `signin` handler works whether tokens travel in the
response body for the client to store, or in `HttpOnly` cookies the client
never sees.

Service code says *what* to issue; the configured `ITokenTransport` decides
*how* it reaches the client.

```typescript
import { issueTokens, clearTokens, readRequestCookie } from '@omnitron-dev/titan/netron/auth';
```

## Issuing

```typescript
@Public()
async signin(dto: SigninDto) {
  const { user, accessToken, refreshToken } = await this.svc.signin(dto);
  issueTokens({ access: accessToken, refresh: refreshToken });
  return { user, accessToken, refreshToken };
}
```

Return the tokens in the body as written above, even in cookie mode. **Cookie
mode strips them from the body before serialisation**; bearer mode leaves the
body untouched. Writing the handler once, for both, is the point — a handler
that omits them cannot be switched to bearer, and one that omits `issueTokens`
cannot be switched to cookies.

`issueTokens` is idempotent: the last call in a request wins.

## Clearing

```typescript
@Public()
async signout() {
  await this.svc.revokeSession(...);
  clearTokens();
}
```

Cookie mode emits `Max-Age=0` for every registered cookie. Bearer mode is a
no-op — the client clears its own storage.

## Reading a cookie back

`readRequestCookie(name)` reads from the **current request's `Cookie` header**
and returns `null` when the header, or that cookie, is absent. It is the only
supported way for service code to see a value the client never put in the body:

```typescript
const refresh = request.refreshToken ?? readRequestCookie('omni_refresh');
```

That fallback order is deliberate. An explicit body value wins so the same
handler serves a bearer client; the cookie answers for a cookie-mode client
whose body carries nothing.

## How the context is found

Both helpers use `AsyncLocalStorage` to reach the current request's metadata,
so a `@Public` method does **not** have to accept a framework context argument.
The HTTP transport opens that frame around every handler invocation.

Outside such a frame — a unit test calling the helper directly, or middleware
holding its own context — pass the context explicitly:

```typescript
issueTokens(ctx, { access, refresh });   // ctx: Pick<NetronMiddlewareContext, 'metadata'>
clearTokens(ctx);
```

Calling either with no ambient frame and no explicit context **throws**, naming
the two ways out. It does not silently do nothing, which for a sign-out would
mean a session the user believes is closed.

## The transports

`Netron.tokenTransport` defaults to `BearerTokenTransport`.

| Transport   | `usesCookies` | `extract` reads         | `issue` writes                       |
| ----------- | ------------- | ----------------------- | ------------------------------------ |
| `bearer`    | `false`       | `Authorization` header  | nothing — the body carries the tokens |
| `cookie`    | `true`        | the `Cookie` header     | `Set-Cookie`, and strips the body     |
| `composite` | if either does | both, in order          | delegates                             |

`usesCookies` is not decoration: **two middlewares gate on it** — the CSRF
double-submit check and the origin check. Both skip when it is false, on the
reasoning that a bearer client attaches nothing automatically and so cannot be
made to act by a hostile page. A transport that carries cookies without
declaring it would therefore turn off both protections in silence.

`composite` exists for a migration: accept both while clients move, then drop
one. It reports `usesCookies` true if any member does, so the CSRF check stays
on for the whole window rather than for the half that needs it.

## CSRF is two pieces, and both are optional

Cookie mode does not turn CSRF protection on by itself. Two things have to be
configured, and each defaults to absent:

1. a `csrf` manager on `CookieTokenTransport`, which makes `issue()` emit a
   CSRF cookie (readable by client JS, unlike the auth cookies) on every
   sign-in and refresh, and clear it on sign-out;
2. `createCsrfMiddleware(...)` installed on the server, which enforces
   double-submit on protected RPCs.

| transport `csrf` | middleware | result |
| --- | --- | --- |
| set | installed | protected |
| set | absent | a CSRF cookie nobody checks |
| absent | installed | **every cookie-authenticated request rejected** — no cookie is ever issued to submit, so verification always fails |
| absent | absent | **no CSRF protection**, and nothing says so |

The third row fails loudly and immediately, which is the good case. The fourth
is the one to watch: a cookie-mode deployment with neither piece behaves
perfectly until somebody points a hostile page at it.

The middleware's own decisions are all fail-closed. A request whose `Request`
object is missing gets an empty header set rather than a bypass; verification
failure throws `FORBIDDEN` and logs `auth.csrf_violation` with the origin but
no token bytes. It skips only where CSRF cannot apply: bearer transports, the
exempt list (sign-in, refresh, sign-out — the calls that have no cookie yet),
and requests arriving with no access cookie at all, which are bearer or
anonymous.

## What each mode assumes of the client

Cookie mode means the browser holds credentials the JavaScript cannot read — no
token in `localStorage` to steal, and no token for the app to attach by hand.
In exchange the request needs CSRF protection, because the browser now attaches
credentials on its own.

Bearer mode is the reverse trade: the client is responsible for storage and for
sending the header, and no CSRF check is required because nothing is attached
automatically.
