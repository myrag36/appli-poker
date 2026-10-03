import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function Panel({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <View style={styles.panel}>
      {title && <Text style={styles.title}>{title}</Text>}
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
  text: { color: colors.muted, textAlign: 'center' },
});
