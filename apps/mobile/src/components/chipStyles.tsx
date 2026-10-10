import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { REWARDS } from '@appli-poker/engine';
import { makeChoice } from './choice';

type Stops = readonly [string, string, ...string[]];

/** Every chip style id, in catalog order. */
export const CHIP_STYLE_IDS = REWARDS.filter((r) => r.kind === 'chip').map((r) => r.id);

const choice = makeChoice('appli-poker:chip', CHIP_STYLE_IDS, 'classic');
/** Changes the chips drawn on the poker and blackjack tables. */
export const setChipStyle = choice.set;
export const useChipStyle = choice.use;

/** Chip values, largest first; each style colors them in this order. */
export const CHIP_VALUES = [1000, 500, 100, 25, 5, 1];

/** One chip value: body color and the color of the marks on its edge. */
type Paint = readonly [body: string, edge: string];

interface ChipLook {
  /** By value, in the order of CHIP_VALUES. */
  paints: readonly [Paint, Paint, Paint, Paint, Paint, Paint];
  /** How the edge is marked: dashes, six painted blocks, or nothing. */
  edge: 'dashes' | 'blocks' | 'plain';
  /** Center disc color; the body color shows through when absent. */
  inlay?: string;
  /** Thin ring around the center. */
  ring?: string;
  /** Light across the chip. */
  sheen?: Stops;
  /** A halo of the edge color around the chip. */
  glow?: boolean;
  /** Symbol printed in the middle on big enough chips. */
  glyph?: string;
  glyphColor?: string;
  /** Square-ish chips, for the pixel style. */
  square?: boolean;
}

const GLOSS: Stops = ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.18)'];

const LOOKS: Record<string, ChipLook> = {
  classic: {
    paints: [
      ['#f2c14e', '#7a5a00'],
      ['#7b2cbf', '#f0e6ff'],
      ['#1b1b1b', '#f5f5f5'],
      ['#2a9d4f', '#ffffff'],
      ['#d62839', '#ffffff'],
      ['#f1f1f1', '#3a6ea5'],
    ],
    edge: 'dashes',
  },
  argile: {
    paints: [
      ['#c9a24a', '#4a3208'],
      ['#6d4c7d', '#efe6d0'],
      ['#3b3b3b', '#efe6d0'],
      ['#4f7a5a', '#efe6d0'],
      ['#a8443c', '#efe6d0'],
      ['#e8e0cc', '#6b5a3a'],
    ],
    edge: 'blocks',
    inlay: '#efe6d0',
    ring: 'rgba(0,0,0,0.25)',
    glyph: '♣',
    glyphColor: '#6b5a3a',
  },
  marine: {
    paints: [
      ['#0b2545', '#f4d35e'],
      ['#13315c', '#ffffff'],
      ['#1d70a2', '#ffffff'],
      ['#2bb3c0', '#0b2545'],
      ['#e63946', '#ffffff'],
      ['#f1faee', '#1d70a2'],
    ],
    edge: 'blocks',
    ring: 'rgba(255,255,255,0.6)',
    glyph: '⚓',
    glyphColor: 'rgba(255,255,255,0.9)',
    sheen: GLOSS,
  },
  neon: {
    paints: [
      ['#160828', '#ffe600'],
      ['#160828', '#c13cff'],
      ['#0a0518', '#00f0ff'],
      ['#0a0518', '#39ff14'],
      ['#160828', '#ff3cac'],
      ['#0a0518', '#ff9f1c'],
    ],
    edge: 'dashes',
    ring: 'rgba(255,255,255,0.5)',
    glow: true,
  },
  or: {
    paints: [
      ['#ffd700', '#fff6c9'],
      ['#e0b33a', '#7a5200'],
      ['#c99a2e', '#fff1b8'],
      ['#b8862b', '#fff1b8'],
      ['#a8741f', '#ffe08a'],
      ['#f5e1a4', '#8a5d00'],
    ],
    edge: 'blocks',
    ring: 'rgba(110,70,0,0.5)',
    sheen: ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.35)', 'rgba(90,50,0,0.25)'],
    glyph: '♛',
    glyphColor: '#7a5200',
  },
  bois: {
    paints: [
      ['#c58a4a', '#4a2a0f'],
      ['#8a5a2b', '#e8c99b'],
      ['#4e2f17', '#e8c99b'],
      ['#a0683a', '#3a1e0a'],
      ['#6b3f1f', '#e8c99b'],
      ['#e0b585', '#5a3414'],
    ],
    edge: 'plain',
    ring: 'rgba(40,20,5,0.55)',
    sheen: ['rgba(255,235,200,0.3)', 'rgba(0,0,0,0)', 'rgba(60,30,10,0.3)'],
    glyph: '❦',
    glyphColor: 'rgba(40,20,5,0.7)',
  },
  pixel: {
    paints: [
      ['#ffcd00', '#000000'],
      ['#b13e53', '#000000'],
      ['#333c57', '#ffffff'],
      ['#38b764', '#000000'],
      ['#ef7d57', '#000000'],
      ['#f4f4f4', '#29366f'],
    ],
    edge: 'plain',
    ring: 'rgba(0,0,0,0.55)',
    square: true,
    glyph: '■',
    glyphColor: 'rgba(0,0,0,0.35)',
  },
  marbre: {
    paints: [
      ['#f2efe8', '#c9a227'],
      ['#2b2b2b', '#c9a227'],
      ['#1f5c4a', '#c9a227'],
      ['#7a1f2b', '#c9a227'],
      ['#3a4a6b', '#c9a227'],
      ['#d9d4c7', '#8a6d1a'],
    ],
    edge: 'plain',
    ring: '#c9a227',
    sheen: [
      'rgba(255,255,255,0.4)',
      'rgba(255,255,255,0)',
      'rgba(255,255,255,0.25)',
      'rgba(0,0,0,0.2)',
      'rgba(255,255,255,0.15)',
    ],
  },
  cristal: {
    paints: [
      ['rgba(255,215,90,0.75)', 'rgba(255,255,255,0.9)'],
      ['rgba(180,110,255,0.7)', 'rgba(255,255,255,0.9)'],
      ['rgba(80,180,255,0.7)', 'rgba(255,255,255,0.9)'],
      ['rgba(70,230,170,0.7)', 'rgba(255,255,255,0.9)'],
      ['rgba(255,90,140,0.7)', 'rgba(255,255,255,0.9)'],
      ['rgba(235,245,255,0.75)', 'rgba(120,180,255,0.9)'],
    ],
    edge: 'dashes',
    ring: 'rgba(255,255,255,0.8)',
    sheen: ['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.4)'],
    glow: true,
    glyph: '✦',
    glyphColor: '#ffffff',
  },
  defi: {
    paints: [
      ['#c1121f', '#ffd166'],
      ['#3a0ca3', '#ffd166'],
      ['#0f4c81', '#ffd166'],
      ['#2a9d8f', '#ffd166'],
      ['#e76f51', '#fff3c4'],
      ['#f8f1e0', '#c1121f'],
    ],
    edge: 'dashes',
    inlay: '#ffd166',
    ring: '#8a5d00',
    glyph: '★',
    glyphColor: '#8a5d00',
  },
  requin: {
    paints: [
      ['#0a1f33', '#7fd1ff'],
      ['#123a5c', '#d8f1ff'],
      ['#1c1f26', '#7fd1ff'],
      ['#1f6f8b', '#ffffff'],
      ['#b23a48', '#ffffff'],
      ['#cfd8e3', '#123a5c'],
    ],
    edge: 'blocks',
    ring: 'rgba(127,209,255,0.7)',
    sheen: GLOSS,
    glyph: '▲',
    glyphColor: 'rgba(216,241,255,0.95)',
  },
  carnaval: {
    paints: [
      ['#ffbe0b', '#8338ec'],
      ['#8338ec', '#ffbe0b'],
      ['#3a86ff', '#ff006e'],
      ['#06d6a0', '#ff006e'],
      ['#ff006e', '#ffbe0b'],
      ['#fff1f8', '#ff006e'],
    ],
    edge: 'blocks',
    ring: 'rgba(255,255,255,0.8)',
    sheen: GLOSS,
    glyph: '✸',
    glyphColor: '#ffffff',
  },
};

/** The chip look of a style, falling back to the casino one. */
function lookOf(style: string): ChipLook {
  return LOOKS[style] ?? LOOKS.classic;
}

/** The index in CHIP_VALUES of a value (the closest smaller one). */
export function chipIndex(value: number): number {
  const i = CHIP_VALUES.findIndex((v) => value >= v);
  return i < 0 ? CHIP_VALUES.length - 1 : i;
}

/** One chip seen from above. `index` is its value's place in CHIP_VALUES. */
export function ChipFace({ style, index, size }: { style: string; index: number; size: number }) {
  const look = lookOf(style);
  const [body, edge] = look.paints[Math.max(0, Math.min(5, index))];
  const radius = look.square ? size * 0.22 : size / 2;
  const border = Math.max(1.5, size * 0.1);
  const inner = size * 0.56;
  const glyph = look.glyph && size >= 20;
  return (
    <View
      style={[
        styles.chip,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: body,
          borderColor: look.edge === 'dashes' ? edge : 'rgba(0,0,0,0.35)',
          borderWidth: look.edge === 'dashes' ? border : Math.max(0.75, size * 0.04),
          borderStyle: look.edge === 'dashes' ? 'dashed' : 'solid',
          boxShadow: look.glow
            ? `0 0 ${Math.max(3, size * 0.35)}px ${edge}, 0 1px 2px rgba(0,0,0,0.6)`
            : '0 1px 2px rgba(0,0,0,0.6)',
        },
      ]}
    >
      {look.edge === 'blocks' &&
        [0, 60, 120, 180, 240, 300].map((a) => (
          <View key={a} style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${a}deg` }] }]}>
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: size / 2 - size * 0.09,
                width: size * 0.18,
                height: size * 0.17,
                backgroundColor: edge,
                borderRadius: size * 0.03,
              }}
            />
          </View>
        ))}
      {look.sheen && (
        <LinearGradient
          colors={look.sheen}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      )}
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: look.square ? inner * 0.2 : inner / 2,
          borderWidth: Math.max(0.75, size * 0.035),
          borderColor: look.ring ?? edge,
          backgroundColor: look.inlay,
          opacity: look.ring ? 1 : 0.7,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {glyph && (
          <Text style={[styles.glyph, { color: look.glyphColor ?? edge, fontSize: size * 0.3, lineHeight: size * 0.36 }]}>
            {look.glyph}
          </Text>
        )}
      </View>
    </View>
  );
}

/** A few chips of a style fanned out, for a picker tile. */
export function ChipPreview({ id, size }: { id: string; size: number }) {
  const step = size * 0.62;
  return (
    <View style={{ width: size + step * 2, height: size * 1.25 }}>
      {[3, 1, 0].map((index, i) => (
        <View key={index} style={{ position: 'absolute', left: i * step, top: i === 1 ? 0 : size * 0.25 }}>
          <ChipFace style={id} index={index} size={size} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  glyph: { fontWeight: '900', textAlign: 'center' },
});
