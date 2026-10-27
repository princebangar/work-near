import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createJSONStorage } from 'zustand/middleware';

// Web used localStorage. Native: tokens (the auth store) in SecureStore, everything else in AsyncStorage.
export const secureStorage = createJSONStorage(() => ({
  getItem: (k) => SecureStore.getItemAsync(k).catch(() => null),
  setItem: (k, v) => SecureStore.setItemAsync(k, v).catch(() => undefined),
  removeItem: (k) => SecureStore.deleteItemAsync(k).catch(() => undefined),
}));

export const appStorage = createJSONStorage(() => AsyncStorage);

/** Small key/value helpers for non-store values (e.g. the last registered push token). */
export const kv = {
  get: (k) => AsyncStorage.getItem(k).catch(() => null),
  set: (k, v) => (v == null ? AsyncStorage.removeItem(k) : AsyncStorage.setItem(k, v)).catch(() => undefined),
};
