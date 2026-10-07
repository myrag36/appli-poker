import { Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shadow } from '../theme';
import { CardBackFace, useCardBack } from './cardBacks';

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
  const back = useCardBack();

  if (!card) return <View style={[styles.base, size, styles.slot]} />;
  if (hidden) {
    return (
      <View style={styles.backSpot}>
        <CardBackFace id={back} width={w} height={h} radius={radius} />
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
  backSpot: { marginHorizontal: 2 },
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
