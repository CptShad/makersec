import { config, u } from './config.js';
import { slugify } from './content.js';

// Visitor-selectable themes: [id, label, three swatch colours for the picker].
// The first is the default; each id needs a matching block in public/style.css (see THEMES.md).
export const THEMES = [
  ['perfboard', 'Perfboard', ['#080b10', '#38d9f5', '#7c8cff']],
  ['glass', 'Glass', ['#6366f1', '#ec4899', '#14b8a6']],
  ['brutal', 'Brutalist', ['#f6f1e7', '#e8431f', '#3b5bff']],
  ['synthwave', 'Synthwave', ['#12002b', '#ff3cac', '#2de2e6']],
];
const THEME_IDS = THEMES.map(([id]) => id);

const swatch = ([a, b, c]) => `<span class="swatch" style="--sw-1:${a};--sw-2:${b};--sw-3:${c}" aria-hidden="true"></span>`;

// Rendered hidden: it needs JS, which reveals it. A listbox rather than <select> so the
// open list can be themed too.
function themePicker() {
  const [defaultId, defaultLabel, defaultSwatch] = THEMES[0];
  const options = THEMES.map(([id, label, colours]) =>
    `<li role="option" id="theme-opt-${id}" data-value="${id}" aria-selected="${id === defaultId}">${swatch(colours)}<span>${label}</span></li>`).join('');
  return `<div class="theme-pick" data-theme-picker hidden>
      <button class="theme theme-pick-btn" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="Theme: ${defaultLabel}">
        ${swatch(defaultSwatch)}<span class="theme-pick-label">${defaultLabel}</span>
        <svg class="theme-pick-chev" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <ul class="theme-menu" role="listbox" tabindex="-1" aria-label="Theme" hidden>${options}</ul>
    </div>`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Static assets are served with a long max-age, so a deploy has to change the URL
// or returning visitors keep the old CSS. Restarting the process (or rebuilding) is the deploy.
const ASSET_V = Date.now().toString(36);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateStamp(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

const postUrl = (slug) => u(`/p/${encodeURIComponent(slug)}`);

const STATUS_MAP = [
  [/^(works?|working|done|complete[d]?|shipped)$/i, 'ok', 'Working'],
  [/^(wip|in.?progress|building|ongoing)$/i, 'wip', 'In progress'],
  [/^(magic.?smoke|let.?the.?smoke.?out|fried|failed|failure|dead)$/i, 'fail', 'Magic smoke'],
  [/^(shelved|parked|abandoned|paused|on.?hold)$/i, 'dead', 'Shelved'],
  [/^(idea|concept|planned|someday)$/i, 'idea', 'Idea'],
  [/^(draft|unfinished)$/i, 'draft', 'Draft'],
];

function statusBadge(status) {
  if (!status) return '';
  const hit = STATUS_MAP.find(([re]) => re.test(status.trim()));
  const cls = hit ? hit[1] : 'note';
  const label = hit ? hit[2] : status.charAt(0).toUpperCase() + status.slice(1);
  return `<span class="status status-${cls}">${esc(label)}</span>`;
}

function tagChip(tag) {
  return `<a class="chip" href="${u(`/tags/${encodeURIComponent(slugify(tag))}`)}">${esc(tag)}</a>`;
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
    .map(([href, label]) => `<a href="${u(href)}"${href === active ? ' class="on"' : ''}>${label}</a>`)
    .join('');
}

export function layout({ title, description, body, active = '', idx, canonical = '', ogImage = '' }) {
  const site = config.site;
  const fullTitle = title ? `${title} | ${site.title}` : site.title;
  const desc = description || site.title;
  const rev = idx?.version ? idx.version.slice(0, 7) : '';
  const srcLabel = site.showSource && config.repo ? config.repo : '';

  return `<!doctype html>
<html lang="en" data-theme="${THEME_IDS[0]}" data-scheme="dark" data-mode="${config.mode}">
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
<link rel="stylesheet" href="${u('/static/style.css')}?v=${ASSET_V}">
<link rel="icon" href="${u('/favicon.svg')}" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(site.title)}" href="${u('/feed.xml')}">
<script>try{var d=document.documentElement,s=localStorage.getItem('makersec-scheme'),t=localStorage.getItem('makersec-theme');if(!s&&(t==='dark'||t==='light'))s=t;if(!s&&window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches)s='light';if(s)d.dataset.scheme=s;if(${JSON.stringify(THEME_IDS)}.indexOf(t)>-1)d.dataset.theme=t;}catch(e){}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${config.isPrivate ? '<div class="hazard" role="presentation"></div>' : '<div class="rail" role="presentation"></div>'}
<header class="site">
  <div class="wrap head-inner">
    <a class="brand" href="${u('/')}">
      ${MARK}
      <span class="brand-title">${esc(site.title)}</span>
      ${config.isPrivate ? '<span class="status status-private">Private</span>' : ''}
    </a>
    <nav class="nav">${nav(active, idx)}</nav>
    ${themePicker()}
    <button class="theme" type="button" data-scheme-toggle aria-label="Toggle dark and light">
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
      <a href="${u('/feed.xml')}">RSS</a>
      ${config.isStatic ? '' : `<a href="${u('/healthz')}">Status</a>`}
    </div>
  </div>
</footer>
<script src="${u('/static/app.js')}?v=${ASSET_V}" defer></script>
</body>
</html>`;
}

function postCard(post) {
  const tags = post.tags.map(tagChip).join('');
  return `<article class="card" data-search="${esc((post.title + ' ' + post.summary + ' ' + post.tags.join(' ')).toLowerCase())}" data-tags="${esc(post.tags.map(slugify).join(' '))}">
  <div class="card-rail">
    <span class="num">#${post.n || '000'}</span>
    <span class="stamp">${dateStamp(post.date) || 'Undated'}</span>
  </div>
  <div class="card-body">
    <h2 class="card-title"><a href="${postUrl(post.slug)}">${esc(post.title)}</a>${post.status ? ' ' + statusBadge(post.status) : ''}${post.draft && !post.status ? ' ' + statusBadge('draft') : ''}</h2>
    <p class="card-sum">${esc(post.summary)}</p>
    <div class="card-meta">
      ${tags ? `<div class="chips">${tags}</div>` : '<div></div>'}
      <span class="mono dim">${post.minutes} min read · ${plural(post.words, 'word', 'words')}</span>
    </div>
  </div>
</article>`;
}

export function indexPage(idx) {
  const posts = idx.posts;
  const tags = [...idx.tags.values()].sort((a, b) => b.posts.length - a.posts.length);

  const refreshHint = config.isStatic
    ? 'Push it and the site rebuilds.'
    : `Push it, then <a href="${u('/api/refresh')}">refresh the cache</a> or wait ${config.cacheTtl} seconds.`;

  const empty = `<section class="panel empty">
  <h2 class="panel-title">No posts yet</h2>
  <p>This site reads from <code>${esc(config.localContent || config.repo + '@' + config.branch)}</code>${config.contentDir ? ` (in <code>${esc(config.contentDir)}/</code>)` : ''}, and there is no markdown there.</p>
  <p>Add a file such as <code>2026-09-12-first-light.md</code> to the repo:</p>
  <pre class="sample"><code>---
title: First light
date: 2026-09-12
status: working
tags: [esp32, power]
summary: One sentence for the post list.
---

Write the post here in normal markdown.</code></pre>
  <p class="dim">${refreshHint}</p>
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
${posts.length ? posts.map(postCard).join('\n') : empty}
</section>
<p class="no-results" hidden>No posts match that. <button type="button" class="linkish" data-clear>Clear filters</button></p>`;
}

function sideList(title, items) {
  return `<div class="side-block">
    <h3 class="side-title">${title}</h3>
    <ul class="bom">${items.join('')}</ul>
  </div>`;
}

export function postPage(post, html, neighbors) {
  const tags = post.tags.map(tagChip).join('');
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
    ? `<figure class="cover"><img src="${/^https?:/i.test(post.cover) ? esc(post.cover) : u(`/media/${esc(post.dir ? post.dir + '/' : '')}${esc(post.cover.replace(/^\.\//, ''))}`)}" alt=""></figure>`
    : '';

  const meta = [
    `<span class="num">#${post.n || '000'}</span>`,
    post.date ? `<time datetime="${esc(post.dateISO)}">${dateStamp(post.date)}</time>` : '<span class="dim">Undated</span>',
    `<span>${post.minutes} min read</span>`,
  ].join('<span class="dot">·</span>');

  return `<nav class="crumbs"><a href="${u('/')}">&larr; All posts</a></nav>
<article class="post">
  <header class="post-head">
    <div class="post-stampline mono">
      ${meta}
      ${post.status ? statusBadge(post.status) : ''}
      ${post.draft ? statusBadge('draft') : ''}
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
      <a href="${postUrl(post.slug)}.md">Raw markdown</a>
      <a href="#main">Back to top</a>
    </div>
    <nav class="neighbors">
      ${neighbors.prev ? `<a class="neighbor prev" href="${postUrl(neighbors.prev.slug)}"><span class="lbl">&larr; Older</span><span>${esc(neighbors.prev.title)}</span></a>` : '<span></span>'}
      ${neighbors.next ? `<a class="neighbor next" href="${postUrl(neighbors.next.slug)}"><span class="lbl">Newer &rarr;</span><span>${esc(neighbors.next.title)}</span></a>` : '<span></span>'}
    </nav>
  </footer>
</article>`;
}

export function pagePage(page, html) {
  return `<nav class="crumbs"><a href="${u('/')}">&larr; All posts</a></nav>
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
${tags.map((t) => `<a class="tag-card" href="${u(`/tags/${encodeURIComponent(t.key)}`)}">
  <span class="tag-name">${esc(t.label)}</span>
  <span class="tag-count mono">${t.posts.length}</span>
</a>`).join('')}
${tags.length ? '' : '<p class="dim">No tags yet. Add <code>tags: [esp32, 3dprint]</code> to a post&rsquo;s front matter.</p>'}
</section>`;
}

export function tagPage(tag) {
  return `<nav class="crumbs"><a href="${u('/tags')}">&larr; All tags</a></nav>
<section class="masthead">
  <h1 class="mast-title">Tagged &ldquo;${esc(tag.label)}&rdquo;</h1>
  <p class="mast-stats mono">${plural(tag.posts.length, 'post', 'posts')}.</p>
</section>
<section class="feed">${tag.posts.map(postCard).join('\n')}</section>`;
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
  <p><a href="${u('/')}">Back to all posts</a></p>
</section>`;
}

/* ---------- non-HTML documents, shared by the server and the static build ---------- */

// `base` is the full public origin plus base path, e.g. https://you.github.io/makersec-posts
export function feedXml(idx, base, items) {
  const entries = items.map(({ post, html }) => {
    const url = `${base}/p/${encodeURIComponent(post.slug)}`;
    return `  <item>
    <title>${esc(post.title)}</title>
    <link>${esc(url)}</link>
    <guid isPermaLink="true">${esc(url)}</guid>
    ${post.date ? `<pubDate>${new Date(post.date).toUTCString()}</pubDate>` : ''}
    <description>${esc(post.summary)}</description>
    ${post.tags.map((t) => `<category>${esc(t)}</category>`).join('')}
    <content:encoded><![CDATA[${html.replace(/]]>/g, ']]&gt;')}]]></content:encoded>
  </item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${esc(config.site.title)}</title>
  <link>${esc(base)}/</link>
  <atom:link href="${esc(base)}/feed.xml" rel="self" type="application/rss+xml"/>
  <description>${esc(config.site.title)}</description>
  <language>en</language>
  <lastBuildDate>${new Date(idx.builtAt).toUTCString()}</lastBuildDate>
${entries.join('\n')}
</channel>
</rss>`;
}

export function sitemapXml(idx, base) {
  const urls = [
    `<url><loc>${esc(base)}/</loc></url>`,
    ...idx.posts.map((p) => `<url><loc>${esc(`${base}/p/${encodeURIComponent(p.slug)}`)}</loc>${p.dateISO ? `<lastmod>${p.dateISO.slice(0, 10)}</lastmod>` : ''}</url>`),
    ...[...idx.tags.values()].map((t) => `<url><loc>${esc(`${base}/tags/${t.key}`)}</loc></url>`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

export function robotsTxt(base) {
  if (config.isPrivate) return 'User-agent: *\nDisallow: /\n';
  return `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`;
}

export function faviconSvg() {
  const accent = config.isPrivate ? '#a78bfa' : '#38d9f5';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<rect width="32" height="32" rx="6" fill="#080b10"/>
<path d="M3 21h5l3.5-10L15 28l3.5-12 2.5 5h8" fill="none" stroke="${accent}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="3" cy="21" r="2.4" fill="${accent}"/><circle cx="29" cy="21" r="2.4" fill="${accent}"/>
</svg>`;
}
