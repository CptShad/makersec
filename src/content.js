import matter from 'gray-matter';
import { config } from './config.js';
import * as github from './source-github.js';
import * as local from './source-local.js';
import { render } from './markdown.js';

export const source = config.localContent ? local : github;

const MEDIA_EXT = /\.(png|jpe?g|gif|webp|avif|svg|mp4|webm|mp3|ogg|wav|pdf|stl|zip|txt|csv|json|ino|py|sch|kicad_pcb|kicad_sch|step|3mf|gcode)$/i;
const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})[-_. ]+/;
// Root-level files with these names are standalone pages, outside the post stream.
const PAGE_NAMES = new Set(['about', 'now', 'uses', 'colophon', 'contact']);

let index = null;
let building = null;
const htmlCache = new Map(); // blob sha -> rendered html

function toArray(value) {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value).split(',').map((v) => v.trim()).filter(Boolean);
}

function parseDate(data, file) {
  const raw = data.date || data.published || data.created;
  if (raw instanceof Date && !Number.isNaN(raw.valueOf())) return raw;
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.valueOf())) return d;
  }
  const m = DATE_PREFIX.exec(file);
  if (m) return new Date(m[1] + '-' + m[2] + '-' + m[3] + 'T12:00:00Z');
  return null;
}

export function slugify(text) {
  return String(text).toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function inContentDir(path) {
  if (!config.contentDir) return true;
  return path.startsWith(config.contentDir + '/');
}

function firstHeading(body) {
  const m = /^\s*#\s+(.+?)\s*$/m.exec(body);
  return m ? m[1] : null;
}

function excerpt(body, limit = 240) {
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+.*$/gm, ' ')
    .replace(/[>*_`#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= limit) return text;
  const cut = text.lastIndexOf(' ', limit);
  return text.slice(0, cut > 0 ? cut : limit) + '…';
}

function parseEntry(entry, raw) {
  let data = {};
  let body = raw;
  try {
    const parsed = matter(raw);
    data = parsed.data || {};
    body = parsed.content;
  } catch {
    // Malformed front matter shouldn't take the whole index down.
  }

  const file = entry.path.split('/').pop();
  const dir = entry.path.split('/').slice(0, -1).join('/');
  const base = file.replace(/\.md$/i, '').replace(DATE_PREFIX, '');
  const slug = slugify(data.slug || base) || entry.sha.slice(0, 8);
  const date = parseDate(data, file);
  const words = (body.match(/\S+/g) || []).length;

  return {
    slug,
    path: entry.path,
    dir,
    sha: entry.sha,
    title: String(data.title || firstHeading(body) || base.replace(/[-_]+/g, ' ')),
    date,
    dateISO: date ? date.toISOString() : null,
    tags: toArray(data.tags || data.tag),
    summary: String(data.summary || data.description || excerpt(body)),
    status: data.status ? String(data.status) : '',
    draft: data.draft === true || String(data.status || '').toLowerCase() === 'draft',
    cover: data.cover ? String(data.cover) : '',
    parts: toArray(data.parts || data.bom),
    tools: toArray(data.tools),
    links: data.links && typeof data.links === 'object' && !Array.isArray(data.links) ? data.links : null,
    words,
    minutes: Math.max(1, Math.round(words / 220)),
    body,
  };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor;
      cursor += 1;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function build(force) {
  const version = await source.version({ force });
  if (index && index.version === version && !force) {
    index.checkedAt = Date.now();
    return index;
  }

  const entries = await source.listEntries(version);
  const media = new Map();
  const markdown = [];

  for (const entry of entries) {
    const lower = entry.path.toLowerCase();
    const name = lower.split('/').pop();
    if (lower.endsWith('.md')) {
      if (!inContentDir(entry.path)) continue;
      if (config.excludes.includes(name)) continue;
      if (name.startsWith('_')) continue;
      markdown.push(entry);
    } else if (MEDIA_EXT.test(lower)) {
      media.set(entry.path, entry);
    }
  }

  const parsed = await mapLimit(markdown, 8, async (entry) => {
    try {
      return parseEntry(entry, await source.readText(entry));
    } catch (err) {
      return { error: err.message, path: entry.path };
    }
  });

  const errors = parsed.filter((p) => p.error);
  const all = parsed.filter((p) => !p.error);

  const pages = new Map();
  const posts = [];
  for (const item of all) {
    if (!item.dir && PAGE_NAMES.has(item.slug)) pages.set(item.slug, item);
    else posts.push(item);
  }

  const visible = posts.filter((p) => config.showDrafts || !p.draft);
  visible.sort((a, b) => {
    if (a.date && b.date) return b.date - a.date;
    if (a.date) return -1;
    if (b.date) return 1;
    return a.title.localeCompare(b.title);
  });

  // Oldest post is #001, so the numbers never shuffle as you publish.
  const chronological = [...visible].sort((a, b) => (a.date ? a.date.valueOf() : 0) - (b.date ? b.date.valueOf() : 0));
  chronological.forEach((post, i) => { post.n = String(i + 1).padStart(3, '0'); });

  const bySlug = new Map();
  const slugByPath = new Map();
  for (const post of visible) {
    let slug = post.slug;
    let bump = 2;
    while (bySlug.has(slug)) { slug = post.slug + '-' + bump; bump += 1; }
    post.slug = slug;
    bySlug.set(slug, post);
    slugByPath.set(post.path, slug);
  }
  for (const page of pages.values()) slugByPath.set(page.path, page.slug);

  const tags = new Map();
  for (const post of visible) {
    for (const tag of post.tags) {
      const key = slugify(tag);
      if (!key) continue;
      const bucket = tags.get(key) || { key, label: tag, posts: [] };
      bucket.posts.push(post);
      tags.set(key, bucket);
    }
  }

  index = {
    version,
    builtAt: Date.now(),
    checkedAt: Date.now(),
    posts: visible,
    drafts: posts.filter((p) => p.draft).length,
    bySlug,
    slugByPath,
    pages,
    tags,
    media,
    errors,
    stale: null,
  };
  return index;
}

export async function getIndex({ force = false } = {}) {
  if (index && !force && Date.now() - index.checkedAt < config.cacheTtl * 1000) return index;
  if (!building) {
    building = build(force).finally(() => { building = null; });
  }
  try {
    return await building;
  } catch (err) {
    if (index) {
      // Keep serving the last good index if GitHub is having a day.
      index.checkedAt = Date.now();
      index.stale = err.message;
      return index;
    }
    throw err;
  }
}

export async function getHtml(post, idx) {
  const cached = htmlCache.get(post.sha);
  if (cached) return cached;
  const html = await render(post.body, { dir: post.dir, slugByPath: idx.slugByPath });
  if (htmlCache.size > 200) htmlCache.delete(htmlCache.keys().next().value);
  htmlCache.set(post.sha, html);
  return html;
}

export async function getMedia(path) {
  const idx = await getIndex();
  const entry = idx.media.get(path);
  if (!entry) return null;
  return { entry, buffer: await source.readBinary(entry) };
}

export function invalidate() {
  source.reset();
  index = null;
  htmlCache.clear();
}
