# Contributing

Thanks for your interest in the HOPE Metahuman SDK. Bug reports, documentation
fixes, and pull requests are all welcome.

## What lives here

This repository holds the **examples, documentation, and tooling** — all MIT
licensed. The SDK itself is proprietary and is built and published from a
private repository; it reaches this one only as a compiled bundle. See
[NOTICE.md](./NOTICE.md).

So a contribution here means one of:

- improving an example, or adding a new one;
- correcting or extending the documentation;
- improving the local tooling — the vendoring script, the server, the smoke test.

**A bug in the SDK itself cannot be fixed by a pull request here.** Open an
issue describing it and we will fix it upstream; the documentation still lives
here, so a pull request correcting what the docs _say_ is very welcome.

## Getting set up

Node 20+ and pnpm 9+.

```bash
git clone https://github.com/cornerstonex/hope-metahuman-sdk.git
cd hope-metahuman-sdk
pnpm install
pnpm example    # serves the static example on http://localhost:4173
```

The example works without the SDK bundle — it reports that the bundle is
missing rather than failing silently — which is enough for most documentation
and layout work. To exercise the real thing you need a licence:

```bash
pnpm vendor     # downloads the bundle and verifies its integrity
```

## Before you open a pull request

```bash
pnpm format:check && pnpm lint
```

CI runs those plus `pnpm smoke`, a browser check of the example page. It needs a
browser:

```bash
pnpm exec playwright install chromium   # once
pnpm smoke
```

The smoke test skips with an explanation rather than failing when no browser is
available, so you can leave it to CI if you would rather not install one. With
the bundle vendored it additionally covers the custom element, WebGL rendering,
and the session lifecycle; without it, the page-level checks still run.

## Conventions

**Everything here is plain JavaScript.** No TypeScript, no build step. The
examples must run from any static web server exactly as they appear in the
repository — that is the point of them, and a build step would quietly break the
promise the documentation makes.

**JSDoc on every exported function**, including `@param` and `@returns` where
they apply. Say why the thing exists and what will surprise the reader; do not
restate the signature in prose.

**Comment non-obvious constraints only.** A comment explaining that the loader
uses `HEAD` rather than a caught `import()` so a missing bundle does not put a
confusing 404 in the console is worth having. A comment saying
`// increment the counter` is not.

**Examples are teaching material.** Prefer the clear version over the clever
one, and handle the error cases — someone will copy this into production
whatever the README says.

**Never commit the SDK bundle or a GLB model.** Both are separately licensed and
committing either would relicense someone else's property by accident. CI
rejects them, and `examples/static-chat/vendor/` is git-ignored.

## Security-sensitive changes

This SDK is used in front of systems on a FedRAMP Moderate authorization path.
Anything in an example that touches credentials, transport, or logging gets
closer review:

- Credentials never go to `localStorage`, `sessionStorage`, or a cookie. The
  example deliberately excludes the token when it persists settings — keep it
  that way.
- Errors never include a credential or an unredacted URL that carries a token.
- No API key secret may become reachable from a browser code path. Examples must
  demonstrate the token-endpoint pattern, never a key in page source.
- New network destinations must be documented so integrators can update their
  Content Security Policy.

If a change relaxes one of these, say so explicitly in the pull request and
explain why it is necessary.

## Reporting a vulnerability

Do not open a public issue. See [SECURITY.md](./SECURITY.md).

## Adding an example

The roadmap has framework packages coming — React, Angular, React Native — and
each needs a worked example. Add it as a directory under `examples/`, with:

- a `README.md` covering what it shows, how to run it, and what it needs;
- no committed SDK bundle and no committed model;
- a real error path, not just the happy one.

## Commit messages

Present tense, imperative, explaining the why:

```
Report a missing SDK bundle on the page instead of failing silently
```

## Licence

Contributions are accepted under the [MIT License](./LICENSE), the same terms
that cover this repository's contents.
