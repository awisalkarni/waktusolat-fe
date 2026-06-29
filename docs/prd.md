# Product Requirements Document: Waktu Solat Malaysia

## 1. Problem Statement

Malaysian Muslims need quick, accurate access to daily prayer times (waktu solat) based on JAKIM zones. Existing solutions may be cluttered, slow, or hard to use on mobile. This product provides a clean, fast, mobile-first web app that shows today's prayer times and the next upcoming prayer for any Malaysian location.

## 2. Goals

- Display accurate prayer times for all JAKIM zones in Malaysia.
- Surface the next prayer with a live countdown.
- Minimize load on the upstream API through aggressive caching.
- Work well on mobile and desktop with no app install required.
- Be deployable as a static-ish Nuxt app behind nginx + PM2.

## 3. Target Users

- Malaysian Muslims looking for daily prayer times.
- Users who want to check times for different states/districts while traveling.
- Anyone who prefers a lightweight web app over installing a native app.

## 4. Data Source

- **Primary API:** https://api.waktusolat.app
- **Endpoints used:**
  - `GET /zones` — list of JAKIM zones with state and district.
  - `GET /v2/solat/{zone}` — monthly prayer times as Unix-second timestamps.
- **Caching:** upstream month data is cached for 1 year per `zone:year:month` via Nitro's filesystem-backed cache.

## 5. Current Features

### 5.1 Zone Selection
- Dropdown grouped by state (negeri).
- Default zone: `WLY01` (Kuala Lumpur / Putrajaya).
- Selection is persisted to `localStorage` and reflected in the URL (`?zone=WLY01`).

### 5.2 Today's Prayer Times
- Shows all eight daily times: Imsak, Subuh, Syuruk, Dhuha, Zohor, Asar, Maghrib, Isyak.
- Times are formatted as 12-hour `hh:mm AM/PM` in `Asia/Kuala_Lumpur`.
- Today's row is visually highlighted.

### 5.3 Next Prayer Countdown
- Card showing the next upcoming prayer name and a live HH:MM:SS countdown.
- After today's Isyak passes, it rolls to tomorrow's Subuh.
- If no upcoming prayer is known, shows "Lewat hari ini".

### 5.4 Monthly Timetable
- Scrollable table with the full month of prayer times.
- Today's row highlighted.

### 5.5 Analytics
- Optional Google Analytics 4 integration via `NUXT_PUBLIC_GA_ID`.
- Loads gtag only on the client when configured.

### 5.6 Donation
- Footer donation section with the provided ToyyibPay donation link.
- Displays a QR code generated from the donation URL.
- Optional dynamic ToyyibPay bill creation via `POST /api/donate` for variable amounts.

### 5.7 Caching & Performance
- Zone list cached for 24 hours.
- `/api/solat/{zone}` handler cached for 60 seconds (today/tomorrow highlighting changes daily).
- Upstream month data cached for 1 year to minimize API calls.

## 6. Non-Functional Requirements

- **Locale:** Malay (ms-MY) for date headings; prayer labels in Malay.
- **Timezone:** All displayed times use `Asia/Kuala_Lumpur`.
- **Accessibility:** Countdown uses `aria-live="polite"`; semantic HTML.
- **SEO:** SSR renders meaningful content for crawlers.
- **Performance:** First load is server-rendered; subsequent navigation is client-side.
- **Reliability:** Upstream API failures return user-friendly error messages.

## 6A. Design Language

### 6A.1 Visual Style
- **Background:** Flat, solid medium-green (`#059669` / `emerald-600`) throughout.
- **Typography:** Roboto (Google Fonts), crisp white text on green.
- **Icons:** Line-art stroke SVGs in white, matching the flat minimal aesthetic.

### 6A.2 Layout
- **Hero dashboard (top ~40% viewport):** Massive current prayer time, prayer label, location (zone `daerah`), dual Gregorian + Hijri dates, minimalist sun icon, and settings gear (top-right).
- **Prayer list (bottom ~60%):** Vertical list of all 8 daily times. Rows alternate between `emerald-600` (base) and `emerald-700` for subtle separation.
- **Active prayer row:** Vibrant warm amber-orange (`amber-600`) background — stands out completely from the green theme.
- **Next prayer badge:** "Seterusnya" pill on the upcoming prayer row.
- **Settings panel:** Overlay triggered by gear icon, contains the zone selector.

### 6A.3 Animation — 3D Perspective Rolling Flip-In
- **Trigger:** When the view opens or data updates, prayer-list rows animate in sequentially from top to bottom.
- **Starting state:** Each row begins with `rotateX(-40°)`, `translateZ(-60px)`, and `opacity: 0`.
- **End state:** Flat facing the screen (`rotateX(0°)`), full opacity, no Z-offset.
- **Easing:** `cubic-bezier(0.25, 1, 0.5, 1)` — snaps quickly then settles smoothly.
- **Stagger:** Each successive row delays by `0.07s` via inline `animation-delay`.
- **Parent perspective:** `perspective(800px)` on the list container for 3D depth.
- **Fill mode:** `both` so rows hold their final state after animation completes.

### 6A.4 Color Palette
| Token | Hex | Usage |
|-------|-----|-------|
| `bg-emerald-600` | `#059669` | Page background, default row, today row in timetable |
| `bg-emerald-700` | `#047857` | Alternate prayer rows, card sections |
| `bg-amber-600` | `#d97706` | Active prayer highlight |
| `text-white` | `#ffffff` | All primary text |
| `text-white/50–70` | — | Secondary/tertiary labels |

## 7. Architecture

```
Browser / nginx
    │
    ▼
Nuxt Nitro (port 3000)
    ├── /api/zones      → proxy /zones, group by state
    └── /api/solat/:zone → proxy /v2/solat/:zone, transform timestamps,
                            return today + tomorrow
    │
    ▼
Vue app (pages/index.vue)
    ├── ZoneSelect (in settings overlay)
    ├── Hero dashboard
    │   ├── Settings gear (toggles ZoneSelect overlay)
    │   ├── Current prayer time (massive heading)
    │   ├── Location + dual dates
    │   ├── Sun icon + next-prayer countdown
    │   └── Prayer times list (3D flip-in stagger animation)
    └── Monthly timetable
```

## 8. Future Enhancements

- ~~**8.1 Automatic Location Detection**~~ ✅ Done
  - On mount, requests browser geolocation with `enableHighAccuracy: true`.
  - Proxies upstream `GET /zones/{lat}/{lng}` via `/api/zone-by-gps` server route.
  - Auto-selects the nearest JAKIM zone code.
  - Displays pin icon + `(dikesan)` badge in the hero when auto-detected.
  - User override: once the zone is manually changed, sets a `localStorage` flag (`waktusolatfe.location_overridden`) and never auto-detects again.
  - Fallback: shows "Guna lokasi semasa" button in the hero and settings panel if geolocation is denied or fails.

### ~~8.2 Monthly / Yearly Navigation~~ ✅ Done
- Left/right chevron buttons above the timetable to cycle through months.
- "Hari ini" quick-reset button appears when browsing a non-current month.
- Browsed month fetched via separate `$fetch` with `?year=&month=` query params.
- Timetable falls back to current month when not browsing.
- Loading and error states for browse fetch.
- Server already supported the query params — UI only.

### ~~8.3 Notifications~~ ✅ Done
- Browser notification fires 5 minutes before each prayer (Subuh, Syuruk, Zohor, Asar, Maghrib, Isyak).
- Imsak notification fires 10 minutes before Subuh.
- Notifications include the prayer name, formatted time, and "5 minit lagi" / "10 minit sebelum Subuh".
- Permission and enable/disable handled via `usePrayerNotifications` composable; one-minute polling interval for reliable timing.

### ~~8.4 Hijri Calendar Display~~ ✅ Done
- Hijri date shown on its own line below the Gregorian date in the hero dashboard.
- Full Hijri calendar column in the monthly timetable (day + Malay month name, e.g. "14 Ramadan").
- Weekday names in Malay (Ahad–Sabtu) shown in a dedicated column.
- `formatHijri` / `formatHijriLong` helpers for consistent display.

### 8.5 Tarawih / Special Times
- Display special prayer times during Ramadan if available from upstream.

### ~~8.6 Offline Support~~ ✅ Done
- SW install precaches static assets (/, manifest, icons).
- Network-first strategy for `/api/*` routes with cache fallback.
- Page proactively sends `/api/zones` and `/api/solat/{zone}` URLs to the SW via `postMessage` after first fetch, so the current zone's data is cached for offline.
- SW message handler (`CACHE_URLS`) caches arbitrary URLs on demand from the client.

### ~~8.7 PWA~~ ✅ Done
- Web app manifest with standalone display, maskable icons.
- Service worker: static-asset precache, network-first API caching, message-based on-demand caching.
- Install prompt handled client-side via `beforeinstallprompt` event.
- iOS instruction text for Safari "Add to Home Screen".

### 8.8 Theme
- Dark mode toggle.
- High-contrast mode for accessibility.

### 8.9 API Usage Dashboard
- Internal endpoint or log summary showing cache hit rates and upstream API calls.

### 8.10 Multi-Language Support
- English variant for non-Malay speakers (Arabic transliteration stays consistent).

### 8.11 Analytics Enhancements
- Event tracking for zone changes, donation clicks, and prayer-time views.
- Privacy-focused alternative (e.g., Plausible or Fathom) as a configurable option.

## 9. Mobile-First Value Additions

These features are designed to make the app sticky enough that users want it on their home screen and feel it is worth supporting.

### 9.1 Home Screen Widget / Shortcut (Android/iOS)
- PWA install prompt so users can add the app to their home screen.
- For Android: investigate a simple widget showing the next prayer and countdown.
- For iOS: support Safari "Add to Home Screen" with a standalone display mode.

### 9.2 Native App Export
- **Capacitor (recommended):** wrap the Nuxt PWA as an Android/iOS app with minimal native code.
- **Tauri (desktop):** build a lightweight Windows/macOS/Linux desktop app using the same web codebase.
- App stores increase discoverability and give users a reason to donate ("support the app").

### 9.3 Prayer Notifications
- Browser notification before each prayer (customisable: all prayers or only Subuh/Maghrib).
- Imsak notification 10 minutes before Subuh.
- Optional daily summary notification in the morning.

### 9.4 Qibla Direction
- Use device orientation API to show a simple Qibla compass on mobile.
- Useful for travelers and a strong "app-worthy" feature.

### 9.5 Masjid / Surau Finder
- Integrate Google Places or a curated list to show nearby mosques.
- Filter by current prayer (e.g., "masjid near me for Maghrib").

### 9.6 Prayer Journal / Checklist
- Allow users to tick off prayers as they perform them.
- Show a weekly/monthly streak view.
- Keep data local-first (localStorage / IndexedDB); optional sync later.

### 9.7 Ramadan Mode
- Highlight Imsak, Subuh, and Maghrib during Ramadan.
- Show countdown to Imsak and Maghrib for fasting.
- Add Tarawih reminder after Isyak.

### 9.8 Travel Mode
- Save multiple favourite zones (e.g., hometown + workplace + travel destination).
- Quick switcher in the header.

### 9.9 Share / Invite
- One-tap share current prayer times for the selected zone via WhatsApp / Telegram.
- "Share this app" button with a pre-written Malay message.

### 9.10 Accessibility & Customisation
- Larger font mode for older users.
- AM/PM vs 24-hour toggle (already implemented: AM/PM default).
- Choice of notification sounds (azan snippets if licensing allows).

## 10. Desktop Value Additions

### 10.1 Always-On Widget
- A small, floating desktop widget (via Tauri) showing the next prayer and countdown.
- Minimise to system tray / menu bar.

### 10.2 Monthly PDF Export
- Generate and download a printable PDF timetable for the selected zone/month.
- Reuses the existing `/jadual_solat/{zone}` upstream endpoint.

### 10.3 Keyboard Shortcuts
- Press `z` to open zone selector, `/` to focus search, `n` to jump to next prayer.

### 10.4 Multi-City Dashboard
- Side-by-side prayer times for several zones on one screen.
- Useful for users managing teams or family across states.

## 11. Monetisation & Donation Incentives

### 11.1 Transparent Costs
- Public "cost to run" page showing server/domain expenses.
- Progress bar toward monthly hosting goal.

### 11.2 Supporter Recognition
- Optional name/list of supporters on a "Terima Kasih" page.
- No ads, ever, for donors.

### 11.3 Sponsor Links
- Link to the developer (awislabs.com) and offer sponsored features for mosques or Islamic organisations.

## 12. Technical Roadmap Priority

1. ✅ ~~**Phase 1 — PWA + Notifications**~~ (highest impact, lowest effort)
2. **Phase 2 — Prayer Journal + Favourites** (increases daily retention)
3. **Phase 3 — Qibla + Masjid Finder** (app-worthy features)
4. **Phase 4 — Capacitor/Tauri Export** (expand distribution)
5. **Phase 5 — Desktop Widget + PDF Export** (desktop value)

## 13. Deployment & Operations

- **Server:** Ubuntu 22.04+ @ `43.134.175.91`
- **App Directory:** `/var/www/waktusolatapp`
- **Process Manager:** PM2 (`waktusolatapp`)
- **Reverse Proxy:** nginx (`/etc/nginx/sites-available/waktusolatapp.com`)
- **Domain:** waktusolatapp.com
- **CI/CD:** Manual git pull + build + PM2 restart (automation optional future enhancement).

## 14. Success Metrics

- Page loads in under 2 seconds on 3G.
- Zero direct upstream API calls for cached zone/month combinations.
- Mobile viewport usability score of 100.
- Uptime monitored via PM2 / nginx.