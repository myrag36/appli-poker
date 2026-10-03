import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function Panel({ title, children, compact }: { title?: string; children?: ReactNode; compact?: boolean }) {
  return (
    <View style={[styles.panel, compact && styles.compact]}>
      {title && <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>}
      {children}
    </View>
  );
}

export function PanelText({ children }: { children: ReactNode }) {
  return <Text style={styles.text}>{children}</Text>;
}

const styles = StyleSheet.create({
  panel: { marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: colors.feltDark, gap: 6 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  compact: { marginTop: 0, padding: 10, gap: 6 },
  titleCompact: { fontSize: 15 },
  text: { color: colors.muted, textAlign: 'center' },
});
