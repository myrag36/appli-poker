import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shadow } from '../theme';
import { CardBackFace, useCardBack } from './cardBacks';
import { useDealIn } from './Motion';

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
  /** No dealing animation when it appears (it is already animated, or only illustrates). */
  still?: boolean;
}

export function PlayingCard({ card, hidden, width, small, still }: Props) {
  const w = width ?? (small ? 34 : 56);
  const h = Math.round(w * 1.4);
  const radius = Math.max(4, w * 0.1);
  const size = { width: w, height: h, borderRadius: radius };
  const back = useCardBack();
  // Empty slots are part of the table, not dealt.
  const dealt = useDealIn(!still && !!card);

  if (!card) return <View style={[styles.base, size, styles.slot]} />;
  if (hidden) {
    return (
      <Animated.View style={[styles.backSpot, dealt]}>
        <CardBackFace id={back} width={w} height={h} radius={radius} />
      </Animated.View>
    );
  }

  if (card[0] === 'X')
    return (
      <Animated.View style={dealt}>
        <JokerFace width={w} height={h} radius={radius} red={card[1] === 'r'} />
      </Animated.View>
    );

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
    <Animated.View style={[styles.base, size, styles.face, shadow, dealt]}>
      <LinearGradient colors={['#ffffff', '#fbf7ec', '#efe7d3']} style={StyleSheet.absoluteFill} />
      <View style={styles.corner}>
        <Text style={[styles.rank, { color, fontSize: w * 0.32, lineHeight: w * 0.34 }]}>{rank}</Text>
        <Text style={{ color, fontSize: w * 0.24, lineHeight: w * 0.26 }}>{suit}</Text>
      </View>
      {middle}
    </Animated.View>
  );
}

/** A joker ("Xr" red, "Xb" black): a jester's hat with bells and JOKER written in the corners. */
function JokerFace({
  width: w,
  height: h,
  radius,
  red,
}: {
  width: number;
  height: number;
  radius: number;
  red: boolean;
}) {
  const main = red ? colors.red : colors.black;
  const other = red ? colors.black : colors.red;
  const roomy = w >= 34;
  const hat = w * 0.62;
  // Three points of the hat: left, middle and right, leaning out.
  const points = [
    { color: main, rotate: -32, dx: -hat * 0.26 },
    { color: other, rotate: 0, dx: 0 },
    { color: main, rotate: 32, dx: hat * 0.26 },
  ];
  const tipH = hat * 0.5;
  const tipW = hat * 0.2;
  const bell = Math.max(3, w * 0.1);
  return (
    <View style={[styles.base, { width: w, height: h, borderRadius: radius }, styles.face, shadow]}>
      <LinearGradient colors={['#ffffff', '#fbf3df', '#f1e2bd']} style={StyleSheet.absoluteFill} />
      {roomy ? (
        <View style={styles.corner}>
          {'JOKER'.split('').map((l, i) => (
            <Text
              key={i}
              style={[styles.jokerLetter, { color: main, fontSize: w * 0.15, lineHeight: w * 0.16 }]}
            >
              {l}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={[styles.corner, styles.rank, { color: main, fontSize: w * 0.3 }]}>★</Text>
      )}
      <View
        style={[styles.hat, { width: hat, height: hat * 0.8, left: w * (roomy ? 0.3 : 0.2), top: h * 0.3 }]}
      >
        {points.map((p, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              bottom: hat * 0.14,
              left: hat / 2 - tipW + p.dx,
              alignItems: 'center',
              transform: [{ rotate: `${p.rotate}deg` }],
            }}
          >
            <View
              style={[
                styles.bell,
                { width: bell, height: bell, borderRadius: bell / 2, marginBottom: -bell * 0.3 },
              ]}
            />
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: tipW,
                borderRightWidth: tipW,
                borderBottomWidth: tipH,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderBottomColor: p.color,
              }}
            />
          </View>
        ))}
        <View
          style={[
            styles.hatBand,
            { height: hat * 0.16, borderRadius: hat * 0.08, left: hat * 0.12, right: hat * 0.12 },
          ]}
        />
      </View>
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
  jokerLetter: { fontWeight: '900', fontFamily: SERIF },
  hat: { position: 'absolute' },
  bell: { backgroundColor: '#e0b324', borderWidth: 0.5, borderColor: '#9c7a12' },
  hatBand: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: '#e0b324',
    borderWidth: 0.5,
    borderColor: '#9c7a12',
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
