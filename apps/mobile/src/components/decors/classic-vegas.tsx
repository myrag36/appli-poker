// Las Vegas: a stage whose red curtains open on the Strip at night, under a marquee of bulbs.
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Dot,
  Glow,
  Line,
  Loop,
  Pivot,
  type SceneProps,
  Tri,
  many,
  random,
  stripes,
  tiny,
} from './classic-kit';

const GOLD = '#c9a227';
const FOLD: readonly [string, string, ...string[]] = ['#2a0306', '#8d0f16', '#c1121f', '#8d0f16', '#2a0306'];

/** Vertical velvet folds filling a box. */
function Folds({ width, fold }: { width: number; fold: number }) {
  return (
    <>
      {Array.from({ length: Math.ceil(width / fold) + 1 }, (_, i) => (
        <LinearGradient
          key={i}
          colors={FOLD}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: 'absolute', top: 0, bottom: 0, left: i * fold, width: fold }}
        />
      ))}
    </>
  );
}

/** One side curtain, drawn open towards the left edge and held by a gold tie-back. */
function Drape({ w, h, k, width, right }: SceneProps & { width: number; right?: boolean }) {
  const tieY = h * 0.6;
  const lower = width * 0.72;
  const fold = 30 * k;
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: right ? w - width : 0,
        width,
        height: h,
        transform: right ? [{ scaleX: -1 }] : undefined,
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height: tieY,
          overflow: 'hidden',
          borderBottomRightRadius: width * 0.85,
          boxShadow: `${6 * k}px 0 ${18 * k}px rgba(0,0,0,0.6)`,
        }}
      >
        <Folds width={width} fold={fold} />
        <LinearGradient
          colors={['rgba(255, 120, 120, 0.12)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: tieY - 2 * k,
          width: lower,
          height: h - tieY + 2 * k,
          overflow: 'hidden',
          borderTopRightRadius: Math.min(lower * 0.9, h - tieY),
          boxShadow: `${6 * k}px 0 ${18 * k}px rgba(0,0,0,0.6)`,
        }}
      >
        <Folds width={lower} fold={fold * 0.8} />
        <LinearGradient
          colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {/* Tie-back: a gold rope and its tassel */}
      <View
        style={{
          position: 'absolute',
          left: -4 * k,
          top: tieY - 6 * k,
          width: width * 0.32,
          height: 10 * k,
          borderRadius: 5 * k,
          backgroundColor: GOLD,
          borderWidth: Math.max(1, k),
          borderColor: '#7a5a10',
          boxShadow: `0 ${2 * k}px ${4 * k}px rgba(0,0,0,0.5)`,
        }}
      />
      <Dot x={width * 0.3} y={tieY + 1 * k} size={11 * k} color="#e0bb45" />
      <View
        style={{
          position: 'absolute',
          left: width * 0.3 - 5 * k,
          top: tieY + 5 * k,
          width: 10 * k,
          height: 26 * k,
          borderBottomLeftRadius: 4 * k,
          borderBottomRightRadius: 4 * k,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={['#f0cf5a', '#c9a227', '#8a6a12']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

/** The Strip: towers with lit windows, a pyramid and its beam, a tall tower and neon signs. */
function Skyline({ w, h, k, base, still }: SceneProps & { base: number; still?: boolean }) {
  const rand = random(23);
  const buildings: { x: number; bw: number; bh: number; c: string }[] = [];
  let x = -10 * k;
  while (x < w) {
    const bw = (26 + rand() * 46) * k;
    const bh = (0.08 + rand() * rand() * 0.24) * h;
    buildings.push({ x, bw, bh, c: ['#1c0912', '#240b18', '#160710'][Math.floor(rand() * 3)] });
    x += bw + rand() * 6 * k;
  }
  const windowColors = ['rgba(255, 214, 120, 0.85)', 'rgba(255, 170, 200, 0.75)', 'rgba(140, 220, 255, 0.7)'];
  const pyramid = { x: w * 0.27, bw: Math.min(170 * k, w * 0.3), bh: Math.min(110 * k, h * 0.14) };
  const tower = { x: w * 0.8, th: Math.min(h * 0.42, 380 * k) };
  return (
    <>
      {/* City glow */}
      <LinearGradient
        colors={['rgba(255, 90, 140, 0)', 'rgba(255, 90, 140, 0.16)', 'rgba(255, 170, 90, 0.28)']}
        style={{ position: 'absolute', left: 0, right: 0, top: base - h * 0.32, height: h * 0.32 }}
      />
      {/* The pyramid's light beam straight up into the sky */}
      <Loop
        motion="pulse"
        duration={4200}
        still={still}
        style={{
          position: 'absolute',
          left: pyramid.x - 3 * k,
          top: 0,
          width: 6 * k,
          height: base - pyramid.bh,
        }}
      >
        <LinearGradient
          colors={['rgba(230, 245, 255, 0)', 'rgba(230, 245, 255, 0.55)']}
          style={StyleSheet.absoluteFill}
        />
      </Loop>
      {/* Searchlights sweeping the sky */}
      {[0.12, 0.58, 0.93].map((sx, i) => (
        <Pivot
          key={sx}
          x={w * sx}
          y={base}
          width={30 * k}
          length={h * 0.7}
          amp={14}
          duration={9000 + i * 2300}
          delay={i * 3100}
          up
          still={still}
        >
          <LinearGradient
            colors={['rgba(255, 240, 210, 0)', 'rgba(255, 240, 210, 0.13)']}
            style={{ position: 'absolute', left: 9 * k, right: 9 * k, top: 0, bottom: 0 }}
          />
        </Pivot>
      ))}
      {buildings.map((b, i) => (
        <View
          key={`b${i}`}
          style={{
            position: 'absolute',
            left: b.x,
            top: base - b.bh,
            width: b.bw,
            height: b.bh,
            backgroundColor: b.c,
            borderTopWidth: Math.max(1, k),
            borderColor: 'rgba(255, 130, 170, 0.25)',
          }}
        />
      ))}
      {buildings.map((b, i) =>
        Array.from({ length: Math.round((b.bh / (14 * k)) * 1.6) }, (_, j) => {
          const cols = Math.max(2, Math.floor(b.bw / (8 * k)));
          const rows = Math.floor(b.bh / (10 * k)) - 1;
          if (rows < 1) return null;
          return (
            <View
              key={`w${i}-${j}`}
              style={{
                position: 'absolute',
                left: b.x + 4 * k + Math.floor(rand() * cols) * ((b.bw - 8 * k) / cols),
                top: base - b.bh + 6 * k + Math.floor(rand() * rows) * 10 * k,
                width: 3 * k,
                height: 4 * k,
                backgroundColor: windowColors[(i + j) % 7 === 0 ? 1 + (j % 2) : 0],
              }}
            />
          );
        }),
      )}
      {/* Observation wheel, turning slowly, its cabins lit */}
      {(() => {
        const R = Math.min(h * 0.1, w * 0.07);
        const cx = w * 0.71;
        const cy = base - R - 14 * k;
        return (
          <>
            <Line x1={cx} y1={cy} x2={cx - R * 0.55} y2={base} color="#2a1018" width={Math.max(1, 3 * k)} />
            <Line x1={cx} y1={cy} x2={cx + R * 0.55} y2={base} color="#2a1018" width={Math.max(1, 3 * k)} />
            <Loop
              motion="spin"
              duration={70000}
              still={still}
              style={{ position: 'absolute', left: cx - R, top: cy - R, width: R * 2, height: R * 2 }}
            >
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: R * 2,
                  height: R * 2,
                  borderRadius: R,
                  borderWidth: Math.max(1, 1.5 * k),
                  borderColor: 'rgba(255, 120, 190, 0.75)',
                  boxShadow: `0 0 ${8 * k}px rgba(255, 79, 163, 0.5)`,
                }}
              />
              {Array.from({ length: 8 }, (_, i) => (
                <View
                  key={`sp${i}`}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: R - 0.5,
                    width: R * 2,
                    height: 1,
                    backgroundColor: 'rgba(255, 170, 210, 0.35)',
                    transform: [{ rotate: `${i * 22.5}deg` }],
                  }}
                />
              ))}
              {Array.from({ length: 16 }, (_, i) => (
                <Dot
                  key={`cb${i}`}
                  x={R + R * Math.cos((i * Math.PI) / 8)}
                  y={R + R * Math.sin((i * Math.PI) / 8)}
                  size={4 * k}
                  color={i % 2 ? '#ffd166' : '#7ee0ff'}
                />
              ))}
            </Loop>
            <Dot x={cx} y={cy} size={6 * k} color="#ff9ccc" />
          </>
        );
      })()}
      {/* Pyramid */}
      <Tri x={pyramid.x} y={base} width={pyramid.bw} height={pyramid.bh} color="#0d0508" />
      <Line
        x1={pyramid.x - pyramid.bw / 2}
        y1={base}
        x2={pyramid.x}
        y2={base - pyramid.bh}
        color="rgba(255, 200, 120, 0.6)"
        width={Math.max(1, 1.2 * k)}
      />
      <Line
        x1={pyramid.x}
        y1={base - pyramid.bh}
        x2={pyramid.x + pyramid.bw / 2}
        y2={base}
        color="rgba(255, 200, 120, 0.35)"
        width={Math.max(1, 1.2 * k)}
      />
      {/* Tall tower with its pod and blinking aircraft light */}
      <View
        style={{
          position: 'absolute',
          left: tower.x - 5 * k,
          top: base - tower.th,
          width: 10 * k,
          height: tower.th,
          backgroundColor: '#12060c',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: tower.x - 22 * k,
          top: base - tower.th + 10 * k,
          width: 44 * k,
          height: 22 * k,
          borderRadius: 10 * k,
          backgroundColor: '#1d0a14',
          borderWidth: Math.max(1, k),
          borderColor: 'rgba(255, 130, 170, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'row',
          gap: 3 * k,
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{ width: 3 * k, height: 4 * k, backgroundColor: 'rgba(255, 214, 120, 0.8)' }}
          />
        ))}
      </View>
      <Line
        x1={tower.x}
        y1={base - tower.th + 10 * k}
        x2={tower.x}
        y2={base - tower.th - 34 * k}
        color="#2a1018"
        width={Math.max(1, 2 * k)}
      />
      <Loop
        motion="chase"
        duration={1600}
        still={still}
        style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }}
      >
        <Dot
          x={tower.x}
          y={base - tower.th - 35 * k}
          size={4 * k}
          color="#ff3b3b"
          style={{ boxShadow: `0 0 ${6 * k}px ${2 * k}px rgba(255, 59, 59, 0.8)` }}
        />
      </Loop>
      {/* Neon signs on the roofs, which flicker now and then */}
      {[
        { label: 'CASINO', at: 0.47, color: '#ff4fa3', d: 5200 },
        { label: 'HOTEL', at: 0.64, color: '#4cc9f0', d: 7400 },
        { label: '★ 777 ★', at: 0.36, color: '#ffd166', d: 6100 },
      ].map((sg) => {
        const b = buildings.find((bb) => bb.x + bb.bw > w * sg.at) ?? buildings[0];
        const sw = Math.max(b.bw + 10 * k, 64 * k);
        return (
          <Loop
            key={sg.label}
            motion="blink"
            duration={sg.d}
            delay={sg.d * 0.4}
            still={still}
            style={{
              position: 'absolute',
              left: b.x + b.bw / 2 - sw / 2,
              top: base - b.bh - 20 * k,
              width: sw,
              height: 18 * k,
              borderRadius: 4 * k,
              borderWidth: Math.max(1, 1.5 * k),
              borderColor: sg.color,
              backgroundColor: 'rgba(10, 2, 8, 0.85)',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 ${10 * k}px ${sg.color}`,
            }}
          >
            <Text
              style={{
                fontSize: 10 * k,
                fontWeight: '900',
                letterSpacing: 1.5 * k,
                color: '#fff6fb',
                textShadowColor: sg.color,
                textShadowRadius: 6 * k,
              }}
            >
              {sg.label}
            </Text>
          </Loop>
        );
      })}
    </>
  );
}

export function Curtain({ w, h, k }: SceneProps) {
  const still = tiny(w);
  const narrow = w < 560;
  const valance = 50 * k;
  const bulb = 22 * k;
  const stage = h * 0.86;
  const drapeW = narrow ? w * 0.3 : Math.min(w * 0.17, 280 * k);
  const rand = random(5);
  const fringe = stripes(3 * k, w, 'rgba(201, 162, 39, 0.9)', 0.45);
  const bulbs = Math.ceil(w / bulb);
  return (
    <>
      {/* Night sky over the Strip */}
      <LinearGradient
        colors={['#0c0208', '#1a0610', '#3a0c22']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: stage }}
      />
      {Array.from({ length: many(40, w) }, (_, i) => (
        <Dot
          key={`st${i}`}
          x={rand() * w}
          y={valance + rand() * h * 0.4}
          size={(0.8 + rand() * 1.4) * k}
          color={`rgba(255,255,255,${0.2 + rand() * 0.5})`}
        />
      ))}
      <Skyline w={w} h={h} k={k} base={stage} still={still} />

      {/* Stage floor and footlights */}
      <LinearGradient
        colors={['#3a1a0c', '#1e0c05', '#0a0302']}
        style={{ position: 'absolute', left: 0, right: 0, top: stage, bottom: 0 }}
      />
      {/* The city reflected on the polished stage, and its planks */}
      <LinearGradient
        colors={['rgba(255, 120, 160, 0.16)', 'rgba(255, 120, 160, 0)']}
        style={{ position: 'absolute', left: 0, right: 0, top: stage, height: (h - stage) * 0.8 }}
      />
      {[0.3, 0.62].map((t) => (
        <Line
          key={t}
          x1={0}
          y1={stage + (h - stage) * t}
          x2={w}
          y2={stage + (h - stage) * t}
          color="rgba(0,0,0,0.35)"
          width={Math.max(1, k)}
        />
      ))}
      <Line x1={0} y1={stage} x2={w} y2={stage} color={GOLD} width={Math.max(1, 2 * k)} />
      {Array.from({ length: Math.ceil(w / (60 * k)) }, (_, i) => (
        <View key={`fl${i}`}>
          <Glow x={(i + 0.5) * 60 * k} y={stage + 3 * k} size={14 * k} color="rgba(255, 210, 130, 0.22)" />
          <View
            style={{
              position: 'absolute',
              left: (i + 0.5) * 60 * k - 7 * k,
              top: stage + 2 * k,
              width: 14 * k,
              height: 6 * k,
              borderBottomLeftRadius: 7 * k,
              borderBottomRightRadius: 7 * k,
              backgroundColor: '#2a2a2a',
              borderTopWidth: 2 * k,
              borderColor: '#fff1c2',
            }}
          />
        </View>
      ))}

      <Drape w={w} h={h} k={k} width={drapeW} />
      <Drape w={w} h={h} k={k} width={drapeW} right />

      {/* Valance with swags, gold trim and fringe */}
      <LinearGradient
        colors={['#4a070c', '#8d0f16', '#6a0b11']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: valance }}
      />
      {Array.from({ length: Math.ceil(w / (valance * 1.4)) + 1 }, (_, i) => (
        <View
          key={`sc${i}`}
          style={{
            position: 'absolute',
            top: valance * 0.35,
            left: i * valance * 1.4 - valance * 0.2,
            width: valance * 1.4,
            height: valance * 0.95,
            borderBottomLeftRadius: valance * 0.7,
            borderBottomRightRadius: valance * 0.7,
            overflow: 'hidden',
            borderBottomWidth: 2.5 * k,
            borderColor: GOLD,
            boxShadow: `0 ${4 * k}px ${8 * k}px rgba(0,0,0,0.45)`,
          }}
        >
          <LinearGradient colors={['#6a0b11', '#a3121b', '#7a0d13']} style={StyleSheet.absoluteFill} />
          {/* Gathered folds of the swag */}
          {[0.35, 0.6, 0.82].map((t) => (
            <View
              key={t}
              style={{
                position: 'absolute',
                left: valance * 0.2,
                right: valance * 0.2,
                top: valance * 0.95 * t,
                height: Math.max(1, k),
                backgroundColor: 'rgba(0,0,0,0.25)',
                borderRadius: k,
              }}
            />
          ))}
        </View>
      ))}
      {Array.from({ length: Math.ceil(w / (valance * 1.4)) + 2 }, (_, i) => (
        <View key={`ta${i}`}>
          <Dot x={i * valance * 1.4 - valance * 0.2} y={valance * 1.28} size={7 * k} color="#e0bb45" />
          <View
            style={{
              position: 'absolute',
              left: i * valance * 1.4 - valance * 0.2 - 2.5 * k,
              top: valance * 1.3,
              width: 5 * k,
              height: 16 * k,
              borderBottomLeftRadius: 2 * k,
              borderBottomRightRadius: 2 * k,
              backgroundColor: GOLD,
            }}
          />
        </View>
      ))}
      <LinearGradient
        colors={fringe.colors}
        locations={fringe.locations}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', left: 0, right: 0, top: valance * 0.35 - 1 * k, height: 7 * k }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: valance * 0.35 - 3 * k,
          height: 3 * k,
          backgroundColor: GOLD,
        }}
      />
      {/* Marquee bulbs chasing along the top, in two alternating sets */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: valance * 0.35 - 3 * k,
          backgroundColor: '#2a0a04',
        }}
      />
      {[0, 1].map((set) => (
        <Loop
          key={`set${set}`}
          motion="chase"
          duration={1100}
          delay={set * 550}
          still={still}
          style={{ position: 'absolute', left: 0, top: 0, width: w, height: valance * 0.35 }}
        >
          {Array.from({ length: bulbs }, (_, i) =>
            i % 2 === set ? (
              <Dot
                key={i}
                x={i * bulb + bulb / 2}
                y={valance * 0.17}
                size={7 * k}
                color={set ? '#fff3b0' : '#ffd166'}
                style={{ boxShadow: `0 0 ${7 * k}px ${2.5 * k}px rgba(255, 209, 102, 0.75)` }}
              />
            ) : null,
          )}
        </Loop>
      ))}
      {/* A spotlight pool on the stage, and darker corners */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)']}
        style={{ position: 'absolute', left: 0, right: 0, top: h * 0.5, bottom: 0 }}
      />
    </>
  );
}
