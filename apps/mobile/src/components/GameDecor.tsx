import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { t } from '../i18n';

export type DecorId =
  | 'poker'
  | 'blackjack'
  | 'president'
  | 'yams'
  | 'belote'
  | 'puissance4'
  | 'bataille'
  | 'rami'
  | 'uno'
  | 'huit'
  | 'tarot'
  | 'perudo'
  | 'dames';

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
      <Text style={[styles.printed, { top: 44, width: w }]}>{t('BLACKJACK PAIE 3 CONTRE 2')}</Text>
      <Text style={[styles.printedSmall, { top: 62, width: w }]}>
        {t('LA BANQUE TIRE À 16 ET RESTE À 17')}
      </Text>
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
        <Text style={styles.chalk}>{t('Nous {n}', { n: 320 })}</Text>
        <Text style={styles.chalk}>{t('Eux {n}', { n: 280 })}</Text>
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

function Bataille({ w, h }: Size) {
  // Open sea under a night sky: waves, a lighthouse beam and a few distant ships.
  return (
    <>
      <LinearGradient colors={['#0b2a4f', '#0f4c81', '#062440']} style={StyleSheet.absoluteFill} />
      <Pattern w={w} h={h} step={34} symbols={['〰', '∿']} color="rgba(190,230,255,0.08)" size={16} />
      <Glow x={w * 0.8} y={h * 0.1} size={w * 0.3} color="rgba(255,240,200,0.12)" />
      {['⛴', '🚢', '⚓'].map((s, i) => (
        <Text
          key={s}
          style={{
            position: 'absolute',
            left: w * (0.08 + i * 0.36),
            top: h * (0.04 + (i % 2) * 0.05),
            fontSize: 22,
            opacity: 0.35,
          }}
        >
          {s}
        </Text>
      ))}
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

function Uno({ w, h }: Size) {
  const rand = random(11);
  const paints = ['#e0312f', '#f6b81c', '#2f9e44', '#1f6fd1'];
  return (
    <>
      <LinearGradient colors={['#2a1f5c', '#1a1440', '#0c0a22']} style={StyleSheet.absoluteFill} />
      {/* Four big tilted ovals in the card colors, coming in from the corners. */}
      {[
        [-w * 0.25, -h * 0.08],
        [w * 0.62, -h * 0.12],
        [-w * 0.3, h * 0.42],
        [w * 0.66, h * 0.38],
      ].map(([x, y], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: w * 0.62,
            height: w * 0.62,
            borderRadius: w,
            backgroundColor: paints[i],
            opacity: 0.85,
            transform: [{ rotate: '-28deg' }, { scaleY: 1.45 }],
            boxShadow: `0 0 40px ${paints[i]}`,
          }}
        />
      ))}
      <Glow x={w / 2} y={h * 0.3} size={w * 0.5} color="rgba(255,255,255,0.10)" />
      {/* Confetti of card symbols. */}
      {Array.from({ length: 16 }, (_, i) => (
        <Text
          key={i}
          style={{
            position: 'absolute',
            left: rand() * (w - 20),
            top: rand() * h * 0.55,
            fontSize: 12 + rand() * 12,
            fontWeight: '900',
            fontStyle: 'italic',
            color: `rgba(255,255,255,${0.25 + rand() * 0.35})`,
            transform: [{ rotate: `${(rand() - 0.5) * 50}deg` }],
          }}
        >
          {['+2', '⇄', '⊘', '+4', '7', '★'][i % 6]}
        </Text>
      ))}
    </>
  );
}

function Huit({ w, h }: Size) {
  const rand = random(8);
  const square = 18;
  const cols = Math.ceil(w / square);
  return (
    <>
      <LinearGradient colors={['#0f5560', '#0b3a44', '#062027']} style={StyleSheet.absoluteFill} />
      {/* A diner's checkerboard strip along the top. */}
      {Array.from({ length: cols * 2 }, (_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        return (r + c) % 2 ? null : (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: c * square,
              top: r * square,
              width: square,
              height: square,
              backgroundColor: 'rgba(255,255,255,0.16)',
            }}
          />
        );
      })}
      {/* Stars, red, white and blue. */}
      {Array.from({ length: 18 }, (_, i) => (
        <Text
          key={i}
          style={{
            position: 'absolute',
            left: rand() * (w - 16),
            top: square * 2 + 6 + rand() * h * 0.5,
            fontSize: 8 + rand() * 12,
            color: ['rgba(255,90,95,0.55)', 'rgba(255,255,255,0.45)', 'rgba(110,170,255,0.55)'][i % 3],
          }}
        >
          ★
        </Text>
      ))}
      {/* A pink neon 8 on the wall. */}
      <View style={[styles.neonRing, { left: w / 2 - 70, top: h * 0.1 }]} />
      <Text style={[styles.neonEight, { top: h * 0.1 - 6, width: w }]}>8</Text>
    </>
  );
}

function Tarot({ w, h }: Size) {
  const rand = random(21);
  return (
    <>
      <LinearGradient colors={['#4a3485', '#261a57', '#0f0b2a']} style={StyleSheet.absoluteFill} />
      {/* A starry night sky. */}
      {Array.from({ length: 34 }, (_, i) => {
        const size = 1.5 + rand() * 2.5;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: rand() * w,
              top: rand() * h * 0.6,
              width: size,
              height: size,
              borderRadius: size,
              backgroundColor: `rgba(255,240,200,${0.35 + rand() * 0.5})`,
            }}
          />
        );
      })}
      <Glow x={w * 0.76} y={h * 0.15} size={w * 0.28} color="rgba(255,230,160,0.12)" />
      {/* The crescent moon: a gold disc with a night-coloured one over it. */}
      <View style={[styles.moon, { left: w * 0.68, top: h * 0.06 }]} />
      <View style={[styles.moonShade, { left: w * 0.68 + 14, top: h * 0.06 - 6 }]} />
      <Text style={[styles.arcane, { width: w, top: h * 0.02 }]}>XXI</Text>
      {/* The laurel wreath of the 21, as on the old decks. */}
      <View style={[styles.wreath, { left: w * 0.08, top: h * 0.08 }]}>
        <Text style={styles.wreathStar}>✦</Text>
      </View>
      <Pattern w={w} h={h} step={58} symbols={['✦', '☾', '★']} color="rgba(232,199,102,0.07)" size={14} />
    </>
  );
}

function Perudo({ w, h }: Size) {
  // A tavern table: dark red leather, dice cups upside down, a few dice left out.
  const cups = [
    { x: 0.14, y: 0.12, s: 64 },
    { x: 0.66, y: 0.06, s: 76 },
    { x: 0.42, y: 0.34, s: 52 },
  ];
  return (
    <>
      <LinearGradient colors={['#8c2f1c', '#5a1a0f', '#2c0b06']} style={StyleSheet.absoluteFill} />
      <Pattern
        w={w}
        h={h}
        step={54}
        symbols={['⚀', '?', '⚅', '?']}
        color="rgba(255,220,180,0.06)"
        size={20}
      />
      <Glow x={w / 2} y={h * 0.28} size={w * 0.55} color="rgba(255,190,120,0.12)" />
      {cups.map((c, i) => (
        <View key={i} style={{ position: 'absolute', left: c.x * w, top: c.y * h, alignItems: 'center' }}>
          <View
            style={{
              width: c.s * 0.8,
              height: c.s * 0.85,
              borderTopLeftRadius: c.s * 0.2,
              borderTopRightRadius: c.s * 0.2,
              overflow: 'hidden',
              boxShadow: '0 6px 12px rgba(0,0,0,0.55)',
            }}
          >
            <LinearGradient colors={['#b5653a', '#6e3218', '#3a160a']} style={StyleSheet.absoluteFill} />
            <View
              style={{
                position: 'absolute',
                top: c.s * 0.2,
                left: 0,
                right: 0,
                height: 3,
                backgroundColor: 'rgba(232,199,102,0.7)',
              }}
            />
          </View>
          <View
            style={{ width: c.s, height: 8, borderRadius: 4, backgroundColor: '#1e0904', marginTop: -1 }}
          />
        </View>
      ))}
    </>
  );
}

function Dames({ w, h }: Size) {
  // A games table in a wooden study: a checkerboard pattern, warm lamp light, a few loose pieces.
  const pieces = [
    { x: 0.12, y: 0.08, s: 30, white: true },
    { x: 0.78, y: 0.05, s: 34, white: false },
    { x: 0.86, y: 0.3, s: 26, white: true },
    { x: 0.06, y: 0.34, s: 28, white: false },
  ];
  const step = 26;
  return (
    <>
      <LinearGradient colors={['#7a4a26', '#4e2c14', '#2a160a']} style={StyleSheet.absoluteFill} />
      {Array.from({ length: Math.ceil(h / step) }, (_, r) =>
        Array.from({ length: Math.ceil(w / step) }, (_, c) =>
          (r + c) % 2 ? (
            <View
              key={`${r}-${c}`}
              style={{
                position: 'absolute',
                left: c * step,
                top: r * step,
                width: step,
                height: step,
                backgroundColor: 'rgba(255,225,180,0.05)',
              }}
            />
          ) : null,
        ),
      )}
      <Glow x={w / 2} y={h * 0.25} size={w * 0.5} color="rgba(255,200,130,0.12)" />
      {pieces.map((p, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: p.x * w,
            top: p.y * h,
            width: p.s,
            height: p.s,
            borderRadius: p.s / 2,
            backgroundColor: p.white ? '#f4ecda' : '#2e2420',
            borderWidth: p.s * 0.1,
            borderColor: p.white ? '#d8c7a4' : '#4a3a33',
            opacity: 0.55,
            boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
          }}
        />
      ))}
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
  bataille: Bataille,
  rami: Rami,
  uno: Uno,
  huit: Huit,
  tarot: Tarot,
  perudo: Perudo,
  dames: Dames,
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
  neonRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: 'rgba(255,120,200,0.8)',
    boxShadow: '0 0 18px rgba(255,90,190,0.9), inset 0 0 18px rgba(255,90,190,0.6)',
  },
  neonEight: {
    position: 'absolute',
    left: 0,
    textAlign: 'center',
    fontSize: 130,
    lineHeight: 150,
    fontWeight: '200',
    color: 'rgba(255,200,235,0.9)',
    textShadowColor: 'rgba(255,60,180,1)',
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  moon: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#f3d77a',
    boxShadow: '0 0 24px rgba(255,220,120,0.55)',
  },
  moonShade: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: '#45307d' },
  arcane: {
    position: 'absolute',
    left: 0,
    textAlign: 'center',
    fontSize: 96,
    fontWeight: '900',
    fontFamily: 'Georgia, "Times New Roman", serif',
    color: 'rgba(232,199,102,0.10)',
    letterSpacing: 6,
  },
  wreath: {
    position: 'absolute',
    width: 54,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: 'rgba(120,190,110,0.55)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wreathStar: { color: 'rgba(232,199,102,0.7)', fontSize: 20 },
});
