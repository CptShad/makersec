const bool = (v, dflt = false) => {
  if (v === undefined || v === '') return dflt;
  return /^(1|true|yes|on)$/i.test(String(v));
};
const int = (v, dflt) => (Number.isFinite(Number(v)) && v !== '' && v !== undefined ? Number(v) : dflt);

const env = process.env;
const mode = (env.SITE_MODE || 'public').toLowerCase() === 'private' ? 'private' : 'public';

export const config = {
  mode,
  isPrivate: mode === 'private',

  port: int(env.PORT, 3000),
  host: env.HOST || '0.0.0.0',

  // Set when the site is served from a sub-path, e.g. GitHub Pages at /makersec-posts.
  basePath: (env.BASE_PATH || '').replace(/\/+$/, '').replace(/^(?=[^/])/, '/'),
  // True while src/build.js writes static files: no server-only links (status, refresh).
  isStatic: false,

  // Where the markdown lives.
  repo: env.GITHUB_REPO || '',            // "owner/name"
  branch: env.GITHUB_BRANCH || 'main',
  contentDir: (env.CONTENT_DIR || '').replace(/^\/+|\/+$/g, ''), // "" = repo root
  token: env.GITHUB_TOKEN || '',
  webhookSecret: env.WEBHOOK_SECRET || '',

  // Local folder instead of GitHub (dev / offline / "just point it at a synced dir").
  localContent: env.LOCAL_CONTENT || '',

  cacheTtl: int(env.CACHE_TTL, 120),      // seconds before we re-check the branch head
  showDrafts: bool(env.SHOW_DRAFTS, mode === 'private'),
  mermaid: bool(env.MERMAID, true),

  site: {
    title: env.SITE_TITLE || (mode === 'private' ? 'MakerSec Restricted' : 'MakerSec'),
    author: env.SITE_AUTHOR || '',
    url: (env.SITE_URL || '').replace(/\/+$/, ''),
    // Small print in the footer; repo link is hidden on private by default.
    showSource: bool(env.SHOW_SOURCE, mode !== 'private'),
  },

  excludes: (env.EXCLUDE || 'README.md,LICENSE.md,CONTRIBUTING.md')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
};

export function assertConfig() {
  if (config.localContent) return;
  if (!config.repo || !/^[\w.-]+\/[\w.-]+$/.test(config.repo)) {
    throw new Error('GITHUB_REPO must be set to "owner/name" (or set LOCAL_CONTENT to a folder path).');
  }
}

/** Prefix a site-absolute path ("/tags") with the base path. */
export const u = (path) => config.basePath + path;
