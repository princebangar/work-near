// Seed data — moves to the `categories` table once the database is wired.
export interface Category { id: string; name: string; nameHi: string; icon: string; tint: string; workerCount: number }

export const categories: Category[] = (
  [
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
  ] as const
).map(([id, name, nameHi, icon, tint]) => ({ id, name, nameHi, icon, tint, workerCount: 0 }));
