# Token server example

The one piece of a production integration the SDK cannot supply for you: a
small endpoint on your own backend that authenticates your visitor and hands
the browser a token that expires in ten minutes.

```bash
cp .env.example .env    # fill in your deployment and API key
npm install
npm start
```

Open <http://localhost:4173>. It serves the
[`static-chat`](../static-chat) example alongside the endpoint, so the page and
its credential share an origin — as they would on a real site.

---

## Why this exists

An API key secret does not expire. Anything you ship to a browser is readable
by everyone who loads the page: view-source, devtools, a bundled environment
variable, a minified file. There is no way to put a secret on a page and keep
it secret.

So the secret stays here, in your server's environment, and the browser
receives only a short-lived token:

```
browser ──GET /api/hope/stream-token──▶ your server ──POST /oauth/token──▶ HOPE Metahuman Service
        ◀──── { token, expiresIn } ────              ◀──── access_token ────
        │
        └──WebSocket, bearing the token──▶ HOPE Metahuman Service
```

Two properties make this safe: your own authentication runs first, and what
the browser receives is useless in ten minutes.

## The part you must change

`requireSignedInUser` in [`server.js`](./server.js) is a no-op placeholder, and
it is the security boundary of the entire integration. Anyone who gets past it
can hold a conversation at your expense. Replace it with the same check that
guards the rest of your signed-in area:

```js
function requireSignedInUser(req, res, next) {
  if (!req.session?.userId) return res.sendStatus(401);
  next();
}
```

An unlisted URL is not access control. As written, this endpoint is public.

## Notes on the implementation

**One token is cached and shared.** A machine token identifies your tenant, not
the person browsing, so minting one per request would burn through the token
endpoint's rate limit to produce identical credentials. Per-visitor identity is
your session's job, checked before the token is handed out.

**Error responses never include the upstream body.** It is not guaranteed to be
free of the submitted credential in every failure mode, and these messages go
straight into logs.

**Do not proxy the WebSockets.** Only the token exchange belongs on your
backend. Let the browser connect to the service directly — relaying audio
through your server adds latency to a latency-sensitive path.

## Deploying it

Serve over HTTPS: browsers refuse microphone access outside a secure context.
The public HOPE API accepts browser requests from every origin and does not
require origin registration. Authentication, tenant scope, and rate limits
remain in force.

If your front end is hosted separately — a static host, a CDN, a different
domain — this endpoint needs CORS of its own, and the SDK needs
`credentials: 'include'` to send your session cookie:

```js
app.use(cors({ origin: 'https://app.example.com', credentials: true }));
```

Same-origin, as this example runs, needs neither.

## In other frameworks

The endpoint is a POST to `/oauth/token` and a JSON response; nothing here is
Express-specific, and nothing here needs the SDK. The SDK is a browser bundle
distributed from the CDN, so it is not something a server imports at all — the
exchange is two HTTP calls and a cached expiry, which `server.js` does in about
twenty lines and which ports to any runtime that can make an HTTPS request.

Keep three properties whatever you build it in:

- **Never return the client secret**, and never let it reach the browser. The
  browser receives only the short-lived machine token.
- **Authenticate the caller first.** `requireSignedInUser` stands in for your
  own session check; without it the endpoint mints tokens for anyone.
- **Cache the token and re-request it before it expires**, rather than
  exchanging on every page load. Treat the expiry as advisory and refresh
  early. The SDK's provider fetches a fresh token for subsequent connections;
  a directly supplied static token must be replaced by its caller.
