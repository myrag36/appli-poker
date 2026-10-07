import { Fragment, type ReactNode } from 'react';
import { type DimensionValue, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Stops = readonly [string, string, ...string[]];

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

const pct = (x: number) => `${x}%` as DimensionValue;

function Dot({
  x,
  y,
  size,
  color,
  glow,
  opacity = 1,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
  glow?: string;
  opacity?: number;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left: pct(x),
        top: pct(y),
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        boxShadow: glow,
      }}
    />
  );
}

function Mark({
  x,
  y,
  size,
  color,
  rotate = 0,
  children,
  glow,
}: {
  x: number;
  y: number;
  size: number;
  color?: string;
  rotate?: number;
  children: string;
  glow?: string;
}) {
  return (
    <Text
      style={[
        styles.mark,
        {
          left: pct(x),
          top: pct(y),
          fontSize: size,
          lineHeight: size * 1.15,
          marginLeft: -size / 2,
          marginTop: -size * 0.6,
          width: size,
          color,
          transform: [{ rotate: `${rotate}deg` }],
        },
        glow ? { textShadowColor: glow, textShadowRadius: size * 0.3 } : null,
      ]}
    >
      {children}
    </Text>
  );
}

function Stars({ h, count, seed }: { h: number; count: number; seed: number }) {
  const rnd = random(seed);
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Dot
          key={i}
          x={rnd() * 100}
          y={rnd() * 100}
          size={Math.max(1, h * (0.008 + rnd() * 0.018))}
          color={i % 6 === 0 ? '#ffe6a8' : '#ffffff'}
          opacity={0.4 + rnd() * 0.6}
        />
      ))}
    </>
  );
}

/** A soft band of color, used for the aurora and the nebula. */
function Band({
  x,
  y,
  w,
  h,
  colors,
  rotate,
}: {
  x: number;
  y: number;
  w: DimensionValue;
  h: number;
  colors: Stops;
  rotate: number;
}) {
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={{
        position: 'absolute',
        left: pct(x),
        top: pct(y),
        width: w,
        height: h,
        borderRadius: h,
        transform: [{ rotate: `${rotate}deg` }],
      }}
    />
  );
}

/** A hill or wave: the top of a very wide circle peeking from the bottom. */
function Hump({ x, w, h, top, color }: { x: number; w: number; h: number; top: number; color: string }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: pct(x),
        top,
        width: w,
        height: h,
        marginLeft: -w / 2,
        borderRadius: w / 2,
        backgroundColor: color,
      }}
    />
  );
}

/** A ringed planet: the back of the ring, the planet, then the front half of the ring over it. */
function Planet({ h, size }: { h: number; size: number }) {
  const rw = size * 1.75;
  const rh = size * 0.36;
  const ring = { width: rw, height: rh, borderRadius: rw, borderWidth: Math.max(1.5, h * 0.028) };
  return (
    <View
      style={{
        position: 'absolute',
        left: '80%',
        top: h * 0.18,
        width: rw,
        height: size,
        marginLeft: -rw / 2,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '-16deg' }],
      }}
    >
      <View style={[styles.planetRing, ring, { opacity: 0.5 }]} />
      <LinearGradient
        colors={['#ffd29a', '#f08a5d', '#8a3b8f']}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          boxShadow: '0 0 20px rgba(255, 160, 120, 0.45)',
        }}
      />
      <View style={[styles.ringFront, { top: size / 2, width: rw, height: rh / 2 }]}>
        <View style={[styles.planetRing, ring, { top: -rh / 2 }]} />
      </View>
    </View>
  );
}

/** A triangle made from borders, pointing up (or down), centered on x. */
function Tri({
  x,
  top,
  w,
  h,
  color,
  down,
}: {
  x: number;
  top: number;
  w: number;
  h: number;
  color: string;
  down?: boolean;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left: pct(x),
        top,
        marginLeft: -w / 2,
        width: 0,
        height: 0,
        borderLeftWidth: w / 2,
        borderRightWidth: w / 2,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        ...(down
          ? { borderTopWidth: h, borderTopColor: color }
          : { borderBottomWidth: h, borderBottomColor: color }),
      }}
    />
  );
}

/** A fir tree: three stacked tiers on a short trunk, standing on `base`. */
function Pine({ x, base, size, color }: { x: number; base: number; size: number; color: string }) {
  const tier = size * 0.42;
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: pct(x),
          top: base - size * 0.12,
          width: size * 0.08,
          height: size * 0.12,
          marginLeft: -size * 0.04,
          backgroundColor: '#2b1a0e',
        }}
      />
      {[0, 1, 2].map((i) => (
        <Tri
          key={i}
          x={x}
          top={base - size * 0.1 - tier - i * size * 0.27}
          w={size * (0.62 - i * 0.14)}
          h={tier}
          color={color}
        />
      ))}
    </>
  );
}

/** A snowy peak whose tip is at `top`: a square turned on its corner, capped with snow. */
function Peak({ x, top, size, color }: { x: number; top: number; size: number; color: string }) {
  const s = size / Math.SQRT2;
  return (
    <View
      style={[
        styles.peak,
        styles.peakBox,
        {
          left: pct(x),
          top: top - s / 2 + size / 2,
          width: s,
          height: s,
          marginLeft: -s / 2,
          backgroundColor: color,
        },
      ]}
    >
      <View style={[styles.snowCap, { width: s * 0.3, height: s * 0.3 }]} />
    </View>
  );
}

/** A row of buildings along the bottom, with a scatter of lit windows. */
function Skyline({
  h,
  seed,
  count,
  colors,
  lit,
  rim,
  minH,
  maxH,
}: {
  h: number;
  seed: number;
  count: number;
  colors: readonly string[];
  lit: readonly string[];
  /** Color of a glowing outline on the roofs, for neon skylines. */
  rim?: string;
  minH: number;
  maxH: number;
}) {
  const rnd = random(seed);
  const step = 100 / count;
  const win = Math.max(1.5, h * 0.03);
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const bh = h * (minH + rnd() * (maxH - minH));
        const cols = 3;
        const rows = Math.max(2, Math.floor(bh / (win * 2.6)));
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: pct(i * step - rnd() * 1.5),
              width: pct(step + 1.5),
              top: h - bh,
              height: bh,
              backgroundColor: colors[i % colors.length],
              borderTopWidth: rim ? 1 : 0,
              borderColor: rim,
              boxShadow: rim ? `0 0 6px ${rim}` : undefined,
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-evenly',
              alignContent: 'flex-start',
              paddingTop: win,
              rowGap: win * 1.4,
            }}
          >
            {Array.from({ length: cols * rows }, (_, k) => {
              const on = rnd() < 0.45;
              const c = lit[Math.floor(rnd() * lit.length)];
              return (
                <View
                  key={k}
                  style={{
                    width: win,
                    height: win * 1.2,
                    backgroundColor: on ? c : 'rgba(255,255,255,0.05)',
                    boxShadow: on ? `0 0 ${win * 1.5}px ${c}` : undefined,
                  }}
                />
              );
            })}
          </View>
        );
      })}
    </>
  );
}

const SCENES: Record<string, { fill: Stops; draw: (h: number) => ReactNode }> = {
  felt: {
    fill: ['#22925c', '#13693f', '#0a3d24'],
    draw: (h) => {
      const suits = ['♠', '♥', '♣', '♦'];
      const rnd = random(3);
      return (
        <>
          <View style={[styles.feltGlow, { borderRadius: h }]} />
          {Array.from({ length: 9 }, (_, i) => (
            <Mark
              key={i}
              x={6 + i * 11 + rnd() * 4}
              y={i % 2 ? 72 : 26}
              size={h * (0.22 + rnd() * 0.12)}
              rotate={rnd() * 50 - 25}
              color="rgba(255,255,255,0.1)"
            >
              {suits[i % 4]}
            </Mark>
          ))}
          <View style={[styles.stitch, { top: 6 }]} />
          <View style={[styles.stitch, { bottom: 6 }]} />
        </>
      );
    },
  },
  sunset: {
    fill: ['#ffb36b', '#ff6f61', '#c2387a', '#4b1d6b'],
    draw: (h) => {
      const sun = h * 0.9;
      return (
        <>
          <View
            style={{
              position: 'absolute',
              left: '72%',
              top: h * 0.32,
              width: sun,
              height: sun,
              marginLeft: -sun / 2,
              borderRadius: sun / 2,
              overflow: 'hidden',
              boxShadow: '0 0 30px rgba(255, 200, 100, 0.8)',
            }}
          >
            <LinearGradient colors={['#fff3a8', '#ffc65c', '#ff6f61']} style={StyleSheet.absoluteFill} />
            {[0.38, 0.5, 0.6, 0.69].map((y, i) => (
              <View key={y} style={[styles.sunStripe, { top: sun * y, height: 1.5 + i * 1.3 }]} />
            ))}
          </View>
          <Hump x={18} w={h * 3} h={h * 3} top={h * 0.72} color="#3b1450" />
          <Hump x={85} w={h * 2.4} h={h * 2.4} top={h * 0.8} color="#2a0c3c" />
          <Mark x={44} y={20} size={h * 0.14} color="rgba(60, 20, 70, 0.7)">
            ︶
          </Mark>
          <Mark x={51} y={28} size={h * 0.11} color="rgba(60, 20, 70, 0.6)">
            ︶
          </Mark>
        </>
      );
    },
  },
  ocean: {
    fill: ['#7fd3ff', '#2b8fd6', '#0b4f8a', '#062e57'],
    draw: (h) => {
      const rows = [
        { top: 0.48, color: 'rgba(160, 225, 255, 0.35)', r: 0.5, shift: 0 },
        { top: 0.6, color: 'rgba(40, 140, 210, 0.85)', r: 0.45, shift: 6 },
        { top: 0.74, color: 'rgba(15, 90, 160, 0.95)', r: 0.4, shift: 2 },
        { top: 0.86, color: '#073763', r: 0.36, shift: 9 },
      ];
      return (
        <>
          <Dot x={84} y={20} size={h * 0.3} color="#fff7d1" glow="0 0 24px rgba(255, 245, 200, 0.9)" />
          <Mark x={66} y={40} size={h * 0.22}>
            ⛵
          </Mark>
          <Mark x={52} y={20} size={h * 0.1} color="rgba(255,255,255,0.8)">
            〰
          </Mark>
          {rows.map((row) =>
            Array.from({ length: 9 }, (_, i) => (
              <Hump
                key={`${row.top}-${i}`}
                x={i * 13 - row.shift}
                w={h * row.r * 2}
                h={h * row.r * 2}
                top={h * row.top}
                color={row.color}
              />
            )),
          )}
        </>
      );
    },
  },
  casino: {
    fill: ['#7a0f1a', '#3d0610', '#14020a'],
    draw: (h) => {
      const bulbs = 16;
      return (
        <>
          <View style={[styles.marquee, { top: 0, height: h * 0.16 }]} />
          <View style={[styles.marquee, { bottom: 0, height: h * 0.16 }]} />
          {Array.from({ length: bulbs }, (_, i) => {
            const x = 3 + (i * 94) / (bulbs - 1);
            const on = i % 2 === 0;
            const s = h * 0.075;
            const color = on ? '#fff3b0' : '#e0a030';
            const glow = on ? '0 0 8px 2px rgba(255, 220, 100, 0.85)' : undefined;
            return (
              <Fragment key={i}>
                <Dot x={x} y={8} size={s} color={color} glow={glow} />
                <Dot x={x} y={92} size={s} color={on ? '#e0a030' : '#fff3b0'} glow={on ? undefined : glow} />
              </Fragment>
            );
          })}
          <Mark x={9} y={50} size={h * 0.26} rotate={-14}>
            🎰
          </Mark>
          <Mark x={91} y={52} size={h * 0.24} rotate={14}>
            🎲
          </Mark>
          {['♠', '♥', '♦', '♣'].map((s, i) => (
            <Mark
              key={s}
              x={20 + i * 20}
              y={50}
              size={h * 0.2}
              color={i % 3 === 0 ? 'rgba(255, 215, 120, 0.22)' : 'rgba(255, 90, 90, 0.25)'}
            >
              {s}
            </Mark>
          ))}
        </>
      );
    },
  },
  aurora: {
    fill: ['#0b1d3a', '#071328', '#02070f'],
    draw: (h) => (
      <>
        <Stars h={h} count={30} seed={11} />
        <Band
          x={-10}
          y={8}
          w="80%"
          h={h * 0.42}
          rotate={-12}
          colors={[
            'rgba(60,255,170,0)',
            'rgba(60,255,170,0.55)',
            'rgba(60,220,255,0.35)',
            'rgba(60,255,170,0)',
          ]}
        />
        <Band
          x={30}
          y={20}
          w="85%"
          h={h * 0.36}
          rotate={8}
          colors={[
            'rgba(170,90,255,0)',
            'rgba(170,90,255,0.5)',
            'rgba(80,255,190,0.4)',
            'rgba(80,255,190,0)',
          ]}
        />
        <Band
          x={10}
          y={34}
          w="70%"
          h={h * 0.2}
          rotate={-4}
          colors={['rgba(90,255,200,0)', 'rgba(140,255,210,0.35)', 'rgba(90,255,200,0)']}
        />
        {[
          [8, 1.3],
          [28, 1.8],
          [52, 1.2],
          [74, 1.6],
          [96, 1.4],
        ].map(([x, k], i) => (
          <View
            key={i}
            style={[
              styles.peak,
              {
                left: pct(x),
                top: h - h * 0.32 * k * 0.7,
                width: h * 0.6 * k,
                height: h * 0.6 * k,
                marginLeft: -h * 0.3 * k,
                backgroundColor: i % 2 ? '#081a2e' : '#0c2440',
              },
            ]}
          />
        ))}
      </>
    ),
  },
  lava: {
    fill: ['#3a0a02', '#1e0501', '#0a0200'],
    draw: (h) => {
      const rnd = random(5);
      return (
        <>
          <LinearGradient
            colors={['rgba(255,80,0,0)', 'rgba(255,90,0,0.55)', 'rgba(255,200,40,0.85)']}
            style={[styles.lavaFloor, { height: h * 0.5 }]}
          />
          {Array.from({ length: 7 }, (_, i) => {
            const s = h * (0.22 + rnd() * 0.25);
            return (
              <LinearGradient
                key={i}
                colors={['#fff07a', '#ffa21f', '#ff4a00']}
                style={{
                  position: 'absolute',
                  left: pct(5 + i * 15 + rnd() * 6),
                  top: h * (0.55 + rnd() * 0.3),
                  width: s,
                  height: s,
                  marginLeft: -s / 2,
                  borderRadius: s,
                  boxShadow: '0 0 14px 3px rgba(255, 110, 0, 0.75)',
                }}
              />
            );
          })}
          {Array.from({ length: 6 }, (_, i) => (
            <View
              key={`c${i}`}
              style={[
                styles.crack,
                {
                  left: pct(8 + i * 16),
                  top: h * (0.12 + (i % 3) * 0.08),
                  width: h * (0.3 + (i % 2) * 0.2),
                  transform: [{ rotate: `${i % 2 ? 35 : -25}deg` }],
                },
              ]}
            />
          ))}
          {Array.from({ length: 10 }, (_, i) => (
            <Dot
              key={`e${i}`}
              x={rnd() * 100}
              y={10 + rnd() * 45}
              size={2 + rnd() * 2.5}
              color="#ffcf5a"
              glow="0 0 5px rgba(255, 140, 0, 0.9)"
            />
          ))}
        </>
      );
    },
  },
  cosmos: {
    fill: ['#1a0b3d', '#0b0626', '#020108'],
    draw: (h) => {
      const planet = h * 0.62;
      return (
        <>
          <Band
            x={-5}
            y={10}
            w="70%"
            h={h * 0.7}
            rotate={-18}
            colors={[
              'rgba(255,70,180,0)',
              'rgba(255,70,180,0.25)',
              'rgba(90,120,255,0.25)',
              'rgba(90,120,255,0)',
            ]}
          />
          <Stars h={h} count={55} seed={21} />
          <Planet h={h} size={planet} />
          <Dot x={18} y={70} size={h * 0.14} color="#9fd8ff" glow="0 0 10px rgba(140, 200, 255, 0.8)" />
          <Mark x={35} y={28} size={h * 0.14} color="#fff" glow="#c9a6ff">
            ✦
          </Mark>
          <Mark x={60} y={78} size={h * 0.1} color="#fff" glow="#c9a6ff">
            ✦
          </Mark>
        </>
      );
    },
  },
  gold: {
    fill: ['#3a2600', '#1e1400', '#0c0800'],
    draw: (h) => {
      const rnd = random(9);
      return (
        <>
          <LinearGradient
            colors={['rgba(255,215,90,0.35)', 'rgba(255,215,90,0)']}
            style={StyleSheet.absoluteFill}
          />
          {Array.from({ length: 14 }, (_, i) => (
            <LinearGradient
              key={`s${i}`}
              colors={['rgba(255,230,140,0)', 'rgba(255,215,90,0.6)']}
              style={{
                position: 'absolute',
                left: pct(rnd() * 100),
                top: h * (rnd() * 0.5 - 0.1),
                width: 1.5,
                height: h * (0.2 + rnd() * 0.35),
                transform: [{ rotate: '12deg' }],
              }}
            />
          ))}
          {Array.from({ length: 11 }, (_, i) => (
            <Mark
              key={`c${i}`}
              x={4 + i * 9 + rnd() * 4}
              y={20 + rnd() * 70}
              size={h * (0.12 + rnd() * 0.12)}
              rotate={rnd() * 60 - 30}
            >
              🪙
            </Mark>
          ))}
          {Array.from({ length: 12 }, (_, i) => (
            <Mark
              key={`k${i}`}
              x={rnd() * 100}
              y={rnd() * 100}
              size={h * (0.06 + rnd() * 0.08)}
              color="#fff3b0"
              glow="#ffbf00"
            >
              ✦
            </Mark>
          ))}
        </>
      );
    },
  },
  // ---- Shop banners ----
  forest: {
    fill: ['#f6e7a8', '#9fd49a', '#3f8a5c', '#163d2a'],
    draw: (h) => {
      const rnd = random(31);
      return (
        <>
          <Dot x={70} y={30} size={h * 0.34} color="#fff6c9" glow="0 0 30px 8px rgba(255, 240, 170, 0.7)" />
          {Array.from({ length: 13 }, (_, i) => (
            <Pine
              key={`b${i}`}
              x={i * 8.5 + rnd() * 3}
              base={h * 0.8}
              size={h * (0.38 + rnd() * 0.16)}
              color="rgba(46, 110, 72, 0.75)"
            />
          ))}
          <Band
            x={-10}
            y={52}
            w="120%"
            h={h * 0.22}
            rotate={0}
            colors={['rgba(230,255,235,0)', 'rgba(230,255,235,0.35)', 'rgba(230,255,235,0)']}
          />
          <Hump x={30} w={h * 4} h={h * 4} top={h * 0.82} color="#123522" />
          <Hump x={85} w={h * 3} h={h * 3} top={h * 0.86} color="#0e2b1b" />
          {Array.from({ length: 7 }, (_, i) => (
            <Pine
              key={`f${i}`}
              x={2 + i * 16 + rnd() * 5}
              base={h * (1.0 + rnd() * 0.05)}
              size={h * (0.48 + rnd() * 0.22)}
              color={i % 2 ? '#0b2a18' : '#0f331f'}
            />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <Dot
              key={`l${i}`}
              x={rnd() * 100}
              y={45 + rnd() * 45}
              size={Math.max(1.5, h * 0.025)}
              color="#f6ff9a"
              glow="0 0 6px 2px rgba(220, 255, 100, 0.8)"
            />
          ))}
        </>
      );
    },
  },
  desert: {
    fill: ['#ffe9a8', '#ffc46b', '#ff8e4f', '#e0603a'],
    draw: (h) => {
      const sun = h * 0.5;
      return (
        <>
          <Dot x={74} y={34} size={sun} color="#fff7d1" glow="0 0 30px 10px rgba(255, 220, 120, 0.85)" />
          {[0.3, 0.42].map((y, i) => (
            <View
              key={y}
              style={[styles.haze, { top: h * y, opacity: 0.35 - i * 0.1, height: Math.max(1, h * 0.012) }]}
            />
          ))}
          <Mark x={34} y={22} size={h * 0.09} color="rgba(120, 50, 20, 0.6)">
            ︶
          </Mark>
          <Mark x={40} y={18} size={h * 0.07} color="rgba(120, 50, 20, 0.5)">
            ︶
          </Mark>
          <Hump x={78} w={h * 3.6} h={h * 3.6} top={h * 0.6} color="#f0a65a" />
          <Hump x={15} w={h * 3.2} h={h * 3.2} top={h * 0.66} color="#e48f45" />
          <Mark x={60} y={66} size={h * 0.28}>
            🌵
          </Mark>
          <Hump x={50} w={h * 5} h={h * 5} top={h * 0.8} color="#cf7634" />
          <Hump x={95} w={h * 3} h={h * 3} top={h * 0.86} color="#b35f26" />
          <Mark x={14} y={70} size={h * 0.42}>
            🌵
          </Mark>
          <Mark x={88} y={76} size={h * 0.34}>
            🌵
          </Mark>
          <Mark x={36} y={90} size={h * 0.12} rotate={-10}>
            🦂
          </Mark>
        </>
      );
    },
  },
  snow: {
    fill: ['#3b6db3', '#7fb3ea', '#d6ebff'],
    draw: (h) => {
      const rnd = random(41);
      return (
        <>
          <Dot x={18} y={22} size={h * 0.22} color="#ffffff" glow="0 0 20px 6px rgba(255, 255, 255, 0.6)" />
          <Peak x={30} top={h * 0.18} size={h * 1.4} color="#6f8fbf" />
          <Peak x={72} top={h * 0.06} size={h * 1.7} color="#5b7cb0" />
          <Peak x={98} top={h * 0.3} size={h * 1.1} color="#7d9cc9" />
          <Peak x={5} top={h * 0.38} size={h * 1.0} color="#86a5d1" />
          <Hump x={25} w={h * 4} h={h * 4} top={h * 0.8} color="#eef6ff" />
          <Hump x={85} w={h * 3.4} h={h * 3.4} top={h * 0.76} color="#ffffff" />
          <Pine x={62} base={h * 0.9} size={h * 0.36} color="#2e4f6b" />
          <Pine x={68} base={h * 0.94} size={h * 0.28} color="#28455e" />
          {Array.from({ length: 22 }, (_, i) => (
            <Dot
              key={`d${i}`}
              x={rnd() * 100}
              y={rnd() * 100}
              size={Math.max(1.5, h * (0.015 + rnd() * 0.025))}
              color="#ffffff"
              opacity={0.6 + rnd() * 0.4}
            />
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <Mark
              key={`f${i}`}
              x={6 + i * 14 + rnd() * 5}
              y={10 + rnd() * 60}
              size={h * (0.09 + rnd() * 0.08)}
              rotate={rnd() * 60}
              color="#ffffff"
              glow="rgba(120, 190, 255, 0.9)"
            >
              ❄
            </Mark>
          ))}
        </>
      );
    },
  },
  city: {
    fill: ['#05081f', '#141a4d', '#3a2a6e', '#6b3f7a'],
    draw: (h) => (
      <>
        <Stars h={h * 0.6} count={26} seed={51} />
        <View
          style={[
            styles.moon,
            { top: h * 0.12, width: h * 0.3, height: h * 0.3, borderRadius: h * 0.15, marginLeft: -h * 0.15 },
          ]}
        >
          <View
            style={{
              position: 'absolute',
              left: h * 0.08,
              top: -h * 0.03,
              width: h * 0.3,
              height: h * 0.3,
              borderRadius: h * 0.15,
              backgroundColor: '#0d1238',
            }}
          />
        </View>
        <Skyline
          h={h}
          seed={52}
          count={11}
          colors={['#1b1f48', '#23285a', '#191c40']}
          lit={['rgba(120, 140, 255, 0.5)']}
          minH={0.35}
          maxH={0.62}
        />
        <Skyline
          h={h}
          seed={53}
          count={8}
          colors={['#0a0c22', '#0d1029', '#080a1c']}
          lit={['#ffe08a', '#fff3c4', '#ffd060']}
          minH={0.28}
          maxH={0.78}
        />
        <Dot
          x={47}
          y={10}
          size={Math.max(2, h * 0.025)}
          color="#ff4d4d"
          glow="0 0 6px 2px rgba(255, 60, 60, 0.9)"
        />
      </>
    ),
  },
  vegas: {
    fill: ['#3d0a52', '#1c0329', '#08000f'],
    draw: (h) => {
      const bulbs = 18;
      const sign = Math.min(h * 0.4, 44);
      return (
        <>
          <Band
            x={-10}
            y={30}
            w="120%"
            h={h * 0.5}
            rotate={0}
            colors={[
              'rgba(255,60,172,0)',
              'rgba(255,60,172,0.25)',
              'rgba(0,240,255,0.2)',
              'rgba(0,240,255,0)',
            ]}
          />
          <Skyline
            h={h}
            seed={61}
            count={9}
            colors={['#14021f', '#1a0428', '#10011a']}
            lit={['#ff3cac', '#00f0ff', '#ffe066', '#c13cff']}
            rim="rgba(255, 60, 172, 0.9)"
            minH={0.2}
            maxH={0.48}
          />
          <View
            style={[
              styles.neonSign,
              {
                top: h * 0.2,
                height: sign,
                paddingHorizontal: sign * 0.3,
                borderRadius: sign * 0.3,
                borderWidth: Math.max(1.5, h * 0.018),
              },
            ]}
          >
            <Text
              style={[
                styles.neonText,
                { fontSize: sign * 0.52, lineHeight: sign * 0.7, textShadowRadius: h * 0.06 },
              ]}
            >
              ♠ VEGAS ♥
            </Text>
          </View>
          {Array.from({ length: bulbs }, (_, i) => {
            const x = 2.5 + (i * 95) / (bulbs - 1);
            const s = Math.max(2.5, h * 0.06);
            const c = i % 3 === 0 ? '#00f0ff' : i % 3 === 1 ? '#ff3cac' : '#fff3b0';
            return (
              <Fragment key={i}>
                <Dot x={x} y={6} size={s} color={c} glow={`0 0 8px 2px ${c}`} />
              </Fragment>
            );
          })}
          <Mark x={10} y={42} size={h * 0.3} color="#ff3cac" glow="#ff3cac" rotate={-12}>
            ♥
          </Mark>
          <Mark x={24} y={60} size={h * 0.22} color="#00f0ff" glow="#00f0ff" rotate={10}>
            ♠
          </Mark>
          <Mark x={45} y={36} size={h * 0.14} color="#fff3b0" glow="#ffc933">
            ✦
          </Mark>
          <Mark x={94} y={58} size={h * 0.18} color="#fff3b0" glow="#ffc933">
            ✦
          </Mark>
        </>
      );
    },
  },
  dragon: {
    fill: ['#2a0303', '#140101', '#050000'],
    draw: (h) => {
      const rnd = random(71);
      return (
        <>
          <LinearGradient
            colors={['rgba(255,60,0,0)', 'rgba(255,80,0,0.4)', 'rgba(255,170,40,0.75)']}
            style={[styles.lavaFloor, { height: h * 0.6 }]}
          />
          {Array.from({ length: 12 }, (_, i) => (
            <Tri
              key={`t${i}`}
              x={i * 9 + rnd() * 4}
              top={-1}
              w={h * (0.12 + rnd() * 0.1)}
              h={h * (0.18 + rnd() * 0.22)}
              color={i % 2 ? '#3a0907' : '#4f110b'}
              down
            />
          ))}
          <Hump x={78} w={h * 1.6} h={h * 1.6} top={h * 0.8} color="#b8860b" />
          <Hump x={92} w={h * 1.1} h={h * 1.1} top={h * 0.72} color="#d9a21b" />
          <Hump x={62} w={h * 0.9} h={h * 0.9} top={h * 0.86} color="#9a6e08" />
          {Array.from({ length: 9 }, (_, i) => (
            <Mark
              key={`c${i}`}
              x={58 + rnd() * 42}
              y={78 + rnd() * 20}
              size={h * (0.1 + rnd() * 0.06)}
              rotate={rnd() * 60 - 30}
            >
              🪙
            </Mark>
          ))}
          <Mark x={84} y={44} size={h * 0.55} rotate={-6} glow="rgba(255, 90, 0, 0.9)">
            🐉
          </Mark>
          <Mark x={70} y={82} size={h * 0.16} rotate={-8}>
            💎
          </Mark>
          {Array.from({ length: 16 }, (_, i) => (
            <Dot
              key={`e${i}`}
              x={rnd() * 100}
              y={20 + rnd() * 70}
              size={Math.max(1.5, h * (0.015 + rnd() * 0.025))}
              color={i % 3 ? '#ffb02e' : '#fff07a'}
              glow="0 0 6px 1px rgba(255, 120, 0, 0.95)"
            />
          ))}
        </>
      );
    },
  },
};

/** Every banner id that has a drawing. */
export const BANNER_IDS = Object.keys(SCENES);

/** A decorative profile banner. Children are drawn on top of the scenery. */
export function Banner({
  id,
  width,
  height = 110,
  radius = 16,
  children,
}: {
  id: string;
  /** Leave it out to fill the available width. */
  width?: number;
  height?: number;
  radius?: number;
  children?: ReactNode;
}) {
  const scene = SCENES[id] ?? SCENES.felt;
  return (
    <View style={[styles.banner, { width: width ?? '100%', height, borderRadius: radius }]}>
      <LinearGradient colors={scene.fill} style={StyleSheet.absoluteFill} />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {scene.draw(height)}
      </View>
      <LinearGradient
        colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.25)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={[StyleSheet.absoluteFill, styles.content]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.45)',
  },
  content: { justifyContent: 'center', padding: 12 },
  mark: { position: 'absolute', textAlign: 'center' },
  feltGlow: {
    position: 'absolute',
    left: '15%',
    right: '15%',
    top: '10%',
    bottom: '10%',
    backgroundColor: 'rgba(140, 255, 190, 0.08)',
    boxShadow: '0 0 40px 20px rgba(140, 255, 190, 0.08)',
  },
  stitch: {
    position: 'absolute',
    left: 8,
    right: 8,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 220, 140, 0.35)',
  },
  sunStripe: { position: 'absolute', left: 0, right: 0, backgroundColor: '#d9466f' },
  marquee: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderColor: 'rgba(255, 200, 80, 0.35)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  peak: { position: 'absolute', transform: [{ rotate: '45deg' }] },
  lavaFloor: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  crack: { position: 'absolute', height: 1.5, backgroundColor: 'rgba(255, 120, 20, 0.7)' },
  planetRing: { position: 'absolute', borderColor: 'rgba(255, 225, 180, 0.85)' },
  ringFront: { position: 'absolute', left: 0, overflow: 'hidden' },
  peakBox: { overflow: 'hidden' },
  snowCap: { position: 'absolute', left: 0, top: 0, backgroundColor: '#ffffff' },
  haze: { position: 'absolute', left: '50%', right: 0, backgroundColor: '#fff7d1' },
  moon: {
    position: 'absolute',
    left: '80%',
    overflow: 'hidden',
    backgroundColor: '#fff6d6',
    boxShadow: '0 0 24px 4px rgba(255, 240, 200, 0.55)',
  },
  neonSign: {
    position: 'absolute',
    right: '6%',
    justifyContent: 'center',
    borderColor: '#ff3cac',
    backgroundColor: 'rgba(20, 0, 30, 0.55)',
    boxShadow: '0 0 12px 2px rgba(255, 60, 172, 0.85), inset 0 0 10px rgba(255, 60, 172, 0.6)',
  },
  neonText: {
    color: '#fff0fa',
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: '#00f0ff',
    textShadowOffset: { width: 0, height: 0 },
  },
});
