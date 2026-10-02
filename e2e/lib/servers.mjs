/**
 * Test servers shared by the M6 scripts:
 *  - "CDN" (origin A): /embed.js, /configurator/* (built), gzip, long cache for hashed assets
 *  - manufacturer page (origin B): /sauny (embed below the fold), /sauny-top (embed at the top), /baseline (no embed)
 */
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png' };

function serve(port, resolve) {
  const s = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = await resolve(path);
    try {
      let body = await readFile(f.path);
      if (f.transform) body = Buffer.from(f.transform(body.toString()));
      const gz = /\.(js|css|html|wasm)$/.test(f.path) && /gzip/.test(req.headers['accept-encoding'] ?? '');
      res.writeHead(200, {
        'content-type': TYPES[extname(f.path)] ?? 'application/octet-stream',
        'cache-control': /\/assets\//.test(path) ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
        ...(gz ? { 'content-encoding': 'gzip' } : {}),
      });
      res.end(gz ? gzipSync(body) : body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((r) => s.listen(port, '127.0.0.1', () => r(s)));
}

/** configuratorDist: built configurator (with or without VITE_API_BASE). */
export async function startSites({ cdnPort = 0, hostPort = 0, configuratorDist = join(root, 'apps/configurator/dist') } = {}) {
  const cdn = await serve(cdnPort, async (p) => {
    if (p === '/embed.js') return { path: join(root, 'apps/embed/dist/embed.js') };
    if (p.startsWith('/configurator/')) return { path: join(configuratorDist, p.slice('/configurator/'.length) || 'index.html') };
    return { path: '/nonexistent' };
  });
  const cdnBase = `http://127.0.0.1:${cdn.address().port}`;
  const hostFile = join(root, 'apps/embed/demo/host.html');
  const host = await serve(hostPort, async (p) => {
    if (p === '/baseline') return { path: hostFile, transform: (s) => s.replace(/<!-- the embed snippet[\s\S]*?<div data-sauna-configurator><\/div>/, '') };
    if (p === '/sauny-top') return { path: hostFile, transform: (s) => s.replace('__CDN__', cdnBase).replace('<div class="hero">', '<div data-sauna-configurator-top></div><div class="hero">').replace('<div data-sauna-configurator></div>', '').replace('<div data-sauna-configurator-top></div>', '<div data-sauna-configurator></div>') };
    return { path: hostFile, transform: (s) => s.replace('__CDN__', cdnBase) };
  });
  const hostBase = `http://localhost:${host.address().port}`;
  return { cdnBase, hostBase, close: () => Promise.all([new Promise((r) => cdn.close(r)), new Promise((r) => host.close(r))]) };
}
