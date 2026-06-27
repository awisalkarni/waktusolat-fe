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
- Times are formatted as `HH:mm` in `Asia/Kuala_Lumpur`.
- Today's row is visually highlighted.

### 5.3 Next Prayer Countdown
- Card showing the next upcoming prayer name and a live HH:MM:SS countdown.
- After today's Isyak passes, it rolls to tomorrow's Subuh.
- If no upcoming prayer is known, shows "Lewat hari ini".

### 5.4 Monthly Timetable
- Scrollable table with the full month of prayer times.
- Today's row highlighted.

### 5.5 Caching & Performance
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
    ├── ZoneSelect
    ├── Next prayer card
    ├── Today's times list
    └── Monthly timetable
```

## 8. Future Enhancements

### 8.1 Automatic Location Detection
- Use browser geolocation to call `GET /v2/solat/gps/{lat}/{long}` (or `/zones/{lat}/{long}`) and auto-select the nearest JAKIM zone.
- Fallback gracefully if permission is denied.

### 8.2 Monthly / Yearly Navigation
- Allow users to view prayer times for other months and years.
- Useful for travel planning and Ramadan preparation.

### 8.3 Notifications
- Browser push notification or badge reminder before the next prayer.
- Optional notification 10 minutes before Subuh (Imsak).

### 8.4 Hijri Calendar Display
- Show current Hijri date more prominently.
- Optionally show full Hijri calendar alongside Gregorian dates.

### 8.5 Tarawih / Special Times
- Display special prayer times during Ramadan if available from upstream.

### 8.6 Offline Support
- Cache the current month's data in the browser (Service Worker / Workbox) so the app works offline after first load.

### 8.7 PWA
- Add a web app manifest and service worker so users can install the app to their home screen.

### 8.8 Theme
- Dark mode toggle.
- High-contrast mode for accessibility.

### 8.9 API Usage Dashboard
- Internal endpoint or log summary showing cache hit rates and upstream API calls.

### 8.10 Multi-Language Support
- English variant for non-Malay speakers (Arabic transliteration stays consistent).

## 9. Deployment & Operations

- **Server:** Ubuntu 22.04+ @ `43.134.175.91`
- **App Directory:** `/var/www/waktusolatapp`
- **Process Manager:** PM2 (`waktusolatapp`)
- **Reverse Proxy:** nginx (`/etc/nginx/sites-available/waktusolatapp.com`)
- **Domain:** waktusolatapp.com
- **CI/CD:** Manual git pull + build + PM2 restart (automation optional future enhancement).

## 10. Success Metrics

- Page loads in under 2 seconds on 3G.
- Zero direct upstream API calls for cached zone/month combinations.
- Mobile viewport usability score of 100.
- Uptime monitored via PM2 / nginx.