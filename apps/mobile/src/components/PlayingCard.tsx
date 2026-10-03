import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const SUIT_SYMBOLS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

interface Props {
  card?: string;
  hidden?: boolean;
  small?: boolean;
}

export function PlayingCard({ card, hidden, small }: Props) {
  const size = small ? styles.small : styles.large;
  if (!card) return <View style={[styles.base, size, styles.slot]} />;
  if (hidden) return <View style={[styles.base, size, styles.back]} />;
  const rank = card[0] === 'T' ? '10' : card[0];
  const suit = card[1];
  const color = suit === 'h' || suit === 'd' ? colors.red : colors.black;
  return (
    <View style={[styles.base, size]}>
      <Text style={[styles.rank, small && styles.rankSmall, { color }]}>{rank}</Text>
      <Text style={[styles.suit, small && styles.suitSmall, { color }]}>{SUIT_SYMBOLS[suit]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  large: { width: 52, height: 74 },
  small: { width: 34, height: 48 },
  slot: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.25)', borderStyle: 'dashed' },
  back: { backgroundColor: '#1d3557', borderColor: '#f1faee', borderWidth: 2 },
  rank: { fontSize: 22, fontWeight: '700' },
  rankSmall: { fontSize: 15 },
  suit: { fontSize: 22 },
  suitSmall: { fontSize: 14 },
});
