import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMuted } from '../feedback';
import { colors } from '../theme';

interface Props {
  onBack: () => void;
  backLabel?: string;
  /** Spoken label for the back button, useful when it shows only an arrow. */
  backHint?: string;
  children?: ReactNode;
}

export function TopBar({ onBack, backLabel = '← Accueil', backHint, children }: Props) {
  const [muted, setMuted] = useMuted();
  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        <Pressable accessibilityRole="button" accessibilityLabel={backHint} onPress={onBack} hitSlop={10}>
          <Text style={[styles.back, backLabel.length === 1 && styles.arrow]}>{backLabel}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={muted ? 'Activer le son' : 'Couper le son'}
          onPress={() => setMuted(!muted)}
          hitSlop={8}
          style={styles.icon}
        >
          <Text style={styles.iconText}>{muted ? '🔇' : '🔊'}</Text>
        </Pressable>
      </View>
      <View style={styles.right}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 34,
    zIndex: 10,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  arrow: { fontSize: 24, lineHeight: 28, paddingHorizontal: 4 },
  icon: { padding: 2 },
  iconText: { fontSize: 18 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
