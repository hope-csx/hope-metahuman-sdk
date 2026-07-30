#!/usr/bin/env node
/**
 * Minimal static file server for the example.
 *
 * ES modules cannot be loaded over `file://` — the browser applies CORS to
 * module scripts and blocks the origin-less scheme — so the example needs an
 * HTTP origin even though it is a static site. This serves one, with no
 * dependencies, so trying the example does not require choosing a web server
 * first.
 *
 * It is a development convenience, not a production server: it binds to
 * localhost, serves one directory, and does nothing else — unless the token
 * endpoint below is switched on, which is also development-only.
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'examples', 'static-chat'),
);
const port = Number.parseInt(process.env.PORT ?? '4173', 10);

/**
 * Path the example's `tokenEndpoint` setting points at by default.
 *
 * Serving it from here means a local trial does not have to re-paste a machine
 * token every ten minutes, which is otherwise the only option without a
 * backend. It stays off unless all three variables below are set, so the plain
 * `pnpm example` case is an unchanged static server.
 */
const TOKEN_PATH = '/api/hope/stream-token';

const credentials = {
  baseUrl: process.env.HOPE_API_BASE,
  clientId: process.env.HOPE_CLIENT_ID,
  clientSecret: process.env.HOPE_CLIENT_SECRET,
};
const tokenEndpointEnabled = Boolean(
  credentials.baseUrl && credentials.clientId && credentials.clientSecret,
);

/**
 * The most recent machine token, reused until it is close to expiring.
 *
 * @type {{ token: string, expiresAt: number } | null}
 */
let cached = null;

/**
 * Exchange the API key for a machine token, reusing the cached one while it
 * has more than a minute left. The margin covers the round trip plus the
 * clock skew the service tolerates, so a token is never handed out so close
 * to expiry that the WebSocket upgrade it is used for gets rejected.
 *
 * @returns {Promise<{ token: string, expiresIn: number }>}
 */
async function mintToken() {
  const now = Date.now();
  if (cached && cached.expiresAt - now > 60_000) {
    return { token: cached.token, expiresIn: Math.floor((cached.expiresAt - now) / 1000) };
  }

  const response = await fetch(new URL('/oauth/token', credentials.baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    }),
  });

  if (!response.ok) {
    // The body is deliberately not included: it is not guaranteed to be free
    // of the submitted credential in every failure mode.
    throw new Error(`Token grant failed with ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 600;
  cached = { token: body.access_token, expiresAt: now + expiresIn * 1000 };
  return { token: body.access_token, expiresIn };
}

/**
 * Answer the token endpoint with the shape `TokenEndpointProvider` expects.
 *
 * @param response - The HTTP response to write to
 */
async function serveToken(response) {
  try {
    const body = JSON.stringify(await mintToken());
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(body);
  } catch (error) {
    console.error(`[token] ${error.message}`);
    response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Could not mint a machine token' }));
  }
}

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = createServer((request, response) => {
  const requestPath = new URL(request.url ?? '/', 'http://localhost').pathname;

  if (tokenEndpointEnabled && requestPath === TOKEN_PATH) {
    void serveToken(response);
    return;
  }

  // normalize() collapses `..` segments before they are joined to the root, so
  // a crafted path cannot escape the served directory.
  const candidate = join(root, normalize(requestPath));
  const filePath = candidate.startsWith(root) ? candidate : root;

  void serve(filePath, response);
});

async function serve(filePath, response) {
  let target = filePath;
  try {
    const info = await stat(target);
    if (info.isDirectory()) target = join(target, 'index.html');
    await stat(target);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': CONTENT_TYPES[extname(target)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(target).pipe(response);
}

server.listen(port, '127.0.0.1', () => {
  console.log(`HOPE Metahuman Service example running at http://localhost:${port}`);
  if (tokenEndpointEnabled) {
    console.log(`Minting machine tokens at ${TOKEN_PATH} from ${credentials.baseUrl}`);
  }
  console.log('Press Ctrl+C to stop.');
});
