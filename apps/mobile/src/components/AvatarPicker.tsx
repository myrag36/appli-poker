import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AVATAR_COLORS, AVATAR_EMOJIS, REWARDS, type Avatar } from '@appli-poker/engine';
import { colors, shadow } from '../theme';

const native = Platform.OS !== 'web';

type Stops = readonly [string, string, ...string[]];

/** How each frame is drawn: a gradient ring, an optional glow and an optional animation. */
interface FrameLook {
  /** Ring colors, drawn diagonally, or across a spinning ring. */
  ring: Stops;
  /** Color of the halo around the ring. */
  glow?: string;
  motion?: 'spin' | 'pulse' | 'flicker';
  /** Small shapes drawn on the ring. */
  gems?: string;
  crown?: boolean;
  flames?: boolean;
  frost?: boolean;
  /** Twinkling stars around the frame; a color string tints their glow (gold by default). */
  sparkles?: boolean | string;
  /** Cherry blossoms resting on the ring. */
  petals?: boolean;
  /** Air bubbles rising along the ring. */
  bubbles?: boolean;
  /** Glowing drops dripping from the bottom of the ring. */
  drips?: string;
  /** Dark wisps of smoke curling around the ring. */
  smoke?: boolean;
  /** Tiny stars scattered over the ring itself. */
  stars?: boolean;
  /** Ring stops with hard edges, like the cut faces of a gem. */
  facets?: boolean;
}

const FRAMES: Record<string, FrameLook> = {
  bronze: { ring: ['#f6c79a', '#c07a3e', '#7a4318', '#d9955a', '#8e4f20'] },
  silver: { ring: ['#ffffff', '#c9ced6', '#7d8590', '#eef1f5', '#9aa1ab'] },
  gold: { ring: ['#fff4c2', '#f2c24b', '#9a6a10', '#ffe17a', '#b8860b'], glow: 'rgba(255, 200, 60, 0.45)' },
  emerald: {
    ring: ['#b8ffd9', '#1fbf75', '#065c35', '#3ee59a', '#0a7a45'],
    glow: 'rgba(40, 220, 140, 0.4)',
    gems: '#7dffc0',
  },
  ruby: {
    ring: ['#ffc2cc', '#e0233f', '#6e0614', '#ff4d6a', '#99001a'],
    glow: 'rgba(255, 40, 80, 0.4)',
    gems: '#ff9aab',
  },
  neon: {
    ring: ['#ff3cac', '#c13cff', '#2b86ff', '#00f0ff', '#ff3cac'],
    glow: 'rgba(0, 230, 255, 0.85)',
    motion: 'pulse',
  },
  fire: {
    ring: ['#fff27a', '#ffb000', '#ff5e00', '#d61f00', '#ff8a00'],
    glow: 'rgba(255, 110, 0, 0.8)',
    motion: 'flicker',
    flames: true,
  },
  ice: {
    ring: ['#ffffff', '#c8efff', '#5cc3f2', '#e9fbff', '#8ad6fb'],
    glow: 'rgba(150, 225, 255, 0.6)',
    frost: true,
  },
  rainbow: {
    ring: ['#ff4d4d', '#ffb84d', '#fff14d', '#4dff88', '#4dc3ff', '#9b6bff', '#ff4dd2'],
    glow: 'rgba(255, 255, 255, 0.35)',
    motion: 'spin',
  },
  crown: {
    ring: ['#fff4c2', '#f2c24b', '#9a6a10', '#ffe17a', '#b8860b'],
    glow: 'rgba(255, 200, 60, 0.55)',
    crown: true,
  },
  legend: {
    ring: ['#fff6c9', '#ffd700', '#ff6ec7', '#ffd700', '#7afcff', '#ffd700', '#ff9a3c', '#fff6c9'],
    glow: 'rgba(255, 215, 80, 0.85)',
    motion: 'spin',
    sparkles: true,
  },
  // ---- Shop frames ----
  sakura: {
    ring: ['#ffe4ef', '#ff9cc2', '#e05a8f', '#ffc2da', '#c93d76'],
    glow: 'rgba(255, 140, 190, 0.6)',
    petals: true,
  },
  lagoon: {
    ring: ['#d4fff8', '#3fe0d0', '#0a8f9e', '#7ff5e6', '#05616e'],
    glow: 'rgba(40, 220, 210, 0.55)',
    bubbles: true,
  },
  toxic: {
    ring: ['#f2ff8a', '#9dff00', '#2f9e00', '#c8ff3d', '#1d6b00'],
    glow: 'rgba(160, 255, 0, 0.95)',
    motion: 'pulse',
    drips: '#b6ff1f',
  },
  shadow: {
    ring: ['#6b4a9e', '#2a1745', '#07030d', '#4b2d7a', '#000000'],
    glow: 'rgba(110, 40, 190, 0.9)',
    motion: 'flicker',
    smoke: true,
  },
  galaxy: {
    ring: ['#ff6ad5', '#7b3cff', '#14105e', '#2b86ff', '#0a0630', '#c13cff', '#ff6ad5'],
    glow: 'rgba(140, 90, 255, 0.85)',
    motion: 'spin',
    stars: true,
    sparkles: 'rgba(150, 120, 255, 1)',
  },
  diamond: {
    ring: ['#ffffff', '#c9f1ff', '#ffffff', '#8fd8f5', '#f4fdff', '#b5e9ff', '#ffffff', '#7cc9ea'],
    glow: 'rgba(190, 240, 255, 0.95)',
    motion: 'spin',
    facets: true,
    gems: '#f2fcff',
    sparkles: 'rgba(120, 210, 255, 1)',
  },
};

/** A faceted ring repeats every color twice, so each one keeps a flat band with hard edges. */
function facetColors(ring: Stops) {
  return ring.flatMap((c) => [c, c]) as unknown as Stops;
}

function facetLocations(n: number) {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i / n, (i + 1) / n);
  return out as unknown as readonly [number, number, ...number[]];
}

const DURATIONS = { spin: 6000, pulse: 1800, flicker: 1100 };

/** One looping value from 0 to 1 for animated frames; nothing runs for static ones. */
function useLoop(motion: FrameLook['motion']) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion) return;
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: DURATIONS[motion],
        easing: Easing.linear,
        useNativeDriver: native,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [t, motion]);
  return t;
}

/** A round avatar: an emoji on a colored disc, with its frame and level when it has them. */
export function AvatarBadge({ avatar, size = 44 }: { avatar: Avatar; size?: number }) {
  const look = avatar.frame ? FRAMES[avatar.frame] : undefined;
  const t = useLoop(look?.motion);
  const chip =
    typeof avatar.level === 'number' && size >= 26 ? <LevelChip level={avatar.level} size={size} /> : null;

  if (!look) {
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={[
            styles.badge,
            shadow,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: avatar.color },
          ]}
        >
          <Text style={{ fontSize: size * 0.55 }}>{avatar.emoji}</Text>
        </View>
        {chip}
      </View>
    );
  }

  // The ring sticks out a little and eats a little into the disc, so the box stays size x size.
  const thick = Math.max(2.5, size * 0.11);
  const out = Math.max(1, size * 0.045);
  const outer = size + out * 2;
  const inset = thick - out;
  const disc = size - inset * 2;

  const spin = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const glowOpacity =
    look.motion === 'pulse'
      ? t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 1, 0.45] })
      : look.motion === 'flicker'
        ? t.interpolate({
            inputRange: [0, 0.2, 0.45, 0.6, 0.85, 1],
            outputRange: [0.7, 1, 0.6, 0.95, 0.75, 0.7],
          })
        : look.sparkles
          ? t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0.6, 1, 0.6, 1, 0.6] })
          : 1;
  const ringBox = { left: -out, top: -out, width: outer, height: outer, borderRadius: outer / 2 };

  return (
    <View style={{ width: size, height: size }}>
      {look.glow && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.abs,
            ringBox,
            {
              opacity: glowOpacity,
              boxShadow: `0 0 ${Math.max(3, size * 0.16)}px ${Math.max(1, size * 0.03)}px ${look.glow}`,
            },
          ]}
        />
      )}
      <View style={[styles.abs, ringBox, styles.ring, shadow]}>
        {look.motion === 'spin' ? (
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: spin }] }]}>
            <LinearGradient
              colors={look.facets ? facetColors(look.ring) : look.ring}
              locations={look.facets ? facetLocations(look.ring.length) : undefined}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            {look.facets && (
              <LinearGradient
                colors={facetColors(look.ring)}
                locations={facetLocations(look.ring.length)}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={[StyleSheet.absoluteFill, styles.facetCross]}
              />
            )}
            {look.stars && size >= 30 && <RingStars size={outer} />}
          </Animated.View>
        ) : (
          <LinearGradient
            colors={look.ring}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {/* A soft highlight on the top half makes the ring look rounded. */}
        <LinearGradient
          colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.18)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {look.smoke && size >= 30 && <Smoke size={size} t={t} />}
      {look.gems && size >= 36 && <Gems size={size} out={out} thick={thick} color={look.gems} />}
      <View
        style={[
          styles.abs,
          styles.disc,
          {
            left: inset,
            top: inset,
            width: disc,
            height: disc,
            borderRadius: disc / 2,
            backgroundColor: avatar.color,
            borderWidth: Math.max(1, size * 0.018),
          },
        ]}
      >
        <Text style={{ fontSize: disc * 0.6 }}>{avatar.emoji}</Text>
      </View>
      {look.frost && size >= 36 && <Frost size={size} />}
      {look.flames && size >= 30 && <Flames size={size} t={t} />}
      {look.bubbles && size >= 30 && <Bubbles size={size} />}
      {look.drips && size >= 30 && <Drips size={size} color={look.drips} />}
      {look.petals && size >= 30 && <Petals size={size} />}
      {look.sparkles && size >= 30 && (
        <Sparkles size={size} t={t} glow={typeof look.sparkles === 'string' ? look.sparkles : undefined} />
      )}
      {look.crown && <Crown size={size} />}
      {chip}
    </View>
  );
}

/** Four little cut stones set into the ring. */
function Gems({ size, out, thick, color }: { size: number; out: number; thick: number; color: string }) {
  const g = Math.max(4, size * 0.09);
  const mid = (thick - 2 * out) / 2; // center of the ring, from the box edge
  const c = size / 2 - g / 2;
  const spots = [
    { left: c, top: mid - g / 2 + 0.5 },
    { left: c, top: size - mid - g / 2 - 0.5 },
    { left: mid - g / 2 + 0.5, top: c },
    { left: size - mid - g / 2 - 0.5, top: c },
  ];
  return (
    <>
      {spots.map((p, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={[
            styles.abs,
            styles.gem,
            { ...p, width: g, height: g, backgroundColor: color, transform: [{ rotate: '45deg' }] },
          ]}
        >
          <View style={[styles.gemShine, { width: g * 0.45, height: g * 0.45 }]} />
        </View>
      ))}
    </>
  );
}

function Crown({ size }: { size: number }) {
  const f = Math.max(11, size * 0.38);
  return (
    <Text
      pointerEvents="none"
      style={[
        styles.abs,
        styles.centered,
        { fontSize: f, lineHeight: f * 1.15, top: -f * 0.72, left: 0, right: 0 },
        { transform: [{ rotate: '-8deg' }] },
      ]}
    >
      👑
    </Text>
  );
}

function Frost({ size }: { size: number }) {
  const f = size * 0.2;
  return (
    <>
      <Text style={[styles.abs, styles.frost, { fontSize: f, left: -f * 0.15, top: -f * 0.2 }]}>❄</Text>
      <Text style={[styles.abs, styles.frost, { fontSize: f * 0.7, right: f * 0.05, top: -f * 0.35 }]}>
        ✦
      </Text>
      <Text style={[styles.abs, styles.frost, { fontSize: f * 0.6, left: f * 0.1, bottom: f * 0.05 }]}>
        ✦
      </Text>
    </>
  );
}

/** Three small flames dancing on top of the ring. */
function Flames({ size, t }: { size: number; t: Animated.Value }) {
  const f = size * 0.26;
  const spots = [
    { left: size * 0.12, top: -f * 0.45, rotate: '-30deg', phase: 0 },
    { left: size / 2 - f / 2, top: -f * 0.75, rotate: '0deg', phase: 1 },
    { left: size * 0.88 - f, top: -f * 0.45, rotate: '30deg', phase: 2 },
  ];
  return (
    <>
      {spots.map((s) => {
        const a = [1, 1.18, 0.92, 1.1, 1];
        const out = [...a.slice(s.phase), ...a.slice(0, s.phase)];
        out[out.length - 1] = out[0];
        return (
          <Animated.Text
            key={s.phase}
            pointerEvents="none"
            style={[
              styles.abs,
              styles.centered,
              {
                left: s.left,
                top: s.top,
                width: f,
                fontSize: f,
                lineHeight: f * 1.15,
                transform: [
                  { rotate: s.rotate },
                  { scale: t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: out }) },
                ],
              },
            ]}
          >
            🔥
          </Animated.Text>
        );
      })}
    </>
  );
}

/** Cherry blossoms resting on the ring, with a few loose petals drifting off. */
function Petals({ size }: { size: number }) {
  const f = size * 0.26;
  const spots = [
    { left: -f * 0.3, top: -f * 0.1, k: 1, rotate: '-20deg' },
    { left: size - f * 0.7, top: size * 0.62, k: 0.85, rotate: '25deg' },
    { left: size * 0.6, top: -f * 0.45, k: 0.6, rotate: '10deg' },
  ];
  return (
    <>
      {spots.map((s, i) => (
        <Text
          key={i}
          pointerEvents="none"
          style={[
            styles.abs,
            styles.centered,
            styles.petal,
            {
              left: s.left,
              top: s.top,
              width: f * s.k,
              fontSize: f * s.k,
              lineHeight: f * s.k * 1.15,
              transform: [{ rotate: s.rotate }],
            },
          ]}
        >
          🌸
        </Text>
      ))}
      {[
        { left: size * 0.02, top: size * 0.86, r: '30deg' },
        { left: size * 0.96, top: size * 0.2, r: '-40deg' },
        { left: size * 0.3, top: size * 1.0, r: '-10deg' },
      ].map((p, i) => (
        <View
          key={`p${i}`}
          pointerEvents="none"
          style={[
            styles.loosePetal,
            {
              left: p.left,
              top: p.top,
              width: size * 0.09,
              height: size * 0.055,
              borderRadius: size * 0.05,
              transform: [{ rotate: p.r }],
            },
          ]}
        />
      ))}
    </>
  );
}

/** Little air bubbles rising along both sides of the ring. */
function Bubbles({ size }: { size: number }) {
  const spots = [
    { x: -0.08, y: 0.56, k: 0.13 },
    { x: -0.12, y: 0.33, k: 0.09 },
    { x: -0.02, y: 0.13, k: 0.06 },
    { x: 0.95, y: 0.64, k: 0.1 },
    { x: 1.02, y: 0.42, k: 0.065 },
    { x: 0.96, y: 0.24, k: 0.045 },
  ];
  return (
    <>
      {spots.map((b, i) => {
        const d = size * b.k;
        return (
          <View
            key={i}
            pointerEvents="none"
            style={[
              styles.abs,
              styles.bubble,
              {
                left: size * b.x,
                top: size * b.y,
                width: d,
                height: d,
                borderRadius: d / 2,
                padding: d * 0.16,
              },
            ]}
          >
            <View style={[styles.bubbleShine, { width: d * 0.3, height: d * 0.3, borderRadius: d }]} />
          </View>
        );
      })}
    </>
  );
}

/** Glowing drops oozing down from the bottom of the ring. */
function Drips({ size, color }: { size: number; color: string }) {
  const w = size * 0.075;
  const spots = [
    { x: 0.3, top: 0.88, len: 0.15 },
    { x: 0.44, top: 0.93, len: 0.22 },
    { x: 0.66, top: 0.9, len: 0.12 },
  ];
  return (
    <>
      {spots.map((d, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={[
            styles.abs,
            {
              left: size * d.x - w / 2,
              top: size * d.top,
              width: w,
              height: size * d.len,
              borderBottomLeftRadius: w,
              borderBottomRightRadius: w,
              borderTopLeftRadius: w * 0.3,
              borderTopRightRadius: w * 0.3,
              backgroundColor: color,
              boxShadow: `0 0 ${size * 0.06}px ${color}`,
            },
          ]}
        />
      ))}
    </>
  );
}

/** Dark wisps drifting around the ring. */
function Smoke({ size, t }: { size: number; t: Animated.Value }) {
  const spots = [
    { x: -0.16, y: 0.6, k: 0.4 },
    { x: 0.68, y: -0.14, k: 0.44 },
    { x: 0.8, y: 0.72, k: 0.32 },
    { x: -0.08, y: -0.04, k: 0.28 },
  ];
  return (
    <>
      {spots.map((s, i) => {
        const d = size * s.k;
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.abs,
              {
                left: size * s.x,
                top: size * s.y,
                width: d * 0.6,
                height: d * 0.4,
                borderRadius: d,
                backgroundColor: 'rgba(40, 10, 70, 0.35)',
                boxShadow: `0 0 ${d * 0.45}px ${d * 0.25}px rgba(55, 15, 95, 0.75)`,
                opacity: t.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: i % 2 ? [0.5, 0.95, 0.5] : [0.95, 0.5, 0.95],
                }),
              },
            ]}
          />
        );
      })}
    </>
  );
}

/** Tiny stars printed on the ring; they turn with it. */
function RingStars({ size }: { size: number }) {
  const n = 16;
  const r = size / 2;
  const rr = r - size * 0.05;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + (i % 2) * 0.15;
        const d = Math.max(1, size * (i % 3 === 0 ? 0.035 : 0.02));
        return (
          <View
            key={i}
            pointerEvents="none"
            style={[
              styles.abs,
              {
                left: r + Math.cos(a) * rr - d / 2,
                top: r + Math.sin(a) * rr - d / 2,
                width: d,
                height: d,
                borderRadius: d,
                backgroundColor: i % 4 === 0 ? '#ffe6a8' : '#ffffff',
                boxShadow: i % 3 === 0 ? '0 0 3px #ffffff' : undefined,
              },
            ]}
          />
        );
      })}
    </>
  );
}

/** Twinkling stars around a legendary frame. */
function Sparkles({ size, t, glow }: { size: number; t: Animated.Value; glow?: string }) {
  const f = Math.max(8, size * 0.2);
  const spots = [
    { left: -f * 0.45, top: size * 0.08, k: 0 },
    { left: size - f * 0.4, top: -f * 0.45, k: 1 },
    { left: size - f * 0.35, top: size * 0.5, k: 2 },
    { left: -f * 0.3, top: size * 0.68, k: 3 },
  ];
  return (
    <>
      {spots.map((s) => (
        <Animated.Text
          key={s.k}
          pointerEvents="none"
          style={[
            styles.abs,
            styles.sparkle,
            glow ? { color: '#ffffff', textShadowColor: glow } : null,
            {
              left: s.left,
              top: s.top,
              fontSize: s.k % 2 ? f : f * 0.75,
              opacity: t.interpolate({
                inputRange: [0, 0.25, 0.5, 0.75, 1],
                outputRange: s.k % 2 ? [1, 0.2, 1, 0.2, 1] : [0.2, 1, 0.2, 1, 0.2],
              }),
              transform: [
                {
                  scale: t.interpolate({
                    inputRange: [0, 0.25, 0.5, 0.75, 1],
                    outputRange: s.k % 2 ? [1.1, 0.6, 1.1, 0.6, 1.1] : [0.6, 1.1, 0.6, 1.1, 0.6],
                  }),
                },
              ],
            },
          ]}
        >
          ✦
        </Animated.Text>
      ))}
    </>
  );
}

/** The player's level in a small gold pill at the bottom right. */
function LevelChip({ level, size }: { level: number; size: number }) {
  const h = Math.max(13, 8 + size * 0.17);
  return (
    <LinearGradient
      colors={['#fff1b0', '#ffc933', '#d69400']}
      style={[
        styles.abs,
        styles.chip,
        {
          right: -size * 0.08,
          bottom: -size * 0.06,
          height: h,
          minWidth: h,
          borderRadius: h / 2,
          paddingHorizontal: h * 0.2,
          borderWidth: Math.max(1, h * 0.09),
        },
      ]}
    >
      <Text style={[styles.chipText, { fontSize: h * 0.62, lineHeight: h * 0.8 }]}>{level}</Text>
    </LinearGradient>
  );
}

const LOCKED_AVATARS = REWARDS.filter((r) => r.kind === 'avatar');

/**
 * Pick an emoji and a background color. With a `level`, the emojis unlocked by levels are shown too;
 * the ones still locked are dimmed and cannot be picked.
 */
export function AvatarPicker({
  value,
  onChange,
  level,
}: {
  value: Avatar;
  onChange: (a: Avatar) => void;
  /** Player level; emojis unlocked above it are shown locked. Treated as 1 when missing. */
  level?: number;
}) {
  const lvl = level ?? 1;
  const choices = [
    ...AVATAR_EMOJIS.map((emoji) => ({ emoji, need: 1 })),
    ...LOCKED_AVATARS.map((r) => ({ emoji: r.id, need: r.level })),
  ];
  return (
    <View style={styles.box}>
      <View style={[styles.row, styles.emojiRow]}>
        {choices.map(({ emoji, need }) => {
          const locked = need > lvl;
          const selected = emoji === value.emoji;
          return (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={locked ? `${emoji}, débloqué au niveau ${need}` : undefined}
              accessibilityState={{ selected, disabled: locked }}
              disabled={locked}
              onPress={() => onChange({ ...value, emoji })}
              style={[
                styles.emoji,
                need > 1 && !locked && styles.unlocked,
                selected && styles.selected,
                locked && styles.locked,
              ]}
            >
              <Text style={[styles.emojiText, locked && styles.lockedEmoji]}>{emoji}</Text>
              {locked && (
                <>
                  <Text style={styles.lock}>🔒</Text>
                  <View style={styles.need}>
                    <Text style={styles.needText}>Niv. {need}</Text>
                  </View>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.row}>
        {AVATAR_COLORS.map((color) => (
          <Pressable
            key={color}
            accessibilityRole="button"
            accessibilityLabel={`Couleur ${color}`}
            accessibilityState={{ selected: color === value.color }}
            onPress={() => onChange({ ...value, color })}
            style={[styles.color, { backgroundColor: color }, color === value.color && styles.colorSelected]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  ring: { overflow: 'hidden' },
  disc: { alignItems: 'center', justifyContent: 'center', borderColor: 'rgba(0,0,0,0.35)' },
  centered: { textAlign: 'center' },
  gem: {
    borderRadius: 1.5,
    borderWidth: 0.75,
    borderColor: 'rgba(255,255,255,0.9)',
    boxShadow: '0 0 3px rgba(255,255,255,0.8)',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  gemShine: { backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 1 },
  frost: {
    color: '#ffffff',
    textShadowColor: 'rgba(80, 190, 255, 0.95)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 0 },
  },
  sparkle: {
    color: '#fff6c9',
    textShadowColor: 'rgba(255, 200, 40, 1)',
    textShadowRadius: 5,
    textShadowOffset: { width: 0, height: 0 },
  },
  facetCross: { opacity: 0.5 },
  petal: {
    textShadowColor: 'rgba(255, 120, 180, 0.9)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 0 },
  },
  loosePetal: { position: 'absolute', backgroundColor: '#ffb3d1', borderWidth: 0.5, borderColor: '#ff7fb0' },
  bubble: {
    backgroundColor: 'rgba(160, 255, 245, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(220, 255, 250, 0.9)',
    boxShadow: '0 0 3px rgba(60, 230, 220, 0.8)',
  },
  bubbleShine: { backgroundColor: 'rgba(255,255,255,0.95)' },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#3b2800',
    boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
  },
  chipText: { color: '#3b2800', fontWeight: '900' },
  box: { gap: 10, marginVertical: 6 },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  emojiRow: { rowGap: 10, paddingBottom: 4 },
  emoji: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  unlocked: { borderColor: 'rgba(255, 210, 90, 0.55)' },
  selected: { borderColor: colors.gold, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.12)' },
  locked: { backgroundColor: 'rgba(0,0,0,0.35)', borderStyle: 'dashed' },
  emojiText: { fontSize: 22 },
  lockedEmoji: { opacity: 0.3 },
  lock: { position: 'absolute', top: -3, right: -3, fontSize: 11 },
  need: {
    position: 'absolute',
    bottom: -5,
    paddingHorizontal: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 210, 90, 0.5)',
  },
  needText: { color: '#ffd76a', fontSize: 8.5, fontWeight: '800' },
  color: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  colorSelected: { borderColor: '#fff', transform: [{ scale: 1.15 }] },
});
