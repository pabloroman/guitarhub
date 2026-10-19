// The whole backend: CRUD over the D1 tables plus the Guitar Pro files in KV, always scoped to the signed-in user
// (the _middleware sets who that is). This is what keeps each user's data private, so every query filters on
// user_id and the browser can never set it.
//   GET    /api/:table?col=val                 rows, filtered by equality
//   POST   /api/:table[?or=ignore|replace]     insert a row (or an array of rows), returns the inserted rows
//   PATCH  /api/:table/:id                     update, returns the row
//   DELETE /api/:table/:id                     delete; a tab takes its fingerings and its file with it
//   GET/PUT/DELETE /api/files/:tabId           the tab's Guitar Pro file
const TABLES = ['tabs', 'fingerings', 'exercises', 'sessions'];
const MAX_FILE = 2 * 1024 * 1024;
const json = (body, status = 200) => Response.json(body, { status });

export async function onRequest({ request, env, data, params }) {
  const user = data.email ?? data.cloudflareAccess?.JWT.payload.email;
  if (!user) return json({ message: 'Not signed in' }, 403);
  const [table, id] = params.path ?? [];
  const { method } = request, url = new URL(request.url);
  try {
    if (table === 'files') {
      const key = `${user}/${+id}`;
      if (method === 'GET') {
        const file = await env.FILES.get(key, 'arrayBuffer');
        return file ? new Response(file) : json({ message: 'File not found' }, 404);
      }
      if (method === 'DELETE') return await env.FILES.delete(key), json(null);
      if (method === 'PUT') {
        if (!await env.DB.prepare('select 1 from tabs where id = ? and user_id = ?').bind(+id, user).first())
          return json({ message: 'Tab not found' }, 404);
        const bytes = await request.arrayBuffer();
        if (bytes.byteLength > MAX_FILE) return json({ message: 'File is over 2 MB' }, 413);
        return await env.FILES.put(key, bytes), json(null);
      }
    }
    if (!TABLES.includes(table)) return json({ message: 'Not found' }, 404);
    // column names go into the SQL text, so they must be plain identifiers; values are always bound
    const cols = (obj, keepId) => {
      const keys = Object.keys(obj).filter(k => k !== 'user_id' && (keepId || k !== 'id'));
      if (!keys.every(k => /^[a-z_]+$/.test(k))) throw new Error('Bad column name');
      return keys;
    };

    if (method === 'GET') {
      const filters = Object.fromEntries(url.searchParams);
      const keys = cols(filters, true);
      const { results } = await env.DB.prepare(`select * from ${table} where user_id = ?${keys.map(k => ` and ${k} = ?`).join('')}`)
        .bind(user, ...keys.map(k => filters[k])).all();
      return json(results);
    }
    if (method === 'POST') {
      const or = { ignore: ' or ignore', replace: ' or replace' }[url.searchParams.get('or')] ?? '';
      const rows = [await request.json()].flat();
      const out = await env.DB.batch(rows.map(row => {
        const keys = cols(row);
        return env.DB.prepare(`insert${or} into ${table} (user_id${keys.map(k => `, ${k}`).join('')})
          values (?${', ?'.repeat(keys.length)}) returning *`).bind(user, ...keys.map(k => row[k]));
      }));
      return json(out.flatMap(r => r.results));
    }
    if (method === 'PATCH') {
      const patch = await request.json(), keys = cols(patch);
      const row = await env.DB.prepare(`update ${table} set ${keys.map(k => `${k} = ?`).join(', ')}
        where id = ? and user_id = ? returning *`).bind(...keys.map(k => patch[k]), +id, user).first();
      return row ? json(row) : json({ message: 'Not found' }, 404);
    }
    if (method === 'DELETE') {
      const del = [env.DB.prepare(`delete from ${table} where id = ? and user_id = ?`).bind(+id, user)];
      if (table === 'tabs') del.push(env.DB.prepare('delete from fingerings where tab_id = ? and user_id = ?').bind(+id, user));
      await env.DB.batch(del);
      if (table === 'tabs') await env.FILES.delete(`${user}/${+id}`); // after the row: a leftover file is harmless, a row without its file isn't
      return json(null);
    }
    return json({ message: 'Method not allowed' }, 405);
  } catch (e) {
    return json({ message: e.message }, 400);
  }
}
