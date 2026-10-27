// Fixed band behind the status bar for screens whose green header scrolls away. It draws the header's own background
// at the header's full size and shows only its top `insets.top` px — at scroll 0 it is pixel-identical to the header,
// and once the page scrolls the cards never slide under the status bar (no white flash, white icons stay readable).
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** `height`: the header's measured height; `children`: the same background the header draws (gradient, swooshes). */
export function HeaderScrim({ height, children }) {
  const insets = useSafeAreaInsets();
  if (!height || !insets.top) return null;
  return (
    <View pointerEvents="none" style={[s.wrap, { height: insets.top }]}>
      <View style={{ height }}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', zIndex: 20, elevation: 20 },
});
