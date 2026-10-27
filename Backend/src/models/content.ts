import { Schema, model } from 'mongoose';

/** Service categories with localized labels and the skill list workers can pick from. */
const categorySchema = new Schema(
  {
    _id: { type: String, required: true }, // slug, e.g. 'electrician'
    name: { type: String, required: true, trim: true },
    nameHi: { type: String, default: '' },
    icon: { type: String, default: 'briefcase' },
    image: { type: String, default: '' }, // optional uploaded picture (/uploads/categories/…); shown instead of the icon
    tint: { type: String, default: '#e0e7ff' },
    skills: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    sort: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);
export const Category = model('Category', categorySchema);

const bannerSchema = new Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    tint: { type: String, default: 'from-indigo-600 to-violet-500' }, // Tailwind gradient stops
    link: String,
    active: { type: Boolean, default: true },
    sort: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);
export const Banner = model('Banner', bannerSchema);

const faqSchema = new Schema(
  {
    q: { type: String, required: true },
    a: { type: String, required: true },
    active: { type: Boolean, default: true },
    sort: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);
export const Faq = model('Faq', faqSchema);

/** Legal / CMS pages: terms, privacy, refund, safety. */
const pageSchema = new Schema(
  {
    _id: { type: String, required: true }, // slug
    title: { type: String, required: true },
    body: { type: [String], default: [] }, // paragraphs
  },
  { timestamps: true, versionKey: false },
);
export const Page = model('Page', pageSchema);

/**
 * Feature switches for Admin → Customization Settings. Every switch is enforced server-side
 * (routes return 403 FEATURE_DISABLED) and mirrored in the app UI via GET /settings + socket `settings:update`.
 */
export const FEATURE_KEYS = [
  'subscriptions', // whole subscription model (plans, checkout, gating)
  'chat', // starting new chats / sending messages
  'chatAttachments', // images in chat
  'reviews', // writing reviews + showing ratings section
  'reports', // report profile / message / review
  'complaints', // help → raise complaint
  'verification', // worker verification submissions + badges
  'workerRegistration', // new users can become workers
  'dualRole', // one account can be both customer and worker
  'portfolio', // worker portfolio photos
  'phoneSharing', // workers may show their phone number
  'pushNotifications', // device push (in-app inbox always on)
  'hindi', // Hindi language toggle in the app
  'banners', // home banners
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

const featureDefaults = Object.fromEntries(FEATURE_KEYS.map((k) => [k, { type: Boolean, default: true }]));

/** Single-row app settings controlled by admin (SRS 21 open decisions are configurable here). */
const settingSchema = new Schema(
  {
    _id: { type: String, default: 'app' },
    features: featureDefaults,
    maintenance: {
      enabled: { type: Boolean, default: false },
      title: { type: String, default: 'We’ll be right back' },
      message: { type: String, default: 'WorkNear is getting a quick upgrade. Your chats and profile are safe — please check back shortly.' },
      eta: { type: String, default: '' }, // free text, e.g. "30 minutes"
    },
    subscriptionRequiredFor: { type: [String], enum: ['customer', 'worker'], default: [] },
    radiusOptions: { type: [Number], default: [5, 10, 15] },
    defaultRadiusKm: { type: Number, enum: [5, 10, 15], default: 5 },
    supportEmail: { type: String, default: '' }, // set by admin → Customization Settings
    supportPhone: { type: String, default: '' },
    appVersion: { type: String, default: '1.0.0' },
  },
  { timestamps: true, versionKey: false },
);
export const Setting = model('Setting', settingSchema);
export type Settings = Awaited<ReturnType<typeof loadSettings>>;

async function loadSettings() {
  return (await Setting.findById('app').lean()) ?? (await Setting.create({ _id: 'app' })).toObject();
}

// Settings are read on almost every request (feature guards, maintenance) — cache in memory, invalidate on write.
let cache: { at: number; value: Settings } | null = null;
export async function getSettings() {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const value = await loadSettings();
  cache = { at: Date.now(), value };
  return value;
}
export const invalidateSettings = () => {
  cache = null;
};
export const featureOn = async (k: FeatureKey) => (await getSettings()).features?.[k] !== false;

/** Public subset sent to the app (no internal fields). */
export const publicSettings = (s: Settings) => ({
  features: s.features, maintenance: s.maintenance,
  subscriptionRequiredFor: s.features?.subscriptions ? s.subscriptionRequiredFor : [],
  radiusOptions: s.radiusOptions, defaultRadiusKm: s.defaultRadiusKm,
  supportEmail: s.supportEmail, supportPhone: s.supportPhone, appVersion: s.appVersion,
});
