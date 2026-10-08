import { Platform, StyleSheet, Text, View } from 'react-native';
import type { UnoVariant } from '@appli-poker/engine';
import { PlayingCard } from './PlayingCard';
import { shadow } from '../theme';

/** Card colors of the Uno deck, and the black of the wild cards. */
export const UNO_PAINT: Record<string, string> = {
  r: '#e0312f',
  y: '#f6b81c',
  g: '#2f9e44',
  b: '#1f6fd1',
  w: '#1d1d22',
};

const HEAVY = Platform.select({
  ios: 'Avenir Next',
  android: 'sans-serif-condensed',
  default: '"Arial Black", "Helvetica Neue", Arial, sans-serif',
});

/** The big symbol drawn in the middle of a card, and the small one in its corners. */
function symbolText(s: string): string {
  switch (s) {
    case 'S':
      return '⊘';
    case 'R':
      return '⇄';
    case 'D':
      return '+2';
    case 'F':
      return '+4';
    default:
      return s;
  }
}

/** Four colored quarters, the mark of the wild cards. */
function Quarters({ size }: { size: number }) {
  const q = size / 2;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', flexWrap: 'wrap' }}>
      {['r', 'b', 'y', 'g'].map((c) => (
        <View key={c} style={{ width: q, height: q, backgroundColor: UNO_PAINT[c] }} />
      ))}
    </View>
  );
}

interface Props {
  /** "r5a", "gDb", "wWc"…; nothing draws the back of a card. */
  card?: string;
  width?: number;
  hidden?: boolean;
}

/** A Uno card drawn with plain views: colored face, tilted white oval, big symbol. */
export function UnoCard({ card, width = 56, hidden }: Props) {
  const w = width;
  const h = Math.round(w * 1.4);
  const radius = Math.max(4, w * 0.1);
  const border = Math.max(2, w * 0.06);
  const oval = w * 0.74;

  if (hidden || !card) {
    return (
      <View style={[styles.base, shadow, { width: w, height: h, borderRadius: radius, padding: border }]}>
        <View style={[styles.inner, { borderRadius: radius * 0.7, backgroundColor: '#17171c' }]}>
          <View
            style={[
              styles.oval,
              {
                width: oval,
                height: oval,
                borderRadius: oval / 2,
                backgroundColor: UNO_PAINT.r,
                transform: [{ rotate: '-28deg' }, { scaleY: 1.45 }],
              },
            ]}
          />
          <View style={styles.backMark}>
            <Quarters size={w * 0.36} />
          </View>
        </View>
      </View>
    );
  }

  const color = card[0];
  const s = card[1];
  const paint = UNO_PAINT[color];
  const wild = color === 'w';
  const big = symbolText(s);
  const long = big.length > 1;
  const roomy = w >= 30;
  const underline = s === '6' || s === '9';
  const corner = { fontSize: w * 0.22, lineHeight: w * 0.26 };

  return (
    <View style={[styles.base, shadow, { width: w, height: h, borderRadius: radius, padding: border }]}>
      <View style={[styles.inner, { borderRadius: radius * 0.7, backgroundColor: paint }]}>
        <View
          style={[
            styles.oval,
            {
              width: oval,
              height: oval,
              borderRadius: oval / 2,
              backgroundColor: wild ? '#ffffff' : '#fffdf6',
              transform: [{ rotate: '-28deg' }, { scaleY: 1.45 }],
            },
          ]}
        />
        {wild && s === 'W' ? (
          <Quarters size={w * 0.5} />
        ) : wild ? (
          <View style={styles.center}>
            <Quarters size={w * 0.44} />
            <Text
              style={[
                styles.big,
                styles.onQuarters,
                { fontFamily: HEAVY, fontSize: w * 0.34, lineHeight: w * 0.4 },
              ]}
            >
              {big}
            </Text>
          </View>
        ) : (
          <Text
            style={[
              styles.big,
              {
                color: paint,
                fontFamily: HEAVY,
                fontSize: long ? w * 0.42 : s === 'S' || s === 'R' ? w * 0.5 : w * 0.58,
                lineHeight: w * 0.66,
                textDecorationLine: underline ? 'underline' : 'none',
              },
            ]}
          >
            {big}
          </Text>
        )}
        {roomy && (
          <>
            <Text style={[styles.corner, styles.topLeft, corner, { fontFamily: HEAVY }]}>
              {wild && s === 'W' ? '★' : big}
            </Text>
            <Text style={[styles.corner, styles.bottomRight, corner, { fontFamily: HEAVY }]}>
              {wild && s === 'W' ? '★' : big}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

/** One card of either game: a drawn Uno card, or a standard playing card for 8 américain. */
export function GameCard({
  variant,
  card,
  width,
  hidden,
}: {
  variant: UnoVariant;
  card?: string;
  width: number;
  hidden?: boolean;
}) {
  if (variant === 'uno') return <UnoCard card={card} width={width} hidden={hidden} />;
  return <PlayingCard card={card ?? 'As'} width={width} hidden={hidden || !card} />;
}

const styles = StyleSheet.create({
  base: { marginHorizontal: 2, backgroundColor: '#fbfbf8', overflow: 'hidden' },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  oval: { position: 'absolute' },
  center: { alignItems: 'center', justifyContent: 'center' },
  big: {
    fontWeight: '900',
    fontStyle: 'italic',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0.5,
  },
  onQuarters: {
    position: 'absolute',
    color: '#ffffff',
    textShadowColor: '#000',
    textShadowOffset: { width: 1.5, height: 1.5 },
    textShadowRadius: 1,
  },
  corner: {
    position: 'absolute',
    color: '#ffffff',
    fontWeight: '900',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 0.5,
  },
  topLeft: { top: 1, left: 3 },
  bottomRight: { bottom: 1, right: 3, transform: [{ rotate: '180deg' }] },
  backMark: { transform: [{ rotate: '-28deg' }] },
});
