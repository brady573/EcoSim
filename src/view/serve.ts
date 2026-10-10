/**
 * Minimal static server for the experimental viewer.
 *
 * Zero new dependencies. `typescript` is already in the repo's toolchain, so
 * TypeScript sources are transpiled in-process with the compiler API and
 * served as native ES modules. PixiJS is served from the existing
 * `node_modules`. Nothing is fetched from the network: the product is
 * offline-first and this keeps the experiment offline too.
 *
 * This is a developer convenience for the experiment, not a product server.
 *
 * Run: pnpm view   (then open the printed URL)
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This file lives at <experiment>/src/view/, so two levels up is the
// experiment root and one more is the repository root holding node_modules.
const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)));
const EXPERIMENT_ROOT = resolve(HERE, '..', '..');
/**
 * Prebuilt browser bundle directory.
 *
 * The repo's `typescript` is the 7.x native port, whose JS package is only a
 * shim that locates a native binary - it exposes no `transpileModule`, so
 * on-the-fly transpilation is not available without adding a dependency.
 * Instead the build step compiles with `tsc -p tsconfig.build.json` first and
 * this server serves the emitted ESM. Still zero new dependencies.
 */
const BUILD_ROOT = resolve(EXPERIMENT_ROOT, 'build');
const REPO_ROOT = resolve(EXPERIMENT_ROOT, '..', '..');
const PIXI_ENTRY = resolve(REPO_ROOT, 'node_modules', 'pixi.js', 'dist', 'pixi.mjs');

const PORT = Number(process.env.PORT ?? 5178);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const server = createServer((req, res) => {
  void handle(req, res).catch((err: unknown) => {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(`server error: ${String(err)}`);
  });
});

async function handle(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): Promise<void> {
  const url = (req.url ?? '/').split('?')[0];

  if (url === '/' || url === '/index.html') {
    return sendFile(res, join(EXPERIMENT_ROOT, 'src', 'view', 'index.html'));
  }

  // PixiJS served from the existing install, exposed as a bare specifier.
  if (url === '/pixi.mjs') {
    return sendFile(res, PIXI_ENTRY);
  }

  // Anything else maps 1:1 into the prebuilt bundle.
  const rel = normalize(url.replace(/^\/+/, ''));
  const target = resolve(BUILD_ROOT, rel);
  // Path traversal guard: the resolved path must stay inside the build dir.
  if (!target.startsWith(BUILD_ROOT)) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('forbidden');
    return;
  }

  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error('not a file');
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end(`not found: ${url}`);
    return;
  }

  await sendFile(res, target);
}

async function sendFile(res: import('node:http').ServerResponse, path: string): Promise<void> {
  const body = await readFile(path);
  const type = MIME[extname(path)] ?? 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`experimental viewer (DEVELOPMENT SERVER, offline, no new dependencies)`);
  console.log(`  http://127.0.0.1:${PORT}/`);
  console.log(`  serving   ${BUILD_ROOT}`);
  console.log(`  pixi.js   ${PIXI_ENTRY}`);
  console.log('This is an experimental POC viewer, not a product build.');
});