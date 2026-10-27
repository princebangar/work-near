// Signed-in area (web: RequireAuth). Syncs the user once per app start (GET /me) and owns the realtime cache updates.
import { useEffect } from 'react';
import { Redirect, Stack, router } from 'expo-router';
import { useMe } from '@/api';
import { useRealtime } from '@/hooks/useRealtime';
import { onPushTap } from '@/lib/push';
import { useAuth, usePrefs } from '@/store';
import { useColors } from '@/theme';

export default function SignedInLayout() {
  const c = useColors();
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  const onboarded = usePrefs((s) => s.onboarded);
  const me = useMe(!!token);
  useEffect(() => { if (me.data) useAuth.getState().updateUser(me.data); }, [me.data]);
  useRealtime();
  // Tapping a push notification opens its link (e.g. "/chats/<id>").
  useEffect(() => (token ? onPushTap((p) => p.link?.startsWith('/') && router.push(p.link)) : undefined), [token]);

  if (!token) return <Redirect href={onboarded ? '/login' : '/welcome'} />;
  if (!user?.name) return <Redirect href="/role" />;
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: c.bg } }} />;
}
