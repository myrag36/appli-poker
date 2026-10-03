import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AVATAR_COLORS, AVATAR_EMOJIS, type Avatar } from '@appli-poker/engine';
import { colors, shadow } from '../theme';

/** A round avatar: an emoji on a colored disc. */
export function AvatarBadge({ avatar, size = 44 }: { avatar: Avatar; size?: number }) {
  return (
    <View
      style={[
        styles.badge,
        shadow,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: avatar.color },
      ]}
    >
      <Text style={{ fontSize: size * 0.55 }}>{avatar.emoji}</Text>
    </View>
  );
}

/** Pick an emoji and a background color. */
export function AvatarPicker({ value, onChange }: { value: Avatar; onChange: (a: Avatar) => void }) {
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        {AVATAR_EMOJIS.map((emoji) => (
          <Pressable
            key={emoji}
            accessibilityRole="button"
            accessibilityState={{ selected: emoji === value.emoji }}
            onPress={() => onChange({ ...value, emoji })}
            style={[styles.emoji, emoji === value.emoji && styles.selected]}
          >
            <Text style={styles.emojiText}>{emoji}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        {AVATAR_COLORS.map((color) => (
          <Pressable
            key={color}
            accessibilityRole="button"
            accessibilityLabel={`Couleur ${color}`}
            accessibilityState={{ selected: color === value.color }}
            onPress={() => onChange({ ...value, color })}
            style={[styles.color, { backgroundColor: color }, color === value.color && styles.colorSelected]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  box: { gap: 10, marginVertical: 6 },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  emoji: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  selected: { borderColor: colors.gold, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.12)' },
  emojiText: { fontSize: 22 },
  color: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  colorSelected: { borderColor: '#fff', transform: [{ scale: 1.15 }] },
});
