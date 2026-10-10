// Inside a mountain chalet at night: log walls, a big window on the snowy peaks with snow falling,
// and a stone fireplace with a crackling fire.
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type DecorProps, Drift, Flame, Glow, Line, Loop, Tri, random, tiny } from './kit';

/** Rows of round logs stacked into a wall, with chinking between them and a few knots. */
function Logs({ w, h, k }: DecorProps) {
  const row = 32 * k;
  const rand = random(71);
  return (
    <>
      {Array.from({ length: Math.ceil(h / row) }, (_, r) => (
        <View key={r} style={{ position: 'absolute', left: 0, right: 0, top: r * row, height: row }}>
          <LinearGradient
            colors={r % 2 ? ['#7a4e2a', '#5e3a1e', '#3a2210'] : ['#86562e', '#664020', '#3e2412']}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 1.5 * k,
              bottom: 1.5 * k,
              borderRadius: row / 2,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: row * 0.28,
              height: Math.max(1, k),
              backgroundColor: 'rgba(255, 210, 160, 0.12)',
            }}
          />
          {Array.from({ length: Math.ceil(w / (220 * k)) }, (_, i) => {
            const x = rand() * w;
            const s = (5 + rand() * 6) * k;
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: x,
                  top: row / 2 - s / 3,
                  width: s * 1.6,
                  height: s * 0.7,
                  borderRadius: s,
                  backgroundColor: 'rgba(40, 20, 8, 0.55)',
                  borderWidth: Math.max(1, 0.8 * k),
                  borderColor: 'rgba(120, 80, 40, 0.5)',
                }}
              />
            );
          })}
          {/* Long cracks in the wood. */}
          <View
            style={{
              position: 'absolute',
              left: rand() * w,
              top: row * (0.45 + rand() * 0.2),
              width: (40 + rand() * 80) * k,
              height: Math.max(1, 0.8 * k),
              backgroundColor: 'rgba(30, 14, 4, 0.45)',
            }}
          />
        </View>
      ))}
    </>
  );
}

/** A snowy night outside: peaks, pine trees, a distant lit chalet and snow falling. */
function Outside({ ww, wh, k, still }: { ww: number; wh: number; k: number; still: boolean }) {
  const rand = random(83);
  const flakes = Array.from({ length: Math.round(Math.min(90, (ww * wh) / (900 * k * k))) }, () => ({
    x: rand() * ww,
    y: rand() * wh,
    s: (1.5 + rand() * 2.5) * k,
    o: 0.5 + rand() * 0.5,
  }));
  const far = Array.from({ length: Math.round(Math.min(70, (ww * wh) / (1300 * k * k))) }, () => ({
    x: rand() * ww,
    y: rand() * wh,
    s: (1 + rand() * 1.2) * k,
  }));
  const pines = Array.from({ length: Math.ceil(ww / (26 * k)) }, (_, i) => ({
    x: i * 26 * k + rand() * 12 * k,
    s: 0.7 + rand() * 0.6,
  }));
  return (
    <>
      <LinearGradient colors={['#0a1430', '#1c2c56', '#3a4a7a']} style={StyleSheet.absoluteFill} />
      {Array.from({ length: 24 }, (_, i) => (
        <View
          key={`s${i}`}
          style={{
            position: 'absolute',
            left: rand() * ww,
            top: rand() * wh * 0.4,
            width: 1.5 * k,
            height: 1.5 * k,
            borderRadius: k,
            backgroundColor: `rgba(255,255,255,${0.3 + rand() * 0.5})`,
          }}
        />
      ))}
      <Glow x={ww * 0.78} y={wh * 0.16} size={wh * 0.1} color="rgba(220, 230, 255, 0.25)" />
      <View
        style={{
          position: 'absolute',
          left: ww * 0.78 - wh * 0.055,
          top: wh * 0.16 - wh * 0.055,
          width: wh * 0.11,
          height: wh * 0.11,
          borderRadius: wh,
          backgroundColor: '#f2f4ff',
        }}
      />
      {/* Far and near peaks with snow caps. */}
      {[
        [0.2, 0.62, 0.7, 0.42, '#34416a', '#a8b4d0'],
        [0.62, 0.62, 0.9, 0.5, '#2c3860', '#9aa8c8'],
        [0.95, 0.62, 0.6, 0.34, '#323e66', '#a8b4d0'],
        [0.38, 0.75, 0.8, 0.36, '#222c52', '#8a98bc'],
        [0.85, 0.78, 0.7, 0.3, '#1e284c', '#8a98bc'],
      ].map(([px, base, pw, ph, c, cap], i) => (
        <View key={`m${i}`}>
          <Tri
            x={ww * (px as number)}
            y={wh * (base as number)}
            width={ww * (pw as number)}
            height={wh * (ph as number)}
            color={c as string}
          />
          <Tri
            x={ww * (px as number)}
            y={wh * ((base as number) - (ph as number) * 0.62)}
            width={ww * (pw as number) * 0.38}
            height={wh * (ph as number) * 0.38}
            color={cap as string}
          />
        </View>
      ))}
      {/* Snowy ground and a far chalet with its windows lit. */}
      <LinearGradient
        colors={['#6a7aa0', '#9aa8c8']}
        style={{ position: 'absolute', left: 0, right: 0, top: wh * 0.74, bottom: 0 }}
      />
      <View
        style={{
          position: 'absolute',
          left: ww * 0.16,
          top: wh * 0.72,
          width: 26 * k,
          height: 14 * k,
          backgroundColor: '#3a2a22',
        }}
      >
        {[4, 15].map((x) => (
          <Loop
            key={x}
            motion="twinkle"
            duration={5000 + x * 100}
            still={still}
            style={{ position: 'absolute', left: x * k, top: 4 * k }}
          >
            <View
              style={{
                width: 6 * k,
                height: 5 * k,
                backgroundColor: '#ffc870',
                boxShadow: `0 0 ${6 * k}px #ffb347`,
              }}
            />
          </Loop>
        ))}
      </View>
      <Tri x={ww * 0.16 + 13 * k} y={wh * 0.72} width={36 * k} height={13 * k} color="#eef2fa" />
      <View
        style={{
          position: 'absolute',
          left: ww * 0.16 + 18 * k,
          top: wh * 0.72 - 16 * k,
          width: 4 * k,
          height: 8 * k,
          backgroundColor: '#3a2a22',
        }}
      />
      {pines.map((p, i) => {
        const base = wh * (0.8 + (i % 3) * 0.04);
        const s = p.s * k;
        return (
          <View key={`p${i}`}>
            {[0, 1, 2].map((t) => (
              <View key={t}>
                <Tri
                  x={p.x}
                  y={base - t * 11 * s}
                  width={(26 - t * 7) * s}
                  height={(18 - t * 3) * s}
                  color="#16302a"
                />
                <Tri
                  x={p.x}
                  y={base - t * 11 * s - (13 - t * 2) * s}
                  width={(12 - t * 3) * s}
                  height={(5 - t) * s}
                  color="#b8c4de"
                />
              </View>
            ))}
          </View>
        );
      })}
      {/* Falling snow: big flakes near the glass, small ones further away. */}
      <Drift width={ww} height={wh} duration={22000} still={still}>
        {far.map((f, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: f.x,
              top: f.y,
              width: f.s,
              height: f.s,
              borderRadius: f.s,
              backgroundColor: 'rgba(255,255,255,0.6)',
            }}
          />
        ))}
      </Drift>
      <Drift width={ww} height={wh} duration={11000} still={still}>
        {flakes.map((f, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: f.x,
              top: f.y,
              width: f.s,
              height: f.s,
              borderRadius: f.s,
              backgroundColor: `rgba(255,255,255,${f.o})`,
            }}
          />
        ))}
      </Drift>
      {/* Snow piled on the sill and frost in the corners of the glass. */}
      <View
        style={{
          position: 'absolute',
          left: -10 * k,
          right: -10 * k,
          bottom: -8 * k,
          height: 20 * k,
          borderRadius: 14 * k,
          backgroundColor: '#c8d2ea',
        }}
      />
      <LinearGradient
        colors={['rgba(230, 240, 255, 0)', 'rgba(230, 240, 255, 0.15)']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: wh * 0.3 }}
      />
      {/* The fire's reflection in the glass. */}
      <View
        style={{
          position: 'absolute',
          left: ww * 0.1,
          top: wh * 0.12,
          width: ww * 0.08,
          height: wh * 0.6,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          transform: [{ skewX: '-18deg' }],
        }}
      />
    </>
  );
}

/** The big window: a wooden frame with mullions, a red plaid curtain on each side. */
function Window({
  x,
  top,
  ww,
  wh,
  k,
  still,
}: {
  x: number;
  top: number;
  ww: number;
  wh: number;
  k: number;
  still: boolean;
}) {
  const f = 14 * k;
  const curtain = (side: number) => (
    <View
      style={{
        position: 'absolute',
        left: side < 0 ? x - ww / 2 - f - 30 * k : x + ww / 2 + f - 34 * k,
        top: top - f - 14 * k,
        width: 64 * k,
        height: wh + f * 2 + 50 * k,
        overflow: 'hidden',
        borderBottomLeftRadius: side < 0 ? 4 * k : 30 * k,
        borderBottomRightRadius: side < 0 ? 30 * k : 4 * k,
      }}
    >
      <LinearGradient
        colors={['#5a1414', '#9a2a22', '#7a1c18', '#a8322a', '#5a1414']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {Array.from({ length: Math.ceil((wh + 80 * k) / (22 * k)) }, (_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: i * 22 * k,
            height: 4 * k,
            backgroundColor: i % 3 ? 'rgba(20, 30, 20, 0.35)' : 'rgba(240, 200, 120, 0.25)',
          }}
        />
      ))}
      {[0.3, 0.7].map((p) => (
        <View
          key={p}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 64 * k * p,
            width: 3 * k,
            backgroundColor: 'rgba(20, 30, 20, 0.3)',
          }}
        />
      ))}
      {/* The tie-back. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: (wh + 80 * k) * 0.62,
          height: 8 * k,
          backgroundColor: '#d8a85a',
          borderTopWidth: Math.max(1, k),
          borderColor: '#f2d08a',
        }}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.3)']}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: x - ww / 2 - f,
          top: top - f,
          width: ww + f * 2,
          height: wh + f * 2,
          borderRadius: 4 * k,
          backgroundColor: '#4a2e18',
          borderWidth: 2 * k,
          borderColor: '#8a5a32',
          boxShadow: `0 ${6 * k}px ${16 * k}px rgba(0,0,0,0.55)`,
        }}
      />
      <View
        style={{ position: 'absolute', left: x - ww / 2, top, width: ww, height: wh, overflow: 'hidden' }}
      >
        <Outside ww={ww} wh={wh} k={k} still={still} />
        {/* Mullions. */}
        {[1 / 3, 2 / 3].map((p) => (
          <View
            key={p}
            style={{
              position: 'absolute',
              left: ww * p - 4 * k,
              top: 0,
              bottom: 0,
              width: 8 * k,
              backgroundColor: '#5a3a1e',
              borderLeftWidth: Math.max(1, k),
              borderColor: '#9a6a3a',
            }}
          />
        ))}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: wh * 0.42 - 4 * k,
            height: 8 * k,
            backgroundColor: '#5a3a1e',
            borderTopWidth: Math.max(1, k),
            borderColor: '#9a6a3a',
          }}
        />
      </View>
      {/* The sill inside. */}
      <View
        style={{
          position: 'absolute',
          left: x - ww / 2 - f * 1.8,
          top: top + wh + f * 0.4,
          width: ww + f * 3.6,
          height: 12 * k,
          borderRadius: 3 * k,
          backgroundColor: '#9a6a3a',
          borderBottomWidth: 4 * k,
          borderColor: '#4a2e18',
        }}
      />
      {curtain(-1)}
      {curtain(1)}
      <View
        style={{
          position: 'absolute',
          left: x - ww / 2 - f - 44 * k,
          top: top - f - 22 * k,
          width: ww + f * 2 + 88 * k,
          height: 9 * k,
          borderRadius: 5 * k,
          backgroundColor: '#2a1a10',
          borderTopWidth: Math.max(1, k),
          borderColor: '#6a4a2a',
        }}
      />
    </>
  );
}

/** A stone fireplace with logs burning, a mantel with candles and a mug, and antlers above. */
function Fireplace({
  x,
  bottom,
  fw,
  fh,
  k,
  still,
  ceiling,
}: {
  x: number;
  bottom: number;
  fw: number;
  fh: number;
  k: number;
  still: boolean;
  ceiling: number;
}) {
  const rand = random(97);
  const openW = fw * 0.62;
  const openH = fh * 0.6;
  const stones: { x: number; y: number; w: number; h: number; c: string }[] = [];
  const row = 22 * k;
  const chimneyW = fw * 0.72;
  for (let y = ceiling; y < bottom; y += row) {
    const inChimney = y < bottom - fh;
    const left = inChimney ? x - chimneyW / 2 : x - fw / 2;
    const right = inChimney ? x + chimneyW / 2 : x + fw / 2;
    let sx = left - rand() * 20 * k;
    while (sx < right) {
      const sw = (26 + rand() * 30) * k;
      stones.push({
        x: Math.max(left, sx),
        y,
        w: Math.min(right, sx + sw) - Math.max(left, sx),
        h: row,
        c: ['#4e4642', '#443d3a', '#58504a', '#4a4240', '#3e3836'][(rand() * 5) | 0],
      });
      sx += sw;
    }
  }
  const sparks = Array.from({ length: 12 }, () => ({
    x: openW * 0.3 + rand() * openW * 0.4,
    y: rand() * openH,
    s: (1.5 + rand() * 2) * k,
  }));
  const mantelY = bottom - fh - 2 * k;
  return (
    <>
      {stones.map((s, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: s.x + k,
            top: s.y + k,
            width: Math.max(0, s.w - 2 * k),
            height: s.h - 2 * k,
            borderRadius: 6 * k,
            backgroundColor: s.c,
            borderTopWidth: Math.max(1, k),
            borderColor: 'rgba(255, 220, 180, 0.12)',
          }}
        />
      ))}
      <LinearGradient
        colors={['rgba(10,5,2,0.55)', 'rgba(10,5,2,0)']}
        style={{
          position: 'absolute',
          left: x - chimneyW / 2,
          top: ceiling,
          width: chimneyW,
          height: bottom - fh - ceiling,
        }}
      />
      {/* Warm light on the stones from the fire. */}
      <LinearGradient
        colors={['rgba(255, 140, 50, 0)', 'rgba(255, 140, 50, 0.18)']}
        style={{ position: 'absolute', left: x - fw / 2, top: bottom - fh, width: fw, height: fh }}
      />
      {/* The hearth opening. */}
      <View
        style={{
          position: 'absolute',
          left: x - openW / 2,
          top: bottom - openH,
          width: openW,
          height: openH,
          borderTopLeftRadius: openW * 0.3,
          borderTopRightRadius: openW * 0.3,
          overflow: 'hidden',
          backgroundColor: '#140a06',
          borderWidth: 3 * k,
          borderBottomWidth: 0,
          borderColor: '#3a322e',
        }}
      >
        <LinearGradient colors={['#0a0503', '#2a1208', '#6a2a0a']} style={StyleSheet.absoluteFill} />
        {/* Andirons and logs. */}
        <View
          style={{
            position: 'absolute',
            left: openW * 0.15,
            right: openW * 0.15,
            bottom: 8 * k,
            height: 12 * k,
            borderRadius: 6 * k,
            backgroundColor: '#4a2a14',
            borderTopWidth: 2 * k,
            borderColor: '#7a4a24',
            transform: [{ rotate: '-6deg' }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: openW * 0.2,
            right: openW * 0.12,
            bottom: 4 * k,
            height: 12 * k,
            borderRadius: 6 * k,
            backgroundColor: '#5a3418',
            borderTopWidth: 2 * k,
            borderColor: '#ff7a2a',
            transform: [{ rotate: '7deg' }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: openW * 0.1,
            right: openW * 0.1,
            bottom: 0,
            height: 7 * k,
            borderRadius: 4 * k,
            backgroundColor: '#ff6a1a',
            boxShadow: `0 0 ${12 * k}px ${4 * k}px rgba(255, 110, 30, 0.7)`,
          }}
        />
        <Loop motion="flicker" duration={900} still={still} style={StyleSheet.absoluteFill}>
          {[
            [0.3, 0.55, 'rgba(220, 70, 20, 0.95)', 2.0],
            [0.5, 0.75, 'rgba(230, 80, 20, 0.95)', 2.2],
            [0.68, 0.5, 'rgba(220, 70, 20, 0.95)', 1.9],
            [0.4, 0.5, '#ff9a2e', 1.8],
            [0.58, 0.55, '#ff9a2e', 2.0],
            [0.49, 0.32, '#ffd36a', 1.8],
            [0.5, 0.16, '#fff4c8', 1.6],
          ].map(([px, s, c, st], i) => (
            <Flame
              key={i}
              x={openW * (px as number)}
              y={openH - 8 * k}
              size={openW * 0.22 * (s as number)}
              color={c as string}
              stretch={st as number}
            />
          ))}
        </Loop>
        <Loop motion="flicker" duration={1300} delay={400} still={still} style={StyleSheet.absoluteFill}>
          {[
            [0.38, 0.4, '#ffb347'],
            [0.62, 0.36, '#ffb347'],
          ].map(([px, s, c], i) => (
            <Flame
              key={i}
              x={openW * (px as number)}
              y={openH - 10 * k}
              size={openW * 0.22 * (s as number)}
              color={c as string}
              stretch={1.9}
            />
          ))}
        </Loop>
        <Drift width={openW} height={openH} up duration={3600} still={still}>
          {sparks.map((s, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: s.x,
                top: s.y,
                width: s.s,
                height: s.s,
                borderRadius: s.s,
                backgroundColor: i % 2 ? '#ffd36a' : '#ff8a3a',
              }}
            />
          ))}
        </Drift>
      </View>
      {/* The hearthstone. */}
      <View
        style={{
          position: 'absolute',
          left: x - fw / 2 - 14 * k,
          top: bottom - 4 * k,
          width: fw + 28 * k,
          height: 12 * k,
          borderRadius: 3 * k,
          backgroundColor: '#5a524c',
          borderTopWidth: 2 * k,
          borderColor: '#8a807a',
        }}
      />
      {/* The mantel: a thick beam, with candles, a mug and a little clock. */}
      <View
        style={{
          position: 'absolute',
          left: x - fw / 2 - 18 * k,
          top: mantelY - 6 * k,
          width: fw + 36 * k,
          height: 16 * k,
          borderRadius: 3 * k,
          overflow: 'hidden',
          boxShadow: `0 ${4 * k}px ${8 * k}px rgba(0,0,0,0.5)`,
        }}
      >
        <LinearGradient colors={['#9a6a3a', '#5a3a1e']} style={StyleSheet.absoluteFill} />
      </View>
      {[-0.38, 0.38].map((p, i) => (
        <View key={p}>
          <View
            style={{
              position: 'absolute',
              left: x + fw * p - 5 * k,
              top: mantelY - 6 * k - (24 - i * 6) * k,
              width: 10 * k,
              height: (24 - i * 6) * k,
              borderRadius: 2 * k,
              backgroundColor: '#f2e6cc',
            }}
          />
          <Loop
            motion="flicker"
            duration={800 + i * 200}
            delay={i * 300}
            still={still}
            style={{
              position: 'absolute',
              left: x + fw * p - 8 * k,
              top: mantelY - 6 * k - (24 - i * 6) * k - 20 * k,
              width: 16 * k,
              height: 20 * k,
            }}
          >
            <Glow x={8 * k} y={12 * k} size={12 * k} color="rgba(255, 200, 110, 0.3)" />
            <Flame x={8 * k} y={19 * k} size={7 * k} color="#ffb347" stretch={1.8} />
            <Flame x={8 * k} y={18 * k} size={3.5 * k} color="#fff4c2" stretch={1.5} />
          </Loop>
        </View>
      ))}
      <View
        style={{
          position: 'absolute',
          left: x + fw * 0.12,
          top: mantelY - 24 * k,
          width: 18 * k,
          height: 18 * k,
          borderRadius: 3 * k,
          backgroundColor: '#c0392b',
          borderTopWidth: 3 * k,
          borderColor: '#f2e6cc',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: x + fw * 0.12 + 16 * k,
          top: mantelY - 20 * k,
          width: 8 * k,
          height: 10 * k,
          borderRadius: 4 * k,
          borderWidth: 2 * k,
          borderColor: '#c0392b',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: x - fw * 0.18 - 13 * k,
          top: mantelY - 34 * k,
          width: 26 * k,
          height: 28 * k,
          borderTopLeftRadius: 13 * k,
          borderTopRightRadius: 13 * k,
          backgroundColor: '#5a3a1e',
          alignItems: 'center',
          paddingTop: 4 * k,
        }}
      >
        <View
          style={{
            width: 16 * k,
            height: 16 * k,
            borderRadius: 8 * k,
            backgroundColor: '#f2e6cc',
            borderWidth: Math.max(1, k),
            borderColor: '#c9962e',
          }}
        />
      </View>
      {/* Antlers on a wooden plaque above the mantel. */}
      {(() => {
        const ay = mantelY - fh * 0.42;
        return (
          <>
            {[-1, 1].map((s) => (
              <View key={s}>
                <Line x1={x} y1={ay} x2={x + s * 30 * k} y2={ay - 26 * k} color="#e8dcc4" width={4 * k} />
                <Line
                  x1={x + s * 30 * k}
                  y1={ay - 26 * k}
                  x2={x + s * 38 * k}
                  y2={ay - 52 * k}
                  color="#e8dcc4"
                  width={3.5 * k}
                />
                <Line
                  x1={x + s * 16 * k}
                  y1={ay - 13 * k}
                  x2={x + s * 12 * k}
                  y2={ay - 32 * k}
                  color="#e8dcc4"
                  width={3 * k}
                />
                <Line
                  x1={x + s * 30 * k}
                  y1={ay - 26 * k}
                  x2={x + s * 48 * k}
                  y2={ay - 34 * k}
                  color="#e8dcc4"
                  width={3 * k}
                />
                <Line
                  x1={x + s * 35 * k}
                  y1={ay - 40 * k}
                  x2={x + s * 24 * k}
                  y2={ay - 54 * k}
                  color="#e8dcc4"
                  width={2.5 * k}
                />
              </View>
            ))}
            <View
              style={{
                position: 'absolute',
                left: x - 14 * k,
                top: ay - 6 * k,
                width: 28 * k,
                height: 30 * k,
                borderRadius: 14 * k,
                backgroundColor: '#5a3a1e',
                borderWidth: 2 * k,
                borderColor: '#8a5a32',
              }}
            />
          </>
        );
      })()}
    </>
  );
}

/** A stack of split firewood: round ends of logs piled up. */
function Woodpile({ x, bottom, k }: { x: number; bottom: number; k: number }) {
  const r = 11 * k;
  const rows = [5, 4, 3];
  return (
    <>
      {rows.map((n, ri) =>
        Array.from({ length: n }, (_, i) => (
          <View
            key={`${ri}-${i}`}
            style={{
              position: 'absolute',
              left: x + (i + ri * 0.5) * r * 2,
              top: bottom - (ri + 1) * r * 1.8,
              width: r * 2,
              height: r * 2,
              borderRadius: r,
              backgroundColor: '#c8a070',
              borderWidth: 3 * k,
              borderColor: '#5a3a1e',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: r * 0.9,
                height: r * 0.9,
                borderRadius: r,
                borderWidth: Math.max(1, k),
                borderColor: 'rgba(120, 80, 40, 0.6)',
              }}
            />
          </View>
        )),
      )}
    </>
  );
}

/** Two skis and poles leaning against the wall. */
function Skis({ x, bottom, k }: { x: number; bottom: number; k: number }) {
  return (
    <>
      {[0, 14].map((dx, i) => (
        <View
          key={dx}
          style={{
            position: 'absolute',
            left: x + dx * k,
            top: bottom - 200 * k,
            width: 10 * k,
            height: 200 * k,
            borderTopLeftRadius: 10 * k,
            borderTopRightRadius: 10 * k,
            backgroundColor: i ? '#c0392b' : '#a8302a',
            borderLeftWidth: 2 * k,
            borderColor: '#f2e6cc',
            transform: [{ rotate: `${4 + i * 2}deg` }],
          }}
        />
      ))}
      <Line x1={x + 34 * k} y1={bottom} x2={x + 26 * k} y2={bottom - 170 * k} color="#2a2a30" width={3 * k} />
      <View
        style={{
          position: 'absolute',
          left: x + 25 * k,
          top: bottom - 20 * k,
          width: 16 * k,
          height: 4 * k,
          borderRadius: 2 * k,
          backgroundColor: '#2a2a30',
        }}
      />
    </>
  );
}

export function Chalet({ w, h, k }: DecorProps) {
  const still = tiny(w);
  const land = w > h * 1.1;
  const floorY = h * (land ? 0.82 : 0.86);
  const beam = 26 * k;
  const ww = land ? w * 0.3 : w * 0.66;
  const wh = land ? h * 0.42 : h * 0.3;
  const winX = land ? w * 0.32 : w * 0.5;
  const winTop = h * (land ? 0.12 : 0.09);
  const fireX = land ? w * 0.77 : w * 0.5;
  const fw = land ? 230 * k : w * 0.62;
  const fh = land ? h * 0.36 : h * 0.17;

  return (
    <>
      <Logs w={w} h={floorY} k={k} />
      {/* Darker in the corners, warmer near the fire. */}
      <LinearGradient
        colors={['rgba(10,5,2,0.75)', 'rgba(10,5,2,0)', 'rgba(10,5,2,0)', 'rgba(10,5,2,0.75)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: floorY }}
      />
      <LinearGradient
        colors={['rgba(10,5,2,0.7)', 'rgba(10,5,2,0.2)', 'rgba(10,5,2,0.3)']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: floorY }}
      />
      <Loop
        motion="flicker"
        duration={2800}
        still={still}
        style={{
          position: 'absolute',
          left: fireX - fw * 1.5,
          top: floorY - fw * 1.5,
          width: fw * 3,
          height: fw * 3,
        }}
      >
        <Glow x={fw * 1.5} y={fw * 1.5} size={fw * 1.1} color="rgba(255, 130, 50, 0.13)" />
      </Loop>

      {/* Ceiling beams. */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: beam, overflow: 'hidden' }}>
        <LinearGradient colors={['#1e120a', '#4a2e18', '#2a1a0e']} style={StyleSheet.absoluteFill} />
      </View>
      {Array.from({ length: Math.ceil(w / (150 * k)) + 1 }, (_, i) => (
        <View
          key={`b${i}`}
          style={{
            position: 'absolute',
            left: i * 150 * k - 10 * k,
            top: beam - 2 * k,
            width: 20 * k,
            height: 14 * k,
            borderBottomLeftRadius: 4 * k,
            borderBottomRightRadius: 4 * k,
            backgroundColor: '#2a1a0e',
          }}
        />
      ))}

      <Window x={winX} top={winTop} ww={ww} wh={wh} k={k} still={still} />
      <Fireplace
        x={fireX}
        bottom={floorY + 2 * k}
        fw={fw}
        fh={fh}
        k={k}
        still={still}
        ceiling={land ? beam : floorY - fh * 1.25}
      />
      {land && <Woodpile x={fireX + fw / 2 + 30 * k} bottom={floorY + 4 * k} k={k} />}
      {land && <Skis x={w * 0.06} bottom={floorY + 4 * k} k={k} />}

      {/* The plank floor and a round braided rug in front of the fire. */}
      <LinearGradient
        colors={['#5a3a1e', '#3a2412', '#1e1208']}
        style={{ position: 'absolute', left: 0, right: 0, top: floorY + 6 * k, bottom: 0 }}
      />
      {Array.from({ length: 21 }, (_, i) => {
        const j = i - 10;
        return (
          <Line
            key={`fl${i}`}
            x1={w / 2 + j * w * 0.07}
            y1={floorY + 6 * k}
            x2={w / 2 + j * w * 0.16}
            y2={h}
            color="rgba(20, 10, 4, 0.5)"
            width={Math.max(1, 1.5 * k)}
          />
        );
      })}
      {['#7a1c18', '#d8b878', '#2a5a3a', '#a8302a', '#e8d8b0', '#7a1c18'].map((c, i) => {
        const rw = (land ? 300 : w * 0.9) * (1 - i * 0.14);
        const rh = (h - floorY) * 0.7 * (1 - i * 0.14);
        return (
          <View
            key={`rug${i}`}
            style={{
              position: 'absolute',
              left: fireX - rw / 2,
              top: floorY + 14 * k + (h - floorY) * 0.12 + ((h - floorY) * 0.7 - rh) / 2,
              width: rw,
              height: rh,
              borderRadius: rw,
              backgroundColor: c,
              borderWidth: Math.max(1, k),
              borderColor: 'rgba(0,0,0,0.25)',
            }}
          />
        );
      })}
      <LinearGradient
        colors={['rgba(10,5,2,0.4)', 'rgba(10,5,2,0)', 'rgba(10,5,2,0.5)']}
        style={{ position: 'absolute', left: 0, right: 0, top: floorY + 6 * k, bottom: 0 }}
      />
    </>
  );
}
