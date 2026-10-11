// Default content written by `npm run seed` (only when the collections are empty). Admin edits it afterwards.
export const defaultCategories = (
  [
    ['electrician', 'Electrician', 'इलेक्ट्रीशियन', 'zap', '#fef3c7', ['Wiring', 'Fan installation', 'Switchboard', 'Inverter', 'MCB / fuse', 'Light fitting']],
    ['plumber', 'Plumber', 'प्लंबर', 'droplets', '#dbeafe', ['Leak repair', 'Tap fitting', 'Bathroom fitting', 'Water tank', 'Drainage', 'Motor / pump']],
    ['carpenter', 'Carpenter', 'बढ़ई', 'hammer', '#fde68a', ['Furniture repair', 'Door / window', 'Modular kitchen', 'Bed / wardrobe', 'Polish']],
    ['painter', 'Painter', 'पेंटर', 'paint-roller', '#fce7f3', ['Interior', 'Exterior', 'Texture', 'Waterproofing', 'Wood polish']],
    ['ac-repair', 'AC Repair', 'AC रिपेयर', 'snowflake', '#cffafe', ['AC service', 'Gas refill', 'Installation', 'Fridge repair', 'Washing machine']],
    ['cleaning', 'Cleaning', 'सफ़ाई', 'sparkles', '#dcfce7', ['Deep cleaning', 'Sofa cleaning', 'Kitchen', 'Bathroom', 'Water tank cleaning']],
    ['mechanic', 'Mechanic', 'मैकेनिक', 'wrench', '#e0e7ff', ['Bike repair', 'Car service', 'Puncture', 'Battery', 'Denting / painting']],
    ['beautician', 'Beautician', 'ब्यूटीशियन', 'scissors', '#ffe4e6', ['Bridal makeup', 'Facial', 'Hair cut', 'Mehendi', 'Waxing']],
    ['tutor', 'Tutor', 'ट्यूटर', 'book-open', '#ede9fe', ['Maths', 'Science', 'English', 'Class 1–8', 'Class 9–12', 'Spoken English']],
    ['driver', 'Driver', 'ड्राइवर', 'car', '#e2e8f0', ['Car driving', 'Outstation', 'Monthly driver', 'Commercial vehicle']],
    ['cook', 'Cook', 'कुक', 'chef-hat', '#ffedd5', ['North Indian', 'South Indian', 'Party cooking', 'Tiffin service']],
    ['mason', 'Mason', 'मिस्त्री', 'brick-wall', '#f5f5f4', ['Tiles', 'Plaster', 'Brick work', 'Flooring', 'Renovation']],
  ] as const
).map(([_id, name, nameHi, icon, tint, skills], sort) => ({ _id, name, nameHi, icon, tint, skills: [...skills], sort }));

export const defaultPlans = [
  { _id: 'monthly', name: 'Monthly', price: 30, period: 'month', sort: 1, features: ['Unlimited chats', 'Priority listing in search', 'Verified badge eligibility', 'Chat with any worker nearby'] },
  { _id: 'yearly', name: 'Yearly', price: 300, period: 'year', sort: 2, badge: 'Save ₹60', features: ['Everything in Monthly', '2 months free', 'Priority support', 'Profile insights'] },
];

export const defaultBanners = [
  { title: 'Zero Commission, Always', subtitle: 'Pay workers directly. No hidden cuts.', tint: 'from-indigo-600 to-violet-500', sort: 1 },
  { title: 'Verified Professionals', subtitle: 'Look for the verified badge.', tint: 'from-emerald-600 to-teal-500', sort: 2 },
  { title: 'Join as a Worker', subtitle: 'Get local enquiries within 5 KM.', tint: 'from-amber-500 to-orange-500', link: '/onboarding', sort: 3 },
];

export const defaultFaqs = [
  { q: 'Does WorkNear take commission?', a: 'No. WorkNear has a Zero Commission policy. You pay the worker directly; the platform never deducts anything from job value.' },
  { q: 'How is distance calculated?', a: 'We use straight-line distance from your selected location. You can choose 5, 10 or 15 KM.' },
  { q: 'What does the verified badge mean?', a: 'The badge shows which verification was completed (phone, ID or ID + address) after admin review. It is not a guarantee of service quality or a background check.' },
  { q: 'How do subscriptions work?', a: '₹30/month or ₹300/year. Renewal is manual — no auto-debit. The plan activates only after server-verified payment.' },
  { q: 'Can I be a customer and a worker?', a: 'Yes. One account, one mobile number. Switch between Customer and Worker from your Account page.' },
  { q: 'How do I report someone?', a: 'Open their profile or chat → menu → Report. Our team reviews every report.' },
].map((f, sort) => ({ ...f, sort }));

export const defaultPages = [
  { _id: 'terms', title: 'Terms of Use', body: ['WorkNear is a discovery and communication platform connecting customers with local service providers.', 'WorkNear does not guarantee work quality, worker availability, payment or outcomes.', 'Users must provide accurate information and must not misuse the platform for fraud, spam or abuse.', 'Zero Commission: WorkNear does not charge commission on the value of work. Payment for work is made directly between customer and worker.'] },
  { _id: 'privacy', title: 'Privacy Policy', body: ['We collect only data necessary to provide the service: mobile number, profile details and approximate location.', 'Location is used only to show nearby workers and is not continuously tracked.', 'Identity documents are stored in private storage and accessed only by authorised verification staff. Every access is logged.', 'Chat messages are retained while your account is active and deleted when your account deletion is processed.', 'You can request account deletion from Account → Delete account.'] },
  { _id: 'refund', title: 'Subscription & Refund Policy', body: ['Plans: ₹30/month and ₹300/year, inclusive of applicable taxes.', 'Renewal is manual. No automatic debit without explicit consent.', 'A plan is activated only after server-verified payment success.', 'Refund eligibility and timelines will be published here before payment launch.'] },
  { _id: 'safety', title: 'Community & Safety Guidelines', body: ['Be respectful in chats. Abuse, harassment and spam lead to suspension.', 'Never share OTPs or pay large advances before work starts.', 'Phone number sharing is optional and controlled by you.', 'Report suspicious profiles or messages using the Report option.'] },
];
