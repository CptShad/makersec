import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import Shiki from '@shikijs/markdown-it';
import { config } from './config.js';

let mdPromise = null;

const ABSOLUTE = /^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i;

/** Resolve a link relative to the post's directory inside the repo. */
export function resolveRepoPath(dir, rel) {
  const parts = [...(dir ? dir.split('/') : []), ...rel.split('/')];
  const out = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

function fenceToMermaid(md) {
  const fence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const info = (tokens[idx].info || '').trim().split(/\s+/)[0];
    if (config.mermaid && info === 'mermaid') {
      return `<div class="diagram"><pre class="mermaid">${md.utils.escapeHtml(tokens[idx].content)}</pre></div>\n`;
    }
    return fence(tokens, idx, opts, env, self);
  };
}

function rewriteAssets(md) {
  const image = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];
    const src = token.attrGet('src') || '';
    if (!ABSOLUTE.test(src)) {
      token.attrSet('src', `/media/${resolveRepoPath(env.dir || '', src).split('/').map(encodeURIComponent).join('/')}`);
    }
    token.attrSet('loading', 'lazy');
    token.attrSet('decoding', 'async');
    return image(tokens, idx, opts, env, self);
  };

  const linkOpen = md.renderer.rules.link_open || ((t, i, o, e, s) => s.renderToken(t, i, o));
  md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];
    const href = token.attrGet('href') || '';
    if (!ABSOLUTE.test(href) && /\.md(#.*)?$/i.test(href)) {
      // Cross-link between posts: point at the slug we serve it under.
      const [file, hash = ''] = href.split('#');
      const target = resolveRepoPath(env.dir || '', file);
      const slug = env.slugByPath?.get(target);
      if (slug) token.attrSet('href', `/p/${slug}${hash ? `#${hash}` : ''}`);
    } else if (/^https?:/i.test(href)) {
      token.attrSet('rel', 'noopener noreferrer');
      token.attrSet('target', '_blank');
      token.attrSet('class', `${token.attrGet('class') ? `${token.attrGet('class')} ` : ''}ext`);
    }
    return linkOpen(tokens, idx, opts, env, self);
  };
}

export async function getMarkdown() {
  if (mdPromise) return mdPromise;
  mdPromise = (async () => {
    const md = new MarkdownIt({ html: true, linkify: true, typographer: true, breaks: false });

    md.use(
      await Shiki({
        themes: { light: 'github-light', dark: 'github-dark' },
        defaultColor: false,
        fallbackLanguage: 'text',
      }),
    );
    md.use(anchor, {
      level: [2, 3, 4],
      slugify: (s) => s.trim().toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, ''),
      permalink: anchor.permalink.linkInsideHeader({ symbol: '#', placement: 'after', class: 'anchor' }),
    });
    md.use(footnote);
    md.use(taskLists, { enabled: true, label: true });

    fenceToMermaid(md);
    rewriteAssets(md);
    return md;
  })();
  return mdPromise;
}

export async function render(body, env = {}) {
  const md = await getMarkdown();
  return md.render(body, env);
}

export async function renderInline(body, env = {}) {
  const md = await getMarkdown();
  return md.renderInline(body, env);
}
