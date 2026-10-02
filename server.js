import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DRILLS } from './public/drills.js';

const PORT = process.env.PORT || 3000;
const TABS_DIR = 'data/tabs';
fs.mkdirSync(TABS_DIR, { recursive: true });

const db = new DatabaseSync('data/guitarhub.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS tabs (id INTEGER PRIMARY KEY, file TEXT NOT NULL, title TEXT, artist TEXT,
    tuning TEXT, tempo INTEGER, tags TEXT NOT NULL DEFAULT '', added_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS fingerings (tab_id INTEGER NOT NULL REFERENCES tabs ON DELETE CASCADE,
    track INTEGER NOT NULL, changes TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (tab_id, track));
  CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY, tab_id INTEGER REFERENCES tabs ON DELETE SET NULL,
    bars TEXT, bpm INTEGER, target_bpm INTEGER, rating INTEGER, notes TEXT, excerpt TEXT, at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS exercises (id INTEGER PRIMARY KEY, title TEXT, goal TEXT, technique TEXT, alphatex TEXT NOT NULL,
    start_bpm INTEGER, target_bpm INTEGER, current_bpm INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  PRAGMA foreign_keys = ON;
`);
// no migrations: add newer columns, ignoring "duplicate column" once they exist
for (const sql of ['ALTER TABLE exercises ADD COLUMN drill TEXT', 'ALTER TABLE exercises ADD COLUMN level INTEGER',
  'ALTER TABLE sessions ADD COLUMN exercise_id INTEGER']) try { db.exec(sql); } catch {}

// built-in drills are exercises rows too; a drill's next level is inserted once the previous one reaches its target
const addLevel = (d, level) => {
  const l = d.levels[level];
  return Number(db.prepare(`INSERT INTO exercises (title, goal, technique, alphatex, start_bpm, target_bpm, current_bpm, drill, level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(`${d.name} ${level + 1}: ${l.title}`, l.goal, d.name, l.alphatex,
    l.start_bpm, l.target_bpm, l.start_bpm, d.key, level).lastInsertRowid);
};
for (const d of DRILLS) if (!db.prepare('SELECT 1 FROM exercises WHERE drill = ?').get(d.key)) addLevel(d, 0);

const STATIC = { '/vendor/': 'node_modules/@coderline/alphatab/dist/', '/pdfjs/': 'node_modules/pdfjs-dist/legacy/build/',
  '/files/': TABS_DIR + '/', '/': 'public/' };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.sf2': 'application/octet-stream', '.woff2': 'font/woff2', '.woff': 'font/woff', '.otf': 'font/otf', '.svg': 'image/svg+xml' };

const json = (res, data, status = 200) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
};
const body = async req => { const chunks = []; for await (const c of req) chunks.push(c); return Buffer.concat(chunks); };

const routes = {
  'GET /api/tabs': (req, res, q) => {
    const like = `%${q.get('q') ?? ''}%`;
    json(res, db.prepare(`SELECT * FROM tabs WHERE title LIKE ? OR artist LIKE ? OR tags LIKE ? ORDER BY artist, title`).all(like, like, like));
  },
  // body = raw file bytes, metadata in the query string (parsed by alphaTab in the browser)
  'POST /api/tabs': async (req, res, q) => {
    const ext = path.extname(q.get('name') ?? '').toLowerCase();
    if (!['.gp3', '.gp4', '.gp5', '.gpx', '.gp'].includes(ext)) return json(res, { error: 'unsupported file type' }, 400);
    const file = `${Date.now()}${ext}`;
    fs.writeFileSync(path.join(TABS_DIR, file), await body(req));
    const r = db.prepare('INSERT INTO tabs (file, title, artist, tuning, tempo, tags) VALUES (?, ?, ?, ?, ?, ?)')
      .run(file, q.get('title'), q.get('artist'), q.get('tuning'), Number(q.get('tempo')) || null, q.get('tags') ?? '');
    json(res, { id: Number(r.lastInsertRowid) }, 201);
  },
  'GET /api/tabs/:id': (req, res, q, id) => {
    const tab = db.prepare('SELECT * FROM tabs WHERE id = ?').get(id);
    if (!tab) return json(res, { error: 'not found' }, 404);
    tab.fingerings = Object.fromEntries(db.prepare('SELECT track, changes FROM fingerings WHERE tab_id = ?').all(id)
      .map(f => [f.track, JSON.parse(f.changes)]));
    tab.sessions = db.prepare('SELECT * FROM sessions WHERE tab_id = ? ORDER BY at DESC').all(id);
    json(res, tab);
  },
  'PATCH /api/tabs/:id': async (req, res, q, id) => {
    const { tags } = JSON.parse(await body(req));
    db.prepare('UPDATE tabs SET tags = ? WHERE id = ?').run(String(tags), id);
    json(res, { ok: true });
  },
  'DELETE /api/tabs/:id': (req, res, q, id) => {
    const tab = db.prepare('SELECT file FROM tabs WHERE id = ?').get(id);
    if (tab) fs.rmSync(path.join(TABS_DIR, tab.file), { force: true });
    db.prepare('DELETE FROM tabs WHERE id = ?').run(id);
    json(res, { ok: true });
  },
  'PUT /api/tabs/:id/fingerings': async (req, res, q, id) => {
    const { track, changes } = JSON.parse(await body(req));
    db.prepare('INSERT OR REPLACE INTO fingerings (tab_id, track, changes) VALUES (?, ?, ?)').run(id, track, JSON.stringify(changes));
    json(res, { ok: true });
  },
  'POST /api/sessions': async (req, res) => {
    const s = JSON.parse(await body(req));
    db.prepare('INSERT INTO sessions (tab_id, bars, bpm, target_bpm, rating, notes, excerpt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(s.tab_id ?? null, s.bars ?? '', s.bpm || null, s.target_bpm || null, s.rating || null, s.notes ?? '', s.excerpt ?? '');
    json(res, { ok: true }, 201);
  },
  // ponytail: returns every session, add a date range if this grows past a few thousand
  'GET /api/sessions': (req, res) => json(res, db.prepare(`SELECT s.*, date(s.at, 'localtime') AS day, COALESCE(t.title, e.title) AS what
    FROM sessions s LEFT JOIN tabs t ON t.id = s.tab_id LEFT JOIN exercises e ON e.id = s.exercise_id ORDER BY s.at`).all()),
  'GET /api/exercises': (req, res) => json(res, db.prepare('SELECT * FROM exercises ORDER BY created_at DESC, id DESC').all()),
  // one play-through of an exercise: logged for the calendar; clean runs go up 5 bpm and can unlock the drill's next level
  'POST /api/exercises/:id/runs': async (req, res, q, id) => {
    const { clean } = JSON.parse(await body(req));
    const e = db.prepare('SELECT * FROM exercises WHERE id = ?').get(id);
    if (!e) return json(res, { error: 'not found' }, 404);
    db.prepare('INSERT INTO sessions (exercise_id, bpm, target_bpm, notes) VALUES (?, ?, ?, ?)')
      .run(id, e.current_bpm, e.target_bpm, clean ? 'clean' : 'sloppy');
    if (!clean) return json(res, {});
    const bpm = e.current_bpm + 5, d = DRILLS.find(d => d.key === e.drill), next = e.level + 1;
    db.prepare('UPDATE exercises SET current_bpm = ? WHERE id = ?').run(bpm, id);
    const unlock = bpm >= e.target_bpm && d?.levels[next] && !db.prepare('SELECT 1 FROM exercises WHERE drill = ? AND level = ?').get(d.key, next);
    json(res, unlock ? { unlocked: addLevel(d, next) } : {});
  },
  'DELETE /api/exercises/:id': (req, res, q, id) => {
    db.prepare('DELETE FROM exercises WHERE id = ?').run(id);
    json(res, { ok: true });
  },
};

// ---------- server ----------

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) {
      const m = url.pathname.match(/^(\/api\/\w+)(?:\/(\d+))?(\/\w+)?$/);
      const key = m && `${req.method} ${m[1]}${m[2] ? '/:id' : ''}${m[3] ?? ''}`;
      const handler = routes[key];
      if (!handler) return json(res, { error: 'not found' }, 404);
      return await handler(req, res, url.searchParams, m[2] && Number(m[2]));
    }
    const prefix = Object.keys(STATIC).find(p => url.pathname.startsWith(p));
    const rel = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
    const root = path.resolve(STATIC[prefix]);
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e);
    json(res, { error: e.message }, 500);
  }
}).listen(PORT, '127.0.0.1', () => console.log(`GuitarHub on http://localhost:${PORT}`));
