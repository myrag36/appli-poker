// A beach bar at sunset: string lights under the thatch, palm trees, the sun setting on the sea,
// and cocktails on the bamboo counter.
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type DecorProps, Cross, Flame, Glow, Line, Loop, Tri, random, tiny } from './kit';

const PALM = '#24121e';
const BULBS = ['#fff1c2', '#ffb347', '#ff7aa8', '#7ee0d6', '#ffe08a'];

/** A palm tree drawn as a silhouette against the sunset, its leaves swaying in the breeze. */
function Palm({
  bx,
  by,
  cx,
  cy,
  k,
  size,
  still,
  delay,
}: {
  bx: number;
  by: number;
  cx: number;
  cy: number;
  k: number;
  size: number;
  still: boolean;
  delay: number;
}) {
  // The trunk follows a curve from its base to the crown, thinner at the top.
  const mx = (bx + cx) / 2 + (bx - cx) * 0.35;
  const my = (by + cy) / 2;
  const segs = 14;
  const at = (t: number) => ({
    x: (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * mx + t * t * cx,
    y: (1 - t) * (1 - t) * by + 2 * (1 - t) * t * my + t * t * cy,
  });
  const len = 120 * size * k;
  const fronds = [-170, -140, -105, -70, -35, -8, 20, 160, 195].map((deg, i) => ({
    a: (deg * Math.PI) / 180,
    l: len * (0.75 + ((i * 37) % 10) / 30),
  }));
  return (
    <>
      {Array.from({ length: segs }, (_, i) => {
        const p = at(i / segs);
        const q = at((i + 1) / segs);
        const thick = (20 - (i / segs) * 9) * size * k;
        const l = Math.hypot(q.x - p.x, q.y - p.y) + 2 * k;
        const ang = Math.atan2(q.y - p.y, q.x - p.x);
        return (
          <View
            key={`t${i}`}
            style={{
              position: 'absolute',
              left: (p.x + q.x) / 2 - l / 2,
              top: (p.y + q.y) / 2 - thick / 2,
              width: l,
              height: thick,
              borderRadius: thick / 3,
              backgroundColor: PALM,
              borderTopWidth: Math.max(1, 1.5 * k),
              borderColor: 'rgba(255, 140, 90, 0.22)',
              borderRightWidth: Math.max(1, 1.5 * k),
              borderRightColor: 'rgba(0,0,0,0.5)',
              transform: [{ rotate: `${ang}rad` }],
            }}
          />
        );
      })}
      {/* Coconuts under the crown. */}
      {[
        [-8, 6],
        [6, 8],
        [-1, 14],
      ].map(([dx, dy], i) => (
        <View
          key={`c${i}`}
          style={{
            position: 'absolute',
            left: cx + dx * size * k - 7 * size * k,
            top: cy + dy * size * k - 7 * size * k,
            width: 14 * size * k,
            height: 14 * size * k,
            borderRadius: 7 * size * k,
            backgroundColor: '#1a0c14',
          }}
        />
      ))}
      <Loop
        motion="sway"
        duration={5200}
        delay={delay}
        still={still}
        style={{
          position: 'absolute',
          left: cx - len * 1.3,
          top: cy - len * 1.3,
          width: len * 2.6,
          height: len * 2.6,
        }}
      >
        {fronds.map((f, i) => {
          const pts = Array.from({ length: 7 }, (_, j) => {
            const t = j / 6;
            return {
              x: len * 1.3 + Math.cos(f.a) * f.l * t,
              y: len * 1.3 + Math.sin(f.a) * f.l * t + f.l * 0.55 * t * t,
            };
          });
          return (
            <View key={i}>
              {pts.slice(1).map((p, j) => {
                const o = pts[j];
                const dx = p.x - o.x;
                const dy = p.y - o.y;
                const n = Math.hypot(dx, dy) || 1;
                // Leaflets hang down from both sides of the rib, shorter towards the tip.
                const leaf = (30 - j * 3.8) * size * k;
                return (
                  <View key={j}>
                    <Line
                      x1={o.x}
                      y1={o.y}
                      x2={p.x}
                      y2={p.y}
                      color={PALM}
                      width={(3.5 - j * 0.4) * size * k}
                    />
                    {[0.25, 0.75].map((f) =>
                      [-1, 1].map((s) => {
                        const mx = o.x + dx * f;
                        const my = o.y + dy * f;
                        return (
                          <Line
                            key={`${f}${s}`}
                            x1={mx}
                            y1={my}
                            x2={mx + ((-dy / n) * s * 0.55 + (dx / n) * 0.45) * leaf}
                            y2={my + ((dx / n) * s * 0.55 + 0.9) * leaf * 0.75}
                            color={PALM}
                            width={(7.5 - j * 0.8) * size * k}
                          />
                        );
                      }),
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}
      </Loop>
    </>
  );
}

/** A string of colored bulbs hanging in a curve between two hooks. */
function Lights({
  x1,
  x2,
  y,
  sag,
  k,
  still,
  seed,
}: {
  x1: number;
  x2: number;
  y: number;
  sag: number;
  k: number;
  still: boolean;
  seed: number;
}) {
  const at = (t: number) => ({ x: x1 + (x2 - x1) * t, y: y + sag * 4 * t * (1 - t) });
  const n = Math.max(4, Math.round((x2 - x1) / (30 * k)));
  const wire = Array.from({ length: 10 }, (_, i) => [at(i / 10), at((i + 1) / 10)]);
  const bulbs = Array.from({ length: n }, (_, i) => ({
    ...at((i + 0.5) / n),
    c: BULBS[(i + seed) % BULBS.length],
  }));
  return (
    <>
      {wire.map(([a, b], i) => (
        <Line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} color="#1a1010" width={1.5 * k} />
      ))}
      {[0, 1, 2].map((g) => (
        <Loop
          key={g}
          motion="twinkle"
          duration={2400 + g * 900}
          delay={g * 700 + seed * 300}
          still={still}
          style={StyleSheet.absoluteFill}
        >
          {bulbs
            .filter((_, i) => i % 3 === g)
            .map((b, i) => (
              <View key={i}>
                <View
                  style={{
                    position: 'absolute',
                    left: b.x - 2.5 * k,
                    top: b.y - 1 * k,
                    width: 5 * k,
                    height: 4 * k,
                    backgroundColor: '#2a2020',
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    left: b.x - 4 * k,
                    top: b.y + 2 * k,
                    width: 8 * k,
                    height: 11 * k,
                    borderRadius: 5 * k,
                    backgroundColor: b.c,
                    boxShadow: `0 0 ${10 * k}px ${3 * k}px ${b.c}`,
                    opacity: 0.95,
                  }}
                />
              </View>
            ))}
        </Loop>
      ))}
    </>
  );
}

/** A cocktail in a stemmed glass, with a paper umbrella, a straw and a slice of lime. */
function Cocktail({
  x,
  bottom,
  k,
  liquid,
  umbrella,
}: {
  x: number;
  bottom: number;
  k: number;
  liquid: string;
  umbrella: string;
}) {
  const gw = 34 * k;
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: x - 14 * k,
          top: bottom - 3 * k,
          width: 28 * k,
          height: 5 * k,
          borderRadius: 14 * k,
          backgroundColor: 'rgba(0,0,0,0.35)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: x - 10 * k,
          top: bottom - 4 * k,
          width: 20 * k,
          height: 4 * k,
          borderRadius: 3 * k,
          backgroundColor: 'rgba(255,255,255,0.55)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: x - 1.5 * k,
          top: bottom - 26 * k,
          width: 3 * k,
          height: 23 * k,
          backgroundColor: 'rgba(255,255,255,0.5)',
        }}
      />
      {/* The straw and the umbrella, behind the glass's rim. */}
      <Line
        x1={x + 4 * k}
        y1={bottom - 40 * k}
        x2={x + 14 * k}
        y2={bottom - 66 * k}
        color="#ff5d8f"
        width={2.5 * k}
      />
      <Line
        x1={x - 6 * k}
        y1={bottom - 40 * k}
        x2={x - 16 * k}
        y2={bottom - 62 * k}
        color="#d9b98a"
        width={1.5 * k}
      />
      <View
        style={{
          position: 'absolute',
          left: x - 34 * k,
          top: bottom - 74 * k,
          width: 34 * k,
          height: 17 * k,
          borderTopLeftRadius: 17 * k,
          borderTopRightRadius: 17 * k,
          backgroundColor: umbrella,
          overflow: 'hidden',
          transform: [{ rotate: '-24deg' }],
        }}
      >
        {[0.25, 0.5, 0.75].map((p) => (
          <View
            key={p}
            style={{
              position: 'absolute',
              left: 34 * k * p,
              top: 0,
              bottom: 0,
              width: Math.max(1, k),
              backgroundColor: 'rgba(255,255,255,0.45)',
            }}
          />
        ))}
      </View>
      {/* The glass bowl: a wide triangle filled with the drink. */}
      <Tri x={x} y={bottom - 26 * k} width={gw} height={20 * k} color="rgba(255,255,255,0.35)" down />
      <View
        style={{
          position: 'absolute',
          left: x - gw / 2,
          top: bottom - 46 * k,
          width: gw,
          height: 20 * k,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 3 * k,
            width: 0,
            height: 0,
            borderLeftWidth: gw / 2,
            borderRightWidth: gw / 2,
            borderTopWidth: 17 * k,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: liquid,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 3 * k,
            backgroundColor: 'rgba(255,255,255,0.6)',
          }}
        />
      </View>
      <View
        style={{
          position: 'absolute',
          left: x + gw / 2 - 9 * k,
          top: bottom - 54 * k,
          width: 16 * k,
          height: 16 * k,
          borderRadius: 8 * k,
          backgroundColor: '#9ad04a',
          borderWidth: 2 * k,
          borderColor: '#4f8a1e',
        }}
      />
    </>
  );
}

/** Half a coconut with a straw, and a little pineapple. */
function Coconut({ x, bottom, k }: { x: number; bottom: number; k: number }) {
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: x - 18 * k,
          top: bottom - 3 * k,
          width: 36 * k,
          height: 6 * k,
          borderRadius: 18 * k,
          backgroundColor: 'rgba(0,0,0,0.35)',
        }}
      />
      <Line
        x1={x + 2 * k}
        y1={bottom - 26 * k}
        x2={x + 12 * k}
        y2={bottom - 52 * k}
        color="#7ee0d6"
        width={3 * k}
      />
      <View
        style={{
          position: 'absolute',
          left: x - 17 * k,
          top: bottom - 28 * k,
          width: 34 * k,
          height: 28 * k,
          borderBottomLeftRadius: 17 * k,
          borderBottomRightRadius: 17 * k,
          borderTopLeftRadius: 4 * k,
          borderTopRightRadius: 4 * k,
          overflow: 'hidden',
        }}
      >
        <LinearGradient colors={['#6a4428', '#3e2412']} style={StyleSheet.absoluteFill} />
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 4 * k,
            backgroundColor: '#f4ead8',
          }}
        />
      </View>
      <View
        style={{
          position: 'absolute',
          left: x + 24 * k,
          top: bottom - 34 * k,
          width: 22 * k,
          height: 34 * k,
          borderRadius: 10 * k,
          overflow: 'hidden',
        }}
      >
        <LinearGradient colors={['#e8a93a', '#b8741c']} style={StyleSheet.absoluteFill} />
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: -6 * k,
              top: i * 9 * k,
              width: 34 * k,
              height: Math.max(1, k),
              backgroundColor: 'rgba(90, 50, 10, 0.5)',
              transform: [{ rotate: '35deg' }],
            }}
          />
        ))}
      </View>
      {[-30, -10, 10, 30].map((a, i) => (
        <View
          key={a}
          style={{
            position: 'absolute',
            left: x + 35 * k - 3 * k,
            top: bottom - 52 * k + Math.abs(a) * 0.12 * k,
            width: 6 * k,
            height: (20 - Math.abs(i - 1.5) * 3) * k,
            borderRadius: 3 * k,
            backgroundColor: i % 2 ? '#3f8a3a' : '#2e6e2c',
            transform: [{ rotate: `${a}deg` }],
          }}
        />
      ))}
    </>
  );
}

/** A tiki torch planted in the sand. */
function Tiki({
  x,
  bottom,
  k,
  still,
  delay,
}: {
  x: number;
  bottom: number;
  k: number;
  still: boolean;
  delay: number;
}) {
  return (
    <>
      <Loop
        motion="flicker"
        duration={1900}
        delay={delay}
        still={still}
        style={{
          position: 'absolute',
          left: x - 60 * k,
          top: bottom - 150 * k,
          width: 120 * k,
          height: 120 * k,
        }}
      >
        <Glow x={60 * k} y={60 * k} size={50 * k} color="rgba(255, 150, 60, 0.22)" />
      </Loop>
      <View
        style={{
          position: 'absolute',
          left: x - 3 * k,
          top: bottom - 100 * k,
          width: 6 * k,
          height: 100 * k,
          backgroundColor: '#2a1608',
        }}
      />
      {[0.2, 0.4].map((p) => (
        <View
          key={p}
          style={{
            position: 'absolute',
            left: x - 4 * k,
            top: bottom - 100 * k + 100 * k * p,
            width: 8 * k,
            height: 3 * k,
            backgroundColor: '#5a3a1a',
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: x - 7 * k,
          top: bottom - 116 * k,
          width: 14 * k,
          height: 18 * k,
          borderRadius: 3 * k,
          backgroundColor: '#4a2c14',
          borderWidth: Math.max(1, k),
          borderColor: '#2a1608',
        }}
      >
        {[0.3, 0.6].map((p) => (
          <View
            key={p}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 18 * k * p,
              height: Math.max(1, k),
              backgroundColor: '#8a6232',
            }}
          />
        ))}
      </View>
      <Loop
        motion="flicker"
        duration={650}
        delay={delay}
        still={still}
        style={{
          position: 'absolute',
          left: x - 14 * k,
          top: bottom - 150 * k,
          width: 28 * k,
          height: 36 * k,
        }}
      >
        <Flame x={14 * k} y={35 * k} size={14 * k} color="rgba(240, 90, 30, 0.9)" stretch={1.8} />
        <Flame x={14 * k} y={34 * k} size={9 * k} color="#ffb347" stretch={1.6} />
        <Flame x={14 * k} y={33 * k} size={5 * k} color="#fff2c0" stretch={1.4} />
      </Loop>
    </>
  );
}

/** A bamboo post, with the knots of the cane. */
function Bamboo({
  x,
  top,
  bottom,
  width,
  k,
}: {
  x: number;
  top: number;
  bottom: number;
  width: number;
  k: number;
}) {
  const knots = Math.floor((bottom - top) / (70 * k));
  return (
    <View
      style={{
        position: 'absolute',
        left: x - width / 2,
        top,
        width,
        height: bottom - top,
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={['#3a2410', '#8a6a34', '#c2a060', '#8a6a34', '#3a2410']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {Array.from({ length: knots + 1 }, (_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: i * 70 * k + 30 * k,
            height: 4 * k,
            backgroundColor: 'rgba(40, 24, 8, 0.75)',
            borderTopWidth: Math.max(1, k),
            borderColor: 'rgba(230, 200, 140, 0.45)',
          }}
        />
      ))}
    </View>
  );
}

export function Plage({ w, h, k }: DecorProps) {
  const still = tiny(w);
  const land = w > h * 1.1;
  const horizon = h * (land ? 0.55 : 0.56);
  const shore = h * (land ? 0.69 : 0.7);
  const counter = h * (land ? 0.85 : 0.87);
  const sunR = Math.min(w, h) * (land ? 0.12 : 0.17);
  const sunX = w * 0.5;
  const thatch = h * (land ? 0.05 : 0.055);
  const rand = random(57);

  const glitter = Array.from({ length: 26 }, (_, i) => {
    const t = (i + 1) / 26;
    return {
      y: horizon + 3 * k + (shore - horizon - 10 * k) * t,
      width: sunR * (0.8 + 1.6 * t) * (0.4 + rand() * 0.7),
      dx: (rand() - 0.5) * sunR * 0.8 * t,
      group: i % 2,
    };
  });
  const strands = Array.from({ length: Math.ceil(w / (5 * k)) }, (_, i) => ({
    x: i * 5 * k + rand() * 3 * k,
    l: (land ? 10 + rand() * 14 : 14 + rand() * 22) * k,
    c: ['#7a5428', '#9a7038', '#5a3c1a', '#b08440'][(rand() * 4) | 0],
    a: (rand() - 0.5) * 10,
  }));
  const hooks = land ? [0, 0.2, 0.4, 0.6, 0.8, 1] : [0, 0.34, 0.67, 1];

  return (
    <>
      {/* The sunset sky. */}
      <LinearGradient
        colors={['#2a1440', '#6a2a62', '#c24a6a', '#ff8a4a', '#ffc96a']}
        locations={[0, 0.3, 0.6, 0.85, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: horizon }}
      />
      {Array.from({ length: 30 }, (_, i) => (
        <View
          key={`st${i}`}
          style={{
            position: 'absolute',
            left: rand() * w,
            top: rand() * horizon * 0.3,
            width: 1.5 * k,
            height: 1.5 * k,
            borderRadius: k,
            backgroundColor: `rgba(255,255,255,${0.2 + rand() * 0.4})`,
          }}
        />
      ))}
      {/* Long thin clouds lit pink from below, drifting slowly. */}
      <Cross
        top={horizon * 0.35}
        width={w}
        height={horizon * 0.5}
        duration={land ? 200000 : 140000}
        still={still}
      >
        {[
          [0.05, 0.1, 0.38],
          [0.5, 0.0, 0.3],
          [0.3, 0.45, 0.45],
          [0.75, 0.6, 0.28],
          [-0.05, 0.75, 0.22],
        ].map(([cx, cy, cw], i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: w * cx,
              top: horizon * 0.5 * cy,
              width: w * cw,
              height: 26 * k,
            }}
          >
            {[
              [0, 12, 1, 10],
              [0.15, 5, 0.45, 14],
              [0.45, 8, 0.4, 11],
            ].map(([px, py, pw, ph], j) => (
              <View
                key={j}
                style={{
                  position: 'absolute',
                  left: w * cw * px,
                  top: py * k,
                  width: w * cw * pw,
                  height: ph * k,
                  borderRadius: 10 * k,
                  backgroundColor: i % 2 ? 'rgba(110, 44, 92, 0.8)' : 'rgba(140, 56, 104, 0.75)',
                  borderBottomWidth: 2 * k,
                  borderColor: 'rgba(255, 170, 120, 0.75)',
                }}
              />
            ))}
          </View>
        ))}
      </Cross>
      {/* The sun, half sunk into the sea. */}
      <Glow x={sunX} y={horizon} size={sunR * 3} color="rgba(255, 170, 90, 0.22)" />
      <View
        style={{
          position: 'absolute',
          left: sunX - sunR,
          top: horizon - sunR,
          width: sunR * 2,
          height: sunR,
          borderTopLeftRadius: sunR,
          borderTopRightRadius: sunR,
          overflow: 'hidden',
          boxShadow: `0 0 ${40 * k}px rgba(255, 190, 100, 0.7)`,
        }}
      >
        <LinearGradient colors={['#fff2b0', '#ffc860', '#ff8a3a']} style={StyleSheet.absoluteFill} />
      </View>
      {/* Birds crossing the sky. */}
      <Cross
        top={horizon * 0.25}
        width={w}
        height={horizon * 0.3}
        duration={land ? 60000 : 38000}
        still={still}
      >
        {[
          [0.1, 0.3, 1],
          [0.16, 0.18, 0.8],
          [0.2, 0.42, 0.7],
          [0.62, 0.6, 0.9],
        ].map(([bx, by, s], i) => (
          <View key={i}>
            <Line
              x1={w * bx}
              y1={horizon * 0.3 * by}
              x2={w * bx + 7 * s * k}
              y2={horizon * 0.3 * by + 4 * s * k}
              color="#2a1028"
              width={1.6 * k}
            />
            <Line
              x1={w * bx + 7 * s * k}
              y1={horizon * 0.3 * by + 4 * s * k}
              x2={w * bx + 14 * s * k}
              y2={horizon * 0.3 * by}
              color="#2a1028"
              width={1.6 * k}
            />
          </View>
        ))}
      </Cross>

      {/* The sea, warm near the sun and deep blue further out. */}
      <LinearGradient
        colors={['#e8805a', '#a24a6a', '#4a2a6a', '#2a2050']}
        locations={[0, 0.25, 0.65, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: horizon, height: shore - horizon }}
      />
      {/* An island and a sailboat on the horizon. */}
      <View
        style={{
          position: 'absolute',
          left: w * (land ? 0.76 : 0.7),
          top: horizon - 12 * k,
          width: 110 * k,
          height: 24 * k,
          borderTopLeftRadius: 60 * k,
          borderTopRightRadius: 40 * k,
          backgroundColor: '#5a2a4a',
        }}
      />
      {[18, 34].map((dx, i) => (
        <View key={dx}>
          <Line
            x1={w * (land ? 0.76 : 0.7) + dx * k}
            y1={horizon - 8 * k}
            x2={w * (land ? 0.76 : 0.7) + (dx + 3) * k}
            y2={horizon - (26 - i * 5) * k}
            color="#5a2a4a"
            width={1.5 * k}
          />
          {[-2.4, -1.4, -0.4, 0.6].map((a) => (
            <Line
              key={a}
              x1={w * (land ? 0.76 : 0.7) + (dx + 3) * k}
              y1={horizon - (26 - i * 5) * k}
              x2={w * (land ? 0.76 : 0.7) + (dx + 3) * k + Math.cos(a) * 9 * k}
              y2={horizon - (26 - i * 5) * k + Math.abs(Math.sin(a)) * 3 * k}
              color="#5a2a4a"
              width={1.8 * k}
            />
          ))}
        </View>
      ))}
      <View
        style={{
          position: 'absolute',
          left: w * 0.22,
          top: horizon - 4 * k,
          width: 26 * k,
          height: 5 * k,
          borderBottomLeftRadius: 8 * k,
          borderBottomRightRadius: 8 * k,
          backgroundColor: '#4a1e3a',
        }}
      />
      <Tri x={w * 0.22 + 12 * k} y={horizon - 4 * k} width={16 * k} height={22 * k} color="#4a1e3a" />
      {[0, 1].map((g) => (
        <Loop
          key={`g${g}`}
          motion="pulse"
          duration={2600}
          delay={g * 1300}
          still={still}
          style={StyleSheet.absoluteFill}
        >
          {glitter
            .filter((r) => r.group === g)
            .map((r, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: sunX + r.dx - r.width / 2,
                  top: r.y,
                  width: r.width,
                  height: Math.max(1.5, 2.5 * k),
                  borderRadius: 2 * k,
                  backgroundColor: 'rgba(255, 220, 140, 0.7)',
                }}
              />
            ))}
        </Loop>
      ))}
      {Array.from({ length: 9 }, (_, row) => {
        const t = (row + 1) / 9;
        const y = horizon + (shore - horizon) * t * t;
        return Array.from({ length: Math.ceil(w / ((20 + 50 * t) * k * 2)) + 1 }, (_, i) => (
          <View
            key={`wv${row}-${i}`}
            style={{
              position: 'absolute',
              left: (i + (row % 2) * 0.5) * (20 + 50 * t) * k * 2 - 10 * k,
              top: y,
              width: (20 + 50 * t) * k * 1.3,
              height: 4 * k,
              borderRadius: 20 * k,
              borderTopWidth: Math.max(1, t * 2 * k),
              borderColor: 'rgba(255, 190, 170, 0.18)',
            }}
          />
        ));
      })}

      {/* The beach, with foam washing in and out. */}
      <LinearGradient
        colors={['#d99a6a', '#b0704a', '#7a4a32']}
        style={{ position: 'absolute', left: 0, right: 0, top: shore, height: counter - shore }}
      />
      <Loop motion="pulse" duration={5200} still={still} style={StyleSheet.absoluteFill}>
        <View
          style={{
            position: 'absolute',
            left: -10 * k,
            right: -10 * k,
            top: shore - 3 * k,
            height: 9 * k,
            borderRadius: 10 * k,
            backgroundColor: 'rgba(255, 240, 230, 0.55)',
          }}
        />
        {Array.from({ length: Math.ceil(w / (40 * k)) }, (_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: i * 40 * k,
              top: shore + 4 * k,
              width: 34 * k,
              height: 8 * k,
              borderBottomLeftRadius: 20 * k,
              borderBottomRightRadius: 20 * k,
              borderBottomWidth: 2 * k,
              borderColor: 'rgba(255, 240, 230, 0.4)',
            }}
          />
        ))}
      </Loop>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: shore + 5 * k,
          height: 10 * k,
          backgroundColor: 'rgba(90, 50, 40, 0.25)',
        }}
      />
      {Array.from({ length: 24 }, (_, i) => (
        <View
          key={`sd${i}`}
          style={{
            position: 'absolute',
            left: rand() * w,
            top: shore + 18 * k + rand() * (counter - shore - 20 * k),
            width: (3 + rand() * 6) * k,
            height: 1.5 * k,
            borderRadius: k,
            backgroundColor: 'rgba(90, 50, 30, 0.4)',
          }}
        />
      ))}
      {/* A starfish and a shell in the sand. */}
      <View style={{ position: 'absolute', left: w * 0.28, top: counter - 24 * k }}>
        {Array.from({ length: 5 }, (_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: -2.5 * k,
              top: -10 * k,
              width: 5 * k,
              height: 11 * k,
              borderRadius: 3 * k,
              backgroundColor: '#ff7a5a',
              transform: [{ rotate: `${i * 72}deg` }, { translateY: -5 * k }],
            }}
          />
        ))}
      </View>
      <View
        style={{
          position: 'absolute',
          left: w * 0.62,
          top: counter - 20 * k,
          width: 16 * k,
          height: 12 * k,
          borderTopLeftRadius: 8 * k,
          borderTopRightRadius: 8 * k,
          backgroundColor: '#f6e2cf',
          borderBottomWidth: 2 * k,
          borderColor: '#c9a68a',
        }}
      />

      {/* Palm trees on the beach, and tiki torches. */}
      <Palm
        bx={w * (land ? 0.14 : 0.16)}
        by={shore + 30 * k}
        cx={w * (land ? 0.2 : 0.3)}
        cy={h * (land ? 0.2 : 0.17)}
        k={k}
        size={land ? 1.25 : 0.95}
        still={still}
        delay={0}
      />
      <Palm
        bx={w * (land ? 0.9 : 0.92)}
        by={shore + 40 * k}
        cx={w * (land ? 0.82 : 0.76)}
        cy={h * (land ? 0.26 : 0.22)}
        k={k}
        size={land ? 1.1 : 0.85}
        still={still}
        delay={1800}
      />
      {land && (
        <Palm
          bx={w * 0.95}
          by={shore + 26 * k}
          cx={w * 0.97}
          cy={h * 0.36}
          k={k}
          size={0.8}
          still={still}
          delay={900}
        />
      )}
      <Tiki x={w * (land ? 0.06 : 0.07)} bottom={counter - 6 * k} k={k} still={still} delay={0} />
      <Tiki x={w * (land ? 0.94 : 0.93)} bottom={counter - 6 * k} k={k} still={still} delay={700} />

      {/* The thatched roof of the bar, with string lights hanging from it. */}
      <Bamboo x={8 * k} top={0} bottom={counter} width={16 * k} k={k} />
      <Bamboo x={w - 8 * k} top={0} bottom={counter} width={16 * k} k={k} />
      <LinearGradient
        colors={['#2a1808', '#4a2e14', '#6a4420']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: thatch }}
      />
      {strands.map((s, i) => (
        <View
          key={`th${i}`}
          style={{
            position: 'absolute',
            left: s.x,
            top: thatch - 4 * k,
            width: 3 * k,
            height: s.l,
            borderBottomLeftRadius: 2 * k,
            borderBottomRightRadius: 2 * k,
            backgroundColor: s.c,
            transform: [{ rotate: `${s.a}deg` }],
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: thatch - 6 * k,
          height: 5 * k,
          backgroundColor: '#3a2410',
        }}
      />
      {hooks.slice(1).map((p, i) => (
        <Lights
          key={i}
          x1={w * hooks[i]}
          x2={w * p}
          y={thatch + 8 * k}
          sag={(land ? 38 : 30) * k}
          k={k}
          still={still}
          seed={i}
        />
      ))}

      {/* The bar counter in front, with drinks on it. */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: counter, bottom: 0, overflow: 'hidden' }}>
        <LinearGradient colors={['#6a4420', '#3a2410']} style={StyleSheet.absoluteFill} />
        {Array.from({ length: Math.ceil(w / (22 * k)) + 1 }, (_, i) => (
          <LinearGradient
            key={i}
            colors={['#4a3014', '#a07a40', '#c8a060', '#7a5a2a', '#3a2410']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', left: i * 22 * k, top: 12 * k, bottom: 0, width: 20 * k }}
          />
        ))}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 30 * k,
            height: 3 * k,
            backgroundColor: '#2a1808',
          }}
        />
        <LinearGradient
          colors={['rgba(20,8,16,0)', 'rgba(20,8,16,0.55)']}
          style={{ position: 'absolute', left: 0, right: 0, top: 12 * k, bottom: 0 }}
        />
      </View>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: counter - 4 * k,
          height: 14 * k,
          borderRadius: 3 * k,
          overflow: 'hidden',
          boxShadow: `0 ${3 * k}px ${6 * k}px rgba(0,0,0,0.5)`,
        }}
      >
        <LinearGradient colors={['#d8a868', '#8a5a2a']} style={StyleSheet.absoluteFill} />
      </View>
      <Cocktail
        x={w * (land ? 0.12 : 0.14)}
        bottom={counter + 2 * k}
        k={k}
        liquid="#ff8a3a"
        umbrella="#ff5d8f"
      />
      <Cocktail
        x={w * (land ? 0.88 : 0.86)}
        bottom={counter + 2 * k}
        k={k}
        liquid="#5ad0e0"
        umbrella="#ffd166"
      />
      {land && <Cocktail x={w * 0.2} bottom={counter + 2 * k} k={k} liquid="#e84a6a" umbrella="#7ee0d6" />}
      <Coconut x={w * (land ? 0.78 : 0.66)} bottom={counter + 2 * k} k={k} />
    </>
  );
}
