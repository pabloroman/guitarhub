// Local dev server: static files only. The data lives in Supabase (supabase/schema.sql), and the hosted
// site is these same files assembled by `npm run build`.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT || 3000;
const STATIC = { '/vendor/': 'node_modules/@coderline/alphatab/dist/', '/pdfjs/': 'node_modules/pdfjs-dist/legacy/build/',
  '/supabase/': 'node_modules/@supabase/supabase-js/dist/umd/', '/': 'public/' };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.sf2': 'application/octet-stream', '.woff2': 'font/woff2', '.woff': 'font/woff', '.otf': 'font/otf', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://x');
    const prefix = Object.keys(STATIC).find(p => pathname.startsWith(p));
    const rel = decodeURIComponent(pathname.slice(prefix.length)) || 'index.html';
    const root = path.resolve(STATIC[prefix]);
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e);
    res.writeHead(500); res.end(e.message);
  }
}).listen(PORT, '127.0.0.1', () => console.log(`GuitarHub on http://localhost:${PORT}`));
