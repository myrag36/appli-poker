import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../theme';

const SUITS = ['♠', '♥', '♦', '♣'];

/** Deep green gradient with a soft spotlight and faint card suits, behind every screen. */
export function Backdrop() {
  const { width, height } = useWindowDimensions();
  const step = 92;
  const cols = Math.ceil(width / step) + 1;
  const rows = Math.ceil(height / step) + 1;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]}>
      <LinearGradient colors={gradients.background} style={StyleSheet.absoluteFill} />
      <View style={[styles.spotlight, { left: width / 2 - 120 }]} />
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (
          <Text
            key={`${r}-${c}`}
            style={[
              styles.suit,
              {
                left: c * step + (r % 2 ? step / 2 : 0) - 20,
                top: r * step - 20,
                transform: [{ rotate: `${((r + c) % 2 ? 1 : -1) * 15}deg` }],
              },
            ]}
          >
            {SUITS[(r + c) % 4]}
          </Text>
        )),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  spotlight: {
    position: 'absolute',
    top: -80,
    width: 240,
    height: 160,
    borderRadius: 120,
    backgroundColor: 'rgba(60, 200, 130, 0.12)',
    boxShadow: '0 0 120px 110px rgba(60, 200, 130, 0.12)',
  },
  clip: { overflow: 'hidden' },
  suit: { position: 'absolute', fontSize: 30, color: 'rgba(255, 255, 255, 0.035)' },
});
