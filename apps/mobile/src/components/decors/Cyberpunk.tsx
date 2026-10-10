// A rainy megacity at night: towers lit by neon signs, a holographic ace above the roofs,
// flying cars, cables and a wet street reflecting it all.
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type DecorProps, Cross, Drift, Glow, Hanging, Line, Loop, random, tiny } from './kit';

const NEON = ['#00e5ff', '#ff2a6d', '#f5e663', '#7cff6b', '#b84dff'];

type Tower = { x: number; w: number; top: number; seed: number };

/** Faraway towers in the smog: flat shapes with a scatter of lit windows. */
function FarTowers({ w, base, k, list }: { w: number; base: number; k: number; list: Tower[] }) {
  return (
    <>
      {list.map((t, i) => {
        const rand = random(t.seed);
        const lit = Math.round((t.w * (base - t.top)) / (420 * k * k));
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: t.x,
              top: t.top,
              width: t.w,
              height: base - t.top,
              backgroundColor: '#141a30',
              borderTopWidth: Math.max(1, k),
              borderColor: 'rgba(0, 229, 255, 0.18)',
            }}
          >
            {Array.from({ length: Math.min(lit, 40) }, (_, j) => (
              <View
                key={j}
                style={{
                  position: 'absolute',
                  left: Math.floor((rand() * t.w) / (5 * k)) * 5 * k,
                  top: Math.floor((rand() * (base - t.top)) / (7 * k)) * 7 * k,
                  width: 2.5 * k,
                  height: 3.5 * k,
                  backgroundColor: rand() > 0.7 ? 'rgba(255, 200, 120, 0.55)' : 'rgba(120, 220, 255, 0.4)',
                }}
              />
            ))}
            {i % 3 === 0 && (
              <View
                style={{
                  position: 'absolute',
                  left: t.w / 2 - k,
                  top: -26 * k,
                  width: 2 * k,
                  height: 26 * k,
                  backgroundColor: '#141a30',
                }}
              />
            )}
          </View>
        );
      })}
      {/* Smog glowing with the city's lights. */}
      <LinearGradient
        colors={['rgba(184, 77, 255, 0)', 'rgba(255, 42, 109, 0.12)', 'rgba(0, 229, 255, 0.1)']}
        style={{ position: 'absolute', left: 0, width: w, top: base * 0.45, height: base * 0.55 }}
      />
    </>
  );
}

/** A tall vertical neon sign with its letters stacked, blinking now and then. */
function VSign({
  x,
  y,
  text,
  color,
  k,
  still,
  delay,
}: {
  x: number;
  y: number;
  text: string;
  color: string;
  k: number;
  still: boolean;
  delay: number;
}) {
  const sw = 26 * k;
  const sh = text.length * 19 * k + 12 * k;
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: x - 10 * k,
          top: y + 10 * k,
          width: 10 * k,
          height: 3 * k,
          backgroundColor: '#2a2e3a',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: x - 10 * k,
          top: y + sh - 14 * k,
          width: 10 * k,
          height: 3 * k,
          backgroundColor: '#2a2e3a',
        }}
      />
      <Loop
        motion="blink"
        duration={5000 + delay}
        delay={delay}
        still={still}
        style={{ position: 'absolute', left: x, top: y, width: sw, height: sh }}
      >
        <View
          style={{
            width: sw,
            height: sh,
            borderRadius: 3 * k,
            backgroundColor: 'rgba(8, 10, 20, 0.92)',
            borderWidth: 2 * k,
            borderColor: color,
            boxShadow: `0 0 ${10 * k}px ${color}`,
            alignItems: 'center',
            paddingTop: 5 * k,
          }}
        >
          {text.split('').map((c, i) => (
            <Text
              key={i}
              style={{
                fontSize: 15 * k,
                lineHeight: 19 * k,
                fontWeight: '900',
                color: '#ffffff',
                textShadowColor: color,
                textShadowRadius: 6 * k,
              }}
            >
              {c}
            </Text>
          ))}
        </View>
      </Loop>
    </>
  );
}

/** A horizontal neon word on a roof or a wall. */
function HSign({
  x,
  y,
  text,
  color,
  size,
  k,
  still,
  delay,
  boxed,
}: {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  k: number;
  still: boolean;
  delay: number;
  boxed?: boolean;
}) {
  return (
    <Loop
      motion="blink"
      duration={6400 + delay}
      delay={delay}
      still={still}
      style={{ position: 'absolute', left: x, top: y }}
    >
      <Text
        style={{
          fontSize: size * k,
          fontWeight: '900',
          letterSpacing: 2 * k,
          color: '#ffffff',
          textShadowColor: color,
          textShadowRadius: 8 * k,
          paddingHorizontal: boxed ? 6 * k : 0,
          borderWidth: boxed ? 2 * k : 0,
          borderColor: color,
          borderRadius: 4 * k,
          backgroundColor: boxed ? 'rgba(8, 10, 20, 0.85)' : 'transparent',
          boxShadow: boxed ? `0 0 ${10 * k}px ${color}` : undefined,
        }}
      >
        {text}
      </Text>
    </Loop>
  );
}

/** A closer tower: dark, with a rim of neon light, lit windows in rows and small roof details. */
function Tower({ t, base, k, still }: { t: Tower; base: number; k: number; still: boolean }) {
  const rand = random(t.seed);
  const hgt = base - t.top;
  const rim = NEON[t.seed % NEON.length];
  const rows = Math.floor(hgt / (16 * k));
  const cols = Math.max(1, Math.floor(t.w / (14 * k)));
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: t.x,
          top: t.top,
          width: t.w,
          height: hgt,
          overflow: 'hidden',
          borderLeftWidth: Math.max(1, 1.5 * k),
          borderColor: `${rim}55`,
        }}
      >
        <LinearGradient colors={['#10142a', '#0a0d1a', '#05060c']} style={StyleSheet.absoluteFill} />
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const on = rand();
            if (on < 0.62) return null;
            return (
              <View
                key={`${r}-${c}`}
                style={{
                  position: 'absolute',
                  left: 5 * k + c * 14 * k,
                  top: 8 * k + r * 16 * k,
                  width: 7 * k,
                  height: 8 * k,
                  backgroundColor:
                    on > 0.93
                      ? 'rgba(255, 42, 109, 0.55)'
                      : on > 0.8
                        ? 'rgba(255, 210, 140, 0.5)'
                        : 'rgba(110, 200, 255, 0.35)',
                }}
              />
            );
          }),
        )}
        {/* Floors' lines and the shade at the bottom. */}
        {Array.from({ length: Math.floor(rows / 4) }, (_, i) => (
          <View
            key={`f${i}`}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: (i + 1) * 64 * k,
              height: Math.max(1, k),
              backgroundColor: 'rgba(0, 229, 255, 0.08)',
            }}
          />
        ))}
        <LinearGradient
          colors={['rgba(5,6,12,0)', 'rgba(5,6,12,0.85)']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: hgt * 0.5 }}
        />
      </View>
      {/* Roof: a ledge, an air unit and an antenna with a red light. */}
      <View
        style={{
          position: 'absolute',
          left: t.x - 3 * k,
          top: t.top - 4 * k,
          width: t.w + 6 * k,
          height: 5 * k,
          backgroundColor: '#1c2236',
          borderTopWidth: Math.max(1, k),
          borderColor: `${rim}88`,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: t.x + t.w * 0.15,
          top: t.top - 14 * k,
          width: 20 * k,
          height: 10 * k,
          backgroundColor: '#161a2a',
          borderWidth: Math.max(1, k),
          borderColor: '#2a3048',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: t.x + t.w * 0.7,
          top: t.top - 46 * k,
          width: 2 * k,
          height: 42 * k,
          backgroundColor: '#2a3048',
        }}
      />
      <Loop
        motion="pulse"
        duration={2000}
        delay={t.seed * 170}
        still={still}
        style={{ position: 'absolute', left: t.x + t.w * 0.7 - 2.5 * k, top: t.top - 50 * k }}
      >
        <View
          style={{
            width: 6 * k,
            height: 6 * k,
            borderRadius: 3 * k,
            backgroundColor: '#ff3344',
            boxShadow: `0 0 ${8 * k}px ${2 * k}px rgba(255, 51, 68, 0.8)`,
          }}
        />
      </Loop>
    </>
  );
}

/** A huge holographic ace of spades hovering above the roofs, with scan lines and its projector beam. */
function HoloAce({ x, roof, k, still }: { x: number; roof: number; k: number; still: boolean }) {
  const cw = 86 * k;
  const ch = 120 * k;
  const y = roof - 46 * k - ch / 2;
  return (
    <>
      <LinearGradient
        colors={['rgba(0, 229, 255, 0.16)', 'rgba(0, 229, 255, 0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: 'absolute',
          left: x - cw * 0.55,
          top: y + ch / 2,
          width: cw * 1.1,
          height: roof - y - ch / 2,
          transform: [{ scaleX: -1 }],
        }}
      />
      <Glow x={x} y={y} size={cw * 0.9} color="rgba(0, 229, 255, 0.1)" />
      <Loop
        motion="pulse"
        duration={3800}
        still={still}
        style={{ position: 'absolute', left: x - cw / 2, top: y - ch / 2, width: cw, height: ch }}
      >
        <View
          style={{
            width: cw,
            height: ch,
            borderRadius: 8 * k,
            borderWidth: 2 * k,
            borderColor: 'rgba(120, 240, 255, 0.9)',
            backgroundColor: 'rgba(0, 229, 255, 0.12)',
            overflow: 'hidden',
            boxShadow: `0 0 ${14 * k}px rgba(0, 229, 255, 0.7)`,
          }}
        >
          <Text
            style={{
              position: 'absolute',
              left: 7 * k,
              top: 3 * k,
              fontSize: 20 * k,
              fontWeight: '900',
              color: '#c8fbff',
              textShadowColor: '#00e5ff',
              textShadowRadius: 6 * k,
            }}
          >
            A
          </Text>
          <Text
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: ch * 0.22,
              textAlign: 'center',
              fontSize: 56 * k,
              lineHeight: 64 * k,
              color: '#c8fbff',
              textShadowColor: '#00e5ff',
              textShadowRadius: 10 * k,
            }}
          >
            ♠
          </Text>
          {Array.from({ length: Math.floor(ch / (4 * k)) }, (_, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: i * 4 * k,
                height: Math.max(1, k),
                backgroundColor: 'rgba(0, 20, 30, 0.35)',
              }}
            />
          ))}
        </View>
      </Loop>
      {/* The glitch bar running down the card. */}
      <Loop
        motion="blink"
        duration={4300}
        still={still}
        style={{
          position: 'absolute',
          left: x - cw / 2 - 6 * k,
          top: y - 6 * k,
          width: cw + 12 * k,
          height: 5 * k,
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(255, 42, 109, 0.35)' }} />
      </Loop>
      <View
        style={{
          position: 'absolute',
          left: x - cw * 0.5,
          top: roof - 10 * k,
          width: cw,
          height: 12 * k,
          borderRadius: cw,
          borderWidth: 2 * k,
          borderColor: 'rgba(0, 229, 255, 0.6)',
          backgroundColor: '#0a0d1a',
        }}
      />
    </>
  );
}

/** A flying car: a dark capsule with a headlight, a red tail light and a light trail. */
function Car({ x, y, k, color }: { x: number; y: number; k: number; color: string }) {
  return (
    <>
      <LinearGradient
        colors={['rgba(255, 60, 80, 0)', 'rgba(255, 60, 80, 0.5)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ position: 'absolute', left: x - 60 * k, top: y + 4 * k, width: 60 * k, height: 2 * k }}
      />
      <View
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: 30 * k,
          height: 9 * k,
          borderRadius: 5 * k,
          backgroundColor: '#1a1e2e',
          borderTopWidth: Math.max(1, k),
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: x - k,
          top: y + 3 * k,
          width: 4 * k,
          height: 3 * k,
          backgroundColor: '#ff3344',
          boxShadow: `0 0 ${5 * k}px #ff3344`,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: x + 27 * k,
          top: y + 3 * k,
          width: 4 * k,
          height: 3 * k,
          backgroundColor: '#fffbe0',
          boxShadow: `0 0 ${8 * k}px ${2 * k}px rgba(255, 250, 220, 0.8)`,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: x + 8 * k,
          top: y + 9 * k,
          width: 14 * k,
          height: 2 * k,
          backgroundColor: color,
          boxShadow: `0 0 ${6 * k}px ${color}`,
        }}
      />
    </>
  );
}

export function Cyberpunk({ w, h, k }: DecorProps) {
  const still = tiny(w);
  const land = w > h * 1.1;
  const street = h * (land ? 0.86 : 0.88);
  const rand = random(101);

  // Faraway towers across the whole width, then closer ones mostly on the sides.
  const far: Tower[] = [];
  for (let x = -10 * k; x < w; ) {
    const tw = (40 + rand() * 60) * k;
    far.push({ x, w: tw, top: h * (0.2 + rand() * 0.35), seed: far.length + 1 });
    x += tw + rand() * 10 * k;
  }
  const near: Tower[] = (
    land
      ? [
          [0, 110, 0.12],
          [0.07, 90, 0.3],
          [0.15, 120, 0.22],
          [0.27, 80, 0.42],
          [0.62, 90, 0.38],
          [0.72, 130, 0.18],
          [0.84, 100, 0.3],
          [0.92, 130, 0.1],
        ]
      : [
          [-0.05, 90, 0.16],
          [0.18, 70, 0.36],
          [0.6, 70, 0.32],
          [0.78, 100, 0.12],
        ]
  ).map(([x, tw, top], i) => ({ x: w * x, w: tw * k, top: h * top, seed: i + 3 }));

  // The tower the hologram stands on.
  const holo = land ? 4 : 2;
  const rainA = Array.from({ length: land ? 140 : 70 }, () => ({
    x: rand() * w,
    y: rand() * h,
    l: (10 + rand() * 14) * k,
    o: 0.12 + rand() * 0.25,
  }));
  const rainB = Array.from({ length: land ? 60 : 30 }, () => ({
    x: rand() * w,
    y: rand() * h,
    l: (22 + rand() * 18) * k,
    o: 0.2 + rand() * 0.25,
  }));
  const reflections = [
    ...near.map((t, i) => ({ x: t.x + t.w * 0.3, c: NEON[(t.seed + 1) % NEON.length], ww: t.w * 0.4, i })),
  ];

  return (
    <>
      {/* Smoggy night sky. */}
      <LinearGradient
        colors={['#07060f', '#1a0d2e', '#3a1240', '#1a2a4a']}
        locations={[0, 0.35, 0.7, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: street }}
      />
      <FarTowers w={w} base={street} k={k} list={far} />

      {/* Flying cars in two lanes, one far and one near. */}
      <Cross top={h * 0.14} width={w} height={20 * k} duration={land ? 26000 : 16000} still={still}>
        <Car x={w * 0.2} y={4 * k} k={k * 0.6} color="#00e5ff" />
        <Car x={w * 0.7} y={8 * k} k={k * 0.6} color="#ff2a6d" />
      </Cross>
      <Cross top={h * 0.24} width={w} height={24 * k} duration={land ? 17000 : 11000} still={still}>
        <Car x={w * 0.45} y={4 * k} k={k} color="#f5e663" />
      </Cross>

      {near.map((t, i) => (
        <Tower key={i} t={t} base={street} k={k} still={still} />
      ))}

      <HoloAce
        x={near[holo].x + near[holo].w / 2}
        roof={near[holo].top - 4 * k}
        k={k * (land ? 1.05 : 0.8)}
        still={still}
      />

      {/* Neon signs on the towers. */}
      {(land
        ? [
            [w * 0.07 - 26 * k, h * 0.36, 'HOTEL', '#ff2a6d'],
            [w * 0.15 + 120 * k, h * 0.3, 'BAR', '#00e5ff'],
            [w * 0.92 - 26 * k, h * 0.2, 'CASINO', '#f5e663'],
            [w * 0.84 - 26 * k, h * 0.42, 'RAMEN', '#7cff6b'],
          ]
        : [
            [w * 0.18 - 26 * k, h * 0.42, 'HOTEL', '#ff2a6d'],
            [w * 0.78 - 26 * k, h * 0.38, 'BAR', '#00e5ff'],
            [w * 0.6 + 70 * k, h * 0.42, 'RAMEN', '#7cff6b'],
          ]
      ).map(([x, y, text, c], i) => (
        <VSign
          key={i}
          x={x as number}
          y={y as number}
          text={text as string}
          color={c as string}
          k={k}
          still={still}
          delay={i * 1300}
        />
      ))}
      {land ? (
        <>
          <HSign
            x={w * 0.004}
            y={h * 0.64}
            text="NEO·TOKYO"
            color="#b84dff"
            size={13}
            k={k}
            still={still}
            delay={600}
          />
          <HSign
            x={w * 0.004 + 4 * k}
            y={h * 0.53}
            text="24/7"
            color="#ff2a6d"
            size={20}
            k={k}
            still={still}
            delay={2100}
            boxed
          />
          <HSign
            x={w * 0.27 + 4 * k}
            y={h * 0.38}
            text="♠♥♦♣"
            color="#00e5ff"
            size={14}
            k={k}
            still={still}
            delay={3000}
          />
        </>
      ) : (
        <>
          <HSign
            x={w * 0.78 + 6 * k}
            y={h * 0.09}
            text="24/7"
            color="#ff2a6d"
            size={16}
            k={k}
            still={still}
            delay={2100}
            boxed
          />
          <HSign
            x={4 * k}
            y={h * 0.11}
            text="NEO·TOKYO"
            color="#b84dff"
            size={13}
            k={k}
            still={still}
            delay={600}
          />
        </>
      )}

      {/* Cables strung between the towers, with a sign hanging from one. */}
      <Line x1={0} y1={h * 0.05} x2={w * 0.5} y2={h * 0.1} color="#05060c" width={2 * k} />
      <Line x1={w * 0.5} y1={h * 0.1} x2={w} y2={h * 0.04} color="#05060c" width={2 * k} />
      <Line x1={0} y1={h * 0.09} x2={w * 0.35} y2={h * 0.13} color="#05060c" width={1.5 * k} />
      <Line x1={w * 0.35} y1={h * 0.13} x2={w} y2={h * 0.08} color="#05060c" width={1.5 * k} />
      <Hanging
        x={w * (land ? 0.57 : 0.5)}
        y={h * (land ? 0.1 - 0.06 * 0.14 : 0.1)}
        width={110 * k}
        length={44 * k}
        duration={4600}
        still={still}
      >
        <View
          style={{
            position: 'absolute',
            left: 30 * k,
            top: 0,
            width: 1.5 * k,
            height: 12 * k,
            backgroundColor: '#3a3e4a',
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 78 * k,
            top: 0,
            width: 1.5 * k,
            height: 12 * k,
            backgroundColor: '#3a3e4a',
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 10 * k,
            top: 12 * k,
            width: 90 * k,
            height: 26 * k,
            borderRadius: 4 * k,
            backgroundColor: 'rgba(8, 10, 20, 0.9)',
            borderWidth: 2 * k,
            borderColor: '#f5e663',
            boxShadow: `0 0 ${10 * k}px #f5e663`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 12 * k,
              fontWeight: '900',
              color: '#ffffff',
              letterSpacing: 1.5 * k,
              textShadowColor: '#f5e663',
              textShadowRadius: 6 * k,
            }}
          >
            OPEN
          </Text>
        </View>
      </Hanging>

      {/* The wet street, with the neon lights reflected in it. */}
      <LinearGradient
        colors={['#141a2e', '#090b16', '#04050a']}
        style={{ position: 'absolute', left: 0, right: 0, top: street, bottom: 0 }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: street,
          height: 2 * k,
          backgroundColor: 'rgba(0, 229, 255, 0.5)',
          boxShadow: `0 0 ${10 * k}px rgba(0, 229, 255, 0.6)`,
        }}
      />
      {[0, 1].map((g) => (
        <Loop
          key={g}
          motion="pulse"
          duration={3000 + g * 1100}
          delay={g * 900}
          still={still}
          style={StyleSheet.absoluteFill}
        >
          {reflections
            .filter((r) => r.i % 2 === g)
            .map((r, i) => (
              <View key={i}>
                {Array.from({ length: 9 }, (_, j) => {
                  const jw = r.ww * (0.5 + ((j * 7 + r.i * 3) % 5) / 8);
                  return (
                    <View
                      key={j}
                      style={{
                        position: 'absolute',
                        left: r.x + (r.ww - jw) / 2 + (((j * 5) % 3) - 1) * 4 * k,
                        top: street + 4 * k + j * (h - street) * 0.1,
                        width: jw,
                        height: (h - street) * 0.06,
                        borderRadius: 3 * k,
                        backgroundColor: r.c,
                        opacity: 0.42 * (1 - j / 10),
                      }}
                    />
                  );
                })}
              </View>
            ))}
        </Loop>
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <View
          key={`pd${i}`}
          style={{
            position: 'absolute',
            left: rand() * w - 30 * k,
            top: street + (h - street) * (0.25 + rand() * 0.6),
            width: (40 + rand() * 70) * k,
            height: (4 + rand() * 5) * k,
            borderRadius: 40 * k,
            backgroundColor: 'rgba(120, 200, 255, 0.1)',
            borderTopWidth: Math.max(1, k),
            borderColor: 'rgba(200, 240, 255, 0.25)',
          }}
        />
      ))}

      {/* Rain: fine streaks far away, longer ones up close. */}
      <Drift width={w} height={h} duration={1300} still={still}>
        {rainA.map((r, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: r.x,
              top: r.y,
              width: Math.max(1, k),
              height: r.l,
              backgroundColor: `rgba(170, 210, 255, ${r.o})`,
              transform: [{ rotate: '10deg' }],
            }}
          />
        ))}
      </Drift>
      <Drift width={w} height={h} duration={800} still={still}>
        {rainB.map((r, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: r.x,
              top: r.y,
              width: Math.max(1, 1.4 * k),
              height: r.l,
              backgroundColor: `rgba(200, 230, 255, ${r.o})`,
              transform: [{ rotate: '10deg' }],
            }}
          />
        ))}
      </Drift>
      {/* A darker veil in the middle, where the panels sit. */}
      <LinearGradient
        colors={['rgba(4,5,10,0)', 'rgba(4,5,10,0.35)', 'rgba(4,5,10,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ position: 'absolute', left: 0, right: 0, top: h * 0.3, bottom: 0 }}
      />
    </>
  );
}
