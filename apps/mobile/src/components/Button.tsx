import { Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  /** Smaller padding and text, for the in-game controls. */
  compact?: boolean;
}

export function Button({ label, onPress, disabled, variant = 'primary', compact }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        compact && styles.compact,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={
          variant === 'primary' ? gradients.gold : variant === 'danger' ? gradients.danger : gradients.glass
        }
        style={StyleSheet.absoluteFill}
      />
      <Text
        style={[styles.label, compact && styles.labelCompact, variant === 'primary' && styles.labelDark]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 4,
    flexGrow: 1,
    overflow: 'hidden',
    boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
  },
  primary: { backgroundColor: colors.gold, borderWidth: 1, borderColor: colors.goldBorder },
  secondary: { backgroundColor: colors.glass, borderWidth: 1, borderColor: 'rgba(163, 207, 187, 0.45)' },
  danger: { backgroundColor: colors.danger, borderWidth: 1, borderColor: 'rgba(255,160,160,0.5)' },
  compact: { paddingVertical: 9, paddingHorizontal: 10, marginVertical: 0, borderRadius: 8 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  label: { color: colors.text, fontWeight: '700', fontSize: 16 },
  labelCompact: { fontSize: 14 },
  labelDark: { color: colors.onGold },
});
