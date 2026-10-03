import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export const LEVEL_CHOICES = [5, 10, 15, 20, 30];

export function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

/** Normal game (fixed blinds) or tournament, where the blinds go up every few minutes. */
export function LevelPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <Pill label="Partie normale" active={value === null} onPress={() => onChange(null)} />
        <Pill label="🏆 Tournoi" active={value !== null} onPress={() => onChange(value ?? 10)} />
      </View>
      {value !== null && (
        <>
          <Text style={styles.hint}>Les blindes augmentent toutes les :</Text>
          <View style={styles.row}>
            {LEVEL_CHOICES.map((m) => (
              <Pill key={m} label={`${m} min`} active={value === m} onPress={() => onChange(m)} />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8, marginVertical: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  pillActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  pillText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  pillTextActive: { color: colors.onGold },
  hint: { color: colors.muted, fontSize: 13 },
});
