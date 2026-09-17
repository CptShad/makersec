// Full HTML documents, shared by the server and the static build so the two can't drift.
import * as views from './views.js';

export const NOT_FOUND = 'That page is not on this bench.';

export const indexHtml = (idx) =>
  views.layout({ body: views.indexPage(idx), active: '/', idx, canonical: '/' });

export function postHtml(post, html, idx) {
  const i = idx.posts.indexOf(post);
  const neighbors = { next: idx.posts[i - 1] || null, prev: idx.posts[i + 1] || null };
  return views.layout({
    title: post.title,
    description: post.summary,
    body: views.postPage(post, html, neighbors),
    idx,
    canonical: `/p/${post.slug}`,
  });
}

export const standaloneHtml = (page, html, idx) => views.layout({
  title: page.title,
  description: page.summary,
  body: views.pagePage(page, html),
  active: `/${page.slug}`,
  idx,
  canonical: `/${page.slug}`,
});

export const tagsHtml = (idx) =>
  views.layout({ title: 'Tags', body: views.tagsPage(idx), active: '/tags', idx, canonical: '/tags' });

export const tagHtml = (tag, idx) => views.layout({
  title: `#${tag.label}`,
  description: `Posts tagged ${tag.label}`,
  body: views.tagPage(tag),
  active: '/tags',
  idx,
  canonical: `/tags/${tag.key}`,
});

export const errorHtml = (code, message, idx = null) =>
  views.layout({ title: code === 404 ? 'Not found' : 'Error', body: views.errorPage(code, message), idx });
