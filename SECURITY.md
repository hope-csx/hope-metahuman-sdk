# Security Policy

## Reporting a vulnerability

**Do not open a public issue for a security vulnerability.**

Report it through GitHub's private vulnerability reporting — the **Security** tab
of this repository, then **Report a vulnerability** — or by email to
**security@cornerstonex.ai**.

Please include what you can of the following: the affected package and version,
what an attacker could do with the flaw, the steps to reproduce it, and any
proof-of-concept code.

We acknowledge reports within three business days and aim to ship a fix for a
confirmed high-severity issue within thirty days. We will keep you updated while
we work, credit you in the advisory unless you would rather we did not, and let
you know before we publish.

## Supported versions

The latest minor release of each published package receives security fixes.
Pre-1.0, that means the latest release.

## Scope

In scope, and reportable here:

- the examples, documentation, and tooling in this repository;
- the SDK packages and browser bundles (`@hope-metahuman/sdk`,
  `@hope-metahuman/avatar-three`, `@hope-metahuman/embed`, and the bundles served
  from `cdn.hope-lms.app`). These are built from a private repository, so we will
  fix them there and publish a new release — please still report them here, or
  by email.

Out of scope: the HOPE Metahuman Service backend itself. Report those to
security@cornerstonex.ai as a service issue, not an SDK issue.

**Obfuscation is not a security control.** The published bundles are minified
and obfuscated to deter casual reuse of proprietary code, and we make no claim
beyond that. Deobfuscating a bundle is not a vulnerability, and neither is
recovering its logic. What _would_ be a vulnerability is finding a secret
embedded in one — there should be none, by design, because the bundle runs on a
machine the customer controls.

## Things that look like vulnerabilities but are not

**A machine token visible in a WebSocket URL.** The browser `WebSocket`
constructor cannot set request headers, so the token is passed as a query
parameter. It is a ten-minute credential, scoped to streaming endpoints, and
this is the documented behaviour. Server-side callers should set
`authMode: 'header'`. We would welcome a report showing a token leaking anywhere
we do not already expect it — an error message, a thrown stack, a log line.

**The `token` attribute on `<hope-metahuman>` being readable from the page.**
That is inherent to putting a credential in HTML. The attribute exists for local
testing and the documentation says so; `token-endpoint` is the supported path.

**An `AudioWorklet` compiled from a `blob:` URL.** The source is a constant in
the bundle and takes no external input. It keeps the SDK a single file with no
side-car assets. Integrators who cannot allow `blob:` can host the processor
themselves via the `workletUrl` option.

## Our commitments

The SDK will not store a credential in `localStorage`, `sessionStorage`, or a
cookie; it holds tokens in memory only. It will not include a credential in an
error message or log line. It will not disable TLS verification anywhere, for
any reason, including in tests. It adds no runtime dependency to the core
package, which keeps its supply chain to exactly what you can read here.

## Compliance context

This SDK is used in front of systems pursuing FedRAMP Moderate authorization
under NIST SP 800-53 Rev 5. Reports touching access control (AC),
identification and authentication (IA), or system and communications protection
(SC) are prioritized accordingly.
