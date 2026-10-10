import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type Theme, THEMES, themeId } from '../theme';
import { Suits } from './decors/classic-casino';
import { Synthwave } from './decors/classic-neon';
import { Curtain } from './decors/classic-vegas';
import { Lounge } from './decors/classic-lounge';
import { Space } from './decors/classic-space';
import { Sakura } from './decors/classic-zen';
import { Saloon } from './decors/classic-saloon';
import { Chalet } from './decors/Chalet';
import { Chateau } from './decors/Chateau';
import { Cyberpunk } from './decors/Cyberpunk';
import { Pirates } from './decors/Pirates';
import { Plage } from './decors/Plage';

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
        boxShadow: `0 0 ${size}px ${size * 0.8}px ${color}`,
      }}
    />
  );
}

const DECORS: Record<Theme['decor'], (p: { w: number; h: number; k: number }) => ReactNode> = {
  suits: Suits,
  synthwave: Synthwave,
  curtain: Curtain,
  lounge: Lounge,
  space: Space,
  sakura: Sakura,
  saloon: Saloon,
  pirates: Pirates,
  chateau: Chateau,
  beach: Plage,
  chalet: Chalet,
  cyberpunk: Cyberpunk,
};

/**
 * The theme's scenery behind every screen. With `width`/`height` it draws a scaled-down
 * copy instead, for the theme previews.
 */
export function Backdrop({
  theme = THEMES[themeId],
  width,
  height,
}: {
  theme?: Theme;
  width?: number;
  height?: number;
}) {
  const window = useWindowDimensions();
  const w = width ?? window.width;
  const h = height ?? window.height;
  const k = width ? w / 390 : 1;
  const Decor = DECORS[theme.decor];
  return (
    <View
      pointerEvents="none"
      style={[width ? { width: w, height: h } : StyleSheet.absoluteFill, styles.clip]}
    >
      <LinearGradient colors={theme.gradients.background} style={StyleSheet.absoluteFill} />
      {theme.decor === 'suits' && <Glow x={w / 2} y={-k * 10} size={200 * k} color={theme.colors.glow} />}
      <Decor w={w} h={h} k={k} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
