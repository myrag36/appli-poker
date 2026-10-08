import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/** Player 0 plays red, player 1 yellow. */
export const TOKEN_COLORS = [
  { fill: '#e63946', dark: '#a4161a', light: '#ff8a8f' },
  { fill: '#ffc93c', dark: '#c98a00', light: '#fff0a8' },
] as const;

export const TOKEN_NAMES = ['Rouge', 'Jaune'];

/** A Puissance 4 token seen from the front: a disc with a raised inner ring and a glint. */
export function Token({
  player,
  size,
  style,
}: {
  player: 0 | 1;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = TOKEN_COLORS[player];
  const inner = size * 0.64;
  return (
    <View
      style={[
        styles.disc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.fill,
          borderColor: c.dark,
          borderWidth: Math.max(1, size * 0.05),
          boxShadow: `inset 0 ${-size * 0.06}px ${size * 0.1}px rgba(0,0,0,0.35), inset 0 ${size * 0.05}px ${size * 0.08}px ${c.light}`,
        },
        style,
      ]}
    >
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          borderWidth: Math.max(1, size * 0.045),
          borderColor: c.dark,
          opacity: 0.55,
          boxShadow: `0 ${size * 0.02}px 0 ${c.light}`,
        }}
      />
      <View
        style={[
          styles.glint,
          {
            top: size * 0.14,
            left: size * 0.2,
            width: size * 0.22,
            height: size * 0.12,
            borderRadius: size * 0.1,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  glint: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.55)',
    transform: [{ rotate: '-30deg' }],
  },
});
