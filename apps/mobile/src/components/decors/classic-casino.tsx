// Casino: a gaming room with crystal chandeliers, a roulette wheel and a row of slot machines.
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Dot, Glow, Line, Loop, type SceneProps, random, tiny } from './classic-kit';

const SUITS = ['♠', '♥', '♦', '♣'];
const GOLD = '#e8c766';

/** The wallpaper: rows of card suits, a little brighter towards the edges. */
function Wallpaper({ w, h, k }: SceneProps) {
  const step = 92 * k;
  const cols = Math.ceil(w / step) + 1;
  const rows = Math.ceil(h / step) + 1;
  return (
    <>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const x = c * step + (r % 2 ? step / 2 : 0);
          const edge = Math.min(1, Math.abs(x - w / 2) / (w / 2));
          return (
            <Text
              key={`${r}-${c}`}
              style={{
                position: 'absolute',
                fontSize: 30 * k,
                color: (r + c) % 4 === 0 ? 'rgba(232, 199, 102, 0.07)' : 'rgba(255, 255, 255, 0.035)',
                opacity: 0.55 + edge * 0.6,
                left: x - 20 * k,
                top: r * step - 20 * k,
                transform: [{ rotate: `${((r + c) % 2 ? 1 : -1) * 15}deg` }],
              }}
            >
              {SUITS[(r + c) % 4]}
            </Text>
          );
        }),
      )}
    </>
  );
}

/** A crystal chandelier hanging from the ceiling, its candles flickering. */
function Chandelier({ x, drop, s, still }: { x: number; drop: number; s: number; still?: boolean }) {
  const ringW = 74 * s;
  const ringY = drop;
  const candles = [-0.5, -0.25, 0, 0.25, 0.5];
  const crystals = [-0.42, -0.28, -0.14, 0, 0.14, 0.28, 0.42];
  return (
    <>
      {/* Warm light around it. */}
      <Loop
        motion="flicker"
        duration={3200}
        delay={x * 7}
        still={still}
        style={{
          position: 'absolute',
          left: x - 90 * s,
          top: ringY - 80 * s,
          width: 180 * s,
          height: 160 * s,
        }}
      >
        <Glow x={90 * s} y={70 * s} size={80 * s} color="rgba(255, 214, 140, 0.13)" />
      </Loop>
      <Line x1={x} y1={0} x2={x} y2={ringY - 14 * s} color="rgba(232, 199, 102, 0.6)" width={1.5 * s} />
      {/* Crown */}
      <View
        style={{
          position: 'absolute',
          left: x - 9 * s,
          top: ringY - 18 * s,
          width: 18 * s,
          height: 10 * s,
          borderTopLeftRadius: 9 * s,
          borderTopRightRadius: 9 * s,
          backgroundColor: '#b8913a',
        }}
      />
      {/* Arms */}
      {candles.map((c) => (
        <Line
          key={`a${c}`}
          x1={x}
          y1={ringY - 6 * s}
          x2={x + c * ringW}
          y2={ringY + 2 * s}
          color="rgba(214, 178, 90, 0.85)"
          width={1.6 * s}
        />
      ))}
      {/* Crystal drops in a V under the ring. */}
      {crystals.map((c, i) => {
        const len = (14 + (3 - Math.abs(i - 3)) * 6) * s;
        return (
          <View key={`c${c}`}>
            <Line
              x1={x + c * ringW}
              y1={ringY + 4 * s}
              x2={x + c * ringW * 0.9}
              y2={ringY + 4 * s + len}
              color="rgba(255, 245, 220, 0.35)"
              width={1 * s}
            />
            <View
              style={{
                position: 'absolute',
                left: x + c * ringW * 0.9 - 2.5 * s,
                top: ringY + 2 * s + len,
                width: 5 * s,
                height: 5 * s,
                backgroundColor: 'rgba(235, 248, 255, 0.85)',
                transform: [{ rotate: '45deg' }],
                boxShadow: `0 0 ${4 * s}px rgba(200, 235, 255, 0.8)`,
              }}
            />
          </View>
        );
      })}
      {/* The ring itself */}
      <View
        style={{
          position: 'absolute',
          left: x - ringW / 2,
          top: ringY - 3 * s,
          width: ringW,
          height: 8 * s,
          borderRadius: 4 * s,
          backgroundColor: '#c9a24a',
          borderBottomWidth: 2 * s,
          borderColor: '#7a5a1c',
        }}
      />
      {/* Candles with their flames. */}
      {candles.map((c) => (
        <View key={`f${c}`}>
          <View
            style={{
              position: 'absolute',
              left: x + c * ringW - 2 * s,
              top: ringY - 12 * s,
              width: 4 * s,
              height: 10 * s,
              backgroundColor: '#fff4dc',
            }}
          />
          <Dot
            x={x + c * ringW}
            y={ringY - 15 * s}
            size={4 * s}
            color="#ffe2a0"
            style={{ boxShadow: `0 0 ${6 * s}px ${3 * s}px rgba(255, 200, 110, 0.75)` }}
          />
        </View>
      ))}
    </>
  );
}

/** A roulette wheel seen from above at an angle, turning slowly. */
function Roulette({ x, y, r, still }: { x: number; y: number; r: number; still?: boolean }) {
  const pockets = 37;
  const ring = r * 0.74;
  const pocketW = ((2 * Math.PI * ring) / pockets) * 1.02;
  return (
    <View
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        transform: [{ scaleY: 0.5 }],
      }}
    >
      {/* Wooden bowl */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          overflow: 'hidden',
          boxShadow: `0 ${r * 0.08}px ${r * 0.2}px rgba(0,0,0,0.6)`,
        }}
      >
        <LinearGradient colors={['#6b3b1c', '#3a1d0c', '#1c0c04']} style={StyleSheet.absoluteFill} />
      </View>
      <View
        style={{
          position: 'absolute',
          left: r * 0.1,
          top: r * 0.1,
          width: r * 1.8,
          height: r * 1.8,
          borderRadius: r,
          borderWidth: Math.max(1, r * 0.025),
          borderColor: '#c9a24a',
          backgroundColor: '#24120a',
        }}
      />
      <Loop
        motion="spin"
        duration={90000}
        still={still}
        style={{ position: 'absolute', left: 0, top: 0, width: r * 2, height: r * 2 }}
      >
        {Array.from({ length: pockets }, (_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: r - pocketW / 2,
              top: 0,
              width: pocketW,
              height: r * 2,
              transform: [{ rotate: `${(i * 360) / pockets}deg` }],
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: r - ring - r * 0.09,
                left: 0,
                right: 0,
                height: r * 0.18,
                backgroundColor: i === 0 ? '#1b7a3f' : i % 2 ? '#b3121c' : '#111111',
                borderLeftWidth: Math.max(0.5, r * 0.006),
                borderColor: 'rgba(232, 199, 102, 0.7)',
              }}
            />
          </View>
        ))}
        {/* Inner cone and turret */}
        <View
          style={{
            position: 'absolute',
            left: r - ring * 0.82,
            top: r - ring * 0.82,
            width: ring * 1.64,
            height: ring * 1.64,
            borderRadius: ring,
            overflow: 'hidden',
            borderWidth: Math.max(1, r * 0.02),
            borderColor: '#b8913a',
          }}
        >
          <LinearGradient
            colors={['#8a5530', '#4e2a12', '#2a1608']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        {[0, 90].map((a) => (
          <View
            key={a}
            style={{
              position: 'absolute',
              left: r - ring * 0.55,
              top: r - r * 0.025,
              width: ring * 1.1,
              height: r * 0.05,
              borderRadius: r * 0.03,
              backgroundColor: GOLD,
              transform: [{ rotate: `${a + 20}deg` }],
            }}
          />
        ))}
        <Dot x={r} y={r} size={r * 0.14} color="#f3d77e" style={{ borderWidth: 1, borderColor: '#8a6a22' }} />
        {/* The ball, resting in a pocket. */}
        <Dot
          x={r + ring * Math.cos(1.1)}
          y={r + ring * Math.sin(1.1)}
          size={r * 0.07}
          color="#fdfdfd"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
        />
      </Loop>
    </View>
  );
}

const REELS = [
  ['7', '#e63946'],
  ['♦', '#e63946'],
  ['★', '#f4b400'],
  ['🍒', ''],
  ['♣', '#111111'],
  ['BAR', '#2b2b2b'],
] as const;

/** A slot machine: cabinet, glowing reels, a light on top and its lever. */
function Slot({
  x,
  bottom,
  s,
  hue,
  seed,
  still,
}: {
  x: number;
  bottom: number;
  s: number;
  hue: string;
  seed: number;
  still?: boolean;
}) {
  const bw = 46 * s;
  const bh = 92 * s;
  const top = bottom - bh;
  const rand = random(seed);
  return (
    <View style={{ position: 'absolute', left: x, top, width: bw + 8 * s, height: bh + 14 * s }}>
      {/* Light on top */}
      <Loop
        motion="pulse"
        duration={1400 + seed * 130}
        delay={seed * 300}
        still={still}
        style={{ position: 'absolute', left: bw / 2 - 7 * s, top: 0, width: 14 * s, height: 10 * s }}
      >
        <View
          style={{
            flex: 1,
            borderTopLeftRadius: 7 * s,
            borderTopRightRadius: 7 * s,
            backgroundColor: hue,
            boxShadow: `0 0 ${10 * s}px ${4 * s}px ${hue}`,
          }}
        />
      </Loop>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 10 * s,
          width: bw,
          height: bh,
          borderTopLeftRadius: 12 * s,
          borderTopRightRadius: 12 * s,
          borderRadius: 3 * s,
          overflow: 'hidden',
          borderWidth: Math.max(1, 1.2 * s),
          borderColor: 'rgba(232, 199, 102, 0.55)',
          boxShadow: `0 0 ${16 * s}px rgba(0,0,0,0.7)`,
        }}
      >
        <LinearGradient colors={['#3a1424', '#200a14', '#0d0408']} style={StyleSheet.absoluteFill} />
        {/* Top panel */}
        <View
          style={{
            marginTop: 6 * s,
            marginHorizontal: 5 * s,
            height: 12 * s,
            borderRadius: 3 * s,
            backgroundColor: hue,
            opacity: 0.85,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 7 * s, fontWeight: '900', color: '#1a0610', letterSpacing: 0.5 * s }}>
            JACKPOT
          </Text>
        </View>
        {/* Reels */}
        <View
          style={{
            marginTop: 6 * s,
            marginHorizontal: 4 * s,
            height: 22 * s,
            flexDirection: 'row',
            gap: 2 * s,
            padding: 2 * s,
            borderRadius: 3 * s,
            backgroundColor: '#111',
            boxShadow: `0 0 ${10 * s}px ${hue}`,
          }}
        >
          {[0, 1, 2].map((i) => {
            const [sym, col] = REELS[Math.floor(rand() * REELS.length)];
            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  backgroundColor: '#fbf6e9',
                  borderRadius: 1.5 * s,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <Text
                  style={{
                    fontSize: (sym.length > 1 ? 5 : 11) * s,
                    fontWeight: '900',
                    color: col || undefined,
                  }}
                >
                  {sym}
                </Text>
              </View>
            );
          })}
        </View>
        {/* Buttons and coin tray */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 3 * s, marginTop: 7 * s }}>
          {['#e63946', '#f4b400', '#2ec4b6'].map((c) => (
            <View
              key={c}
              style={{
                width: 6 * s,
                height: 4 * s,
                borderRadius: 1.5 * s,
                backgroundColor: c,
                opacity: 0.85,
              }}
            />
          ))}
        </View>
        <View
          style={{
            position: 'absolute',
            left: 6 * s,
            right: 6 * s,
            bottom: 8 * s,
            height: 8 * s,
            borderRadius: 2 * s,
            backgroundColor: '#05020a',
            borderTopWidth: 1.2 * s,
            borderColor: 'rgba(232, 199, 102, 0.6)',
          }}
        />
      </View>
      {/* Lever */}
      <Line x1={bw + 1 * s} y1={46 * s} x2={bw + 5 * s} y2={26 * s} color="#9a9a9a" width={1.8 * s} />
      <Dot x={bw + 5 * s} y={25 * s} size={6 * s} color="#d62828" />
    </View>
  );
}

export function Suits({ w, h, k }: SceneProps) {
  const still = tiny(w);
  const narrow = w < 560;
  const floor = h * 0.84;
  const rand = random(19);
  // Kept clear of the title and the profile bar, which sit at the top left and right.
  const phone = narrow && k >= 0.95;
  const chandeliers = phone ? [0.5] : narrow ? [0.16, 0.84] : [0.04, 0.5, 0.96];
  const slotS = Math.min(1.25, Math.max(0.75, h / 800)) * k;
  const slots = narrow ? 2 : 4;
  const wheelR = Math.min(w * (narrow ? 0.3 : 0.15), 230 * k);
  return (
    <>
      <Wallpaper w={w} h={h} k={k} />
      {/* Ceiling shadow and a soft pool of light down the middle. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: h * 0.14 }}
      />
      {/* Pilasters along both sides. */}
      {[0, 1].map((side) => (
        <LinearGradient
          key={side}
          colors={['rgba(232, 199, 102, 0)', 'rgba(232, 199, 102, 0.08)', 'rgba(232, 199, 102, 0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 26 * k,
            left: side ? undefined : w * 0.02,
            right: side ? w * 0.02 : undefined,
          }}
        />
      ))}
      {/* Gold sparkles drifting near the ceiling. */}
      {Array.from({ length: narrow ? 10 : 18 }, (_, i) => (
        <Loop
          key={`sp${i}`}
          motion="twinkle"
          duration={2200 + rand() * 2600}
          delay={rand() * 4000}
          still={still}
          style={{
            position: 'absolute',
            left: rand() * w,
            top: rand() * h * 0.26,
            width: 3 * k,
            height: 3 * k,
            borderRadius: 2 * k,
            backgroundColor: 'rgba(255, 226, 150, 0.8)',
            boxShadow: `0 0 ${5 * k}px rgba(255, 210, 120, 0.9)`,
          }}
        />
      ))}
      {chandeliers.map((x, i) => (
        <Chandelier
          key={x}
          x={w * x}
          drop={(narrow ? 34 : i % 2 ? 58 : 44) * k}
          s={k * (narrow ? 0.8 : 1)}
          still={still}
        />
      ))}

      {/* Casino carpet */}
      <LinearGradient
        colors={['rgba(40, 6, 14, 0)', 'rgba(40, 6, 14, 0.75)', '#1a0408']}
        locations={[0, 0.25, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: floor - h * 0.05, bottom: 0 }}
      />
      {Array.from({ length: 4 }, (_, r) =>
        Array.from({ length: Math.ceil(w / (26 * k)) + 1 }, (_, c) => (
          <View
            key={`cp${r}-${c}`}
            style={{
              position: 'absolute',
              left: c * 26 * k + (r % 2 ? 13 * k : 0),
              top: floor + 8 * k + r * 16 * k * (1 + r * 0.25),
              width: (5 + r) * k,
              height: (5 + r) * k,
              backgroundColor: r % 2 ? 'rgba(232, 199, 102, 0.12)' : 'rgba(46, 196, 182, 0.08)',
              transform: [{ rotate: '45deg' }],
            }}
          />
        )),
      )}
      <Line x1={0} y1={floor} x2={w} y2={floor} color="rgba(232, 199, 102, 0.25)" width={Math.max(1, k)} />

      <Roulette x={narrow ? w * 0.04 : w * 0.06} y={h - wheelR * 0.18} r={wheelR} still={still} />
      {Array.from({ length: slots }, (_, i) => {
        const s = slotS * (1 - (slots - 1 - i) * 0.08);
        const x = w - (slots - i) * 52 * slotS - 6 * k;
        const hue = ['#ff4d6d', '#ffd166', '#4cc9f0', '#b388ff'][i % 4];
        return (
          <View key={`sl${i}`}>
            <Glow x={x + 23 * s} y={floor + 6 * k} size={40 * s} color={`${hue}22`} />
            <Slot x={x} bottom={floor + 14 * k} s={s} hue={hue} seed={i + 1} still={still} />
          </View>
        );
      })}
      {/* Darker edges keep the eye on the middle. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']}
        locations={[0, 0.12, 0.88, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </>
  );
}
