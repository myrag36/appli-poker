// Espace: deep space with nebulae, the Milky Way, a ringed planet, a moon, a satellite and shooting stars.
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Dot, Haze, Loop, type SceneProps, ShootingStar, many, random, tiny } from './classic-kit';

type Star = { x: number; y: number; s: number; o: number };

function Stars({ stars }: { stars: Star[] }) {
  return (
    <>
      {stars.map((s, i) => (
        <Dot key={i} x={s.x} y={s.y} size={s.s} color={`rgba(255,255,255,${s.o})`} />
      ))}
    </>
  );
}

/** A bright star with four thin rays. */
function Sparkle({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: x - size,
          top: y - 0.5,
          width: size * 2,
          height: 1,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: x - 0.5,
          top: y - size,
          width: 1,
          height: size * 2,
          backgroundColor: color,
        }}
      />
      <Dot
        x={x}
        y={y}
        size={size * 0.28}
        color="#ffffff"
        style={{ boxShadow: `0 0 ${size * 0.6}px ${color}` }}
      />
    </>
  );
}

/** A planet with cloud bands, a shadowed side and a ring passing in front of it. */
function RingedPlanet({ x, y, d, k }: { x: number; y: number; d: number; k: number }) {
  const ringW = d * 1.9;
  const ringH = d * 0.42;
  const ring = (front: boolean) => (
    <View
      style={{
        position: 'absolute',
        left: d / 2 - ringW / 2,
        top: d / 2 - (front ? 0 : ringH / 2),
        width: ringW,
        height: front ? ringH / 2 + 2 : ringH,
        overflow: 'hidden',
      }}
    >
      {[0, 1].map((band) => (
        <View
          key={band}
          style={{
            position: 'absolute',
            left: band * d * 0.08,
            top: (front ? -ringH / 2 : 0) + band * ringH * 0.09,
            width: ringW - band * d * 0.16,
            height: ringH - band * ringH * 0.18,
            borderRadius: '50%',
            borderWidth: (band ? 2 : 5) * k,
            borderColor: band ? 'rgba(255, 220, 255, 0.45)' : 'rgba(224, 170, 255, 0.6)',
          }}
        />
      ))}
    </View>
  );
  return (
    <View
      style={{
        position: 'absolute',
        left: x - d / 2,
        top: y - d / 2,
        width: d,
        height: d,
        transform: [{ rotate: '-14deg' }],
      }}
    >
      {ring(false)}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: d,
          height: d,
          borderRadius: d / 2,
          overflow: 'hidden',
          boxShadow: `0 0 ${40 * k}px rgba(199, 125, 255, 0.45)`,
        }}
      >
        <LinearGradient
          colors={['#f0c8ff', '#b15ee8', '#5a189a', '#2a0650']}
          style={StyleSheet.absoluteFill}
        />
        {[0.22, 0.34, 0.5, 0.63, 0.78].map((t, i) => (
          <View
            key={t}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: d * t,
              height: d * (0.03 + (i % 2) * 0.04),
              backgroundColor: i % 2 ? 'rgba(255, 230, 255, 0.16)' : 'rgba(40, 0, 80, 0.22)',
            }}
          />
        ))}
        {/* Night side */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.15)', 'rgba(5,0,15,0.85)']}
          start={{ x: 0.1, y: 0.1 }}
          end={{ x: 1, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {ring(true)}
    </View>
  );
}

function Moon({ x, y, d }: { x: number; y: number; d: number }) {
  const craters = [
    [0.3, 0.35, 0.18],
    [0.62, 0.55, 0.12],
    [0.45, 0.72, 0.1],
    [0.68, 0.28, 0.08],
  ];
  return (
    <View
      style={{
        position: 'absolute',
        left: x - d / 2,
        top: y - d / 2,
        width: d,
        height: d,
        borderRadius: d / 2,
        overflow: 'hidden',
        boxShadow: `0 0 ${d * 0.4}px rgba(220, 200, 255, 0.35)`,
      }}
    >
      <LinearGradient
        colors={['#f1e6ff', '#cdb4db', '#7a6a8a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {craters.map(([cx, cy, r]) => (
        <View
          key={cx}
          style={{
            position: 'absolute',
            left: d * (cx - r / 2),
            top: d * (cy - r / 2),
            width: d * r,
            height: d * r,
            borderRadius: d * r,
            backgroundColor: 'rgba(90, 70, 110, 0.35)',
            borderTopWidth: Math.max(1, d * 0.012),
            borderColor: 'rgba(60, 40, 80, 0.45)',
          }}
        />
      ))}
    </View>
  );
}

/** A little satellite with two solar panels, tumbling slowly. */
function Satellite({ x, y, s, still }: { x: number; y: number; s: number; still?: boolean }) {
  const panel = (left: number) => (
    <View
      style={{
        position: 'absolute',
        left,
        top: 6 * s,
        width: 22 * s,
        height: 10 * s,
        backgroundColor: '#1f3a6e',
        borderWidth: Math.max(1, s),
        borderColor: '#7aa6e8',
        flexDirection: 'row',
      }}
    >
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{ flex: 1, borderRightWidth: i < 2 ? Math.max(0.5, 0.6 * s) : 0, borderColor: '#7aa6e8' }}
        />
      ))}
    </View>
  );
  return (
    <Loop
      motion="sway"
      amp={10}
      duration={14000}
      still={still}
      style={{ position: 'absolute', left: x - 30 * s, top: y - 11 * s, width: 60 * s, height: 22 * s }}
    >
      {panel(0)}
      {panel(38 * s)}
      <View
        style={{
          position: 'absolute',
          left: 22 * s,
          top: 3 * s,
          width: 16 * s,
          height: 16 * s,
          borderRadius: 3 * s,
          backgroundColor: '#c9c9d6',
          borderWidth: Math.max(1, s),
          borderColor: '#8a8aa0',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 29 * s,
          top: -6 * s,
          width: 2 * s,
          height: 9 * s,
          backgroundColor: '#c9c9d6',
        }}
      />
      <Dot
        x={30 * s}
        y={-7 * s}
        size={3 * s}
        color="#ff5c5c"
        style={{ boxShadow: `0 0 ${4 * s}px #ff5c5c` }}
      />
    </Loop>
  );
}

export function Space({ w, h, k }: SceneProps) {
  const still = tiny(w);
  const narrow = w < 560;
  const rand = random(42);
  const star = (yMin = 0, yMax = h): Star => ({
    x: rand() * w,
    y: yMin + rand() * (yMax - yMin),
    s: (0.7 + rand() * 1.8) * k,
    o: 0.25 + rand() * 0.65,
  });
  const fixed = Array.from({ length: many(70, w) }, () => star());
  const twinkling = [0, 1, 2].map(() => Array.from({ length: many(18, w) }, () => star()));
  // The Milky Way: a diagonal band thick with faint stars.
  const band = Math.hypot(w, h);
  const milky = Array.from({ length: many(110, w) }, () => ({
    x: rand() * band,
    y: (rand() + rand() + rand()) / 3,
    s: (0.5 + rand() * 1.1) * k,
    o: 0.2 + rand() * 0.5,
  }));
  // On a phone the header fills the top: the big planet rises from the bottom right instead.
  const phone = narrow && k >= 0.95;
  const planet = Math.min(w * (narrow ? 0.34 : 0.13), 260 * k);
  return (
    <>
      {/* Nebulae: soft clouds of colour, mostly towards the corners */}
      <Haze
        x={w * 0.08}
        y={h * 0.8}
        width={Math.max(w, h) * 0.75}
        height={Math.max(w, h) * 0.55}
        color="rgba(123, 44, 191, 0.32)"
      />
      <Haze x={w * 0.0} y={h * 0.58} width={Math.max(w, h) * 0.4} color="rgba(247, 37, 133, 0.16)" />
      <Haze x={w * 0.22} y={h * 0.95} width={Math.max(w, h) * 0.35} color="rgba(255, 110, 180, 0.12)" />
      <Haze
        x={w * 0.95}
        y={h * 0.66}
        width={Math.max(w, h) * 0.5}
        height={Math.max(w, h) * 0.4}
        color="rgba(76, 201, 240, 0.16)"
      />
      <Haze x={w * 0.85} y={h * 0.92} width={Math.max(w, h) * 0.45} color="rgba(199, 125, 255, 0.18)" />
      <Haze
        x={w * 0.3}
        y={h * 0.04}
        width={Math.max(w, h) * 0.45}
        height={Math.max(w, h) * 0.25}
        color="rgba(76, 100, 240, 0.16)"
      />
      <Haze x={w * 0.5} y={h * 0.5} width={w * 0.9} height={h * 0.7} color="rgba(0, 0, 0, 0.35)" />
      <View
        style={{
          position: 'absolute',
          left: w / 2 - band / 2,
          top: h / 2 - band * 0.11,
          width: band,
          height: band * 0.22,
          transform: [{ rotate: `${Math.atan2(h, w) * -0.75}rad` }],
        }}
      >
        <LinearGradient
          colors={[
            'rgba(200, 170, 255, 0)',
            'rgba(200, 170, 255, 0.07)',
            'rgba(255, 230, 255, 0.1)',
            'rgba(200, 170, 255, 0.07)',
            'rgba(200, 170, 255, 0)',
          ]}
          style={StyleSheet.absoluteFill}
        />
        {milky.map((s, i) => (
          <Dot key={i} x={s.x} y={s.y * band * 0.22} size={s.s} color={`rgba(255,240,255,${s.o})`} />
        ))}
      </View>
      <Stars stars={fixed} />
      {twinkling.map((group, g) => (
        <Loop
          key={`tw${g}`}
          motion="twinkle"
          duration={2400 + g * 1100}
          delay={g * 900}
          still={still}
          style={StyleSheet.absoluteFill}
        >
          <Stars stars={group} />
        </Loop>
      ))}
      {[
        [0.07, 0.42, 9, '#bde0ff'],
        [0.93, 0.36, 11, '#ffd6f5'],
        [0.18, 0.92, 8, '#e0c3ff'],
        [0.8, 0.97, 7, '#bde0ff'],
        [0.42, 0.03, 6, '#ffffff'],
      ].map(([x, y, s, c], i) => (
        <Loop
          key={`sk${i}`}
          motion="pulse"
          duration={3000 + i * 700}
          delay={i * 600}
          still={still}
          style={StyleSheet.absoluteFill}
        >
          <Sparkle x={w * (x as number)} y={h * (y as number)} size={(s as number) * k} color={c as string} />
        </Loop>
      ))}
      <ShootingStar
        x={w * 0.1}
        y={h * 0.1}
        length={90 * k}
        angle={25}
        duration={8000}
        delay={2000}
        k={k}
        still={still}
      />
      <ShootingStar
        x={w * 0.55}
        y={h * 0.62}
        length={70 * k}
        angle={35}
        duration={11000}
        delay={8000}
        color="#e0aaff"
        k={k}
        still={still}
      />
      <ShootingStar
        x={w * 0.7}
        y={h * 0.02}
        length={60 * k}
        angle={140}
        duration={14000}
        delay={12000}
        k={k}
        still={still}
      />

      {/* Small blue planet far away, bottom left */}
      <View
        style={{
          position: 'absolute',
          left: -w * 0.04,
          top: h - planet * 0.42,
          width: planet * 0.9,
          height: planet * 0.9,
          borderRadius: planet,
          overflow: 'hidden',
          boxShadow: `0 0 ${30 * k}px ${4 * k}px rgba(76, 201, 240, 0.35)`,
        }}
      >
        <LinearGradient
          colors={['#a9e8ff', '#3a86c8', '#0d2a52']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {[0.12, 0.26, 0.4].map((t) => (
          <View
            key={t}
            style={{
              position: 'absolute',
              left: planet * t,
              top: planet * (0.06 + t * 0.3),
              width: planet * 0.4,
              height: planet * 0.06,
              borderRadius: planet,
              backgroundColor: 'rgba(255,255,255,0.25)',
            }}
          />
        ))}
      </View>
      <RingedPlanet
        x={w * (phone ? 0.8 : narrow ? 0.74 : 0.54)}
        y={phone ? h - planet * 0.35 : narrow ? h * 0.12 + planet * 0.2 : h * 0.1}
        d={planet}
        k={k}
      />
      <Moon x={w * (narrow ? 0.12 : 0.06)} y={h * (narrow ? 0.05 : 0.16)} d={Math.min(w * 0.08, 64 * k)} />
      {/* Asteroids drifting in the lower right corner */}
      {Array.from({ length: 6 }, (_, i) => {
        const size = (8 + rand() * 18) * k;
        return (
          <View
            key={`as${i}`}
            style={{
              position: 'absolute',
              left: w * (0.72 + rand() * 0.26),
              top: phone ? h * (0.62 + rand() * 0.12) : h * (0.72 + rand() * 0.2),
              width: size,
              height: size * 0.8,
              borderTopLeftRadius: size * 0.5,
              borderTopRightRadius: size * 0.3,
              borderBottomLeftRadius: size * 0.35,
              borderBottomRightRadius: size * 0.55,
              backgroundColor: '#3d3550',
              borderTopWidth: Math.max(1, size * 0.08),
              borderColor: 'rgba(200, 180, 230, 0.45)',
              transform: [{ rotate: `${rand() * 360}deg` }],
            }}
          />
        );
      })}
      <Satellite
        x={w * (phone ? 0.84 : narrow ? 0.8 : 0.1)}
        y={phone ? 34 * k : h * (narrow ? 0.93 : 0.3)}
        s={k * (narrow ? 0.8 : 1)}
        still={still}
      />
    </>
  );
}
