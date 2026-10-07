import { type ReactNode, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { REWARDS } from '@appli-poker/engine';
import { shadow } from '../theme';

type Stops = readonly [string, string, ...string[]];

/** Every card back id, in unlock order. */
export const CARD_BACK_IDS = REWARDS.filter((r) => r.kind === 'cardBack').map((r) => r.id);

// ---- The chosen card back, kept in the browser like the theme. ----

const KEY = 'appli-poker:cardBack';
const listeners = new Set<() => void>();

function savedCardBack(): string {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const id = localStorage.getItem(KEY);
      if (id && CARD_BACK_IDS.includes(id)) return id;
    }
  } catch {
    // Storage can be blocked; fall back to the classic back.
  }
  return 'classic';
}

let current = savedCardBack();

/** Changes the card back drawn on every hidden card. Unknown ids are ignored. */
export function setCardBack(id: string) {
  if (!CARD_BACK_IDS.includes(id) || id === current) return;
  current = id;
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.setItem(KEY, id);
  } catch {
    // Nothing to do if storage is blocked; the choice lasts until the app closes.
  }
  listeners.forEach((l) => l());
}

export function getCardBack() {
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The card back currently chosen; re-renders when it changes. */
export function useCardBack() {
  return useSyncExternalStore(subscribe, getCardBack, getCardBack);
}

// ---- Drawing ----

/** Small deterministic random generator, so stars stay put between renders. */
function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface BackLook {
  /** The outer margin around the printed area. */
  edge: string;
  fill: Stops;
  /** Thin line around the printed area and the emblem. */
  line: string;
  /** Repeated mark printed all over the back. */
  mark: string;
  markColor: string;
  emblem: string;
  emblemFill: string;
  emblemColor: string;
  /** Extra layer drawn between the pattern and the emblem. */
  extra?: (w: number, h: number) => ReactNode;
  glow?: string;
}

const LOOKS: Record<string, BackLook> = {
  classic: {
    edge: '#fdf8ec',
    fill: ['#c21f35', '#8a0f22', '#5c0716'],
    line: '#e8c37a',
    mark: '◆',
    markColor: 'rgba(232, 195, 122, 0.28)',
    emblem: '♠',
    emblemFill: '#7a0c1b',
    emblemColor: '#f3d58c',
  },
  royal: {
    edge: '#f4f6fb',
    fill: ['#3b6fd8', '#1b3f99', '#0c1f5c'],
    line: '#d9e2f5',
    mark: '⚜',
    markColor: 'rgba(220, 230, 255, 0.22)',
    emblem: '♛',
    emblemFill: '#122d78',
    emblemColor: '#f2f5ff',
  },
  emerald: {
    edge: '#f7f3e3',
    fill: ['#1fae6c', '#0b6e42', '#053d24'],
    line: '#e3c56b',
    mark: '♣',
    markColor: 'rgba(227, 197, 107, 0.25)',
    emblem: '♣',
    emblemFill: '#06502f',
    emblemColor: '#f6dc8a',
  },
  noir: {
    edge: '#111111',
    fill: ['#2b2b2b', '#121212', '#000000'],
    line: '#d4af37',
    mark: '◇',
    markColor: 'rgba(212, 175, 55, 0.22)',
    emblem: '♠',
    emblemFill: '#000000',
    emblemColor: '#f0cf62',
    extra: (w) => <DecoRays w={w} />,
  },
  neon: {
    edge: '#0a0518',
    fill: ['#1a0b3d', '#0d0726', '#05020f'],
    line: '#00f0ff',
    mark: '✚',
    markColor: 'rgba(255, 60, 172, 0.28)',
    emblem: '♦',
    emblemFill: '#120632',
    emblemColor: '#ff3cac',
    glow: '#00f0ff',
  },
  galaxy: {
    edge: '#1a0f33',
    fill: ['#4b1d8f', '#24104f', '#0b0420'],
    line: '#b79cff',
    mark: '',
    markColor: 'transparent',
    emblem: '🪐',
    emblemFill: 'rgba(20, 8, 50, 0.85)',
    emblemColor: '#ffffff',
    extra: (w, h) => <Stars w={w} h={h} />,
  },
  dragon: {
    edge: '#1c0505',
    fill: ['#b3121f', '#6e0610', '#2a0105'],
    line: '#f2c14e',
    mark: '︽',
    markColor: 'rgba(242, 193, 78, 0.22)',
    emblem: '🐉',
    emblemFill: '#3a0208',
    emblemColor: '#ffffff',
    glow: '#ffb02e',
  },
};

/** Thin gold lines fanning out from the center, art deco style. */
function DecoRays({ w }: { w: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
      {[0, 30, 60, 90, 120, 150].map((a) => (
        <View
          key={a}
          style={{
            position: 'absolute',
            width: w * 2,
            height: Math.max(0.5, w * 0.012),
            backgroundColor: 'rgba(212, 175, 55, 0.35)',
            transform: [{ rotate: `${a}deg` }],
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          width: w * 0.68,
          height: w * 0.68,
          borderRadius: w * 0.34,
          borderWidth: Math.max(0.5, w * 0.015),
          borderColor: 'rgba(212, 175, 55, 0.6)',
        }}
      />
    </View>
  );
}

function Stars({ w, h }: { w: number; h: number }) {
  const rnd = random(7);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View
        style={{
          position: 'absolute',
          left: -w * 0.2,
          top: h * 0.12,
          width: w * 0.9,
          height: w * 0.6,
          borderRadius: w,
          backgroundColor: 'rgba(255, 90, 200, 0.18)',
          transform: [{ rotate: '-25deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: -w * 0.25,
          bottom: h * 0.1,
          width: w * 0.9,
          height: w * 0.55,
          borderRadius: w,
          backgroundColor: 'rgba(80, 160, 255, 0.18)',
          transform: [{ rotate: '-25deg' }],
        }}
      />
      {Array.from({ length: 26 }, (_, i) => {
        const s = Math.max(1.5, w * (0.015 + rnd() * 0.025));
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: w * (0.04 + rnd() * 0.9),
              top: h * (0.03 + rnd() * 0.93),
              width: s,
              height: s,
              borderRadius: s,
              backgroundColor: i % 5 === 0 ? '#ffe6a8' : '#ffffff',
              opacity: 0.5 + rnd() * 0.5,
            }}
          />
        );
      })}
      {[
        [0.18, 0.15],
        [0.78, 0.22],
        [0.22, 0.8],
        [0.8, 0.86],
      ].map(([x, y], i) => (
        <Text
          key={i}
          style={[
            styles.twinkle,
            { left: x * w - w * 0.06, top: y * h - w * 0.08, fontSize: w * (i % 2 ? 0.11 : 0.14) },
          ]}
        >
          ✦
        </Text>
      ))}
    </View>
  );
}

/** The back of a playing card, in one of the unlockable designs. */
export function CardBackFace({
  id,
  width,
  height,
  radius,
}: {
  id: string;
  width: number;
  height: number;
  radius: number;
}) {
  const look = LOOKS[id] ?? LOOKS.classic;
  const w = width;
  const pad = Math.max(2, Math.round(w * 0.055));
  const line = Math.max(1, w * 0.025);
  const emblem = w * 0.5;
  const glow = look.glow ? `0 0 ${Math.max(2, w * 0.08)}px ${look.glow}` : undefined;
  return (
    <View
      style={[
        styles.back,
        shadow,
        { width, height, borderRadius: radius, padding: pad, backgroundColor: look.edge },
      ]}
    >
      <LinearGradient
        colors={look.fill}
        style={[
          styles.inner,
          { borderRadius: Math.max(2, radius - pad / 2), borderWidth: line, borderColor: look.line },
          glow ? { boxShadow: `${glow}, inset ${glow}` } : null,
        ]}
      >
        {look.mark !== '' && (
          <View style={styles.lattice}>
            {Array.from({ length: 12 }, (_, i) => (
              <Text key={i} style={[styles.latticeMark, { color: look.markColor, fontSize: w * 0.18 }]}>
                {look.mark}
              </Text>
            ))}
          </View>
        )}
        {look.extra?.(w - pad * 2, height - pad * 2)}
        <View
          style={[
            styles.emblem,
            {
              width: emblem,
              height: emblem,
              borderRadius: emblem / 2,
              borderWidth: line,
              borderColor: look.line,
              backgroundColor: look.emblemFill,
            },
            glow ? { boxShadow: glow } : null,
          ]}
        >
          <Text
            style={[
              { color: look.emblemColor, fontSize: w * (look.emblemColor === '#ffffff' ? 0.26 : 0.28) },
              look.glow ? { textShadowColor: look.emblemColor, textShadowRadius: w * 0.08 } : null,
            ]}
          >
            {look.emblem}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

/** A card back on its own, sized for a picker tile. */
export function CardBackPreview({ id, width }: { id: string; width: number }) {
  return (
    <CardBackFace id={id} width={width} height={Math.round(width * 1.4)} radius={Math.max(4, width * 0.1)} />
  );
}

const styles = StyleSheet.create({
  back: { overflow: 'hidden' },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
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
  latticeMark: { width: '33%', textAlign: 'center' },
  emblem: { alignItems: 'center', justifyContent: 'center' },
  twinkle: {
    position: 'absolute',
    color: '#fff',
    textShadowColor: 'rgba(200, 170, 255, 1)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 0 },
  },
});
