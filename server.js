import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import * as alphaTab from '@coderline/alphatab';

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
  'GET /api/exercises': (req, res) => json(res, db.prepare('SELECT * FROM exercises ORDER BY created_at DESC, id DESC').all()),
  'PATCH /api/exercises/:id': async (req, res, q, id) => {
    const { current_bpm } = JSON.parse(await body(req));
    db.prepare('UPDATE exercises SET current_bpm = ? WHERE id = ?').run(Number(current_bpm), id);
    json(res, { ok: true });
  },
  'DELETE /api/exercises/:id': (req, res, q, id) => {
    db.prepare('DELETE FROM exercises WHERE id = ?').run(id);
    json(res, { ok: true });
  },
  'POST /api/tutor': async (req, res) => {
    const { request = '' } = JSON.parse((await body(req)).toString() || '{}');
    const exercises = await tutor(request);
    const insert = db.prepare(`INSERT INTO exercises (title, goal, technique, alphatex, start_bpm, target_bpm, current_bpm)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (const e of exercises) insert.run(e.title, e.goal, e.technique, e.alphatex, e.start_bpm, e.target_bpm, e.start_bpm);
    json(res, { created: exercises.length });
  },
};

// ---------- tutor ----------

const PROFILE = `Player: advanced beginner / intermediate guitarist. Reads tab and notation, plays reasonably well,
main goals are SPEED and ACCURACY. Favorite genres: classic heavy metal and black metal (Gorgoroth, Satyricon, Bathory,
Celtic Frost, Therion, Mercyful Fate, Windir, Judas Priest).`;

const SYSTEM = `You are a guitar tutor designing short, focused practice exercises.
${PROFILE}

Each exercise is written in alphaTex (alphaTab's text notation) so it can be rendered and played back. Rules:
- Start with: \\title "<title>" \\tempo <start_bpm> then a line with a single "." then \\track "Guitar" \\staff {tabs} and \\tuning (...) listing the strings from highest to lowest, e.g. \\tuning (E4 B3 G3 D3 A2 E2).
- Notes are fret.string where string 1 is the HIGHEST string and 6 the lowest (e.g. 0.6 = open low string). Chords: (0.6 2.5 2.4). Rests: r.
- Durations: ":8" sets eighth notes for following beats, ":16" sixteenths, etc. Bars are separated by "|".
- Palm mute: 0.6{pm}. Keep each exercise 2-8 bars so it can be looped.
- Use the same tuning as the song the problem passage comes from.
Base exercises on the player's logged problem passages (given as alphaTex excerpts) when available: isolate the hard
movement, then build it back up. Otherwise use genre techniques: tremolo picking, downpicked gallops, string skipping,
alternate picking bursts, twin-lead style runs. Set start_bpm where the player is currently clean and target_bpm realistic.`;

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['exercises'],
  properties: {
    exercises: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'goal', 'technique', 'alphatex', 'start_bpm', 'target_bpm'],
        properties: {
          title: { type: 'string' }, goal: { type: 'string' }, technique: { type: 'string' },
          alphatex: { type: 'string' }, start_bpm: { type: 'integer' }, target_bpm: { type: 'integer' },
        },
      },
    },
  },
};

// Runs Claude Code headless (`claude -p`), so usage counts against the Claude Code plan instead of API billing.
function ask(prompt) {
  const args = ['-p', '--model', 'sonnet', '--output-format', 'json', '--json-schema', JSON.stringify(SCHEMA),
    '--system-prompt', SYSTEM, '--tools', '', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence'];
  return new Promise((resolve, reject) => {
    // run outside the project so no CLAUDE.md / project settings leak into the tutor
    const child = spawn('claude', args, { cwd: os.tmpdir(), stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('error', e => reject(e.code === 'ENOENT' ? new Error('Claude Code CLI not found: install it and run `claude` once to log in.') : e));
    child.on('close', code => {
      let r;
      try { r = JSON.parse(out); } catch { return reject(new Error(`Claude Code failed (exit ${code}): ${(err || out).trim().slice(0, 300)}`)); }
      if (r.is_error || !r.structured_output) return reject(new Error(`Claude Code: ${r.result || r.subtype || 'no exercises returned'}`));
      resolve(r.structured_output.exercises);
    });
    child.stdin.end(prompt);
  });
}

const texError = tex => {
  try { alphaTab.importer.ScoreLoader.loadAlphaTex(tex); return null; } catch (e) { return String(e.message ?? e); }
};

async function tutor(request) {
  const sessions = db.prepare(`SELECT s.*, t.title, t.artist, t.tuning FROM sessions s LEFT JOIN tabs t ON t.id = s.tab_id
    ORDER BY s.at DESC LIMIT 10`).all();
  const existing = db.prepare('SELECT title, technique, start_bpm, current_bpm, target_bpm FROM exercises ORDER BY id DESC LIMIT 20').all();
  const prompt = `Recent practice sessions (newest first):
${sessions.map(s => `- ${s.artist ?? ''} - ${s.title ?? 'free practice'} (tuning ${s.tuning ?? '?'}), bars ${s.bars}: clean at ${s.bpm ?? '?'} bpm, target ${s.target_bpm ?? '?'}, accuracy ${s.rating ?? '?'}/5. Notes: ${s.notes}${s.excerpt ? `\n  Excerpt:\n  ${s.excerpt}` : ''}`).join('\n') || '(none logged yet)'}

Exercises already in progress (avoid duplicates, build on them):
${existing.map(e => `- ${e.title} [${e.technique}] ${e.current_bpm}/${e.target_bpm} bpm`).join('\n') || '(none)'}

${request ? `Player's request: ${request}\n` : ''}Create 3 new exercises.`;

  const first = await ask(prompt);
  const bad = first.map((e, i) => ({ i, err: texError(e.alphatex) })).filter(x => x.err);
  if (!bad.length) return first;

  // one retry: show the parse errors and ask for corrected versions
  const retry = `${prompt}

You already answered with:
${JSON.stringify(first)}

These exercises have alphaTex errors. Return ALL exercises again with the errors fixed:
${bad.map(b => `#${b.i + 1} "${first[b.i].title}": ${b.err}`).join('\n')}`;
  return (await ask(retry)).filter(e => !texError(e.alphatex));
}

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
