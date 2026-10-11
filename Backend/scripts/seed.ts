// Usage:
//   npm run seed          → collections, indexes, default content, super admin (safe to re-run; never overwrites edits)
//   npm run seed -- --demo → also adds demo workers/customers around a point (default Connaught Place, Delhi)
//                            override with --lat=22.7196 --lng=75.8577
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDb } from '../lib/db.js';
import { hashPassword } from '../modules/admin/admin.auth.js';
import { defaultBanners, defaultCategories, defaultFaqs, defaultPages, defaultPlans } from '../modules/catalog/catalog.data.js';
import { Block, Otp, User } from '../models/user.js';
import { Review, Verification, WorkerProfile } from '../models/worker.js';
import { Conversation, Message } from '../models/chat.js';
import { Payment, Plan, Subscription } from '../models/billing.js';
import { Banner, Category, Faq, Page, Setting } from '../models/content.js';
import { Admin, AuditLog, Complaint, Counter, Notification, SearchLog } from '../models/ops.js';
import { PushToken } from '../models/PushToken.js';

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

await connectDb();
if (mongoose.connection.readyState !== 1) {
  console.error('MongoDB not connected — set MONGODB_URI in Backend/.env');
  process.exit(1);
}

// 1. Collections + indexes (production runs with autoIndex off, so build them here).
const models = [User, Otp, Block, WorkerProfile, Verification, Review, Conversation, Message, Plan, Subscription, Payment, Category, Banner, Faq, Page, Setting, Admin, Complaint, Notification, AuditLog, SearchLog, Counter, PushToken];
for (const m of models) {
  await m.createCollection().catch(() => undefined);
  await m.syncIndexes();
}
console.log(`✔ ${models.length} collections & indexes ready`);

// 2. Default content — inserted only when missing so admin edits are never overwritten.
const upsertMissing = async <T extends { _id: string }>(M: mongoose.Model<never>, rows: T[]) => {
  for (const r of rows) await M.updateOne({ _id: r._id } as never, { $setOnInsert: r } as never, { upsert: true });
};
await upsertMissing(Category as never, defaultCategories);
await upsertMissing(Plan as never, defaultPlans);
await upsertMissing(Page as never, defaultPages);
if (!(await Banner.exists({}))) await Banner.insertMany(defaultBanners);
if (!(await Faq.exists({}))) await Faq.insertMany(defaultFaqs);
await Setting.updateOne({ _id: 'app' }, { $setOnInsert: { _id: 'app' } }, { upsert: true });
console.log('✔ categories, plans, banners, FAQs, legal pages, settings');

// 3. Super admin.
if (!env.SEED_ADMIN_PASSWORD) {
  console.warn('! SEED_ADMIN_PASSWORD not set — skipping super admin');
} else if (await Admin.exists({ email: env.SEED_ADMIN_EMAIL.toLowerCase() })) {
  console.log(`✔ super admin ${env.SEED_ADMIN_EMAIL} already exists (password unchanged)`);
} else {
  await Admin.create({ name: 'WorkNear Owner', email: env.SEED_ADMIN_EMAIL, passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD), role: 'super_admin' });
  console.log(`✔ super admin created: ${env.SEED_ADMIN_EMAIL}`);
}

// 4. Optional demo data (clearly fake numbers 90000xxxxx so it can be removed later).
if (args.includes('--demo')) {
  const lat = Number(flag('lat') ?? 28.6315), lng = Number(flag('lng') ?? 77.2167);
  const names = ['Ramesh Kumar', 'Suresh Yadav', 'Amit Sharma', 'Sunita Devi', 'Rajesh Verma', 'Priya Sharma', 'Vikas Singh', 'Mohd. Irfan', 'Neha Gupta', 'Deepak Gupta', 'Sanjay Patel', 'Kavita Rawat', 'Manoj Tiwari', 'Arjun Mehra', 'Pooja Arora', 'Ravi Chauhan', 'Imran Khan', 'Anjali Verma', 'Anil Joshi', 'Pankaj Mishra', 'Meena Kumari', 'Rohit Saini', 'Gurpreet Singh', 'Ritu Bansal'];
  const localities = ['Karol Bagh', 'Paharganj', 'Rajendra Nagar', 'Patel Nagar', 'Gole Market', 'Daryaganj', 'Jhandewalan', 'Mandi House', 'Janpath', 'Barakhamba'];
  const cats = await Category.find({ active: true }).lean();
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  let created = 0;
  for (let i = 0; i < names.length; i++) {
    const mobile = `90000${String(10000 + i).slice(-5)}`;
    if (await User.exists({ mobile })) continue;
    const cat = cats[i % cats.length]!;
    const u = await User.create({ mobile, name: names[i], roles: ['customer', 'worker'], activeRole: 'worker', city: 'New Delhi', consentVersion: 'demo', consentAt: new Date() });
    const r = (0.3 + rnd() * 13.5) / 111, a = rnd() * Math.PI * 2; // 0.3–14 km away
    const lo = 200 + Math.floor(rnd() * 5) * 100;
    await WorkerProfile.create({
      user: u._id, displayName: names[i], category: cat._id, skills: cat.skills.slice(0, 2 + Math.floor(rnd() * 3)),
      bio: `${3 + (i % 12)}+ years of experience in ${cat.name.toLowerCase()} work. Honest pricing, neat work and on-time service.`,
      experienceYrs: 1 + Math.floor(rnd() * 18), languages: rnd() > 0.5 ? ['Hindi', 'English'] : ['Hindi'], priceRange: `₹${lo} – ₹${lo * 3}`,
      locality: localities[i % localities.length], serviceRadiusKm: ([5, 10, 15] as const)[i % 3],
      location: { type: 'Point', coordinates: [lng + r * Math.cos(a), lat + r * Math.sin(a)] },
      available: rnd() > 0.25, verification: i % 3 ? 'id' : null, verificationStatus: i % 3 ? 'approved' : 'none',
      lastActiveAt: new Date(Date.now() - Math.floor(rnd() * 3000) * 60_000),
    });
    created++;
  }
  console.log(`✔ demo: ${created} workers around ${lat}, ${lng} (mobiles 90000xxxxx, OTP = DEFAULT_OTP in dev)`);
}

await mongoose.disconnect();
console.log('Done.');
process.exit(0);
