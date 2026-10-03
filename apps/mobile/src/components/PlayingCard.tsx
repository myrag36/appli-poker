import { StyleSheet, Text, View } from 'react-native';
import { colors, shadow } from '../theme';

const SUIT_SYMBOLS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

interface Props {
  card?: string;
  hidden?: boolean;
  /** Card width in points; height follows the usual 7:5 card ratio. */
  width?: number;
  small?: boolean;
}

export function PlayingCard({ card, hidden, width, small }: Props) {
  const w = width ?? (small ? 34 : 56);
  const h = Math.round(w * 1.4);
  const size = { width: w, height: h, borderRadius: Math.max(4, w * 0.1) };

  if (!card) return <View style={[styles.base, size, styles.slot]} />;
  if (hidden) {
    return (
      <View style={[styles.base, size, styles.back, shadow]}>
        <View style={[styles.backInner, { borderRadius: size.borderRadius - 2 }]}>
          <Text style={[styles.backMark, { fontSize: w * 0.4 }]}>♠</Text>
        </View>
      </View>
    );
  }

  const rank = card[0] === 'T' ? '10' : card[0];
  const suit = SUIT_SYMBOLS[card[1]];
  const color = card[1] === 'h' || card[1] === 'd' ? colors.red : colors.black;
  return (
    <View style={[styles.base, size, styles.face, shadow]}>
      <View style={styles.corner}>
        <Text style={[styles.rank, { color, fontSize: w * 0.32, lineHeight: w * 0.34 }]}>{rank}</Text>
        <Text style={[styles.cornerSuit, { color, fontSize: w * 0.24, lineHeight: w * 0.26 }]}>{suit}</Text>
      </View>
      <Text style={[styles.center, { color, fontSize: w * 0.55, bottom: w * 0.08, right: w * 0.1 }]}>{suit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { marginHorizontal: 2, overflow: 'hidden' },
  face: { backgroundColor: colors.card, borderWidth: 1, borderColor: '#d9d4c7' },
  slot: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)', borderStyle: 'dashed' },
  back: { backgroundColor: '#fff', padding: 3 },
  backInner: {
    flex: 1,
    backgroundColor: '#9d1c2c',
    borderWidth: 1.5,
    borderColor: '#e8c37a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backMark: { color: 'rgba(232, 195, 122, 0.8)' },
  corner: { position: 'absolute', top: 3, left: 4, alignItems: 'center' },
  rank: { fontWeight: '800' },
  cornerSuit: {},
  center: { position: 'absolute' },
});
