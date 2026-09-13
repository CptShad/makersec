import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { config, assertConfig } from './config.js';
import { getIndex, getHtml, getMedia, invalidate, slugify, source } from './content.js';
import * as views from './views.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const startedAt = Date.now();
// Bumped every restart so a deploy (new templates, new SITE_TITLE) invalidates
// cached HTML even when the content itself has not changed.
const BOOT = startedAt.toString(36);

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.pdf': 'application/pdf', '.json': 'application/json',
  '.csv': 'text/csv', '.txt': 'text/plain', '.stl': 'model/stl', '.zip': 'application/zip',
};

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL || 'info' },
  trustProxy: true,
});

await app.register(fastifyStatic, {
  root: path.join(here, '..', 'public'),
  prefix: '/static/',
  maxAge: '7d',
});

const tagSlug = (tag) => slugify(tag);

function sendHtml(reply, html, { etag } = {}) {
  if (etag) reply.header('etag', `"${etag}"`);
  reply.header('cache-control', 'no-cache');
  reply.type('text/html; charset=utf-8');
  return reply.send(html);
}

function notModified(req, etag) {
  const inm = req.headers['if-none-match'];
  return Boolean(etag && inm && inm.replace(/^W\//, '') === `"${etag}"`);
}

app.get('/', async (req, reply) => {
  const idx = await getIndex();
  const etag = `i-${BOOT}-${idx.version}-${idx.posts.length}`;
  if (notModified(req, etag)) return reply.code(304).send();
  const body = views.indexPage(idx, tagSlug);
  return sendHtml(reply, views.layout({ body, active: '/', idx, canonical: '/' }), { etag });
});

app.get('/tags', async (req, reply) => {
  const idx = await getIndex();
  const body = views.tagsPage(idx);
  return sendHtml(reply, views.layout({ title: 'Tags', body, active: '/tags', idx, canonical: '/tags' }));
});

app.get('/tags/:tag', async (req, reply) => {
  const idx = await getIndex();
  const tag = idx.tags.get(slugify(req.params.tag));
  if (!tag) return send404(reply, idx);
  const body = views.tagPage(tag, idx, tagSlug);
  return sendHtml(reply, views.layout({
    title: `#${tag.label}`,
    description: `Entries tagged ${tag.label}`,
    body,
    active: '/tags',
    idx,
    canonical: `/tags/${tag.key}`,
  }));
});

app.get('/p/:slug', async (req, reply) => {
  const idx = await getIndex();
  const raw = req.params.slug.endsWith('.md');
  const slug = raw ? req.params.slug.slice(0, -3) : req.params.slug;
  const post = idx.bySlug.get(slug);
  if (!post) return send404(reply, idx);

  if (raw) {
    reply.type('text/markdown; charset=utf-8');
    reply.header('cache-control', 'no-cache');
    return reply.send(post.body);
  }

  const etag = `p-${BOOT}-${post.sha}`;
  if (notModified(req, etag)) return reply.code(304).send();

  const html = await getHtml(post, idx);
  const i = idx.posts.indexOf(post);
  const neighbors = { next: idx.posts[i - 1] || null, prev: idx.posts[i + 1] || null };
  const body = views.postPage(post, html, idx, tagSlug, neighbors);
  return sendHtml(reply, views.layout({
    title: post.title,
    description: post.summary,
    body,
    idx,
    canonical: `/p/${post.slug}`,
  }), { etag });
});

// Standalone pages: /about, /uses, /now, /colophon, /contact
app.get('/:page', async (req, reply) => {
  const idx = await getIndex();
  const page = idx.pages.get(slugify(req.params.page));
  if (!page) return send404(reply, idx);
  const html = await getHtml(page, idx);
  const body = views.pagePage(page, html);
  return sendHtml(reply, views.layout({
    title: page.title,
    description: page.summary,
    body,
    active: `/${page.slug}`,
    idx,
    canonical: `/${page.slug}`,
  }));
});

app.get('/media/*', async (req, reply) => {
  const wanted = decodeURIComponent(req.params['*'] || '');
  const found = await getMedia(wanted);
  if (!found) return reply.code(404).type('text/plain').send('not found');

  const etag = `"m-${found.entry.sha}"`;
  if (req.headers['if-none-match'] === etag) return reply.code(304).send();

  const ext = path.extname(wanted).toLowerCase();
  reply.header('etag', etag);
  reply.header('cache-control', 'public, max-age=3600');
  reply.type(MIME[ext] || 'application/octet-stream');
  return reply.send(found.buffer);
});

app.get('/api/posts.json', async (req, reply) => {
  const idx = await getIndex();
  reply.header('cache-control', 'no-cache');
  return {
    version: idx.version,
    count: idx.posts.length,
    posts: idx.posts.map((p) => ({
      n: p.n, slug: p.slug, title: p.title, date: p.dateISO, tags: p.tags,
      status: p.status, draft: p.draft, summary: p.summary, minutes: p.minutes,
    })),
  };
});

app.get('/feed.xml', async (req, reply) => {
  const idx = await getIndex();
  const base = config.site.url || `${req.protocol}://${req.headers.host}`;
  const items = [];
  for (const post of idx.posts.slice(0, 20)) items.push({ post, html: await getHtml(post, idx) });
  reply.type('application/rss+xml; charset=utf-8');
  reply.header('cache-control', 'no-cache');
  return reply.send(views.feedXml(idx, base, items));
});

app.get('/sitemap.xml', async (req, reply) => {
  if (config.isPrivate) return reply.code(404).type('text/plain').send('not found');
  const idx = await getIndex();
  const base = config.site.url || `${req.protocol}://${req.headers.host}`;
  reply.type('application/xml; charset=utf-8');
  return reply.send(views.sitemapXml(idx, base));
});

app.get('/robots.txt', async (req, reply) => {
  const base = config.site.url || `${req.protocol}://${req.headers.host}`;
  reply.type('text/plain');
  return reply.send(views.robotsTxt(base));
});

// Favicon is generated so the private tab is visibly a different colour.
app.get('/favicon.svg', async (req, reply) => {
  reply.type('image/svg+xml');
  reply.header('cache-control', 'public, max-age=86400');
  return reply.send(views.faviconSvg());
});

app.get('/healthz', async (req, reply) => {
  let idx = null;
  let error = null;
  try {
    idx = await getIndex();
  } catch (err) {
    error = err.message;
  }
  reply.code(error ? 503 : 200);
  return {
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
  };
});

// Manual cache bust. Open on a LAN/tailnet-only instance; set REFRESH_TOKEN to lock it down.
async function refresh(req, reply) {
  const token = process.env.REFRESH_TOKEN || '';
  if (token) {
    const given = req.headers['x-refresh-token'] || req.query?.token || '';
    if (given !== token) return reply.code(403).send({ ok: false, error: 'bad token' });
  }
  invalidate();
  const idx = await getIndex({ force: true });
  req.log.info({ version: idx.version, posts: idx.posts.length }, 'content refreshed');
  if ((req.headers.accept || '').includes('text/html')) return reply.redirect('/');
  return { ok: true, version: idx.version, posts: idx.posts.length };
}
app.get('/api/refresh', refresh);
app.post('/api/refresh', refresh);

// GitHub push webhook -> drop the cache immediately.
app.post('/webhook', { config: { rawBody: true } }, async (req, reply) => {
  const secret = config.webhookSecret;
  if (!secret) return reply.code(503).send({ ok: false, error: 'WEBHOOK_SECRET not set' });

  const sig = req.headers['x-hub-signature-256'];
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(req.rawBody || '').digest('hex');
  const a = Buffer.from(String(sig || ''));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return reply.code(401).send({ ok: false, error: 'bad signature' });
  }

  const event = req.headers['x-github-event'];
  if (event === 'ping') return { ok: true, pong: true };
  if (event !== 'push') return { ok: true, ignored: event };

  invalidate();
  const idx = await getIndex({ force: true });
  req.log.info({ version: idx.version, posts: idx.posts.length }, 'webhook refresh');
  return { ok: true, version: idx.version, posts: idx.posts.length };
});

// Keep the raw body around so the webhook HMAC can be verified.
app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  req.rawBody = body;
  try {
    done(null, body ? JSON.parse(body) : {});
  } catch (err) {
    err.statusCode = 400;
    done(err, undefined);
  }
});

// Anything else (including a bodyless `curl -X POST /api/refresh`, and webhooks
// configured as form-urlencoded) is kept raw rather than rejected with a 415.
app.addContentTypeParser('*', { parseAs: 'string' }, (req, body, done) => {
  req.rawBody = body;
  done(null, body || undefined);
});

function send404(reply, idx) {
  reply.code(404);
  return sendHtml(reply, views.layout({
    title: 'Not found',
    body: views.errorPage(404, 'That page is not on this bench.'),
    idx,
  }));
}

app.setNotFoundHandler(async (req, reply) => {
  let idx = null;
  try { idx = await getIndex(); } catch { /* index may be down; still render the page */ }
  return send404(reply, idx);
});

app.setErrorHandler(async (err, req, reply) => {
  req.log.error({ err }, 'request failed');
  reply.code(err.statusCode || 500);
  const body = views.errorPage(err.statusCode || 500, err.statusCode === 404
    ? 'That page is not on this bench.'
    : 'The server could not fetch or render that. Check /healthz for details.');
  return sendHtml(reply, views.layout({ title: 'Error', body }));
});

try {
  assertConfig();
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`makersec [${config.mode}] serving ${source.label()}`);
  // Warm the cache so the first visitor doesn't pay for the GitHub round trip.
  getIndex({ force: true })
    .then((idx) => app.log.info(`indexed ${idx.posts.length} posts, ${idx.media.size} media files @ ${idx.version.slice(0, 7)}`))
    .catch((err) => app.log.error(`initial index failed: ${err.message}`));
} catch (err) {
  app.log.error(err.message);
  process.exit(1);
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await app.close();
    process.exit(0);
  });
}
