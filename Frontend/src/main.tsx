import { StrictMode, lazy, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/http';
import { Toaster } from '@/components/ui';
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
const admin = () => import('@/features/admin');

const Welcome = L(auth, 'Welcome'), Login = L(auth, 'Login'), Otp = L(auth, 'Otp'), RoleSetup = L(auth, 'RoleSetup');
const Home = L(home, 'Home'), Notifications = L(home, 'Notifications');
const Search = L(search, 'SearchPage');
const WorkerProfile = L(worker, 'WorkerProfile'), MyProfile = L(worker, 'MyProfile'), Onboarding = L(worker, 'WorkerOnboarding');
const ChatList = L(chat, 'ChatList'), ChatThread = L(chat, 'ChatThread');
const Account = L(account, 'Account'), Subscription = L(account, 'SubscriptionPage'), EditProfile = L(account, 'EditProfile'),
  NotifSettings = L(account, 'NotificationSettings'), Blocked = L(account, 'BlockedUsers'), Help = L(account, 'Help'),
  Complaint = L(account, 'ComplaintForm'), Legal = L(account, 'Legal');
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);
