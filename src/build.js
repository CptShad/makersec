// Static export for GitHub Pages (or any static host).
//
//   LOCAL_CONTENT=../makersec-posts BASE_PATH=/makersec-posts \
//   SITE_URL=https://you.github.io/makersec-posts node src/build.js
//
// Writes the same pages the server renders into OUT_DIR (default ./dist). Pages are
// written as `name.html`; GitHub Pages serves them at the extensionless URL.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, assertConfig } from './config.js';
import { getIndex, getHtml, slugify, source } from './content.js';
import * as views from './views.js';

config.isStatic = true;

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(process.env.OUT_DIR || 'dist');
const tagSlug = (tag) => slugify(tag);
// Absolute URLs in the feed and sitemap need a real origin; fall back to the base path.
const base = config.site.url || config.basePath;

let files = 0;
async function write(rel, data) {
  const target = path.join(outDir, ...rel.split('/'));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, data);
  files += 1;
}

async function copyDir(from, to) {
  for (const item of await fs.readdir(from, { withFileTypes: true })) {
    const src = path.join(from, item.name);
    if (item.isDirectory()) await copyDir(src, `${to}/${item.name}`);
    else await write(`${to}/${item.name}`, await fs.readFile(src));
  }
}

assertConfig();
if (!config.site.url) {
  console.warn('SITE_URL is not set: feed and sitemap links will be relative, which most feed readers reject.');
}

const idx = await getIndex({ force: true });
// A local checkout has no commit id of its own; in Actions, show the posts commit in the footer.
if (process.env.GITHUB_SHA) idx.version = process.env.GITHUB_SHA;
for (const err of idx.errors) console.warn(`skipped ${err.path}: ${err.error}`);

await fs.rm(outDir, { recursive: true, force: true });

await write('index.html', views.layout({ body: views.indexPage(idx, tagSlug), active: '/', idx, canonical: '/' }));

for (const [i, post] of idx.posts.entries()) {
  const html = await getHtml(post, idx);
  const neighbors = { next: idx.posts[i - 1] || null, prev: idx.posts[i + 1] || null };
  await write(`p/${post.slug}.html`, views.layout({
    title: post.title,
    description: post.summary,
    body: views.postPage(post, html, idx, tagSlug, neighbors),
    idx,
    canonical: `/p/${post.slug}`,
  }));
  await write(`p/${post.slug}.md`, post.body);
}

for (const page of idx.pages.values()) {
  const html = await getHtml(page, idx);
  await write(`${page.slug}.html`, views.layout({
    title: page.title,
    description: page.summary,
    body: views.pagePage(page, html),
    active: `/${page.slug}`,
    idx,
    canonical: `/${page.slug}`,
  }));
}

await write('tags.html', views.layout({ title: 'Tags', body: views.tagsPage(idx), active: '/tags', idx, canonical: '/tags' }));
for (const tag of idx.tags.values()) {
  await write(`tags/${tag.key}.html`, views.layout({
    title: `#${tag.label}`,
    description: `Posts tagged ${tag.label}`,
    body: views.tagPage(tag, idx, tagSlug),
    active: '/tags',
    idx,
    canonical: `/tags/${tag.key}`,
  }));
}

await write('404.html', views.layout({ title: 'Not found', body: views.errorPage(404, 'That page is not on this bench.'), idx }));

const feedItems = [];
for (const post of idx.posts.slice(0, 20)) feedItems.push({ post, html: await getHtml(post, idx) });
await write('feed.xml', views.feedXml(idx, base, feedItems));
if (!config.isPrivate) await write('sitemap.xml', views.sitemapXml(idx, base));
await write('robots.txt', views.robotsTxt(base));
await write('favicon.svg', views.faviconSvg());

await copyDir(path.join(here, '..', 'public'), 'static');
for (const entry of idx.media.values()) await write(`media/${entry.path}`, await source.readBinary(entry));

// Stop GitHub Pages running Jekyll, which would drop any path starting with "_".
await write('.nojekyll', '');

console.log(`built ${idx.posts.length} posts, ${idx.tags.size} tags, ${idx.media.size} media files -> ${outDir} (${files} files)`);
