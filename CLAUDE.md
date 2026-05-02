# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Photography exhibition gallery site deployed on Cloudflare Pages. Static frontend + Pages Functions backend, with images stored on external image host `image.20041126.xyz`.

**Repository**: `Wievondii/testweb` → deploys to `web.265878.xyz` / `web.782385.xyz`

## Architecture

**Zero build step** — no bundler, no framework, no package.json. Cloudflare Pages serves static files directly and auto-routes `functions/api/` as serverless endpoints.

### Key Components

| Layer | Files | Purpose |
|-------|-------|---------|
| Gallery (public) | `index.html`, `js/main.js` | Masonry photo grid, lightbox, tag filtering |
| Admin panel | `admin.html`, `js/admin.js` | Password-gated photo management, upload, CRUD |
| Compressor | `js/compressor.js` | Client-side Canvas API compression to <4.5MB JPEG |
| Styles | `css/style.css` | Dark theme, single file for both gallery + admin |
| API backend | `functions/api/*.js` | Cloudflare Pages Functions (auto-routed) |

### Data Flow

```
Admin uploads image → compressor.js (<4.5MB) → POST /api/data (binary relay)
  → image.20041126.xyz/api/enableauthapi/tgchannel → returns { url }
  → POST /api/photos (save metadata to KV) → Gallery reads from /api/gallery
```

### API Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/gallery` | No | Public photo list for gallery |
| `GET /api/config` | No | Gallery title/subtitle |
| `GET/POST /api/auth` | No | Password validation (`{ valid: true/false }`) |
| `GET/POST/PUT/DELETE /api/photos` | Yes | Photo CRUD (admin) |
| `POST /api/config` | No* | Update gallery settings |
| `POST /api/data?n=filename&t=mime` | No | Image upload relay (binary proxy) |

*Config POST should require auth but currently doesn't.

## Cloudflare Setup

- **KV binding**: `PHOTOS_KV` must be bound in Pages project Settings → Functions → KV namespace bindings
- **KV namespace**: `photos-kv` (ID: `4cdccd079ae147efa6e273a7d8f8090a`)
- **KV keys**: `gallery_photos` (JSON array), `gallery_config` (JSON object), `gallery_password_hash` (SHA-256 string)
- **Default admin password**: `k423`
- **Image host**: `https://image.20041126.xyz` (Telegraph-Image on Cloudflare, 5MB limit)

## Deploy

```bash
git push origin main   # Triggers Cloudflare Pages auto-deploy
```

No build command configured — Pages serves files as-is.

## Important Implementation Notes

- **Upload relay** (`/api/data`): Uses `text/plain` Content-Type with raw binary body + URL params for filename/mime. This was specifically designed to bypass Cloudflare WAF which blocks multipart/form-data and JSON POSTs with suspicious patterns.
- **Auth**: Password is SHA-256 hashed client-side, sent as Bearer token. Hash stored in `sessionStorage`.
- **Cache busting**: CSS/JS use `?v=2` query params. Update when changing these files.
- **Fallback**: Gallery falls back to `photos.json` if API unreachable. Admin falls back to `localStorage`.
- **Three relay implementations** exist (`data.js`, `relay.js`, `upload.js`). Only `data.js` is actively used by admin.js.
