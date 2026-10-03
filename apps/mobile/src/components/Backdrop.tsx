import type { ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type Theme, THEMES, themeId } from '../theme';

const SUITS = ['♠', '♥', '♦', '♣'];

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

function Suits({ w, h, k }: { w: number; h: number; k: number }) {
  const step = 92 * k;
  const cols = Math.ceil(w / step) + 1;
  const rows = Math.ceil(h / step) + 1;
  return (
    <>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (
          <Text
            key={`${r}-${c}`}
            style={{
              position: 'absolute',
              fontSize: 30 * k,
              color: 'rgba(255, 255, 255, 0.035)',
              left: c * step + (r % 2 ? step / 2 : 0) - 20 * k,
              top: r * step - 20 * k,
              transform: [{ rotate: `${((r + c) % 2 ? 1 : -1) * 15}deg` }],
            }}
          >
            {SUITS[(r + c) % 4]}
          </Text>
        )),
      )}
    </>
  );
}

function Synthwave({ w, h, k }: { w: number; h: number; k: number }) {
  const horizon = h * 0.42;
  const sun = w * 0.62;
  const rand = random(7);
  const grid = 'rgba(76, 201, 240, 0.35)';
  return (
    <>
      {Array.from({ length: 40 }, (_, i) => (
        <View
          key={`s${i}`}
          style={{
            position: 'absolute',
            left: rand() * w,
            top: rand() * horizon * 0.9,
            width: 2 * k,
            height: 2 * k,
            borderRadius: k,
            backgroundColor: `rgba(255,255,255,${0.3 + rand() * 0.5})`,
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: w / 2 - sun / 2,
          top: horizon - sun * 0.62,
          width: sun,
          height: sun * 0.62,
          borderTopLeftRadius: sun / 2,
          borderTopRightRadius: sun / 2,
          overflow: 'hidden',
          boxShadow: `0 0 ${60 * k}px rgba(247, 37, 133, 0.55)`,
        }}
      >
        <LinearGradient colors={['#ffd166', '#f78c6b', '#f72585']} style={StyleSheet.absoluteFill} />
        {[0.55, 0.68, 0.79, 0.89].map((t, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: sun * 0.62 * t,
              height: (2 + i * 1.5) * k,
              backgroundColor: '#1a0b3a',
            }}
          />
        ))}
      </View>
      <LinearGradient
        colors={['#1a0b3a', '#0b0420']}
        style={{ position: 'absolute', left: 0, right: 0, top: horizon, bottom: 0 }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: horizon,
          height: 2 * k,
          backgroundColor: '#f72585',
          boxShadow: `0 0 ${12 * k}px #f72585`,
        }}
      />
      {Array.from({ length: 12 }, (_, i) => {
        const t = (i + 1) / 12;
        return (
          <Line
            key={`h${i}`}
            x1={0}
            y1={horizon + (h - horizon) * t * t}
            x2={w}
            y2={horizon + (h - horizon) * t * t}
            color={grid}
            width={Math.max(1, k * 1.2)}
          />
        );
      })}
      {Array.from({ length: 15 }, (_, i) => (
        <Line
          key={`v${i}`}
          x1={w / 2}
          y1={horizon}
          x2={w / 2 + (i - 7) * w * 0.3}
          y2={h}
          color={grid}
          width={Math.max(1, k * 1.2)}
        />
      ))}
    </>
  );
}

function Curtain({ w, h, k }: { w: number; h: number; k: number }) {
  const fold = 44 * k;
  const folds = Math.ceil(w / fold) + 1;
  const bulb = 22 * k;
  const valance = 46 * k;
  return (
    <>
      {Array.from({ length: folds }, (_, i) => (
        <LinearGradient
          key={i}
          colors={['#2a0306', '#9d0f18', '#c1121f', '#9d0f18', '#2a0306']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: 'absolute', top: 0, bottom: 0, left: i * fold, width: fold }}
        />
      ))}
      <LinearGradient
        colors={['rgba(10,2,2,0)', 'rgba(10,2,2,0.75)', '#0a0202']}
        style={{ position: 'absolute', left: 0, right: 0, top: h * 0.45, bottom: 0 }}
      />
      <LinearGradient
        colors={['#5c0a10', '#8d0f16']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: valance }}
      />
      {Array.from({ length: Math.ceil(w / (valance * 0.9)) + 1 }, (_, i) => (
        <View
          key={`sc${i}`}
          style={{
            position: 'absolute',
            top: valance * 0.55,
            left: i * valance * 0.9 - valance * 0.1,
            width: valance * 0.9,
            height: valance * 0.9,
            borderRadius: valance,
            backgroundColor: '#8d0f16',
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: valance - 3 * k,
          height: 3 * k,
          backgroundColor: '#c9a227',
        }}
      />
      {Array.from({ length: Math.ceil(w / bulb) }, (_, i) => (
        <View
          key={`b${i}`}
          style={{
            position: 'absolute',
            top: valance * 0.3,
            left: i * bulb + bulb / 2 - 4 * k,
            width: 8 * k,
            height: 8 * k,
            borderRadius: 4 * k,
            backgroundColor: i % 2 ? '#fff3b0' : '#ffd166',
            boxShadow: `0 0 ${8 * k}px ${3 * k}px rgba(255, 209, 102, 0.7)`,
          }}
        />
      ))}
    </>
  );
}

function Lounge({ w, h, k }: { w: number; h: number; k: number }) {
  const wainscot = h * 0.58;
  const plank = 26 * k;
  const stripes = Math.ceil(w / (18 * k));
  return (
    <>
      {Array.from({ length: stripes }, (_, i) => (
        <View
          key={`w${i}`}
          style={{
            position: 'absolute',
            top: 0,
            height: wainscot,
            left: i * 18 * k,
            width: 1,
            backgroundColor: 'rgba(233, 168, 91, 0.06)',
          }}
        />
      ))}
      {Array.from({ length: Math.ceil((h - wainscot) / plank) }, (_, i) => (
        <LinearGradient
          key={`p${i}`}
          colors={i % 2 ? ['#3d2614', '#2e1c0f'] : ['#4a2f19', '#36220f']}
          style={{ position: 'absolute', left: 0, right: 0, top: wainscot + i * plank, height: plank - 1 }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: wainscot - 4 * k,
          height: 5 * k,
          backgroundColor: '#b5835a',
        }}
      />
      {[0.18, 0.82].map((x) => (
        <View key={x}>
          <Glow x={w * x} y={h * 0.2} size={70 * k} color="rgba(255, 196, 120, 0.16)" />
          <View
            style={{
              position: 'absolute',
              left: w * x - 22 * k,
              top: h * 0.2 - 30 * k,
              width: 44 * k,
              height: 26 * k,
              borderTopLeftRadius: 10 * k,
              borderTopRightRadius: 10 * k,
              backgroundColor: '#e9a85b',
              opacity: 0.85,
              boxShadow: `0 ${10 * k}px ${30 * k}px rgba(255, 196, 120, 0.5)`,
            }}
          />
        </View>
      ))}
    </>
  );
}

function Space({ w, h, k }: { w: number; h: number; k: number }) {
  const rand = random(42);
  const planet = w * 0.42;
  return (
    <>
      <Glow x={w * 0.15} y={h * 0.75} size={w * 0.35} color="rgba(123, 44, 191, 0.18)" />
      <Glow x={w * 0.85} y={h * 0.55} size={w * 0.25} color="rgba(76, 201, 240, 0.10)" />
      {Array.from({ length: 140 }, (_, i) => {
        const size = (0.8 + rand() * 2.2) * k;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: rand() * w,
              top: rand() * h,
              width: size,
              height: size,
              borderRadius: size,
              backgroundColor: `rgba(255,255,255,${0.25 + rand() * 0.7})`,
            }}
          />
        );
      })}
      <View
        style={{
          position: 'absolute',
          left: w * 0.62,
          top: h * 0.04,
          width: planet,
          height: planet,
          borderRadius: planet / 2,
          overflow: 'hidden',
          boxShadow: `0 0 ${40 * k}px rgba(199, 125, 255, 0.4)`,
        }}
      >
        <LinearGradient
          colors={['#e0aaff', '#9d4edd', '#3c096c']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View
        style={{
          position: 'absolute',
          left: w * 0.62 - planet * 0.35,
          top: h * 0.04 + planet * 0.38,
          width: planet * 1.7,
          height: planet * 0.26,
          borderRadius: planet,
          borderWidth: 3 * k,
          borderColor: 'rgba(224, 170, 255, 0.55)',
          transform: [{ rotate: '-18deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: w * 0.12,
          top: h * 0.12,
          width: w * 0.08,
          height: w * 0.08,
          borderRadius: w,
          backgroundColor: '#cdb4db',
          opacity: 0.8,
        }}
      />
    </>
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
