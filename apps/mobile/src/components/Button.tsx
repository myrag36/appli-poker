import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function Button({ label, onPress, disabled, variant = 'primary' }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, variant === 'primary' && styles.labelDark]}>{label}</Text>
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
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  label: { color: colors.text, fontWeight: '700', fontSize: 16 },
  labelDark: { color: '#212529' },
});
