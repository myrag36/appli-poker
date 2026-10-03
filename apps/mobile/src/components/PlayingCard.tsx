import { Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shadow } from '../theme';

const SUIT_SYMBOLS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
/** Chess pieces stand in for the portraits on court cards. */
const COURT: Record<string, string> = { K: '♚︎', Q: '♛︎', J: '♞︎' };
const SERIF = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, "Times New Roman", serif',
});

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
  const radius = Math.max(4, w * 0.1);
  const size = { width: w, height: h, borderRadius: radius };

  if (!card) return <View style={[styles.base, size, styles.slot]} />;
  if (hidden) {
    return (
      <View style={[styles.base, size, styles.back, shadow]}>
        <LinearGradient
          colors={['#c21f35', '#8a0f22', '#5c0716']}
          style={[styles.backInner, { borderRadius: radius - 2 }]}
        >
          <View style={styles.lattice}>
            {Array.from({ length: 12 }, (_, i) => (
              <Text key={i} style={[styles.latticeMark, { fontSize: w * 0.18 }]}>
                ◆
              </Text>
            ))}
          </View>
          <View style={[styles.emblem, { width: w * 0.5, height: w * 0.5, borderRadius: w * 0.25 }]}>
            <Text style={[styles.backMark, { fontSize: w * 0.28 }]}>♠</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  const r = card[0];
  const rank = r === 'T' ? '10' : r;
  const suit = SUIT_SYMBOLS[card[1]];
  const color = card[1] === 'h' || card[1] === 'd' ? colors.red : colors.black;
  const roomy = w >= 34;

  let middle;
  if (roomy && COURT[r]) {
    middle = (
      <View style={[styles.court, { left: w * 0.3, right: w * 0.12, top: w * 0.3, bottom: w * 0.12 }]}>
        <Text style={[{ color, fontSize: w * 0.42 }]}>{COURT[r]}</Text>
        <Text style={{ color, fontSize: w * 0.2, lineHeight: w * 0.22 }}>{suit}</Text>
      </View>
    );
  } else if (roomy && r === 'A') {
    middle = (
      <Text
        style={[styles.center, styles.ace, { color, fontSize: w * 0.62, bottom: w * 0.12, right: w * 0.14 }]}
      >
        {suit}
      </Text>
    );
  } else {
    middle = (
      <Text style={[styles.center, { color, fontSize: w * 0.55, bottom: w * 0.08, right: w * 0.1 }]}>
        {suit}
      </Text>
    );
  }

  return (
    <View style={[styles.base, size, styles.face, shadow]}>
      <LinearGradient colors={['#ffffff', '#fbf7ec', '#efe7d3']} style={StyleSheet.absoluteFill} />
      <View style={styles.corner}>
        <Text style={[styles.rank, { color, fontSize: w * 0.32, lineHeight: w * 0.34 }]}>{rank}</Text>
        <Text style={{ color, fontSize: w * 0.24, lineHeight: w * 0.26 }}>{suit}</Text>
      </View>
      {middle}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { marginHorizontal: 2, overflow: 'hidden' },
  face: { backgroundColor: colors.card, borderWidth: 1, borderColor: '#d9d0b8' },
  slot: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)', borderStyle: 'dashed' },
  back: { backgroundColor: '#fdf8ec', padding: 3 },
  backInner: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e8c37a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  lattice: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    alignContent: 'space-around',
  },
  latticeMark: { color: 'rgba(232, 195, 122, 0.28)', width: '33%', textAlign: 'center' },
  emblem: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#e8c37a',
    backgroundColor: '#7a0c1b',
  },
  backMark: { color: '#f3d58c' },
  corner: { position: 'absolute', top: 3, left: 4, alignItems: 'center' },
  rank: { fontWeight: '800', fontFamily: SERIF },
  center: { position: 'absolute' },
  ace: {
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 1 },
  },
  court: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#c9a227',
    borderRadius: 3,
    backgroundColor: 'rgba(201, 162, 39, 0.10)',
  },
});
