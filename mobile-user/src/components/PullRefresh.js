// Pull-to-refresh for any ScrollView / FlatList: `refreshControl={<PullRefresh />}`. Refetches every query the open
// screen is showing (plus live settings), so each page refreshes its own data without extra wiring.
import { useState } from 'react';
import { RefreshControl } from 'react-native';
import { http, queryClient } from '@/lib/http';
import { useSettings } from '@/store';
import { useColors } from '@/theme';

export function PullRefresh({ onRefresh, ...p }) {
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({ type: 'active' }),
        http.get('/settings').then(useSettings.getState().set).catch(() => undefined),
        onRefresh?.(),
      ]);
    } finally {
      setBusy(false);
    }
  };
  // `p` carries the style/children the ScrollView passes to its refresh control
  return <RefreshControl {...p} refreshing={busy} onRefresh={run} colors={[c.primary]} tintColor={c.primary} progressBackgroundColor={c.surface} />;
}
