// `supabase` is the global from <script src="/supabase/supabase.js"> (UMD build; the package's ESM entry needs a bundler).
// The URL and key are public by design: supabase/schema.sql is what protects the data, this gate is only navigation.
export const db = supabase.createClient('https://jtnvbrhdsgtskejbqcpu.supabase.co', 'sb_publishable_63N44RGWij6fWSsf6A_Quw_C64sg9_q');

const { data: { session } } = await db.auth.getSession();
const onLogin = location.pathname === '/login.html';
if (!session && !onLogin) { location.replace('/login.html'); throw new Error('signed out'); }
if (session && onLogin) location.replace('/');
export const user = session?.user;

if (session) {
  const out = Object.assign(document.createElement('button'), { textContent: 'Sign out' });
  out.style.marginLeft = 'auto';
  out.onclick = async () => { await db.auth.signOut(); location.replace('/login.html'); };
  document.querySelector('header').append(out);
}
