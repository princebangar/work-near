import { useCallback } from 'react';
import { setStatusBarStyle } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/store';

// Screens with a green header currently focused. Switching tabs focuses the new screen before the old one blurs,
// so a plain "reset on blur" turned the icons dark again on the next green screen — only reset when none is left.
let lightScreens = 0;

/** White status-bar icons while a screen with a green header is focused (web: theme-color = brand green). */
export function useLightStatusBar() {
  useFocusEffect(
    useCallback(() => {
      lightScreens += 1;
      setStatusBarStyle('light');
      return () => {
        lightScreens = Math.max(0, lightScreens - 1);
        if (!lightScreens) setStatusBarStyle(useTheme.getState().mode === 'dark' ? 'light' : 'dark');
      };
    }, []),
  );
}
