# WorkNear — "5 Km ke andar har kaam ka solution"

Hyperlocal service marketplace: customers find workers within 5/10/15 KM, chat directly, pay the worker directly (zero commission). Revenue = ₹30/month · ₹300/year subscription (admin-configurable).

| Folder | Stack |
|---|---|
| `Frontend/` | React 19 + Vite 8 + TypeScript + Tailwind v4 + TanStack Query + Zustand + React Router + Socket.IO client + recharts |
| `Backend/` | Node 24 + TypeScript + Express 5 + MongoDB (Mongoose 9) + Zod + Socket.IO + Multer + Pino + JWT + Firebase Admin (FCM) |

## Run locally
```bash
cd Backend
npm install
npm run dev             # http://localhost:5000  (GET /health)
npm run seed:admin      # ONCE per database: creates the super admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
# On every boot the server only builds indexes and the settings row (never an admin). No content is pre-seeded — categories, plans, banners, FAQs and
# legal pages are all created from the admin panel.
# Optional local test helpers live in Backend/scripts/ (gitignored): `npm run e2e`, `npm run security:check`.

cd ../Frontend
npm install
npm run dev             # http://localhost:5173  (proxies /api, /uploads, /socket.io → :5000)
```
- App: `/` — login with any 10-digit mobile, OTP `123456` while `USE_DEFAULT_OTP=true` (dev only; boot fails if true in production).
- Admin: `/admin/login` — `worknear@admin.com` / password from `SEED_ADMIN_PASSWORD` in `Backend/.env`. Enable MFA from Admin → My account.

## How it fits together
- **One account, two roles.** A user signs in with mobile + OTP (one `users` row per mobile). They can act as Customer, Worker, or both (`roles[]`, `activeRole`) — controlled by the `dualRole` switch.
- **Workers** create a `workerprofiles` row (GeoJSON point + 2dsphere index). Search uses MongoDB `$geoNear` (straight-line distance, boundary inclusive). Exact coordinates are never returned.
- **Chat** is REST for writes + Socket.IO for realtime fan-out (`message:new`, `conversation:read`, `notification:new`). Reviews unlock after the worker replies (one per conversation).
- **Subscriptions**: checkout creates a pending payment; activation only after server-side Razorpay signature verification or signed webhook (idempotent). Without Razorpay keys in dev, a "test gateway" is used.
- **Admin → Customization Settings**: every feature has a switch (subscriptions, chat, images, reviews, reports, complaints, verification, worker registration, dual role, portfolio, phone sharing, push, Hindi, banners) + **maintenance mode**. Switches are enforced by the API (`403 FEATURE_DISABLED` / `503 MAINTENANCE`) and pushed live to every open app over the socket (`settings:update`). The admin panel keeps working during maintenance.
- **Files** are stored on local disk for now: public media in `Backend/uploads/` (served at `/uploads`), verification documents & complaint evidence in `Backend/private-uploads/` (admin-only). Swap `Backend/src/lib/upload.ts` for S3/GCS later.
- **Dark mode** everywhere (app + admin) via CSS tokens on `<html data-theme>`; toggling plays a diagonal "paper fold" transition (View Transitions API).

Full API contract: [`Backend/API.md`](Backend/API.md).

## MongoDB collections
`users`, `otps` (TTL), `blocks`, `workerprofiles` (2dsphere), `verifications`, `reviews`, `conversations`, `messages`, `plans`, `subscriptions`, `payments`, `categories`, `banners`, `faqs`, `pages`, `settings`, `admins`, `complaints`, `notifications` (TTL 180d), `searchlogs` (TTL 90d), `counters`, `pushtokens` (TTL 60d).

## Deploy notes
- Frontend (Netlify): set `VITE_API_BASE_URL=https://<api>/api/v1` and `VITE_BACKEND_ORIGIN=https://<api>`.
- Backend: set `NODE_ENV=production`, `USE_DEFAULT_OTP=false`, SMS India Hub keys, Razorpay keys + webhook secret (`/api/v1/payments/webhook`), `PUBLIC_URL`, and `FRONTEND_URL`/`SOCKET_CORS_ORIGIN` to the site origin. Indexes and the settings row are created automatically at boot. Run `npm run seed:admin:prod` once (after `npm run build`) with a strong `SEED_ADMIN_PASSWORD` to create the super admin, then change it after first login. Running more than one instance behind a load balancer? Set `REDIS_ENABLED=true` + `REDIS_URL` and `TRUST_PROXY` to the number of proxy hops.
