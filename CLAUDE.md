# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Photography exhibition gallery site deployed on Cloudflare Pages. Static frontend + Pages Functions backend, with images stored on external image host `image.20041126.xyz`.

**Repository**: `Wievondii/testweb` → deploys to `web.265878.xyz` / `web.782385.xyz`

## Architecture

**Zero build step** — no bundler, no framework, no package.json. Cloudflare Pages serves static files directly and auto-routes `functions/api/` as serverless endpoints.

### Data Flow

```
Admin uploads image → compressor.js (<4.5MB) → POST /api/data (binary relay, text/plain)
  → image.20041126.xyz/api/enableauthapi/tgchannel → returns { url: "https://image.20041126.xyz/api/cfile/..." }
  → POST /api/photos (save metadata to KV) → Gallery reads from GET /api/gallery
```

### API Endpoints (functions/api/*.js)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/gallery` | No | Public photo list for gallery page |
| `GET /api/config` | No | Gallery title/subtitle |
| `GET/POST /api/auth` | No | Password validation → `{ valid: true/false }` |
| `GET/POST/PUT/DELETE /api/photos` | Yes | Photo CRUD (admin only) |
| `POST /api/config` | No | Update gallery settings (should require auth) |
| `POST /api/data?n=filename&t=mime` | No | Image upload relay (binary proxy) |

### Unused Relay Implementations

`relay.js` and `upload.js` are earlier iterations of the upload proxy. Only `data.js` is used by admin.js. Keep them for reference or delete.

## Cloudflare Setup

### KV Binding

The binding `PHOTOS_KV` **must** be set via API using **object format** (not array):

```bash
curl -X PATCH "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/pages/projects/web" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"deployment_configs":{"production":{"kv_namespaces":{"PHOTOS_KV":{"namespace_id":"4cdccd079ae147efa6e273a7d8f8090a"}}}}}'
```

After setting the binding, trigger a new deployment for it to take effect.

### KV Details

- **Binding name**: `PHOTOS_KV`
- **Namespace**: `photos-kv` (ID: `4cdccd079ae147efa6e273a7d8f8090a`)
- **Keys**: `gallery_photos` (JSON array), `gallery_config` (JSON object), `gallery_password_hash` (SHA-256 string)

### Image Host

- **URL**: `https://image.20041126.xyz`
- **Upload API**: `POST /api/enableauthapi/tgchannel` (multipart/form-data)
- **Image URLs**: `https://image.20041126.xyz/api/cfile/<file_id>`
- **Limit**: 5MB per image (compressor targets <4.5MB)

### Default Admin Password

`k423` — SHA-256 hash hardcoded in `functions/api/auth.js` and `functions/api/photos.js`.

## Deploy

```bash
git push origin main   # Triggers Cloudflare Pages auto-deploy
```

No build command configured — Pages serves files as-is.

## Key Implementation Details

- **Upload relay** (`/api/data`): Uses `text/plain` Content-Type with raw binary body + URL query params (`n`, `t`) for filename/mime. This bypasses Cloudflare WAF which blocks multipart/form-data and JSON POSTs with suspicious patterns.
- **Auth**: Password SHA-256 hashed client-side via `crypto.subtle.digest`, sent as Bearer token, stored in `sessionStorage`.
- **Cache busting**: CSS/JS loaded with `?v=2` query params. HTML has `Cache-Control: no-cache` meta tags.
- **Fallback**: Gallery falls back to static `photos.json` if API unreachable. Admin falls back to `localStorage`.
- **No CORS preflight**: The upload relay avoids custom headers to prevent CORS preflight requests, which are blocked by CF WAF.
