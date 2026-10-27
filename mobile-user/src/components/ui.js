// Native port of Frontend/src/components/ui.tsx — same components, sizes and tones (Tailwind values → dp).
import { Children, isValidElement, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AirVent, AlertCircle, ArrowLeft, BadgeCheck, BrickWall, Briefcase, Bug, Camera, Car, Cctv, CheckCircle2, ChefHat, Drill, Flower2, GraduationCap,
  Hammer, Info, Laptop, Lightbulb, PaintRoller, Plug, RefreshCw, Refrigerator, Scissors, Shirt, ShowerHead, Smartphone, Sofa, SprayCan, Star, Truck,
  WashingMachine, Wrench, X,
} from 'lucide-react-native';
import { alpha, fonts, useColors } from '@/theme';
import { initials } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import { useToast } from '@/store';

// ---------- Text ----------
/** Text in Plus Jakarta Sans. `w` = weight (400–900), `c` = palette colour key or raw colour. */
export function Txt({ w = 400, size = 15, c = 'ink', style, children, ...p }) {
  const colors = useColors();
  return (
    <Text {...p} style={[{ fontFamily: fonts[w], fontSize: size, color: colors[c] ?? c, includeFontPadding: false }, style]}>
      {children}
    </Text>
  );
}

/** Renders strings/numbers among children as styled text (lets components take mixed icon + label children). */
function Label({ children, ...t }) {
  return Children.map(children, (ch) => (typeof ch === 'string' || typeof ch === 'number' ? <Txt {...t}>{ch}</Txt> : ch));
}

// ---------- Press feedback (web: active:scale-[.98]) ----------
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export function Press({ onPress, disabled, style, scale = 0.98, children, ...p }) {
  const v = useRef(new Animated.Value(1)).current;
  const to = (x) => Animated.timing(v, { toValue: x, duration: 90, useNativeDriver: true }).start();
  return (
    <AnimatedPressable {...p} onPress={onPress} disabled={disabled} onPressIn={() => to(scale)} onPressOut={() => to(1)} style={[style, { transform: [{ scale: v }] }]}>
      {children}
    </AnimatedPressable>
  );
}

// ---------- Button ----------
const BTN_H = { sm: 36, md: 44, lg: 52 };
/** `block` = full width (web: w-full); `grow` = share a row with other buttons (flex: 1). */
export function Button({ variant = 'primary', size = 'md', block, grow, loading, disabled, icon: Icon, onPress, style, textSize, children }) {
  const c = useColors();
  const v = {
    primary: { bg: c.primary, fg: c.onPrimary, border: 'transparent' },
    soft: { bg: c.primarySoft, fg: c.primary, border: 'transparent' },
    ghost: { bg: 'transparent', fg: c.ink2, border: 'transparent' },
    outline: { bg: c.surface, fg: c.ink, border: c.line },
    danger: { bg: c.danger, fg: '#ffffff', border: 'transparent' },
  }[variant];
  const off = disabled || loading;
  const fs = textSize ?? (size === 'lg' ? 16 : 14);
  return (
    <Press
      onPress={onPress}
      disabled={off}
      style={[
        s.btn,
        { height: BTN_H[size], paddingHorizontal: size === 'sm' ? 12 : size === 'lg' ? 20 : 16, backgroundColor: v.bg, borderColor: v.border },
        variant === 'outline' && { borderWidth: 1 },
        variant === 'primary' && { shadowColor: c.primary, shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
        block && { alignSelf: 'stretch' },
        grow && { flex: 1 },
        off && { opacity: 0.5 },
        style,
      ]}
    >
      {loading && <ActivityIndicator size="small" color={v.fg} />}
      {Icon && <Icon size={size === 'sm' ? 15 : 18} color={v.fg} />}
      <Label w={600} size={fs} c={v.fg}>{children}</Label>
    </Press>
  );
}

// ---------- Inputs ----------
export function Input({ label, error, hint, left, disabled, style, inputStyle, ...p }) {
  const c = useColors();
  const [focus, setFocus] = useState(false);
  return (
    <View style={style}>
      {label ? <Txt w={500} size={14} c="ink2" style={{ marginBottom: 6 }}>{label}</Txt> : null}
      <View
        style={[
          s.inputBox,
          { backgroundColor: disabled ? c.surface2 : c.surface, borderColor: error ? c.danger : focus ? c.primary : c.line },
          focus && !error && { shadowColor: c.primary, shadowOpacity: 0.15, shadowRadius: 4, elevation: 0 },
        ]}
      >
        {left}
        <TextInput
          {...p}
          editable={!disabled}
          onFocus={(e) => { setFocus(true); p.onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); p.onBlur?.(e); }}
          placeholderTextColor={c.ink3}
          selectionColor={c.primary}
          style={[s.input, { color: disabled ? c.ink2 : c.ink, fontFamily: fonts[400] }, inputStyle]}
        />
      </View>
      {error ? <Txt size={12} c="danger" style={{ marginTop: 4 }}>{error}</Txt> : hint ? <Txt size={12} c="ink3" style={{ marginTop: 4 }}>{hint}</Txt> : null}
    </View>
  );
}

export function Textarea({ label, error, hint, rows = 4, style, ...p }) {
  const c = useColors();
  const [focus, setFocus] = useState(false);
  return (
    <View style={style}>
      {label ? <Txt w={500} size={14} c="ink2" style={{ marginBottom: 6 }}>{label}</Txt> : null}
      <TextInput
        {...p}
        multiline
        textAlignVertical="top"
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        placeholderTextColor={c.ink3}
        selectionColor={c.primary}
        style={[
          s.textarea,
          { minHeight: rows * 22 + 28, color: c.ink, fontFamily: fonts[400], backgroundColor: c.surface, borderColor: error ? c.danger : focus ? c.primary : c.line },
        ]}
      />
      {error ? <Txt size={12} c="danger" style={{ marginTop: 4 }}>{error}</Txt> : hint ? <Txt size={12} c="ink3" style={{ marginTop: 4 }}>{hint}</Txt> : null}
    </View>
  );
}

// ---------- Card / Chip / Badge ----------
export function Card({ onPress, style, children }) {
  const c = useColors();
  const base = [s.card, { backgroundColor: c.surface, borderColor: alpha(c.line, 0.7) }, style];
  if (onPress) return <Press onPress={onPress} scale={0.99} style={base}>{children}</Press>;
  return <View style={base}>{children}</View>;
}

export function Chip({ active, onPress, disabled, icon: Icon, style, small, children }) {
  const c = useColors();
  const fg = active ? c.onPrimary : c.ink2;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[s.chip, small && { height: 32 }, { borderColor: active ? c.primary : c.line, backgroundColor: active ? c.primary : c.surface }, disabled && { opacity: 0.5 }, style]}
    >
      {Icon && <Icon size={15} color={fg} />}
      <Label w={500} size={small ? 12 : 14} c={fg}>{children}</Label>
    </Pressable>
  );
}

const TONES = {
  neutral: ['surface2', 'ink2'], primary: ['primarySoft', 'primary'], success: ['successSoft', 'success'],
  warning: ['warningSoft', 'warning'], danger: ['dangerSoft', 'danger'],
};
export function Badge({ tone = 'neutral', icon: Icon, style, textStyle, children }) {
  const c = useColors();
  const [bg, fg] = TONES[tone] ?? TONES.neutral;
  const text = typeof children === 'string' ? children.replace(/(^|\s)(\S)/g, (_, sp, ch) => sp + ch.toUpperCase()) : children; // CSS `capitalize`
  return (
    <View style={[s.badge, { backgroundColor: c[bg] }, style]}>
      {Icon && <Icon size={12} color={c[fg]} />}
      <Label w={600} size={11} c={fg} style={textStyle}>{text}</Label>
    </View>
  );
}

// ---------- Avatar / rating ----------
/** Profile picture with initials fallback. `src` may be an API media path — resolved with mediaUrl(). */
export function Avatar({ src, name, size = 44, radius: r, style }) {
  const c = useColors();
  const url = mediaUrl(src);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const br = r ?? size / 2;
  return (
    <View style={[{ width: size, height: size, borderRadius: br, backgroundColor: c.surface3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      <Txt w={700} size={size * 0.36} c="ink2">{initials(name || '?')}</Txt>
      {url && !failed ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" onError={() => setFailed(true)} />
      ) : null}
    </View>
  );
}

export function Stars({ value, size = 14 }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const on = i <= Math.round(value);
        return <Star key={i} size={size} color={on ? c.accent : c.line} fill={on ? c.accent : 'transparent'} />;
      })}
    </View>
  );
}

export function Rating({ value, count }) {
  const c = useColors();
  return (
    <View style={s.row4}>
      <Star size={14} color={c.accent} fill={c.accent} />
      {count === 0 ? <Txt w={500} size={14} c="ink3">New</Txt> : <Txt w={600} size={14}>{value.toFixed(1)}</Txt>}
      {count !== undefined && count > 0 && <Txt size={14} c="ink3">({count})</Txt>}
    </View>
  );
}

export const verificationLabel = { phone: 'Phone verified', id: 'ID verified', id_address: 'ID + Address verified' };
export function VerifiedBadge({ type, compact }) {
  const c = useColors();
  if (!type) return null;
  return (
    <View style={s.row4}>
      <BadgeCheck size={16} color={c.onPrimary} fill={c.primary} />
      {!compact && <Txt w={600} size={12} c="primary">{verificationLabel[type]}</Txt>}
    </View>
  );
}

// Admin picks an icon name per category; the old picks (zap, sparkles, droplets…) looked generic, so they map to clearer
// trade icons here. A known category slug wins over its icon name (electrician → bulb even if admin chose 'zap').
const icons = {
  zap: Lightbulb, plug: Plug, droplets: ShowerHead, hammer: Hammer, 'paint-roller': PaintRoller, snowflake: AirVent, sparkles: SprayCan,
  wrench: Wrench, scissors: Scissors, 'book-open': GraduationCap, car: Car, 'chef-hat': ChefHat, 'brick-wall': BrickWall, briefcase: Briefcase,
  drill: Drill, truck: Truck, flower: Flower2, camera: Camera, shirt: Shirt, bug: Bug, laptop: Laptop, smartphone: Smartphone, cctv: Cctv,
  sofa: Sofa, fridge: Refrigerator, 'washing-machine': WashingMachine,
};
const bySlug = {
  electrician: Lightbulb, plumber: ShowerHead, carpenter: Hammer, painter: PaintRoller, 'ac-repair': AirVent, ac: AirVent, cleaning: SprayCan,
  cleaner: SprayCan, mechanic: Wrench, barber: Scissors, salon: Scissors, tutor: GraduationCap, driver: Car, cook: ChefHat, mason: BrickWall,
  'pest-control': Bug, gardener: Flower2, photographer: Camera, tailor: Shirt, 'computer-repair': Laptop, 'mobile-repair': Smartphone,
  'appliance-repair': WashingMachine, movers: Truck, cctv: Cctv,
};
export function CategoryIcon({ name, slug, size = 24, color }) {
  const I = bySlug[slug] ?? icons[name] ?? Briefcase;
  return <I size={size} strokeWidth={1.8} color={color} />;
}

// ---------- Top bar ----------
export const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

export function IconButton({ onPress, children, style, label, size = 40 }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} hitSlop={4} style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.6 }, style]}>
      {children}
    </Pressable>
  );
}

export function TopBar({ title, back = true, right, onBack }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: c.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: alpha(c.line, 0.9), zIndex: 30 }}>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 }}>
        {back && <IconButton label="Back" onPress={onBack ?? goBack}><ArrowLeft size={22} color={c.ink} /></IconButton>}
        <View style={{ flex: 1, minWidth: 0, paddingLeft: back ? 0 : 8 }}>
          {typeof title === 'string' || title == null ? <Txt w={700} size={17} numberOfLines={1}>{title ?? ''}</Txt> : title}
        </View>
        {right}
      </View>
    </View>
  );
}

// ---------- Sheets & dialogs ----------
function useModalAnim(open, onHidden) {
  const v = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.timing(v, { toValue: 1, duration: 250, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(v, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => { setMounted(false); onHidden?.(); });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return [v, mounted];
}

/** Bottom sheet (web: <Sheet>): dimmed backdrop, slides up, grab handle + title + close. */
export function Sheet({ open, onClose, title, children, scroll = true }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [v, mounted] = useModalAnim(open);
  if (!mounted) return null;
  const Body = scroll ? ScrollView : View;
  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: v }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={{
            maxHeight: '88%', backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
            transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) }],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center' }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.line }} />
            </View>
            <Txt w={700} size={18} style={{ flex: 1, marginTop: 8 }}>{title}</Txt>
            <IconButton label="Close" size={36} onPress={onClose} style={{ marginTop: 8, backgroundColor: c.surface2 }}><X size={18} color={c.ink2} /></IconButton>
          </View>
          <Body keyboardShouldPersistTaps="handled" contentContainerStyle={scroll ? { paddingHorizontal: 20, paddingBottom: 20 + 16 + insets.bottom } : undefined} style={scroll ? undefined : { paddingHorizontal: 20, paddingBottom: 20 + 16 + insets.bottom }}>
            {children}
          </Body>
          {/* sheet colour continues under the phone's navigation bar — otherwise a white strip showed there (dark mode) */}
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: '100%', height: 120, backgroundColor: c.surface }} />
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Small centred popup (web: CenterDialog in account.tsx) — pops in at the middle of the screen. */
export function CenterDialog({ open, onClose, title, children }) {
  const c = useColors();
  const [v, mounted] = useModalAnim(open);
  if (!mounted) return null;
  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: v }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={{
            width: '100%', maxWidth: 340, borderRadius: 24, backgroundColor: c.surface, padding: 16, elevation: 12,
            opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
            <Txt w={700} size={18} style={{ flex: 1 }}>{title}</Txt>
            <IconButton label="Close" size={32} onPress={onClose} style={{ backgroundColor: c.surface2 }}><X size={16} color={c.ink2} /></IconButton>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Centred confirm popup (log out, delete account): icon in a soft ring, title, message, optional extra content
 * (e.g. a "type DELETE" field), Cancel + confirm. Solid card on a dark backdrop in both themes.
 */
export function ConfirmDialog({ open, onClose, icon: I, tone = 'danger', title, message, confirmLabel, cancelLabel, confirmIcon: CI, onConfirm, loading, disabled, children }) {
  const c = useColors();
  const [v, mounted] = useModalAnim(open);
  if (!mounted) return null;
  const accent = tone === 'danger' ? c.danger : c.primary;
  const close = loading ? undefined : onClose;
  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.65)', opacity: v }]}>
          <Pressable style={{ flex: 1 }} onPress={close} />
        </Animated.View>
        <Animated.View
          accessibilityRole="alert"
          style={{
            width: '100%', maxWidth: 360, borderRadius: 28, overflow: 'hidden', backgroundColor: c.surface, borderWidth: 1, borderColor: alpha(c.line, 0.6), elevation: 16,
            opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
          }}
        >
          <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 22 }}>
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, backgroundColor: alpha(accent, 0.06) }} />
            {I && (
              <View style={{ width: 76, height: 76, borderRadius: 38, padding: 6, marginBottom: 16, borderWidth: 1, borderColor: alpha(accent, 0.22), backgroundColor: c.surface }}>
                <View style={{ flex: 1, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(accent, 0.12) }}>
                  <I size={30} color={accent} strokeWidth={2.4} />
                </View>
              </View>
            )}
            <Txt w={800} size={22} style={{ textAlign: 'center' }}>{title}</Txt>
            {message ? <Txt size={14} c="ink2" style={{ marginTop: 6, textAlign: 'center', lineHeight: 21 }}>{message}</Txt> : null}
            {children ? <View style={{ alignSelf: 'stretch', marginTop: 16 }}>{children}</View> : null}
            <View style={{ marginTop: 24, flexDirection: 'row', gap: 12, alignSelf: 'stretch' }}>
              <Pressable onPress={close} disabled={loading} accessibilityRole="button"
                style={({ pressed }) => [{ flex: 1, height: 50, borderRadius: 16, borderWidth: 1.5, borderColor: c.line, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }, pressed && { transform: [{ scale: 0.96 }] }]}>
                <Txt w={700} size={16} c="ink2">{cancelLabel}</Txt>
              </Pressable>
              <Pressable onPress={onConfirm} disabled={loading || disabled} accessibilityRole="button"
                style={({ pressed }) => [{ flex: 1, height: 50, borderRadius: 16, backgroundColor: accent, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1, elevation: 3 }, pressed && { transform: [{ scale: 0.96 }] }]}>
                {loading ? <ActivityIndicator size="small" color="#fff" /> : CI ? <CI size={18} color="#fff" strokeWidth={2.4} /> : null}
                <Txt w={800} size={16} c="#ffffff" numberOfLines={1}>{confirmLabel}</Txt>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- Toggle ----------
export function Toggle({ checked, onChange, disabled, label }) {
  const c = useColors();
  const v = useRef(new Animated.Value(checked ? 1 : 0)).current;
  useEffect(() => { Animated.timing(v, { toValue: checked ? 1 : 0, duration: 150, useNativeDriver: false }).start(); }, [checked, v]);
  return (
    <Pressable
      accessibilityRole="switch" accessibilityState={{ checked, disabled }} accessibilityLabel={label} disabled={disabled} hitSlop={6}
      onPress={() => onChange(!checked)}
    >
      <Animated.View
        style={{
          width: 48, height: 28, borderRadius: 14, opacity: disabled ? 0.5 : 1, borderWidth: checked ? 0 : 1, borderColor: c.line,
          backgroundColor: v.interpolate({ inputRange: [0, 1], outputRange: [c.surface3, c.primary] }),
        }}
      >
        <Animated.View
          style={{
            position: 'absolute', top: checked ? 4 : 3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', elevation: 2,
            left: v.interpolate({ inputRange: [0, 1], outputRange: [3, 24] }),
          }}
        />
      </Animated.View>
    </Pressable>
  );
}

// ---------- Loading / empty / error ----------
export function Skeleton({ style }) {
  const c = useColors();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [v]);
  return <Animated.View style={[{ borderRadius: 12, backgroundColor: c.skelA, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) }, style]} />;
}

export function EmptyState({ icon: Icon, title, sub, action }) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingVertical: 56 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Icon size={32} color={c.primary} />
      </View>
      <Txt w={700} size={18} style={{ textAlign: 'center' }}>{title}</Txt>
      {sub ? <Txt size={14} c="ink2" style={{ marginTop: 4, textAlign: 'center' }}>{sub}</Txt> : null}
      {action ? <View style={{ marginTop: 20 }}>{action}</View> : null}
    </View>
  );
}

/** Inline load failure with retry. */
export function ErrorState({ message, onRetry, retryLabel = 'Try again' }) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <AlertCircle size={28} color={c.ink3} />
      </View>
      <Txt size={14} c="ink2" style={{ textAlign: 'center' }}>{message}</Txt>
      {onRetry && <Button variant="outline" size="sm" icon={RefreshCw} style={{ marginTop: 16 }} onPress={onRetry}>{retryLabel}</Button>}
    </View>
  );
}

export function SectionTitle({ children, action }) {
  return (
    <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Txt w={700} size={17}>{children}</Txt>
      {action}
    </View>
  );
}

/** Inline text link (web: <Link className="text-sm font-semibold text-primary">). */
export function TextLink({ onPress, children, size = 14, style }) {
  return <Txt w={600} size={size} c="primary" onPress={onPress} suppressHighlighting style={style}>{children}</Txt>;
}

export function Loader({ style }) {
  const c = useColors();
  return <View style={[{ alignItems: 'center', paddingVertical: 40 }, style]}><ActivityIndicator size="large" color={c.primary} /></View>;
}

/** Thin divider between rows (web: divide-y divide-line). */
export function Divider({ style }) {
  const c = useColors();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }, style]} />;
}

/** Wraps children with dividers between them. */
export function Divided({ children, style }) {
  const items = Children.toArray(children).filter(isValidElement);
  return <View style={style}>{items.map((ch, i) => [i > 0 && <Divider key={`d${i}`} />, ch])}</View>;
}

// ---------- Toast ----------
export function Toaster() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const t = useToast((x) => x.toast);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (t) { v.setValue(0); Animated.timing(v, { toValue: 1, duration: 200, useNativeDriver: true }).start(); }
  }, [t, v]);
  if (!t) return null;
  const I = t.kind === 'error' ? AlertCircle : t.kind === 'info' ? Info : CheckCircle2;
  const [bg, fg] = t.kind === 'error' ? [c.dangerSoft, c.danger] : t.kind === 'info' ? [c.primarySoft, c.primary] : [c.successSoft, c.success];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 16, alignItems: 'center', paddingHorizontal: 16, zIndex: 60, elevation: 60 }}>
      <Animated.View accessibilityLiveRegion="polite" style={{ opacity: v, maxWidth: 448, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: c.ink, paddingVertical: 10, paddingLeft: 10, paddingRight: 16, elevation: 8 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><I size={16} color={fg} /></View>
        <Txt w={500} size={14} c="surface" style={{ flexShrink: 1 }}>{t.text}</Txt>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12 },
  inputBox: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  input: { flex: 1, height: '100%', fontSize: 15, padding: 0 },
  textarea: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 15 },
  card: { borderRadius: 18, borderWidth: 1 },
  chip: { height: 36, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  row4: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
