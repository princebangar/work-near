// Bottom-tab area (web: TabsLayout). Customer tabs: Home · Search · Chats · Account; worker tabs: Dashboard · Chats · Account
// (My Profile stays a tab route, opened from Account, so it keeps the tab bar).
import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { TabBar } from '@/components/TabBar';
import { qk, useEnablePush } from '@/api';
import { onForegroundPush } from '@/lib/push';
import { useFeature, toast } from '@/store';
import { useColors } from '@/theme';

/** Once per session: refresh the FCM token if permission was already granted (no prompt), and toast foreground pushes. */
function usePushSync() {
  const qc = useQueryClient();
  const pushOn = useFeature('pushNotifications');
  const { mutate } = useEnablePush();
  useEffect(() => {
    if (pushOn) mutate(false);
  }, [mutate, pushOn]);
  useEffect(
    () =>
      onForegroundPush((p) => {
        toast(p.title, 'info');
        // Chat pushes are mirrored by the socket already; other types land in the inbox.
        if (!p.link?.startsWith('/chats')) qc.invalidateQueries({ queryKey: qk.notifications });
      }),
    [qc],
  );
}

export default function TabsLayout() {
  const c = useColors();
  usePushSync();
  return (
    <Tabs
      backBehavior="history"
      tabBar={() => <TabBar />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg }, animation: 'fade' }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="chats" />
      <Tabs.Screen name="my-profile" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
