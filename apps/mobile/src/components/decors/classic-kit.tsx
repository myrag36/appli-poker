// Drawing and animation helpers for the seven original sceneries (classic-*.tsx).
import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, Platform, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { reducedMotion } from '../Motion';

export type SceneProps = { w: number; h: number; k: number };

/** Small deterministic random generator, so the scenery is the same on every render. */
export function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A straight line from one point to another, drawn as a thin rotated bar. */
export function Line({
  x1,
  y1,
  x2,
  y2,
  color,
  width = 1,
  round,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width?: number;
  round?: boolean;
}) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  return (
    <View
      style={{
        position: 'absolute',
        left: (x1 + x2) / 2 - length / 2,
        top: (y1 + y2) / 2 - width / 2,
        width: length,
        height: width,
        borderRadius: round ? width / 2 : 0,
        backgroundColor: color,
        transform: [{ rotate: `${angle}rad` }],
      }}
    />
  );
}

/** A soft round light. */
export function Glow({
  x,
  y,
  size,
  color,
  spread = 0.8,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
  spread?: number;
}) {
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
        boxShadow: `0 0 ${size}px ${size * spread}px ${color}`,
      }}
    />
  );
}

/** A plain disc centered on (x, y). */
export function Dot({
  x,
  y,
  size,
  color,
  style,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
  style?: ViewStyle;
}) {
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
        ...style,
      }}
    />
  );
}

/** A triangle pointing up (or down), its base centered on `x` at `y`, made from borders. */
export function Tri({
  x,
  y,
  width,
  height,
  color,
  down,
  skew = 0,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  down?: boolean;
  /** Moves the tip sideways, as a share of the width (-0.5 to 0.5). */
  skew?: number;
}) {
  const left = width * (0.5 + skew);
  return (
    <View
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: down ? y : y - height,
        width: 0,
        height: 0,
        borderLeftWidth: left,
        borderRightWidth: width - left,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        ...(down
          ? { borderTopWidth: height, borderTopColor: color }
          : { borderBottomWidth: height, borderBottomColor: color }),
      }}
    />
  );
}

/** Horizontal lines every `step` points across an area, drawn as one gradient (scanlines, grain). */
export function stripes(step: number, size: number, color: string, share = 0.5) {
  const count = Math.max(1, Math.min(400, Math.floor(size / step)));
  const colors: string[] = [];
  const locations: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = i / count;
    const b = (i + share) / count;
    const c = (i + 1) / count;
    colors.push('transparent', 'transparent', color, color);
    locations.push(a, b, b, c);
  }
  return {
    colors: colors as unknown as readonly [string, string, ...string[]],
    locations: locations as unknown as readonly [number, number, ...number[]],
  };
}

/**
 * Looping motions. On the web they are CSS animations (run by the browser's compositor,
 * cheap even with many of them); on phones a native-driven Animated loop.
 */
type Stop = {
  at: number;
  /** Opacity. */
  o?: number;
  /** Rotation, in degrees. */
  r?: number;
  /** Translation, as a share of the view's own width / height. */
  x?: number;
  y?: number;
  s?: number;
  sx?: number;
};

export type Motion =
  | 'twinkle'
  | 'pulse'
  | 'flicker'
  | 'chase'
  | 'blink'
  | 'sway'
  | 'spin'
  | 'fall'
  | 'rise'
  | 'slide'
  | 'shoot'
  | 'bob'
  | 'swing';

function stopsOf(motion: Motion, amp: number): { stops: Stop[]; ease: boolean } {
  switch (motion) {
    case 'twinkle':
      return {
        ease: true,
        stops: [
          { at: 0, o: 1 },
          { at: 0.5, o: 0.25 },
          { at: 1, o: 1 },
        ],
      };
    case 'pulse':
      return {
        ease: true,
        stops: [
          { at: 0, o: 0.45 },
          { at: 0.5, o: 1 },
          { at: 1, o: 0.45 },
        ],
      };
    case 'flicker':
      return {
        ease: false,
        stops: [
          { at: 0, o: 1, s: 1 },
          { at: 0.18, o: 0.78, s: 0.96 },
          { at: 0.37, o: 0.95, s: 1.03 },
          { at: 0.55, o: 0.7, s: 0.97 },
          { at: 0.78, o: 0.92, s: 1.02 },
          { at: 1, o: 1, s: 1 },
        ],
      };
    case 'chase':
      return {
        ease: false,
        stops: [
          { at: 0, o: 1 },
          { at: 0.46, o: 1 },
          { at: 0.5, o: 0.18 },
          { at: 0.96, o: 0.18 },
          { at: 1, o: 1 },
        ],
      };
    case 'blink':
      return {
        ease: false,
        stops: [
          { at: 0, o: 1 },
          { at: 0.86, o: 1 },
          { at: 0.875, o: 0.25 },
          { at: 0.89, o: 1 },
          { at: 0.92, o: 0.35 },
          { at: 0.94, o: 1 },
          { at: 1, o: 1 },
        ],
      };
    case 'sway':
      return {
        ease: true,
        stops: [
          { at: 0, r: -amp },
          { at: 0.5, r: amp },
          { at: 1, r: -amp },
        ],
      };
    case 'spin':
      return {
        ease: false,
        stops: [
          { at: 0, r: 0 },
          { at: 1, r: amp || 360 },
        ],
      };
    case 'fall':
      return {
        ease: false,
        stops: [
          { at: 0, y: -0.5 },
          { at: 1, y: 0 },
        ],
      };
    case 'rise':
      return {
        ease: false,
        stops: [
          { at: 0, y: 0 },
          { at: 1, y: -0.5 },
        ],
      };
    case 'slide':
      return {
        ease: false,
        stops: [
          { at: 0, x: -0.5 },
          { at: 1, x: 0 },
        ],
      };
    case 'shoot':
      return {
        ease: false,
        stops: [
          { at: 0, x: 0, o: 0 },
          { at: 0.015, x: 0.2, o: 1 },
          { at: 0.07, x: amp || 5, o: 0 },
          { at: 1, x: amp || 5, o: 0 },
        ],
      };
    case 'bob':
      return {
        ease: true,
        stops: [
          { at: 0, y: 0 },
          { at: 0.5, y: -(amp || 0.3) },
          { at: 1, y: 0 },
        ],
      };
    case 'swing':
      return {
        ease: true,
        stops: [
          { at: 0, sx: 1 },
          { at: 0.5, sx: 1 - (amp || 0.08) },
          { at: 1, sx: 1 },
        ],
      };
  }
}

const PROPS: (keyof Omit<Stop, 'at'>)[] = ['o', 'r', 'x', 'y', 's', 'sx'];
const DEFAULTS = { o: 1, r: 0, x: 0, y: 0, s: 1, sx: 1 };

function used(stops: Stop[]) {
  return PROPS.filter((p) => stops.some((s) => s[p] !== undefined));
}

const web = Platform.OS === 'web';
const webCache = new Map<string, object>();

function webMotion(motion: Motion, amp: number) {
  const key = `${motion}:${amp}`;
  const hit = webCache.get(key);
  if (hit) return hit;
  const { stops, ease } = stopsOf(motion, amp);
  const props = used(stops);
  const frames: Record<string, { transform?: string; opacity?: number }> = {};
  for (const s of stops) {
    const v = { ...DEFAULTS, ...s };
    const frame: { transform?: string; opacity?: number } = {};
    if (props.includes('o')) frame.opacity = v.o;
    const t: string[] = [];
    if (props.includes('x') || props.includes('y')) t.push(`translate(${v.x * 100}%, ${v.y * 100}%)`);
    if (props.includes('r')) t.push(`rotate(${v.r}deg)`);
    if (props.includes('s')) t.push(`scale(${v.s})`);
    if (props.includes('sx')) t.push(`scaleX(${v.sx})`);
    if (t.length) frame.transform = t.join(' ');
    frames[`${Math.round(s.at * 1000) / 10}%`] = frame;
  }
  const style = StyleSheet.create({
    m: {
      animationKeyframes: [frames],
      animationIterationCount: 'infinite',
      animationTimingFunction: ease ? 'ease-in-out' : 'linear',
    } as never,
  }).m;
  webCache.set(key, style);
  return style;
}

function nativeMotion(motion: Motion, amp: number, t: Animated.Value, width: number, height: number) {
  const { stops } = stopsOf(motion, amp);
  const props = used(stops);
  const inputRange = stops.map((s) => s.at);
  const out = (p: keyof typeof DEFAULTS) => stops.map((s) => s[p] ?? DEFAULTS[p]);
  const style: { opacity?: unknown; transform: object[] } = { transform: [] };
  if (props.includes('o')) style.opacity = t.interpolate({ inputRange, outputRange: out('o') });
  if (props.includes('x'))
    style.transform.push({
      translateX: t.interpolate({ inputRange, outputRange: out('x').map((v) => v * width) }),
    });
  if (props.includes('y'))
    style.transform.push({
      translateY: t.interpolate({ inputRange, outputRange: out('y').map((v) => v * height) }),
    });
  if (props.includes('r'))
    style.transform.push({
      rotate: t.interpolate({ inputRange, outputRange: out('r').map((v) => `${v}deg`) }),
    });
  if (props.includes('s'))
    style.transform.push({ scale: t.interpolate({ inputRange, outputRange: out('s') }) });
  if (props.includes('sx'))
    style.transform.push({ scaleX: t.interpolate({ inputRange, outputRange: out('sx') }) });
  return style as never;
}

function NativeLoop({
  motion,
  amp,
  duration,
  delay,
  width,
  height,
  style,
  children,
}: {
  motion: Motion;
  amp: number;
  duration: number;
  delay: number;
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const start = (((delay % duration) + duration) % duration) / duration;
  const t = useRef(new Animated.Value(start)).current;
  useEffect(() => {
    const first = Animated.timing(t, {
      toValue: 1,
      duration: duration * (1 - start),
      easing: Easing.linear,
      useNativeDriver: true,
    });
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
    );
    let stopped = false;
    first.start(({ finished }) => {
      if (finished && !stopped) {
        t.setValue(0);
        loop.start();
      }
    });
    return () => {
      stopped = true;
      first.stop();
      loop.stop();
    };
  }, [t, duration, start]);
  return (
    <Animated.View pointerEvents="none" style={[style, nativeMotion(motion, amp, t, width, height)]}>
      {children}
    </Animated.View>
  );
}

/**
 * A view that moves in a loop. `delay` shifts where in the loop it starts, so neighbours
 * don't move together; `amp` tunes the motion (degrees for sway/spin, distance for shoot/bob).
 * `width`/`height` are the view's own size, which phones need for the moves. With `still`,
 * or when the player asked their system for less motion, it stays put.
 */
export function Loop({
  motion,
  duration,
  delay = 0,
  amp = 0,
  width = 0,
  height = 0,
  still,
  style,
  children,
}: {
  motion: Motion;
  duration: number;
  delay?: number;
  amp?: number;
  width?: number;
  height?: number;
  still?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  if (still || reducedMotion()) {
    return (
      <View pointerEvents="none" style={style}>
        {children}
      </View>
    );
  }
  if (!web) {
    return (
      <NativeLoop
        motion={motion}
        amp={amp}
        duration={duration}
        delay={delay}
        width={width}
        height={height}
        style={style}
      >
        {children}
      </NativeLoop>
    );
  }
  const timing = { animationDuration: `${duration}ms`, animationDelay: `${-delay}ms` } as ViewStyle;
  return (
    <View pointerEvents="none" style={[style, webMotion(motion, amp) as ViewStyle, timing]}>
      {children}
    </View>
  );
}

/**
 * Particles (petals, dust, snow) falling or rising forever across a `width`×`height` area:
 * they are drawn twice, one copy above the other, and the pair slides by one copy.
 */
export function Drift({
  left = 0,
  top = 0,
  width,
  height,
  up,
  duration,
  still,
  children,
}: {
  left?: number;
  top?: number;
  width: number;
  height: number;
  up?: boolean;
  duration: number;
  still?: boolean;
  children: ReactNode;
}) {
  if (still || reducedMotion()) {
    return (
      <View pointerEvents="none" style={{ position: 'absolute', left, top, width, height }}>
        {children}
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left, top, width, height, overflow: 'hidden' }}>
      <Loop
        motion={up ? 'rise' : 'fall'}
        duration={duration}
        width={width}
        height={height * 2}
        style={{ position: 'absolute', left: 0, top: 0, width, height: height * 2 }}
      >
        <View style={{ width, height }}>{children}</View>
        <View style={{ width, height }}>{children}</View>
      </Loop>
    </View>
  );
}

/**
 * Something hanging from (or standing on) a point that rotates gently around it: the view
 * turns around its own center, so the content is drawn in one half of a box centered on the pivot.
 */
export function Pivot({
  x,
  y,
  width,
  length,
  amp = 3,
  duration = 4200,
  delay = 0,
  up,
  still,
  children,
}: {
  x: number;
  y: number;
  width: number;
  length: number;
  amp?: number;
  duration?: number;
  delay?: number;
  /** The content stands above the pivot (a spotlight beam) instead of hanging below it. */
  up?: boolean;
  still?: boolean;
  children: ReactNode;
}) {
  return (
    <Loop
      motion="sway"
      amp={amp}
      duration={duration}
      delay={delay}
      still={still}
      width={width}
      height={length * 2}
      style={{ position: 'absolute', left: x - width / 2, top: y - length, width, height: length * 2 }}
    >
      <View style={{ position: 'absolute', left: 0, top: up ? 0 : length, width, height: length }}>
        {children}
      </View>
    </Loop>
  );
}

/** A streak of light crossing the sky now and then, from (x, y) at `angle` degrees. */
export function ShootingStar({
  x,
  y,
  length,
  angle,
  duration,
  delay = 0,
  color = '#ffffff',
  k,
  still,
}: {
  x: number;
  y: number;
  length: number;
  angle: number;
  duration: number;
  delay?: number;
  color?: string;
  k: number;
  still?: boolean;
}) {
  if (still || reducedMotion()) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 0,
        height: 0,
        transform: [{ rotate: `${angle}deg` }],
      }}
    >
      <Loop
        motion="shoot"
        amp={6}
        duration={duration}
        delay={delay}
        width={length}
        height={2 * k}
        style={{ position: 'absolute', left: -length, top: -k, width: length, height: 2 * k }}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, height: 1.5 * k, opacity: 0.8 }}>
            {/* Gradient tail fading towards the back. */}
            <TailGradient color={color} />
          </View>
          <View
            style={{
              width: 3 * k,
              height: 3 * k,
              borderRadius: 2 * k,
              backgroundColor: color,
              boxShadow: `0 0 ${6 * k}px ${2 * k}px ${color}`,
            }}
          />
        </View>
      </Loop>
    </View>
  );
}

function TailGradient({ color }: { color: string }) {
  return (
    <LinearGradient
      colors={['transparent', color]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={StyleSheet.absoluteFill}
    />
  );
}

/** Whether a scenery is drawn so small (the theme button's thumbnail) that animating it is pointless. */
export function tiny(w: number) {
  return w < 120;
}

/** Fewer particles on a small or slow screen. */
export function many(base: number, w: number) {
  return Math.round(base * Math.min(1.6, Math.max(0.5, w / 600)));
}
