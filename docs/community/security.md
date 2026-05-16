---
sidebar_position: 2
title: Security policy
description: How to report vulnerabilities + supported versions + disclosure SLA.
---

# Security policy

## Supported versions

| Version | Supported |
| ------- | :-------: |
| `0.x.x` (current) | ✓ |
| Pre-`0.1.0` development versions | ✗ |

Once stable releases begin, support windows will be:

- **Current major** — full security + bug fixes.
- **Previous major** — security fixes only for 12 months after
  the next major's release.

## Reporting a vulnerability

**Do not open public GitHub issues** for security reports.

Email reports to: **security@omnitron.dev**

Include:

1. Affected package(s) and version(s).
2. A clear description of the vulnerability.
3. Steps to reproduce or proof-of-concept code.
4. Impact assessment (data exposure, RCE, DoS, etc.).
5. Suggested mitigation, if known.
6. Your name + affiliation (optional — for credit).

Encrypt with our PGP key if the report contains exploit
details:

```
[PGP key fingerprint published at omnitron.dev/.well-known/security.txt]
```

## What happens next

| Timeline | What we do |
| -------- | ---------- |
| **24 hours** | Acknowledge receipt of your report. |
| **72 hours** | Initial triage; severity classification. |
| **7 days** | Confirmed vulnerability → fix in development; assigned CVE if appropriate. |
| **30 days** | Patch released (sooner for critical / actively exploited). |
| **+30 days** | Public disclosure with your credit (if you wish). |

For exceptionally severe issues (active exploitation, mass
impact), the timeline compresses — we coordinate with you on
a faster track.

## Severity classification

We use CVSS v3.1 base scores:

| Score | Severity | Response |
| ----- | -------- | -------- |
| 9.0 – 10.0 | **Critical** | Patch within 7 days; coordinated disclosure |
| 7.0 – 8.9  | **High** | Patch within 14 days |
| 4.0 – 6.9  | **Medium** | Patch in next regular release (≤ 30 days) |
| 0.1 – 3.9  | **Low** | Patch in next regular release (≤ 60 days) |

## Disclosure

When a fix is released:

1. We publish a **security advisory** on GitHub.
2. The release notes call out the fix with a CVE reference (if
   assigned) and credit the reporter.
3. Users are notified through:
   - The release feed on the docs site.
   - GitHub Security Advisories.
   - The `@omnitron-dev/titan` npm package security advisory.

## Scope

In-scope: every npm package under `@omnitron-dev/*` shipped from
the [omni](https://github.com/omnitron-dev/omni) repository.

Out-of-scope:

- The docs site at omnitron.dev (report to GitHub issues; not
  security-sensitive).
- Third-party plugins / community modules — report to their
  maintainers.
- Issues in upstream dependencies — report to those projects
  first; we'll coordinate downstream patching.

## What we look at first

Highest-risk areas:

1. **Auth** — JWT verification, session handling, token
   binding, refresh rotation.
2. **RPC** — wire-format parsing (MessagePack), middleware,
   route auth.
3. **Database** — RLS, query construction, parameter binding.
4. **Process supervision** — Omnitron daemon RBAC, secret
   storage, child process isolation.
5. **Infrastructure provisioning** — Docker container config,
   bare-metal SSH execution.

## Hall of fame

Researchers who responsibly disclosed vulnerabilities (with
permission to be named):

*None yet — the platform is too young for a list. Be the first.*

## Hardening guidance

Production deployment checklists per module:
[Security checklist](../titan/modules/security-checklist.mdx).

Operator-side hardening:
[Omnitron Auth & RBAC](../omnitron/auth-rbac.md) and
[Best practices](../omnitron/best-practices.md).

## Past advisories

None published. When a security advisory is published, it
will be linked here with the CVE, severity, affected versions,
and fix version.

## Contact

- **Vulnerability reports**: security@omnitron.dev (PGP optional)
- **General security questions**: discuss in GitHub Discussions
- **PGP key**: published at `omnitron.dev/.well-known/security.txt`

Thank you for helping keep the platform secure.
