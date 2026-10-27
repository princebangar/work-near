// Root: providers, fonts, persisted-state hydration, settings/socket bootstrap, maintenance gate, toast, animated intro.
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
// Per-weight imports: only the 5 weights the app uses get bundled (the package index pulls in all 16 files).
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { queryClient } from '@/lib/http';
import { whenHydrated } from '@/store';
import { useColors, useIsDark } from '@/theme';
import { Toaster } from '@/components/ui';
import { AppBootstrap, MaintenanceGate } from '@/components/system';
import { AnimatedSplash } from '@/components/AnimatedSplash';

// Keep the native splash until the animated intro has drawn its first (identical) frame.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
  });
  const [hydrated, setHydrated] = useState(false);
  const [intro, setIntro] = useState(true);
  const c = useColors();
  const dark = useIsDark();
  useEffect(() => { whenHydrated().then(() => setHydrated(true)); }, []);
  useEffect(() => { SystemUI.setBackgroundColorAsync(c.bg).catch(() => undefined); }, [c.bg]);
  const ready = (fontsLoaded || !!fontError) && hydrated;
  const onIntroDone = useCallback(() => setIntro(false), []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          {ready && (
            <>
              <AppBootstrap />
              <MaintenanceGate>
                <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: c.bg } }} />
              </MaintenanceGate>
              <Toaster />
            </>
          )}
          {intro && <AnimatedSplash ready={ready} onDone={onIntroDone} />}
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
