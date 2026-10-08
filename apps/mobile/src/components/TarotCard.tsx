import { Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  type Card,
  TAROT_EXCUSE,
  tarotIsOudler,
  tarotIsTrump,
  tarotRankOf,
  tarotSuitOf,
} from '@appli-poker/engine';
import { colors, shadow } from '../theme';
import { CardBackFace, useCardBack } from './cardBacks';
import { lang } from '../i18n';

/** Tarot cards are taller than standard ones. */
export const TAROT_RATIO = 1.6;

const SUIT_SYMBOLS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
/** Chess pieces stand in for the portraits: roi, dame, cavalier, valet. */
const COURT: Record<string, string> = { R: '♚︎', D: '♛︎', C: '♞︎', V: '♟︎' };
/** Corner letters in English: jack, knight, queen, king. */
const EN_RANKS: Record<string, string> = { V: 'J', C: 'C', D: 'Q', R: 'K' };
const SERIF = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, "Times New Roman", serif',
});
const TEXT = '︎';

/** One little picture per trump, from the Petit (a juggler's pawn) to the Monde. */
const MOTIFS = [
  '♙',
  '♪',
  '✿',
  '☂',
  '⚘',
  '♘',
  '⚓',
  '✉',
  '♜',
  '⚜',
  '❀',
  '☘',
  '♖',
  '♫',
  '☁',
  '☾',
  '★',
  '✧',
  '☀',
  '⚖',
  '❂',
].map((m) => m + TEXT);

type Stops = readonly [string, string, ...string[]];
/** Sky behind each trump's picture: dawn for the small ones, through daylight, to a starry night. */
function sky(n: number): Stops {
  if (n === 1 || n === 21) return ['#ffe9a3', '#e8b33c', '#b07d12'];
  if (n <= 5) return ['#ffd6a5', '#f59e7a', '#c4607a'];
  if (n <= 10) return ['#a8e0ff', '#5fb2e8', '#2f7fc1'];
  if (n <= 15) return ['#c8f0c0', '#6fbf73', '#2e7d4f'];
  return ['#8f7ae0', '#4b3aa8', '#221a5e'];
}

interface Props {
  card?: Card;
  hidden?: boolean;
  /** Card width in points; the height follows the tarot ratio. */
  width?: number;
}

export function TarotCard({ card, hidden, width = 50 }: Props) {
  const w = width;
  const h = Math.round(w * TAROT_RATIO);
  const radius = Math.max(4, w * 0.1);
  const size = { width: w, height: h, borderRadius: radius };
  const back = useCardBack();

  if (hidden) {
    return (
      <View style={styles.backSpot}>
        <CardBackFace id={back} width={w} height={h} radius={radius} />
      </View>
    );
  }
  if (!card) return <View style={[styles.base, size, styles.slot]} />;
  if (card === TAROT_EXCUSE) return <Excuse w={w} h={h} radius={radius} />;
  if (tarotIsTrump(card)) return <Trump n={Number(tarotRankOf(card))} w={w} h={h} radius={radius} />;

  const r = tarotRankOf(card);
  const s = tarotSuitOf(card);
  const suit = SUIT_SYMBOLS[s];
  const color = s === 'h' || s === 'd' ? colors.red : colors.black;
  const court = COURT[r];
  return (
    <View style={[styles.base, size, styles.face, shadow]}>
      <LinearGradient colors={['#ffffff', '#fbf7ec', '#efe7d3']} style={StyleSheet.absoluteFill} />
      <View style={styles.corner}>
        <Text
          style={[
            styles.rank,
            { color, fontSize: w * (r.length > 1 ? 0.27 : 0.32), lineHeight: w * 0.34, letterSpacing: -0.5 },
          ]}
        >
          {lang === 'en' ? (EN_RANKS[r] ?? r) : r}
        </Text>
        <Text style={{ color, fontSize: w * 0.24, lineHeight: w * 0.26 }}>{suit}</Text>
      </View>
      {court ? (
        <View
          style={[
            styles.court,
            { left: w * 0.3, right: w * 0.1, top: h * 0.26, bottom: w * 0.1, borderRadius: w * 0.06 },
          ]}
        >
          <Text style={{ color, fontSize: w * 0.42, lineHeight: w * 0.5 }}>{court}</Text>
          <Text style={{ color, fontSize: w * 0.2, lineHeight: w * 0.22 }}>{suit}</Text>
        </View>
      ) : (
        <Text style={[styles.center, { color, fontSize: w * 0.55, bottom: w * 0.1, right: w * 0.12 }]}>
          {suit}
        </Text>
      )}
    </View>
  );
}

/** An atout: its number in a dark badge, readable even when cards overlap, and a little picture. */
function Trump({ n, w, h, radius }: { n: number; w: number; h: number; radius: number }) {
  const oudler = tarotIsOudler(`${n}t`);
  return (
    <View style={[styles.base, { width: w, height: h, borderRadius: radius }, styles.trumpFace, shadow]}>
      <LinearGradient colors={['#fffaf0', '#f4ecd8', '#e6dcc2']} style={StyleSheet.absoluteFill} />
      <View
        style={[
          styles.badge,
          oudler && styles.badgeGold,
          { minWidth: w * 0.4, height: w * 0.34, borderRadius: w * 0.08, paddingHorizontal: w * 0.04 },
        ]}
      >
        <Text
          style={[
            styles.badgeText,
            oudler && styles.badgeTextGold,
            { fontSize: w * (n >= 10 ? 0.27 : 0.3), includeFontPadding: false },
          ]}
        >
          {n}
        </Text>
      </View>
      <View
        style={[
          styles.window,
          oudler && styles.windowGold,
          { left: w * 0.12, right: w * 0.1, top: h * 0.3, bottom: w * 0.12, borderRadius: w * 0.08 },
        ]}
      >
        <LinearGradient colors={sky(n)} style={StyleSheet.absoluteFill} />
        {/* A low sun or moon glow behind the picture. */}
        <View
          style={{
            position: 'absolute',
            width: w * 0.5,
            height: w * 0.5,
            borderRadius: w,
            backgroundColor: 'rgba(255,255,255,0.28)',
          }}
        />
        <Text style={[styles.motif, { fontSize: w * 0.38, lineHeight: w * 0.46 }]}>{MOTIFS[n - 1]}</Text>
        <View style={[styles.ground, { height: h * 0.08 }]} />
      </View>
    </View>
  );
}

/** The Excuse: a jester's star on a purple night. */
function Excuse({ w, h, radius }: { w: number; h: number; radius: number }) {
  return (
    <View style={[styles.base, { width: w, height: h, borderRadius: radius }, styles.excuseFace, shadow]}>
      <LinearGradient colors={['#6b3fa0', '#3f1f6b', '#24103f']} style={StyleSheet.absoluteFill} />
      <View
        style={[
          styles.badge,
          styles.badgeGold,
          { minWidth: w * 0.4, height: w * 0.34, borderRadius: w * 0.08 },
        ]}
      >
        <Text
          style={[styles.badgeText, styles.badgeTextGold, { fontSize: w * 0.26, includeFontPadding: false }]}
        >
          ★{TEXT}
        </Text>
      </View>
      {/* The jester's hat: three bells on points. */}
      <View style={[styles.excuseArt, { top: h * 0.3, bottom: w * 0.12 }]}>
        <View style={styles.hat}>
          {[-1, 0, 1].map((i) => (
            <View
              key={i}
              style={{
                width: w * 0.2,
                height: w * 0.26,
                marginHorizontal: -w * 0.015,
                backgroundColor: i === 0 ? '#e63946' : '#ffc107',
                borderTopLeftRadius: w * 0.2,
                borderTopRightRadius: w * 0.2,
                transform: [{ rotate: `${i * 22}deg` }, { translateY: i === 0 ? -w * 0.05 : 0 }],
              }}
            >
              <View style={[styles.bell, { width: w * 0.09, height: w * 0.09, top: -w * 0.05 }]} />
            </View>
          ))}
        </View>
        <Text style={[styles.excuseStar, { fontSize: w * 0.34, lineHeight: w * 0.4 }]}>★{TEXT}</Text>
        {w >= 40 && <Text style={[styles.excuseName, { fontSize: Math.max(7, w * 0.14) }]}>EXCUSE</Text>}
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
  court: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#c9a227',
    backgroundColor: 'rgba(201, 162, 39, 0.10)',
  },
  trumpFace: { backgroundColor: '#f7f0dc', borderWidth: 1, borderColor: '#b8a776' },
  badge: {
    position: 'absolute',
    top: 3,
    left: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2a5a',
    zIndex: 2,
  },
  badgeGold: { backgroundColor: '#f2c94c', borderWidth: 1, borderColor: '#9a7410' },
  badgeText: { color: '#fff', fontWeight: '900', fontFamily: SERIF },
  badgeTextGold: { color: '#3b2a00' },
  window: {
    position: 'absolute',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(31,42,90,0.55)',
  },
  windowGold: { borderColor: '#9a7410', borderWidth: 1.5 },
  motif: {
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 1 },
  },
  ground: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.18)' },
  excuseFace: { borderWidth: 1, borderColor: '#c9a227' },
  excuseArt: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  hat: { flexDirection: 'row', alignItems: 'flex-end' },
  bell: { position: 'absolute', alignSelf: 'center', borderRadius: 99, backgroundColor: '#fff3c4' },
  excuseStar: { color: '#ffd54f', textAlign: 'center' },
  excuseName: { color: '#ffd54f', fontWeight: '900', letterSpacing: 1 },
});
