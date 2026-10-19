// Talks to functions/api (D1 tables + KV files). Sign-in is Cloudflare Access in front of the whole site, so a page
// only loads for a signed-in user and the API knows who that is. Every helper resolves `{ data, error }` and never
// throws, so callers show `error.message` the same way for network and server errors.
async function call(path, init, as = 'json') {
  try {
    const res = await fetch(`/api/${path}`, init);
    if (!res.ok) return { error: new Error((await res.json().catch(() => null))?.message ?? `${res.status} ${res.statusText}`) };
    return { data: await res[as]() };
  } catch (error) {
    return { error };
  }
}
const send = (method, path, body) => call(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export const db = {
  all: (table, filters = {}) => call(`${table}?${new URLSearchParams(filters)}`),
  // or: 'ignore' skips a row that breaks a unique key (e.g. a drill level that exists), 'replace' overwrites it
  add: (table, rows, or) => send('POST', `${table}${or ? `?or=${or}` : ''}`, rows),
  update: (table, id, patch) => send('PATCH', `${table}/${id}`, patch),
  del: (table, id) => call(`${table}/${id}`, { method: 'DELETE' }),
  file: {
    get: id => call(`files/${id}`, undefined, 'arrayBuffer'),
    put: (id, bytes) => call(`files/${id}`, { method: 'PUT', body: bytes }),
  },
};

const out = Object.assign(document.createElement('button'), { textContent: 'Sign out' });
out.style.marginLeft = 'auto';
out.onclick = () => location.assign('/cdn-cgi/access/logout');
document.querySelector('header').append(out);
