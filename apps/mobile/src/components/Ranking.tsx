import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Final standings; players knocked out in the same hand share a place. */
export function Ranking({ entries }: { entries: { name: string; place: number }[] }) {
  const sorted = [...entries].sort((a, b) => a.place - b.place);
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Classement</Text>
      {sorted.map((e) => (
        <View key={e.name} style={[styles.row, e.place === 1 && styles.first]}>
          <Text style={styles.place}>{MEDALS[e.place - 1] ?? `${e.place}e`}</Text>
          <Text style={[styles.name, e.place === 1 && styles.nameFirst]} numberOfLines={1}>
            {e.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 4 },
  title: { color: colors.gold, fontWeight: '800', fontSize: 15, textAlign: 'center', marginBottom: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  first: { backgroundColor: 'rgba(255, 193, 7, 0.15)' },
  place: { width: 30, textAlign: 'center', fontSize: 16, color: colors.muted, fontWeight: '700' },
  name: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  nameFirst: { color: colors.gold, fontWeight: '800' },
});
