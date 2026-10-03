import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 8 }]}>
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
      <View style={styles.bottom}>{bottom}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 10 },
  tableArea: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0, marginBottom: 10 },
  bottom: { gap: 6 },
});
