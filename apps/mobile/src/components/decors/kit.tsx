// Small drawing and animation helpers shared by the detailed sceneries in this folder.
import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, Platform, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { reducedMotion } from '../Motion';

export type DecorProps = { w: number; h: number; k: number };

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
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width?: number;
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
        borderRadius: width / 2,
        backgroundColor: color,
        transform: [{ rotate: `${angle}rad` }],
      }}
    />
  );
}

/** A soft round light. */
export function Glow({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
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
        boxShadow: `0 0 ${size}px ${size * 0.8}px ${color}`,
      }}
    />
  );
}

/** A triangle pointing up (or down), its base centered on `x`, made from borders. */
export function Tri({
  x,
  y,
  width,
  height,
  color,
  down,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  down?: boolean;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: down ? y : y - height,
        width: 0,
        height: 0,
        borderLeftWidth: width / 2,
        borderRightWidth: width / 2,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        ...(down
          ? { borderTopWidth: height, borderTopColor: color }
          : { borderBottomWidth: height, borderBottomColor: color }),
      }}
    />
  );
}

/** A flame tongue: a drop pointing up, centered on `x`, its bottom at `y`. */
export function Flame({
  x,
  y,
  size,
  color,
  stretch = 1.5,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
  stretch?: number;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size * 0.5 - (size * stretch) / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        borderTopLeftRadius: 0,
        backgroundColor: color,
        transform: [{ scaleY: stretch }, { rotate: '45deg' }],
      }}
    />
  );
}

/**
 * Looping motions. On the web they are CSS animations (run by the browser's compositor,
 * cheap even with many of them); on phones a native-driven Animated loop.
 */
export type Motion = 'fall' | 'rise' | 'slide' | 'flicker' | 'sway' | 'pulse' | 'blink' | 'twinkle';

const web = Platform.OS === 'web';

type Frames = Record<string, { transform?: string; opacity?: number }>;
const KEYFRAMES: Record<Motion, Frames> = {
  // Layers drawn twice, one copy after the other: moving by half loops seamlessly.
  fall: { '0%': { transform: 'translateY(-50%)' }, '100%': { transform: 'translateY(0%)' } },
  rise: { '0%': { transform: 'translateY(0%)' }, '100%': { transform: 'translateY(-50%)' } },
  slide: { '0%': { transform: 'translateX(-50%)' }, '100%': { transform: 'translateX(0%)' } },
  flicker: {
    '0%': { opacity: 1, transform: 'scale(1)' },
    '18%': { opacity: 0.78, transform: 'scale(0.96)' },
    '37%': { opacity: 0.95, transform: 'scale(1.03)' },
    '55%': { opacity: 0.72, transform: 'scale(0.97)' },
    '78%': { opacity: 0.92, transform: 'scale(1.02)' },
    '100%': { opacity: 1, transform: 'scale(1)' },
  },
  sway: {
    '0%': { transform: 'rotate(-3deg)' },
    '50%': { transform: 'rotate(3deg)' },
    '100%': { transform: 'rotate(-3deg)' },
  },
  pulse: { '0%': { opacity: 0.35 }, '50%': { opacity: 1 }, '100%': { opacity: 0.35 } },
  blink: {
    '0%': { opacity: 1 },
    '86%': { opacity: 1 },
    '88%': { opacity: 0.25 },
    '90%': { opacity: 1 },
    '93%': { opacity: 0.4 },
    '95%': { opacity: 1 },
    '100%': { opacity: 1 },
  },
  twinkle: { '0%': { opacity: 1 }, '50%': { opacity: 0.25 }, '100%': { opacity: 1 } },
};

const webStyles: Partial<Record<Motion, object>> = web
  ? StyleSheet.create(
      Object.fromEntries(
        Object.entries(KEYFRAMES).map(([m, frames]) => [
          m,
          {
            animationKeyframes: [frames],
            animationIterationCount: 'infinite',
            animationTimingFunction:
              m === 'sway' || m === 'pulse' || m === 'twinkle' ? 'ease-in-out' : 'linear',
          },
        ]),
      ) as never,
    )
  : {};

function nativeStyle(motion: Motion, t: Animated.Value, distance: number) {
  switch (motion) {
    case 'fall':
      return {
        transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-distance, 0] }) }],
      };
    case 'rise':
      return {
        transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] }) }],
      };
    case 'slide':
      return {
        transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-distance, 0] }) }],
      };
    case 'flicker':
      return {
        opacity: t.interpolate({
          inputRange: [0, 0.18, 0.37, 0.55, 0.78, 1],
          outputRange: [1, 0.78, 0.95, 0.72, 0.92, 1],
        }),
        transform: [
          {
            scale: t.interpolate({
              inputRange: [0, 0.18, 0.37, 0.55, 0.78, 1],
              outputRange: [1, 0.96, 1.03, 0.97, 1.02, 1],
            }),
          },
        ],
      };
    case 'sway':
      return {
        transform: [
          { rotate: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-3deg', '3deg', '-3deg'] }) },
        ],
      };
    case 'pulse':
      return { opacity: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 1, 0.35] }) };
    case 'twinkle':
      return { opacity: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.25, 1] }) };
    case 'blink':
      return {
        opacity: t.interpolate({
          inputRange: [0, 0.86, 0.88, 0.9, 0.93, 0.95, 1],
          outputRange: [1, 1, 0.25, 1, 0.4, 1, 1],
        }),
      };
  }
}

function NativeLoop({
  motion,
  duration,
  delay,
  distance,
  style,
  children,
}: {
  motion: Motion;
  duration: number;
  delay: number;
  distance: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const t = useRef(new Animated.Value((delay % duration) / duration)).current;
  useEffect(() => {
    const start = (delay % duration) / duration;
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
  }, [t, duration, delay]);
  return (
    <Animated.View pointerEvents="none" style={[style, nativeStyle(motion, t, distance)]}>
      {children}
    </Animated.View>
  );
}

/**
 * A view that moves in a loop. `delay` shifts where in the loop it starts, so neighbours
 * don't move together. `distance` is the length moved by fall/rise/slide on phones (on the
 * web those move by half of the view's own size). With `still`, or when the player asked
 * their system for less motion, it stays put.
 */
export function Loop({
  motion,
  duration,
  delay = 0,
  distance = 0,
  still,
  style,
  children,
}: {
  motion: Motion;
  duration: number;
  delay?: number;
  distance?: number;
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
      <NativeLoop motion={motion} duration={duration} delay={delay} distance={distance} style={style}>
        {children}
      </NativeLoop>
    );
  }
  const timing = { animationDuration: `${duration}ms`, animationDelay: `${-delay}ms` } as ViewStyle;
  return (
    <View pointerEvents="none" style={[style, webStyles[motion] as ViewStyle, timing]}>
      {children}
    </View>
  );
}

/**
 * Particles (snow, rain, embers, dust) falling or rising forever across a `width`×`height`
 * area: the particles are drawn twice, one copy above the other, and the pair slides by one copy.
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
        distance={height}
        style={{ position: 'absolute', left: 0, top: 0, width, height: height * 2 }}
      >
        <View style={{ width, height }}>{children}</View>
        <View style={{ width, height }}>{children}</View>
      </Loop>
    </View>
  );
}

/** Things (clouds, flying cars) crossing a `width`-wide band from left to right, forever. */
export function Cross({
  top,
  width,
  height,
  duration,
  still,
  children,
}: {
  top: number;
  width: number;
  height: number;
  duration: number;
  still?: boolean;
  children: ReactNode;
}) {
  if (still || reducedMotion()) {
    return (
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top, width, height }}>
        {children}
      </View>
    );
  }
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top, width, height, overflow: 'hidden' }}
    >
      <Loop
        motion="slide"
        duration={duration}
        distance={width}
        style={{ position: 'absolute', left: 0, top: 0, width: width * 2, height, flexDirection: 'row' }}
      >
        <View style={{ width, height }}>{children}</View>
        <View style={{ width, height }}>{children}</View>
      </Loop>
    </View>
  );
}

/**
 * A thing hanging from a point (a lantern, a sign) that sways gently around it: the view is
 * rotated around its own center, so it is drawn in the lower half of a box centered on the hook.
 */
export function Hanging({
  x,
  y,
  width,
  length,
  duration = 4200,
  delay = 0,
  still,
  children,
}: {
  x: number;
  y: number;
  width: number;
  length: number;
  duration?: number;
  delay?: number;
  still?: boolean;
  children: ReactNode;
}) {
  return (
    <Loop
      motion="sway"
      duration={duration}
      delay={delay}
      distance={0}
      still={still}
      style={{ position: 'absolute', left: x - width / 2, top: y - length, width, height: length * 2 }}
    >
      <View style={{ position: 'absolute', left: 0, top: length, width, height: length }}>{children}</View>
    </Loop>
  );
}

/** Whether a scenery is drawn so small (the chooser's thumbnail) that animating it is pointless. */
export function tiny(w: number) {
  return w < 120;
}
