import { StrictMode, lazy, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/http';
import { Toaster } from '@/components/ui';
import { AppBootstrap } from '@/components/system';
import { initTheme, syncThemeScope } from '@/lib/theme';
import { AppFrame, RequireAuth, TabsLayout } from '@/layouts/AppLayout';
import './index.css';

// Route-level code splitting: each feature (and the whole admin panel) is its own chunk.
const L = <M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M) =>
  lazy(() => load().then((m) => ({ default: m[name] as ComponentType })));

const auth = () => import('@/features/auth');
const home = () => import('@/features/home');
const search = () => import('@/features/search');
const worker = () => import('@/features/worker');
const chat = () => import('@/features/chat');
const account = () => import('@/features/account');
const subscription = () => import('@/features/subscription');
const help = () => import('@/features/help');
const onboarding = () => import('@/features/onboarding');
const admin = () => import('@/features/admin');

const Welcome = L(auth, 'Welcome'), Login = L(auth, 'Login'), Otp = L(auth, 'Otp'), RoleSetup = L(auth, 'RoleSetup');
const Home = L(home, 'Home'), Notifications = L(home, 'Notifications');
const Search = L(search, 'SearchPage');
const WorkerProfile = L(worker, 'WorkerProfile'), MyProfile = L(worker, 'MyProfile');
const Onboarding = L(onboarding, 'WorkerOnboarding'), Verification = L(onboarding, 'VerificationPage');
const ChatList = L(chat, 'ChatList'), ChatThread = L(chat, 'ChatThread');
const Account = L(account, 'Account'), EditProfile = L(account, 'EditProfile'), NotifSettings = L(account, 'NotificationSettings'),
  Blocked = L(account, 'BlockedUsers');
const Subscription = L(subscription, 'SubscriptionPage');
const Help = L(help, 'Help'), Complaint = L(help, 'ComplaintForm'), Legal = L(help, 'Legal');
const AdminLogin = L(admin, 'AdminLogin'), AdminRoot = L(admin, 'AdminRoot');

const router = createBrowserRouter([
  { path: '/admin/login', element: <AdminLogin /> },
  { path: '/admin/*', element: <AdminRoot /> },
  {
    element: <AppFrame />,
    children: [
      { path: '/welcome', element: <Welcome /> },
      { path: '/login', element: <Login /> },
      { path: '/otp', element: <Otp /> },
      { path: '/role', element: <RoleSetup /> },
      { path: '/legal/:slug', element: <Legal /> },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <TabsLayout />,
            children: [
              { path: '/', element: <Home /> },
              { path: '/search', element: <Search /> },
              { path: '/chats', element: <ChatList /> },
              { path: '/my-profile', element: <MyProfile /> },
              { path: '/account', element: <Account /> },
            ],
          },
          { path: '/worker/:id', element: <WorkerProfile /> },
          { path: '/chats/:id', element: <ChatThread /> },
          { path: '/notifications', element: <Notifications /> },
          { path: '/subscription', element: <Subscription /> },
          { path: '/onboarding', element: <Onboarding /> },
          { path: '/verification', element: <Verification /> },
          { path: '/profile/edit', element: <EditProfile /> },
          { path: '/settings/notifications', element: <NotifSettings /> },
          { path: '/blocked', element: <Blocked /> },
          { path: '/help', element: <Help /> },
          { path: '/help/complaint', element: <Complaint /> },
        ],
      },
    ],
  },
]);

initTheme();
router.subscribe(syncThemeScope); // admin ↔ app navigation switches panel theme

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppBootstrap />
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);

// After the first screen has finished loading (no skeleton left on it), later skeletons wait 250 ms before showing,
// so instant / cached data never flashes a skeleton (see `html.booted` in index.css).
const bootedAt = Date.now();
const markBooted = setInterval(() => {
  if (document.querySelector('.skeleton, .skel-wait, .bs') && Date.now() - bootedAt < 10_000) return; // cap: a stuck skeleton never blocks it
  document.documentElement.classList.add('booted');
  clearInterval(markBooted);
}, 200);
