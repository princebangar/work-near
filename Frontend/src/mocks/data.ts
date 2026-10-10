import type {
  AdminComplaint, AdminReview, AdminUser, AuditLog, Banner, Category, Conversation, Faq, Message,
  AppNotification, Plan, Review, StaffMember, Transaction, VerificationRequest, VerificationType,
} from '@/types';

// Deterministic PRNG so the demo looks the same on every reload.
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

export const categories: Category[] = [
  ['electrician', 'Electrician', 'इलेक्ट्रीशियन', 'zap', '#fef3c7'],
  ['plumber', 'Plumber', 'प्लंबर', 'droplets', '#dbeafe'],
  ['carpenter', 'Carpenter', 'बढ़ई', 'hammer', '#fde68a'],
  ['painter', 'Painter', 'पेंटर', 'paint-roller', '#fce7f3'],
  ['ac-repair', 'AC Repair', 'AC रिपेयर', 'snowflake', '#cffafe'],
  ['cleaning', 'Cleaning', 'सफ़ाई', 'sparkles', '#dcfce7'],
  ['mechanic', 'Mechanic', 'मैकेनिक', 'wrench', '#e0e7ff'],
  ['beautician', 'Beautician', 'ब्यूटीशियन', 'scissors', '#ffe4e6'],
  ['tutor', 'Tutor', 'ट्यूटर', 'book-open', '#ede9fe'],
  ['driver', 'Driver', 'ड्राइवर', 'car', '#e2e8f0'],
  ['cook', 'Cook', 'कुक', 'chef-hat', '#ffedd5'],
  ['mason', 'Mason', 'मिस्त्री', 'brick-wall', '#f5f5f4'],
].map(([id, name, nameHi, icon, tint]) => ({ id, name, nameHi, icon, tint, workerCount: 20 + Math.floor(rnd() * 180) }));

const skillsBy: Record<string, string[]> = {
  electrician: ['Wiring', 'Fan install', 'Switchboard', 'Inverter', 'MCB'],
  plumber: ['Leak repair', 'Tap fitting', 'Bathroom', 'Water tank', 'Drainage'],
  carpenter: ['Furniture', 'Door repair', 'Modular kitchen', 'Bed', 'Polish'],
  painter: ['Interior', 'Exterior', 'Texture', 'Waterproofing'],
  'ac-repair': ['AC service', 'Gas refill', 'Installation', 'Fridge repair'],
  cleaning: ['Deep cleaning', 'Sofa cleaning', 'Kitchen', 'Bathroom'],
  mechanic: ['Bike repair', 'Car service', 'Puncture', 'Battery'],
  beautician: ['Bridal makeup', 'Facial', 'Hair cut', 'Mehendi'],
  tutor: ['Maths', 'Science', 'English', 'Class 10', 'Class 12'],
  driver: ['Car driving', 'Outstation', 'Monthly driver'],
  cook: ['North Indian', 'South Indian', 'Party cooking', 'Tiffin'],
  mason: ['Tiles', 'Plaster', 'Brick work', 'Flooring'],
};
const male = ['Ramesh Kumar', 'Suresh Yadav', 'Amit Sharma', 'Rajesh Verma', 'Vikas Singh', 'Mohd. Irfan', 'Deepak Gupta', 'Sanjay Patel', 'Manoj Tiwari', 'Arjun Mehra', 'Ravi Chauhan', 'Imran Khan', 'Anil Joshi', 'Pankaj Mishra', 'Rohit Saini', 'Gurpreet Singh'];
const female = ['Sunita Devi', 'Priya Sharma', 'Neha Gupta', 'Kavita Rawat', 'Pooja Arora', 'Anjali Verma', 'Meena Kumari', 'Ritu Bansal'];
const localities = ['Karol Bagh', 'Paharganj', 'Rajendra Nagar', 'Patel Nagar', 'Gole Market', 'Daryaganj', 'Jhandewalan', 'Mandi House', 'Janpath', 'Barakhamba'];
const reviewTexts = [
  'Very professional and on time. Highly recommended!', 'Good work at a fair price.', 'Polite and explained everything clearly.',
  'Work was okay, came a bit late.', 'Excellent! Will call again.', 'Fixed the issue in 20 minutes. Great job.',
];

export interface MockWorker {
  id: string; name: string; photo: string; categoryId: string; skills: string[]; rating: number; reviewCount: number;
  dLat: number; dLng: number; verification: VerificationType | null; available: boolean; experienceYrs: number;
  priceRange: string; locality: string; lastActiveAt: string; languages: string[];
}

export const workers: MockWorker[] = Array.from({ length: 36 }, (_, i) => {
  const cat = categories[i % categories.length];
  const isF = cat.id === 'beautician' || cat.id === 'cook' || (cat.id === 'tutor' && i % 2 === 0) || cat.id === 'cleaning';
  const name = isF ? female[i % female.length] : male[i % male.length];
  const sk = skillsBy[cat.id];
  // Offsets spread workers from ~0.3 km to ~14 km around the search centre.
  const r = (0.3 + rnd() * 13.7) / 111, a = rnd() * Math.PI * 2;
  const lo = 200 + Math.floor(rnd() * 5) * 100;
  return {
    id: `w${i + 1}`,
    name,
    photo: `https://randomuser.me/api/portraits/${isF ? 'women' : 'men'}/${(i * 7) % 90}.jpg`,
    categoryId: cat.id,
    skills: sk.slice(0, 2 + Math.floor(rnd() * (sk.length - 1))),
    rating: Math.round((3.6 + rnd() * 1.4) * 10) / 10,
    reviewCount: 3 + Math.floor(rnd() * 180),
    dLat: r * Math.sin(a),
    dLng: r * Math.cos(a),
    verification: pick<VerificationType | null>(['id_address', 'id', 'phone', null, 'id']),
    available: rnd() > 0.3,
    experienceYrs: 1 + Math.floor(rnd() * 18),
    priceRange: `₹${lo} – ₹${lo * 3}`,
    locality: pick(localities),
    lastActiveAt: ago(Math.floor(rnd() * 3000)),
    languages: rnd() > 0.5 ? ['Hindi', 'English'] : ['Hindi'],
  };
});

export const makeReviews = (n: number): Review[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    reviewerName: pick([...male, ...female]),
    reviewerPhoto: `https://randomuser.me/api/portraits/${i % 2 ? 'men' : 'women'}/${(i * 11) % 90}.jpg`,
    stars: pick([5, 5, 4, 5, 4, 3]),
    text: pick(reviewTexts),
    createdAt: ago(600 + i * 2900),
  }));

export const banners: Banner[] = [
  { id: 'b1', title: 'Zero Commission, Always', subtitle: 'Pay workers directly. No hidden cuts.', tint: 'from-indigo-600 to-violet-500' },
  { id: 'b2', title: 'Verified Professionals', subtitle: 'Look for the verified badge.', tint: 'from-emerald-600 to-teal-500' },
  { id: 'b3', title: 'Join as a Worker', subtitle: 'Get local enquiries in 5 KM.', tint: 'from-amber-500 to-orange-500' },
];

export const plans: Plan[] = [
  { id: 'monthly', name: 'Monthly', price: 30, period: 'month', active: true, features: ['Unlimited chats', 'Priority listing in search', 'Verified badge eligibility', 'Chat with any worker nearby'] },
  { id: 'yearly', name: 'Yearly', price: 300, period: 'year', badge: 'Save ₹60', active: true, features: ['Everything in Monthly', '2 months free', 'Priority support', 'Profile insights'] },
];

export const conversations: Conversation[] = workers.slice(0, 5).map((w, i) => ({
  id: `c${i + 1}`,
  peer: { id: w.id, name: w.name, photo: w.photo, role: 'worker', subtitle: categories.find((c) => c.id === w.categoryId)!.name },
  lastMessage: ['Ji, main 5 baje aa jaunga.', 'Rate ₹400 hoga, material alag.', 'Photo bhej dijiye problem ki.', 'Thank you sir!', 'Kal subah free hoon.'][i],
  lastMessageAt: ago(5 + i * 170),
  unread: i < 2 ? 2 - i : 0,
  muted: false,
  blocked: false,
}));

export const messages: Record<string, Message[]> = Object.fromEntries(
  conversations.map((c) => [
    c.id,
    [
      { id: `${c.id}m1`, conversationId: c.id, senderId: 'me', text: 'Namaste, kya aap aaj available hain?', sentAt: ago(60), status: 'read' as const },
      { id: `${c.id}m2`, conversationId: c.id, senderId: c.peer.id, text: 'Ji haan, batayiye kya kaam hai?', sentAt: ago(55), status: 'read' as const },
      { id: `${c.id}m3`, conversationId: c.id, senderId: 'me', text: 'Ghar pe kaam hai, location Karol Bagh.', sentAt: ago(50), status: 'read' as const },
      { id: `${c.id}m4`, conversationId: c.id, senderId: c.peer.id, text: c.lastMessage, sentAt: c.lastMessageAt, status: 'delivered' as const },
    ],
  ]),
);

export const notifications: AppNotification[] = [
  { id: 'n1', type: 'chat', title: 'New message from Ramesh Kumar', body: 'Ji, main 5 baje aa jaunga.', link: '/chats/c1', createdAt: ago(5), read: false },
  { id: 'n2', type: 'subscription', title: 'Subscription expiring soon', body: 'Your monthly plan expires in 3 days. Renew to keep chatting.', link: '/subscription', createdAt: ago(300), read: false },
  { id: 'n3', type: 'verification', title: 'Verification approved', body: 'Your ID verification is approved. Badge is now live.', createdAt: ago(1500), read: true },
  { id: 'n4', type: 'complaint', title: 'Complaint #C102 resolved', body: 'Our team has resolved your complaint.', link: '/help', createdAt: ago(4000), read: true },
  { id: 'n5', type: 'system', title: 'Welcome to WorkNear 🎉', body: 'Find trusted workers within 5 KM. Zero commission.', createdAt: ago(9000), read: true },
];

export const faqs: Faq[] = [
  { id: 'f1', q: 'Does WorkNear take commission?', a: 'No. WorkNear has a Zero Commission policy. You pay the worker directly; the platform never deducts anything from job value.' },
  { id: 'f2', q: 'How is distance calculated?', a: 'We use straight-line distance from your selected location. You can choose 5, 10 or 15 KM.' },
  { id: 'f3', q: 'What does the verified badge mean?', a: 'The badge shows which verification was completed (phone, ID or ID + address) after admin review. It is not a guarantee of service quality.' },
  { id: 'f4', q: 'How do subscriptions work?', a: '₹30/month or ₹300/year. Renewal is manual — no auto-debit. The plan activates only after server-verified payment.' },
  { id: 'f5', q: 'How do I report someone?', a: 'Open their profile or chat → menu → Report. Our team reviews every report.' },
];

// ---------- Admin ----------
export const adminUsers: AdminUser[] = Array.from({ length: 28 }, (_, i) => ({
  id: `u${i + 1}`,
  name: i % 3 ? male[i % male.length] : female[i % female.length],
  mobile: `+91 98${String(10000000 + Math.floor(rnd() * 89999999)).slice(0, 8)}`,
  roles: i % 3 === 0 ? ['customer', 'worker'] : i % 2 ? ['worker'] : ['customer'],
  status: i % 9 === 4 ? 'suspended' : i % 13 === 6 ? 'deleted_request' : 'active',
  city: pick(['New Delhi', 'Noida', 'Gurugram', 'Ghaziabad']),
  joinedAt: ago(1000 + i * 2200),
  reports: i % 7 === 3 ? 1 + (i % 3) : 0,
}));

export const verifications: VerificationRequest[] = workers.slice(6, 16).map((w, i) => ({
  id: `v${i + 1}`,
  workerId: w.id,
  workerName: w.name,
  photo: w.photo,
  category: categories.find((c) => c.id === w.categoryId)!.name,
  type: pick<VerificationType>(['id', 'id_address', 'phone']),
  documents: ['Aadhaar (masked)', i % 2 ? 'Address proof' : 'PAN card'],
  status: i < 6 ? 'pending' : pick(['approved', 'rejected', 'info_requested'] as const),
  submittedAt: ago(30 + i * 400),
}));

export const adminComplaints: AdminComplaint[] = [
  ['Fake profile', 'profile', 'Profile photo looks fake, asked advance payment.', 'open'],
  ['Abusive messages', 'message', 'Worker used abusive language in chat.', 'in_progress'],
  ['Fraud', 'fraud', 'Took ₹500 advance and did not come.', 'escalated'],
  ['Fake review', 'review', 'This review is posted by the worker himself.', 'open'],
  ['Spam', 'message', 'Sending promotional messages repeatedly.', 'resolved'],
  ['Other', 'other', 'Unable to update my phone number.', 'open'],
].map(([category, targetType, description, status], i) => ({
  id: `C${101 + i}`,
  category, description,
  targetType: targetType as AdminComplaint['targetType'],
  status: status as AdminComplaint['status'],
  reporterName: pick(male),
  targetName: workers[i * 3].name,
  assignedTo: i % 2 ? 'Support – Neha' : undefined,
  createdAt: ago(60 + i * 700),
}));

export const adminReviews: AdminReview[] = makeReviews(10).map((r, i) => ({
  ...r, id: `ar${i}`, workerName: workers[i * 2].name, reports: i % 3 === 0 ? 1 + i % 4 : 0, status: i === 5 ? 'hidden' : 'visible',
}));

export const transactions: Transaction[] = Array.from({ length: 18 }, (_, i) => {
  const yearly = i % 4 === 0;
  return {
    id: `T${9000 + i}`,
    userName: adminUsers[i].name,
    planName: yearly ? 'Yearly' : 'Monthly',
    amount: yearly ? 300 : 30,
    status: pick(['success', 'success', 'success', 'failed', 'pending', 'refunded'] as const),
    gatewayRef: `pay_${Math.floor(rnd() * 1e12).toString(36)}`,
    createdAt: ago(20 + i * 500),
  };
});

export const auditLogs: AuditLog[] = [
  ['Super Admin', 'verification.approve', 'Worker: Amit Sharma', 'Documents valid'],
  ['Admin – Rahul', 'user.suspend', 'User: Imran Khan', 'Multiple fraud reports'],
  ['Support – Neha', 'complaint.update', 'Complaint #C102', 'Contacted reporter'],
  ['Admin – Rahul', 'review.hide', 'Review #ar5', 'Abusive language'],
  ['Super Admin', 'plan.update', 'Plan: Yearly', 'Price unchanged, features edited'],
  ['Admin – Rahul', 'category.create', 'Category: Mason', undefined],
  ['Super Admin', 'staff.create', 'Staff: Neha (support)', undefined],
].map(([actor, action, target, reason], i) => ({ id: `a${i}`, actor: actor!, action: action!, target: target!, reason, at: ago(15 + i * 320) }));

export const staff: StaffMember[] = [
  { id: 's1', name: 'Prince (Owner)', email: 'owner@worknear.in', role: 'super_admin', mfa: true, lastLoginAt: ago(3) },
  { id: 's2', name: 'Rahul Admin', email: 'rahul@worknear.in', role: 'admin', mfa: true, lastLoginAt: ago(240) },
  { id: 's3', name: 'Neha Support', email: 'neha@worknear.in', role: 'support', mfa: false, lastLoginAt: ago(1200) },
];
