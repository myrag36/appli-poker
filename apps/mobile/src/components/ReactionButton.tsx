import { useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Appear } from './Motion';
import { colors } from '../theme';
import { t } from '../i18n';

interface Props {
  emojis: string[];
  onSend: (emoji: string) => void;
  style?: StyleProp<ViewStyle>;
}

/** A small round button that opens a row of emojis; the one picked floats above my seat for everyone. */
export function ReactionButton({ emojis, onSend, style }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.wrap, style]} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Réagir')}
        onPress={() => setOpen(!open)}
        hitSlop={8}
        style={[styles.button, open && styles.buttonOpen]}
      >
        <Text style={styles.buttonText}>{open ? '✕' : '😀'}</Text>
      </Pressable>
      {open && (
        <Appear from={-10} style={styles.tray}>
          {emojis.map((emoji) => (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={t('Réagir {emoji}', { emoji })}
              onPress={() => {
                onSend(emoji);
                setOpen(false);
              }}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          ))}
        </Appear>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', alignItems: 'flex-end', gap: 6, zIndex: 50 },
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6, 28, 19, 0.85)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
  },
  buttonOpen: { borderColor: colors.gold },
  buttonText: { fontSize: 18, color: colors.text },
  tray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: 200,
    gap: 2,
    padding: 5,
    borderRadius: 22,
    backgroundColor: 'rgba(6, 28, 19, 0.95)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
  },
  item: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  itemPressed: { backgroundColor: 'rgba(255,255,255,0.12)' },
  emoji: { fontSize: 26 },
});
