import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

interface Props {
  onBack: () => void;
  backLabel?: string;
  children?: ReactNode;
}

export function TopBar({ onBack, backLabel = '← Accueil', children }: Props) {
  return (
    <View style={styles.bar}>
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={10}>
        <Text style={styles.back}>{backLabel}</Text>
      </Pressable>
      <View style={styles.right}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 34 },
  back: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
