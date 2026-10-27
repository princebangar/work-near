// Brand intro shown over the app while it boots. Starts on exactly the native splash frame (brand green + white logo
// badge, app.json → expo-splash-screen), then: badge bounces with white location-ping ripples → lifts up → "Work Near"
// slides in word by word → tagline with drawn side lines fades up → the whole intro zooms/fades out once the app is ready.
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';

const BADGE = require('../../assets/splash-icon.png');

const GREEN = '#15803d'; // = app.json splash backgroundColor
const GREEN_DARK = '#0b5a2a';
const GREEN_LIGHT = '#22c55e';
const MINT = '#bbf7d0';
const BADGE_SIZE = 200; // = app.json splash imageWidth
const MIN_SHOW_MS = 2300;

function Ripple({ v }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.ripple,
        {
          opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.75, 2.1] }) }],
        },
      ]}
    />
  );
}

export function AnimatedSplash({ ready, onDone }) {
  const [fontsLoaded, fontError] = useFonts({ PlusJakartaSans_500Medium, PlusJakartaSans_800ExtraBold });
  const fontsReady = fontsLoaded || !!fontError;
  const { width } = useWindowDimensions();
  const fontSize = Math.min(46, Math.round(width * 0.11));

  const pop = useRef(new Animated.Value(0)).current; // badge bounce
  const r1 = useRef(new Animated.Value(0)).current;
  const r2 = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current; // background glow breathing
  const lift = useRef(new Animated.Value(0)).current; // badge moves up
  const w1 = useRef(new Animated.Value(0)).current; // "Work"
  const w2 = useRef(new Animated.Value(0)).current; // "Near"
  const tag = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const introDone = useRef(false);
  const started = useRef(Date.now());

  const onLayout = () => SplashScreen.hide(); // native splash → identical first frame here

  useEffect(() => {
    const g = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    g.start();
    return () => g.stop();
  }, [glow]);

  useEffect(() => {
    if (!fontsReady) return;
    const ripple = (v, delay) =>
      Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true })]);
    Animated.sequence([
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pop, { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.spring(pop, { toValue: 2, friction: 4, tension: 120, useNativeDriver: true }),
        ]),
        ripple(r1, 100),
        ripple(r2, 420),
      ]),
      Animated.timing(lift, { toValue: 1, duration: 520, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }),
      Animated.stagger(130, [
        Animated.spring(w1, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
        Animated.spring(w2, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
      ]),
      Animated.timing(tag, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    ]).start(() => (introDone.current = true));
  }, [fontsReady, pop, r1, r2, lift, w1, w2, tag]);

  useEffect(() => {
    if (!ready || !fontsReady) return;
    let cancelled = false;
    const wait = () => {
      if (cancelled) return;
      if (!introDone.current || Date.now() - started.current < MIN_SHOW_MS) return void setTimeout(wait, 100);
      Animated.timing(exit, { toValue: 1, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => onDone());
    };
    wait();
    return () => { cancelled = true; };
  }, [ready, fontsReady, exit, onDone]);

  const badgeScale = pop.interpolate({ inputRange: [0, 1, 2], outputRange: [1, 1.12, 1] });
  const lineW = tag.interpolate({ inputRange: [0, 1], outputRange: [0, 28] });
  const word = (v, from) => ({ opacity: v, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] });

  return (
    <Animated.View onLayout={onLayout} style={[StyleSheet.absoluteFill, s.root, { opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
      <StatusBar style="light" />
      <LinearGradient colors={[GREEN_LIGHT, GREEN, GREEN_DARK]} locations={[0, 0.5, 1]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: lift }]} />
      <Animated.View pointerEvents="none" style={[s.glow, { width: width * 1.2, height: width * 1.2, borderRadius: width * 0.6, opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.12] }) }]} />
      <Animated.View pointerEvents="none" style={[s.glow, { width: width * 0.8, height: width * 0.8, borderRadius: width * 0.4, opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.16] }) }]} />

      <Animated.View style={[s.center, { transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}>
        <Animated.View style={{ alignItems: 'center', justifyContent: 'center', transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -64] }) }, { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] }) }] }}>
          <Ripple v={r1} />
          <Ripple v={r2} />
          <Animated.Image source={BADGE} resizeMode="contain" style={{ width: BADGE_SIZE, height: BADGE_SIZE, transform: [{ scale: badgeScale }] }} />
        </Animated.View>

        {fontsReady && (
          <View style={[s.textBlock, { marginTop: 40 }]}>
            <View style={{ flexDirection: 'row' }}>
              <Animated.View style={word(w1, -32)}>
                <Text allowFontScaling={false} style={[s.word, { fontSize, lineHeight: fontSize * 1.2, color: '#ffffff' }]}>Work </Text>
              </Animated.View>
              <Animated.View style={word(w2, 32)}>
                <Text allowFontScaling={false} style={[s.word, { fontSize, lineHeight: fontSize * 1.2, color: MINT }]}>Near</Text>
              </Animated.View>
            </View>
            <Animated.View style={[s.tagRow, { opacity: tag, transform: [{ translateY: tag.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
              <Animated.View style={[s.line, { width: lineW }]} />
              <View style={s.dot} />
              <Text allowFontScaling={false} style={s.tag}>Work just around you</Text>
              <View style={s.dot} />
              <Animated.View style={[s.line, { width: lineW }]} />
            </Animated.View>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: GREEN, zIndex: 100, elevation: 100, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', backgroundColor: '#ffffff' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ripple: { position: 'absolute', width: BADGE_SIZE * 0.93, height: BADGE_SIZE * 0.93, borderRadius: BADGE_SIZE, borderWidth: 3, borderColor: '#ffffff' },
  textBlock: { position: 'absolute', top: '50%', alignItems: 'center' },
  word: { fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.5, includeFontPadding: false },
  tagRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  line: { height: 2, borderRadius: 1, backgroundColor: MINT },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: MINT, marginHorizontal: 6 },
  tag: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: 'rgba(255,255,255,0.92)', letterSpacing: 0.3, includeFontPadding: false },
});
