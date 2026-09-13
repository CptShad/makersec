import { config } from './config.js';

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Static assets are served with a long max-age, so a deploy has to change the URL
// or returning visitors keep the old CSS. Restarting the process is the deploy.
const ASSET_V = Date.now().toString(36);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dateStamp(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

const STATUS_MAP = [
  [/^(works?|working|done|complete[d]?|shipped)$/i, 'ok', 'Working'],
  [/^(wip|in.?progress|building|ongoing)$/i, 'wip', 'In progress'],
  [/^(magic.?smoke|let.?the.?smoke.?out|fried|failed|failure|dead)$/i, 'fail', 'Magic smoke'],
  [/^(shelved|parked|abandoned|paused|on.?hold)$/i, 'dead', 'Shelved'],
  [/^(idea|concept|planned|someday)$/i, 'idea', 'Idea'],
  [/^(draft|unfinished)$/i, 'draft', 'Draft'],
];

export function statusBadge(status) {
  if (!status) return '';
  const hit = STATUS_MAP.find(([re]) => re.test(status.trim()));
  const cls = hit ? hit[1] : 'note';
  const label = hit ? hit[2] : status.charAt(0).toUpperCase() + status.slice(1);
  return `<span class="status status-${cls}">${esc(label)}</span>`;
}

const DRAFT_BADGE = '<span class="status status-draft">Draft</span>';

function tagChip(tag, slug) {
  return `<a class="chip" href="/tags/${encodeURIComponent(slug)}">${esc(tag)}</a>`;
}

const MARK = `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
  <path d="M2 22h6l4-12 4 20 4-14 3 6h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="2" cy="22" r="2.6" fill="currentColor"/>
  <circle cx="30" cy="22" r="2.6" fill="currentColor"/>
</svg>`;

function nav(active, idx) {
  const items = [
    ['/', 'Posts'],
    ['/tags', 'Tags'],
  ];
  if (idx?.pages?.has('about')) items.push(['/about', 'About']);
  if (idx?.pages?.has('uses')) items.push(['/uses', 'Uses']);
  items.push(['/feed.xml', 'RSS']);
  return items
    .map(([href, label]) => `<a href="${href}"${href === active ? ' class="on"' : ''}>${label}</a>`)
    .join('');
}

export function layout({ title, description, body, active = '', idx, canonical = '', ogImage = '' }) {
  const site = config.site;
  const fullTitle = title ? `${title} | ${site.title}` : site.title;
  const desc = description || site.title;
  const rev = idx?.version ? idx.version.slice(0, 7) : '';
  const srcLabel = site.showSource && config.repo ? config.repo : '';

  return `<!doctype html>
<html lang="en" data-theme="dark" data-mode="${config.mode}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="color-scheme" content="dark light">
${config.isPrivate ? '<meta name="robots" content="noindex, nofollow">' : ''}
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
${canonical && site.url ? `<link rel="canonical" href="${esc(site.url + canonical)}">` : ''}
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
<link rel="stylesheet" href="/static/style.css?v=${ASSET_V}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(site.title)}" href="/feed.xml">
<script>try{var t=localStorage.getItem('makersec-theme');if(!t&&window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches)t='light';if(t)document.documentElement.dataset.theme=t;}catch(e){}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${config.isPrivate ? '<div class="hazard" role="presentation"></div>' : '<div class="rail" role="presentation"></div>'}
<header class="site">
  <div class="wrap head-inner">
    <a class="brand" href="/">
      ${MARK}
      <span class="brand-title">${esc(site.title)}</span>
      ${config.isPrivate ? '<span class="status status-private">Private</span>' : ''}
    </a>
    <nav class="nav">${nav(active, idx)}</nav>
    <button class="theme" type="button" data-theme-toggle aria-label="Toggle theme">
      <span class="theme-dot"></span><span class="theme-label">Dark</span>
    </button>
  </div>
</header>
<main id="main" class="wrap">
${body}
</main>
<footer class="site-foot">
  <div class="wrap foot-inner">
    <div class="foot-col">
      <span>Revision <code>${esc(rev || 'unknown')}</code></span>
      ${srcLabel ? `<span>Source: <a href="https://github.com/${esc(config.repo)}">${esc(srcLabel)}</a></span>` : ''}
    </div>
    <div class="foot-col">
      ${site.author ? `<span>Built by ${esc(site.author)}</span>` : ''}
      <a href="/feed.xml">RSS</a>
      <a href="/healthz">Status</a>
    </div>
  </div>
</footer>
<script src="/static/app.js?v=${ASSET_V}" defer></script>
</body>
</html>`;
}

export function postCard(post, tagSlug) {
  const tags = post.tags.map((t) => tagChip(t, tagSlug(t))).join('');
  return `<article class="card" data-search="${esc((post.title + ' ' + post.summary + ' ' + post.tags.join(' ')).toLowerCase())}" data-tags="${esc(post.tags.map(tagSlug).join(' '))}">
  <div class="card-rail">
    <span class="num">#${post.n || '000'}</span>
    <span class="stamp">${dateStamp(post.date) || 'Undated'}</span>
  </div>
  <div class="card-body">
    <h2 class="card-title"><a href="/p/${encodeURIComponent(post.slug)}">${esc(post.title)}</a>${post.status ? ' ' + statusBadge(post.status) : ''}${post.draft && !post.status ? ' ' + DRAFT_BADGE : ''}</h2>
    <p class="card-sum">${esc(post.summary)}</p>
    <div class="card-meta">
      ${tags ? `<div class="chips">${tags}</div>` : '<div></div>'}
      <span class="mono dim">${post.minutes} min read · ${plural(post.words, 'word', 'words')}</span>
    </div>
  </div>
</article>`;
}

export function indexPage(idx, tagSlug) {
  const posts = idx.posts;
  const tags = [...idx.tags.values()].sort((a, b) => b.posts.length - a.posts.length);

  const empty = `<section class="panel empty">
  <h2 class="panel-title">No posts yet</h2>
  <p>This site reads from <code>${esc(config.localContent || config.repo + '@' + config.branch)}</code>${config.contentDir ? ` (in <code>${esc(config.contentDir)}/</code>)` : ''}, and there is no markdown there.</p>
  <p>Add a file such as <code>posts/2026-09-12-first-light.md</code> to the repo:</p>
  <pre class="sample"><code>---
title: First light
date: 2026-09-12
status: working
tags: [esp32, power]
summary: One sentence for the post list.
parts:
  - ESP32-C3 devkit
  - INA219 current sensor
---

Write the post here in normal markdown.</code></pre>
  <p class="dim">Push it, then <a href="/api/refresh">refresh the cache</a> or wait ${config.cacheTtl} seconds.</p>
</section>`;

  const stats = [
    plural(posts.length, 'post', 'posts'),
    plural(idx.tags.size, 'tag', 'tags'),
  ];
  if (config.showDrafts && idx.drafts) stats.push(plural(idx.drafts, 'draft', 'drafts'));

  return `<section class="masthead">
  <h1 class="mast-title">${esc(config.site.title)}</h1>
  <p class="mast-stats mono">${stats.join(', ')}. Updated ${dateStamp(new Date(idx.builtAt))}.</p>
</section>
${posts.length ? `<section class="toolbar">
  <label class="search">
    <svg viewBox="0 0 24 24" class="sicon" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16.5 16.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    <input type="search" id="filter" placeholder="Search posts (press /)" autocomplete="off" spellcheck="false">
  </label>
  <div class="chips tag-filter">
    ${tags.slice(0, 12).map((t) => `<button class="chip" type="button" data-tag="${esc(t.key)}">${esc(t.label)} <span class="dim">${t.posts.length}</span></button>`).join('')}
  </div>
</section>` : ''}
<section class="feed" id="feed">
${posts.length ? posts.map((p) => postCard(p, tagSlug)).join('\n') : empty}
</section>
<p class="no-results" hidden>No posts match that. <button type="button" class="linkish" data-clear>Clear filters</button></p>`;
}

function sideList(title, items) {
  return `<div class="side-block">
    <h3 class="side-title">${title}</h3>
    <ul class="bom">${items.join('')}</ul>
  </div>`;
}

export function postPage(post, html, idx, tagSlug, neighbors) {
  const tags = post.tags.map((t) => tagChip(t, tagSlug(t))).join('');
  const sideBlocks = [];

  if (post.parts.length) sideBlocks.push(sideList('Bill of materials', post.parts.map((p) => `<li>${esc(p)}</li>`)));
  if (post.tools.length) sideBlocks.push(sideList('Tools', post.tools.map((p) => `<li>${esc(p)}</li>`)));
  if (post.links) {
    sideBlocks.push(sideList('Links', Object.entries(post.links)
      .map(([k, v]) => `<li><a href="${esc(String(v))}" rel="noopener noreferrer" target="_blank">${esc(k)}</a></li>`)));
  }
  sideBlocks.push(`<div class="side-block toc-block" hidden>
    <h3 class="side-title">On this page</h3>
    <nav class="toc" id="toc"></nav>
  </div>`);

  const sourceUrl = config.site.showSource && config.repo
    ? `https://github.com/${config.repo}/blob/${config.branch}/${post.path}`
    : '';

  const cover = post.cover
    ? `<figure class="cover"><img src="${/^https?:/i.test(post.cover) ? esc(post.cover) : `/media/${esc(post.dir ? post.dir + '/' : '')}${esc(post.cover.replace(/^\.\//, ''))}`}" alt=""></figure>`
    : '';

  const meta = [
    `<span class="num">#${post.n || '000'}</span>`,
    post.date ? `<time datetime="${esc(post.dateISO)}">${dateStamp(post.date)}</time>` : '<span class="dim">Undated</span>',
    `<span>${post.minutes} min read</span>`,
  ].join('<span class="dot">·</span>');

  return `<nav class="crumbs"><a href="/">&larr; All posts</a></nav>
<article class="post">
  <header class="post-head">
    <div class="post-stampline mono">
      ${meta}
      ${post.status ? statusBadge(post.status) : ''}
      ${post.draft ? DRAFT_BADGE : ''}
    </div>
    <h1 class="post-title">${esc(post.title)}</h1>
    ${post.summary ? `<p class="post-sum">${esc(post.summary)}</p>` : ''}
    ${tags ? `<div class="chips">${tags}</div>` : ''}
  </header>
  ${cover}
  <div class="post-grid">
    <aside class="post-side">${sideBlocks.join('')}</aside>
    <div class="prose">${html}</div>
  </div>
  <footer class="post-foot">
    <div class="foot-links">
      ${sourceUrl ? `<a href="${esc(sourceUrl)}" rel="noopener noreferrer" target="_blank">View source on GitHub</a>` : ''}
      <a href="/p/${encodeURIComponent(post.slug)}.md">Raw markdown</a>
      <a href="#main">Back to top</a>
    </div>
    <nav class="neighbors">
      ${neighbors.prev ? `<a class="neighbor prev" href="/p/${encodeURIComponent(neighbors.prev.slug)}"><span class="lbl">&larr; Older</span><span>${esc(neighbors.prev.title)}</span></a>` : '<span></span>'}
      ${neighbors.next ? `<a class="neighbor next" href="/p/${encodeURIComponent(neighbors.next.slug)}"><span class="lbl">Newer &rarr;</span><span>${esc(neighbors.next.title)}</span></a>` : '<span></span>'}
    </nav>
  </footer>
</article>`;
}

export function pagePage(page, html) {
  return `<nav class="crumbs"><a href="/">&larr; All posts</a></nav>
<article class="post page">
  <header class="post-head">
    <h1 class="post-title">${esc(page.title)}</h1>
  </header>
  <div class="prose">${html}</div>
</article>`;
}

export function tagsPage(idx) {
  const tags = [...idx.tags.values()].sort((a, b) => b.posts.length - a.posts.length || a.label.localeCompare(b.label));
  return `<section class="masthead">
  <h1 class="mast-title">Tags</h1>
  <p class="mast-stats mono">${plural(tags.length, 'tag', 'tags')}, most used first.</p>
</section>
<section class="tag-grid">
${tags.map((t) => `<a class="tag-card" href="/tags/${encodeURIComponent(t.key)}">
  <span class="tag-name">${esc(t.label)}</span>
  <span class="tag-count mono">${t.posts.length}</span>
</a>`).join('')}
${tags.length ? '' : '<p class="dim">No tags yet. Add <code>tags: [esp32, 3dprint]</code> to a post&rsquo;s front matter.</p>'}
</section>`;
}

export function tagPage(tag, idx, tagSlug) {
  return `<nav class="crumbs"><a href="/tags">&larr; All tags</a></nav>
<section class="masthead">
  <h1 class="mast-title">Tagged &ldquo;${esc(tag.label)}&rdquo;</h1>
  <p class="mast-stats mono">${plural(tag.posts.length, 'post', 'posts')}.</p>
</section>
<section class="feed">${tag.posts.map((p) => postCard(p, tagSlug)).join('\n')}</section>`;
}

export function errorPage(code, message) {
  const art = code === 404
    ? `<pre class="ascii">   _____
  |     |   404
  |  ?  |   No continuity
  |_____|   between here and there.
   |   |
  -+---+-</pre>`
    : `<pre class="ascii">   ~~~~~
  ( smoke )   ${code}
   ~~~~~
  |[###]|   Something let go.
  +-----+</pre>`;
  return `<section class="panel empty center">
  ${art}
  <p>${esc(message)}</p>
  <p><a href="/">Back to all posts</a></p>
</section>`;
}
