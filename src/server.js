// The site, served by Bun. Routes render through pages.js/documents.js, the same
// modules the static build uses, so the two can't drift.
import crypto from 'node:crypto';
import path from 'node:path';
import { config, assertConfig } from './config.js';
import { getIndex, getHtml, getMedia, invalidate, slugify, source } from './content.js';
import * as pages from './pages.js';
import * as documents from './documents.js';
import { ASSET_V } from './views.js';

const startedAt = Date.now();
// The asset stamp doubles as the deploy id: a restart (new templates, new SITE_TITLE)
// invalidates cached HTML even when the content itself has not changed.
const BOOT = ASSET_V;
const PUBLIC_DIR = new URL('../public/', import.meta.url);

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.stl': 'model/stl',
  '.zip': 'application/zip',
};

const html = (body, etag) =>
  new Response(body, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache',
      ...(etag ? { etag: `"${etag}"` } : {}),
    },
  });

const send = (body, type, cache = 'no-cache') =>
  new Response(body, { headers: { 'content-type': type, 'cache-control': cache } });

const fresh = (req, etag) => {
  const given = req.headers.get('if-none-match');
  return Boolean(etag && given && given.replace(/^W\//, '') === `"${etag}"`);
};
const notModified = () => new Response(null, { status: 304 });

// Feed and sitemap links need an absolute origin. Behind a reverse proxy the forwarded
// headers carry the public one; SITE_URL wins over both when it is set.
function siteBase(req) {
  if (config.site.url) return config.site.url;
  const url = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host;
  const proto = req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  return `${proto}://${host}`;
}

async function notFound() {
  let idx = null;
  try {
    idx = await getIndex();
  } catch {
    /* the index may be down; the page still renders */
  }
  return new Response(pages.errorHtml(404, pages.NOT_FOUND, idx), {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
  });
}

async function refresh(req) {
  const token = process.env.REFRESH_TOKEN || '';
  if (token) {
    const given =
      req.headers.get('x-refresh-token') || new URL(req.url).searchParams.get('token') || '';
    if (given !== token) return Response.json({ ok: false, error: 'bad token' }, { status: 403 });
  }
  invalidate();
  const idx = await getIndex({ force: true });
  console.log(`content refreshed: ${idx.posts.length} posts @ ${idx.version.slice(0, 7)}`);
  if ((req.headers.get('accept') || '').includes('text/html'))
    return Response.redirect(config.basePath + '/', 302);
  return Response.json({ ok: true, version: idx.version, posts: idx.posts.length });
}

const server = Bun.serve({
  port: config.port,
  hostname: config.host,

  routes: {
    '/': async (req) => {
      const idx = await getIndex();
      const etag = `i-${BOOT}-${idx.version}-${idx.posts.length}`;
      return fresh(req, etag) ? notModified() : html(pages.indexHtml(idx), etag);
    },

    '/tags': async () => html(pages.tagsHtml(await getIndex())),

    '/tags/:tag': async (req) => {
      const idx = await getIndex();
      const tag = idx.tags.get(slugify(req.params.tag));
      return tag ? html(pages.tagHtml(tag, idx)) : notFound();
    },

    '/p/:slug': async (req) => {
      const idx = await getIndex();
      const raw = req.params.slug.endsWith('.md');
      const slug = raw ? req.params.slug.slice(0, -3) : req.params.slug;
      const post = idx.bySlug.get(slug);
      if (!post) return notFound();
      if (raw) return send(post.body, 'text/markdown; charset=utf-8');

      const etag = `p-${BOOT}-${post.sha}`;
      if (fresh(req, etag)) return notModified();
      return html(pages.postHtml(post, await getHtml(post, idx), idx), etag);
    },

    '/media/*': async (req) => {
      const wanted = decodeURIComponent(new URL(req.url).pathname.split('/media/')[1] || '');
      const found = await getMedia(wanted);
      if (!found) return new Response('not found', { status: 404 });

      const etag = `"m-${found.entry.sha}"`;
      if (req.headers.get('if-none-match') === etag) return notModified();
      return new Response(found.buffer, {
        headers: {
          'content-type': MIME[path.extname(wanted).toLowerCase()] || 'application/octet-stream',
          'cache-control': 'public, max-age=3600',
          etag,
        },
      });
    },

    // Compiled CSS, app.js and anything else dropped in public/.
    '/static/*': async (req) => {
      const name = new URL(req.url).pathname.split('/static/')[1] || '';
      if (name.includes('..')) return new Response('not found', { status: 404 });
      const file = Bun.file(new URL(name, PUBLIC_DIR));
      if (!(await file.exists())) return new Response('not found', { status: 404 });
      return new Response(file, { headers: { 'cache-control': 'public, max-age=604800' } });
    },

    '/feed.xml': async (req) => {
      const idx = await getIndex();
      const items = [];
      for (const post of idx.posts.slice(0, 20))
        items.push({ post, html: await getHtml(post, idx) });
      return send(
        documents.feedXml(idx, siteBase(req), items),
        'application/rss+xml; charset=utf-8'
      );
    },

    '/sitemap.xml': async (req) => {
      if (config.isPrivate) return new Response('not found', { status: 404 });
      return send(
        documents.sitemapXml(await getIndex(), siteBase(req)),
        'application/xml; charset=utf-8'
      );
    },

    '/robots.txt': (req) => send(documents.robotsTxt(siteBase(req)), 'text/plain'),

    // Generated so the private tab is visibly a different colour.
    '/favicon.svg': () => send(documents.faviconSvg(), 'image/svg+xml', 'public, max-age=86400'),

    '/healthz': async () => {
      let idx = null;
      let error = null;
      try {
        idx = await getIndex();
      } catch (err) {
        error = err.message;
      }
      return Response.json(
        {
          ok: !error,
          mode: config.mode,
          source: source.label(),
          version: idx?.version || null,
          posts: idx?.posts.length ?? 0,
          drafts: idx?.drafts ?? 0,
          media: idx?.media.size ?? 0,
          contentErrors: idx?.errors ?? [],
          stale: idx?.stale || null,
          cachedForSeconds: idx ? Math.round((Date.now() - idx.checkedAt) / 1000) : null,
          githubApiCalls: source.stats?.apiCalls ?? null,
          rateLimitRemaining: source.stats?.rateRemaining ?? null,
          uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
          error,
        },
        { status: error ? 503 : 200 }
      );
    },

    // Manual cache bust. Open on a LAN/tailnet-only instance; set REFRESH_TOKEN to lock it down.
    '/api/refresh': { GET: refresh, POST: refresh },

    // GitHub push webhook -> drop the cache immediately.
    '/webhook': {
      POST: async (req) => {
        const secret = config.webhookSecret;
        if (!secret)
          return Response.json({ ok: false, error: 'WEBHOOK_SECRET not set' }, { status: 503 });

        // The raw body is what the signature covers, so read it before parsing anything.
        const body = await req.text();
        const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
        const given = Buffer.from(String(req.headers.get('x-hub-signature-256') || ''));
        const mine = Buffer.from(expected);
        if (given.length !== mine.length || !crypto.timingSafeEqual(given, mine)) {
          return Response.json({ ok: false, error: 'bad signature' }, { status: 401 });
        }

        const event = req.headers.get('x-github-event');
        if (event === 'ping') return Response.json({ ok: true, pong: true });
        if (event !== 'push') return Response.json({ ok: true, ignored: event });

        invalidate();
        const idx = await getIndex({ force: true });
        console.log(`webhook refresh: ${idx.posts.length} posts @ ${idx.version.slice(0, 7)}`);
        return Response.json({ ok: true, version: idx.version, posts: idx.posts.length });
      },
    },

    // Standalone pages: /about, /uses, /now, /colophon, /contact
    '/:page': async (req) => {
      const idx = await getIndex();
      const page = idx.pages.get(slugify(req.params.page));
      if (!page) return notFound();
      return html(pages.standaloneHtml(page, await getHtml(page, idx), idx));
    },
  },

  fetch: notFound,

  error(err) {
    console.error('request failed:', err);
    return new Response(
      pages.errorHtml(
        500,
        'The server could not fetch or render that. Check /healthz for details.'
      ),
      { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  },
});

try {
  assertConfig();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

console.log(
  `makersec [${config.mode}] serving ${source.label()} on http://${server.hostname}:${server.port}`
);
// Warm the cache so the first visitor doesn't pay for the GitHub round trip.
getIndex({ force: true })
  .then((idx) =>
    console.log(
      `indexed ${idx.posts.length} posts, ${idx.media.size} media files @ ${idx.version.slice(0, 7)}`
    )
  )
  .catch((err) => console.error(`initial index failed: ${err.message}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await server.stop();
    process.exit(0);
  });
}
