// Lounge: a jazz club, with a backlit bar shelf, pendant lamps, a double bass and warm bokeh.
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Drift, Glow, Haze, Line, Loop, type SceneProps, random, tiny } from './classic-kit';

const BRASS = '#b5835a';

/** A lamp hanging from the ceiling, with its cone of light. */
function Pendant({
  x,
  drop,
  s,
  h,
  still,
}: {
  x: number;
  drop: number;
  s: number;
  h: number;
  still?: boolean;
}) {
  const shade = 46 * s;
  return (
    <>
      {/* Soft cone of light under the shade */}
      <Haze
        x={x}
        y={drop + shade * 0.5 + h * 0.13}
        width={shade * 3.4}
        height={h * 0.3}
        color="rgba(255, 205, 140, 0.13)"
      />
      <Line x1={x} y1={0} x2={x} y2={drop} color="rgba(20, 14, 10, 0.9)" width={1.5 * s} />
      <Loop
        motion="flicker"
        duration={5200}
        delay={x * 3}
        still={still}
        style={{
          position: 'absolute',
          left: x - shade,
          top: drop - shade * 0.2,
          width: shade * 2,
          height: shade * 1.6,
        }}
      >
        <Glow x={shade} y={shade * 0.75} size={shade * 0.7} color="rgba(255, 196, 120, 0.22)" />
      </Loop>
      <View
        style={{
          position: 'absolute',
          left: x - shade / 2,
          top: drop,
          width: shade,
          height: shade * 0.5,
          borderTopLeftRadius: shade / 2,
          borderTopRightRadius: shade / 2,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={['#d9a066', '#8a5a2e', '#4a2c14']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.4 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View
        style={{
          position: 'absolute',
          left: x - shade / 2,
          top: drop + shade * 0.5 - 2 * s,
          width: shade,
          height: 3 * s,
          borderRadius: 2 * s,
          backgroundColor: '#ffe2b0',
          boxShadow: `0 ${4 * s}px ${14 * s}px ${4 * s}px rgba(255, 200, 120, 0.55)`,
        }}
      />
    </>
  );
}

/** Bottles of all shapes on a shelf, lit from behind. */
function Shelf({ x, y, width, s, seed }: { x: number; y: number; width: number; s: number; seed: number }) {
  const rand = random(seed);
  const items: { bx: number; bw: number; bh: number; neck: number; c: string }[] = [];
  let bx = x + 6 * s;
  while (bx < x + width - 16 * s) {
    const bw = (9 + rand() * 9) * s;
    items.push({
      bx,
      bw,
      bh: (24 + rand() * 22) * s,
      neck: (6 + rand() * 10) * s,
      c: [
        'rgba(120, 60, 20, 0.92)',
        'rgba(40, 80, 40, 0.9)',
        'rgba(170, 120, 60, 0.75)',
        'rgba(70, 30, 30, 0.92)',
      ][Math.floor(rand() * 4)],
    });
    bx += bw + (3 + rand() * 6) * s;
  }
  return (
    <>
      <Glow
        x={x + width / 2}
        y={y - 22 * s}
        size={Math.min(width * 0.5, 120 * s)}
        color="rgba(255, 170, 80, 0.10)"
      />
      {items.map((b, i) => (
        <View key={i}>
          <View
            style={{
              position: 'absolute',
              left: b.bx,
              top: y - b.bh,
              width: b.bw,
              height: b.bh - b.neck,
              borderTopLeftRadius: b.bw * 0.4,
              borderTopRightRadius: b.bw * 0.4,
              borderRadius: 1.5 * s,
              backgroundColor: b.c,
              borderLeftWidth: Math.max(1, s),
              borderColor: 'rgba(255, 220, 170, 0.35)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: b.bx + b.bw * 0.32,
              top: y - b.bh - b.neck * 0.15,
              width: b.bw * 0.36,
              height: b.neck + 2 * s,
              backgroundColor: b.c,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: b.bx + b.bw * 0.28,
              top: y - b.bh - b.neck * 0.15 - 3 * s,
              width: b.bw * 0.44,
              height: 3 * s,
              backgroundColor: i % 3 ? '#c9a24a' : '#7a1f1f',
            }}
          />
          {/* Label */}
          {i % 2 === 0 && (
            <View
              style={{
                position: 'absolute',
                left: b.bx + b.bw * 0.15,
                top: y - (b.bh - b.neck) * 0.55,
                width: b.bw * 0.7,
                height: (b.bh - b.neck) * 0.28,
                backgroundColor: 'rgba(240, 225, 190, 0.55)',
              }}
            />
          )}
        </View>
      ))}
      {/* The plank */}
      <View
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width,
          height: 5 * s,
          backgroundColor: '#5c3a21',
          borderTopWidth: Math.max(1, s),
          borderColor: '#b5835a',
          boxShadow: `0 ${4 * s}px ${8 * s}px rgba(0,0,0,0.6)`,
        }}
      />
    </>
  );
}

/** An upright double bass leaning on the wall. */
function Bass({ x, y, s }: { x: number; y: number; s: number }) {
  const body = (bw: number, bh: number, top: number) => (
    <View
      style={{
        position: 'absolute',
        left: -bw / 2,
        top,
        width: bw,
        height: bh,
        borderRadius: bw / 2,
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={['#8a4a1c', '#5a2c0e', '#2a1406']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.3 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
  return (
    <View style={{ position: 'absolute', left: x, top: y, transform: [{ rotate: '-12deg' }] }}>
      <View
        style={{
          position: 'absolute',
          left: -3 * s,
          top: -150 * s,
          width: 6 * s,
          height: 160 * s,
          backgroundColor: '#1c0f06',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: -6 * s,
          top: -164 * s,
          width: 12 * s,
          height: 18 * s,
          borderRadius: 6 * s,
          backgroundColor: '#3a1d0a',
        }}
      />
      {body(70 * s, 80 * s, 0)}
      {body(88 * s, 100 * s, 56 * s)}
      {/* Strings, bridge and f-holes */}
      {[-3, -1, 1, 3].map((o) => (
        <View
          key={o}
          style={{
            position: 'absolute',
            left: o * s,
            top: -150 * s,
            width: Math.max(0.6, 0.6 * s),
            height: 270 * s,
            backgroundColor: 'rgba(240, 220, 180, 0.55)',
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: -10 * s,
          top: 104 * s,
          width: 20 * s,
          height: 3 * s,
          backgroundColor: '#d9b382',
        }}
      />
      {[-1, 1].map((side) => (
        <Text
          key={side}
          style={{
            position: 'absolute',
            left: side * 20 * s - 4 * s,
            top: 80 * s,
            fontSize: 22 * s,
            color: '#140802',
          }}
        >
          ʃ
        </Text>
      ))}
      <View
        style={{
          position: 'absolute',
          left: -1.5 * s,
          top: 150 * s,
          width: 3 * s,
          height: 22 * s,
          backgroundColor: '#888',
        }}
      />
    </View>
  );
}

/** A vintage microphone on its stand. */
function Microphone({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <>
      <Line x1={x} y1={y} x2={x} y2={y - 150 * s} color="#2a2a2a" width={3 * s} />
      <Line x1={x - 22 * s} y1={y} x2={x + 22 * s} y2={y} color="#1a1a1a" width={4 * s} />
      <View
        style={{
          position: 'absolute',
          left: x - 10 * s,
          top: y - 180 * s,
          width: 20 * s,
          height: 30 * s,
          borderRadius: 10 * s,
          backgroundColor: '#b8b8b8',
          borderWidth: 2 * s,
          borderColor: '#6a6a6a',
          boxShadow: `0 0 ${10 * s}px rgba(255, 200, 120, 0.35)`,
        }}
      />
      {[0.3, 0.5, 0.7].map((t) => (
        <View
          key={t}
          style={{
            position: 'absolute',
            left: x - 8 * s,
            top: y - 180 * s + 30 * s * t,
            width: 16 * s,
            height: Math.max(0.8, s),
            backgroundColor: '#6a6a6a',
          }}
        />
      ))}
    </>
  );
}

export function Lounge({ w, h, k }: SceneProps) {
  const still = tiny(w);
  const narrow = w < 560;
  // On a phone the title and buttons fill the top: the shelf hangs lower, beside the cards.
  const phone = narrow && k >= 0.95;
  const rail = h * 0.62;
  const rand = random(31);
  const shelfW = narrow ? w * 0.34 : Math.min(w * 0.2, 300 * k);
  const s = narrow ? k * 0.85 : k;
  const stripes = Math.ceil(w / (18 * k));
  const panel = 120 * k;
  return (
    <>
      {/* Striped wallpaper */}
      {Array.from({ length: stripes }, (_, i) => (
        <View
          key={`w${i}`}
          style={{
            position: 'absolute',
            top: 0,
            height: rail,
            left: i * 18 * k,
            width: i % 2 ? 1 : 6 * k,
            backgroundColor: i % 2 ? 'rgba(233, 168, 91, 0.07)' : 'rgba(0, 0, 0, 0.08)',
          }}
        />
      ))}
      {/* Crown molding */}
      <LinearGradient
        colors={['#2a1a0e', '#4a2f19', '#1a1008']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 12 * k }}
      />
      {/* Wood paneling under the chair rail */}
      <LinearGradient
        colors={['#3d2614', '#2e1c0f', '#1a0f07']}
        style={{ position: 'absolute', left: 0, right: 0, top: rail, bottom: 0 }}
      />
      {Array.from({ length: Math.ceil(w / panel) + 1 }, (_, i) => (
        <View
          key={`pn${i}`}
          style={{
            position: 'absolute',
            left: i * panel + 12 * k,
            top: rail + 18 * k,
            width: panel - 24 * k,
            height: Math.max(0, h - rail - 36 * k),
            borderWidth: Math.max(1, 1.5 * k),
            borderTopColor: 'rgba(0,0,0,0.5)',
            borderLeftColor: 'rgba(0,0,0,0.5)',
            borderRightColor: 'rgba(233, 168, 91, 0.18)',
            borderBottomColor: 'rgba(233, 168, 91, 0.18)',
            borderRadius: 2 * k,
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: rail - 4 * k,
          height: 6 * k,
          backgroundColor: BRASS,
          boxShadow: `0 ${3 * k}px ${8 * k}px rgba(0,0,0,0.6)`,
        }}
      />

      {/* The back bar, on the left */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: h * (phone ? 0.37 : narrow ? 0.12 : 0.27),
          width: shelfW,
          height: h * (phone ? 0.25 : narrow ? 0.36 : 0.33),
          overflow: 'hidden',
          borderTopRightRadius: 6 * k,
          borderBottomRightRadius: 6 * k,
          borderWidth: Math.max(1, 2 * k),
          borderLeftWidth: 0,
          borderColor: '#5c3a21',
        }}
      >
        <LinearGradient
          colors={['rgba(255, 170, 80, 0.10)', 'rgba(255, 170, 80, 0.24)', 'rgba(255, 170, 80, 0.06)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {(phone ? [0.45, 0.53, 0.61] : narrow ? [0.25, 0.37, 0.48] : [0.38, 0.48, 0.58]).map((t, i) => (
        <Shelf key={t} x={0} y={h * t} width={shelfW - 2 * k} s={s} seed={i + 4} />
      ))}

      {/* Jazz corner, on the right: a poster, the microphone and the bass */}
      {!narrow && (
        <View
          style={{
            position: 'absolute',
            right: w * 0.075,
            top: h * 0.3,
            width: 92 * k,
            height: 128 * k,
            backgroundColor: '#e8d5b0',
            borderWidth: 4 * k,
            borderColor: '#3a2412',
            alignItems: 'center',
            paddingTop: 8 * k,
            transform: [{ rotate: '3deg' }],
            boxShadow: `0 ${6 * k}px ${14 * k}px rgba(0,0,0,0.6)`,
          }}
        >
          <Text style={{ fontSize: 22 * k, fontWeight: '900', color: '#8a1c1c', letterSpacing: 2 * k }}>
            JAZZ
          </Text>
          <Text style={{ fontSize: 40 * k, marginTop: 2 * k }}>🎷</Text>
          <Text style={{ fontSize: 8 * k, fontWeight: '800', color: '#2a1a0e', marginTop: 4 * k }}>
            LIVE · 21H
          </Text>
        </View>
      )}
      <Microphone x={w - (narrow ? 22 : 150) * k} y={rail + (narrow ? 60 : 80) * k} s={s} />
      <Bass x={w - (narrow ? 50 : 36) * k} y={rail - 40 * s} s={s} />

      {/* Neon "Jazz" sign on the wall */}
      <Loop
        motion="blink"
        duration={6800}
        still={still || narrow}
        style={{
          position: 'absolute',
          right: narrow ? w * 0.06 : w * 0.08,
          top: narrow ? h * 0.935 : h * 0.3 + 140 * k,
        }}
      >
        <Text
          style={{
            fontSize: 26 * k,
            fontStyle: 'italic',
            fontWeight: '700',
            color: '#ffd3e8',
            textShadowColor: '#ff4fa3',
            textShadowRadius: 10 * k,
            transform: [{ rotate: '-6deg' }],
          }}
        >
          Jazz
        </Text>
      </Loop>

      {/* Pendant lamps */}
      {(narrow ? [0.5] : [0.5, 0.28, 0.72]).map((x, i) => (
        <Pendant
          key={x}
          x={w * x}
          drop={(narrow ? 6 : i ? 24 : 40) * k}
          s={k * (narrow ? 0.7 : 1)}
          h={h}
          still={still}
        />
      ))}

      {/* Warm bokeh floating at the edges */}
      {Array.from({ length: narrow ? 8 : 14 }, (_, i) => {
        const left = i % 2 ? rand() * w * 0.22 : w - rand() * w * 0.22;
        const size = (18 + rand() * 40) * k;
        return (
          <Loop
            key={`bk${i}`}
            motion="bob"
            amp={0.4}
            duration={7000 + rand() * 6000}
            delay={rand() * 8000}
            still={still}
            height={size}
            style={{
              position: 'absolute',
              left,
              top: rand() * h * 0.9,
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: [
                'rgba(255, 196, 120, 0.09)',
                'rgba(255, 150, 90, 0.08)',
                'rgba(180, 210, 255, 0.06)',
              ][i % 3],
            }}
          />
        );
      })}
      {/* Music notes drifting up from the bass */}
      <Drift
        left={w - (narrow ? 90 : 260) * k}
        top={h * 0.15}
        width={(narrow ? 90 : 200) * k}
        height={h * 0.5}
        up
        duration={16000}
        still={still}
      >
        {['♪', '♫', '♩', '♬', '♪'].map((n, i) => (
          <Text
            key={i}
            style={{
              position: 'absolute',
              left: ((i * 37) % 80) * k * (narrow ? 0.9 : 2),
              top: (i / 5) * h * 0.5,
              fontSize: (14 + (i % 3) * 5) * k,
              color: 'rgba(246, 211, 166, 0.35)',
            }}
          >
            {n}
          </Text>
        ))}
      </Drift>
      {/* Haze and darker corners */}
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']}
        locations={[0, 0.14, 0.86, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </>
  );
}
