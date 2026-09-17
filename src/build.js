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
import { getIndex, getHtml, source } from './content.js';
import * as pages from './pages.js';
import * as views from './views.js';

config.isStatic = true;

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(process.env.OUT_DIR || 'dist');
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

await write('index.html', pages.indexHtml(idx));

for (const post of idx.posts) {
  await write(`p/${post.slug}.html`, pages.postHtml(post, await getHtml(post, idx), idx));
  await write(`p/${post.slug}.md`, post.body);
}

for (const page of idx.pages.values()) {
  await write(`${page.slug}.html`, pages.standaloneHtml(page, await getHtml(page, idx), idx));
}

await write('tags.html', pages.tagsHtml(idx));
for (const tag of idx.tags.values()) await write(`tags/${tag.key}.html`, pages.tagHtml(tag, idx));

await write('404.html', pages.errorHtml(404, pages.NOT_FOUND, idx));

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
