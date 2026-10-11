// A club's badge: its emoji on its color, as a little shield; with its name when there is room.
import { StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { colors } from '../theme';

export function ClubBadge({ emoji, color, size = 40 }: { emoji: string; color: string; size?: number }) {
  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size * 1.1,
          borderRadius: size * 0.28,
          borderBottomLeftRadius: size * 0.5,
          borderBottomRightRadius: size * 0.5,
          backgroundColor: color,
          borderWidth: Math.max(1.5, size / 18),
        },
      ]}
    >
      <Text style={{ fontSize: size * 0.52, lineHeight: size * 0.7 }}>{emoji}</Text>
    </View>
  );
}

/** The small club tag shown after a player's name: badge and short name. */
export function ClubTag({
  club,
  showName = true,
}: {
  club: { name: string; emoji: string; color: string } | null | undefined;
  showName?: boolean;
}) {
  if (!club) return null;
  return (
    <View
      style={[styles.tag, { borderColor: club.color }]}
      accessibilityLabel={t('Club {name}', { name: club.name })}
    >
      <Text style={styles.tagEmoji}>{club.emoji}</Text>
      {showName && (
        <Text style={styles.tagName} numberOfLines={1}>
          {club.name}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'rgba(255,255,255,0.55)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    maxWidth: 150,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  tagEmoji: { fontSize: 11 },
  tagName: { color: colors.text, fontSize: 11, fontWeight: '800', flexShrink: 1 },
});
