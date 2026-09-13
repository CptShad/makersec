import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

// Dev / offline backend: same interface as source-github, backed by a folder.
const root = () => path.resolve(config.localContent);
export const stats = { apiCalls: 0, lastError: null, rateRemaining: null, rateReset: null };

async function walk(dir, base = '') {
  const out = [];
  let items;
  try {
    items = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const item of items) {
    if (item.name.startsWith('.') || item.name === 'node_modules') continue;
    const abs = path.join(dir, item.name);
    const rel = base ? `${base}/${item.name}` : item.name;
    if (item.isDirectory()) out.push(...(await walk(abs, rel)));
    else if (item.isFile()) {
      const st = await fs.stat(abs);
      out.push({ path: rel, sha: `${st.mtimeMs}-${st.size}`, size: st.size });
    }
  }
  return out;
}

export async function version() {
  const entries = await walk(root());
  const h = createHash('sha1');
  for (const e of entries.sort((a, b) => a.path.localeCompare(b.path))) h.update(`${e.path}:${e.sha}`);
  return h.digest('hex');
}

let cache = { key: null, entries: null };
export async function listEntries(key) {
  if (cache.key === key && cache.entries) return cache.entries;
  cache = { key, entries: await walk(root()) };
  return cache.entries;
}

export const readText = (entry) => fs.readFile(path.join(root(), entry.path), 'utf8');
export const readBinary = (entry) => fs.readFile(path.join(root(), entry.path));
export const reset = () => { cache = { key: null, entries: null }; };
export const label = () => `local:${config.localContent}`;
