import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { REWARDS } from '@appli-poker/engine';
import { makeChoice } from './choice';
import { stripes } from './decors/classic-kit';
import { gradients, theme } from '../theme';

type Stops = readonly [string, string, ...string[]];

/** Every felt id, in catalog order. "ambiance" keeps the felt of the chosen theme. */
export const FELT_IDS = REWARDS.filter((r) => r.kind === 'felt').map((r) => r.id);

const choice = makeChoice('appli-poker:felt', FELT_IDS, 'ambiance');
/** Changes the cloth of every table. */
export const setFelt = choice.set;
export const useFelt = choice.use;

type Pattern = 'vichy' | 'argyle' | 'stars' | 'dunes' | 'lattice' | 'pinstripes';

interface FeltLook {
  /** Top-to-bottom colors of the cloth. */
  fill: Stops;
  pattern?: Pattern;
  /** Color of the pattern's lines or dots. */
  ink?: string;
  /** For 'lattice': the repeated symbol, its size and opacity. */
  glyph?: string;
  glyphSize?: number;
  /** Faint emblem in the middle of the table, instead of the theme's. */
  mark?: string;
}

const LOOKS: Record<string, FeltLook> = {
  bordeaux: {
    fill: ['#a3203a', '#741228', '#460816'],
    pattern: 'pinstripes',
    ink: 'rgba(0,0,0,0.12)',
    mark: '♥',
  },
  nuit: { fill: ['#24457f', '#16305f', '#0a1a3a'], pattern: 'stars', ink: '#cfe0ff', mark: '♠' },
  vichy: {
    fill: ['#2f8a56', '#1f6b40', '#12482a'],
    pattern: 'vichy',
    ink: 'rgba(255,255,255,0.11)',
    mark: '♣',
  },
  velours: {
    fill: ['#6a3399', '#47206e', '#260d42'],
    pattern: 'lattice',
    glyph: '⚜',
    glyphSize: 22,
    ink: 'rgba(255, 215, 120, 0.13)',
    mark: '♛',
  },
  defi: { fill: ['#165a96', '#0d3d6b', '#061f3b'], pattern: 'stars', ink: '#ffd166', mark: '★' },
  jungle: {
    fill: ['#227a42', '#155a2f', '#0a3318'],
    pattern: 'lattice',
    glyph: '❧',
    glyphSize: 26,
    ink: 'rgba(170, 255, 170, 0.14)',
    mark: '🐆',
  },
  champion: {
    fill: ['#17603a', '#0d4227', '#052414'],
    pattern: 'pinstripes',
    ink: 'rgba(255, 210, 90, 0.16)',
    mark: '🏆',
  },
  sable: {
    fill: ['#dcbc80', '#bf9252', '#8f6531'],
    pattern: 'dunes',
    ink: 'rgba(110, 70, 20, 0.28)',
    mark: '☀',
  },
  argyle: {
    fill: ['#1f6a8a', '#155069', '#0b3346'],
    pattern: 'argyle',
    ink: 'rgba(255,255,255,0.12)',
    mark: '♦',
  },
  etoiles: { fill: ['#231a5c', '#130e3a', '#060418'], pattern: 'stars', ink: '#ffffff', mark: '🌙' },
  brocart: {
    fill: ['#8a6418', '#5a3e0a', '#2e1f03'],
    pattern: 'lattice',
    glyph: '❖',
    glyphSize: 18,
    ink: 'rgba(255, 220, 120, 0.28)',
    mark: '♛',
  },
  noel: {
    fill: ['#b51d22', '#841317', '#4e090c'],
    pattern: 'lattice',
    glyph: '❄',
    glyphSize: 18,
    ink: 'rgba(255,255,255,0.2)',
    mark: '🎄',
  },
};

/** The faint emblem in the middle of the tables: the chosen felt's, or the theme's. */
export function feltMark(): string | undefined {
  const look = LOOKS[choice.get()];
  return look ? look.mark : theme.feltMark;
}

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

/** Light lines across and down, like a gingham tablecloth. */
function Vichy({ w, h, ink, step }: { w: number; h: number; ink: string; step: number }) {
  const across = stripes(step, h, ink, 0.5);
  const down = stripes(step, w, ink, 0.5);
  return (
    <>
      <LinearGradient {...across} style={StyleSheet.absoluteFill} />
      <LinearGradient {...down} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
    </>
  );
}

function Pattern({ look, w, h }: { look: FeltLook; w: number; h: number }) {
  const ink = look.ink ?? 'rgba(255,255,255,0.1)';
  switch (look.pattern) {
    case 'vichy':
      return <Vichy w={w} h={h} ink={ink} step={Math.max(10, Math.round(Math.min(w, h) / 14))} />;
    case 'pinstripes': {
      const down = stripes(Math.max(8, Math.round(w / 40)), w, ink, 0.12);
      return (
        <LinearGradient
          {...down}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      );
    }
    case 'argyle': {
      // Gingham turned a quarter of a right angle gives diamonds.
      const d = Math.ceil(Math.hypot(w, h));
      const step = Math.max(14, Math.round(Math.min(w, h) / 9));
      return (
        <View
          style={{
            position: 'absolute',
            width: d,
            height: d,
            left: (w - d) / 2,
            top: (h - d) / 2,
            transform: [{ rotate: '45deg' }],
          }}
        >
          <Vichy w={d} h={d} ink={ink} step={step} />
        </View>
      );
    }
    case 'stars': {
      const rnd = random(31);
      const n = Math.min(70, Math.round((w * h) / 2600));
      return (
        <>
          {Array.from({ length: n }, (_, i) => {
            const s = 1 + rnd() * 2.2;
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: rnd() * w,
                  top: rnd() * h,
                  width: s,
                  height: s,
                  borderRadius: s,
                  backgroundColor: ink,
                  opacity: 0.25 + rnd() * 0.5,
                }}
              />
            );
          })}
        </>
      );
    }
    case 'dunes': {
      const rows = Math.max(4, Math.round(h / 34));
      return (
        <>
          {Array.from({ length: rows }, (_, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: (i % 2 ? -0.35 : -0.15) * w,
                top: (i / rows) * h,
                width: w * 1.5,
                height: h / 2,
                borderRadius: w,
                borderTopWidth: 2,
                borderColor: ink,
              }}
            />
          ))}
        </>
      );
    }
    case 'lattice': {
      // Staggered rows of a small symbol, a little like a printed fabric.
      const cell = Math.max((look.glyphSize ?? 20) * 2, Math.sqrt((w * h) / 160));
      const cols = Math.ceil(w / cell) + 1;
      const rowCount = Math.ceil(h / cell) + 1;
      const size = Math.min(look.glyphSize ?? 20, cell * 0.6);
      return (
        <>
          {Array.from({ length: rowCount }, (_, r) =>
            Array.from({ length: cols }, (_, c) => (
              <Text
                key={`${r}-${c}`}
                style={{
                  position: 'absolute',
                  left: c * cell + (r % 2 ? cell / 2 : 0) - size / 2,
                  top: r * cell - size / 2,
                  fontSize: size,
                  lineHeight: size * 1.2,
                  color: ink,
                }}
              >
                {look.glyph}
              </Text>
            )),
          )}
        </>
      );
    }
    default:
      return null;
  }
}

/**
 * The cloth of a table, filling its parent: the theme's felt, or the one the player chose.
 * `id` shows a given felt instead (for previews).
 */
export function FeltFill({ id }: { id?: string }) {
  const chosen = useFelt();
  const look = LOOKS[id ?? chosen];
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  if (!look) return <LinearGradient colors={gradients.felt} style={StyleSheet.absoluteFill} />;
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.abs(size.w - width) > 1 || Math.abs(size.h - height) > 1)
      setSize({ w: width, h: height });
  };
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none" onLayout={onLayout}>
      <LinearGradient colors={look.fill} style={StyleSheet.absoluteFill} />
      {size && size.w > 0 && <Pattern look={look} w={size.w} h={size.h} />}
    </View>
  );
}

/** A felt on its own, for picker tiles: a small rounded swatch with its emblem. */
export function FeltPreview({ id, width, height }: { id: string; width: number; height: number }) {
  const look = LOOKS[id];
  const mark = look ? look.mark : theme.feltMark;
  return (
    <View style={[styles.preview, { width, height, borderRadius: height / 2 }]}>
      <FeltFill id={id} />
      <View style={[styles.previewShade, { borderRadius: height / 2 }]} />
      {mark && <Text style={[styles.previewMark, { fontSize: height * 0.45 }]}>{mark}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  preview: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#5a3417',
  },
  previewShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    boxShadow: 'inset 0 0 14px rgba(0,0,0,0.55)',
  },
  previewMark: { opacity: 0.18, color: '#ffffff' },
});
