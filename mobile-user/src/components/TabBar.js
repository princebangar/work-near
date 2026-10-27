// Floating bottom nav: white pill bar, uppercase bold labels, unread badge on Chats, hide on scroll-down / show on
// scroll-up. Outline icons only, never filled (HelloParth Food bar style): the selected tab is brand green with a heavier
// stroke, a bold label and a slight scale-up; idle tabs are grey.
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { create } from 'zustand';
import { CircleUserRound, House, LayoutGrid, MessageSquareText, Search } from 'lucide-react-native';
import { useConversations } from '@/api';
import { useAuth } from '@/store';
import { useT } from '@/i18n';
import { alpha, useColors, useIsDark } from '@/theme';
import { Txt } from './ui';

const customerTabs = [
  { to: '/', icon: House, label: 'home' },
  { to: '/search', icon: Search, label: 'search' },
  { to: '/chats', icon: MessageSquareText, label: 'chats' },
  { to: '/account', icon: CircleUserRound, label: 'account' },
];
const workerTabs = [
  { to: '/', icon: LayoutGrid, label: 'dashboard' },
  { to: '/chats', icon: MessageSquareText, label: 'chats' },
  // My Profile (public profile preview) opens from Account — one profile entry in the bar, not two
  { to: '/account', icon: CircleUserRound, label: 'account' },
];

/** Space a tab screen leaves at the bottom for the floating bar (web: pb-[calc(104px+safe-area)]). */
export const TAB_BAR_SPACE = 104;

// Shared hide-on-scroll state; tab screens report their scroll position with `useTabScroll()`.
const useBarHidden = create((set) => ({ hidden: false, set: (hidden) => set({ hidden }) }));

/** onScroll handler for tab screens (same thresholds as the web / HelloParth). */
export function useTabScroll() {
  const st = useRef({ last: 0, acc: 0 }).current;
  return (e) => {
    const y = e.nativeEvent.contentOffset.y;
    const setHidden = useBarHidden.getState().set;
    if (y <= 50) { st.acc = 0; st.last = y; setHidden(false); return; }
    const d = y - st.last;
    if (Math.sign(d) !== Math.sign(st.acc)) st.acc = 0;
    st.acc += d;
    if (st.acc > 80 && y > 100) setHidden(true);
    else if (st.acc < -150) setHidden(false);
    st.last = y;
  };
}

export function TabBar() {
  const t = useT();
  const c = useColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const role = useAuth((s) => s.user?.activeRole);
  const { data } = useConversations();
  const unread = data?.reduce((n, x) => n + (x.muted ? 0 : x.unread), 0) ?? 0;
  const tabs = role === 'worker' ? workerTabs : customerTabs;
  const active = tabs.findIndex(({ to }) => (to === '/' ? pathname === '/' : pathname.startsWith(to) || (to === '/account' && pathname.startsWith('/my-profile'))));
  const hidden = useBarHidden((s) => s.hidden);
  const hide = useRef(new Animated.Value(0)).current;

  useEffect(() => { useBarHidden.getState().set(false); }, [pathname]);
  useEffect(() => {
    Animated.timing(hide, { toValue: hidden ? 1 : 0, duration: 200, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start();
  }, [hidden, hide]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[st.wrap, { paddingBottom: 20 + insets.bottom, transform: [{ translateY: hide.interpolate({ inputRange: [0, 1], outputRange: [0, 140] }) }] }]}
    >
      <View
        style={[
          st.bar,
          { backgroundColor: dark ? alpha(c.surface3, 0.95) : c.surface, borderColor: dark ? 'rgba(255,255,255,0.1)' : alpha(c.line, 0.7), shadowOpacity: dark ? 0.9 : 0.3 },
        ]}
      >
        {tabs.map(({ to, icon: I, label }, i) => {
          const on = i === active;
          const color = on ? c.primary : c.ink2;
          return (
            <Pressable
              key={to}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => (on ? null : router.navigate(to))}
              style={st.item}
            >
              <View style={{ transform: [{ scale: on ? 1.1 : 1 }] }}>
                <I size={23} strokeWidth={on ? 2.3 : 1.8} color={color} />
                {to === '/chats' && unread > 0 && (
                  <View style={[st.badge, { backgroundColor: c.danger, borderColor: dark ? c.surface3 : c.surface }]}>
                    <Txt w={700} size={10} c="#ffffff">{unread > 99 ? '99+' : unread}</Txt>
                  </View>
                )}
              </View>
              <Txt w={on ? 800 : 600} size={10} c={color} style={{ letterSpacing: 0.2 }}>{t(label).toUpperCase()}</Txt>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, zIndex: 40 },
  bar: {
    height: 70, flexDirection: 'row', alignItems: 'center', borderRadius: 32, borderWidth: 1, paddingHorizontal: 6,
    shadowColor: '#000', shadowRadius: 20, shadowOffset: { width: 0, height: 15 }, elevation: 14,
  },
  item: { flex: 1, height: 60, alignItems: 'center', justifyContent: 'center', gap: 3, zIndex: 10 },
  badge: { position: 'absolute', top: -6, right: -10, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
