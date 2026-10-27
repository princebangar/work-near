// Native port of Frontend/src/components/system.tsx: settings bootstrap + socket ownership, maintenance gate, theme toggle.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, Hammer, Mail, Moon, PaintRoller, RefreshCw, Sun, Wrench, Zap } from 'lucide-react-native';
import { http } from '@/lib/http';
import { connectSocket, onSocket } from '@/lib/socket';
import { useAuth, useSettings, useTheme, toast } from '@/store';
import { alpha, useColors } from '@/theme';
import { Txt } from './ui';

/** Sun/moon button with the web's rotate/slide swap. */
export function ThemeToggle({ style, color }) {
  const mode = useTheme((s) => s.mode);
  const setMode = useTheme((s) => s.setMode);
  const dark = mode === 'dark';
  const v = useRef(new Animated.Value(dark ? 1 : 0)).current;
  useEffect(() => { Animated.timing(v, { toValue: dark ? 1 : 0, duration: 500, useNativeDriver: true }).start(); }, [dark, v]);
  const sun = { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, 24] }) }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) }] };
  const moon = { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] }) }] };
  return (
    <Pressable accessibilityLabel={dark ? 'Switch to light mode' : 'Switch to dark mode'} onPress={() => setMode(dark ? 'light' : 'dark')}
      style={[{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
      <Animated.View style={[{ position: 'absolute' }, sun]}><Sun size={20} color={color} /></Animated.View>
      <Animated.View style={[{ position: 'absolute' }, moon]}><Moon size={20} color={color} /></Animated.View>
    </Pressable>
  );
}

/**
 * Loads public settings once and keeps them live over the socket. Also owns the single socket connection
 * (re-connects with the user's token after login/logout) and app-wide realtime events.
 */
export function AppBootstrap() {
  const token = useAuth((s) => s.token);
  const setSettings = useSettings((s) => s.set);
  const qc = useQueryClient();

  useEffect(() => {
    http.get('/settings').then(setSettings).catch(() => undefined);
  }, [setSettings]);

  useEffect(() => {
    connectSocket(token);
    const offs = [
      onSocket('settings:update', (s) => {
        setSettings(s);
        qc.invalidateQueries({ queryKey: ['banners'] });
      }),
      onSocket('account:suspended', () => {
        toast('Your account has been suspended', 'error');
        useAuth.getState().logout();
        qc.clear();
      }),
      onSocket('notification:new', (n) => {
        qc.setQueryData(['notifications'], (l) => (l ? [n, ...l.filter((x) => x.id !== n.id)] : l));
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [token, setSettings, qc]);

  return null;
}

/** When admin turns maintenance on, the app is replaced instantly. */
export function MaintenanceGate({ children }) {
  const m = useSettings((s) => s.settings?.maintenance);
  return m?.enabled ? <MaintenanceScreen /> : children;
}

function Floating({ I, pos, delay }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [v, delay]);
  return (
    <Animated.View style={[s.floater, pos, { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] }) }] }]}>
      <I size={20} color="#fff" />
    </Animated.View>
  );
}

export function MaintenanceScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const m = useSettings((s) => s.settings?.maintenance);
  const email = useSettings((s) => s.settings?.supportEmail) || '';
  const setSettings = useSettings((s) => s.set);
  const [busy, setBusy] = useState(false);
  const wiggle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(wiggle, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [wiggle]);
  const retry = async () => {
    setBusy(true);
    try {
      const st = await http.get('/settings');
      setSettings(st);
      if (st.maintenance.enabled) toast('Still under maintenance — we’ll be back soon', 'info');
    } catch {
      toast('Could not reach Work Near', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.surface, paddingBottom: insets.bottom + 16 }}>
      <StatusBar style="light" />
      <LinearGradient colors={[c.primary, c.primary, c.primary2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ overflow: 'hidden', borderBottomLeftRadius: 36, borderBottomRightRadius: 36, paddingHorizontal: 24, paddingTop: insets.top + 56, paddingBottom: 96 }}>
        <View style={[s.blob, { top: -80, right: -64, width: 256, height: 256 }]} />
        <View style={[s.blob, { bottom: -96, left: -40, width: 224, height: 224 }]} />
        <Floating I={Wrench} pos={{ left: '6%', top: '18%' }} delay={0} />
        <Floating I={Hammer} pos={{ right: '8%', top: '12%' }} delay={600} />
        <Floating I={Zap} pos={{ left: '14%', bottom: '22%' }} delay={1200} />
        <Floating I={PaintRoller} pos={{ right: '12%', bottom: '28%' }} delay={1800} />
        <View style={{ alignSelf: 'center', width: 112, height: 112, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 16 }}>
          <Animated.View style={{ transform: [{ rotate: wiggle.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: ['0deg', '-18deg', '14deg', '-8deg', '4deg', '0deg'] }) }] }}>
            <Wrench size={52} color={c.primary} />
          </Animated.View>
        </View>
      </LinearGradient>
      <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 24, marginTop: -40 }}>
        <View style={{ borderRadius: 999, backgroundColor: c.warningSoft, paddingHorizontal: 12, paddingVertical: 4 }}>
          <Txt w={700} size={12} c="warning" style={{ letterSpacing: 0.6 }}>SCHEDULED MAINTENANCE</Txt>
        </View>
        <Txt w={800} size={26} style={{ marginTop: 16, textAlign: 'center' }}>{m?.title || 'We’ll be right back'}</Txt>
        <Txt size={15} c="ink2" style={{ marginTop: 8, maxWidth: 384, textAlign: 'center' }}>{m?.message}</Txt>
        {m?.eta ? (
          <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, backgroundColor: c.surface2, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Clock size={16} color={c.primary} /><Txt w={600} size={14}>Expected back in {m.eta}</Txt>
          </View>
        ) : null}
        <View style={{ marginTop: 24, width: '100%', maxWidth: 384, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: alpha(c.surface2, 0.6), padding: 16 }}>
          <Txt w={700} size={14}>Your data is safe</Txt>
          <Txt size={14} c="ink2">Chats, profile and subscription are untouched. Workers stay listed once we are back.</Txt>
        </View>
        <View style={{ flex: 1, minHeight: 24 }} />
        <Pressable onPress={retry} disabled={busy} style={{ marginBottom: 12, height: 52, width: '100%', maxWidth: 384, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, backgroundColor: c.primary, opacity: busy ? 0.6 : 1 }}>
          <RefreshCw size={18} color={c.onPrimary} /><Txt w={600} c="onPrimary">Try again</Txt>
        </Pressable>
        {email ? (
          <Pressable onPress={() => Linking.openURL(`mailto:${email}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Mail size={15} color={c.ink2} /><Txt w={600} size={14} c="ink2">{email}</Txt>
          </Pressable>
        ) : null}
      </View>
      <ThemeToggle color="#fff" style={{ position: 'absolute', top: insets.top + 12, right: 16, backgroundColor: 'rgba(255,255,255,0.15)' }} />
    </View>
  );
}

const s = StyleSheet.create({
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  floater: { position: 'absolute', width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
