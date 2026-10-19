import access from '@cloudflare/pages-plugin-cloudflare-access';

// Who is asking: the email in the Cloudflare Access JWT, verified against the team's signing keys (an invalid or
// missing token gets a redirect to the Access login). `wrangler pages dev` has no Access in front of it, and Pages
// only routes its own hostnames, so a localhost request can only come from the dev server: it's one fixed dev user.
export const onRequest = async ctx => {
  if (['localhost', '127.0.0.1'].includes(new URL(ctx.request.url).hostname)) {
    ctx.data.email = 'dev@localhost';
    return ctx.next();
  }
  return access({ domain: ctx.env.ACCESS_DOMAIN, aud: ctx.env.ACCESS_AUD })(ctx);
};
