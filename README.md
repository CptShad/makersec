# MakerSec

A self-hosted blog that reads its posts straight out of a GitHub repo. You push a
markdown file; a few seconds later it's on the site. No build step, no generator, no
static output directory — the server fetches from the GitHub API and caches.

Two instances run from the same image and differ only in which repo they read:

| | public | private |
|---|---|---|
| repo | your public posts repo | your private notes repo |
| port | `8080` | `8081` |
| binds to | `0.0.0.0` (behind a reverse proxy) | your Tailscale IP only |
| drafts | hidden | shown, badged |
| robots / sitemap | indexed | `noindex`, sitemap disabled |
| accent colour | cyan | violet + hazard stripe |
| "view source .md" link | shown | hidden |

## How it works

```
GitHub repo ──git/refs──► is the branch head new?
                │ no  → serve from cache
                │ yes → git/trees (one call, whole repo)
                        └─► git/blobs for each .md (cached by content hash)
                              └─► front matter + markdown-it + shiki → HTML
```

The branch head is re-checked at most every `CACHE_TTL` seconds (and the check uses
an ETag, so an unchanged repo costs no rate limit). A GitHub push webhook drops the
cache instantly, so the TTL is only a fallback. Blobs are addressed by content hash,
so unchanged posts are never re-fetched and never re-rendered.

Images and attachments next to your markdown are served through `/media/...`, which
means images in the **private** repo work without making anything public.

If GitHub is unreachable, the last good index keeps being served, and `/healthz`
reports `stale`.

## Content format

Any `.md` file in the repo (or under `CONTENT_DIR`) becomes a post. Front matter is
all optional:

```yaml
---
title: Adding current sense to a cheap bench PSU
date: 2026-08-02              # or put 2026-08-02- at the start of the filename
status: working               # working | wip | magic smoke | shelved | idea | draft
tags: [power, esp32, i2c]
summary: One line for the index page.
slug: bench-psu-current-sense # defaults to the filename
draft: false                  # true = private site only
cover: images/board.jpg       # relative to the .md file
parts:                        # rendered as a bill of materials in the sidebar
  - INA219 breakout
  - 0.01R 1% shunt
tools:
  - Hakko FX-888D
links:
  Datasheet: https://example.com/ds.pdf
---
```

Conventions worth knowing:

- `about.md`, `uses.md`, `now.md`, `colophon.md`, `contact.md` at the repo root become
  standalone pages (`/about`) instead of posts, and appear in the nav.
- `README.md` and `LICENSE.md` are ignored. Anything starting with `_` is ignored.
- Posts are numbered `#001` upward by date, oldest first, so numbers never shift.
- Relative links between `.md` files are rewritten to the right `/p/slug` URL.
- ` ```mermaid ` fences render as diagrams (mermaid loads from a CDN, only on pages
  that contain one; without internet the code is shown as text).
- Task lists, footnotes, tables and `- [ ]` checkboxes all work.

## Setup

### 1. Two repos

Make `yourname/makersec-posts` (public) and `yourname/makersec-private` (private).
Put your `.md` files at the root or in a `posts/` folder.

### 2. A token

Only the private repo strictly needs one. Create a **fine-grained PAT** with
*Repository access → the private repo* and *Permissions → Contents: Read-only*.
Setting it for the public site too raises the API limit from 60 to 5000 requests/hour.

### 3. Configure and run on den

```bash
cp .env.example .env
# edit .env — repos, token, and PRIVATE_BIND=$(tailscale ip -4)
docker compose up -d --build
```

Public lands on `http://den:8080`, private on `http://<tailscale-ip>:8081`.

> Binding the private container to the Tailscale address is the whole access control.
> Docker publishes ports by punching them through the host firewall, so if you bind it
> to `0.0.0.0` it is reachable from your entire LAN. Check it with `ss -tlnp | grep 8081`
> — the local address should be the `100.x.y.z` one, not `0.0.0.0`.

### 4. Webhooks (optional but nice)

In each repo: *Settings → Webhooks → Add webhook*

- Payload URL: `https://blog.example.com/webhook` (public) — the private one only
  needs this if it is reachable from GitHub, otherwise leave it and rely on the TTL
- Content type: `application/json`
- Secret: the same `WEBHOOK_SECRET` from `.env`
- Events: just push

Without a webhook, a new post appears within `CACHE_TTL` seconds. You can also force
it with `curl -X POST http://den:8080/api/refresh`.

### 5. Reverse proxy for the public site

Caddy, with automatic TLS:

```
blog.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8080
}
```

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `SITE_MODE` | `public` | `public` or `private` — sets colour, drafts, robots, source links |
| `GITHUB_REPO` | — | `owner/name`, required |
| `GITHUB_BRANCH` | `main` | branch to read |
| `CONTENT_DIR` | *(root)* | only index `.md` under this folder |
| `GITHUB_TOKEN` | — | fine-grained PAT, Contents: read |
| `WEBHOOK_SECRET` | — | HMAC secret for `/webhook` |
| `CACHE_TTL` | `120` | seconds between branch-head checks |
| `SHOW_DRAFTS` | private only | show `draft: true` posts |
| `SHOW_SOURCE` | public only | show the "view source .md" GitHub link |
| `MERMAID` | `true` | render ```mermaid fences as diagrams |
| `SITE_TITLE` / `SITE_AUTHOR` / `SITE_URL` | — | header, footer and feed metadata |
| `EXCLUDE` | `README.md,LICENSE.md,CONTRIBUTING.md` | filenames to skip |
| `REFRESH_TOKEN` | — | if set, `/api/refresh` requires `?token=` or `X-Refresh-Token` |
| `LOCAL_CONTENT` | — | read a local folder instead of GitHub (dev/offline) |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | listen address inside the container |

## Routes

| Route | Purpose |
|---|---|
| `/` | index, with client-side search and tag filtering |
| `/p/:slug` | a post |
| `/p/:slug.md` | its raw markdown |
| `/tags`, `/tags/:tag` | tag browsing |
| `/about`, `/uses`, … | standalone pages, if those files exist |
| `/media/*` | images and attachments from the repo |
| `/feed.xml`, `/sitemap.xml`, `/robots.txt` | syndication |
| `/api/posts.json` | the index as JSON |
| `/api/refresh` | force a re-fetch |
| `/webhook` | GitHub push webhook (HMAC verified) |
| `/healthz` | version, post count, rate limit, content errors |

## Local development

```bash
npm install
LOCAL_CONTENT=../makersec-posts npm run dev
```

`LOCAL_CONTENT` swaps the GitHub backend for a folder on disk, so you can write and
style against a local clone of the posts repo without touching the API.
