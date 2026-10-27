// Native port of Frontend/src/components/LocationSheet.tsx — full-screen location picker.
//  - Customer (default): search an area, use current location, saved addresses (Home / Work / Other), add an address by
//    placing a pin. Sets the app's search location + radius (useGeo).
//  - `onPick` mode (worker service area): straight to the map pin, nothing global changes.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import MapView, { Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Briefcase, ChevronRight, Crosshair, Home, LocateFixed, MapPin, Pencil, Plus, Search, Trash2, X } from 'lucide-react-native';
import { Button, Chip, Input, Txt } from './ui';
import { useAuth, useGeo, toast } from '@/store';
import { useT } from '@/i18n';
import { useRadius } from '@/hooks/useAppSettings';
import { useAddresses, useDeleteAddress, useSaveAddress } from '@/api';
import { getDeviceLocation, GpsError } from '@/lib/location';
import { autocomplete, mapsEnabled, placeLocation, reverseGeocodeDetail } from '@/lib/maps';
import { alpha, fonts, useColors } from '@/theme';

// Map opens over India until we know where the user is (geographic centre, not a city default).
const INDIA = { lat: 22.35, lng: 78.67 };
const LABELS = [
  { v: 'home', key: 'addrHome', icon: Home },
  { v: 'work', key: 'addrWork', icon: Briefcase },
  { v: 'other', key: 'addrOther', icon: MapPin },
];
const iconOf = (l) => LABELS.find((x) => x.v === l).icon;
const gpsMessage = (e) => (e instanceof GpsError ? `gps_${e.reason}` : 'gps_unavailable');
/** Google zoom level → region delta (web used map.setZoom). */
const deltaFor = (zoom) => 360 / 2 ** zoom * 1.4;
const zoomForRing = (km) => (!km ? 16 : km <= 5 ? 13 : km <= 10 ? 12 : 11);

export function LocationSheet({ open, onClose, onPick, initial, circleKm, title }) {
  const t = useT();
  const c = useColors();
  const pickMode = !!onPick;
  const [mode, setMode] = useState(null); // null = list view
  const v = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMode(pickMode ? { kind: 'browse' } : null);
      setMounted(true);
      Animated.timing(v, { toValue: 1, duration: 250, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(v, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMounted(false));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!mounted) return null;

  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={() => (mode && !pickMode ? setMode(null) : onClose())}>
      <Animated.View
        accessibilityLabel={title ?? t('selectLocation')}
        style={{ flex: 1, backgroundColor: c.bg, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [900, 0] }) }] }}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {mode ? (
            <MapPane mode={mode} pickMode={pickMode} initial={initial} circleKm={circleKm} title={title} onBack={() => (pickMode ? onClose() : setMode(null))} onPick={onPick} onDone={onClose} />
          ) : (
            <ListPane onClose={onClose} onAdd={() => setMode({ kind: 'save' })} onEdit={(a) => setMode({ kind: 'save', edit: a })} />
          )}
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

// ---------- Search box (Places autocomplete, debounced, min 3 chars) ----------
function PlaceSearch({ onPlace, style }) {
  const t = useT();
  const c = useColors();
  const [q, setQ] = useState('');
  const [sugs, setSugs] = useState([]);
  useEffect(() => {
    if (!mapsEnabled || q.trim().length < 3) return setSugs([]);
    const id = setTimeout(() => autocomplete(q.trim()).then(setSugs).catch(() => setSugs([])), 300);
    return () => clearTimeout(id);
  }, [q]);
  if (!mapsEnabled) return null;
  const pick = async (s) => {
    setQ('');
    setSugs([]);
    try {
      onPlace(await placeLocation(s.id, s.secondary ? `${s.main}, ${s.secondary.split(',')[0]}` : s.main));
    } catch {
      toast(t('placeNotFound'), 'error');
    }
  };
  return (
    <View style={[{ zIndex: 30 }, style]}>
      <View style={[st.searchBox, { borderColor: c.line, backgroundColor: c.surface }]}>
        <Search size={18} color={c.ink3} />
        <TextInput
          value={q} onChangeText={setQ} placeholder={t('searchArea')} accessibilityLabel={t('searchArea')} placeholderTextColor={c.ink3} selectionColor={c.primary}
          style={{ flex: 1, height: '100%', color: c.ink, fontFamily: fonts[400], fontSize: 15, padding: 0 }}
        />
        {q ? <Pressable accessibilityLabel="Clear" onPress={() => setQ('')} hitSlop={8}><X size={18} color={c.ink3} /></Pressable> : null}
      </View>
      {sugs.length > 0 && (
        <View style={[st.sugs, { borderColor: c.line, backgroundColor: c.surface }]}>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 288 }}>
            {sugs.map((s) => (
              <Pressable key={s.id} onPress={() => pick(s)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 12 }, pressed && { backgroundColor: c.surface2 }]}>
                <MapPin size={18} color={c.ink3} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt w={700} numberOfLines={1}>{s.main}</Txt>
                  <Txt size={12} c="ink2" numberOfLines={1}>{s.secondary}</Txt>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ---------- List view: search · current location · add address · saved · radius ----------
function ListPane({ onClose, onAdd, onEdit }) {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const geo = useGeo();
  const signedIn = !!useAuth((s) => s.token);
  const { radiusKm, options, setRadius } = useRadius();
  const saved = useAddresses(signedIn);
  const [busy, setBusy] = useState(false);
  const [gpsErr, setGpsErr] = useState(null);

  const commit = (p) => { geo.setPoint(p); onClose(); };
  const locate = async () => {
    setBusy(true);
    setGpsErr(null);
    try {
      const p = await getDeviceLocation();
      const label = mapsEnabled ? (await reverseGeocodeDetail(p.lat, p.lng).catch(() => null))?.label : null;
      commit({ lat: p.lat, lng: p.lng, label: label ?? t('currentLocation'), source: 'gps' });
    } catch (e) {
      setGpsErr(gpsMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const group = [st.group, { borderColor: alpha(c.line, 0.7), backgroundColor: c.surface }];
  return (
    <>
      <View style={{ paddingTop: insets.top, backgroundColor: c.surface, zIndex: 20 }}>
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 }}>
          <Pressable accessibilityLabel={t('back')} onPress={onClose} style={st.iconBtn}><ArrowLeft size={22} color={c.ink} /></Pressable>
          <Txt w={700} size={18}>{t('selectLocation')}</Txt>
        </View>
        <PlaceSearch onPlace={(p) => commit({ ...p, source: 'manual' })} style={{ paddingHorizontal: 16, paddingBottom: 12 }} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 + insets.bottom, gap: 16 }}>
        <View style={group}>
          <Pressable onPress={locate} disabled={busy} style={({ pressed }) => [st.listRow, pressed && { backgroundColor: c.surface2 }]}>
            <View style={[st.circle40, { backgroundColor: c.primarySoft }]}>
              {busy ? <ActivityIndicator size="small" color={c.primary} /> : <Crosshair size={20} strokeWidth={2.4} color={c.primary} />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt w={700} c="primary">{t('useCurrentLocation')}</Txt>
              <Txt size={12} c={gpsErr ? 'danger' : 'ink2'}>
                {busy ? t('detectingLocation') : gpsErr ? t(gpsErr) : geo.point?.source === 'gps' ? geo.point.label : t('tapToDetect')}
              </Txt>
            </View>
            <ChevronRight size={18} color={c.ink3} />
          </Pressable>
          {signedIn && (
            <Pressable onPress={onAdd} style={({ pressed }) => [st.listRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }, pressed && { backgroundColor: c.surface2 }]}>
              <View style={[st.circle40, { backgroundColor: c.primarySoft }]}><Plus size={20} color={c.primary} /></View>
              <Txt w={700} c="primary" style={{ flex: 1 }}>{t('addAddress')}</Txt>
              <ChevronRight size={18} color={c.ink3} />
            </Pressable>
          )}
        </View>
        {!mapsEnabled && <Txt size={12} c="warning" style={{ borderRadius: 12, backgroundColor: c.warningSoft, paddingHorizontal: 12, paddingVertical: 8 }}>{t('mapsUnavailable')}</Txt>}

        {signedIn && !!saved.data?.length && (
          <View>
            <Txt w={700} size={12} c="ink2" style={st.groupTitle}>{t('savedAddresses').toUpperCase()}</Txt>
            <View style={group}>
              {saved.data.map((a, i) => {
                const I = iconOf(a.label);
                const name = a.label === 'other' ? a.name || t('addrOther') : t(a.label === 'home' ? 'addrHome' : 'addrWork');
                const active = geo.point && Math.abs(geo.point.lat - a.lat) < 1e-5 && Math.abs(geo.point.lng - a.lng) < 1e-5;
                return (
                  <View key={a.id} style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 8 }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}>
                    <Pressable onPress={() => commit({ lat: a.lat, lng: a.lng, label: name, source: 'manual' })} style={({ pressed }) => [st.listRow, { flex: 1, alignItems: 'flex-start' }, pressed && { backgroundColor: c.surface2 }]}>
                      <View style={[st.circle40, { backgroundColor: active ? c.primary : c.surface2 }]}><I size={19} color={active ? c.onPrimary : c.ink2} /></View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt w={700}>{name}</Txt>
                        <Txt size={12} c="ink2" numberOfLines={2}>{[a.line, a.address].filter(Boolean).join(', ')}</Txt>
                      </View>
                    </Pressable>
                    <Pressable accessibilityLabel={t('editAddress')} onPress={() => onEdit(a)} style={[st.iconBtn, { width: 36, height: 36 }]}><Pencil size={16} color={c.ink3} /></Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View>
          <Txt w={700} size={12} c="ink2" style={st.groupTitle}>{t('searchRadius').toUpperCase()}</Txt>
          <View style={{ flexDirection: 'row', gap: 8 }}>{options.map((r) => <Chip key={r} active={radiusKm === r} onPress={() => setRadius(r)}>{r} KM</Chip>)}</View>
          <Txt size={12} c="ink3" style={{ marginTop: 12 }}>{t('locationPrivacy')}</Txt>
        </View>
      </ScrollView>
    </>
  );
}

// ---------- Map view: drag the map under a fixed pin ----------
function MapPane({ mode, pickMode, initial, circleKm, title, onBack, onPick, onDone }) {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const geo = useGeo();
  const { radiusKm } = useRadius();
  const save = useSaveAddress();
  const del = useDeleteAddress();
  const edit = mode.kind === 'save' ? mode.edit : undefined;
  const ringKm = pickMode ? circleKm : mode.kind === 'browse' ? radiusKm : undefined;
  const [start] = useState(() => (edit ? { lat: edit.lat, lng: edit.lng, label: edit.address } : initial ?? geo.point ?? null));

  const [draft, setDraft] = useState(start ? { lat: start.lat, lng: start.lng, label: start.label, full: edit?.address ?? start.label, source: 'manual' } : null);
  const [center, setCenter] = useState(start ? { latitude: start.lat, longitude: start.lng } : { latitude: INDIA.lat, longitude: INDIA.lng });
  const [label, setLabel] = useState(edit?.label ?? 'home');
  const [name, setName] = useState(edit?.name ?? '');
  const [line, setLine] = useState(edit?.line ?? '');
  const [gpsBusy, setGpsBusy] = useState(false);
  const map = useRef(null);
  const skipIdle = useRef(true);
  const resolving = useRef(0);
  const timer = useRef(null);

  const resolve = async (lat, lng, source) => {
    const id = ++resolving.current;
    setDraft({ lat, lng, label: t('locating'), full: '', source });
    const r = await reverseGeocodeDetail(lat, lng).catch(() => ({ label: t('pinnedLocation'), full: t('pinnedLocation') }));
    if (id === resolving.current) setDraft({ lat, lng, ...r, source });
  };
  const moveMap = (lat, lng, zoom) => {
    skipIdle.current = true;
    const d = deltaFor(zoom);
    map.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: d, longitudeDelta: d }, 400);
  };

  const locate = async (silent = false) => {
    setGpsBusy(true);
    try {
      const p = await getDeviceLocation();
      moveMap(p.lat, p.lng, 16);
      await resolve(p.lat, p.lng, 'gps');
    } catch (e) {
      if (!silent) toast(t(gpsMessage(e)), 'error');
    } finally {
      setGpsBusy(false);
    }
  };

  useEffect(() => {
    if (!start) void locate(true); // no location yet → try GPS once, quietly
    return () => clearTimeout(timer.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After the user stops dragging, resolve the address under the pin (debounced + cached).
  const onRegionChangeComplete = (r) => {
    setCenter({ latitude: r.latitude, longitude: r.longitude });
    if (skipIdle.current) { skipIdle.current = false; return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void resolve(r.latitude, r.longitude, 'manual'), 400);
  };

  const moveTo = (p) => {
    moveMap(p.lat, p.lng, zoomForRing(ringKm));
    void resolve(p.lat, p.lng, 'manual');
  };

  const ready = !!draft && draft.label !== t('locating');
  const confirm = () => {
    if (!draft) return;
    const p = { lat: draft.lat, lng: draft.lng, label: draft.label, source: draft.source };
    if (onPick) onPick(p);
    else geo.setPoint(p);
    onDone();
  };
  const saveAddress = () => {
    if (!draft) return;
    const body = { label, name: label === 'other' ? name.trim() : '', line: line.trim(), address: (draft.full || draft.label).slice(0, 200), lat: draft.lat, lng: draft.lng };
    save.mutate({ id: edit?.id, body }, {
      onSuccess: () => {
        toast(t('addressSaved'), 'success');
        const shown = label === 'other' ? body.name || t('addrOther') : t(label === 'home' ? 'addrHome' : 'addrWork');
        geo.setPoint({ lat: body.lat, lng: body.lng, label: shown, source: 'manual' });
        onDone();
      },
    });
  };

  const saving = mode.kind === 'save';
  const z0 = !start ? 5 : zoomForRing(ringKm);
  const d0 = deltaFor(z0);
  return (
    <>
      <View style={{ flex: 1, minHeight: 0, backgroundColor: c.surface2 }}>
        {mapsEnabled ? (
          <>
            <MapView
              ref={map}
              provider={PROVIDER_GOOGLE}
              style={StyleSheet.absoluteFill}
              initialRegion={{ latitude: center.latitude, longitude: center.longitude, latitudeDelta: d0, longitudeDelta: d0 }}
              onRegionChangeComplete={onRegionChangeComplete}
              toolbarEnabled={false}
              showsMyLocationButton={false}
              showsCompass={false}
              moveOnMarkerPress={false}
            >
              {ringKm ? <Circle center={center} radius={ringKm * 1000} strokeColor={alpha(c.primary, 0.6)} strokeWidth={1.5} fillColor={alpha(c.primary, 0.08)} /> : null}
            </MapView>
            <View pointerEvents="none" style={st.pinWrap}>
              <MapPin size={44} color="#ffffff" fill={c.primary} strokeWidth={1.5} />
            </View>
            <Pressable accessibilityLabel={t('useCurrentLocation')} onPress={() => locate()} style={[st.gpsBtn, { backgroundColor: c.surface, borderColor: c.line }]}>
              {gpsBusy ? <ActivityIndicator size="small" color={c.primary} /> : <LocateFixed size={22} color={c.primary} />}
            </Pressable>
          </>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Txt size={14} c="ink2" style={{ marginBottom: 16, textAlign: 'center' }}>{t('mapsUnavailable')}</Txt>
            <Button variant="soft" icon={Crosshair} loading={gpsBusy} onPress={() => locate()}>{t('useCurrentLocation')}</Button>
          </View>
        )}
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, zIndex: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 12, paddingTop: insets.top + 12 }}>
          <Pressable accessibilityLabel={t('back')} onPress={onBack} style={[st.backBtn, { backgroundColor: c.surface, borderColor: c.line }]}><ArrowLeft size={22} color={c.ink} /></Pressable>
          {mapsEnabled && <PlaceSearch onPlace={moveTo} style={{ flex: 1 }} />}
        </View>
      </View>

      <View style={[st.panel, { backgroundColor: c.surface, paddingBottom: 16 + insets.bottom }]}>
        {title ? <Txt w={700} size={12} c="ink2" style={{ letterSpacing: 0.5 }}>{title.toUpperCase()}</Txt> : null}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <MapPin size={20} color={c.primary} style={{ marginTop: 2 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt w={700} numberOfLines={1}>{draft?.label ?? t('setLocation')}</Txt>
            <Txt size={12} c="ink2" numberOfLines={2}>{draft?.full && draft.full !== draft.label ? draft.full : t('dragMapHint')}</Txt>
          </View>
        </View>

        {saving && (
          <>
            <Input value={line} maxLength={120} onChangeText={setLine} placeholder={t('addrLine')} accessibilityLabel={t('addrLine')} />
            <View>
              <Txt w={600} size={12} c="ink2" style={{ marginBottom: 6 }}>{t('addrSaveAs')}</Txt>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {LABELS.map(({ v, key, icon }) => <Chip key={v} icon={icon} active={label === v} onPress={() => setLabel(v)}>{t(key)}</Chip>)}
              </View>
            </View>
            {label === 'other' && <Input value={name} maxLength={40} onChangeText={setName} placeholder={t('addrName')} accessibilityLabel={t('addrName')} />}
          </>
        )}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {edit && (
            <Button variant="outline" size="lg" loading={del.isPending} onPress={() => del.mutate(edit.id, { onSuccess: onBack })}>
              <Trash2 size={18} color={c.danger} />
            </Button>
          )}
          {saving ? (
            <Button grow size="lg" disabled={!ready || (label === 'other' && name.trim().length < 2)} loading={save.isPending} onPress={saveAddress}>{t('saveAddress')}</Button>
          ) : (
            <Button grow size="lg" disabled={!ready} onPress={confirm}>{t('confirmLocation')}</Button>
          )}
        </View>
      </View>
    </>
  );
}

const st = StyleSheet.create({
  searchBox: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, elevation: 1 },
  sugs: { position: 'absolute', left: 0, right: 0, top: 52, borderRadius: 16, borderWidth: 1, overflow: 'hidden', elevation: 12 },
  group: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  groupTitle: { marginBottom: 8, paddingHorizontal: 4, letterSpacing: 0.5 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  circle40: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  backBtn: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  pinWrap: { position: 'absolute', left: '50%', top: '50%', marginLeft: -22, marginTop: -44 },
  gpsBtn: { position: 'absolute', right: 12, bottom: 16, width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  panel: { gap: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 16, elevation: 16, marginTop: -16 },
});
