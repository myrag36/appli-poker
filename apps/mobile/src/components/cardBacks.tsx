import { Fragment, type ReactNode, useSyncExternalStore } from 'react';
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
  // ---- Shop card backs ----
  sakura: {
    edge: '#fff4f8',
    fill: ['#ffd1e3', '#f59cc0', '#d0588d'],
    line: '#ffffff',
    mark: '❀',
    markColor: 'rgba(255, 255, 255, 0.4)',
    emblem: '🌸',
    emblemFill: '#ffe8f1',
    emblemColor: '#ffffff',
    extra: (w, h) => <FallingPetals w={w} h={h} />,
  },
  retro: {
    edge: '#f6e6c4',
    fill: ['#f6e6c4', '#f6e6c4'],
    line: '#5a2a12',
    mark: '',
    markColor: 'transparent',
    emblem: '✿',
    emblemFill: '#5a2a12',
    emblemColor: '#f6c34a',
    extra: (w, h) => <RetroStripes w={w} h={h} />,
  },
  carbon: {
    edge: '#1b1b1d',
    fill: ['#2e2f33', '#18191b', '#0b0b0c'],
    line: '#e0233f',
    mark: '',
    markColor: 'transparent',
    emblem: '♠',
    emblemFill: '#0d0d0f',
    emblemColor: '#e8ebf0',
    extra: (w, h) => <CarbonWeave w={w} h={h} />,
  },
  circuit: {
    edge: '#06180d',
    fill: ['#0f5a2e', '#0a3d20', '#04200f'],
    line: '#5cff9d',
    mark: '',
    markColor: 'transparent',
    emblem: '♦',
    emblemFill: '#04140a',
    emblemColor: '#5cff9d',
    glow: '#2dff7a',
    extra: (w, h) => <Traces w={w} h={h} />,
  },
  goldbar: {
    edge: '#8a5d00',
    fill: ['#fff4c2', '#f2c24b', '#b8860b', '#ffe17a', '#9a6a10'],
    line: '#fff8dc',
    mark: '❖',
    markColor: 'rgba(110, 70, 0, 0.25)',
    emblem: '♛',
    emblemFill: '#a87400',
    emblemColor: '#fff4c2',
    glow: '#ffd700',
    extra: (w, h) => <GoldShine w={w} h={h} />,
  },
  // ---- Earned by playing ----
  boussole: {
    edge: '#f3ead2',
    fill: ['#1d5c73', '#103f52', '#082431'],
    line: '#e3c56b',
    mark: '',
    markColor: 'transparent',
    emblem: '✵',
    emblemFill: '#0a2d3b',
    emblemColor: '#f6dc8a',
    extra: (w, h) => <CompassRose w={w} h={h} />,
  },
  phoenix: {
    edge: '#2a0a05',
    fill: ['#ffb347', '#e8541e', '#9b1b1b', '#3d0a2a'],
    line: '#ffe08a',
    mark: '',
    markColor: 'transparent',
    emblem: '🔥',
    emblemFill: '#4a0b14',
    emblemColor: '#ffffff',
    glow: '#ff8a1e',
    extra: (w, h) => <Feathers w={w} h={h} />,
  },
  medaille: {
    edge: '#0b1d3a',
    fill: ['#1f4fa3', '#14336e', '#0a1a3d'],
    line: '#ffd166',
    mark: '★',
    markColor: 'rgba(255, 209, 102, 0.2)',
    emblem: '🏅',
    emblemFill: '#0b1d3a',
    emblemColor: '#ffffff',
    glow: '#ffd166',
    extra: (w) => <SunRays w={w} color="rgba(255, 209, 102, 0.3)" />,
  },
  // ---- More shop card backs ----
  tartan: {
    edge: '#f4efe4',
    fill: ['#a31621', '#8a1220', '#6a0d18'],
    line: '#1b4332',
    mark: '',
    markColor: 'transparent',
    emblem: '♣',
    emblemFill: '#1b4332',
    emblemColor: '#ffd166',
    extra: (w, h) => <Tartan w={w} h={h} />,
  },
  vagues: {
    edge: '#f2f7fb',
    fill: ['#2e86c1', '#1b5f8f', '#0e3a5a'],
    line: '#f2f7fb',
    mark: '',
    markColor: 'transparent',
    emblem: '🌊',
    emblemFill: '#0e3a5a',
    emblemColor: '#ffffff',
    extra: (w, h) => <Waves w={w} h={h} />,
  },
  vitrail: {
    edge: '#1a1a1a',
    fill: ['#2b2b2b', '#1a1a1a'],
    line: '#c9a227',
    mark: '',
    markColor: 'transparent',
    emblem: '✠',
    emblemFill: '#1a1a1a',
    emblemColor: '#ffd166',
    glow: '#7ab8ff',
    extra: (w, h) => <StainedGlass w={w} h={h} />,
  },
  araignee: {
    edge: '#140a1f',
    fill: ['#ff8c1a', '#8a3a0a', '#2a0f3d'],
    line: '#f2f2f2',
    mark: '',
    markColor: 'transparent',
    emblem: '🕷️',
    emblemFill: '#140a1f',
    emblemColor: '#ffffff',
    extra: (w, h) => <Web w={w} h={h} />,
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

/** Loose cherry blossom petals drifting across the back. */
function FallingPetals({ w, h }: { w: number; h: number }) {
  const rnd = random(13);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 9 }, (_, i) => {
        const s = w * (0.07 + rnd() * 0.05);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: w * (0.02 + rnd() * 0.88),
              top: h * (0.02 + rnd() * 0.92),
              width: s,
              height: s * 0.6,
              borderTopLeftRadius: s,
              borderBottomRightRadius: s,
              backgroundColor: i % 3 ? '#ffe4ef' : '#ffffff',
              opacity: 0.85,
              transform: [{ rotate: `${Math.round(rnd() * 180)}deg` }],
            }}
          />
        );
      })}
    </View>
  );
}

/** Seventies stripes in orange and brown, bending around the emblem. */
function RetroStripes({ w, h }: { w: number; h: number }) {
  const stripes = ['#f6c34a', '#f0902e', '#d9562b', '#8a3a1a', '#5a2a12'];
  const band = w * 0.075;
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
      {stripes.map((c, i) => {
        const d = w * 0.62 + (stripes.length - i) * band * 2;
        return (
          <View
            key={c}
            style={{
              position: 'absolute',
              width: d,
              height: d,
              borderRadius: d / 2,
              borderWidth: band,
              borderColor: c,
            }}
          />
        );
      })}
      {[-1, 1].map((side) => (
        <View
          key={side}
          style={{
            position: 'absolute',
            [side < 0 ? 'top' : 'bottom']: h * 0.04,
            flexDirection: 'row',
            gap: band * 0.35,
          }}
        >
          {stripes.map((c) => (
            <View
              key={c}
              style={{ width: band * 0.6, height: band * 0.6, borderRadius: band, backgroundColor: c }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/** A woven carbon fiber pattern: small tiles shaded alternately across and down. */
function CarbonWeave({ w, h }: { w: number; h: number }) {
  const cell = Math.max(3, w * 0.085);
  const cols = Math.ceil(w / cell) + 1;
  const rows = Math.ceil(h / cell) + 1;
  const light = 'rgba(255,255,255,0.13)';
  const dark = 'rgba(0,0,0,0.35)';
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const across = (r + c) % 2 === 0;
          return (
            <LinearGradient
              key={`${r}-${c}`}
              colors={[light, dark]}
              start={across ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }}
              end={across ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
              style={{
                position: 'absolute',
                left: c * cell,
                top: r * cell,
                width: cell - 0.5,
                height: cell - 0.5,
              }}
            />
          );
        }),
      )}
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/** Printed circuit traces ending on little gold pads. */
function Traces({ w, h }: { w: number; h: number }) {
  const t = Math.max(0.75, w * 0.02);
  const pad = Math.max(2, w * 0.055);
  const trace = 'rgba(92, 255, 157, 0.55)';
  // Each trace is a horizontal run then a vertical run, from the edge toward the emblem.
  const runs = [
    { x: 0, y: 0.12, len: 0.4, down: 0.18 },
    { x: 0.55, y: 0.08, len: 0.45, down: 0.14 },
    { x: 0, y: 0.88, len: 0.35, down: -0.16 },
    { x: 0.6, y: 0.92, len: 0.4, down: -0.2 },
    { x: 0, y: 0.5, len: 0.2, down: 0 },
    { x: 0.8, y: 0.5, len: 0.2, down: 0 },
    { x: 0.1, y: 0.3, len: 0.0, down: 0.2 },
    { x: 0.9, y: 0.55, len: 0.0, down: 0.25 },
  ];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {runs.map((r, i) => {
        // Runs from the left edge bend at their right end; runs reaching the right edge at their left end.
        const bendX = r.x < 0.5 ? r.x + r.len : r.x;
        return (
          <Fragment key={i}>
            {r.len > 0 && (
              <View
                style={{
                  position: 'absolute',
                  left: w * r.x,
                  top: h * r.y - t / 2,
                  width: w * r.len,
                  height: t,
                  backgroundColor: trace,
                }}
              />
            )}
            {r.down !== 0 && (
              <View
                style={{
                  position: 'absolute',
                  left: w * bendX - t / 2,
                  top: h * Math.min(r.y, r.y + r.down),
                  width: t,
                  height: h * Math.abs(r.down),
                  backgroundColor: trace,
                }}
              />
            )}
            <View
              style={[
                styles.pad,
                {
                  left: w * bendX - pad / 2,
                  top: h * (r.y + r.down) - pad / 2,
                  width: pad,
                  height: pad,
                  borderRadius: pad / 2,
                  borderWidth: Math.max(0.75, pad * 0.25),
                },
              ]}
            />
          </Fragment>
        );
      })}
      {[0.22, 0.78].map((y) => (
        <View
          key={y}
          style={[
            styles.chip,
            {
              left: w * 0.62,
              top: h * y - w * 0.07,
              width: w * 0.22,
              height: w * 0.14,
              borderRadius: w * 0.02,
            },
          ]}
        />
      ))}
    </View>
  );
}

/** A polished gold bar: a bright diagonal sheen and engraved corner stars. */
function GoldShine({ w, h }: { w: number; h: number }) {
  const f = w * 0.13;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          position: 'absolute',
          left: w * 0.05,
          top: -h * 0.2,
          width: w * 0.3,
          height: h * 1.4,
          transform: [{ rotate: '28deg' }],
        }}
      />
      <View
        style={[
          styles.engrave,
          { left: w * 0.08, right: w * 0.08, top: w * 0.08, bottom: w * 0.08, borderRadius: w * 0.06 },
        ]}
      />
      {[
        { left: w * 0.03, top: w * 0.02 },
        { right: w * 0.03, top: w * 0.02 },
        { left: w * 0.03, bottom: w * 0.02 },
        { right: w * 0.03, bottom: w * 0.02 },
      ].map((p, i) => (
        <Text key={i} style={[styles.goldStar, p, { fontSize: f, lineHeight: f * 1.15 }]}>
          ✦
        </Text>
      ))}
    </View>
  );
}

/** Light rays from the middle, like a medal's sunburst. */
function SunRays({ w, color }: { w: number; color: string }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
      {Array.from({ length: 12 }, (_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: w * 2,
            height: Math.max(1, w * 0.05),
            backgroundColor: color,
            transform: [{ rotate: `${i * 15}deg` }],
          }}
        />
      ))}
    </View>
  );
}

/** An old map: faint grid lines and a compass rose behind the emblem. */
function CompassRose({ w, h }: { w: number; h: number }) {
  const line = Math.max(0.5, w * 0.01);
  const ink = 'rgba(243, 234, 210, 0.16)';
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
      {[0.2, 0.4, 0.6, 0.8].map((k) => (
        <Fragment key={k}>
          <View
            style={{ position: 'absolute', left: 0, right: 0, top: h * k, height: line, backgroundColor: ink }}
          />
          <View
            style={{ position: 'absolute', top: 0, bottom: 0, left: w * k, width: line, backgroundColor: ink }}
          />
        </Fragment>
      ))}
      {[0, 45, 90, 135].map((a) => (
        <View
          key={a}
          style={{
            position: 'absolute',
            width: a % 90 ? w * 0.7 : w * 0.95,
            height: Math.max(1, w * (a % 90 ? 0.02 : 0.035)),
            backgroundColor: 'rgba(227, 197, 107, 0.55)',
            transform: [{ rotate: `${a}deg` }],
          }}
        />
      ))}
      <Text style={[styles.northMark, { top: h * 0.03, fontSize: w * 0.13 }]}>N</Text>
    </View>
  );
}

/** Long flame-colored feathers fanning up from the bottom. */
function Feathers({ w, h }: { w: number; h: number }) {
  const tints = ['rgba(255, 224, 138, 0.5)', 'rgba(255, 140, 40, 0.45)', 'rgba(255, 90, 30, 0.4)'];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {[-50, -30, -12, 12, 30, 50].map((a, i) => (
        <View
          key={a}
          style={{
            position: 'absolute',
            left: w * 0.5 - w * 0.09,
            top: h * 0.32,
            width: w * 0.18,
            height: h * 0.75,
            borderTopLeftRadius: w,
            borderTopRightRadius: w,
            backgroundColor: tints[i % 3],
            transform: [{ translateY: h * 0.3 }, { rotate: `${a}deg` }, { translateY: -h * 0.3 }],
          }}
        />
      ))}
    </View>
  );
}

/** Crossing bands of green and gold on red, a Scottish tartan. */
function Tartan({ w, h }: { w: number; h: number }) {
  const bands = [
    { at: 0.12, size: 0.14, color: 'rgba(27, 67, 50, 0.75)' },
    { at: 0.5, size: 0.2, color: 'rgba(27, 67, 50, 0.75)' },
    { at: 0.86, size: 0.14, color: 'rgba(27, 67, 50, 0.75)' },
    { at: 0.31, size: 0.025, color: 'rgba(255, 209, 102, 0.8)' },
    { at: 0.69, size: 0.025, color: 'rgba(255, 209, 102, 0.8)' },
  ];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {bands.map((b, i) => (
        <Fragment key={i}>
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: h * b.at - (w * b.size) / 2,
              height: w * b.size,
              backgroundColor: b.color,
              opacity: 0.7,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: w * b.at - (w * b.size) / 2,
              width: w * b.size,
              backgroundColor: b.color,
              opacity: 0.7,
            }}
          />
        </Fragment>
      ))}
    </View>
  );
}

/** Japanese wave scales: rows of overlapping circles. */
function Waves({ w, h }: { w: number; h: number }) {
  const r = w * 0.24;
  const rows = Math.ceil(h / (r * 0.5)) + 2;
  const cols = Math.ceil(w / r) + 2;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, c) => (
          <View
            key={`${row}-${c}`}
            style={{
              position: 'absolute',
              left: c * r - (row % 2 ? r / 2 : 0) - r / 2,
              top: row * r * 0.5 - r / 2,
              width: r,
              height: r,
              borderRadius: r / 2,
              borderWidth: Math.max(0.75, w * 0.015),
              borderColor: 'rgba(242, 247, 251, 0.55)',
              backgroundColor: row % 2 ? '#1b5f8f' : '#2373a8',
            }}
          />
        )),
      )}
    </View>
  );
}

/** Panes of colored glass held by dark lead lines. */
function StainedGlass({ w, h }: { w: number; h: number }) {
  const glass = ['#c0392b', '#2471a3', '#d4ac0d', '#1e8449', '#7d3c98', '#2e86c1', '#ca6f1e'];
  const cols = 4;
  const rows = 6;
  const rnd = random(5);
  const lead = Math.max(1, w * 0.025);
  return (
    <View style={[StyleSheet.absoluteFill, styles.panes]} pointerEvents="none">
      {Array.from({ length: rows * cols }, (_, i) => (
        <LinearGradient
          key={i}
          colors={[glass[Math.floor(rnd() * glass.length)], glass[Math.floor(rnd() * glass.length)]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: w / cols,
            height: h / rows,
            borderWidth: lead / 2,
            borderColor: '#141414',
            opacity: 0.85,
          }}
        />
      ))}
    </View>
  );
}

/** A spider's web spun from the middle. */
function Web({ w, h }: { w: number; h: number }) {
  const thread = 'rgba(242, 242, 242, 0.45)';
  const t = Math.max(0.5, w * 0.012);
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
      {[0, 30, 60, 90, 120, 150].map((a) => (
        <View
          key={a}
          style={{
            position: 'absolute',
            width: Math.hypot(w, h),
            height: t,
            backgroundColor: thread,
            transform: [{ rotate: `${a}deg` }],
          }}
        />
      ))}
      {[0.3, 0.55, 0.8, 1.05, 1.3].map((k) => (
        <View
          key={k}
          style={{
            position: 'absolute',
            width: w * k,
            height: w * k,
            borderRadius: w,
            borderWidth: t,
            borderColor: thread,
          }}
        />
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
  pad: { position: 'absolute', backgroundColor: '#e8c36a', borderColor: '#0a3d20' },
  chip: {
    position: 'absolute',
    backgroundColor: '#111611',
    borderWidth: 0.75,
    borderColor: 'rgba(92, 255, 157, 0.6)',
  },
  engrave: { position: 'absolute', borderWidth: 0.75, borderColor: 'rgba(120, 80, 0, 0.5)' },
  goldStar: {
    position: 'absolute',
    color: '#fffbe6',
    textShadowColor: 'rgba(140, 90, 0, 0.9)',
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 0 },
  },
  panes: { flexDirection: 'row', flexWrap: 'wrap' },
  northMark: { position: 'absolute', color: 'rgba(243, 234, 210, 0.6)', fontWeight: '900' },
  twinkle: {
    position: 'absolute',
    color: '#fff',
    textShadowColor: 'rgba(200, 170, 255, 1)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 0 },
  },
});
