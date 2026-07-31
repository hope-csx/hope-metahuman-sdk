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
 * localhost, serves one directory, and does nothing else. In particular it
 * mints no credentials — enter an API key in the page's settings panel for a
 * quick local trial, or run `examples/token-server` for the production shape.
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
  console.log('Press Ctrl+C to stop.');
});
