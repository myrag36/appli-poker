import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { findReward } from '@appli-poker/engine';

const native = Platform.OS !== 'web';

type Stops = readonly [string, string, ...string[]];

interface Tier {
  fill: Stops;
  border: string;
  text: string;
  icon?: string;
  glow?: string;
  shimmer?: boolean;
}

/** Rarer titles (unlocked later) get a fancier pill. */
function tierFor(level: number): Tier {
  if (level >= 50)
    return {
      fill: ['#fff6c9', '#ffd700', '#ff9ad5', '#9ff3ff', '#ffd700'],
      border: '#fffbe6',
      text: '#3a1d00',
      icon: '👑',
      glow: '0 0 10px rgba(255, 210, 80, 0.85)',
      shimmer: true,
    };
  if (level >= 26)
    return {
      fill: ['#fff1b0', '#ffc933', '#c98a00'],
      border: '#ffe9a8',
      text: '#3b2800',
      icon: '★',
      glow: '0 0 6px rgba(255, 200, 60, 0.55)',
    };
  if (level >= 12)
    return {
      fill: ['#b9a4ff', '#7b5ce0', '#4a2fa8'],
      border: 'rgba(220, 205, 255, 0.8)',
      text: '#ffffff',
      icon: '✦',
    };
  if (level >= 4)
    return {
      fill: ['#7fd1c2', '#2a9d8f', '#1d6f65'],
      border: 'rgba(200, 255, 240, 0.6)',
      text: '#ffffff',
    };
  return {
    fill: ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.08)'],
    border: 'rgba(255,255,255,0.3)',
    text: '#f1f1f1',
  };
}

/** Titles bought in the shop have their own look, whatever their level. */
const SHOP_TIERS: Record<string, Tier> = {
  chanceux: {
    fill: ['#b6f5a0', '#3fbf4f', '#1b7a2c'],
    border: 'rgba(210, 255, 200, 0.85)',
    text: '#ffffff',
    icon: '🍀',
    glow: '0 0 6px rgba(80, 220, 100, 0.55)',
  },
  flambeur: {
    fill: ['#ffd36b', '#ff7a1a', '#d6200f'],
    border: '#ffe0a0',
    text: '#ffffff',
    icon: '🔥',
    glow: '0 0 8px rgba(255, 100, 0, 0.7)',
  },
  stratege: {
    fill: ['#9cc9ff', '#3a7fe0', '#173f8f'],
    border: 'rgba(210, 230, 255, 0.85)',
    text: '#ffffff',
    icon: '♟',
    glow: '0 0 6px rgba(70, 140, 255, 0.55)',
  },
  nuit: {
    fill: ['#3b4c9e', '#1a2160', '#090c2e'],
    border: 'rgba(170, 185, 255, 0.7)',
    text: '#fff6d6',
    icon: '🌙',
    glow: '0 0 8px rgba(110, 130, 255, 0.55)',
  },
  repenti: {
    fill: ['#f3ecff', '#c9b6ff', '#9a82e8'],
    border: '#ffffff',
    text: '#3a2370',
    icon: '😇',
    glow: '0 0 8px rgba(220, 200, 255, 0.75)',
  },
  millionnaire: {
    fill: ['#fff9d6', '#ffd700', '#e6a800', '#fff1a0', '#c98a00'],
    border: '#fffbe6',
    text: '#3a2400',
    icon: '💰',
    glow: '0 0 12px rgba(255, 215, 0, 0.95)',
    shimmer: true,
  },
  // Titles of the seasons, one per month.
  yeti: {
    fill: ['#ffffff', '#cdeaff', '#7fb8e6'],
    border: '#ffffff',
    text: '#0f3a63',
    icon: '❄️',
    glow: '0 0 8px rgba(190, 230, 255, 0.85)',
    shimmer: true,
  },
  masque: {
    fill: ['#ff4fa3', '#9b3cff', '#2fb8ff', '#ffd23f'],
    border: '#ffe9a8',
    text: '#ffffff',
    icon: '🎭',
    glow: '0 0 8px rgba(200, 80, 255, 0.6)',
  },
  jardinier: {
    fill: ['#c8f59a', '#6cc04a', '#3d8a2a'],
    border: 'rgba(230, 255, 210, 0.9)',
    text: '#ffffff',
    icon: '🌱',
    glow: '0 0 6px rgba(120, 210, 80, 0.55)',
  },
  farceur: {
    fill: ['#7fe3ff', '#2a9df4', '#ff8a3d'],
    border: '#dff6ff',
    text: '#ffffff',
    icon: '🐟',
    glow: '0 0 6px rgba(60, 170, 255, 0.6)',
  },
  fleurbleue: {
    fill: ['#e3ecff', '#9db8ff', '#5a7ff0'],
    border: '#ffffff',
    text: '#1d2a6b',
    icon: '💙',
    glow: '0 0 8px rgba(150, 180, 255, 0.7)',
  },
  rockstar: {
    fill: ['#2a2a2a', '#0b0b0b', '#3a0a3f'],
    border: '#ff3ec8',
    text: '#ffffff',
    icon: '🎸',
    glow: '0 0 9px rgba(255, 60, 200, 0.75)',
  },
  vacancier: {
    fill: ['#fff2a8', '#ffcf4a', '#ff9a3c'],
    border: '#fffbe0',
    text: '#5a2c00',
    icon: '🏖️',
    glow: '0 0 7px rgba(255, 200, 60, 0.65)',
  },
  reveur: {
    fill: ['#5b4bb8', '#2b2470', '#120f3a'],
    border: 'rgba(200, 190, 255, 0.8)',
    text: '#fff6d6',
    icon: '🌠',
    glow: '0 0 9px rgba(140, 120, 255, 0.65)',
    shimmer: true,
  },
  premier: {
    fill: ['#3f6b4f', '#24432f', '#173022'],
    border: '#c9a36b',
    text: '#ffffff',
    icon: '🎓',
    glow: '0 0 6px rgba(200, 160, 100, 0.5)',
  },
  fantome: {
    fill: ['#ffffff', '#e4e0ff', '#b8b0e6'],
    border: '#ffffff',
    text: '#3b2f6b',
    icon: '👻',
    glow: '0 0 10px rgba(230, 225, 255, 0.85)',
  },
  chataigne: {
    fill: ['#d99a5b', '#9c5a24', '#5e3110'],
    border: '#f5c98f',
    text: '#fff3e0',
    icon: '🌰',
    glow: '0 0 6px rgba(210, 130, 50, 0.55)',
  },
  lutin: {
    fill: ['#e8323c', '#b0141e', '#1f7a3a'],
    border: '#ffe9a8',
    text: '#ffffff',
    icon: '🎄',
    glow: '0 0 8px rgba(255, 80, 80, 0.6)',
    shimmer: true,
  },
};

/** A player's title in a pill; the rarer the title, the fancier the pill. */
export function TitleBadge({ id, small }: { id: string; small?: boolean }) {
  const reward = findReward('title', id) ?? findReward('title', 'debutant')!;
  const tier = SHOP_TIERS[reward.id] ?? tierFor(reward.level);
  const font = small ? 10.5 : 13;
  return (
    <View
      style={[
        styles.pill,
        {
          borderColor: tier.border,
          paddingHorizontal: small ? 7 : 11,
          paddingVertical: small ? 2 : 4,
          boxShadow: tier.glow,
        },
      ]}
    >
      <LinearGradient
        colors={tier.fill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
        locations={[0, 0.6]}
        style={StyleSheet.absoluteFill}
      />
      {tier.shimmer && <Shimmer />}
      <Text style={[styles.text, { color: tier.text, fontSize: font }]} numberOfLines={1}>
        {tier.icon ? `${tier.icon} ` : ''}
        {reward.name}
      </Text>
    </View>
  );
}

/** A bright streak sweeping across the pill. */
function Shimmer() {
  const t = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: native,
        }),
        Animated.delay(1200),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[
          styles.streak,
          {
            transform: [
              { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-40, width + 10] }) },
              { skewX: '-20deg' },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },
  text: { fontWeight: '800', letterSpacing: 0.3 },
  streak: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 30 },
});
