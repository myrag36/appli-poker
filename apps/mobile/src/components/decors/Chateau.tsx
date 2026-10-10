// A castle's great hall at night: stone walls, a stained-glass window, torches, banners and a chandelier.
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type DecorProps, Drift, Flame, Glow, Hanging, Line, Loop, Tri, random, tiny } from './kit';

const STONES = ['#3b3438', '#36302f', '#403739', '#332d30', '#3e3634', '#383236'];
const BLUES = ['#1f4fa0', '#183d80', '#2a5cb0', '#14306a', '#234a94'];
const GLASS = ['#9b1d2a', '#c9962e', '#2a7a4a', '#5a2a8a', '#b4532a', '#1d6f8f'];

/** Rows of cut stone blocks, each a little different, with mortar between them. */
function Wall({ w, h, k }: DecorProps) {
  const rand = random(23);
  const row = 30 * k;
  const blocks: { x: number; y: number; bw: number; c: string; lit: number }[] = [];
  for (let r = 0; r * row < h; r++) {
    let x = -(r % 2) * 30 * k;
    while (x < w) {
      const bw = (52 + rand() * 40) * k;
      blocks.push({ x, y: r * row, bw, c: STONES[(rand() * STONES.length) | 0], lit: rand() });
      x += bw;
    }
  }
  return (
    <>
      {blocks.map((b, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: b.x,
            top: b.y,
            width: b.bw - 2 * k,
            height: row - 2 * k,
            borderRadius: 2 * k,
            backgroundColor: b.c,
            borderTopWidth: Math.max(1, k),
            borderLeftWidth: Math.max(1, k),
            borderColor: `rgba(255, 230, 200, ${0.04 + b.lit * 0.05})`,
            borderBottomWidth: Math.max(1, k),
            borderBottomColor: 'rgba(0,0,0,0.3)',
          }}
        >
          {b.lit > 0.82 && (
            <View
              style={{
                position: 'absolute',
                left: b.bw * 0.3,
                top: row * 0.35,
                width: b.bw * 0.25,
                height: Math.max(1, k),
                backgroundColor: 'rgba(0,0,0,0.25)',
                transform: [{ rotate: '-12deg' }],
              }}
            />
          )}
        </View>
      ))}
    </>
  );
}

/** A tall arched window of stained glass, with a rose at the top and moonlight through it. */
function Window({ x, top, ww, wh, k }: { x: number; top: number; ww: number; wh: number; k: number }) {
  const rand = random(31);
  const frame = 12 * k;
  const lanes = 4;
  const lw = ww / 3;
  const pane = lw / lanes;
  const cols = lanes * 3;
  const rows = Math.ceil(wh / pane);
  const rose = ww * 0.62;
  const medalTop = ww * 0.2 + rose + lw * 0.3;
  const medals = Math.max(1, Math.floor((wh - medalTop) / (lw * 1.05)));
  return (
    <>
      {/* Stone surround. */}
      <View
        style={{
          position: 'absolute',
          left: x - ww / 2 - frame,
          top: top - frame,
          width: ww + frame * 2,
          height: wh + frame * 2,
          borderTopLeftRadius: ww / 2 + frame,
          borderTopRightRadius: ww / 2 + frame,
          backgroundColor: '#5a5052',
          borderWidth: 2 * k,
          borderColor: '#6e6264',
          boxShadow: `0 ${4 * k}px ${14 * k}px rgba(0,0,0,0.6)`,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: x - ww / 2,
          top,
          width: ww,
          height: wh,
          borderTopLeftRadius: ww / 2,
          borderTopRightRadius: ww / 2,
          overflow: 'hidden',
          backgroundColor: '#0d1430',
        }}
      >
        {/* Small blue quarries, with a ruby border down each light. */}
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const edge = c % lanes === 0 || c % lanes === lanes - 1;
            return (
              <View
                key={`${r}-${c}`}
                style={{
                  position: 'absolute',
                  left: c * pane,
                  top: r * pane,
                  width: pane,
                  height: pane,
                  backgroundColor: edge
                    ? r % 2
                      ? '#8a1a26'
                      : '#a8242f'
                    : BLUES[(rand() * BLUES.length) | 0],
                  opacity: 0.55 + rand() * 0.3,
                  borderWidth: Math.max(1, 1.2 * k),
                  borderColor: '#14100e',
                }}
              />
            );
          }),
        )}
        {/* Round medallions stacked in each of the three lights. */}
        {[0, 1, 2].map((l) =>
          Array.from({ length: medals }, (_, m) => {
            const d = lw * 0.62;
            const c = GLASS[(l + m * 2) % GLASS.length];
            return (
              <View
                key={`m${l}-${m}`}
                style={{
                  position: 'absolute',
                  left: l * lw + lw / 2 - d / 2,
                  top: medalTop + m * lw * 1.05,
                  width: d,
                  height: d,
                  borderRadius: d / 2,
                  backgroundColor: c,
                  borderWidth: Math.max(1, 2 * k),
                  borderColor: '#14100e',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.92,
                }}
              >
                <View
                  style={{
                    width: d * 0.42,
                    height: d * 0.42,
                    borderRadius: m % 2 ? d : 2 * k,
                    backgroundColor: m % 2 ? '#e8b84a' : '#f2e6c8',
                    borderWidth: Math.max(1, 1.2 * k),
                    borderColor: '#14100e',
                    transform: [{ rotate: '45deg' }],
                    opacity: 0.85,
                  }}
                />
              </View>
            );
          }),
        )}
        {/* The rose: petals around a golden heart. */}
        <View
          style={{
            position: 'absolute',
            left: ww / 2 - rose / 2,
            top: ww * 0.2,
            width: rose,
            height: rose,
            borderRadius: rose / 2,
            backgroundColor: '#14223f',
            borderWidth: 2.5 * k,
            borderColor: '#14100e',
          }}
        />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          const pr = rose * 0.17;
          return (
            <View
              key={`p${i}`}
              style={{
                position: 'absolute',
                left: ww / 2 + Math.cos(a) * rose * 0.27 - pr,
                top: ww * 0.2 + rose / 2 + Math.sin(a) * rose * 0.27 - pr,
                width: pr * 2,
                height: pr * 2,
                borderRadius: pr,
                backgroundColor: i % 2 ? '#9b1d2a' : '#1f4fa0',
                borderWidth: Math.max(1, 1.5 * k),
                borderColor: '#14100e',
                opacity: 0.9,
              }}
            />
          );
        })}
        <View
          style={{
            position: 'absolute',
            left: ww / 2 - rose * 0.13,
            top: ww * 0.2 + rose / 2 - rose * 0.13,
            width: rose * 0.26,
            height: rose * 0.26,
            borderRadius: rose,
            backgroundColor: '#e8b84a',
            borderWidth: Math.max(1, 1.5 * k),
            borderColor: '#14100e',
          }}
        />
        {/* Small round lights of tracery around the rose. */}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const d = rose * 0.1;
          return (
            <View
              key={`t${i}`}
              style={{
                position: 'absolute',
                left: ww / 2 + Math.cos(a) * rose * 0.44 - d / 2,
                top: ww * 0.2 + rose / 2 + Math.sin(a) * rose * 0.44 - d / 2,
                width: d,
                height: d,
                borderRadius: d,
                backgroundColor: i % 2 ? '#e8b84a' : '#2a7a4a',
                borderWidth: Math.max(1, k),
                borderColor: '#14100e',
              }}
            />
          );
        })}
        {/* Stone mullions splitting the lights. */}
        {[1 / 3, 2 / 3].map((p) => (
          <View
            key={p}
            style={{
              position: 'absolute',
              left: ww * p - 2.5 * k,
              top: ww * 0.2 + rose,
              bottom: 0,
              width: 5 * k,
              backgroundColor: '#5a5052',
            }}
          />
        ))}
        {[0.62, 0.82].map((p) => (
          <View
            key={p}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: wh * p,
              height: 3 * k,
              backgroundColor: '#3a3234',
            }}
          />
        ))}
        {/* Moonlight from behind, brighter at the top. */}
        <LinearGradient
          colors={['rgba(200, 215, 255, 0.22)', 'rgba(200, 215, 255, 0)', 'rgba(0,0,0,0.35)']}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {/* The sill. */}
      <View
        style={{
          position: 'absolute',
          left: x - ww / 2 - frame * 1.6,
          top: top + wh + frame * 0.6,
          width: ww + frame * 3.2,
          height: 9 * k,
          borderRadius: 2 * k,
          backgroundColor: '#6e6264',
          borderBottomWidth: 3 * k,
          borderColor: '#2a2426',
        }}
      />
    </>
  );
}

/** A wall torch in an iron sconce, with flickering flames, a warm halo and rising embers. */
function Torch({
  x,
  y,
  k,
  still,
  delay,
}: {
  x: number;
  y: number;
  k: number;
  still: boolean;
  delay: number;
}) {
  const rand = random(Math.round(x + y));
  const embers = Array.from({ length: 9 }, () => ({
    x: 30 * k + (rand() - 0.5) * 34 * k,
    y: rand() * 140 * k,
    s: (1.5 + rand() * 2) * k,
  }));
  return (
    <>
      <Loop
        motion="flicker"
        duration={2300}
        delay={delay}
        still={still}
        style={{ position: 'absolute', left: x - 110 * k, top: y - 150 * k, width: 220 * k, height: 220 * k }}
      >
        <Glow x={110 * k} y={110 * k} size={120 * k} color="rgba(255, 150, 60, 0.16)" />
      </Loop>
      {/* Soot on the stone above. */}
      <Glow x={x} y={y - 60 * k} size={18 * k} color="rgba(0, 0, 0, 0.18)" />
      {/* The iron bracket. */}
      <View
        style={{
          position: 'absolute',
          left: x - 9 * k,
          top: y + 22 * k,
          width: 18 * k,
          height: 30 * k,
          borderRadius: 3 * k,
          backgroundColor: '#1e1c1e',
          borderWidth: Math.max(1, k),
          borderColor: '#4a4448',
        }}
      />
      <Line x1={x} y1={y + 36 * k} x2={x} y2={y + 6 * k} color="#2a2628" width={4 * k} />
      {/* The torch: a wooden handle with a pitch-soaked head in a cup. */}
      <View
        style={{
          position: 'absolute',
          left: x - 4 * k,
          top: y - 2 * k,
          width: 8 * k,
          height: 40 * k,
          borderRadius: 3 * k,
          backgroundColor: '#5e3a1c',
          borderLeftWidth: Math.max(1, k),
          borderColor: '#8a5a32',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: x - 10 * k,
          top: y - 8 * k,
          width: 20 * k,
          height: 12 * k,
          borderBottomLeftRadius: 8 * k,
          borderBottomRightRadius: 8 * k,
          backgroundColor: '#2a2628',
          borderTopWidth: 2 * k,
          borderColor: '#5a5458',
        }}
      />
      <Loop
        motion="flicker"
        duration={700}
        delay={delay}
        still={still}
        style={{ position: 'absolute', left: x - 20 * k, top: y - 48 * k, width: 40 * k, height: 44 * k }}
      >
        <Flame x={20 * k} y={42 * k} size={20 * k} color="rgba(230, 80, 20, 0.9)" stretch={1.7} />
        <Flame x={19 * k} y={41 * k} size={14 * k} color="#ff9a2e" stretch={1.6} />
        <Flame x={20 * k} y={40 * k} size={8 * k} color="#ffe9a0" stretch={1.5} />
      </Loop>
      <Drift
        left={x - 30 * k}
        top={y - 170 * k}
        width={60 * k}
        height={140 * k}
        up
        duration={5200}
        still={still}
      >
        {embers.map((e, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: e.x,
              top: e.y,
              width: e.s,
              height: e.s,
              borderRadius: e.s,
              backgroundColor: i % 2 ? '#ffb347' : '#ff7b2e',
              opacity: 0.8,
            }}
          />
        ))}
      </Drift>
    </>
  );
}

/** A long swallow-tailed banner with a heraldic sign, hanging from a pole. */
function Banner({
  x,
  y,
  bw,
  bh,
  k,
  color,
  dark,
  sign,
  still,
  delay,
}: {
  x: number;
  y: number;
  bw: number;
  bh: number;
  k: number;
  color: string;
  dark: string;
  sign: string;
  still: boolean;
  delay: number;
}) {
  const tail = bw * 0.35;
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: x - bw / 2 - 12 * k,
          top: y - 4 * k,
          width: bw + 24 * k,
          height: 7 * k,
          borderRadius: 4 * k,
          backgroundColor: '#3a2614',
          borderTopWidth: Math.max(1, k),
          borderColor: '#8a5a32',
        }}
      />
      {[-1, 1].map((s) => (
        <View
          key={s}
          style={{
            position: 'absolute',
            left: x + s * (bw / 2 + 12 * k) - 5 * k,
            top: y - 5 * k,
            width: 10 * k,
            height: 10 * k,
            borderRadius: 5 * k,
            backgroundColor: '#c79a3c',
          }}
        />
      ))}
      <Hanging
        x={x}
        y={y + 2 * k}
        width={bw + 8 * k}
        length={bh + tail}
        duration={7000}
        delay={delay}
        still={still}
      >
        <View
          style={{
            position: 'absolute',
            left: 4 * k,
            top: 0,
            width: bw,
            height: bh,
            overflow: 'hidden',
            borderLeftWidth: 3 * k,
            borderRightWidth: 3 * k,
            borderColor: '#c79a3c',
          }}
        >
          <LinearGradient
            colors={[dark, color, color, dark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {[0.25, 0.5, 0.75].map((p) => (
            <View
              key={p}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: bw * p,
                width: Math.max(1, k),
                backgroundColor: 'rgba(0,0,0,0.18)',
              }}
            />
          ))}
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 8 * k,
              height: 3 * k,
              backgroundColor: '#c79a3c',
            }}
          />
          <Text
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: bh * 0.32,
              textAlign: 'center',
              fontSize: bw * 0.62,
              color: '#e8b84a',
              textShadowColor: 'rgba(0,0,0,0.5)',
              textShadowRadius: 3 * k,
            }}
          >
            {sign}
          </Text>
          <LinearGradient
            colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <Tri x={4 * k + bw * 0.25} y={bh} width={bw / 2} height={tail} color={dark} down />
        <Tri x={4 * k + bw * 0.75} y={bh} width={bw / 2} height={tail} color={dark} down />
      </Hanging>
    </>
  );
}

/** An iron ring of candles hanging on a chain. */
function Chandelier({ x, y, r, k, still }: { x: number; y: number; r: number; k: number; still: boolean }) {
  const candles = 7;
  return (
    <>
      <Line x1={x} y1={0} x2={x} y2={y} color="#1a181a" width={3 * k} />
      {Array.from({ length: Math.floor(y / (8 * k)) }, (_, i) => (
        <View
          key={`c${i}`}
          style={{
            position: 'absolute',
            left: x - 2.5 * k,
            top: i * 8 * k,
            width: 5 * k,
            height: 7 * k,
            borderRadius: 3 * k,
            borderWidth: Math.max(1, 1.2 * k),
            borderColor: '#2e2a2c',
          }}
        />
      ))}
      {[-0.9, 0.9].map((s) => (
        <Line key={s} x1={x} y1={y} x2={x + s * r} y2={y + r * 0.42} color="#1a181a" width={2 * k} />
      ))}
      <Loop
        motion="flicker"
        duration={2600}
        still={still}
        style={{
          position: 'absolute',
          left: x - r * 1.6,
          top: y + r * 0.4 - r * 1.6,
          width: r * 3.2,
          height: r * 3.2,
        }}
      >
        <Glow x={r * 1.6} y={r * 1.4} size={r * 1.4} color="rgba(255, 180, 90, 0.16)" />
      </Loop>
      {Array.from({ length: candles }, (_, i) => {
        const t = i / (candles - 1);
        const cx = x - r + t * r * 2;
        const cy = y + r * 0.4 + Math.sin(t * Math.PI) * r * 0.16;
        return (
          <View key={i}>
            <View
              style={{
                position: 'absolute',
                left: cx - 3 * k,
                top: cy - 14 * k,
                width: 6 * k,
                height: 14 * k,
                borderRadius: 1.5 * k,
                backgroundColor: '#efe4cc',
              }}
            />
            <Loop
              motion="flicker"
              duration={800 + i * 70}
              delay={i * 130}
              still={still}
              style={{
                position: 'absolute',
                left: cx - 6 * k,
                top: cy - 30 * k,
                width: 12 * k,
                height: 16 * k,
              }}
            >
              <Flame x={6 * k} y={15 * k} size={6 * k} color="#ffb347" stretch={1.7} />
              <Flame x={6 * k} y={14 * k} size={3 * k} color="#fff4c2" stretch={1.5} />
            </Loop>
          </View>
        );
      })}
      <View
        style={{
          position: 'absolute',
          left: x - r - 4 * k,
          top: y + r * 0.4 - 6 * k,
          width: r * 2 + 8 * k,
          height: r * 0.34 + 10 * k,
          borderRadius: r,
          borderWidth: 4 * k,
          borderColor: '#1a181a',
          borderTopColor: '#3a3436',
        }}
      />
    </>
  );
}

/** A round shield with two crossed swords behind it. */
function Shield({ x, y, k }: { x: number; y: number; k: number }) {
  const s = 46 * k;
  const sword = (a: number) => (
    <View
      style={{
        position: 'absolute',
        left: x - 60 * k,
        top: y - 3 * k,
        width: 120 * k,
        height: 6 * k,
        transform: [{ rotate: `${a}deg` }],
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 86 * k,
          height: 6 * k,
          borderTopLeftRadius: 6 * k,
          borderBottomLeftRadius: 6 * k,
          backgroundColor: '#b9bcc4',
          borderBottomWidth: 2 * k,
          borderColor: '#7a7d86',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 84 * k,
          top: -7 * k,
          width: 5 * k,
          height: 20 * k,
          borderRadius: 2 * k,
          backgroundColor: '#c79a3c',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 89 * k,
          top: 0,
          width: 24 * k,
          height: 6 * k,
          backgroundColor: '#4a2c14',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 112 * k,
          top: -1 * k,
          width: 8 * k,
          height: 8 * k,
          borderRadius: 4 * k,
          backgroundColor: '#c79a3c',
        }}
      />
    </View>
  );
  return (
    <>
      {sword(-35)}
      {sword(215)}
      <View
        style={{
          position: 'absolute',
          left: x - s / 2,
          top: y - s / 2,
          width: s,
          height: s,
          borderRadius: s / 2,
          overflow: 'hidden',
          borderWidth: 3 * k,
          borderColor: '#c79a3c',
          boxShadow: `0 ${3 * k}px ${8 * k}px rgba(0,0,0,0.6)`,
        }}
      >
        <LinearGradient colors={['#2a4d8f', '#1a3366']} style={StyleSheet.absoluteFill} />
        <View
          style={{
            position: 'absolute',
            left: s / 2 - 5 * k,
            top: 0,
            bottom: 0,
            width: 7 * k,
            backgroundColor: '#e8b84a',
            opacity: 0.85,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: s / 2 - 8 * k,
            top: s / 2 - 8 * k,
            width: 12 * k,
            height: 12 * k,
            borderRadius: 6 * k,
            backgroundColor: '#d8dbe2',
            borderWidth: Math.max(1, k),
            borderColor: '#7a7d86',
          }}
        />
      </View>
    </>
  );
}

export function Chateau({ w, h, k }: DecorProps) {
  const still = tiny(w);
  const land = w > h * 1.1;
  const floorY = h * (land ? 0.8 : 0.84);
  const ww = land ? Math.min(w * 0.13, 210 * k) : w * 0.3;
  const wh = land ? h * 0.42 : h * 0.3;
  const winTop = h * (land ? 0.1 : 0.1);
  const rand = random(41);
  const motes = Array.from({ length: 22 }, () => ({
    x: rand() * ww * 1.6,
    y: rand() * h * 0.6,
    s: (1 + rand() * 1.6) * k,
  }));
  const torches = land
    ? [
        [w * 0.035, h * 0.42],
        [w * 0.965, h * 0.42],
        [w * 0.36, h * 0.24],
        [w * 0.64, h * 0.24],
      ]
    : [
        [w * 0.065, h * 0.42],
        [w * 0.935, h * 0.42],
      ];

  return (
    <>
      <Wall w={w} h={floorY} k={k} />
      {/* Darker towards the corners and the vault. */}
      <LinearGradient
        colors={['rgba(8,6,8,0.75)', 'rgba(8,6,8,0.15)', 'rgba(8,6,8,0.35)']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: floorY }}
      />
      <LinearGradient
        colors={['rgba(8,6,8,0.7)', 'rgba(8,6,8,0)', 'rgba(8,6,8,0)', 'rgba(8,6,8,0.7)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: floorY }}
      />

      {/* Wooden beams of the ceiling. */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 22 * k, overflow: 'hidden' }}>
        <LinearGradient colors={['#2a1a10', '#4a2e1a', '#1e130b']} style={StyleSheet.absoluteFill} />
      </View>
      {Array.from({ length: Math.ceil(w / (120 * k)) + 1 }, (_, i) => (
        <View
          key={`cb${i}`}
          style={{
            position: 'absolute',
            left: i * 120 * k - 8 * k,
            top: 18 * k,
            width: 16 * k,
            height: 16 * k,
            borderBottomLeftRadius: 4 * k,
            borderBottomRightRadius: 4 * k,
            backgroundColor: '#2e1d12',
          }}
        />
      ))}

      {/* Moonlight through the window falling across the hall, with dust in it. */}
      <View
        style={{
          position: 'absolute',
          left: w / 2 - ww * 0.8,
          top: winTop + wh * 0.4,
          width: ww * 1.6,
          height: h,
          transform: [{ skewX: '-14deg' }],
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={['rgba(170, 190, 255, 0.13)', 'rgba(170, 190, 255, 0.04)', 'rgba(170, 190, 255, 0)']}
          style={StyleSheet.absoluteFill}
        />
        <Drift width={ww * 1.6} height={h * 0.6} duration={26000} still={still}>
          {motes.map((m, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: m.x,
                top: m.y,
                width: m.s,
                height: m.s,
                borderRadius: m.s,
                backgroundColor: 'rgba(230, 235, 255, 0.45)',
              }}
            />
          ))}
        </Drift>
      </View>
      <Window x={w / 2} top={winTop} ww={ww} wh={wh} k={k} />

      {land && [0.22, 0.78].map((p) => <Shield key={p} x={w * p} y={h * 0.13} k={k} />)}

      {/* Banners on both sides of the window. */}
      {(land
        ? [
            [w * 0.29, '#7a1f33', '#3e0c18', '⚜'],
            [w * 0.71, '#1f3a7a', '#0c1a3e', '♛'],
            [w * 0.08, '#1f3a7a', '#0c1a3e', '♛'],
            [w * 0.92, '#7a1f33', '#3e0c18', '⚜'],
          ]
        : [
            [w * 0.17, '#7a1f33', '#3e0c18', '⚜'],
            [w * 0.83, '#1f3a7a', '#0c1a3e', '♛'],
          ]
      ).map(([bx, c, d, sign], i) => (
        <Banner
          key={i}
          x={bx as number}
          y={34 * k}
          bw={(land ? 50 : 46) * k}
          bh={h * (land ? 0.3 : 0.24)}
          k={k}
          color={c as string}
          dark={d as string}
          sign={sign as string}
          still={still}
          delay={i * 1700}
        />
      ))}

      {torches.map(([tx, ty], i) => (
        <Torch key={i} x={tx} y={ty} k={k} still={still} delay={i * 450} />
      ))}

      <Chandelier
        x={land ? w * 0.5 : w * 0.5}
        y={land ? h * 0.06 : h * 0.045}
        r={(land ? 70 : 54) * k}
        k={k}
        still={still}
      />

      {/* The flagstone floor, a red carpet down the middle and colored light from the window. */}
      <LinearGradient
        colors={['#3a3234', '#2a2426', '#141012']}
        style={{ position: 'absolute', left: 0, right: 0, top: floorY, bottom: 0 }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: floorY - 6 * k,
          height: 8 * k,
          backgroundColor: '#4a4043',
          borderTopWidth: 2 * k,
          borderColor: '#6e6264',
        }}
      />
      {Array.from({ length: 6 }, (_, i) => {
        const t = (i + 1) / 6;
        const y = floorY + (h - floorY) * t * t;
        return (
          <Line
            key={`fl${i}`}
            x1={0}
            y1={y}
            x2={w}
            y2={y}
            color="rgba(0,0,0,0.45)"
            width={Math.max(1, 1.5 * k)}
          />
        );
      })}
      {Array.from({ length: 17 }, (_, i) => {
        const j = i - 8;
        return (
          <Line
            key={`fv${i}`}
            x1={w / 2 + j * w * 0.08}
            y1={floorY}
            x2={w / 2 + j * w * 0.2}
            y2={h}
            color="rgba(0,0,0,0.4)"
            width={Math.max(1, 1.5 * k)}
          />
        );
      })}
      {[
        ['rgba(155, 29, 42, 0.18)', -0.5],
        ['rgba(31, 79, 160, 0.18)', 0],
        ['rgba(201, 150, 46, 0.16)', 0.5],
      ].map(([c, dx], i) => (
        <View
          key={`pool${i}`}
          style={{
            position: 'absolute',
            left: w / 2 - ww * 0.55 + (dx as number) * ww * 0.9 + (h - floorY) * 0.25,
            top: floorY + (h - floorY) * 0.35,
            width: ww * 1.1,
            height: (h - floorY) * 0.4,
            borderRadius: ww,
            backgroundColor: c as string,
            boxShadow: `0 0 ${20 * k}px ${10 * k}px ${c as string}`,
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: w / 2 - w * 0.15,
          top: floorY,
          width: w * 0.3,
          height: 0,
          borderBottomWidth: h - floorY,
          borderLeftWidth: w * 0.06,
          borderRightWidth: w * 0.06,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: '#6a1426',
        }}
      />
      <Line
        x1={w / 2 - w * 0.09 + 5 * k}
        y1={floorY}
        x2={w / 2 - w * 0.15 + 9 * k}
        y2={h}
        color="#c79a3c"
        width={2 * k}
      />
      <Line
        x1={w / 2 + w * 0.09 - 5 * k}
        y1={floorY}
        x2={w / 2 + w * 0.15 - 9 * k}
        y2={h}
        color="#c79a3c"
        width={2 * k}
      />
      <LinearGradient
        colors={['rgba(10,6,8,0.5)', 'rgba(10,6,8,0)']}
        style={{ position: 'absolute', left: 0, right: 0, top: floorY, height: (h - floorY) * 0.5 }}
      />
    </>
  );
}
