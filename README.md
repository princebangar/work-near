# WorkNear — "5 Km ke andar har kaam ka solution"

| Folder | Stack |
|---|---|
| `Frontend/` | React 19 + Vite 8 + TypeScript + Tailwind v4 + TanStack Query + Zustand + React Router |
| `Backend/` | Node + TypeScript + Express 5 + Zod + Pino + JWT |

## Run
```bash
cd Backend  && npm run dev   # http://localhost:5000  (GET /health)
cd Frontend && npm run dev   # http://localhost:5173
```
- Customer/Worker app: `/` (demo OTP `123456`)
- Admin panel: `/admin/login` (MFA demo code `123456`)

## Frontend notes
- `VITE_USE_MOCK=true` → in-browser mock API (`src/mocks`). Set `false` to hit the real backend (proxied `/api` → `:5000`).
- App screens render in a phone-width frame (`--app-max-w`); admin is fully responsive.
- Theme = CSS tokens at the top of `src/index.css`. Swap them to re-skin.
- React Native ready: `src/api`, `src/store`, `src/types`, `src/i18n` hold no DOM code and can be reused as-is.

## Backend notes
- `/api/v1` versioned. Response envelope `{ data }` / `{ error: { code, message, details } }`.
- Done: env validation, helmet, CORS, compression, ETag, rate limits, OTP (hashed, TTL, attempt limits), JWT + role guard, worker radius search (bbox + haversine, cursor pagination).
- Next: PostgreSQL + PostGIS, Redis (OTP/rate-limit), chat (WebSocket), subscription + payment webhooks, admin + audit logs.
