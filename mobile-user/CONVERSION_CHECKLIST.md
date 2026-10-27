# WorkNear — React web → Expo Android conversion checklist

Target app: **user app** (one app, two roles: Customer + Worker — same login, `activeRole` switch).
Status legend: **Verified** = ran it and saw it work · **Built, not tested** = code written, needs a device test · **Blocked** = cannot be completed (reason given).

## 0. Discovered inputs

| Input | Value | Source |
|---|---|---|
| Web frontend | `Frontend/` (React 19 + Vite + Tailwind + TanStack Query + Zustand) | repo |
| Backend | `Backend/` (Express 5 + MongoDB + Socket.IO + FCM) | repo |
| Flutter wrapper | **none in the repo** | repo search — see Assumptions |
| New app folder | `mobile-user/` | — |
| App name | `WorkNear` | `Frontend/index.html` `<title>`, `Frontend/src/config/env.ts` `APP.name` |
| Android package | `com.worknear.user` | given by the user (no wrapper to read it from) |
| Version | `1.0.0` / versionCode `1` | `GET /settings` → `appVersion: "1.0.0"`; no wrapper `pubspec.yaml` |
| Icon / splash | `C:/Users/Prince/Downloads/Work Near Me/Worknear logo new.png` (cut into mark / wordmark / tagline) | given by the user |
| API base URL | `https://worknear.in/api/v1` | user ("AWS, worknear.in"); verified: `GET https://worknear.in/health` → `{"status":"ok","db":true}` |
| Media + Socket.IO origin | `https://worknear.in` | `Backend/src/app.ts` (`/uploads`, `/socket.io`) |
| Maps key | `AIzaSyBQ…U4Rk` (Android Maps SDK, Geocoding, Places New) | `Frontend/.env` `VITE_GOOGLE_MAPS_API_KEY` (updated by the user during the run) |
| Razorpay public key | `rzp_test_T2IBdxMTde7P65` (server also returns `keyId` per order) | `Frontend/.env` |
| Firebase (push) | project `worknear-4e892`; **no `google-services.json` for `com.worknear.user` yet** | `Frontend/.env` — user will provide later |
| Test login | Backend `USE_DEFAULT_OTP=true`, `DEFAULT_OTP=123456` in `Backend/.env` (local). Live server value unknown — not probed (would send a real SMS) | `Backend/.env`, `Backend/src/modules/auth/auth.routes.ts` |
| Expo / EAS | SDK 58 (`expo@58.0.19`, RN 0.88). `eas whoami` → **Not logged in** | CLI |

Secrets **not** copied into the app: Mongo URI, JWT secrets, Razorpay secret, SMS keys, Firebase service account.

## 1. Routes / screens (web `Frontend/src/main.tsx`)

| Web route | Guard | Native route | Status |
|---|---|---|---|
| `/welcome` | public | `src/app/welcome.js` | Built, not tested |
| `/login` | public | `src/app/login.js` | Built, not tested |
| `/otp` | public | `src/app/otp.js` | Built, not tested |
| `/role` | needs session | `src/app/role.js` | Built, not tested |
| `/legal/:slug` | public | `src/app/legal/[slug].js` | Built, not tested (live server has no legal pages yet → "Page not found", same as web) |
| `/` Home (customer) / Dashboard (worker) | RequireAuth + tabs | `(app)/(tabs)/index.js` | Built, not tested |
| `/search` | RequireAuth + tabs | `(app)/(tabs)/search.js` | Built, not tested |
| `/chats` | RequireAuth + tabs | `(app)/(tabs)/chats.js` | Built, not tested |
| `/my-profile` (worker) | RequireAuth + tabs | `(app)/(tabs)/my-profile.js` | Built, not tested |
| `/account` | RequireAuth + tabs | `(app)/(tabs)/account.js` | Built, not tested |
| `/worker/:id` | RequireAuth | `(app)/worker/[id].js` | Built, not tested |
| `/chats/:id` | RequireAuth | `(app)/chats/[id].js` | Built, not tested |
| `/notifications` | RequireAuth | `(app)/notifications.js` | Built, not tested |
| `/subscription` | RequireAuth | `(app)/subscription.js` | Built, not tested |
| `/onboarding` (worker wizard) | RequireAuth | `(app)/onboarding.js` | Built, not tested |
| `/verification` | RequireAuth | `(app)/verification.js` | Built, not tested |
| `/profile/edit` | RequireAuth | `(app)/profile/edit.js` | Built, not tested |
| `/settings/notifications` | RequireAuth | `(app)/settings/notifications.js` | Built, not tested |
| `/blocked` | RequireAuth | `(app)/blocked.js` | Built, not tested |
| `/help` | RequireAuth | `(app)/help/index.js` | Built, not tested |
| `/help/complaint` | RequireAuth | `(app)/help/complaint.js` | Built, not tested |
| Maintenance screen (admin switch) | global | `MaintenanceGate` in root layout | Built, not tested |
| Location picker (list + map) | sheet | `src/components/LocationSheet.js` | Built, not tested |

**Left out (scope):** `/admin/login`, `/admin/*` (admin panel — desktop, stays on the web).

## 2. APIs (same paths as `Frontend/src/api/index.ts`, all via `src/lib/http.js`)

| Method + path | Used by | Status |
|---|---|---|
| GET `/settings` | bootstrap, maintenance | **Verified** (200 from live) |
| GET `/categories` | home, search, onboarding | **Verified** (200) |
| GET `/banners` | home | **Verified** (200, empty) |
| GET `/faqs` | help | **Verified** (200, empty) |
| GET `/pages/:slug` | legal | **Verified** (404 NOT_FOUND handled as web does) |
| GET `/workers/search` | home, search | **Verified** (200, returns items) |
| GET `/workers/:id` | worker profile | Built, not tested (not called: it counts a real profile view) |
| POST `/auth/request-otp`, `/auth/verify-otp`, `/auth/refresh` | login, otp, http client | Built, not tested (not called on live: could send a real SMS) |
| GET/PATCH `/me`, POST `/me/avatar`, POST `/me/delete-request` | account, role, edit profile | Built, not tested |
| GET/POST/PATCH/DELETE `/me/addresses[/:id]` | location picker | Built, not tested |
| GET `/blocked`, POST `/blocks`, DELETE `/blocks/:userId` | blocked users, profile, chat | Built, not tested |
| GET `/workers/me/dashboard`, GET `/workers/me/profile`, PATCH `/workers/profile`, PATCH `/workers/me/status` | worker dashboard / profile / wizard | Built, not tested |
| POST `/workers/profile/photo`, POST/DELETE `/workers/profile/portfolio` (multipart) | worker profile | Built, not tested |
| GET `/verification/me`, POST `/verification/submissions` (multipart) | verification | Built, not tested |
| GET/POST `/conversations`, PATCH `/conversations/:id`, GET `/conversations/:id/messages`, POST `…/read`, POST `…/messages`, POST `…/images` (multipart) | chat | Built, not tested |
| GET `/notifications`, PATCH `/notifications/:id/read`, POST `/notifications/read-all` | notifications | Built, not tested |
| POST/DELETE `/me/push-tokens` (`platform: 'android'`) | push | Blocked — needs `google-services.json` (see Blockers) |
| GET `/subscription/plans`, `/subscription/me`, `/subscription/payments`, POST `/subscription/checkout`, `/subscription/verify` | subscription | Built, not tested (no real payment triggered) |
| GET `/reviews/eligibility`, POST `/reviews`, POST `/reports` | profile, chat | Built, not tested |
| GET `/complaints/me`, POST `/complaints` (JSON or multipart) | help | Built, not tested |
| Socket.IO `settings:update`, `message:new`, `conversation:read`, `notification:new`, `account:suspended` | realtime | Handshake **Verified** (`/socket.io` polling → websocket upgrade offered); events Built, not tested |

## 3. Auth (backend contract unchanged)
- Mobile + OTP → `POST /auth/verify-otp` returns `{ token, refreshToken, user }` (JWT, access 7d / refresh 30d).
- Sent as `Authorization: Bearer <token>` — the backend already accepts this; **no backend change**.
- Stored in **SecureStore** (`wn-auth`: token, refresh token, user) via zustand `persist`; other prefs in AsyncStorage.
- 401 → single-flight `POST /auth/refresh` → replay once; refresh failure → logout. `403 SUSPENDED` / socket `account:suspended` → logout.
- Logout: unregister push token, clear session + query cache.
- Session survives app restart: Built, not tested (SecureStore persistence; needs a device).

## 4. Design tokens / shared components
- Tokens from `Frontend/src/index.css` → `src/theme/index.js` (light + pure-black dark, green `#15803d` / `#16a34a`).
- Font: Plus Jakarta Sans 400/500/600/700/800 (same as web Google Fonts), bundled.
- Icons: `lucide-react-native` (web uses `lucide-react`).
- Shared components: `src/components/ui.js` (Button, Input, Textarea, Card, Chip, Badge, Avatar, Stars, Rating, VerifiedBadge, CategoryIcon, TopBar, Sheet, CenterDialog, Toggle, Skeleton, EmptyState, ErrorState, Toaster …), `shared.js`, `system.js`, `TabBar.js`, `LocationSheet.js`.
- Dark mode, per-panel theme (customer / worker), Hindi — existing web features, carried over (not added).

## 5. Flutter wrapper capabilities
No wrapper exists, so nothing to carry over from it. Native capabilities come from what the web app itself does:

| Capability | Native | Status |
|---|---|---|
| Push notifications (web FCM) | `expo-notifications` + FCM device token, channel `default`, foreground → toast, tap → deep link | Blocked (needs `google-services.json`) |
| Location (browser geolocation) | `expo-location`, foreground only, asked on tap | Built, not tested |
| Maps (Google Maps JS) | `react-native-maps` (Google provider) + REST Geocoding / Places (New) with the same key | Built, not tested (key + REST calls Verified from CLI) |
| File upload (`<input type=file>`) | `expo-image-picker` (photos), `expo-document-picker` (photo/PDF docs & evidence) | Built, not tested |
| Payments (Razorpay checkout.js) | WebView for the checkout step only; UPI intents open outside | Built, not tested |
| Share (`navigator.share`) | RN `Share` with `https://worknear.in/worker/<id>` | Built, not tested |
| tel: / wa.me / mailto: links | `Linking.openURL` | Built, not tested |
| Splash + icon | Native splash (pin mark) → animated intro (ping ripples, wordmark, tagline) | Built, not tested |
| Android back | Stack back / tabs `backBehavior="history"`; sheets close on back | Built, not tested |

## 6. Web-only APIs replaced
localStorage → SecureStore/AsyncStorage · Tailwind → StyleSheet + theme file · View Transitions theme fade → instant switch · IntersectionObserver infinite scroll → FlatList `onEndReached` · hide-on-scroll window listener → `onScroll` handler · `URL.createObjectURL` previews → local file URIs · Maps JS Geocoder/Places → REST · service-worker push → expo-notifications · `document.visibilityState` → `AppState` · `navigator.share`/clipboard → `Share` · `window.open` → `Linking`.

## 7. Scope left out
Admin panel (`/admin/login`, `/admin/*`, `Frontend/src/features/admin/**`) — desktop-only, stays on the web.

## Assumptions
1. **No Flutter wrapper in the repo.** The PDF treats this as a hard stop; the user stated the target (user app) and package (`com.worknear.user`) and supplied the logos, so the wrapper-derived inputs come from the user instead.
2. **Backend URL** — `Frontend/.env` uses `/api/v1` (same origin); commented `https://api.worknear.in` does not resolve (DNS). The deployed product is served at `https://worknear.in` (user confirmed AWS) → API `https://worknear.in/api/v1`.
3. **Maps key conflict** — the live site's bundle uses `AIzaSyCjgZ…` which Google has suspended; `Frontend/.env` now has `AIzaSyBQBG…` (works for Geocoding + Places). The app uses the working one.
4. Version `1.0.0` (from `/settings` appVersion), versionCode `1`.
5. Strings that mentioned "browser settings" / HTTPS are reworded for the app (`gps_denied`, `gps_insecure`, `pushDenied`, `pushUnsupported`); every other text is the web's.

## Blockers
- **Push notifications** — `google-services.json` for `com.worknear.user` is missing (Firebase project `worknear-4e892`). Code is complete; drop the file into `mobile-user/` and rebuild — `app.config.js` picks it up automatically.
- **Login on device / authenticated API checks** — not run against the live server (requesting an OTP may send a real SMS). If the live backend has `USE_DEFAULT_OTP=true`, OTP `123456` logs in.
- **EAS cloud build** — Expo not logged in; release APK was built locally instead (see Build).

## Device test list (walk through in this order)
1. Install APK → animated splash (pin ping → wordmark → tagline) → Welcome slides → Skip / Get started.
2. Login: invalid number error, terms checkbox, Send OTP → OTP screen, countdown, resend after 30 s, wrong OTP error, correct OTP.
3. New account → Role screen (customer / worker) + name → Home.
4. Location: first-run picker → Use current location (permission prompt) → map pin drag → Confirm; saved address add/edit/delete; radius chips.
5. Customer home: banners, categories → search filtered; Top rated; "Become a worker".
6. Search: type (debounced), category chips, filter sheet, sort sheet, infinite scroll, empty state + increase radius.
7. Worker profile: share sheet, call / WhatsApp (if phone shared), Chat now, review gate, report, block.
8. Chat: send text (optimistic), send photo with caption, image viewer, load older, mute / block / report, unread badge on tab, realtime message from another device.
9. Notifications list, mark all read, tap → link.
10. Account: change photo, edit profile, language Hindi ↔ English, appearance light ↔ dark, notification toggles, blocked users, help/FAQ, complaint with PDF/photo evidence, legal pages.
11. Subscription: plans, Pay → Razorpay (test mode) → success / failure / cancel; payment history.
12. Worker: switch to Worker mode → dashboard, visibility / availability toggles, onboarding wizard (all 4 steps + map pick), verification upload, My Profile portfolio add/delete.
13. Logout → login screen; kill app and reopen while logged in → still logged in (session persistence).
14. Session expiry: wait for / force 401 → silent refresh; revoked token → back to login.
15. No network: airplane mode → "Network error — check your internet connection." toasts / retry buttons.
16. Android back button on every screen, inside sheets, map picker and checkout.
17. Admin turns on maintenance → app switches to maintenance screen live; off → back.
18. Push (after `google-services.json`): enable in Notification settings, receive chat push with app closed, tap opens the chat.

## Checks run (section 13)
| Check | Result |
|---|---|
| `npx expo lint` | **Verified** — 0 problems |
| `npx expo-doctor` | **Verified** — 20/20 checks passed |
| `npx expo export --platform android` | **Verified** — Hermes bundle built |
| API checks (public GETs + socket handshake) | **Verified** (see section 2); authenticated calls not run (no login on live — see Blockers) |
| Emulator / device walk-through | Not run — no emulator or device attached → device items are "Built, not tested" |
| Local Android release build | **Verified** — `BUILD SUCCESSFUL`, APK inspected with aapt2 / apksigner |

## Build
- APK: `releases/WorkNear-user-1.0.0.apk` (53.8 MB, arm64-v8a + armeabi-v7a), `com.worknear.user` 1.0.0 (1).
- Built locally: `cd mobile-user && npm run build:apk` (Expo prebuild + `gradlew assembleRelease`, ~15–20 min on this PC).
- Signed with the upload keystore `C:/Users/Prince/.worknear/worknear-user-upload.jks` (passwords in `~/.gradle/gradle.properties`, `WORKNEAR_USER_*`). Back it up — every update must be signed with the same key.
  - SHA-1 `33:72:67:3F:89:3D:74:3F:3B:91:A6:D4:DE:8D:76:0F:DB:CF:A3:97`
  - SHA-256 `28:FF:DA:19:34:93:96:BA:E7:E9:99:B2:29:2F:B6:CF:BB:7D:92:5C:D5:C8:9F:38:51:EA:AE:09:84:F5:C7:02`
- EAS alternative (after `npx eas-cli login`): `npx eas-cli build --platform android --profile production --non-interactive` — note EAS would sign with its own key unless this keystore is uploaded to EAS credentials.
