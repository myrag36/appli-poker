// Jardin zen: a Japanese garden at sunrise, with cherry branches, a torii, lanterns and a koi pond.
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Dot, Drift, Glow, Haze, Line, Loop, Pivot, type SceneProps, Tri, random, tiny } from './classic-kit';

const VERMILION = '#c8332b';
const BLOSSOM = ['#ffd1dc', '#ffb4c8', '#ff9fb8', '#ffe4ec'];

/** A torii gate: two pillars, the upturned top beam and the tie beam. */
function Torii({ x, base, s }: { x: number; base: number; s: number }) {
  const span = 120 * s;
  const tall = 150 * s;
  const pillar = 11 * s;
  return (
    <>
      {[-1, 1].map((side) => (
        <View
          key={side}
          style={{
            position: 'absolute',
            left: x + (side * span) / 2 - pillar / 2,
            top: base - tall,
            width: pillar,
            height: tall,
            backgroundColor: VERMILION,
            borderLeftWidth: 3 * s,
            borderColor: '#e2574c',
          }}
        />
      ))}
      {[-1, 1].map((side) => (
        <View
          key={`f${side}`}
          style={{
            position: 'absolute',
            left: x + (side * span) / 2 - pillar * 0.8,
            top: base - 10 * s,
            width: pillar * 1.6,
            height: 10 * s,
            backgroundColor: '#1a1210',
          }}
        />
      ))}
      {/* Tie beam (nuki) and plaque */}
      <View
        style={{
          position: 'absolute',
          left: x - span / 2 - 14 * s,
          top: base - tall + 30 * s,
          width: span + 28 * s,
          height: 8 * s,
          backgroundColor: VERMILION,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: x - 6 * s,
          top: base - tall + 8 * s,
          width: 12 * s,
          height: 22 * s,
          backgroundColor: '#1a1210',
          borderWidth: 1.5 * s,
          borderColor: '#d4a64a',
        }}
      />
      {/* Top beam (kasagi), black on top, ends curving up */}
      <View
        style={{
          position: 'absolute',
          left: x - span / 2 - 30 * s,
          top: base - tall - 6 * s,
          width: span + 60 * s,
          height: 12 * s,
          backgroundColor: VERMILION,
          borderBottomLeftRadius: 4 * s,
          borderBottomRightRadius: 4 * s,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: x - span / 2 - 36 * s,
          top: base - tall - 13 * s,
          width: span + 72 * s,
          height: 8 * s,
          backgroundColor: '#1a1210',
          borderTopLeftRadius: 40 * s,
          borderTopRightRadius: 40 * s,
        }}
      />
      <Tri
        x={x - span / 2 - 36 * s}
        y={base - tall - 6 * s}
        width={10 * s}
        height={10 * s}
        color="#1a1210"
        skew={-0.5}
      />
      <Tri
        x={x + span / 2 + 36 * s}
        y={base - tall - 6 * s}
        width={10 * s}
        height={10 * s}
        color="#1a1210"
        skew={0.5}
      />
    </>
  );
}

/** A stone lantern (tōrō), its window glowing. */
function StoneLantern({ x, base, s, still }: { x: number; base: number; s: number; still?: boolean }) {
  const stone = '#5d5560';
  const dark = '#3c3640';
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: x - 22 * s,
          top: base - 10 * s,
          width: 44 * s,
          height: 10 * s,
          backgroundColor: dark,
          borderRadius: 2 * s,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: x - 7 * s,
          top: base - 50 * s,
          width: 14 * s,
          height: 40 * s,
          backgroundColor: stone,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: x - 18 * s,
          top: base - 58 * s,
          width: 36 * s,
          height: 8 * s,
          backgroundColor: dark,
          borderRadius: 2 * s,
        }}
      />
      <Loop
        motion="flicker"
        duration={2600}
        delay={x}
        still={still}
        style={{ position: 'absolute', left: x - 40 * s, top: base - 112 * s, width: 80 * s, height: 80 * s }}
      >
        <Glow x={40 * s} y={40 * s} size={26 * s} color="rgba(255, 190, 110, 0.28)" />
      </Loop>
      <View
        style={{
          position: 'absolute',
          left: x - 14 * s,
          top: base - 84 * s,
          width: 28 * s,
          height: 26 * s,
          backgroundColor: stone,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 12 * s,
            height: 14 * s,
            backgroundColor: '#ffcf85',
            boxShadow: `0 0 ${8 * s}px ${2 * s}px rgba(255, 190, 110, 0.7)`,
          }}
        />
      </View>
      {/* Roof */}
      <Tri x={x} y={base - 84 * s} width={58 * s} height={18 * s} color={dark} />
      <View
        style={{
          position: 'absolute',
          left: x - 30 * s,
          top: base - 88 * s,
          width: 60 * s,
          height: 5 * s,
          borderRadius: 3 * s,
          backgroundColor: '#4a4350',
        }}
      />
      <Dot x={x} y={base - 105 * s} size={9 * s} color={dark} />
    </>
  );
}

/** A red paper lantern (chōchin), hanging and swaying. */
function PaperLantern({
  x,
  y,
  s,
  delay,
  still,
}: {
  x: number;
  y: number;
  s: number;
  delay: number;
  still?: boolean;
}) {
  const lw = 26 * s;
  const lh = 34 * s;
  const len = 20 * s + lh + 8 * s;
  return (
    <Pivot x={x} y={y} width={lw * 3} length={len} amp={4} duration={4800} delay={delay} still={still}>
      <Line x1={lw * 1.5} y1={0} x2={lw * 1.5} y2={20 * s} color="rgba(30, 20, 20, 0.9)" width={1.2 * s} />
      <Glow x={lw * 1.5} y={20 * s + lh / 2 + 4 * s} size={lw * 0.9} color="rgba(255, 120, 90, 0.22)" />
      <View
        style={{
          position: 'absolute',
          left: lw * 1.5 - lw * 0.3,
          top: 18 * s,
          width: lw * 0.6,
          height: 5 * s,
          backgroundColor: '#1a1210',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: lw,
          top: 22 * s,
          width: lw,
          height: lh,
          borderRadius: lw / 2,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={['#ff6b4a', '#e0362a', '#9c1d18']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        {[0.2, 0.35, 0.5, 0.65, 0.8].map((t) => (
          <View
            key={t}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: lh * t,
              height: Math.max(0.6, 0.8 * s),
              backgroundColor: 'rgba(60, 10, 10, 0.4)',
            }}
          />
        ))}
      </View>
      <View
        style={{
          position: 'absolute',
          left: lw * 1.5 - lw * 0.3,
          top: 20 * s + lh,
          width: lw * 0.6,
          height: 5 * s,
          backgroundColor: '#1a1210',
        }}
      />
      <Line x1={lw * 1.5} y1={25 * s + lh} x2={lw * 1.5} y2={33 * s + lh} color="#e8b04a" width={2 * s} />
    </Pivot>
  );
}

/** A koi carp seen from above: body, white patches and tail. */
function Koi({
  x,
  y,
  s,
  angle,
  colors,
}: {
  x: number;
  y: number;
  s: number;
  angle: number;
  colors: [string, string];
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left: x - 16 * s,
        top: y - 5 * s,
        width: 32 * s,
        height: 10 * s,
        transform: [{ rotate: `${angle}deg` }],
      }}
    >
      <Tri x={3 * s} y={5 * s - 6 * s} width={12 * s} height={9 * s} color={colors[0]} down skew={-0.3} />
      <View
        style={{
          position: 'absolute',
          left: 6 * s,
          top: 0,
          width: 24 * s,
          height: 10 * s,
          borderRadius: 5 * s,
          backgroundColor: colors[0],
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: 6 * s,
            top: -2 * s,
            width: 8 * s,
            height: 8 * s,
            borderRadius: 4 * s,
            backgroundColor: colors[1],
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 16 * s,
            top: 4 * s,
            width: 6 * s,
            height: 7 * s,
            borderRadius: 3 * s,
            backgroundColor: colors[1],
          }}
        />
      </View>
    </View>
  );
}

/** The pond, seen at an angle, with lily pads, ripples and koi swimming round. */
function Pond({ x, y, r, k, still }: { x: number; y: number; r: number; k: number; still?: boolean }) {
  const s = k * Math.max(0.8, r / (140 * k));
  return (
    <View style={{ position: 'absolute', left: x - r, top: y - r * 0.38, width: r * 2, height: r * 0.76 }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          borderRadius: '50%',
          overflow: 'hidden',
          borderWidth: 4 * k,
          borderColor: '#4a4350',
          boxShadow: `inset 0 ${6 * k}px ${14 * k}px rgba(0,0,0,0.6)`,
        }}
      >
        <LinearGradient colors={['#1b3d40', '#14524f', '#0d2e30']} style={StyleSheet.absoluteFill} />
        <Haze x={r * 0.7} y={r * 0.25} width={r * 0.8} height={r * 0.3} color="rgba(255, 170, 190, 0.22)" />
        {[0.3, 0.55, 0.8].map((t, i) => (
          <Loop
            key={t}
            motion="pulse"
            duration={4000}
            delay={i * 1300}
            still={still}
            style={StyleSheet.absoluteFill}
          >
            <View
              style={{
                position: 'absolute',
                left: r * (1.3 - t * 0.4),
                top: r * 0.38 - r * 0.14 * t,
                width: r * 0.7 * t,
                height: r * 0.28 * t,
                borderRadius: '50%',
                borderWidth: Math.max(1, k),
                borderColor: 'rgba(220, 255, 250, 0.22)',
              }}
            />
          </Loop>
        ))}
        {/* Koi circling, on a turning disc squashed by the perspective */}
        <View
          style={{
            position: 'absolute',
            left: r * 0.4,
            top: -r * 0.22,
            width: r * 1.2,
            height: r * 1.2,
            transform: [{ scaleY: 0.38 }],
          }}
        >
          <Loop motion="spin" duration={26000} still={still} style={{ width: r * 1.2, height: r * 1.2 }}>
            <Koi x={r * 0.6} y={r * 0.12} s={s} angle={180} colors={['#ff7a2f', '#fff4ea']} />
            <Koi x={r * 0.6} y={r * 1.08} s={s * 0.9} angle={0} colors={['#fff4ea', '#e63946']} />
            <Koi x={r * 0.1} y={r * 0.62} s={s * 0.8} angle={-90} colors={['#ffb02e', '#ff7a2f']} />
          </Loop>
        </View>
        {/* Lily pads and a flower */}
        {[
          [0.35, 0.3, 26],
          [0.48, 0.62, 20],
          [1.55, 0.4, 24],
          [1.42, 0.72, 16],
        ].map(([px, py, ps], i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: r * px - ps * k * 0.5,
              top: r * py - ps * k * 0.2,
              width: ps * k,
              height: ps * k * 0.42,
              borderRadius: '50%',
              backgroundColor: i % 2 ? '#3f7a3a' : '#4f8f45',
              borderTopRightRadius: 0,
            }}
          />
        ))}
        <Dot
          x={r * 0.37}
          y={r * 0.32}
          size={8 * k}
          color="#ffc6d6"
          style={{ borderWidth: 1.5 * k, borderColor: '#ff8fb0' }}
        />
      </View>
    </View>
  );
}

/** A cherry branch reaching in from a corner, covered with blossom. */
function Branch({
  x,
  y,
  dir,
  len,
  k,
  seed,
  angle = 0.35,
}: {
  x: number;
  y: number;
  dir: 1 | -1;
  len: number;
  k: number;
  seed: number;
  /** Direction of the main limb, in radians below the horizontal. */
  angle?: number;
}) {
  const rand = random(seed);
  const lines: { x1: number; y1: number; x2: number; y2: number; w: number }[] = [];
  const tips: { x: number; y: number }[] = [];
  const grow = (x1: number, y1: number, angle: number, l: number, wdt: number, depth: number) => {
    const x2 = x1 + Math.cos(angle) * l * dir;
    const y2 = y1 + Math.sin(angle) * l;
    lines.push({ x1, y1, x2, y2, w: wdt });
    if (depth === 0) {
      tips.push({ x: x2, y: y2 });
      return;
    }
    tips.push({ x: (x1 + x2) / 2, y: (y1 + y2) / 2 });
    grow(x2, y2, angle + (rand() - 0.3) * 0.6, l * 0.72, wdt * 0.65, depth - 1);
    grow(x2, y2, angle + 0.5 + rand() * 0.5, l * 0.55, wdt * 0.55, depth - 1);
  };
  grow(x, y, angle, len * 0.42, 9 * k, 3);
  return (
    <>
      {lines.map((l, i) => (
        <Line
          key={`l${i}`}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          color="#2a1a1c"
          width={Math.max(1, l.w)}
          round
        />
      ))}
      {tips.map((t, i) =>
        Array.from({ length: 6 }, (_, j) => {
          const size = (5 + rand() * 7) * k;
          return (
            <Dot
              key={`b${i}-${j}`}
              x={t.x + (rand() - 0.5) * 26 * k}
              y={t.y + (rand() - 0.5) * 18 * k}
              size={size}
              color={BLOSSOM[Math.floor(rand() * BLOSSOM.length)]}
              style={{
                opacity: 0.8 + rand() * 0.2,
                borderWidth: size > 9 * k ? Math.max(0.5, 0.8 * k) : 0,
                borderColor: '#ff8fb0',
              }}
            />
          );
        }),
      )}
    </>
  );
}

export function Sakura({ w, h, k }: SceneProps) {
  const still = tiny(w);
  const narrow = w < 560;
  const rand = random(3);
  // On a phone the title sits at the top in the middle: the sun goes lower and to the side.
  const phone = narrow && k >= 0.95;
  const sun = Math.min(w * (narrow ? 0.5 : 0.24), h * 0.4);
  const sunX = w * (phone ? 0.74 : 0.62);
  const sunY = h * (phone ? 0.3 : 0.2);
  const ground = h * 0.78;
  const mountain = (left: number, width: number, height: number, color: string, top = ground) => (
    <Tri x={left + width / 2} y={top} width={width} height={height} color={color} />
  );
  const petals = Array.from({ length: narrow ? 12 : 22 }, () => ({
    x: rand() * w,
    y: rand() * h,
    s: (5 + rand() * 5) * k,
    r: Math.round(rand() * 360),
    o: 0.45 + rand() * 0.4,
  }));
  return (
    <>
      {/* Sunrise */}
      <Haze x={sunX} y={sunY} width={sun * 3.2} height={sun * 2.4} color="rgba(255, 120, 120, 0.22)" />
      <View
        style={{
          position: 'absolute',
          left: sunX - sun / 2,
          top: sunY - sun / 2,
          width: sun,
          height: sun,
          borderRadius: sun / 2,
          overflow: 'hidden',
          opacity: 0.85,
        }}
      >
        <LinearGradient colors={['#ff6b6b', '#e63946', '#b8243a']} style={StyleSheet.absoluteFill} />
      </View>
      {/* Thin clouds across the sun */}
      {[
        [-0.42, 0.1, 0.75],
        [-0.25, 0.3, 0.6],
        [0.02, -0.18, 0.42],
      ].map(([cx, cy, cw], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: sunX + sun * cx,
            top: sunY + sun * cy,
            width: sun * cw,
            height: 4 * k,
            borderRadius: 2 * k,
            backgroundColor: 'rgba(255, 220, 230, 0.28)',
          }}
        />
      ))}
      {/* Mountains fading into the mist, the tallest with snow */}
      {mountain(w * 0.08, w * 0.62, h * 0.36, '#3a2236')}
      <Tri
        x={w * 0.39}
        y={ground - h * 0.36 + h * 0.07}
        width={w * 0.62 * 0.2}
        height={h * 0.07}
        color="rgba(255, 240, 245, 0.75)"
      />
      {mountain(w * 0.48, w * 0.7, h * 0.26, '#2e1b2c')}
      {mountain(-w * 0.2, w * 0.6, h * 0.2, '#28172a')}
      <LinearGradient
        colors={['rgba(255, 200, 220, 0)', 'rgba(255, 200, 220, 0.14)', 'rgba(255, 200, 220, 0)']}
        style={{ position: 'absolute', left: 0, right: 0, top: ground - h * 0.16, height: h * 0.14 }}
      />
      {mountain(w * 0.25, w * 0.9, h * 0.14, '#1f1220')}
      {mountain(-w * 0.1, w * 0.5, h * 0.1, '#1a0f1b')}
      {/* Pagoda on the far hill */}
      {!narrow && (
        <View style={{ position: 'absolute', left: w * 0.72, top: ground - h * 0.2 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i}>
              <Tri
                x={0}
                y={i * 18 * k + 12 * k}
                width={(56 - i * 4) * k * (1 + i * 0.12)}
                height={10 * k}
                color="#170c17"
              />
              <View
                style={{
                  position: 'absolute',
                  left: -10 * k,
                  top: i * 18 * k + 12 * k,
                  width: 20 * k,
                  height: 8 * k,
                  backgroundColor: '#170c17',
                }}
              />
            </View>
          ))}
          <Line x1={0} y1={-6 * k} x2={0} y2={4 * k} color="#170c17" width={2 * k} />
        </View>
      )}
      {/* Garden ground */}
      <LinearGradient
        colors={['#1a1018', '#120b12', '#0b070b']}
        style={{ position: 'absolute', left: 0, right: 0, top: ground, bottom: 0 }}
      />
      {/* Raked gravel */}
      {Array.from({ length: 6 }, (_, i) => (
        <Line
          key={`g${i}`}
          x1={0}
          y1={ground + (h - ground) * ((i + 1) / 7)}
          x2={w}
          y2={ground + (h - ground) * ((i + 1) / 7)}
          color="rgba(255, 220, 230, 0.05)"
          width={Math.max(1, k)}
        />
      ))}
      <Torii
        x={w * (narrow ? 0.84 : 0.88)}
        base={ground + 14 * k}
        s={k * (narrow ? 0.6 : Math.min(1.3, h / 700))}
      />
      <Pond
        x={w * (narrow ? 0.5 : 0.17)}
        y={h - (narrow ? 40 : 70) * k}
        r={Math.min(narrow ? w * 0.42 : w * 0.13, 220 * k)}
        k={k}
        still={still}
      />
      <StoneLantern
        x={w * (narrow ? 0.07 : 0.32)}
        base={h - (narrow ? 14 : 30) * k}
        s={k * (narrow ? 0.75 : 1)}
        still={still}
      />
      {!narrow && <StoneLantern x={w * 0.97} base={h - 20 * k} s={k * 0.9} still={still} />}

      {/* Cherry branches from the top corners, with paper lanterns */}
      {!phone && (
        <Branch
          x={-10 * k}
          y={-6 * k}
          dir={1}
          len={Math.min(w * (phone ? 0.42 : narrow ? 0.6 : 0.24), 340 * k)}
          k={k}
          seed={4}
          angle={narrow ? 0.35 : 1}
        />
      )}
      <Branch
        x={w + 10 * k}
        y={narrow && !phone ? 40 * k : -6 * k}
        dir={-1}
        len={Math.min(w * (phone ? 0.36 : narrow ? 0.45 : 0.22), 320 * k)}
        k={k}
        seed={9}
        angle={narrow ? 0.35 : 1}
      />
      {(narrow ? [0.5] : [0.42, 0.53, 0.64]).map((x, i) => (
        <PaperLantern key={x} x={w * x} y={0} s={k * (narrow ? 0.8 : 1.25)} delay={i * 1500} still={still} />
      ))}
      {/* Petals drifting down */}
      <Drift width={w} height={h} duration={narrow ? 22000 : 30000} still={still}>
        {petals.map((p, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: p.s,
              height: p.s * 0.7,
              borderRadius: p.s,
              borderTopLeftRadius: 0,
              backgroundColor: BLOSSOM[i % BLOSSOM.length],
              opacity: p.o,
              transform: [{ rotate: `${p.r}deg` }],
            }}
          />
        ))}
      </Drift>
    </>
  );
}
