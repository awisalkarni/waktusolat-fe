# Agent Instructions: waktusolat-fe

## Project Overview

A Nuxt 4 frontend that displays Malaysian Islamic prayer times (waktu solat) by JAKIM zone. Data is sourced from `https://api.waktusolat.app`. The app proxies that API through Nitro server routes because the upstream API does not send CORS headers.

Live site: https://waktusolatapp.com
Repo: https://github.com/awisalkarni/waktusolat-fe

## Tech Stack

- **Framework:** Nuxt 4 (preset: `node-server`)
- **Language:** TypeScript
- **Styling:** Tailwind CSS via `@nuxtjs/tailwindcss`
- **Package Manager:** pnpm
- **Runtime:** Node.js 22+
- **Process Manager:** PM2
- **Reverse Proxy:** nginx
- **Host:** Ubuntu server @ 43.134.175.91, deployed to `/var/www/waktusolatapp`

## Directory Layout

```
app/
  app.vue                 # Root shell (NuxtPage only)
  components/             # Vue components
  composables/            # Vue composables (auto-imported)
  pages/index.vue         # Main page
assets/css/main.css       # Tailwind entry
public/                   # Static assets
server/api/               # Nitro server routes (proxy + transform)
shared/types/             # Types shared between client and server
nuxt.config.ts            # Modules, runtimeConfig, routeRules
tailwind.config.js
ecosystem.config.cjs      # PM2 config (server-side file)
```

## Key Conventions

### Shared types

Types in `shared/types/` are imported with the `#shared` alias in both app and server code. **Never** use relative paths like `../../shared/types/...` from server routes — Nitro cannot resolve them after bundling.

```ts
// Good
import type { Zone } from '#shared/types/waktusolat'

// Bad — breaks production build
import type { Zone } from '../../shared/types/waktusolat'
```

### Server routes

- `server/api/zones.get.ts` — returns JAKIM zones grouped by state.
- `server/api/solat/[zone].get.ts` — proxies `/v2/solat/{zone}`, converts Unix-second timestamps to `HH:mm` in `Asia/Kuala_Lumpur`, and returns `today` + `tomorrow` rows.
- Upstream month data is cached for **1 year** via `defineCachedFunction` (filesystem-backed on Node) to minimize API usage.

### Time handling

- All prayer timestamps from upstream are Unix seconds.
- Convert to Malaysian time (`Asia/Kuala_Lumpur`) for display and for determining "today".
- Use `Intl.DateTimeFormat` with `timeZone: 'Asia/Kuala_Lumpur'` rather than assuming server-local time.

### Next-prayer logic

- `useNextPrayer` scans today's prayers (excluding Imsak) and then tomorrow's, so after Isyak it shows the next day's Subuh.
- Countdown ticks client-side after hydration; SSR renders a static placeholder.

## Commands

```bash
# Dev
pnpm dev

# Typecheck
pnpm exec nuxi typecheck

# Production build
pnpm build

# Preview built output locally
node .output/server/index.mjs
```

## Deployment

Deploys are git-based on the Ubuntu server:

```bash
ssh ubuntu@43.134.175.91
cd /var/www/waktusolatapp
git pull
pnpm install
pnpm build
pm2 restart waktusolatapp
```

PM2 config: `/var/www/waktusolatapp/ecosystem.config.cjs`
Nginx config: `/etc/nginx/sites-available/waktusolatapp.com`

## Code Style

- Prefer explicit types; avoid `ReturnType<typeof fn>` for public contracts.
- Use `import type` at the top level; avoid inline `import("...").Type` annotations.
- Validate external data with type guards or schema parsers; avoid unchecked inline casts like `(x as { y: T }).y`.
- Keep functions purposeful. Tiny one-expression wrappers are fine only when they name a non-obvious formula or are reused.
- Don't guard `clearInterval`/`clearTimeout` with truthiness checks — they are no-ops on null/undefined per spec.

## Environment Variables

- `NUXT_API_URL` — upstream API base (default: `https://api.waktusolat.app`)
- `NUXT_PORT` — server port in production (PM2 sets `3000`)

## Notes for Agents

- Do **not** call `api.waktusolat.app` directly from the browser — always route through `server/api/`.
- Zone codes follow JAKIM format (e.g., `WLY01`, `SGR01`, `JHR02`).
- Before changing server-route imports or shared types, run `pnpm build` locally; dev-only typecheck may pass while production bundling fails.
- Keep the UI in Malay since the audience is Malaysian Muslims.