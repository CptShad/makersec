// Non-HTML documents: the feed, sitemap, robots.txt and favicon.
// Shared by the server and the static build so the two can't drift.
import { config } from './config.js';
import { esc } from './views.js';

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
    ...idx.posts.map(
      (p) =>
        `<url><loc>${esc(`${base}/p/${encodeURIComponent(p.slug)}`)}</loc>${p.dateISO ? `<lastmod>${p.dateISO.slice(0, 10)}</lastmod>` : ''}</url>`
    ),
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
