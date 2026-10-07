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

/** A player's title in a pill; the rarer the title, the fancier the pill. */
export function TitleBadge({ id, small }: { id: string; small?: boolean }) {
  const reward = findReward('title', id) ?? findReward('title', 'debutant')!;
  const tier = tierFor(reward.level);
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
