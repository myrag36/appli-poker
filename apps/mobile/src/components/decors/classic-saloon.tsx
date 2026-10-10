// Saloon: a Far West bar, with a window on the desert, swinging doors, oil lamps and a shelf of bottles.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Dot, Drift, Glow, Haze, Line, Loop, Pivot, type SceneProps, Tri, random, tiny } from './classic-kit';

const DARK = '#2a1708';
const IRON = '#1c140c';

/** A saguaro cactus: trunk and two raised arms. */
function Saguaro({ x, base, s, color }: { x: number; base: number; s: number; color: string }) {
  const arm = (side: number, y: number, up: number) => (
    <>
      <View
        style={{
          position: 'absolute',
          left: side > 0 ? x + 4 * s : x - 18 * s,
          top: base - y,
          width: 14 * s,
          height: 7 * s,
          backgroundColor: color,
          borderBottomLeftRadius: side < 0 ? 6 * s : 0,
          borderBottomRightRadius: side > 0 ? 6 * s : 0,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: side > 0 ? x + 12 * s : x - 18 * s,
          top: base - y - up,
          width: 7 * s,
          height: up + 7 * s,
          borderTopLeftRadius: 4 * s,
          borderTopRightRadius: 4 * s,
          backgroundColor: color,
        }}
      />
    </>
  );
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: x - 5.5 * s,
          top: base - 60 * s,
          width: 11 * s,
          height: 60 * s,
          borderTopLeftRadius: 6 * s,
          borderTopRightRadius: 6 * s,
          backgroundColor: color,
        }}
      />
      {arm(1, 34 * s, 16 * s)}
      {arm(-1, 26 * s, 12 * s)}
    </>
  );
}

/** A window opening on the desert at sunset, with its wooden frame and mullions. */
function DesertWindow({ x, y, ww, wh, k }: { x: number; y: number; ww: number; wh: number; k: number }) {
  const s = ww / 170;
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: ww,
          height: wh,
          overflow: 'hidden',
          borderWidth: 7 * s,
          borderColor: '#4a2c12',
          boxShadow: `0 0 ${30 * k}px rgba(255, 170, 80, 0.35)`,
        }}
      >
        <LinearGradient
          colors={['#ffb36b', '#ff8a5c', '#f2a65a', '#ffd59e']}
          style={StyleSheet.absoluteFill}
        />
        <Dot
          x={ww * 0.62}
          y={wh * 0.56}
          size={ww * 0.22}
          color="#fff1c4"
          style={{ boxShadow: `0 0 ${20 * s}px #ffe29a` }}
        />
        {/* Mesas */}
        <View
          style={{
            position: 'absolute',
            left: ww * 0.05,
            top: wh * 0.52,
            width: ww * 0.28,
            height: wh,
            backgroundColor: '#b5543a',
          }}
        />
        <Tri
          x={ww * 0.05}
          y={wh * 0.52 + wh * 0.48}
          width={ww * 0.12}
          height={wh * 0.48}
          color="#b5543a"
          skew={0.5}
        />
        <View
          style={{
            position: 'absolute',
            left: ww * 0.72,
            top: wh * 0.62,
            width: ww * 0.2,
            height: wh,
            backgroundColor: '#a34a33',
          }}
        />
        <Tri x={ww * 0.92} y={wh} width={ww * 0.1} height={wh * 0.38} color="#a34a33" skew={-0.5} />
        <LinearGradient
          colors={['#c96a3c', '#8a3e22']}
          style={{ position: 'absolute', left: 0, right: 0, top: wh * 0.74, bottom: 0 }}
        />
        <Saguaro x={ww * 0.36} base={wh * 0.86} s={s * 0.8} color="#3f4a22" />
        <Saguaro x={ww * 0.85} base={wh * 0.8} s={s * 0.45} color="#55602e" />
        {/* Birds */}
        <Text
          style={{ position: 'absolute', left: ww * 0.25, top: wh * 0.18, fontSize: 9 * s, color: '#5a2c18' }}
        >
          ⌒⌒
        </Text>
        {/* Mullions */}
        <View
          style={{
            position: 'absolute',
            left: ww / 2 - 3.5 * s - 7 * s,
            top: 0,
            bottom: 0,
            width: 7 * s,
            backgroundColor: '#4a2c12',
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: wh / 2 - 3.5 * s - 7 * s,
            left: 0,
            right: 0,
            height: 7 * s,
            backgroundColor: '#4a2c12',
          }}
        />
        {/* Dusty glass */}
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.08)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {/* Sill */}
      <View
        style={{
          position: 'absolute',
          left: x - 8 * s,
          top: y + wh - 2 * s,
          width: ww + 16 * s,
          height: 9 * s,
          backgroundColor: '#5c3a1a',
          borderTopWidth: 2 * s,
          borderColor: '#a0703f',
          boxShadow: `0 ${4 * s}px ${6 * s}px rgba(0,0,0,0.5)`,
        }}
      />
    </>
  );
}

/** An oil lamp hanging on a chain, its flame flickering. */
function OilLamp({ x, drop, s, still }: { x: number; drop: number; s: number; still?: boolean }) {
  return (
    <Pivot
      x={x}
      y={0}
      width={60 * s}
      length={drop + 40 * s}
      amp={2}
      duration={5600}
      delay={x * 5}
      still={still}
    >
      <Line x1={30 * s} y1={0} x2={30 * s} y2={drop} color={IRON} width={2 * s} />
      <Glow x={30 * s} y={drop + 20 * s} size={30 * s} color="rgba(255, 190, 100, 0.25)" />
      <View
        style={{
          position: 'absolute',
          left: 18 * s,
          top: drop,
          width: 24 * s,
          height: 6 * s,
          borderTopLeftRadius: 12 * s,
          borderTopRightRadius: 12 * s,
          backgroundColor: IRON,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 21 * s,
          top: drop + 6 * s,
          width: 18 * s,
          height: 22 * s,
          borderRadius: 9 * s,
          backgroundColor: 'rgba(255, 220, 160, 0.55)',
          borderWidth: 1.5 * s,
          borderColor: 'rgba(60, 40, 20, 0.8)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Loop
          motion="flicker"
          duration={900}
          delay={x}
          still={still}
          style={{ width: 6 * s, height: 10 * s }}
        >
          <View
            style={{
              flex: 1,
              borderRadius: 3 * s,
              backgroundColor: '#fff0b0',
              boxShadow: `0 0 ${10 * s}px ${4 * s}px rgba(255, 180, 80, 0.85)`,
            }}
          />
        </Loop>
      </View>
      <View
        style={{
          position: 'absolute',
          left: 16 * s,
          top: drop + 27 * s,
          width: 28 * s,
          height: 7 * s,
          borderBottomLeftRadius: 6 * s,
          borderBottomRightRadius: 6 * s,
          backgroundColor: IRON,
        }}
      />
    </Pivot>
  );
}

/** The bar's back shelf: bottles, glasses and a mirror. */
function BackBar({ x, y, width, s, seed }: { x: number; y: number; width: number; s: number; seed: number }) {
  const rand = random(seed);
  const shelf = (sy: number) => {
    const items: ReactNode[] = [];
    let bx = x + 6 * s;
    let i = 0;
    while (bx < x + width - 16 * s) {
      const glass = rand() < 0.25;
      const bw = glass ? 8 * s : (8 + rand() * 6) * s;
      const bh = glass ? 10 * s : (22 + rand() * 14) * s;
      const c = [
        'rgba(110, 60, 20, 0.95)',
        'rgba(50, 80, 30, 0.9)',
        'rgba(150, 100, 40, 0.8)',
        'rgba(80, 30, 20, 0.95)',
      ][Math.floor(rand() * 4)];
      items.push(
        glass ? (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: bx,
              top: sy - bh,
              width: bw,
              height: bh,
              borderBottomLeftRadius: 2 * s,
              borderBottomRightRadius: 2 * s,
              backgroundColor: 'rgba(230, 220, 200, 0.25)',
              borderWidth: Math.max(0.5, 0.8 * s),
              borderColor: 'rgba(255, 240, 210, 0.5)',
            }}
          />
        ) : (
          <View key={i}>
            <View
              style={{
                position: 'absolute',
                left: bx,
                top: sy - bh * 0.7,
                width: bw,
                height: bh * 0.7,
                borderTopLeftRadius: bw * 0.35,
                borderTopRightRadius: bw * 0.35,
                backgroundColor: c,
                borderLeftWidth: Math.max(1, s),
                borderColor: 'rgba(255, 220, 160, 0.4)',
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: bx + bw * 0.33,
                top: sy - bh,
                width: bw * 0.34,
                height: bh * 0.32,
                backgroundColor: c,
              }}
            />
            {i % 2 === 0 && (
              <View
                style={{
                  position: 'absolute',
                  left: bx + bw * 0.12,
                  top: sy - bh * 0.42,
                  width: bw * 0.76,
                  height: bh * 0.2,
                  backgroundColor: 'rgba(241, 220, 167, 0.7)',
                }}
              />
            )}
          </View>
        ),
      );
      bx += bw + (3 + rand() * 5) * s;
      i++;
    }
    return items;
  };
  const shelfGap = 46 * s;
  return (
    <>
      {/* Mirror */}
      <View
        style={{
          position: 'absolute',
          left: x + width * 0.15,
          top: y - shelfGap * 2 - 70 * s,
          width: width * 0.7,
          height: 60 * s,
          borderRadius: 8 * s,
          borderWidth: 5 * s,
          borderColor: '#7a4f26',
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={['rgba(255, 220, 170, 0.25)', 'rgba(120, 90, 60, 0.15)', 'rgba(255, 220, 170, 0.2)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {[0, 1, 2].map((r) => (
        <View key={r}>
          {shelf(y - r * shelfGap)}
          <View
            style={{
              position: 'absolute',
              left: x,
              top: y - r * shelfGap,
              width,
              height: 6 * s,
              backgroundColor: '#5c3a1a',
              borderTopWidth: Math.max(1, s),
              borderColor: '#a0703f',
              boxShadow: `0 ${3 * s}px ${6 * s}px rgba(0,0,0,0.55)`,
            }}
          />
        </View>
      ))}
    </>
  );
}

/** Batwing doors in a doorway, with the bright street behind, swinging a little. */
function SwingDoors({ x, base, s, still }: { x: number; base: number; s: number; still?: boolean }) {
  const dw = 120 * s;
  const dh = 190 * s;
  const leaf = (side: number) => (
    <Loop
      motion="swing"
      amp={0.12}
      duration={3800}
      delay={side > 0 ? 1900 : 0}
      still={still}
      style={{
        position: 'absolute',
        left: side < 0 ? -dw / 2 : dw / 2,
        top: dh * 0.32,
        width: dw,
        height: dh * 0.42,
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: side < 0 ? dw / 2 : 1 * s,
          width: dw / 2 - 1 * s,
          height: dh * 0.42,
          borderTopLeftRadius: side > 0 ? 16 * s : 4 * s,
          borderTopRightRadius: side < 0 ? 16 * s : 4 * s,
          backgroundColor: '#8a5530',
          borderWidth: 2 * s,
          borderColor: '#4a2c12',
          paddingHorizontal: 6 * s,
          paddingVertical: 10 * s,
          gap: 4 * s,
        }}
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={{
              height: 5 * s,
              backgroundColor: '#5c3a1a',
              borderBottomWidth: s,
              borderColor: '#b07a46',
            }}
          />
        ))}
      </View>
    </Loop>
  );
  return (
    <View style={{ position: 'absolute', left: x - dw / 2, top: base - dh, width: dw, height: dh }}>
      {/* Doorway with daylight outside */}
      <View
        style={{
          position: 'absolute',
          left: -10 * s,
          right: -10 * s,
          top: -10 * s,
          bottom: 0,
          borderWidth: 8 * s,
          borderBottomWidth: 0,
          borderColor: '#4a2c12',
          overflow: 'hidden',
        }}
      >
        <LinearGradient colors={['#ffcf8a', '#f2a65a', '#d4884a']} style={StyleSheet.absoluteFill} />
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: dh * 0.25,
            backgroundColor: '#c97f45',
          }}
        />
        <Saguaro x={dw * 0.75} base={dh * 0.8} s={s * 0.8} color="rgba(70, 70, 30, 0.8)" />
      </View>
      <Haze x={dw / 2} y={dh} width={dw * 2.2} height={dh * 0.5} color="rgba(255, 190, 110, 0.22)" />
      {leaf(-1)}
      {leaf(1)}
    </View>
  );
}

/** A barrel standing on the floor. */
function Barrel({ x, base, s }: { x: number; base: number; s: number }) {
  const bw = 54 * s;
  const bh = 70 * s;
  return (
    <View
      style={{
        position: 'absolute',
        left: x - bw / 2,
        top: base - bh,
        width: bw,
        height: bh,
        borderRadius: 12 * s,
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={['#3d2810', '#8a5a2b', '#a0703f', '#6f4a24', '#2a1708']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {[0.12, 0.3, 0.7, 0.88].map((t) => (
        <View
          key={t}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: bh * t,
            height: 4 * s,
            backgroundColor: '#2a2420',
          }}
        />
      ))}
      {[0.25, 0.5, 0.75].map((t) => (
        <View
          key={`s${t}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: bw * t,
            width: Math.max(0.6, 0.8 * s),
            backgroundColor: 'rgba(0,0,0,0.3)',
          }}
        />
      ))}
    </View>
  );
}

/** A horseshoe nailed to the wall, for luck. */
function Horseshoe({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: x - 14 * s,
        top: y - 14 * s,
        width: 28 * s,
        height: 30 * s,
        borderRadius: 14 * s,
        borderWidth: 6 * s,
        borderColor: '#6b6b6b',
        borderTopColor: 'transparent',
        transform: [{ rotate: '180deg' }],
      }}
    />
  );
}

export function Saloon({ w, h, k }: SceneProps) {
  const still = tiny(w);
  const narrow = w < 560;
  const plank = 46 * k;
  const rand = random(11);
  const floor = h * 0.86;
  const ww = narrow ? w * 0.36 : Math.min(w * 0.15, 240 * k);
  const wh = ww * 0.82;
  const winX = narrow ? w * 0.6 : w * 0.8;
  const winY = narrow ? h * 0.03 : h * 0.14;
  const s = narrow ? k * 0.8 : k;
  return (
    <>
      {Array.from({ length: Math.ceil(w / plank) + 1 }, (_, i) => {
        const shade = 0.85 + rand() * 0.3;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: i * plank,
              width: plank - 2 * k,
              opacity: shade,
            }}
          >
            <LinearGradient
              colors={['#9c6b3a', '#7a4f26', '#5c3a1a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Wood grain and a knot here and there */}
            {[0.3, 0.62].map((t) => (
              <View
                key={t}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: plank * t,
                  width: Math.max(0.5, 0.7 * k),
                  backgroundColor: 'rgba(42, 23, 8, 0.25)',
                }}
              />
            ))}
            {i % 3 === 1 && (
              <View
                style={{
                  position: 'absolute',
                  left: plank * 0.4,
                  top: h * (0.2 + rand() * 0.6),
                  width: 7 * k,
                  height: 11 * k,
                  borderRadius: 6 * k,
                  borderWidth: Math.max(1, 1.2 * k),
                  borderColor: 'rgba(42, 23, 8, 0.4)',
                }}
              />
            )}
            {[0.06, 0.94].map((y) => (
              <View
                key={y}
                style={{
                  position: 'absolute',
                  top: h * y,
                  left: plank / 2 - 3 * k,
                  width: 4 * k,
                  height: 4 * k,
                  borderRadius: 2 * k,
                  backgroundColor: DARK,
                }}
              />
            ))}
          </View>
        );
      })}
      <LinearGradient
        colors={['rgba(42,23,8,0.25)', 'rgba(42,23,8,0.55)', 'rgba(20,10,3,0.92)']}
        style={StyleSheet.absoluteFill}
      />
      {/* Ceiling beam */}
      <LinearGradient
        colors={['#2a1708', '#4a2c12', '#2a1708']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 14 * k }}
      />

      {/* Window on the desert, and the shaft of light it throws */}
      <View
        style={{
          position: 'absolute',
          left: winX - ww * 0.2,
          top: winY + wh * 0.4,
          width: ww * 1.1,
          height: h * 0.9,
          transform: [{ skewX: '18deg' }],
          opacity: 0.9,
        }}
      >
        <LinearGradient
          colors={['rgba(255, 200, 120, 0.16)', 'rgba(255, 200, 120, 0)']}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Drift
        left={winX - ww * 0.1}
        top={winY + wh}
        width={ww * 1.2}
        height={h * 0.5}
        up
        duration={26000}
        still={still}
      >
        {Array.from({ length: 14 }, (_, i) => (
          <Dot
            key={i}
            x={rand() * ww * 1.2}
            y={rand() * h * 0.5}
            size={(1.2 + rand() * 1.8) * k}
            color={`rgba(255, 225, 170, ${0.35 + rand() * 0.4})`}
          />
        ))}
      </Drift>
      <DesertWindow x={winX} y={winY} ww={ww} wh={wh} k={k} />

      {/* Hanging sign */}
      <Pivot
        x={w / 2}
        y={0}
        width={170 * s}
        length={(narrow ? 46 : 64) * s}
        amp={1.5}
        duration={6000}
        still={still}
      >
        <Line x1={40 * s} y1={0} x2={40 * s} y2={(narrow ? 18 : 30) * s} color={IRON} width={1.5 * s} />
        <Line x1={130 * s} y1={0} x2={130 * s} y2={(narrow ? 18 : 30) * s} color={IRON} width={1.5 * s} />
        <View
          style={{
            position: 'absolute',
            left: 10 * s,
            top: (narrow ? 16 : 28) * s,
            width: 150 * s,
            height: 32 * s,
            borderRadius: 4 * s,
            overflow: 'hidden',
            borderWidth: 2 * s,
            borderColor: '#2a1708',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 ${4 * s}px ${8 * s}px rgba(0,0,0,0.5)`,
          }}
        >
          <LinearGradient colors={['#b07a46', '#8a5530', '#6f4a24']} style={StyleSheet.absoluteFill} />
          <Text
            style={{
              fontSize: 19 * s,
              fontWeight: '900',
              fontFamily: 'Georgia, serif',
              letterSpacing: 4 * s,
              color: '#f1dca7',
              textShadowColor: '#2a1708',
              textShadowOffset: { width: 1 * s, height: 1.5 * s },
              textShadowRadius: 0.5,
            }}
          >
            SALOON
          </Text>
        </View>
      </Pivot>
      {/* Lamps */}
      {(narrow ? [0.12, 0.88] : [0.3, 0.7]).map((x) => (
        <OilLamp key={x} x={w * x} drop={(narrow ? 22 : 40) * k} s={s} still={still} />
      ))}

      {/* Wanted poster and horseshoe */}
      <View
        style={{
          position: 'absolute',
          left: w * (narrow ? 0.05 : 0.04),
          top: h * (narrow ? 0.85 : 0.2),
          width: 74 * k,
          height: 92 * k,
          backgroundColor: '#f1dca7',
          alignItems: 'center',
          paddingTop: 6 * k,
          transform: [{ rotate: '-7deg' }],
          boxShadow: `0 ${4 * k}px ${10 * k}px rgba(0,0,0,0.5)`,
        }}
      >
        <Text style={{ fontSize: 13 * k, fontWeight: '900', color: '#3d2810', letterSpacing: 1 }}>
          WANTED
        </Text>
        <Text style={{ fontSize: 34 * k, marginTop: 2 * k }}>🤠</Text>
        <Text style={{ fontSize: 9 * k, fontWeight: '800', color: '#3d2810' }}>$ 1000</Text>
        <Dot x={37 * k} y={2 * k} size={4 * k} color="#555" />
      </View>
      {!narrow && <Horseshoe x={w * 0.13} y={h * 0.14} s={k} />}

      {/* Back bar on the right (computer) */}
      {!narrow && (
        <BackBar
          x={w - Math.min(w * 0.13, 210 * k)}
          y={h * 0.66}
          width={Math.min(w * 0.13, 210 * k) - 8 * k}
          s={k}
          seed={8}
        />
      )}

      {/* Floor */}
      <LinearGradient
        colors={['#3d2810', '#2a1708', '#140a03']}
        style={{ position: 'absolute', left: 0, right: 0, top: floor, bottom: 0 }}
      />
      {[0.25, 0.55].map((t) => (
        <Line
          key={t}
          x1={0}
          y1={floor + (h - floor) * t}
          x2={w}
          y2={floor + (h - floor) * t}
          color="rgba(0,0,0,0.35)"
          width={Math.max(1, k)}
        />
      ))}
      <Line x1={0} y1={floor} x2={w} y2={floor} color="#a0703f" width={Math.max(1, 2 * k)} />
      <SwingDoors
        x={narrow ? w * 0.82 : w * 0.11}
        base={floor + 4 * k}
        s={narrow ? k * 0.55 : k * Math.min(1.3, h / 760)}
        still={still}
      />
      <Barrel x={narrow ? w * 0.08 : w * 0.25} base={h - 6 * k} s={narrow ? k * 0.7 : k} />
      {!narrow && <Barrel x={w * 0.95} base={h - 10 * k} s={k * 0.85} />}
      <Saguaro
        x={w * (narrow ? 0.94 : 0.03)}
        base={h + 4 * k}
        s={k * (narrow ? 0.7 : 1.1)}
        color="rgba(70, 90, 40, 0.65)"
      />
    </>
  );
}
