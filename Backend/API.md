# WorkNear API v1

Base: `/api/v1` · JSON · success `{ data }` · error `{ error: { code, message, details } }` · lists `{ items, nextCursor, total }` (offset cursor, pass `cursor=<nextCursor>`).
Auth: `Authorization: Bearer <token>`. App tokens and admin tokens are separate (`typ` claim).
Media: public files are returned as `/uploads/...` paths — prefix with `VITE_BACKEND_ORIGIN` (frontend `mediaUrl()`).
Uploads: `multipart/form-data`, JPG/PNG/WEBP (+PDF for documents), max 5 MB, content-sniffed server-side.

Global error codes: `VALIDATION_ERROR` (400, details = field errors), `UNAUTHORIZED` (401), `SUSPENDED` (403), `FEATURE_DISABLED` (403, details.feature), `MAINTENANCE` (503, details.maintenance), `RATE_LIMITED` (429), `NOT_FOUND` (404).

## Realtime (Socket.IO, path `/socket.io`)
Connect with `auth: { token }` (optional — anonymous sockets only get broadcasts).
| Event (server → client) | Payload |
|---|---|
| `settings:update` | public settings (same shape as `GET /settings`) — maintenance / feature toggles changed |
| `message:new` | `{ message: Message, conversation?: Conversation }` (conversation = receiver's view; absent for the sender's own other devices) |
| `conversation:read` | `{ conversationId, readAt }` — the peer read my messages |
| `notification:new` | `AppNotification` |
| `account:suspended` | `{ reason? }` |

## Public / catalog
| Method | Path | Notes |
|---|---|---|
| GET | `/settings` | `{ features: Record<FeatureKey,bool>, maintenance: {enabled,title,message,eta}, subscriptionRequiredFor: ('customer'\|'worker')[], radiusOptions, defaultRadiusKm, supportEmail, supportPhone, appVersion }` — allowed during maintenance |
| GET | `/categories` | `[{ id, name, nameHi, icon, tint, skills: string[], active, workerCount }]` |
| GET | `/banners` | `[{ id, title, subtitle, tint, link? }]` (empty when `banners` feature off) |
| GET | `/faqs` | `[{ id, q, a }]` |
| GET | `/pages/:slug` | slug ∈ terms, privacy, refund, safety → `{ slug, title, body: string[], updatedAt }` |

FeatureKey: `subscriptions, chat, chatAttachments, reviews, reports, complaints, verification, workerRegistration, dualRole, portfolio, phoneSharing, pushNotifications, hindi, banners`.

## Auth (OTP)
| Method | Path | Body → data |
|---|---|---|
| POST | `/auth/request-otp` | `{ mobile }` → `{ expiresIn, resendAfter, isRegistered }` |
| POST | `/auth/verify-otp` | `{ mobile, otp, acceptTerms? }` → `{ token, refreshToken, user: User, isNew }`. New users must send `acceptTerms: true` (else `CONSENT_REQUIRED`, OTP not consumed). Errors: `OTP_EXPIRED`, `INVALID_OTP` (message says attempts left), `RATE_LIMITED` |
| POST | `/auth/refresh` | `{ refreshToken }` → `{ token, refreshToken }` |

Dev: `USE_DEFAULT_OTP=true` → every number's OTP is `123456`.

User: `{ id, mobile, name, email?, avatar?, roles: ('customer'|'worker')[], activeRole, language: 'en'|'hi', notif: {chat,subscription,offers}, workerProfileStatus: 'none'|'draft'|'pending'|'approved'|'rejected'|'info_requested', createdAt }`

## Me
| Method | Path | Notes |
|---|---|---|
| GET | `/me` | User |
| PATCH | `/me` | `{ name?, email?, language?, activeRole?, city?, notif? }` → User. Setting `activeRole:'worker'` adds the role (needs `dualRole` unless first choice) |
| POST | `/me/avatar` | multipart `photo` → User |
| POST | `/me/delete-request` | → `{ requested: true }` (login again cancels it) |
| GET/POST | `/me/addresses` | Saved locations (max 10). POST `{ label: home|work|other, name?, line?, address, lat, lng }` → list. Home/Work replace the previous one |
| PATCH/DELETE | `/me/addresses/:id` | Same body / — → list |
| GET | `/blocked` | `Peer[]` |
| POST | `/blocks` | `{ userId }` · DELETE `/blocks/:userId` |
| POST/DELETE | `/me/push-tokens` | `{ token, platform }` / `{ token }` |

## Workers
| Method | Path | Notes |
|---|---|---|
| GET | `/workers/search` | `lat, lng, radius_km(5/10/15), q?, category_id?, min_rating?, verified_only?, available_only?, sort(distance\|rating\|recent), cursor?, limit?` → Paginated<WorkerSummary>. Optional auth (hides self & blocked) |
| GET | `/workers/:id?lat&lng` | WorkerDetail + `phone?` (only if worker opted in and `phoneSharing` on). Counts a profile view |
| GET | `/workers/me/profile` | own profile or `null`: WorkerDetail + `{ lat, lng, visible, restricted, showPhone, verificationStatus, profileViews, completion }` |
| PATCH (or POST) | `/workers/profile` | create/update: `{ name, bio, experience, categoryId, skills[], languages?, radius(5/10/15), locality, hours?, priceRange?, lat, lng, showPhone? }` → `{ profile, user }`. Creating it adds the worker role + sets activeRole=worker |
| PATCH | `/workers/me/status` | `{ visible?, available?, showPhone? }` |
| POST | `/workers/profile/photo` | multipart `photo` → `{ photo }` |
| POST | `/workers/profile/portfolio` | multipart `photos` (≤6 per call, ≤12 total) → `{ portfolio }` |
| DELETE | `/workers/profile/portfolio` | `{ url }` → `{ portfolio }` |
| GET | `/workers/me/dashboard` | `{ profileViews, enquiries, rating, reviewCount, visible, available, restricted, completion, verification: 'none'\|'pending'\|'approved'\|'rejected'\|'info_requested', verificationType, verificationReason? }` |
| GET | `/verification/me` | latest `{ id, type, status, reason, submittedAt, documents }` or null |
| POST | `/verification/submissions` | multipart `type` (phone\|id\|id_address) + `documents` files (≤4; required unless phone) |

WorkerSummary: `{ id, name, photo, categoryId, categoryName, skills, rating, reviewCount, distanceKm, verification: 'phone'|'id'|'id_address'|null, available, experienceYrs, priceRange?, locality, lastActiveAt }`
WorkerDetail = WorkerSummary + `{ bio, languages, hours, serviceRadiusKm, portfolio: string[], reviews: Review[], ratingBreakdown: {1..5: percent} }`

## Chat
| Method | Path | Notes |
|---|---|---|
| GET | `/conversations` | Conversation[] (both sides — as customer and as worker) |
| POST | `/conversations` | `{ workerId }` → Conversation (existing or new). `SUBSCRIPTION_REQUIRED` (402) when admin requires it for customers |
| PATCH | `/conversations/:id` | `{ muted?, blocked? }` → Conversation |
| GET | `/conversations/:id/messages?before=<iso>&limit=50` | `{ items (oldest→newest), nextCursor (= iso of oldest, for older page), total }`. Marks peer's messages read |
| POST | `/conversations/:id/read` | 204 |
| POST | `/conversations/:id/messages` | `{ text }` → Message (rate-limited 30/min) |
| POST | `/conversations/:id/images` | multipart `image` (+ optional `text` caption) → Message |

Conversation: `{ id, peer: {id,name,photo,role,subtitle}, myRole: 'customer'|'worker', lastMessage, lastMessageAt, unread, muted, blocked (I blocked), blockedBy (they blocked me), canReview, reviewed }`
Message: `{ id, conversationId, senderId, type: 'text'|'image', text, image?, sentAt, status: 'sent'|'read' }` — compare `senderId` with the signed-in user's id.

## Notifications
GET `/notifications` → `[{ id, type, title, body, link?, createdAt, read }]` · PATCH `/notifications/:id/read` · POST `/notifications/read-all` (204)

## Subscription (whole router off when `subscriptions` feature is off)
| Method | Path | Notes |
|---|---|---|
| GET | `/subscription/plans` | `[{ id, name, price, period: 'month'\|'year', features, badge?, active }]` |
| GET | `/subscription/me` | `{ planId, planName?, status: 'none'\|'active'\|'expired'\|'pending', startAt?, endAt?, renewal: 'manual', source? }` |
| GET | `/subscription/payments` | receipts `[{ id, planName, amount, status, createdAt, paidAt? }]` |
| POST | `/subscription/checkout` | `{ planId }` → `{ gateway: 'razorpay'\|'test', orderId, amount, currency, planName, keyId?, prefill }` |
| POST | `/subscription/verify` | razorpay: `{ orderId, paymentId, signature }`; test gateway (dev, no keys): `{ orderId, status?: 'success'\|'failed' }` → `{ payment: {status, orderId}, subscription }` |
| POST | `/payments/webhook` | Razorpay signed webhook (server-to-server) |

Razorpay flow on web: load `https://checkout.razorpay.com/v1/checkout.js`, open with `{ key: keyId, order_id: orderId, amount: amount*100, currency, name: 'WorkNear', prefill, handler: r => verify({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }) }`.

## Trust & safety
| Method | Path | Notes |
|---|---|---|
| GET | `/reviews/eligibility?workerId=` | `{ eligible, reason? }` — eligible after a chat where the worker replied, once per conversation |
| POST | `/reviews` | `{ workerId, stars 1-5, text? }` · errors `REVIEW_NOT_ALLOWED`, `DUPLICATE_REVIEW` |
| POST | `/reports` | `{ targetType: 'profile'\|'message'\|'review', targetId, reason, details? }` → `{ id }` (message → targetId = conversationId) |
| GET | `/complaints/me` | `[{ id (e.g. C1001), category, targetType, description, status: open\|in_progress\|resolved\|escalated, createdAt, resolution? }]` |
| POST | `/complaints` | JSON `{ category, description(≥10), targetType?, targetId? }` or multipart with `evidence` files (≤3) |

## Admin (`/admin`, admin token) — roles: super_admin > admin > support, plus sub_admin
Available during maintenance. Every mutation writes an audit log (actor, time, reason).
**sub_admin**: access is per module (dashboard, users, verifications, categories, billing, complaints, reviews, cms, broadcast, settings) and per action — GET = view, POST = create, PATCH/PUT = edit, DELETE = delete (`src/lib/permissions.ts`). Super-only routes (staff, audit logs, maintenance, refunds, plan create, grants) are never available to sub-admins. Login / `/admin/auth/me` return `permissions`.
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/admin/auth/login` | – | `{ email, password, otp? }` → `{ token, id, name, email, role, mfaEnabled }`. `MFA_REQUIRED`/`MFA_INVALID` when MFA set |
| GET | `/admin/auth/me` | any | + loginHistory |
| POST | `/admin/auth/me/mfa/setup` → `{ secret, otpauthUrl }`; `/me/mfa/enable` `{ code }`; `/me/password` `{ current, next }` | any | |
| GET | `/admin/kpis` | admin+ | `{ totalUsers, newUsersToday, activeWorkers, verifiedWorkers, searchesToday, chatsToday, newChatsToday, activeSubscriptions, revenueMonth, openComplaints, pendingVerifications, deletionRequests, signupsLast7:[{day,date,customers,workers}], revenueLast6:[{month,revenue,payments}], workersByCategory:[{id,name,count}], complaintsByStatus, alerts:[{id,level,text}] }` |
| GET | `/admin/badges` | any | `{ verifications, complaints, users }` (sidebar counts) |
| GET | `/admin/users?q&status&role&cursor&limit&from&to` | admin+ | Paginated `{ id, name, mobile, avatar, roles, activeRole, status, city, joinedAt, lastActiveAt, reports }` |
| GET | `/admin/users/:id` | admin+ | full detail (worker, subscription, complaintsAgainst, payments) |
| PATCH | `/admin/users/:id` | admin+ | `{ status: active\|suspended\|deleted, reason }` (deleted = process deletion request, anonymises) |
| PATCH | `/admin/workers/:userId` | admin+ | `{ restricted, reason }` |
| GET | `/admin/verifications?status` | admin+ | Paginated `{ id, workerId, workerName, photo, category, locality, type, documents: string[], status, submittedAt, reason, reviewedAt, reviewer }` |
| GET | `/admin/verifications/:id/documents/:idx` | admin+ | file stream (fetch as blob) — audit-logged |
| PATCH | `/admin/verifications/:id` | admin+ | `{ status: approved\|rejected\|info_requested, reason? (required unless approved) }` |
| GET/POST | `/admin/categories`, PATCH `/admin/categories/:id` | admin+ | `{ name, nameHi, icon, tint, skills[], active }` |
| GET | `/admin/plans`; POST (super) ; PATCH `/admin/plans/:id` | admin+ | Plan fields |
| GET | `/admin/subscriptions?status` | admin+ | Paginated |
| POST | `/admin/subscriptions/grant` | super | `{ userId, planId, reason }` |
| GET | `/admin/transactions?status&q&from&to` | admin+ | Paginated `{ id, orderId, userName, planName, amount, status, gateway, gatewayRef, refundId, createdAt }` |
| POST | `/admin/transactions/:id/refund` | super | `{ reason }` |
| GET | `/admin/complaints?status&q` | any (support: assigned only) | Paginated `{ id(code), dbId, category, targetType, description, status, createdAt, resolution, reporterName, targetName, targetUserId, assignedTo, assignedToId, evidence(count), history[] }` |
| PATCH | `/admin/complaints/:code` | any | `{ status?, assignedTo? (admin id\|null), resolution?, note?, action?: warn\|restrict\|suspend }` |
| GET | `/admin/complaints/:code/evidence/:idx` | any | blob |
| GET | `/admin/reviews?status=visible\|hidden\|reported` | admin+ | Paginated `{ id, reviewerName, stars, text, createdAt, workerId, workerName, reports, status, hiddenReason }` |
| PATCH | `/admin/reviews/:id` | admin+ | `{ status: visible\|hidden, reason? }` |
| GET/POST/PATCH/DELETE | `/admin/banners[/:id]` | admin+ | `{ title, subtitle, tint, link?, active, sort }` |
| POST | `/admin/uploads/banner` | admin+ | multipart `image` → `{ url }` |
| GET/POST/PATCH/DELETE | `/admin/faqs[/:id]` | admin+ | `{ q, a, active, sort }` |
| GET | `/admin/pages`; PUT `/admin/pages/:slug` | admin+ | `{ title, body: string[] }` |
| GET | `/admin/settings` | admin+ | public settings + `featureKeys`, `updatedAt` |
| PATCH | `/admin/settings` | admin+ (maintenance: super only) | `{ features?: Partial<Record<FeatureKey,bool>>, maintenance?: {enabled?,title?,message?,eta?}, subscriptionRequiredFor?, radiusOptions?, defaultRadiusKm?, supportEmail?, supportPhone?, appVersion? }` → broadcasts `settings:update` |
| GET | `/admin/audit-logs?q&from&to` | super | Paginated `{ id, actor, action, target, reason, ip, at }` |
| GET | `/admin/staff` | any; POST (super) `{ name, email, password, role, permissions? }`; PATCH `/admin/staff/:id` (super) `{ role?, status?, resetMfa?, permissions? }` | | `{ id, name, email, role, status, mfa, lastLoginAt, permissions }` — sub_admin needs ≥1 permission |
| GET | `/admin/broadcasts` | broadcast | History (paged). POST `{ title, body, link?, kind: announcement|offer, audience: all|customers|workers|custom, targetIds? }` → 202, delivered in background (inbox + push, 500/batch). DELETE `/:id` recalls it from inboxes. GET `/counts`, GET `/recipients?q&role` for the picker |
| GET | `/admin/export/:type?from&to` | admin+ | type ∈ users, transactions, complaints → CSV (fetch as blob) |
