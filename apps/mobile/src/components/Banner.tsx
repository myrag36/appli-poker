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
  // ---- Seasonal banners, one per month ----
  blizzard: {
    fill: ['#8fa9cc', '#bcd2ea', '#e9f3ff'],
    draw: (h) => {
      const rnd = random(81);
      return (
        <>
          <Dot x={78} y={18} size={h * 0.26} color="#f4f9ff" glow="0 0 26px 10px rgba(255, 255, 255, 0.55)" />
          <Peak x={22} top={h * 0.12} size={h * 1.5} color="#8ea6c8" />
          <Peak x={62} top={h * 0.02} size={h * 1.8} color="#7f98bd" />
          <Peak x={96} top={h * 0.22} size={h * 1.3} color="#93abcc" />
          <Band
            x={-10}
            y={38}
            w="120%"
            h={h * 0.3}
            rotate={0}
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
          />
          <Hump x={20} w={h * 4} h={h * 4} top={h * 0.74} color="#f4f9ff" />
          <Hump x={80} w={h * 3.4} h={h * 3.4} top={h * 0.7} color="#ffffff" />
          <Pine x={10} base={h * 0.86} size={h * 0.4} color="#3d5e80" />
          <Pine x={16} base={h * 0.9} size={h * 0.3} color="#34536f" />
          <Pine x={88} base={h * 0.82} size={h * 0.44} color="#3d5e80" />
          <Mark x={62} y={74} size={h * 0.24}>
            ⛄
          </Mark>
          {Array.from({ length: 16 }, (_, i) => (
            <LinearGradient
              key={`w${i}`}
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.75)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{
                position: 'absolute',
                left: pct(rnd() * 100 - 10),
                top: h * rnd(),
                width: h * (0.18 + rnd() * 0.3),
                height: Math.max(1, h * 0.012),
                transform: [{ rotate: '24deg' }],
              }}
            />
          ))}
          {Array.from({ length: 34 }, (_, i) => (
            <Dot
              key={`d${i}`}
              x={rnd() * 100}
              y={rnd() * 100}
              size={Math.max(1.5, h * (0.012 + rnd() * 0.03))}
              color="#ffffff"
              opacity={0.55 + rnd() * 0.45}
            />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <Mark
              key={`f${i}`}
              x={8 + i * 17 + rnd() * 6}
              y={10 + rnd() * 50}
              size={h * (0.1 + rnd() * 0.08)}
              rotate={rnd() * 60}
              color="#ffffff"
              glow="rgba(110, 170, 240, 0.9)"
            >
              ❄
            </Mark>
          ))}
        </>
      );
    },
  },
  carnaval: {
    fill: ['#6a1fa0', '#3a0d6b', '#170331'],
    draw: (h) => {
      const rnd = random(91);
      const flags = 14;
      const confetti = ['#ff4fa3', '#ffd23f', '#2fb8ff', '#7cff6b', '#ff7a1a', '#ffffff'];
      return (
        <>
          <Band
            x={-10}
            y={55}
            w="120%"
            h={h * 0.5}
            rotate={0}
            colors={[
              'rgba(255,80,180,0)',
              'rgba(255,80,180,0.28)',
              'rgba(255,210,60,0.2)',
              'rgba(255,210,60,0)',
            ]}
          />
          {[
            { y: 30, r: 14, c: ['rgba(255,210,60,0)', '#ffd23f', 'rgba(255,210,60,0)'] as Stops },
            { y: 52, r: -10, c: ['rgba(47,184,255,0)', '#2fb8ff', 'rgba(47,184,255,0)'] as Stops },
            { y: 70, r: 6, c: ['rgba(255,79,163,0)', '#ff4fa3', 'rgba(255,79,163,0)'] as Stops },
          ].map((s) => (
            <Band key={s.y} x={-5} y={s.y} w="110%" h={Math.max(1.5, h * 0.025)} rotate={s.r} colors={s.c} />
          ))}
          <View style={[styles.garland, { top: h * 0.07 }]} />
          {Array.from({ length: flags }, (_, i) => (
            <Tri
              key={`g${i}`}
              x={2 + (i * 96) / (flags - 1)}
              top={h * 0.07}
              w={h * 0.12}
              h={h * 0.15}
              color={confetti[i % 5]}
              down
            />
          ))}
          <Mark x={22} y={56} size={h * 0.44} rotate={-12} glow="rgba(255, 210, 60, 0.8)">
            🎭
          </Mark>
          <Mark x={78} y={58} size={h * 0.36} rotate={14}>
            🎉
          </Mark>
          {Array.from({ length: 40 }, (_, i) => {
            const s = Math.max(2, h * (0.025 + rnd() * 0.03));
            return (
              <View
                key={`c${i}`}
                style={{
                  position: 'absolute',
                  left: pct(rnd() * 100),
                  top: h * (0.2 + rnd() * 0.8),
                  width: s,
                  height: i % 3 ? s * 0.45 : s,
                  borderRadius: i % 3 ? 1 : s,
                  backgroundColor: confetti[i % confetti.length],
                  transform: [{ rotate: `${rnd() * 180}deg` }],
                }}
              />
            );
          })}
        </>
      );
    },
  },
  prairie: {
    fill: ['#8fd8ff', '#c8efff', '#f0ffe0'],
    draw: (h) => {
      const rnd = random(101);
      const flowers = ['#ffffff', '#ffe34d', '#ff8ac0', '#ffffff', '#c59bff'];
      return (
        <>
          <Dot x={84} y={20} size={h * 0.3} color="#fff7b8" glow="0 0 28px 10px rgba(255, 240, 150, 0.8)" />
          {[
            [18, 18, 0.16],
            [23, 14, 0.2],
            [28, 19, 0.15],
            [55, 26, 0.12],
            [59, 22, 0.15],
            [63, 27, 0.11],
          ].map(([x, y, k], i) => (
            <Dot key={`n${i}`} x={x} y={y} size={h * k} color="#ffffff" opacity={0.95} />
          ))}
          <Hump x={75} w={h * 4} h={h * 4} top={h * 0.55} color="#9be070" />
          <Hump x={15} w={h * 3.6} h={h * 3.6} top={h * 0.6} color="#86d35c" />
          <Hump x={50} w={h * 6} h={h * 6} top={h * 0.75} color="#5fb53c" />
          {Array.from({ length: 34 }, (_, i) => (
            <Dot
              key={`f${i}`}
              x={rnd() * 100}
              y={66 + rnd() * 32}
              size={Math.max(2, h * (0.025 + rnd() * 0.025))}
              color={flowers[i % flowers.length]}
            />
          ))}
          <Mark x={12} y={84} size={h * 0.24}>
            🌷
          </Mark>
          <Mark x={34} y={90} size={h * 0.2}>
            🌷
          </Mark>
          <Mark x={70} y={86} size={h * 0.22}>
            🌼
          </Mark>
          <Mark x={90} y={90} size={h * 0.24}>
            🌷
          </Mark>
          <Mark x={48} y={52} size={h * 0.16} rotate={-12}>
            🦋
          </Mark>
          <Mark x={58} y={84} size={h * 0.13}>
            🐞
          </Mark>
        </>
      );
    },
  },
  recif: {
    fill: ['#4fdcef', '#1597c7', '#0a5b8f', '#062f5a'],
    draw: (h) => {
      const rnd = random(111);
      return (
        <>
          {[12, 34, 58, 82].map((x, i) => (
            <LinearGradient
              key={`r${i}`}
              colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
              style={{
                position: 'absolute',
                left: pct(x),
                top: -h * 0.1,
                width: h * 0.18,
                height: h * 1.1,
                transform: [{ rotate: `${18 - i * 4}deg` }],
              }}
            />
          ))}
          <Hump x={50} w={h * 6} h={h * 6} top={h * 0.86} color="#e8c98a" />
          {[
            [8, 0.82, 0.34, '#ff6f91'],
            [22, 0.86, 0.26, '#ff9f43'],
            [72, 0.8, 0.36, '#c56cf0'],
            [88, 0.84, 0.3, '#ff6f91'],
            [96, 0.88, 0.22, '#ffb142'],
          ].map(([x, top, k, c], i) => (
            <Fragment key={`k${i}`}>
              {[-1, 0, 1].map((j) => (
                <View
                  key={j}
                  style={{
                    position: 'absolute',
                    left: pct((x as number) + j * 2),
                    top: h * ((top as number) - (k as number) * (j === 0 ? 0.9 : 0.6)),
                    width: h * (k as number) * 0.22,
                    height: h * (k as number) * (j === 0 ? 0.9 : 0.6) + h * 0.2,
                    marginLeft: -h * (k as number) * 0.11,
                    borderRadius: h * (k as number) * 0.11,
                    backgroundColor: c as string,
                    transform: [{ rotate: `${j * 22}deg` }],
                  }}
                />
              ))}
            </Fragment>
          ))}
          {[36, 44, 58].map((x, i) => (
            <View
              key={`a${i}`}
              style={{
                position: 'absolute',
                left: pct(x),
                top: h * (0.6 + (i % 2) * 0.08),
                width: Math.max(1.5, h * 0.03),
                height: h * 0.4,
                borderRadius: h,
                backgroundColor: '#2fae6e',
                transform: [{ rotate: `${(i - 1) * 8}deg` }],
              }}
            />
          ))}
          <Mark x={30} y={40} size={h * 0.28} rotate={-6}>
            🐠
          </Mark>
          <Mark x={64} y={30} size={h * 0.22}>
            🐟
          </Mark>
          <Mark x={82} y={52} size={h * 0.26} rotate={8}>
            🐡
          </Mark>
          <Mark x={14} y={58} size={h * 0.16}>
            🐟
          </Mark>
          <Mark x={50} y={88} size={h * 0.16}>
            🐚
          </Mark>
          <Mark x={80} y={92} size={h * 0.15}>
            ⭐
          </Mark>
          {Array.from({ length: 14 }, (_, i) => (
            <View
              key={`b${i}`}
              style={[
                styles.bubble,
                {
                  left: pct(rnd() * 100),
                  top: h * rnd() * 0.75,
                  width: Math.max(2.5, h * (0.03 + rnd() * 0.04)),
                  height: Math.max(2.5, h * (0.03 + rnd() * 0.04)),
                },
              ]}
            />
          ))}
        </>
      );
    },
  },
  jardin: {
    fill: ['#ffe9f3', '#ffd3e6', '#d7f3c0'],
    draw: (h) => {
      const rnd = random(121);
      const blooms = ['🌸', '🌼', '🌷', '🌺', '🌹'];
      return (
        <>
          <Dot x={16} y={22} size={h * 0.28} color="#fffbe0" glow="0 0 26px 10px rgba(255, 245, 190, 0.85)" />
          {Array.from({ length: 14 }, (_, i) => (
            <View
              key={`p${i}`}
              style={[
                styles.petal,
                {
                  left: pct(rnd() * 100),
                  top: h * rnd() * 0.6,
                  width: h * 0.05,
                  height: h * 0.03,
                  borderRadius: h * 0.03,
                  transform: [{ rotate: `${rnd() * 180}deg` }],
                },
              ]}
            />
          ))}
          <Hump x={30} w={h * 5} h={h * 5} top={h * 0.62} color="#7bc96f" />
          <Hump x={85} w={h * 4} h={h * 4} top={h * 0.58} color="#69b85d" />
          {Array.from({ length: 9 }, (_, i) => (
            <Dot key={`h${i}`} x={i * 12.5} y={70} size={h * 0.34} color={i % 2 ? '#4e9a48' : '#5aa953'} />
          ))}
          <Hump x={50} w={h * 7} h={h * 7} top={h * 0.8} color="#3f8a3b" />
          {Array.from({ length: 13 }, (_, i) => (
            <Mark
              key={`f${i}`}
              x={3 + i * 7.8 + rnd() * 3}
              y={i % 2 ? 90 : 78}
              size={h * (0.15 + rnd() * 0.08)}
              rotate={rnd() * 30 - 15}
            >
              {blooms[i % blooms.length]}
            </Mark>
          ))}
          <Mark x={60} y={28} size={h * 0.18} rotate={-10}>
            🐝
          </Mark>
          <Mark x={82} y={22} size={h * 0.18} rotate={10}>
            🦋
          </Mark>
        </>
      );
    },
  },
  concert: {
    fill: ['#2a0838', '#14041d', '#050008'],
    draw: (h) => {
      const rnd = random(131);
      const beams = [
        { x: 10, r: -28, c: 'rgba(255, 60, 200, 0.45)', lamp: '#ff3ec8' },
        { x: 32, r: -12, c: 'rgba(80, 200, 255, 0.4)', lamp: '#2fb8ff' },
        { x: 68, r: 12, c: 'rgba(255, 220, 80, 0.4)', lamp: '#ffd23f' },
        { x: 90, r: 28, c: 'rgba(160, 90, 255, 0.45)', lamp: '#a05aff' },
      ];
      return (
        <>
          {beams.map((b) => (
            <LinearGradient
              key={b.x}
              colors={[b.c, 'rgba(0,0,0,0)']}
              style={{
                position: 'absolute',
                left: pct(b.x),
                // Turned around its middle: shift it so its top stays on the lamp.
                top: -h * 0.05 - h * 0.6 * (1 - Math.cos((b.r * Math.PI) / 180)),
                width: h * 0.32,
                height: h * 1.2,
                marginLeft: -h * 0.16 - h * 0.6 * Math.sin((b.r * Math.PI) / 180),
                borderBottomLeftRadius: h * 0.3,
                borderBottomRightRadius: h * 0.3,
                transform: [{ rotate: `${b.r}deg` }],
              }}
            />
          ))}
          <View style={[styles.truss, { top: 0, height: Math.max(3, h * 0.07) }]} />
          {beams.map((b) => (
            <Dot
              key={`l${b.x}`}
              x={b.x}
              y={4}
              size={Math.max(4, h * 0.08)}
              color="#ffffff"
              glow={`0 0 10px 3px ${b.lamp}`}
            />
          ))}
          <Mark x={72} y={42} size={h * 0.3} glow="rgba(255, 60, 200, 0.9)">
            🎤
          </Mark>
          <Mark x={55} y={50} size={h * 0.26} rotate={-20} glow="rgba(80, 200, 255, 0.9)">
            🎸
          </Mark>
          <Mark x={89} y={54} size={h * 0.24} rotate={10} glow="rgba(255, 200, 60, 0.9)">
            🥁
          </Mark>
          <LinearGradient
            colors={['rgba(255,60,200,0)', 'rgba(255,60,200,0.45)', 'rgba(120,80,255,0.55)']}
            style={[styles.stageGlow, { height: h * 0.45 }]}
          />
          {['♪', '♫', '♪', '♬', '♫'].map((n, i) => (
            <Mark
              key={`n${i}`}
              x={8 + i * 21 + rnd() * 6}
              y={18 + rnd() * 20}
              size={h * (0.12 + rnd() * 0.06)}
              rotate={rnd() * 30 - 15}
              color="#ffffff"
              glow={i % 2 ? '#2fb8ff' : '#ff3ec8'}
            >
              {n}
            </Mark>
          ))}
          {Array.from({ length: 22 }, (_, i) => (
            <Dot
              key={`c${i}`}
              x={i * 4.8 + rnd() * 2}
              y={88 + rnd() * 6}
              size={h * (0.14 + rnd() * 0.06)}
              color="#0a0210"
            />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <View
              key={`a${i}`}
              style={{
                position: 'absolute',
                left: pct(6 + i * 17 + rnd() * 6),
                top: h * (0.68 + rnd() * 0.06),
                width: Math.max(2, h * 0.035),
                height: h * 0.2,
                borderRadius: h,
                backgroundColor: '#0a0210',
                transform: [{ rotate: `${rnd() * 40 - 20}deg` }],
              }}
            />
          ))}
        </>
      );
    },
  },
  plage: {
    fill: ['#5ccbff', '#a8e6ff', '#e8f9ff'],
    draw: (h) => {
      const rnd = random(141);
      return (
        <>
          <Dot x={80} y={20} size={h * 0.32} color="#fff3a0" glow="0 0 30px 12px rgba(255, 230, 120, 0.85)" />
          <Mark x={30} y={20} size={h * 0.12} color="rgba(30, 60, 90, 0.6)">
            ︶
          </Mark>
          <LinearGradient
            colors={['#2ab0e8', '#1689c4', '#2fc0e0']}
            style={[styles.sea, { top: h * 0.46, height: h * 0.3 }]}
          />
          {[0.52, 0.6, 0.68].map((y, i) => (
            <View
              key={y}
              style={[
                styles.haze,
                styles.foam,
                {
                  left: pct(5 + i * 20),
                  right: pct(40 - i * 15),
                  top: h * y,
                  height: Math.max(1, h * 0.012),
                },
              ]}
            />
          ))}
          <Mark x={44} y={44} size={h * 0.18}>
            ⛵
          </Mark>
          <Hump x={40} w={h * 7} h={h * 7} top={h * 0.72} color="#f4d58d" />
          <Hump x={92} w={h * 3} h={h * 3} top={h * 0.68} color="#f8e0a5" />
          {Array.from({ length: 16 }, (_, i) => (
            <Dot
              key={`s${i}`}
              x={rnd() * 100}
              y={82 + rnd() * 16}
              size={Math.max(1, h * 0.015)}
              color="#d9b46a"
            />
          ))}
          <View
            style={[
              styles.towel,
              { top: h * 0.8, width: h * 0.56, height: h * 0.15, borderRadius: Math.max(1, h * 0.015) },
            ]}
          >
            {['#ff5d73', '#ffffff', '#ffb03a', '#ffffff', '#2fb8ff', '#ffffff', '#ff5d73'].map((c, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: c }} />
            ))}
          </View>
          <Mark x={38} y={80} size={h * 0.16}>
            🏐
          </Mark>
          <Mark x={88} y={58} size={h * 0.4}>
            🌴
          </Mark>
          <Mark x={56} y={86} size={h * 0.15} rotate={-10}>
            🐚
          </Mark>
          <Mark x={70} y={88} size={h * 0.16}>
            🦀
          </Mark>
          <Mark x={34} y={88} size={h * 0.14} rotate={8}>
            🩴
          </Mark>
        </>
      );
    },
  },
  nuitdete: {
    fill: ['#070b2e', '#141c5a', '#3a2c78', '#6b3f8f'],
    draw: (h) => {
      const rnd = random(151);
      return (
        <>
          <Stars h={h} count={60} seed={152} />
          <Band
            x={-5}
            y={0}
            w="110%"
            h={h * 0.5}
            rotate={-14}
            colors={['rgba(170,150,255,0)', 'rgba(190,170,255,0.18)', 'rgba(170,150,255,0)']}
          />
          {[
            { x: 22, y: 18, len: 0.9, r: 28 },
            { x: 62, y: 10, len: 0.7, r: 32 },
            { x: 84, y: 30, len: 0.5, r: 26 },
          ].map((s, i) => (
            <Fragment key={`m${i}`}>
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(200,210,255,0.5)', '#ffffff']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{
                  position: 'absolute',
                  left: pct(s.x),
                  top: h * (s.y / 100) - Math.max(1.5, h * 0.018) / 2,
                  width: h * s.len,
                  height: Math.max(1.5, h * 0.018),
                  // Turned around its middle, so shift it back to keep its bright end on the star.
                  marginLeft: (-h * s.len * (1 + Math.cos((s.r * Math.PI) / 180))) / 2,
                  marginTop: (-h * s.len * Math.sin((s.r * Math.PI) / 180)) / 2,
                  borderRadius: h,
                  transform: [{ rotate: `${s.r}deg` }],
                }}
              />
              <Mark x={s.x} y={s.y} size={h * 0.11} color="#ffffff" glow="#c9b8ff">
                ✦
              </Mark>
            </Fragment>
          ))}
          <View
            style={[
              styles.moon,
              {
                left: '88%',
                top: h * 0.1,
                width: h * 0.26,
                height: h * 0.26,
                borderRadius: h * 0.13,
                marginLeft: -h * 0.13,
              },
            ]}
          />
          <Hump x={25} w={h * 5} h={h * 5} top={h * 0.76} color="#160f33" />
          <Hump x={85} w={h * 4} h={h * 4} top={h * 0.7} color="#1c1440" />
          <Mark x={74} y={74} size={h * 0.24}>
            ⛺
          </Mark>
          {Array.from({ length: 12 }, (_, i) => (
            <Dot
              key={`l${i}`}
              x={rnd() * 100}
              y={70 + rnd() * 26}
              size={Math.max(1.5, h * 0.022)}
              color="#f6ff9a"
              glow="0 0 6px 2px rgba(220, 255, 100, 0.85)"
            />
          ))}
        </>
      );
    },
  },
  tableau: {
    fill: ['#355f48', '#2a4d3a', '#1f3d2d'],
    draw: (h) => {
      const chalk = 'rgba(255, 255, 255, 0.82)';
      return (
        <>
          <Band
            x={10}
            y={20}
            w="60%"
            h={h * 0.3}
            rotate={-6}
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']}
          />
          <Band
            x={45}
            y={50}
            w="50%"
            h={h * 0.25}
            rotate={4}
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
          />
          <Text style={[styles.chalk, { left: '6%', top: h * 0.12, fontSize: h * 0.2, color: chalk }]}>
            A b c
          </Text>
          <Text style={[styles.chalk, { left: '8%', top: h * 0.62, fontSize: h * 0.15, color: '#ffe08a' }]}>
            1 + 1 = 2
          </Text>
          <Text style={[styles.chalk, { right: '7%', top: h * 0.12, fontSize: h * 0.15, color: '#9fe3ff' }]}>
            π ≈ 3,14
          </Text>
          <Mark x={56} y={34} size={h * 0.26} color="#ffb3d1">
            ☆
          </Mark>
          <Mark x={70} y={56} size={h * 0.22} color={chalk}>
            △
          </Mark>
          <Mark x={84} y={58} size={h * 0.18} color="#b8ff9f">
            ✓
          </Mark>
          <View style={[styles.ledge, { height: h * 0.14 }]} />
          {[
            { x: 18, c: '#ffffff' },
            { x: 23, c: '#ffe08a' },
            { x: 27, c: '#ff9ac6' },
          ].map((p) => (
            <View
              key={p.x}
              style={{
                position: 'absolute',
                left: pct(p.x),
                bottom: h * 0.1,
                width: h * 0.12,
                height: Math.max(2, h * 0.035),
                borderRadius: 1,
                backgroundColor: p.c,
              }}
            />
          ))}
          <View
            style={[
              styles.eraser,
              { bottom: h * 0.1, width: h * 0.26, height: h * 0.08, borderRadius: Math.max(1, h * 0.015) },
            ]}
          />
          <Mark x={88} y={82} size={h * 0.2}>
            🍎
          </Mark>
        </>
      );
    },
  },
  halloween: {
    fill: ['#1a0a2e', '#3d1450', '#8a2f3a', '#ff7a1a'],
    draw: (h) => {
      const rnd = random(161);
      return (
        <>
          <Stars h={h * 0.5} count={20} seed={162} />
          <Dot x={74} y={30} size={h * 0.46} color="#ffe9a8" glow="0 0 34px 12px rgba(255, 190, 90, 0.75)" />
          <Mark x={66} y={26} size={h * 0.14} rotate={-12}>
            🦇
          </Mark>
          <Mark x={82} y={40} size={h * 0.11} rotate={14}>
            🦇
          </Mark>
          <Mark x={34} y={20} size={h * 0.12} rotate={-6}>
            🦇
          </Mark>
          <Hump x={22} w={h * 4} h={h * 4} top={h * 0.66} color="#140818" />
          <Hump x={85} w={h * 4.6} h={h * 4.6} top={h * 0.74} color="#1b0b20" />
          <Tri x={22} top={h * 0.3} w={h * 0.4} h={h * 0.18} color="#140818" />
          <View
            style={[
              styles.house,
              { left: '22%', top: h * 0.48, width: h * 0.32, height: h * 0.24, marginLeft: -h * 0.16 },
            ]}
          >
            <View style={[styles.window, { width: h * 0.06, height: h * 0.07 }]} />
            <View style={[styles.window, { width: h * 0.06, height: h * 0.07 }]} />
          </View>
          {[46, 54, 60].map((x, i) => (
            <View
              key={`t${i}`}
              style={[
                styles.tomb,
                {
                  left: pct(x),
                  top: h * (0.74 + (i % 2) * 0.05),
                  width: h * 0.1,
                  height: h * 0.14,
                  borderTopLeftRadius: h * 0.05,
                  borderTopRightRadius: h * 0.05,
                },
              ]}
            />
          ))}
          <Mark x={10} y={86} size={h * 0.24}>
            🎃
          </Mark>
          <Mark x={38} y={88} size={h * 0.18}>
            🎃
          </Mark>
          <Mark x={92} y={84} size={h * 0.26}>
            🎃
          </Mark>
          <Mark x={50} y={44} size={h * 0.24} rotate={-8} glow="rgba(220, 210, 255, 0.9)">
            👻
          </Mark>
          {Array.from({ length: 8 }, (_, i) => (
            <Dot
              key={`f${i}`}
              x={rnd() * 100}
              y={60 + rnd() * 35}
              size={Math.max(1.5, h * 0.02)}
              color="#ffb347"
              glow="0 0 5px 1px rgba(255, 140, 0, 0.9)"
            />
          ))}
        </>
      );
    },
  },
  automne: {
    fill: ['#ffe2a8', '#ffb86b', '#f08a4b', '#c2552b'],
    draw: (h) => {
      const rnd = random(171);
      const crowns = ['#ff9f1c', '#e85d04', '#f4c430', '#d62828', '#ffb703'];
      const leaves = ['🍁', '🍂'];
      return (
        <>
          <Dot x={22} y={26} size={h * 0.3} color="#fff1c9" glow="0 0 30px 10px rgba(255, 220, 150, 0.8)" />
          <Hump x={70} w={h * 4} h={h * 4} top={h * 0.62} color="#d9773a" />
          {Array.from({ length: 6 }, (_, i) => {
            const x = 8 + i * 17 + rnd() * 5;
            const s = h * (0.34 + rnd() * 0.14);
            const base = h * (0.78 + rnd() * 0.06);
            return (
              <Fragment key={`t${i}`}>
                <View
                  style={{
                    position: 'absolute',
                    left: pct(x),
                    top: base - s * 0.5,
                    width: Math.max(2, s * 0.12),
                    height: s * 0.6,
                    marginLeft: -Math.max(1, s * 0.06),
                    backgroundColor: '#5a2d14',
                  }}
                />
                <Dot x={x} y={((base - s * 0.75) / h) * 100} size={s} color={crowns[i % crowns.length]} />
                <Dot
                  x={x - 2}
                  y={((base - s * 0.92) / h) * 100}
                  size={s * 0.6}
                  color={crowns[(i + 2) % crowns.length]}
                />
              </Fragment>
            );
          })}
          <Hump x={30} w={h * 6} h={h * 6} top={h * 0.82} color="#a8461f" />
          {Array.from({ length: 18 }, (_, i) => (
            <Dot
              key={`g${i}`}
              x={rnd() * 100}
              y={86 + rnd() * 12}
              size={Math.max(2, h * (0.03 + rnd() * 0.02))}
              color={crowns[i % crowns.length]}
            />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <Mark
              key={`l${i}`}
              x={4 + i * 11.5 + rnd() * 4}
              y={8 + rnd() * 55}
              size={h * (0.1 + rnd() * 0.08)}
              rotate={rnd() * 120 - 60}
            >
              {leaves[i % 2]}
            </Mark>
          ))}
          <Mark x={58} y={88} size={h * 0.16}>
            🍄
          </Mark>
          <Mark x={84} y={90} size={h * 0.14}>
            🌰
          </Mark>
        </>
      );
    },
  },
  noel: {
    fill: ['#081538', '#132a66', '#2a4a8f'],
    draw: (h) => {
      const rnd = random(181);
      const bulbs = 15;
      const colors = ['#ff3b3b', '#ffd23f', '#3bb2ff', '#7dff6b', '#ff7be5'];
      return (
        <>
          <Stars h={h * 0.6} count={24} seed={182} />
          <View style={[styles.wire, { top: h * 0.06 }]} />
          {Array.from({ length: bulbs }, (_, i) => {
            const c = colors[i % colors.length];
            const s = Math.max(3, h * 0.065);
            return (
              <Dot
                key={`b${i}`}
                x={3 + (i * 94) / (bulbs - 1)}
                y={10 + (i % 2) * 3}
                size={s}
                color={c}
                glow={`0 0 8px 2px ${c}`}
              />
            );
          })}
          <Hump x={20} w={h * 5} h={h * 5} top={h * 0.78} color="#e8f1ff" />
          <Hump x={85} w={h * 4} h={h * 4} top={h * 0.74} color="#ffffff" />
          <Pine x={66} base={h * 0.86} size={h * 0.7} color="#1f7a3a" />
          <Mark x={66} y={20} size={h * 0.16} color="#ffd23f" glow="rgba(255, 210, 60, 1)">
            ★
          </Mark>
          {[
            [62, 50],
            [70, 46],
            [64, 64],
            [72, 70],
            [58, 74],
            [67, 78],
          ].map(([x, y], i) => (
            <Dot
              key={`o${i}`}
              x={x}
              y={y}
              size={Math.max(2.5, h * 0.045)}
              color={colors[i % colors.length]}
              glow={`0 0 5px ${colors[i % colors.length]}`}
            />
          ))}
          <Mark x={56} y={86} size={h * 0.18}>
            🎁
          </Mark>
          <Mark x={77} y={88} size={h * 0.15}>
            🎁
          </Mark>
          <Mark x={20} y={70} size={h * 0.3}>
            ⛄
          </Mark>
          <Mark x={90} y={34} size={h * 0.22} rotate={-8}>
            🦌
          </Mark>
          {Array.from({ length: 26 }, (_, i) => (
            <Dot
              key={`s${i}`}
              x={rnd() * 100}
              y={rnd() * 100}
              size={Math.max(1.5, h * (0.012 + rnd() * 0.022))}
              color="#ffffff"
              opacity={0.6 + rnd() * 0.4}
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
  garland: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  bubble: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(230, 255, 255, 0.8)',
    backgroundColor: 'rgba(200, 250, 255, 0.15)',
  },
  petal: { position: 'absolute', backgroundColor: '#ffb3d1', opacity: 0.85 },
  truss: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#1a1a22',
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  sea: { position: 'absolute', left: 0, right: 0 },
  towel: {
    position: 'absolute',
    left: '6%',
    flexDirection: 'row',
    overflow: 'hidden',
    transform: [{ rotate: '-6deg' }],
    boxShadow: '0 1px 2px rgba(120, 80, 20, 0.4)',
  },
  stageGlow: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  foam: { backgroundColor: 'rgba(255, 255, 255, 0.7)', borderRadius: 2 },
  chalk: {
    position: 'absolute',
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 1,
    textShadowColor: 'rgba(255, 255, 255, 0.35)',
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 0 },
  },
  ledge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#8a5a2b',
    borderTopWidth: 2,
    borderColor: '#b07a40',
  },
  eraser: {
    position: 'absolute',
    left: '36%',
    backgroundColor: '#3b3b52',
    borderTopWidth: 2,
    borderColor: '#d9c08a',
  },
  house: {
    position: 'absolute',
    backgroundColor: '#140818',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingTop: '15%',
  },
  window: { backgroundColor: '#ffcf5a', boxShadow: '0 0 6px 1px rgba(255, 190, 60, 0.9)' },
  tomb: { position: 'absolute', backgroundColor: '#4a3f5c', borderWidth: 1, borderColor: '#6b5f80' },
  wire: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#0f3a1f' },
  neonText: {
    color: '#fff0fa',
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: '#00f0ff',
    textShadowOffset: { width: 0, height: 0 },
  },
});
