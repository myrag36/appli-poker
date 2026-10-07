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
});
