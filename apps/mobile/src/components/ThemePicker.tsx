import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { THEMES, type ThemeId, canChangeTheme, colors, setTheme, themeId } from '../theme';

/** Row of round swatches to switch the look of the whole app. */
export function ThemePicker() {
  if (!canChangeTheme) return null;
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Ambiance</Text>
      <View style={styles.row}>
        {(Object.keys(THEMES) as ThemeId[]).map((id) => {
          const t = THEMES[id];
          const active = id === themeId;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Thème ${t.name}`}
              onPress={() => !active && setTheme(id)}
              style={styles.item}
            >
              <View style={[styles.ring, active && { borderColor: t.colors.gold }]}>
                <LinearGradient colors={t.gradients.felt} style={styles.swatch}>
                  <View style={[styles.dot, { backgroundColor: t.colors.gold }]} />
                </LinearGradient>
              </View>
              <Text style={[styles.name, active && styles.nameActive]}>{t.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 24, alignItems: 'center', gap: 10 },
  title: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', gap: 14 },
  item: { alignItems: 'center', gap: 4, width: 64 },
  ring: { padding: 3, borderRadius: 30, borderWidth: 2, borderColor: 'transparent' },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { color: colors.muted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  nameActive: { color: colors.text, fontWeight: '800' },
});
