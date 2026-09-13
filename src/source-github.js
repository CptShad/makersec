import { config } from './config.js';

const API = 'https://api.github.com';

// Blobs are addressed by content hash, so anything we fetch is immutable and
// can be cached until we run out of patience (or entries).
const blobCache = new Map();
const BLOB_CACHE_MAX = 400;

function cachePut(key, value) {
  if (blobCache.size >= BLOB_CACHE_MAX) {
    const oldest = blobCache.keys().next().value;
    blobCache.delete(oldest);
  }
  blobCache.set(key, value);
}

let headState = { sha: null, etag: null, checkedAt: 0 };
let treeState = { sha: null, entries: null };

export const stats = { apiCalls: 0, lastError: null, rateRemaining: null, rateReset: null };

async function api(path, { etag } = {}) {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'makersec',
    'x-github-api-version': '2022-11-28',
  };
  if (config.token) headers.authorization = `Bearer ${config.token}`;
  if (etag) headers['if-none-match'] = etag;

  stats.apiCalls += 1;
  const res = await fetch(`${API}${path}`, { headers });
  stats.rateRemaining = res.headers.get('x-ratelimit-remaining');
  stats.rateReset = res.headers.get('x-ratelimit-reset');

  if (res.status === 304) return { notModified: true, etag };
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`GitHub ${res.status} on ${path}: ${body.slice(0, 300)}`);
    err.status = res.status;
    stats.lastError = { at: Date.now(), message: err.message };
    throw err;
  }
  return { data: await res.json(), etag: res.headers.get('etag') };
}

/** Current commit sha of the branch. Cheap call, guarded by TTL + ETag. */
export async function version({ force = false } = {}) {
  const fresh = Date.now() - headState.checkedAt < config.cacheTtl * 1000;
  if (!force && headState.sha && fresh) return headState.sha;

  const ref = encodeURIComponent(config.branch);
  const out = await api(`/repos/${config.repo}/git/ref/heads/${ref}`, { etag: headState.etag });
  headState.checkedAt = Date.now();
  if (out.notModified) return headState.sha;

  headState.sha = out.data.object.sha;
  headState.etag = out.etag;
  return headState.sha;
}

/** Flat list of every blob in the tree: [{ path, sha, size }]. */
export async function listEntries(sha) {
  if (treeState.sha === sha && treeState.entries) return treeState.entries;
  const { data } = await api(`/repos/${config.repo}/git/trees/${sha}?recursive=1`);
  if (data.truncated) {
    // Very large repos would need per-directory walking; say so rather than silently drop posts.
    stats.lastError = { at: Date.now(), message: 'Git tree was truncated by GitHub — repo is too large for a single recursive read.' };
  }
  treeState = {
    sha,
    entries: data.tree
      .filter((t) => t.type === 'blob')
      .map((t) => ({ path: t.path, sha: t.sha, size: t.size })),
  };
  return treeState.entries;
}

async function blob(sha) {
  if (blobCache.has(sha)) return blobCache.get(sha);
  const { data } = await api(`/repos/${config.repo}/git/blobs/${sha}`);
  const buf = Buffer.from(data.content || '', data.encoding === 'base64' ? 'base64' : 'utf8');
  cachePut(sha, buf);
  return buf;
}

export async function readText(entry) {
  return (await blob(entry.sha)).toString('utf8');
}

export async function readBinary(entry) {
  return blob(entry.sha);
}

export function reset() {
  headState = { sha: null, etag: null, checkedAt: 0 };
  treeState = { sha: null, entries: null };
}

export const label = () => `${config.repo}@${config.branch}`;
