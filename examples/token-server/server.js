#!/usr/bin/env node
/**
 * A token endpoint for the HOPE Metahuman Service, in about forty lines of
 * Express.
 *
 * This is the piece every production integration needs and the only one the
 * SDK cannot supply for you: something that authenticates your visitor and,
 * for those allowed, exchanges your API key for a token that expires in ten
 * minutes. The API key secret stays in this process. The browser only ever
 * receives the token.
 *
 * It also serves the `static-chat` example, so the page and its credential
 * share an origin — which is what a real deployment looks like, and means
 * there is no CORS to configure between them. Point it at your own front end
 * by changing `STATIC_ROOT`, or delete that line if you only want the endpoint.
 *
 *   cp .env.example .env    # fill in your deployment and API key
 *   npm install
 *   npm start
 *
 * @license MIT
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATIC_ROOT = join(HERE, '..', 'static-chat');

const { HOPE_API_BASE, HOPE_CLIENT_ID, HOPE_CLIENT_SECRET } = process.env;
const PORT = Number.parseInt(process.env.PORT ?? '4173', 10);

if (!HOPE_API_BASE || !HOPE_CLIENT_ID || !HOPE_CLIENT_SECRET) {
  console.error(
    'Missing configuration. Set HOPE_API_BASE, HOPE_CLIENT_ID, and HOPE_CLIENT_SECRET\n' +
      '(copy .env.example to .env, or export them), then start again.',
  );
  process.exit(1);
}

/**
 * The most recent token, reused until it is nearly expired.
 *
 * One cached token is shared across visitors on purpose: a machine token
 * identifies your *tenant*, not the person browsing, so minting one per
 * request would burn through the endpoint's rate limit to produce identical
 * credentials. Per-user identity belongs in your own session, checked in
 * `requireSignedInUser` below, before the token is ever handed out.
 *
 * @type {{ token: string, expiresAt: number } | null}
 */
let cached = null;

/**
 * Exchange the API key for a machine token via the client-credentials grant.
 *
 * The thirty-second margin covers the round trip and the clock skew the
 * service tolerates, so a token is never issued so close to expiry that the
 * WebSocket upgrade it was fetched for is rejected in flight.
 *
 * @returns {Promise<{ token: string, expiresIn: number }>}
 */
async function mintToken() {
  const now = Date.now();
  if (cached && cached.expiresAt - now > 30_000) {
    return { token: cached.token, expiresIn: Math.floor((cached.expiresAt - now) / 1000) };
  }

  const response = await fetch(new URL('/oauth/token', HOPE_API_BASE), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: HOPE_CLIENT_ID,
      client_secret: HOPE_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    // Deliberately not including the response body. It is not guaranteed to be
    // free of the submitted credential in every failure mode, and this message
    // is going straight into a log.
    throw new Error(`Token grant failed with ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 600;
  cached = { token: body.access_token, expiresAt: now + expiresIn * 1000 };
  return { token: body.access_token, expiresIn };
}

/**
 * Replace this with your application's real authentication.
 *
 * **This is the security boundary of the whole integration.** Whoever gets
 * past here can hold a conversation at your expense, so this should be the
 * same check that guards the rest of your signed-in area — a session cookie, a
 * JWT, whatever you already use. Left open, this endpoint is a public one, and
 * an unlisted URL is not access control.
 *
 * @type {import('express').RequestHandler}
 */
function requireSignedInUser(req, res, next) {
  // Example: if (!req.session?.userId) return res.sendStatus(401);
  next();
}

const app = express();

app.get('/api/hope/stream-token', requireSignedInUser, async (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store').json(await mintToken());
  } catch (error) {
    console.error(`[token] ${error.message}`);
    res.status(502).json({ error: 'Could not mint a machine token' });
  }
});

app.use(express.static(STATIC_ROOT, { etag: false, maxAge: 0 }));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Example with a token endpoint on http://localhost:${PORT}`);
  console.log(`Minting tokens from ${HOPE_API_BASE}`);
});
