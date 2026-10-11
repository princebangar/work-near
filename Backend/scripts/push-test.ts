// Usage: npm run push:test -- <fcm-token>
// Copy the token from the browser console: localStorage.getItem('wn-push-token')
import { sendPush } from '../lib/fcm.js';

const token = process.argv[2];
if (!token) {
  console.error('Usage: npm run push:test -- <fcm-token>');
  process.exit(1);
}
const res = await sendPush([token], { title: 'WorkNear 🔔', body: 'Test push — FCM is working!', link: '/notifications' });
console.log(res.sent ? 'Sent ✔' : 'Not sent', res);
process.exit(0);
