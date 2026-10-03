import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

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
  },
  primary: { backgroundColor: colors.gold },
  secondary: { backgroundColor: colors.feltDark, borderWidth: 1, borderColor: colors.muted },
  danger: { backgroundColor: colors.danger },
  compact: { paddingVertical: 9, paddingHorizontal: 10, marginVertical: 0, borderRadius: 8 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  label: { color: colors.text, fontWeight: '700', fontSize: 16 },
  labelCompact: { fontSize: 14 },
  labelDark: { color: '#212529' },
});
