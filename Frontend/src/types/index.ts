// Domain types — mirror Backend/API.md (source of truth). Platform-agnostic (reusable in React Native).
export type Lang = 'en' | 'hi';
export type Role = 'customer' | 'worker';
export type AdminRole = 'super_admin' | 'admin' | 'support';
export type ID = string;

export interface Paginated<T> { items: T[]; nextCursor: string | null; total: number }

export interface NotifPrefs { chat: boolean; subscription: boolean; offers: boolean }
export type WorkerProfileStatus = 'none' | 'draft' | 'pending' | 'approved' | 'rejected' | 'info_requested';

export interface User {
  id: ID;
  mobile: string;
  name: string;
  email?: string;
  avatar?: string;
  roles: Role[];
  activeRole: Role;
  language: Lang;
  notif?: NotifPrefs;
  workerProfileStatus?: WorkerProfileStatus;
  createdAt: string;
}

export interface Session { token: string; refreshToken?: string; user: User; isNew: boolean }
export interface OtpRequest { expiresIn: number; resendAfter: number; isRegistered: boolean }
/** Fields accepted by PATCH /me. */
export interface MePatch { name?: string; email?: string; language?: Lang; activeRole?: Role; city?: string; notif?: Partial<NotifPrefs> }

export interface Category { id: ID; name: string; nameHi: string; icon: string; tint: string; skills: string[]; active: boolean; workerCount: number }

export type VerificationType = 'phone' | 'id' | 'id_address';
export type SortBy = 'distance' | 'rating' | 'recent';

export interface WorkerSummary {
  id: ID;
  name: string;
  photo: string;
  categoryId: ID;
  categoryName: string;
  skills: string[];
  rating: number;
  reviewCount: number;
  distanceKm: number;
  verification: VerificationType | null;
  available: boolean;
  experienceYrs: number;
  priceRange?: string;
  locality: string;
  lastActiveAt: string;
}

export interface Review { id: ID; reviewerName: string; reviewerPhoto?: string; stars: number; text: string; createdAt: string }

export interface WorkerDetail extends WorkerSummary {
  bio: string;
  languages: string[];
  hours: string;
  serviceRadiusKm: number;
  portfolio: string[];
  reviews: Review[];
  ratingBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  /** Only when the worker opted in and `phoneSharing` is on. */
  phone?: string;
}

/** The signed-in worker's own profile (GET /workers/me/profile). */
export interface MyWorkerProfile extends WorkerDetail {
  lat: number;
  lng: number;
  visible: boolean;
  restricted: boolean;
  showPhone: boolean;
  verificationStatus: VerificationStatus | 'none';
  profileViews: number;
  completion: number;
}

/** Body for PATCH /workers/profile. */
export interface WorkerProfileInput {
  name: string;
  bio: string;
  experience: number;
  categoryId: ID;
  skills: string[];
  languages?: string[];
  radius: number;
  locality: string;
  hours?: string;
  priceRange?: string;
  lat: number;
  lng: number;
  showPhone?: boolean;
}

export interface WorkerSearchParams {
  lat: number;
  lng: number;
  radiusKm: number;
  q?: string;
  categoryId?: ID;
  minRating?: number;
  verifiedOnly?: boolean;
  availableOnly?: boolean;
  sort?: SortBy;
  cursor?: string;
}

export interface WorkerStatus { visible: boolean; available: boolean; showPhone: boolean }

export interface WorkerDashboard {
  profileViews: number;
  enquiries: number;
  rating: number;
  reviewCount: number;
  visible: boolean;
  available: boolean;
  restricted: boolean;
  completion: number;
  verification: VerificationStatus | 'none';
  verificationType: VerificationType | null;
  verificationReason?: string;
}

export interface MyVerification { id: ID; type: VerificationType; status: VerificationStatus; reason?: string; submittedAt: string; documents: number }

export interface Peer { id: ID; name: string; photo: string; role: Role; subtitle: string }
export interface Conversation {
  id: ID;
  peer: Peer;
  myRole: Role;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
  muted: boolean;
  /** I blocked them. */
  blocked: boolean;
  /** They blocked me. */
  blockedBy: boolean;
  canReview: boolean;
  reviewed: boolean;
}
/** `sending`/`failed` are local-only states for optimistic messages. */
export type MessageStatus = 'sent' | 'read' | 'sending' | 'failed';
export interface Message { id: ID; conversationId: ID; senderId: ID; type: 'text' | 'image'; text: string; image?: string; sentAt: string; status: MessageStatus }
/** Cached thread: newest page plus any older pages loaded, oldest → newest. */
export interface Thread { items: Message[]; nextCursor: string | null }

export type NotificationType = 'chat' | 'subscription' | 'verification' | 'complaint' | 'system';
export interface AppNotification { id: ID; type: NotificationType; title: string; body: string; link?: string; createdAt: string; read: boolean }

export interface Plan { id: ID; name: string; price: number; period: 'month' | 'year'; features: string[]; badge?: string; active: boolean }
export type SubscriptionStatus = 'none' | 'active' | 'expired' | 'pending';
export interface Subscription { planId: ID | null; planName?: string; status: SubscriptionStatus; startAt?: string; endAt?: string; renewal: 'manual'; source?: string }
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';
export interface PaymentReceipt { id: string; planName: string; amount: number; status: PaymentStatus; createdAt: string; paidAt?: string }
export interface CheckoutOrder {
  gateway: 'razorpay' | 'test';
  orderId: string;
  amount: number;
  currency: string;
  planName: string;
  keyId?: string;
  prefill: { name?: string; contact?: string; email?: string };
}
export type VerifyPaymentBody = { orderId: string; paymentId: string; signature: string } | { orderId: string; status: 'success' | 'failed' };
export interface VerifyPaymentResult { payment: { status: PaymentStatus; orderId: string }; subscription: Subscription }

export type ComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'escalated';
export interface Complaint {
  id: ID;
  category: string;
  targetType: 'profile' | 'message' | 'review' | 'fraud' | 'other';
  targetId?: ID;
  description: string;
  status: ComplaintStatus;
  createdAt: string;
  resolution?: string;
}
export type ReportTarget = 'profile' | 'message' | 'review';

export interface Faq { id: ID; q: string; a: string }
export interface Banner { id: ID; title: string; subtitle: string; tint: string; link?: string }
export type LegalSlug = 'terms' | 'privacy' | 'refund' | 'safety';
export interface LegalPage { slug: string; title: string; body: string[]; updatedAt: string }

// ---------- Admin ----------
export interface AdminKpis {
  totalUsers: number;
  activeWorkers: number;
  verifiedWorkers: number;
  searchesToday: number;
  chatsToday: number;
  activeSubscriptions: number;
  revenueMonth: number;
  openComplaints: number;
  pendingVerifications: number;
  signupsLast7: { day: string; customers: number; workers: number }[];
  alerts: { id: ID; level: 'info' | 'warning' | 'danger'; text: string }[];
}
export type UserStatus = 'active' | 'suspended' | 'deleted_request';
export interface AdminUser { id: ID; name: string; mobile: string; roles: Role[]; status: UserStatus; city: string; joinedAt: string; reports: number }
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'info_requested';
export interface VerificationRequest {
  id: ID;
  workerId: ID;
  workerName: string;
  photo: string;
  category: string;
  type: VerificationType;
  documents: string[];
  status: VerificationStatus;
  submittedAt: string;
  reason?: string;
}
export interface AdminComplaint extends Complaint { reporterName: string; targetName: string; assignedTo?: string }
export interface AdminReview extends Review { workerName: string; reports: number; status: 'visible' | 'hidden' }
export interface Transaction { id: ID; userName: string; planName: string; amount: number; status: 'success' | 'failed' | 'pending' | 'refunded'; gatewayRef: string; createdAt: string }
export interface AuditLog { id: ID; actor: string; action: string; target: string; reason?: string; at: string }
export interface StaffMember { id: ID; name: string; email: string; role: AdminRole; mfa: boolean; lastLoginAt: string }

// ---------- App settings (Admin → Customization Settings) ----------
export type FeatureKey =
  | 'subscriptions' | 'chat' | 'chatAttachments' | 'reviews' | 'reports' | 'complaints' | 'verification'
  | 'workerRegistration' | 'dualRole' | 'portfolio' | 'phoneSharing' | 'pushNotifications' | 'hindi' | 'banners';
export interface Maintenance { enabled: boolean; title: string; message: string; eta: string }
export interface AppSettings {
  features: Record<FeatureKey, boolean>;
  maintenance: Maintenance;
  subscriptionRequiredFor: Role[];
  radiusOptions: number[];
  defaultRadiusKm: number;
  supportEmail: string;
  supportPhone: string;
  appVersion: string;
}
