// Nuit néon: an 80s synthwave night, sun setting behind neon mountains over a glowing grid.
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Dot,
  Glow,
  Line,
  Loop,
  type SceneProps,
  ShootingStar,
  Tri,
  many,
  random,
  stripes,
  tiny,
} from './classic-kit';

const PINK = '#f72585';
const NIGHT = '#0b0420';

/** A mountain range: dark triangles with a neon ridge line. */
function Range({
  peaks,
  base,
  color,
  rim,
  k,
}: {
  peaks: { x: number; width: number; height: number; skew?: number }[];
  base: number;
  color: string;
  rim: string;
  k: number;
}) {
  return (
    <>
      {peaks.map((p, i) => (
        <Tri key={`m${i}`} x={p.x} y={base} width={p.width} height={p.height} color={color} skew={p.skew} />
      ))}
      {peaks.map((p, i) => {
        const tipX = p.x - p.width / 2 + p.width * (0.5 + (p.skew ?? 0));
        const tipY = base - p.height;
        return (
          <View key={`r${i}`}>
            <Line
              x1={p.x - p.width / 2}
              y1={base}
              x2={tipX}
              y2={tipY}
              color={rim}
              width={Math.max(1, 1.3 * k)}
            />
            <Line
              x1={tipX}
              y1={tipY}
              x2={p.x + p.width / 2}
              y2={base}
              color={rim}
              width={Math.max(1, 1.3 * k)}
            />
            {/* A couple of inner ridges, like a wireframe. */}
            <Line
              x1={tipX}
              y1={tipY}
              x2={p.x - p.width * 0.1}
              y2={base}
              color="rgba(247, 37, 133, 0.25)"
              width={Math.max(1, 0.8 * k)}
            />
            <Line
              x1={tipX}
              y1={tipY}
              x2={p.x + p.width * 0.2}
              y2={base}
              color="rgba(76, 201, 240, 0.18)"
              width={Math.max(1, 0.8 * k)}
            />
          </View>
        );
      })}
    </>
  );
}

/** A palm tree silhouette with a pink rim light, its crown swaying slightly. */
function Palm({
  x,
  base,
  height,
  lean,
  k,
  flip,
  still,
}: {
  x: number;
  base: number;
  height: number;
  lean: number;
  k: number;
  flip?: boolean;
  still?: boolean;
}) {
  const s = height / 400;
  const segs = 16;
  const dir = flip ? -1 : 1;
  const pts = Array.from({ length: segs + 1 }, (_, i) => {
    const t = i / segs;
    return { x: x + lean * t * t * dir, y: base - height * t };
  });
  const top = pts[segs];
  const R = height * 0.4;
  // Each frond is an arc (the top border of a half-ellipse), thick in the middle and thin at the ends.
  const fronds = [
    { a: -160, l: 1 },
    { a: -128, l: 0.85 },
    { a: -95, l: 0.6 },
    { a: -62, l: 0.85 },
    { a: -25, l: 1 },
    { a: 12, l: 0.9 },
    { a: 155, l: 0.8 },
  ];
  return (
    <>
      {pts.slice(0, -1).map((p, i) => {
        const q = pts[i + 1];
        const wdt = (20 - i * 0.75) * k * s;
        return (
          <View key={`t${i}`}>
            <Line x1={p.x} y1={p.y + 1} x2={q.x} y2={q.y - 1} color="#07021a" width={wdt} />
            <Line
              x1={p.x + (wdt / 2) * dir}
              y1={p.y}
              x2={q.x + (wdt / 2) * dir}
              y2={q.y}
              color="rgba(247, 37, 133, 0.45)"
              width={Math.max(1, 1.2 * k)}
            />
            {i % 2 === 0 && (
              <Line
                x1={p.x - wdt / 2}
                y1={p.y}
                x2={p.x + wdt / 2}
                y2={p.y - 3 * k * s}
                color="rgba(247, 37, 133, 0.22)"
                width={Math.max(1, k)}
              />
            )}
          </View>
        );
      })}
      <Loop
        motion="sway"
        amp={2}
        duration={6500}
        delay={x * 13}
        still={still}
        width={R * 2}
        height={R * 2}
        style={{ position: 'absolute', left: top.x - R, top: top.y - R, width: R * 2, height: R * 2 }}
      >
        {fronds.map(({ a, l }) => {
          const L = R * l;
          const angle = flip ? 180 - a : a;
          // Fronds pointing left are mirrored so they still droop downwards.
          const mirror = Math.cos((angle * Math.PI) / 180) < 0;
          const arc = (color: string, t: number, dy: number) => (
            <View
              style={{
                position: 'absolute',
                left: R,
                top: R - L * 0.22 + dy,
                width: L,
                height: L * 0.44,
                borderRadius: '50%',
                borderTopWidth: t,
                borderColor: color,
              }}
            />
          );
          return (
            <View
              key={a}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: R * 2,
                height: R * 2,
                transform: [{ rotate: `${mirror ? angle - 180 : angle}deg` }, { scaleX: mirror ? -1 : 1 }],
              }}
            >
              {arc('rgba(247, 37, 133, 0.75)', 11 * k * s, -1.6 * k)}
              {arc('#07021a', 11 * k * s, 0)}
            </View>
          );
        })}
        <Dot x={R} y={R} size={16 * k * s} color="#07021a" />
      </Loop>
    </>
  );
}

export function Synthwave({ w, h, k }: SceneProps) {
  const still = tiny(w);
  const narrow = w < 560;
  const horizon = h * 0.42;
  const sun = Math.min(w * (narrow ? 0.62 : 0.34), h * 0.5);
  const rand = random(7);
  const grid = 'rgba(76, 201, 240, 0.35)';
  const starGroups = [0, 1, 2].map(() =>
    Array.from({ length: many(22, w) }, () => ({
      x: rand() * w,
      y: rand() * horizon * 0.85,
      s: (1 + rand() * 1.8) * k,
      o: 0.35 + rand() * 0.6,
    })),
  );
  const scan = k >= 0.8 ? stripes(4, h, 'rgba(0, 0, 0, 0.16)', 0.5) : null;
  const palmH = Math.min(h * (narrow ? 0.5 : 0.6), 520 * k);
  return (
    <>
      {/* Warm haze rising from the horizon */}
      <LinearGradient
        colors={['rgba(247, 37, 133, 0)', 'rgba(247, 37, 133, 0.22)', 'rgba(255, 140, 90, 0.35)']}
        locations={[0, 0.7, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: horizon * 0.35, height: horizon * 0.65 }}
      />
      {starGroups.map((group, g) => (
        <Loop
          key={`g${g}`}
          motion="twinkle"
          duration={2600 + g * 900}
          delay={g * 1100}
          still={still}
          style={StyleSheet.absoluteFill}
        >
          {group.map((s, i) => (
            <Dot key={i} x={s.x} y={s.y} size={s.s} color={`rgba(255,255,255,${s.o})`} />
          ))}
        </Loop>
      ))}
      <ShootingStar
        x={w * 0.62}
        y={h * 0.03}
        length={50 * k}
        angle={28}
        duration={13000}
        delay={9500}
        k={k}
        still={still}
      />
      <ShootingStar
        x={w * 0.2}
        y={h * 0.06}
        length={70 * k}
        angle={18}
        duration={9000}
        delay={3000}
        k={k}
        still={still}
      />

      {/* Sun, with a halo that breathes. */}
      <Loop
        motion="pulse"
        duration={5000}
        still={still}
        style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }}
      >
        <Glow x={w / 2} y={horizon - sun * 0.3} size={sun * 0.8} color="rgba(247, 37, 133, 0.14)" />
      </Loop>
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
        <LinearGradient
          colors={['#ffe29a', '#ffb36b', '#f76b8a', '#f72585']}
          style={StyleSheet.absoluteFill}
        />
        {[0.42, 0.54, 0.65, 0.75, 0.84, 0.92].map((t, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: sun * 0.62 * t,
              height: (1.5 + i * 1.3) * k,
              backgroundColor: '#1a0b3a',
            }}
          />
        ))}
      </View>

      {/* Neon mountains on both sides of the sun */}
      <Range
        base={horizon}
        color="#1d0a45"
        rim="rgba(181, 23, 158, 0.7)"
        k={k}
        peaks={[
          { x: w * 0.08, width: w * 0.36, height: h * 0.12, skew: 0.1 },
          { x: w * 0.27, width: w * 0.3, height: h * 0.08, skew: -0.15 },
          { x: w * 0.76, width: w * 0.32, height: h * 0.09, skew: 0.12 },
          { x: w * 0.95, width: w * 0.4, height: h * 0.14, skew: -0.08 },
        ]}
      />
      <Range
        base={horizon}
        color="#12062e"
        rim={PINK}
        k={k}
        peaks={[
          { x: w * 0.16, width: w * 0.24, height: h * 0.055, skew: -0.2 },
          { x: w * 0.86, width: w * 0.22, height: h * 0.06, skew: 0.2 },
        ]}
      />

      {/* The grid floor */}
      <LinearGradient
        colors={['#1a0b3a', NIGHT, '#05020f']}
        style={{ position: 'absolute', left: 0, right: 0, top: horizon, bottom: 0 }}
      />
      <Loop
        motion="pulse"
        duration={4000}
        delay={500}
        still={still}
        style={{ position: 'absolute', left: 0, right: 0, top: horizon - 1 * k, height: 3 * k }}
      >
        <View style={{ flex: 1, backgroundColor: PINK, boxShadow: `0 0 ${16 * k}px ${3 * k}px ${PINK}` }} />
      </Loop>
      {Array.from({ length: 14 }, (_, i) => {
        const t = (i + 1) / 14;
        return (
          <Line
            key={`h${i}`}
            x1={0}
            y1={horizon + (h - horizon) * t * t}
            x2={w}
            y2={horizon + (h - horizon) * t * t}
            color={i > 9 ? 'rgba(247, 37, 133, 0.45)' : grid}
            width={Math.max(1, k * (0.8 + t))}
          />
        );
      })}
      {Array.from({ length: 21 }, (_, i) => (
        <Line
          key={`v${i}`}
          x1={w / 2 + (i - 10) * w * 0.012}
          y1={horizon}
          x2={w / 2 + (i - 10) * w * 0.22}
          y2={h}
          color={grid}
          width={Math.max(1, k * 1.2)}
        />
      ))}
      {/* Haze over the far end of the grid */}
      <LinearGradient
        colors={['rgba(247, 37, 133, 0.35)', 'rgba(26, 11, 58, 0)']}
        style={{ position: 'absolute', left: 0, right: 0, top: horizon, height: (h - horizon) * 0.22 }}
      />

      <Palm
        x={w * (narrow ? 0.02 : 0.04)}
        base={h + 10 * k}
        height={palmH}
        lean={w * 0.06}
        k={k}
        still={still}
      />
      <Palm
        x={w * (narrow ? 0.98 : 0.96)}
        base={h + 10 * k}
        height={palmH * 0.86}
        lean={w * 0.05}
        k={k}
        flip
        still={still}
      />
      {!narrow && (
        <Palm x={w * 0.12} base={h + 10 * k} height={palmH * 0.7} lean={-w * 0.03} k={k} still={still} />
      )}

      {/* CRT scanlines over everything */}
      {scan && (
        <LinearGradient
          colors={scan.colors}
          locations={scan.locations}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.4)']}
        locations={[0, 0.15, 0.85, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </>
  );
}
