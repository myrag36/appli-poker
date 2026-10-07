import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export type DecorId = 'poker' | 'blackjack' | 'president' | 'yams' | 'belote' | 'puissance4' | 'rami';

interface Size {
  w: number;
  h: number;
}

const GOLD = '#e8c766';

/** Small deterministic random generator, so a decor looks the same on every render. */
function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Glow({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        boxShadow: `0 0 ${size}px ${size * 0.7}px ${color}`,
      }}
    />
  );
}

/** A casino chip seen from above. */
function Chip({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: size * 0.12,
        borderColor: 'rgba(255,255,255,0.85)',
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
      }}
    >
      <View
        style={{
          width: size * 0.48,
          height: size * 0.48,
          borderRadius: size,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.6)',
        }}
      />
    </View>
  );
}

/** A pile of chips seen from the side. */
function ChipStack({ x, y, count, color }: { x: number; y: number; count: number; color: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: x - 17 + (i % 2) * 1.5,
            top: y - i * 5,
            width: 34,
            height: 9,
            borderRadius: 4,
            backgroundColor: color,
            borderTopWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.5)',
            borderStyle: 'dashed',
            boxShadow: '0 1px 2px rgba(0,0,0,0.45)',
          }}
        />
      ))}
    </>
  );
}

/** Faint repeated symbols, like a pattern woven into the cloth. */
function Pattern({
  w,
  h,
  step,
  symbols,
  color,
  size,
}: Size & { step: number; symbols: string[]; color: string; size: number }) {
  const rows = Math.ceil(h / step) + 1;
  const cols = Math.ceil(w / step) + 1;
  return (
    <>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (
          <Text
            key={`${r}-${c}`}
            style={{
              position: 'absolute',
              left: c * step + (r % 2 ? step / 2 : 0) - size / 2,
              top: r * step - size / 2,
              fontSize: size,
              color,
            }}
          >
            {symbols[(r + c) % symbols.length]}
          </Text>
        )),
      )}
    </>
  );
}

function Poker({ w, h }: Size) {
  return (
    <>
      <LinearGradient colors={['#2b9c63', '#13643c', '#0a3a22']} style={StyleSheet.absoluteFill} />
      <Pattern w={w} h={h} step={46} symbols={['♠', '♥', '♦', '♣']} color="rgba(0,0,0,0.07)" size={18} />
      <Glow x={w / 2} y={h * 0.3} size={w * 0.5} color="rgba(255,255,220,0.10)" />
      {/* The wooden rail and the gold line of a poker table. */}
      <View
        style={{
          position: 'absolute',
          left: -w * 0.3,
          top: h * 0.06,
          width: w * 1.6,
          height: h * 0.62,
          borderRadius: w,
          borderWidth: 14,
          borderColor: '#5b3518',
          boxShadow: 'inset 0 0 12px rgba(0,0,0,0.6), 0 0 10px rgba(0,0,0,0.5)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: -w * 0.3 + 26,
          top: h * 0.06 + 26,
          width: w * 1.6 - 52,
          height: h * 0.62 - 52,
          borderRadius: w,
          borderWidth: 1.5,
          borderColor: 'rgba(232,199,102,0.45)',
        }}
      />
      <ChipStack x={w * 0.17} y={h * 0.5} count={6} color="#c0392b" />
      <ChipStack x={w * 0.17 + 30} y={h * 0.52} count={4} color="#1f4e8c" />
      <ChipStack x={w * 0.83} y={h * 0.5} count={7} color="#222" />
      <Chip x={w * 0.72} y={h * 0.56} size={26} color="#2e8b57" />
      <Chip x={w * 0.3} y={h * 0.12} size={22} color="#c0392b" />
      <Chip x={w * 0.85} y={h * 0.16} size={24} color="#6c3fa0" />
    </>
  );
}

function Blackjack({ w, h }: Size) {
  const arc = (r: number, color: string, width: number) => (
    <View
      style={{
        position: 'absolute',
        left: w / 2 - r,
        top: h * 0.62 - 2 * r,
        width: 2 * r,
        height: 2 * r,
        borderRadius: r,
        borderWidth: width,
        borderColor: color,
      }}
    />
  );
  const rings = 5;
  return (
    <>
      <LinearGradient colors={['#a8283c', '#6e1324', '#3a0812']} style={StyleSheet.absoluteFill} />
      <Pattern w={w} h={h} step={34} symbols={['◆']} color="rgba(0,0,0,0.08)" size={10} />
      {/* The printed lines of a blackjack layout. */}
      {arc(w * 1.15, 'rgba(232,199,102,0.55)', 2)}
      {arc(w * 1.05, 'rgba(232,199,102,0.3)', 1)}
      {Array.from({ length: rings }, (_, i) => {
        const angle = Math.PI * (0.22 + (0.56 * i) / (rings - 1));
        const r = w * 0.98;
        const x = w / 2 + Math.cos(angle) * r * 0.62;
        const y = h * 0.62 - w * 1.15 + Math.sin(angle) * r + 4;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: x - 17,
              top: y - 17,
              width: 34,
              height: 34,
              borderRadius: 17,
              borderWidth: 2,
              borderColor: 'rgba(232,199,102,0.5)',
            }}
          />
        );
      })}
      {/* The bank's chip tray along the top edge. */}
      <View style={[styles.tray, { left: w * 0.18, width: w * 0.64 }]}>
        {['#c0392b', '#1f4e8c', '#2e8b57', '#222', '#6c3fa0', '#d4a017', '#c0392b', '#1f4e8c'].map((c, i) => (
          <View key={i} style={[styles.trayColumn, { backgroundColor: c }]} />
        ))}
      </View>
      <Text style={[styles.printed, { top: 44, width: w }]}>BLACKJACK PAIE 3 CONTRE 2</Text>
      <Text style={[styles.printedSmall, { top: 62, width: w }]}>LA BANQUE TIRE À 16 ET RESTE À 17</Text>
    </>
  );
}

function President({ w, h }: Size) {
  const rand = random(7);
  return (
    <>
      <LinearGradient colors={['#3b5bb0', '#1d3170', '#0c1636']} style={StyleSheet.absoluteFill} />
      <Pattern w={w} h={h} step={40} symbols={['⚜', '✦']} color="rgba(232,199,102,0.08)" size={18} />
      <Glow x={w / 2} y={h * 0.28} size={w * 0.55} color="rgba(255,215,120,0.13)" />
      {/* A big crown behind the cards. */}
      <Text style={[styles.crown, { top: h * 0.02, width: w }]}>♛</Text>
      {/* Golden frame with corner ornaments. */}
      <View style={styles.frame} />
      <View style={styles.frameInner} />
      {[
        [14, 12],
        [w - 32, 12],
        [14, h - 34],
        [w - 32, h - 34],
      ].map(([x, y], i) => (
        <Text key={i} style={[styles.corner, { left: x, top: y }]}>
          ❖
        </Text>
      ))}
      {/* Sparkles. */}
      {Array.from({ length: 14 }, (_, i) => (
        <Text
          key={i}
          style={{
            position: 'absolute',
            left: rand() * w,
            top: rand() * h * 0.6,
            fontSize: 6 + rand() * 10,
            color: `rgba(255,230,160,${0.25 + rand() * 0.45})`,
          }}
        >
          ✦
        </Text>
      ))}
    </>
  );
}

function Yams({ w, h }: Size) {
  const rand = random(3);
  const planks = 4;
  const plankWidth = w / planks;
  return (
    <>
      <LinearGradient colors={['#9a6735', '#6b4220', '#3d2410']} style={StyleSheet.absoluteFill} />
      {/* Wooden planks with seams and grain. */}
      {Array.from({ length: planks }, (_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: i * plankWidth,
            top: 0,
            width: plankWidth,
            height: h,
            backgroundColor: i % 2 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.03)',
            borderRightWidth: 2,
            borderColor: 'rgba(30,15,5,0.55)',
          }}
        />
      ))}
      {Array.from({ length: 34 }, (_, i) => {
        const x = rand() * w;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: Math.floor(x / plankWidth) * plankWidth + 6 + rand() * (plankWidth - 30),
              top: rand() * h,
              width: 1.2,
              height: 40 + rand() * 90,
              borderRadius: 1,
              backgroundColor: `rgba(40,20,5,${0.12 + rand() * 0.18})`,
              transform: [{ rotate: `${(rand() - 0.5) * 6}deg` }],
            }}
          />
        );
      })}
      {/* The felt dice tray. */}
      <View
        style={{
          position: 'absolute',
          left: w * 0.08,
          top: h * 0.12,
          width: w * 0.84,
          height: h * 0.38,
          borderRadius: 22,
          borderWidth: 9,
          borderColor: '#3a210c',
          backgroundColor: '#1d6b45',
          boxShadow: 'inset 0 0 18px rgba(0,0,0,0.6), 0 4px 10px rgba(0,0,0,0.5)',
        }}
      />
      {/* Score pad and pencil. */}
      <View style={[styles.pad, { left: w - 74, top: -14 }]}>
        <Text style={styles.padTitle}>YAMS</Text>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={styles.padLine} />
        ))}
      </View>
      <View style={[styles.pencil, { left: w - 110, top: 34 }]} />
    </>
  );
}

function Belote({ w, h }: Size) {
  const step = 26;
  const cols = Math.ceil(w / step) + 1;
  const rows = Math.ceil(h / step) + 1;
  return (
    <>
      <LinearGradient colors={['#b8303d', '#8e1f2b', '#55101a']} style={StyleSheet.absoluteFill} />
      {/* Bistro gingham tablecloth. */}
      {Array.from({ length: cols }, (_, i) =>
        i % 2 ? null : (
          <View
            key={`c${i}`}
            style={{
              position: 'absolute',
              left: i * step,
              top: 0,
              width: step,
              height: h,
              backgroundColor: 'rgba(255,255,255,0.13)',
            }}
          />
        ),
      )}
      {Array.from({ length: rows }, (_, i) =>
        i % 2 ? null : (
          <View
            key={`r${i}`}
            style={{
              position: 'absolute',
              left: 0,
              top: i * step,
              width: w,
              height: step,
              backgroundColor: 'rgba(255,255,255,0.13)',
            }}
          />
        ),
      )}
      {/* The chalk slate where the scores are kept. */}
      <View style={[styles.slate, { left: -10, top: 14 }]}>
        <Text style={styles.chalk}>Nous 320</Text>
        <Text style={styles.chalk}>Eux 280</Text>
        <View style={styles.chalkLine} />
      </View>
      {/* A glass of wine and its ring on the cloth. */}
      <View style={[styles.ring, { left: w - 68, top: 22 }]} />
      <View style={[styles.glass, { left: w - 58, top: 6 }]}>
        <View style={styles.wine} />
      </View>
    </>
  );
}

function Puissance4({ w, h }: Size) {
  // The blue board, slightly tilted and still empty: the tokens of the card art fall into it.
  const cols = 7;
  const rows = 5;
  const cell = Math.round((w * 0.92) / cols);
  return (
    <>
      <LinearGradient colors={['#3a7bd5', '#22489c', '#101f4d']} style={StyleSheet.absoluteFill} />
      <Pattern w={w} h={h} step={38} symbols={['●']} color="rgba(255,255,255,0.05)" size={12} />
      <View
        style={{
          position: 'absolute',
          left: w / 2 - (cols * cell) / 2,
          top: h * 0.05,
          width: cols * cell,
          height: rows * cell,
          padding: 4,
          flexDirection: 'row',
          borderRadius: 14,
          backgroundColor: '#1f5fd1',
          borderWidth: 2,
          borderColor: '#5d93ff',
          transform: [{ rotate: '-6deg' }],
          boxShadow: '0 8px 18px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.35)',
        }}
      >
        {Array.from({ length: cols }, (_, c) => (
          <View key={c} style={{ flex: 1 }}>
            {Array.from({ length: rows }, (_, r) => {
              const size = cell * 0.7;
              return (
                <View key={r} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <View
                    style={{
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                      backgroundColor: 'rgba(6,18,50,0.8)',
                      boxShadow: 'inset 0 3px 5px rgba(0,0,0,0.6)',
                    }}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
      {/* Soft light on the board, so the tokens in front stand out. */}
      <Glow x={w / 2} y={h * 0.3} size={w * 0.4} color="rgba(255,255,255,0.08)" />
    </>
  );
}

/** A tiny face-up card for the decors: rank and suit only. */
function MiniCard({
  x,
  y,
  label,
  red,
  rotate = 0,
}: {
  x: number;
  y: number;
  label: string;
  red?: boolean;
  rotate?: number;
}) {
  return (
    <View style={[styles.mini, { left: x, top: y, transform: [{ rotate: `${rotate}deg` }] }]}>
      <Text style={[styles.miniText, { color: red ? '#c1121f' : '#111' }]}>{label}</Text>
    </View>
  );
}

function Rami({ w, h }: Size) {
  // Melds already laid down on a Provençal tablecloth, a cup of coffee beside them.
  const melds: { cards: string[]; red: boolean; x: number; y: number; rotate: number }[] = [
    { cards: ['5♣', '6♣', '7♣', '8♣'], red: false, x: 14, y: 22, rotate: -6 },
    { cards: ['9♦', '10♦', 'J♦'], red: true, x: w * 0.5, y: h * 0.47, rotate: -3 },
  ];
  return (
    <>
      <LinearGradient colors={['#2f5fa8', '#1f437e', '#122849']} style={StyleSheet.absoluteFill} />
      <Pattern w={w} h={h} step={38} symbols={['✿', '❀']} color="rgba(255,214,90,0.16)" size={16} />
      <Pattern w={w} h={h} step={76} symbols={['•']} color="rgba(255,255,255,0.12)" size={10} />
      {/* A border of the cloth, like on printed Provençal fabric. */}
      <View style={[styles.clothBand, { top: h * 0.4, width: w }]} />
      <Glow x={w / 2} y={h * 0.32} size={w * 0.45} color="rgba(255,230,160,0.10)" />
      {melds.map((m, i) => (
        <View
          key={i}
          style={{ position: 'absolute', left: m.x, top: m.y, transform: [{ rotate: `${m.rotate}deg` }] }}
        >
          {m.cards.map((c, j) => (
            <MiniCard key={j} x={j * 19} y={0} label={c} red={m.red} />
          ))}
        </View>
      ))}
      {/* The coffee cup and its saucer, seen from above. */}
      <View style={[styles.saucer, { left: w - 78, top: 18 }]}>
        <View style={styles.cup}>
          <View style={styles.coffee} />
        </View>
      </View>
      <View style={[styles.handle, { left: w - 26, top: 50 }]} />
    </>
  );
}

const DECORS: Record<DecorId, (size: Size) => ReactNode> = {
  poker: Poker,
  blackjack: Blackjack,
  president: President,
  yams: Yams,
  belote: Belote,
  puissance4: Puissance4,
  rami: Rami,
};

/** The illustrated background of a game's card in the carousel. */
export function GameDecor({ id, width, height }: { id: DecorId; width: number; height: number }) {
  const Decor = DECORS[id];
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
      <Decor w={width} h={height} />
      {/* Darken the bottom so the title and text stay readable. */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.82)']}
        locations={[0.42, 0.66, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  tray: {
    position: 'absolute',
    top: -6,
    height: 34,
    flexDirection: 'row',
    gap: 3,
    padding: 4,
    paddingTop: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(20,10,5,0.75)',
    boxShadow: '0 3px 6px rgba(0,0,0,0.5)',
  },
  trayColumn: {
    flex: 1,
    borderRadius: 3,
    borderTopWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    borderStyle: 'dashed',
  },
  printed: {
    position: 'absolute',
    left: 0,
    textAlign: 'center',
    color: 'rgba(232,199,102,0.75)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  printedSmall: {
    position: 'absolute',
    left: 0,
    textAlign: 'center',
    color: 'rgba(232,199,102,0.5)',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  crown: {
    position: 'absolute',
    left: 0,
    textAlign: 'center',
    fontSize: 150,
    color: 'rgba(232,199,102,0.16)',
  },
  frame: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(232,199,102,0.55)',
  },
  frameInner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: 'rgba(232,199,102,0.3)',
  },
  corner: { position: 'absolute', fontSize: 16, color: GOLD },
  pad: {
    position: 'absolute',
    width: 70,
    height: 92,
    paddingTop: 20,
    paddingHorizontal: 8,
    gap: 9,
    backgroundColor: '#f6f1e2',
    borderRadius: 3,
    transform: [{ rotate: '9deg' }],
    boxShadow: '0 3px 6px rgba(0,0,0,0.45)',
  },
  padTitle: { color: '#b33', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  padLine: { height: 1, backgroundColor: 'rgba(60,90,160,0.35)' },
  pencil: {
    position: 'absolute',
    width: 70,
    height: 6,
    borderRadius: 2,
    backgroundColor: '#f2b705',
    borderRightWidth: 8,
    borderRightColor: '#e8b88a',
    transform: [{ rotate: '-28deg' }],
    boxShadow: '0 2px 3px rgba(0,0,0,0.4)',
  },
  slate: {
    position: 'absolute',
    width: 104,
    height: 70,
    paddingTop: 12,
    paddingLeft: 22,
    gap: 2,
    backgroundColor: '#263027',
    borderWidth: 5,
    borderColor: '#7a4f28',
    borderRadius: 4,
    transform: [{ rotate: '-7deg' }],
    boxShadow: '0 3px 6px rgba(0,0,0,0.5)',
  },
  chalk: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600', fontStyle: 'italic' },
  chalkLine: { width: 60, height: 1, backgroundColor: 'rgba(255,255,255,0.4)', marginTop: 3 },
  ring: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2.5,
    borderColor: 'rgba(90,10,30,0.4)',
  },
  glass: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 3px 6px rgba(0,0,0,0.35)',
  },
  mini: {
    position: 'absolute',
    width: 26,
    height: 36,
    borderRadius: 3,
    backgroundColor: '#fbf7ec',
    borderWidth: 0.5,
    borderColor: '#cfc5a8',
    paddingLeft: 3,
    paddingTop: 1,
    boxShadow: '0 2px 3px rgba(0,0,0,0.45)',
  },
  miniText: { fontSize: 10, fontWeight: '800' },
  clothBand: {
    position: 'absolute',
    left: 0,
    height: 14,
    backgroundColor: 'rgba(255,214,90,0.13)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,214,90,0.3)',
  },
  saucer: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#f2eee4',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 8px rgba(0,0,0,0.45)',
  },
  cup: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#d9d2c2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coffee: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4a2a14',
    borderWidth: 2,
    borderColor: '#7a4a26',
  },
  handle: {
    position: 'absolute',
    width: 16,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#fff',
    transform: [{ rotate: '30deg' }],
  },
  wine: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(110,10,35,0.85)' },
});
