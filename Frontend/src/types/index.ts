// Domain types — keep in sync with Backend/src/types. Platform-agnostic (reusable in React Native).
export type Lang = 'en' | 'hi';
export type Role = 'customer' | 'worker';
export type AdminRole = 'super_admin' | 'admin' | 'support';
export type ID = string;

export interface Paginated<T> { items: T[]; nextCursor: string | null; total: number }

export interface User {
  id: ID;
  mobile: string;
  name: string;
  email?: string;
  avatar?: string;
  roles: Role[];
  activeRole: Role;
  language: Lang;
  workerProfileStatus?: 'none' | 'draft' | 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface Session { token: string; user: User; isNew: boolean }

export interface Category { id: ID; name: string; nameHi: string; icon: string; tint: string; workerCount: number }

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

export interface Peer { id: ID; name: string; photo: string; role: Role; subtitle: string }
export interface Conversation {
  id: ID;
  peer: Peer;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
  muted: boolean;
  blocked: boolean;
}
export type MessageStatus = 'sent' | 'delivered' | 'read';
export interface Message { id: ID; conversationId: ID; senderId: ID; text: string; sentAt: string; status: MessageStatus }

export type NotificationType = 'chat' | 'subscription' | 'verification' | 'complaint' | 'system';
export interface AppNotification { id: ID; type: NotificationType; title: string; body: string; link?: string; createdAt: string; read: boolean }

export interface Plan { id: ID; name: string; price: number; period: 'month' | 'year'; features: string[]; badge?: string; active: boolean }
export interface Subscription { planId: ID | null; status: 'none' | 'active' | 'expired' | 'pending'; startAt?: string; endAt?: string; renewal: 'manual' }

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

export interface Faq { id: ID; q: string; a: string }
export interface Banner { id: ID; title: string; subtitle: string; tint: string }

export interface WorkerDashboard {
  profileViews: number;
  enquiries: number;
  rating: number;
  reviewCount: number;
  visible: boolean;
  completion: number;
  verification: 'none' | 'pending' | 'approved' | 'rejected';
}

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
