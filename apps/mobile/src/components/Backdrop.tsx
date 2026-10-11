import { type ReactNode, useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type Theme, THEMES, themeId } from '../theme';
import { Suits } from './decors/classic-casino';

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

type DecorView = (p: { w: number; h: number; k: number }) => ReactNode;

/*
 * Each scenery is a separate download (the first theme's comes with the app): only the chosen
 * theme's is needed at startup, and index.ts waits for it so it shows with the first screen.
 */
const LOADERS: Record<Theme['decor'], () => Promise<DecorView>> = {
  suits: async () => Suits,
  synthwave: () => import('./decors/classic-neon').then((m) => m.Synthwave),
  curtain: () => import('./decors/classic-vegas').then((m) => m.Curtain),
  lounge: () => import('./decors/classic-lounge').then((m) => m.Lounge),
  space: () => import('./decors/classic-space').then((m) => m.Space),
  sakura: () => import('./decors/classic-zen').then((m) => m.Sakura),
  saloon: () => import('./decors/classic-saloon').then((m) => m.Saloon),
  pirates: () => import('./decors/Pirates').then((m) => m.Pirates),
  chateau: () => import('./decors/Chateau').then((m) => m.Chateau),
  beach: () => import('./decors/Plage').then((m) => m.Plage),
  chalet: () => import('./decors/Chalet').then((m) => m.Chalet),
  cyberpunk: () => import('./decors/Cyberpunk').then((m) => m.Cyberpunk),
};
const DECORS: Partial<Record<Theme['decor'], DecorView>> = { suits: Suits };

/** Downloads a theme's scenery (at once when it is already there); never fails. */
export function loadDecor(decor: Theme['decor']): Promise<void> {
  if (DECORS[decor]) return Promise.resolve();
  return LOADERS[decor]().then(
    (view) => {
      DECORS[decor] = view;
    },
    () => {
      // Offline before it was ever saved: the theme's colors without its scenery.
    },
  );
}

/** The chosen theme's scenery, for index.ts to wait for before showing the app. */
export const decorReady = loadDecor(THEMES[themeId].decor);

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
  const [, setLoaded] = useState(0);
  useEffect(() => {
    if (Decor) return;
    let live = true;
    loadDecor(theme.decor).then(() => live && setLoaded((n) => n + 1));
    return () => {
      live = false;
    };
  }, [Decor, theme.decor]);
  return (
    <View
      pointerEvents="none"
      style={[width ? { width: w, height: h } : StyleSheet.absoluteFill, styles.clip]}
    >
      <LinearGradient colors={theme.gradients.background} style={StyleSheet.absoluteFill} />
      {theme.decor === 'suits' && <Glow x={w / 2} y={-k * 10} size={200 * k} color={theme.colors.glow} />}
      {Decor && <Decor w={w} h={h} k={k} />}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
