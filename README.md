# my.cdn

A tiny personal image CDN on Cloudflare Workers. Clone it, run one command, and you have your own.

- **Upload** (signed-in users only): drag-and-drop, server-side resize to max 2048×2048 and recompression via the Cloudflare Images binding, stored in R2.
- **Serve** (public): `/i/<name>` with edge caching, `?w=256|512|1024` for thumbnails, `?download` for attachment.
- **Organize**: rename images, add aliases (extra names for the same file), tag anything from a one-click popover. `/t/<tag>` is a public gallery.
- **Auth**: passwordless magic links via better-auth. Only people in the user list can sign in; signed-in users manage that list at `/u`.

## Setup

You need [Bun](https://bun.sh), a Cloudflare account, and a domain whose DNS is on Cloudflare.

```bash
bun install
bun run setup
```

Setup logs you in to Cloudflare if needed, asks for an app name, the domain to serve from, and your email, then shows you exactly what it's about to create before it touches anything:

- a Worker with `<domain>` as a custom domain (Cloudflare handles DNS and TLS)
- a D1 database with the schema from `migrations/`
- an R2 bucket for the files
- Email Sending on the domain, for the magic-link emails
- a locally generated `BETTER_AUTH_SECRET`, stored as a worker secret
- your email as the first user

It writes `wrangler.jsonc` and `.dev.vars` for you. Both are gitignored, so your ids and secrets never end up in a fork. The committed [wrangler.template.jsonc](wrangler.template.jsonc) is the source of truth for bindings.

## Day to day

```bash
bun run dev                        # http://localhost:8787, sign-in links print to the console
bun run deploy                     # build + wrangler deploy
bun run user:add someone@x.com --remote   # add a user from the CLI (or use /u in the app)
bun run db:migrate                 # apply new migrations to production
```

## Stack

Workers + static assets · D1 · R2 · Images binding · Email Service · React + Mantine, bundled by Bun.

## Notes

- `sharp` can't run on Workers (native libvips), so resizing and recompression use the Cloudflare Images binding. Output keeps the input format (JPEG/PNG/GIF/WebP/AVIF) at quality 85.
- Images are keyed in R2 by a random id, so renames and aliases never move files.
- Delivery responses are cached for a day. Renames and deletes purge the edge cache in the colo that handled the request; other colos expire naturally.
- SVG uploads are rejected on purpose (they can carry scripts).
- If your domain already had a DNS record, the first deploy fails with a conflict. `bunx wrangler deploy --force` replaces the record with the worker.
