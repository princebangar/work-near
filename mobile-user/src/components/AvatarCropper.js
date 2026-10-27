// Circular profile-photo cropper: pick from gallery → drag / pinch the photo inside a round frame → the square around the
// circle is cut out (600×600 JPEG) on the phone. Nothing is uploaded here — screens keep the file and upload it on Save.
import { useCallback, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Check, Minus, Plus, X } from 'lucide-react-native';
import { toast } from '@/store';
import { Button, Txt } from './ui';

const OUT = 600; // px of the saved avatar
const MAX_ZOOM = 4;
const dist = (t) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);

function Cropper({ img, onCancel, onDone }) {
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const D = Math.min(W - 48, 360); // circle diameter on screen
  const base = D / Math.min(img.width, img.height); // zoom 1 = photo just covers the circle
  const st = useRef({ x: 0, y: 0, z: 1 }).current; // committed transform
  const g = useRef({ x: 0, y: 0, z: 1, d0: 0, sx: 0, sy: 0 }).current; // gesture start
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const sc = useRef(new Animated.Value(1)).current;
  const [busy, setBusy] = useState(false);

  // keep the circle fully covered by the photo
  const clamp = (x, y, z) => {
    const mx = Math.max(0, (img.width * base * z - D) / 2);
    const my = Math.max(0, (img.height * base * z - D) / 2);
    return [Math.min(mx, Math.max(-mx, x)), Math.min(my, Math.max(-my, y))];
  };
  const apply = (x, y, z) => {
    const zz = Math.min(MAX_ZOOM, Math.max(1, z));
    const [cx, cy] = clamp(x, y, zz);
    st.x = cx; st.y = cy; st.z = zz;
    tx.setValue(cx); ty.setValue(cy); sc.setValue(zz);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        Object.assign(g, { x: st.x, y: st.y, z: st.z, d0: 0 });
        const t = e.nativeEvent.touches;
        if (t.length === 2) g.d0 = dist(t);
      },
      onPanResponderMove: (e, gs) => {
        const t = e.nativeEvent.touches;
        if (t.length === 2) {
          if (!g.d0) { g.d0 = dist(t); g.z = st.z; g.x = st.x; g.y = st.y; g.sx = gs.dx; g.sy = gs.dy; return; }
          apply(g.x, g.y, g.z * (dist(t) / g.d0));
        } else {
          if (g.d0) { g.d0 = 0; g.x = st.x; g.y = st.y; g.sx = gs.dx; g.sy = gs.dy; }
          apply(g.x + gs.dx - g.sx, g.y + gs.dy - g.sy, st.z);
        }
      },
      onPanResponderRelease: () => { g.sx = 0; g.sy = 0; g.d0 = 0; },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const done = async () => {
    setBusy(true);
    try {
      const s = base * st.z; // screen px per image px
      const size = Math.min(img.width, img.height, D / s);
      const originX = Math.max(0, Math.min(img.width - size, img.width / 2 - st.x / s - size / 2));
      const originY = Math.max(0, Math.min(img.height - size, img.height / 2 - st.y / s - size / 2));
      const ref = await ImageManipulator.manipulate(img.uri)
        .crop({ originX: Math.round(originX), originY: Math.round(originY), width: Math.floor(size), height: Math.floor(size) })
        .resize({ width: OUT, height: OUT })
        .renderAsync();
      const out = await ref.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
      onDone({ uri: out.uri, name: `avatar-${Date.now()}.jpg`, mimeType: 'image/jpeg' });
    } catch {
      toast('Could not crop this photo', 'error');
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000', paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }}>
        <Pressable accessibilityLabel="Cancel" onPress={onCancel} hitSlop={8} style={s.round}><X size={22} color="#fff" /></Pressable>
        <Txt w={700} size={17} c="#ffffff">Move and scale</Txt>
        <View style={{ width: 40 }} />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} {...pan.panHandlers}>
        <Animated.Image
          source={{ uri: img.uri }}
          style={{ width: img.width * base, height: img.height * base, transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }] }}
        />
        {/* dark veil with a round hole: a huge transparent circle whose thick border is the veil */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ width: D + 2000, height: D + 2000, borderRadius: (D + 2000) / 2, borderWidth: 1000, borderColor: 'rgba(0,0,0,0.62)' }} />
          <View style={{ position: 'absolute', width: D, height: D, borderRadius: D / 2, borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' }} />
        </View>
      </View>
      <Txt size={13} c="rgba(255,255,255,0.7)" style={{ textAlign: 'center', marginBottom: 12 }}>Drag to move · pinch to zoom</Txt>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
        <Pressable accessibilityLabel="Zoom out" onPress={() => apply(st.x, st.y, st.z / 1.25)} style={s.round}><Minus size={20} color="#fff" /></Pressable>
        <Pressable accessibilityLabel="Zoom in" onPress={() => apply(st.x, st.y, st.z * 1.25)} style={s.round}><Plus size={20} color="#fff" /></Pressable>
      </View>
      <View style={{ paddingHorizontal: 24 }}>
        <Button size="lg" block loading={busy} style={{ height: 54, borderRadius: 16 }} onPress={done}>
          <Check size={20} color="#fff" />Use photo
        </Button>
      </View>
    </View>
  );
}

/**
 * `const { pick, cropper } = useAvatarPicker()` — render `{cropper}` once in the screen; `await pick()` opens the gallery,
 * then the round cropper, and resolves to the cropped file ({ uri, name, mimeType }) or null if cancelled.
 */
export function useAvatarPicker() {
  const [img, setImg] = useState(null);
  const resolver = useRef(null);
  const finish = useCallback((file) => {
    resolver.current?.(file);
    resolver.current = null;
    setImg(null);
  }, []);
  const pick = useCallback(async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (r.canceled || !r.assets?.[0]) return null;
    const a = r.assets[0];
    // any format the gallery gives (HEIC too) — the crop is re-encoded to JPEG and the server stores WEBP
    if (a.fileSize && a.fileSize > 20 * 1024 * 1024) { toast('Photo too large (max 20 MB)', 'error'); return null; }
    return new Promise((res) => {
      resolver.current = res;
      setImg({ uri: a.uri, width: a.width, height: a.height });
    });
  }, []);
  const cropper = (
    <Modal visible={!!img} animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={() => finish(null)}>
      {img && <Cropper img={img} onCancel={() => finish(null)} onDone={finish} />}
    </Modal>
  );
  return { pick, cropper };
}

const s = StyleSheet.create({
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
});
