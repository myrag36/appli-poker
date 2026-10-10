// A pirate ship's deck at night: moon on the sea, rigging, swaying lanterns and a treasure chest.
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type DecorProps, Cross, Glow, Hanging, Line, Loop, Tri, random, tiny } from './kit';

function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  const puffs = [
    [0, 10, 70, 18],
    [12, 2, 34, 20],
    [34, -4, 28, 22],
    [52, 4, 30, 16],
  ];
  return (
    <>
      {puffs.map(([px, py, pw, ph], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: x + px * s,
            top: y + py * s,
            width: pw * s,
            height: ph * s,
            borderRadius: ph * s,
            backgroundColor: 'rgba(28, 46, 78, 0.92)',
            borderTopWidth: Math.max(1, 1.5 * s),
            borderColor: 'rgba(200, 215, 240, 0.35)',
          }}
        />
      ))}
    </>
  );
}

function Lantern({ k, still, delay }: { k: number; still: boolean; delay: number }) {
  const lw = 24 * k;
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: lw * 3, height: 60 * k, alignItems: 'center' }}>
      <Loop
        motion="flicker"
        duration={1700}
        delay={delay}
        still={still}
        style={{ position: 'absolute', left: lw * 1.5 - 60 * k, top: 30 * k - 60 * k, width: 120 * k, height: 120 * k }}
      >
        <Glow x={60 * k} y={60 * k} size={70 * k} color="rgba(255, 168, 70, 0.28)" />
      </Loop>
      <View style={{ width: 2 * k, height: 8 * k, backgroundColor: '#2a1b0e' }} />
      <View
        style={{
          width: 10 * k,
          height: 6 * k,
          borderRadius: 5 * k,
          borderWidth: 1.5 * k,
          borderColor: '#1b130b',
          marginBottom: -1 * k,
        }}
      />
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: lw / 2 + 3 * k,
          borderRightWidth: lw / 2 + 3 * k,
          borderBottomWidth: 9 * k,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: '#24170c',
        }}
      />
      <View style={{ width: lw, height: 26 * k, overflow: 'hidden', borderWidth: 1.5 * k, borderColor: '#24170c' }}>
        <LinearGradient colors={['#fff4c2', '#ffbf5a', '#e07b22']} style={StyleSheet.absoluteFill} />
        <Loop motion="flicker" duration={900} delay={delay} still={still} style={StyleSheet.absoluteFill}>
          <View
            style={{
              position: 'absolute',
              left: lw / 2 - 3.5 * k,
              top: 9 * k,
              width: 6 * k,
              height: 10 * k,
              borderRadius: 4 * k,
              backgroundColor: '#ffffff',
              boxShadow: `0 0 ${8 * k}px ${4 * k}px rgba(255, 240, 190, 0.9)`,
            }}
          />
        </Loop>
        {[0.33, 0.66].map((x) => (
          <View
            key={x}
            style={{ position: 'absolute', left: lw * x - k, top: 0, bottom: 0, width: 1.5 * k, backgroundColor: '#3a2614' }}
          />
        ))}
      </View>
      <View style={{ width: lw + 6 * k, height: 5 * k, backgroundColor: '#24170c', borderRadius: 2 * k }} />
      <View style={{ width: 8 * k, height: 3 * k, backgroundColor: '#24170c', borderRadius: 2 * k }} />
    </View>
  );
}

function Chest({ x, bottom, k, still }: { x: number; bottom: number; k: number; still: boolean }) {
  const cw = 104 * k;
  const ch = 52 * k;
  const top = bottom - ch;
  const rand = random(5);
  const coins = Array.from({ length: 26 }, (_, i) => {
    const t = i / 25;
    const a = Math.PI * (0.08 + 0.84 * rand());
    const r = rand();
    return {
      cx: x + cw / 2 - Math.cos(a) * cw * 0.46 * (0.4 + 0.6 * r),
      cy: top - Math.sin(a) * 24 * k * (1 - r * 0.6) + 2 * k,
      s: (9 + rand() * 4) * k,
      t,
    };
  });
  return (
    <>
      <Glow x={x + cw / 2} y={top} size={70 * k} color="rgba(255, 200, 80, 0.18)" />
      <View style={{ position: 'absolute', left: x - 8 * k, top: bottom - 6 * k, width: cw + 16 * k, height: 12 * k, borderRadius: cw, backgroundColor: 'rgba(0,0,0,0.45)' }} />
      {/* The open lid, seen from the inside. */}
      <View
        style={{
          position: 'absolute',
          left: x + 3 * k,
          top: top - 40 * k,
          width: cw - 6 * k,
          height: 44 * k,
          borderTopLeftRadius: 30 * k,
          borderTopRightRadius: 30 * k,
          overflow: 'hidden',
          borderWidth: 3 * k,
          borderColor: '#c9962e',
        }}
      >
        <LinearGradient colors={['#5a1a1a', '#3a0f10']} style={StyleSheet.absoluteFill} />
        {[0.3, 0.7].map((p) => (
          <View key={p} style={{ position: 'absolute', left: (cw - 6 * k) * p - 3 * k, top: 0, bottom: 0, width: 6 * k, backgroundColor: 'rgba(0,0,0,0.25)' }} />
        ))}
      </View>
      {coins.map((c, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: c.cx - c.s / 2,
            top: c.cy - c.s / 2,
            width: c.s,
            height: c.s,
            borderRadius: c.s / 2,
            backgroundColor: i % 3 ? '#f2c14e' : '#ffd970',
            borderWidth: Math.max(1, k),
            borderColor: '#a8740f',
          }}
        />
      ))}
      {[
        [0.22, -14, '#e63946', 0],
        [0.5, -24, '#2ec4b6', 1],
        [0.72, -12, '#7b2cbf', 2],
        [0.38, -6, '#3a86ff', 3],
      ].map(([px, py, color, i]) => (
        <View
          key={i as number}
          style={{
            position: 'absolute',
            left: x + cw * (px as number) - 6 * k,
            top: top + (py as number) * k,
            width: 12 * k,
            height: 12 * k,
            backgroundColor: color as string,
            borderWidth: Math.max(1, k),
            borderColor: 'rgba(255,255,255,0.6)',
            transform: [{ rotate: '45deg' }],
            boxShadow: `0 0 ${6 * k}px ${color as string}`,
          }}
        />
      ))}
      {/* The chest itself. */}
      <View style={{ position: 'absolute', left: x, top, width: cw, height: ch, borderRadius: 4 * k, overflow: 'hidden', borderWidth: 1.5 * k, borderColor: '#1f1208' }}>
        <LinearGradient colors={['#8a5a2e', '#5e3a1a', '#3a220e']} style={StyleSheet.absoluteFill} />
        {[0.33, 0.66].map((p) => (
          <View key={p} style={{ position: 'absolute', left: 0, right: 0, top: ch * p, height: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} />
        ))}
        {[0.08, 0.92].map((p) => (
          <View key={p} style={{ position: 'absolute', left: cw * p - 5 * k, top: 0, bottom: 0, width: 10 * k, backgroundColor: '#3b3b44', borderLeftWidth: 1, borderColor: '#8e8e9a' }}>
            {[0.25, 0.75].map((r) => (
              <View key={r} style={{ position: 'absolute', left: 3 * k, top: ch * r, width: 3 * k, height: 3 * k, borderRadius: 2 * k, backgroundColor: '#c9c9d4' }} />
            ))}
          </View>
        ))}
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 6 * k, backgroundColor: '#c9962e' }} />
        <View style={{ position: 'absolute', left: cw / 2 - 9 * k, top: 4 * k, width: 18 * k, height: 20 * k, borderRadius: 3 * k, backgroundColor: '#e0b34a', borderWidth: 1, borderColor: '#7a5410', alignItems: 'center', paddingTop: 6 * k }}>
          <View style={{ width: 4 * k, height: 8 * k, borderRadius: 2 * k, backgroundColor: '#3a2606' }} />
        </View>
      </View>
      {/* A string of pearls hanging over the front. */}
      {Array.from({ length: 11 }, (_, i) => {
        const t = i / 10;
        return (
          <View
            key={`p${i}`}
            style={{
              position: 'absolute',
              left: x + cw * (0.55 + t * 0.32) - 2.5 * k,
              top: top + Math.sin(t * Math.PI) * 16 * k,
              width: 5 * k,
              height: 5 * k,
              borderRadius: 3 * k,
              backgroundColor: '#f6f1e7',
            }}
          />
        );
      })}
      {/* Coins spilled on the deck. */}
      {[-18, -6, 112, 124, 98].map((dx, i) => (
        <View
          key={`s${i}`}
          style={{
            position: 'absolute',
            left: x + dx * k,
            top: bottom - (4 + (i % 2) * 4) * k,
            width: 11 * k,
            height: 5 * k,
            borderRadius: 6 * k,
            backgroundColor: '#f2c14e',
            borderWidth: Math.max(1, 0.8 * k),
            borderColor: '#a8740f',
          }}
        />
      ))}
      {[
        [0.15, -30],
        [0.62, -38],
        [0.9, -20],
      ].map(([px, py], i) => (
        <Loop
          key={`g${i}`}
          motion="twinkle"
          duration={2200}
          delay={i * 700}
          still={still}
          style={{ position: 'absolute', left: x + cw * px - 6 * k, top: top + py * k - 8 * k }}
        >
          <Text style={{ fontSize: 13 * k, color: '#fff3c4', textShadowColor: '#ffd166', textShadowRadius: 6 * k }}>✦</Text>
        </Loop>
      ))}
    </>
  );
}

function Barrel({ x, bottom, k }: { x: number; bottom: number; k: number }) {
  const bw = 62 * k;
  const bh = 84 * k;
  return (
    <>
      <View style={{ position: 'absolute', left: x - 6 * k, top: bottom - 6 * k, width: bw + 12 * k, height: 12 * k, borderRadius: bw, backgroundColor: 'rgba(0,0,0,0.45)' }} />
      <View style={{ position: 'absolute', left: x, top: bottom - bh, width: bw, height: bh, borderRadius: 16 * k, overflow: 'hidden', borderWidth: 1.5 * k, borderColor: '#1c1007' }}>
        <LinearGradient colors={['#3a2210', '#7a4c26', '#9a6638', '#6a4020', '#2a180a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        {[0.2, 0.4, 0.6, 0.8].map((p) => (
          <View key={p} style={{ position: 'absolute', left: bw * p, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} />
        ))}
        {[0.12, 0.3, 0.7, 0.88].map((p) => (
          <View key={p} style={{ position: 'absolute', left: 0, right: 0, top: bh * p - 3 * k, height: 6 * k, backgroundColor: '#2c2c33', borderTopWidth: 1, borderColor: '#7d7d88' }} />
        ))}
        <Text style={{ position: 'absolute', left: 0, right: 0, top: bh * 0.4, textAlign: 'center', fontSize: 11 * k, fontWeight: '900', color: 'rgba(20,10,4,0.6)' }}>RHUM</Text>
      </View>
      <View style={{ position: 'absolute', left: x + 3 * k, top: bottom - bh - 5 * k, width: bw - 6 * k, height: 12 * k, borderRadius: bw, backgroundColor: '#4a2c14', borderWidth: 2 * k, borderColor: '#2c2c33' }} />
    </>
  );
}

function RopeCoil({ x, y, k }: { x: number; y: number; k: number }) {
  return (
    <>
      {[44, 34, 24, 14].map((s, i) => (
        <View
          key={s}
          style={{
            position: 'absolute',
            left: x - (s * k) / 2,
            top: y - (s * k) / 5 - i * 2 * k,
            width: s * k,
            height: (s * k) / 2.5,
            borderRadius: s * k,
            borderWidth: 3.5 * k,
            borderColor: i % 2 ? '#a8875a' : '#c4a274',
          }}
        />
      ))}
    </>
  );
}

function Wheel({ x, y, r, k }: { x: number; y: number; r: number; k: number }) {
  return (
    <>
      <View style={{ position: 'absolute', left: x - 10 * k, top: y, width: 20 * k, height: r * 1.6, backgroundColor: '#3a220f' }} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        return (
          <View key={i}>
            <Line x1={x} y1={y} x2={x + Math.cos(a) * r * 1.28} y2={y + Math.sin(a) * r * 1.28} color="#5e3a1c" width={6 * k} />
            <View
              style={{
                position: 'absolute',
                left: x + Math.cos(a) * r * 1.3 - 5 * k,
                top: y + Math.sin(a) * r * 1.3 - 5 * k,
                width: 10 * k,
                height: 10 * k,
                borderRadius: 5 * k,
                backgroundColor: '#7a4c26',
                borderWidth: 1,
                borderColor: '#2a180a',
              }}
            />
          </View>
        );
      })}
      <View style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, borderWidth: 8 * k, borderColor: '#6a4220' }} />
      <View style={{ position: 'absolute', left: x - r + 3 * k, top: y - r + 3 * k, width: r * 2 - 6 * k, height: r * 2 - 6 * k, borderRadius: r, borderWidth: 1, borderColor: 'rgba(255, 200, 140, 0.35)' }} />
      <View style={{ position: 'absolute', left: x - r * 0.35, top: y - r * 0.35, width: r * 0.7, height: r * 0.7, borderRadius: r, borderWidth: 5 * k, borderColor: '#5e3a1c' }} />
      <View style={{ position: 'absolute', left: x - 9 * k, top: y - 9 * k, width: 18 * k, height: 18 * k, borderRadius: 9 * k, backgroundColor: '#d4a64a', borderWidth: 2 * k, borderColor: '#6b4a10' }} />
    </>
  );
}

export function Pirates({ w, h, k }: DecorProps) {
  const still = tiny(w);
  const land = w > h * 1.1;
  const horizon = h * (land ? 0.5 : 0.42);
  const railY = h * (land ? 0.74 : 0.7);
  const capY = railY - 66 * k;
  const moonR = Math.min(w, h) * (land ? 0.06 : 0.085);
  const moonX = w * (land ? 0.7 : 0.7);
  const moonY = horizon * 0.3;
  const mastX = w * (land ? 0.07 : 0.1);
  const rand = random(19);

  const stars = Array.from({ length: land ? 110 : 70 }, () => ({
    x: rand() * w,
    y: rand() * horizon * 0.92,
    s: (0.8 + rand() * 1.8) * k,
    o: 0.35 + rand() * 0.6,
  }));

  const waves: { x: number; y: number; s: number }[] = [];
  for (let row = 0; row < 14; row++) {
    const t = (row + 1) / 14;
    const y = horizon + (capY - horizon) * t * t;
    const s = (10 + 60 * t) * k;
    const n = Math.ceil(w / (s * 2.2)) + 1;
    for (let i = 0; i < n; i++) waves.push({ x: (i + (row % 2) * 0.5 + rand() * 0.3) * s * 2.2 - s, y, s });
  }

  const reflections = Array.from({ length: 18 }, (_, i) => {
    const t = (i + 1) / 18;
    return {
      y: horizon + 4 * k + (capY - horizon) * t,
      width: (moonR * 0.6 + moonR * 2.2 * t) * (0.5 + rand() * 0.6),
      dx: (rand() - 0.5) * moonR * t,
      group: i % 2,
    };
  });

  const plankSeams = 14;
  const balusterStep = 30 * k;

  return (
    <>
      {/* Night sky and stars. */}
      <LinearGradient colors={['#071226', '#13284a', '#2a4a72']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: horizon }} />
      {[0, 1, 2].map((g) => (
        <Loop key={g} motion="twinkle" duration={3000 + g * 1300} delay={g * 900} still={still} style={StyleSheet.absoluteFill}>
          {stars
            .filter((_, i) => i % 3 === g)
            .map((s, i) => (
              <View key={i} style={{ position: 'absolute', left: s.x, top: s.y, width: s.s, height: s.s, borderRadius: s.s, backgroundColor: `rgba(255,255,255,${s.o})` }} />
            ))}
        </Loop>
      ))}
      {/* The moon. */}
      <Glow x={moonX} y={moonY} size={moonR * 3.2} color="rgba(200, 220, 255, 0.10)" />
      <View
        style={{
          position: 'absolute',
          left: moonX - moonR,
          top: moonY - moonR,
          width: moonR * 2,
          height: moonR * 2,
          borderRadius: moonR,
          overflow: 'hidden',
          boxShadow: `0 0 ${moonR * 0.8}px rgba(255, 248, 220, 0.6)`,
        }}
      >
        <LinearGradient colors={['#fffbea', '#efe6c6', '#cfc39c']} start={{ x: 0.2, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
        {[
          [0.25, 0.3, 0.22],
          [0.58, 0.55, 0.3],
          [0.35, 0.7, 0.14],
          [0.68, 0.22, 0.12],
        ].map(([cx, cy, cr], i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: moonR * 2 * cx - moonR * cr,
              top: moonR * 2 * cy - moonR * cr,
              width: moonR * cr * 2,
              height: moonR * cr * 2,
              borderRadius: moonR,
              backgroundColor: 'rgba(150, 135, 100, 0.25)',
            }}
          />
        ))}
      </View>
      <Cross top={moonY - moonR * 1.6} width={w} height={moonR * 3} duration={land ? 160000 : 90000} still={still}>
        <Cloud x={w * 0.1} y={moonR * 0.9} s={k * (land ? 1.4 : 1)} />
        <Cloud x={w * 0.62} y={moonR * 1.5} s={k * (land ? 1.1 : 0.8)} />
      </Cross>

      {/* The sea, with the moon's path on it. */}
      <LinearGradient colors={['#1f4166', '#0f2643', '#06142a']} style={{ position: 'absolute', left: 0, right: 0, top: horizon, height: railY - horizon }} />
      <LinearGradient colors={['rgba(160, 190, 220, 0.25)', 'rgba(160, 190, 220, 0)']} style={{ position: 'absolute', left: 0, right: 0, top: horizon - 10 * k, height: 34 * k }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: horizon, height: 1, backgroundColor: 'rgba(220, 235, 255, 0.4)' }} />
      {/* A ship far away. */}
      <View style={{ position: 'absolute', left: w * 0.2, top: horizon - 7 * k, width: 46 * k, height: 7 * k, borderBottomLeftRadius: 14 * k, borderBottomRightRadius: 4 * k, backgroundColor: '#0a1628' }} />
      {[0.25, 0.5, 0.75].map((p, i) => (
        <View key={p}>
          <View style={{ position: 'absolute', left: w * 0.2 + 46 * k * p, top: horizon - (30 - i * 3) * k, width: 1.5 * k, height: (24 - i * 3) * k, backgroundColor: '#0a1628' }} />
          <Tri x={w * 0.2 + 46 * k * p + 6 * k} y={horizon - 9 * k} width={11 * k} height={(18 - i * 3) * k} color="#13233c" />
        </View>
      ))}
      <Loop motion="twinkle" duration={2600} still={still} style={{ position: 'absolute', left: w * 0.2 + 2 * k, top: horizon - 9 * k }}>
        <View style={{ width: 3 * k, height: 3 * k, borderRadius: 2 * k, backgroundColor: '#ffb347', boxShadow: `0 0 ${5 * k}px #ffb347` }} />
      </Loop>
      {waves.map((v, i) => (
        <View
          key={`w${i}`}
          style={{
            position: 'absolute',
            left: v.x,
            top: v.y,
            width: v.s * 1.4,
            height: v.s * 0.3,
            borderRadius: v.s,
            borderTopWidth: Math.max(1, v.s / 40),
            borderColor: 'rgba(150, 195, 235, 0.22)',
          }}
        />
      ))}
      {[0, 1].map((g) => (
        <Loop key={`r${g}`} motion="pulse" duration={3400} delay={g * 1700} still={still} style={StyleSheet.absoluteFill}>
          {reflections
            .filter((r) => r.group === g)
            .map((r, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: moonX + r.dx - r.width / 2,
                  top: r.y,
                  width: r.width,
                  height: Math.max(1.5, 2.5 * k),
                  borderRadius: 2 * k,
                  backgroundColor: 'rgba(255, 246, 210, 0.55)',
                }}
              />
            ))}
        </Loop>
      ))}

      {/* The sail, the yard holding it and the black flag. */}
      <View
        style={{
          position: 'absolute',
          left: mastX + 6 * k,
          top: h * 0.03,
          width: land ? w * 0.22 : w * 0.42,
          height: h * (land ? 0.42 : 0.3),
          borderBottomRightRadius: w * 0.3,
          borderBottomLeftRadius: 20 * k,
          overflow: 'hidden',
        }}
      >
        <LinearGradient colors={['#7c6e57', '#b7a685', '#d9c9a5', '#a39272']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.3 }} style={StyleSheet.absoluteFill} />
        {Array.from({ length: 14 }, (_, i) => (
          <View key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: (i + 1) * 16 * k, width: 1, backgroundColor: 'rgba(80, 60, 30, 0.25)' }} />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <View key={`rf${i}`} style={{ position: 'absolute', top: 22 * k, left: (i + 0.5) * 22 * k, width: 2 * k, height: 7 * k, backgroundColor: 'rgba(60, 40, 20, 0.5)' }} />
        ))}
        <View style={{ position: 'absolute', top: h * 0.12, left: 40 * k, width: 26 * k, height: 20 * k, backgroundColor: 'rgba(120, 95, 60, 0.35)', borderWidth: 1, borderColor: 'rgba(80, 60, 30, 0.4)', borderStyle: 'dashed' }} />
        <LinearGradient colors={['rgba(5,10,20,0)', 'rgba(5,10,20,0.45)']} style={StyleSheet.absoluteFill} />
      </View>
      <View style={{ position: 'absolute', left: mastX - 10 * k, top: h * 0.03 - 6 * k, width: land ? w * 0.25 : w * 0.48, height: 11 * k, borderRadius: 6 * k, backgroundColor: '#4a2c14', borderTopWidth: 1.5 * k, borderColor: '#8a5a32' }} />
      <Hanging x={w * (land ? 0.86 : 0.86)} y={h * 0.035} width={70 * k} length={60 * k} duration={5200} still={still}>
        <View style={{ position: 'absolute', left: 35 * k - k, top: 0, width: 2 * k, height: 12 * k, backgroundColor: '#2a1b0e' }} />
        <View style={{ position: 'absolute', left: 6 * k, top: 12 * k, width: 58 * k, height: 40 * k, backgroundColor: '#111317', borderTopWidth: 2 * k, borderColor: '#4a2c14', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 24 * k, color: '#ece6d8', lineHeight: 28 * k }}>☠</Text>
        </View>
        <Tri x={20 * k} y={52 * k} width={28 * k} height={9 * k} color="#111317" down />
        <Tri x={50 * k} y={52 * k} width={28 * k} height={9 * k} color="#111317" down />
      </Hanging>

      {/* Rigging from the mast down to the rail. */}
      {[0.16, 0.24, 0.32].map((p, i) => (
        <Line key={`sh${i}`} x1={mastX + 6 * k} y1={h * 0.02} x2={mastX + w * p} y2={capY + 4 * k} color="#20150b" width={2 * k} />
      ))}
      {Array.from({ length: 9 }, (_, i) => {
        const t = 0.2 + i * 0.09;
        const y = h * 0.02 + (capY - h * 0.02) * t;
        return (
          <Line
            key={`rl${i}`}
            x1={mastX + 6 * k + w * 0.16 * t}
            y1={y}
            x2={mastX + 6 * k + w * 0.32 * t}
            y2={y}
            color="rgba(32, 21, 11, 0.85)"
            width={1.2 * k}
          />
        );
      })}
      <Line x1={w * 0.98} y1={0} x2={w * 0.78} y2={capY + 4 * k} color="#20150b" width={2 * k} />

      {/* The mast. */}
      <View style={{ position: 'absolute', left: mastX - 14 * k, top: 0, width: 28 * k, height: h * 0.9, overflow: 'hidden', borderRadius: 3 * k }}>
        <LinearGradient colors={['#24150a', '#6a4220', '#9a6838', '#5a361a', '#1c1007']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        {[0.18, 0.46, 0.72].map((p) => (
          <View key={p} style={{ position: 'absolute', left: 0, right: 0, top: h * p, height: 8 * k, backgroundColor: '#26262c', borderTopWidth: 1, borderColor: '#7a7a86' }} />
        ))}
      </View>

      {/* The lanterns: one on an arm off the mast, one on a post at the rail. */}
      <View style={{ position: 'absolute', left: mastX + 12 * k, top: h * 0.36, width: 34 * k, height: 4 * k, backgroundColor: '#26262c' }} />
      <Hanging x={mastX + 40 * k} y={h * 0.36 + 2 * k} width={72 * k} length={64 * k} duration={4400} still={still}>
        <Lantern k={k} still={still} delay={0} />
      </Hanging>
      <Hanging x={w * (land ? 0.93 : 0.88)} y={capY - 52 * k} width={72 * k} length={64 * k} duration={4900} delay={1300} still={still}>
        <Lantern k={k} still={still} delay={500} />
      </Hanging>

      {/* The deck. */}
      <LinearGradient colors={['#4a2e16', '#36210f', '#1c1007']} style={{ position: 'absolute', left: 0, right: 0, top: railY - 2 * k, bottom: 0 }} />
      {Array.from({ length: plankSeams * 2 + 1 }, (_, i) => {
        const j = i - plankSeams;
        return (
          <Line
            key={`pk${i}`}
            x1={w / 2 + j * w * 0.07}
            y1={railY}
            x2={w / 2 + j * w * 0.16}
            y2={h}
            color="rgba(10, 5, 2, 0.55)"
            width={Math.max(1, 1.5 * k)}
          />
        );
      })}
      {Array.from({ length: 10 }, (_, i) => (
        <View key={`bj${i}`} style={{ position: 'absolute', left: (rand() * w) | 0, top: railY + (h - railY) * (0.15 + rand() * 0.8), width: 18 * k, height: 1.5 * k, backgroundColor: 'rgba(10, 5, 2, 0.5)' }} />
      ))}
      <Glow x={mastX + 40 * k} y={railY + (h - railY) * 0.35} size={90 * k} color="rgba(255, 168, 70, 0.10)" />

      {/* The rail along the ship's side, with turned balusters. */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: railY - 12 * k, height: 12 * k, backgroundColor: '#3e2410', borderTopWidth: 1.5 * k, borderColor: '#7a4c26' }} />
      {Array.from({ length: Math.ceil(w / balusterStep) + 1 }, (_, i) => (
        <View key={`b${i}`} style={{ position: 'absolute', left: i * balusterStep + 4 * k, top: capY + 10 * k, width: 10 * k, height: railY - capY - 22 * k, alignItems: 'center' }}>
          <LinearGradient colors={['#2a180a', '#7a4c26', '#2a180a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { left: 2 * k, right: 2 * k }]} />
          {[0.2, 0.55, 0.85].map((p) => (
            <View key={p} style={{ position: 'absolute', top: (railY - capY - 22 * k) * p, width: 10 * k, height: 6 * k, borderRadius: 3 * k, backgroundColor: '#5e3a1c' }} />
          ))}
        </View>
      ))}
      <View style={{ position: 'absolute', left: 0, right: 0, top: capY, height: 13 * k, overflow: 'hidden', boxShadow: `0 ${3 * k}px ${6 * k}px rgba(0,0,0,0.5)` }}>
        <LinearGradient colors={['#a26e3e', '#6e4524', '#3e2410']} style={StyleSheet.absoluteFill} />
      </View>
      {land && <Wheel x={w * 0.94} y={railY + (h - railY) * 0.42} r={62 * k} k={k} />}

      {/* Barrel, rope and treasure on the deck. */}
      <Barrel x={mastX + 22 * k} bottom={h * 0.985} k={k} />
      <RopeCoil x={mastX + (land ? 130 : 4) * k} y={h * 0.955} k={k} />
      <Chest x={w * (land ? 0.8 : 0.66) - 52 * k} bottom={h * 0.975} k={k} still={still} />
      <LinearGradient colors={['rgba(4,8,16,0)', 'rgba(4,8,16,0.35)']} style={{ position: 'absolute', left: 0, right: 0, top: h * 0.45, bottom: 0 }} />
    </>
  );
}
