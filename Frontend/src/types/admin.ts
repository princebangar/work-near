// Admin-panel domain types — mirror Backend/src/modules/admin/*.ts (see Backend/API.md → Admin).
import type { AdminModule, AdminPermissions, AdminRole, AppSettings, ComplaintStatus, FeatureKey, Maintenance, PermAction, Role, VerificationType } from '@/types';

export type { AdminModule, AdminPermissions, AdminRole, AppSettings, ComplaintStatus, FeatureKey, Maintenance, PermAction, Role, VerificationType };

export interface Page<T> { items: T[]; nextCursor: string | null; total: number }
export type ListParams = Record<string, string | number | undefined>;

// ---------- Auth ----------
export interface AdminSession { token: string; id: string; name: string; email: string; role: AdminRole; mfaEnabled: boolean; permissions: AdminPermissions }
export interface LoginEntry { at: string; ip?: string; ok: boolean }
export interface AdminMe {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  permissions: AdminPermissions;
  mfaEnabled: boolean;
  lastLoginAt?: string;
  loginHistory: LoginEntry[];
}
export interface MfaSetup { secret: string; otpauthUrl: string }

// ---------- Dashboard ----------
export type AlertLevel = 'info' | 'warning' | 'danger';
export interface AdminAlert { id: string; level: AlertLevel; text: string }
export interface AdminKpis {
  totalUsers: number;
  newUsersToday: number;
  activeWorkers: number;
  verifiedWorkers: number;
  searchesToday: number;
  /** Messages sent today. */
  chatsToday: number;
  newChatsToday: number;
  activeSubscriptions: number;
  revenueMonth: number;
  openComplaints: number;
  pendingVerifications: number;
  deletionRequests: number;
  /** `customers` = all new accounts that day, `workers` = new worker profiles that day. */
  signupsLast7: { day: string; date: string; customers: number; workers: number }[];
  revenueLast6: { month: string; revenue: number; payments: number }[];
  workersByCategory: { id: string; name: string; count: number }[];
  complaintsByStatus: Partial<Record<ComplaintStatus, number>>;
  alerts: AdminAlert[];
}
export interface AdminBadges { verifications: number; complaints: number; users: number }

// ---------- Users ----------
export type AdminUserStatus = 'active' | 'suspended' | 'deleted_request' | 'deleted';
export interface AdminUserRow {
  id: string;
  name: string;
  mobile: string;
  avatar?: string;
  roles: Role[];
  activeRole: Role;
  status: AdminUserStatus;
  city?: string;
  joinedAt: string;
  lastActiveAt?: string;
  reports: number;
}
export type WorkerVerificationStatus = 'none' | 'pending' | 'approved' | 'rejected' | 'info_requested';
export interface AdminUserDetail {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  avatar?: string;
  roles: Role[];
  status: AdminUserStatus;
  statusReason?: string;
  city?: string;
  language?: 'en' | 'hi';
  joinedAt?: string;
  lastLoginAt?: string;
  lastActiveAt?: string;
  consentVersion?: string;
  deletionRequestedAt?: string;
  conversations: number;
  complaintsFiled: number;
  worker: null | {
    displayName: string;
    category: string;
    locality?: string;
    rating: number;
    reviewCount: number;
    visible: boolean;
    restricted: boolean;
    verification: VerificationType | null;
    verificationStatus: WorkerVerificationStatus;
    profileViews: number;
  };
  subscription: null | { plan: string; status: SubscriptionStatus; endAt?: string; source?: SubscriptionSource };
  complaintsAgainst: { id: string; category: string; status: ComplaintStatus; createdAt?: string }[];
  payments: { id: string; planName?: string; amount: number; status: TxnStatus; createdAt?: string }[];
}

// ---------- Verification ----------
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'info_requested';
export interface AdminVerification {
  id: string;
  workerId: string;
  workerName: string;
  photo: string;
  category: string;
  locality?: string;
  type: VerificationType;
  documents: string[];
  status: VerificationStatus;
  submittedAt: string;
  reason?: string;
  reviewedAt?: string;
  reviewer?: string;
}

// ---------- Catalog ----------
export interface AdminCategory {
  id: string;
  name: string;
  nameHi: string;
  icon: string;
  tint: string;
  skills: string[];
  active: boolean;
  workerCount: number;
}
export type CategoryInput = Omit<AdminCategory, 'id' | 'workerCount'>;

// ---------- Billing ----------
export interface AdminPlan { id: string; name: string; price: number; period: 'month' | 'year'; features: string[]; badge?: string; active: boolean }
export type PlanInput = Omit<AdminPlan, 'id'>;
export type SubscriptionStatus = 'none' | 'active' | 'expired' | 'pending';
export type SubscriptionSource = 'payment' | 'admin_grant';
export interface AdminSubscriptionRow {
  id: string;
  userName: string;
  mobile?: string;
  plan: string;
  status: SubscriptionStatus;
  startAt?: string;
  endAt?: string;
  source?: SubscriptionSource;
}
export type TxnStatus = 'pending' | 'success' | 'failed' | 'refunded';
export interface AdminTransaction {
  id: string;
  orderId: string;
  userName: string;
  planName: string;
  amount: number;
  status: TxnStatus;
  gateway: 'razorpay' | 'test' | 'admin';
  gatewayRef: string;
  refundId?: string;
  createdAt: string;
}

// ---------- Trust & safety ----------
export type ComplaintTargetType = 'profile' | 'message' | 'review' | 'fraud' | 'other';
export interface ComplaintHistoryEntry { at: string; by: string; action: string; note?: string }
export interface AdminComplaint {
  /** Human code, e.g. C1001 — used in URLs. */
  id: string;
  dbId: string;
  category: string;
  targetType: ComplaintTargetType;
  targetId?: string;
  description: string;
  status: ComplaintStatus;
  createdAt: string;
  updatedAt?: string;
  resolution?: string;
  reporterId?: string;
  reporterName: string;
  targetUserId?: string;
  targetName: string;
  assignedTo?: string;
  assignedToId?: string;
  /** Number of evidence files. */
  evidence: number;
  history: ComplaintHistoryEntry[];
}
export type ComplaintAction = 'warn' | 'restrict' | 'suspend';
export interface ComplaintPatch {
  status?: ComplaintStatus;
  assignedTo?: string | null;
  resolution?: string;
  note?: string;
  action?: ComplaintAction;
}

export type ReviewStatus = 'visible' | 'hidden';
export interface AdminReview {
  id: string;
  reviewerName: string;
  reviewerPhoto?: string;
  stars: number;
  text: string;
  createdAt: string;
  workerId: string;
  workerName: string;
  reports: number;
  status: ReviewStatus;
  hiddenReason?: string;
}

// ---------- Content ----------
export interface AdminBanner { id: string; title: string; subtitle: string; tint: string; link?: string; active: boolean; sort: number }
export type BannerInput = Omit<AdminBanner, 'id'>;
export interface AdminFaq { id: string; q: string; a: string; active: boolean; sort: number }
export type FaqInput = Omit<AdminFaq, 'id'>;
export type LegalSlug = 'terms' | 'privacy' | 'refund' | 'safety';
export interface AdminLegalPage { slug: LegalSlug; title: string; body: string[]; updatedAt?: string }

// ---------- Settings ----------
export interface AdminSettings extends AppSettings { featureKeys: FeatureKey[]; updatedAt?: string }
export interface SettingsPatch {
  features?: Partial<Record<FeatureKey, boolean>>;
  maintenance?: Partial<Maintenance>;
  subscriptionRequiredFor?: Role[];
  radiusOptions?: number[];
  defaultRadiusKm?: number;
  supportEmail?: string;
  supportPhone?: string;
  appVersion?: string;
}

// ---------- System ----------
export interface AuditEntry { id: string; actor: string; action: string; target: string; reason?: string; ip?: string; at: string }
export type StaffStatus = 'active' | 'disabled';
export interface AdminStaff { id: string; name: string; email: string; role: AdminRole; status: StaffStatus; mfa: boolean; lastLoginAt?: string; permissions: AdminPermissions }
export interface StaffInput { name: string; email: string; password: string; role: AdminRole; permissions?: AdminPermissions }
export interface StaffPatch { role?: AdminRole; status?: StaffStatus; resetMfa?: boolean; permissions?: AdminPermissions }

// ---------- Broadcast notifications ----------
export type BroadcastAudience = 'all' | 'customers' | 'workers' | 'custom';
export type BroadcastKind = 'announcement' | 'offer';
export interface BroadcastInput { title: string; body: string; link: string; kind: BroadcastKind; audience: BroadcastAudience; targetIds: string[] }
export interface BroadcastRow {
  id: string; title: string; body: string; link?: string; kind: BroadcastKind; audience: BroadcastAudience;
  status: 'sending' | 'sent' | 'failed'; recipients: number; pushSent: number; createdBy: string; createdAt: string; error?: string;
}
export interface BroadcastCounts { all: number; customers: number; workers: number }
export interface BroadcastRecipient { id: string; name: string; workerName?: string; mobile: string; roles: Role[]; avatar?: string }

export type ExportType = 'users' | 'transactions' | 'complaints';
export interface DateRange { from?: string; to?: string }
