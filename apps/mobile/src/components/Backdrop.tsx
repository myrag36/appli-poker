import type { ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type Theme, THEMES, themeId } from '../theme';
import { Space } from './decors/classic-space';
import { Lounge } from './decors/classic-lounge';
import { Curtain } from './decors/classic-vegas';
import { Suits } from './decors/classic-casino';
import { Synthwave } from './decors/classic-neon';

/** Small deterministic random generator, so the scenery is the same on every render. */
function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A straight line from one point to another, drawn as a thin rotated bar. */
function Line({
  x1,
  y1,
  x2,
  y2,
  color,
  width = 1,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width?: number;
}) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  return (
    <View
      style={{
        position: 'absolute',
        left: (x1 + x2) / 2 - length / 2,
        top: (y1 + y2) / 2 - width / 2,
        width: length,
        height: width,
        backgroundColor: color,
        transform: [{ rotate: `${angle}rad` }],
      }}
    />
  );
}

function Glow({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        boxShadow: `0 0 ${size}px ${size * 0.8}px ${color}`,
      }}
    />
  );
}

function Sakura({ w, h, k }: { w: number; h: number; k: number }) {
  const rand = random(3);
  const sun = w * 0.5;
  const mountain = (left: number, width: number, height: number, color: string) => (
    <View
      style={{
        position: 'absolute',
        left,
        bottom: 0,
        width: 0,
        height: 0,
        borderLeftWidth: width / 2,
        borderRightWidth: width / 2,
        borderBottomWidth: height,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
      }}
    />
  );
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: w * 0.45,
          top: h * 0.07,
          width: sun,
          height: sun,
          borderRadius: sun / 2,
          backgroundColor: '#e63946',
          opacity: 0.75,
          boxShadow: `0 0 ${50 * k}px rgba(230, 57, 70, 0.5)`,
        }}
      />
      {mountain(-w * 0.2, w * 0.9, h * 0.3, '#2a1a2a')}
      {mountain(w * 0.35, w * 0.95, h * 0.38, '#1f141f')}
      {mountain(w * 0.05, w * 0.6, h * 0.18, '#140d14')}
      {Array.from({ length: 22 }, (_, i) => (
        <Text
          key={i}
          style={{
            position: 'absolute',
            left: rand() * w,
            top: rand() * h * 0.85,
            fontSize: (12 + rand() * 16) * k,
            opacity: 0.35 + rand() * 0.4,
            transform: [{ rotate: `${Math.round(rand() * 360)}deg` }],
          }}
        >
          🌸
        </Text>
      ))}
    </>
  );
}

function Saloon({ w, h, k }: { w: number; h: number; k: number }) {
  const plank = 46 * k;
  const rand = random(11);
  return (
    <>
      {Array.from({ length: Math.ceil(w / plank) + 1 }, (_, i) => {
        const shade = 0.85 + rand() * 0.3;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: i * plank,
              width: plank - 2 * k,
              opacity: shade,
            }}
          >
            <LinearGradient
              colors={['#9c6b3a', '#7a4f26', '#5c3a1a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            {[0.06, 0.94].map((y) => (
              <View
                key={y}
                style={{
                  position: 'absolute',
                  top: h * y,
                  left: plank / 2 - 3 * k,
                  width: 4 * k,
                  height: 4 * k,
                  borderRadius: 2 * k,
                  backgroundColor: '#2a1708',
                }}
              />
            ))}
          </View>
        );
      })}
      <LinearGradient
        colors={['rgba(42,23,8,0.1)', 'rgba(42,23,8,0.55)', 'rgba(20,10,3,0.95)']}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          position: 'absolute',
          left: w * 0.07,
          top: h * 0.08,
          width: 74 * k,
          height: 92 * k,
          backgroundColor: '#f1dca7',
          alignItems: 'center',
          paddingTop: 6 * k,
          transform: [{ rotate: '-7deg' }],
          boxShadow: `0 ${4 * k}px ${10 * k}px rgba(0,0,0,0.5)`,
        }}
      >
        <Text style={{ fontSize: 13 * k, fontWeight: '900', color: '#3d2810', letterSpacing: 1 }}>
          WANTED
        </Text>
        <Text style={{ fontSize: 34 * k, marginTop: 2 * k }}>🤠</Text>
        <Text style={{ fontSize: 9 * k, fontWeight: '800', color: '#3d2810' }}>$ 1000</Text>
      </View>
      <Text
        style={{ position: 'absolute', right: w * 0.04, bottom: h * 0.02, fontSize: 64 * k, opacity: 0.55 }}
      >
        🌵
      </Text>
      <Text
        style={{ position: 'absolute', left: w * 0.02, bottom: h * 0.01, fontSize: 44 * k, opacity: 0.45 }}
      >
        🌵
      </Text>
    </>
  );
}

const DECORS: Record<Theme['decor'], (p: { w: number; h: number; k: number }) => ReactNode> = {
  suits: Suits,
  synthwave: Synthwave,
  curtain: Curtain,
  lounge: Lounge,
  space: Space,
  sakura: Sakura,
  saloon: Saloon,
};

/**
 * The theme's scenery behind every screen. With `width`/`height` it draws a scaled-down
 * copy instead, for the theme previews.
 */
export function Backdrop({
  theme = THEMES[themeId],
  width,
  height,
}: {
  theme?: Theme;
  width?: number;
  height?: number;
}) {
  const window = useWindowDimensions();
  const w = width ?? window.width;
  const h = height ?? window.height;
  const k = width ? w / 390 : 1;
  const Decor = DECORS[theme.decor];
  return (
    <View
      pointerEvents="none"
      style={[width ? { width: w, height: h } : StyleSheet.absoluteFill, styles.clip]}
    >
      <LinearGradient colors={theme.gradients.background} style={StyleSheet.absoluteFill} />
      {theme.decor === 'suits' && <Glow x={w / 2} y={-k * 10} size={200 * k} color={theme.colors.glow} />}
      <Decor w={w} h={h} k={k} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
