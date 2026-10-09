import { type ReactNode, createContext, useContext, useEffect, useRef } from 'react';
import { Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { play } from '../sound';

const native = Platform.OS !== 'web';

/** The player asked their system for less motion: animations jump straight to the end. */
export function reducedMotion(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Whether cards drawn inside slide in from the deck when they appear. Off inside `Appear`
 * (which animates them already) and in panels that only show cards, like the rules.
 */
const CardMotion = createContext(true);

/** Cards inside stay still: no deal animation, no sound. */
export function StillCards({ children }: { children: ReactNode }) {
  return <CardMotion.Provider value={false}>{children}</CardMotion.Provider>;
}

// Cards appearing together (a new hand) come one after the other, like a dealer's.
const DEAL_STEP_MS = 35;
const DEAL_MAX_STEPS = 10;
let batchAt = 0;
let batchCount = 0;

/**
 * For a card component: the style that makes it slide and fade in from the deck the first
 * time it appears, with a soft dealing sound. Pass the result to an `Animated.View`.
 */
export function useDealIn(enabled = true) {
  const wanted = useContext(CardMotion) && enabled;
  const t = useRef(new Animated.Value(wanted && !reducedMotion() ? 0 : 1)).current;
  useEffect(() => {
    if (!wanted) return;
    const now = Date.now();
    if (now - batchAt > 80) batchCount = 0;
    batchAt = now;
    const delay = Math.min(batchCount++, DEAL_MAX_STEPS) * DEAL_STEP_MS;
    play('deal', { delay });
    if (reducedMotion()) return;
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: 240,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: native,
    });
    anim.start();
    return () => anim.stop();
  }, [t, wanted]);
  if (!wanted) return null;
  return {
    opacity: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
    transform: [
      { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) },
      { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '0deg'] }) },
      { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
    ],
  };
}

/** Slides and fades its content in once, when it first appears. */
export function Appear({
  children,
  delay = 0,
  from = -24,
  style,
}: {
  children: ReactNode;
  delay?: number;
  /** Vertical offset to start from, in points. */
  from?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useRef(new Animated.Value(reducedMotion() ? 1 : 0)).current;
  useEffect(() => {
    if (reducedMotion()) return;
    Animated.timing(t, {
      toValue: 1,
      duration: 320,
      delay,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: native,
    }).start();
  }, [t, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) },
            { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
          ],
        },
      ]}
    >
      <StillCards>{children}</StillCards>
    </Animated.View>
  );
}

/** Moves its content from one point to another, then fades it out. Positions are its center. */
export function FlyTo({
  children,
  from,
  to,
  delay = 0,
  duration = 1400,
}: {
  children: ReactNode;
  from: { x: number; y: number };
  to: { x: number; y: number };
  delay?: number;
  duration?: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // Without motion, the content is simply not shown travelling.
    if (reducedMotion()) return;
    Animated.timing(t, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: native,
    }).start();
  }, [t, delay, duration]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: from.x,
        top: from.y,
        opacity: t.interpolate({ inputRange: [0, 0.05, 0.7, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          {
            translateX: t.interpolate({
              inputRange: [0, 0.7, 1],
              outputRange: [0, to.x - from.x, to.x - from.x],
            }),
          },
          {
            translateY: t.interpolate({
              inputRange: [0, 0.7, 1],
              outputRange: [0, to.y - from.y, to.y - from.y],
            }),
          },
          { scale: t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1.15, 0.8] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Pops its content up, lets it drift upwards, then fades it away. */
export function FloatUp({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: 2600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: native,
    }).start();
  }, [t]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          opacity: t.interpolate({ inputRange: [0, 0.08, 0.75, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [10, -40] }) },
            { scale: t.interpolate({ inputRange: [0, 0.1, 0.2, 1], outputRange: [0.3, 1.4, 1, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
