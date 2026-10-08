import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLUMN_MAX_WIDTH, PAGE_MAX_WIDTH, useDesktop } from '../layout';

interface Props {
  top: ReactNode;
  /** Renders the table in whatever space is left between the top bar and the controls. */
  table: (size: { width: number; height: number }) => ReactNode;
  bottom: ReactNode;
}

/** Full-screen game layout that never scrolls: top bar, table filling the middle, controls at the bottom. */
export function GameLayout({ top, table, bottom }: Props) {
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const desktop = useDesktop();

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 8 },
        desktop && styles.screenDesktop,
      ]}
    >
      {top}
      <View
        style={styles.tableArea}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setSize({ width, height });
        }}
      >
        {size && table(size)}
      </View>
      {/* On a computer, buttons and the hand stay a comfortable width instead of spanning the screen. */}
      <View style={[styles.bottom, desktop && styles.bottomDesktop]}>{bottom}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 10 },
  screenDesktop: { width: '100%', maxWidth: PAGE_MAX_WIDTH, alignSelf: 'center', paddingHorizontal: 24 },
  tableArea: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0, marginBottom: 10 },
  bottom: { gap: 6 },
  bottomDesktop: { width: '100%', maxWidth: COLUMN_MAX_WIDTH + 200, alignSelf: 'center' },
});
