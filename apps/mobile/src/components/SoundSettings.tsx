import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { buzz, play, useSoundOn, useVibrationOn } from '../sound';
import { colors } from '../theme';
import { t } from '../i18n';

const canVibrate =
  Platform.OS !== 'web' || (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function');

function Switch({ on }: { on: boolean }) {
  return (
    <View style={[styles.switch, on && styles.switchOn]}>
      <View style={[styles.knob, on && styles.knobOn]} />
    </View>
  );
}

function Row({
  icon,
  title,
  text,
  on,
  onPress,
}: {
  icon: string;
  title: string;
  text: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
    >
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.flex}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
      <Switch on={on} />
    </Pressable>
  );
}

/** "Sons" and "Vibrations" switches, in the profile. Saved on this device. */
export function SoundSettings() {
  const [sound, setSound] = useSoundOn();
  const [vibration, setVibration] = useVibrationOn();
  return (
    <View style={styles.card}>
      <Row
        icon={sound ? '🔊' : '🔇'}
        title={t('Sons')}
        text={t('Cartes, jetons, dés, ton tour, victoire et défaite.')}
        on={sound}
        onPress={() => {
          setSound(!sound);
          // A little click to hear it is back.
          if (!sound) play('chip');
        }}
      />
      <View style={styles.line} />
      <Row
        icon={vibration ? '📳' : '📴'}
        title={t('Vibrations')}
        text={
          canVibrate
            ? t('Une courte vibration à ton tour, quand tu gagnes, ou pour un coup interdit.')
            : t('Ce téléphone ou ce navigateur ne sait pas vibrer (les iPhone par exemple).')
        }
        on={vibration}
        onPress={() => {
          setVibration(!vibration);
          if (!vibration) setTimeout(() => buzz('turn'), 0);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { height: 1, backgroundColor: colors.glassBorder },
  icon: { fontSize: 24, width: 30, textAlign: 'center' },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  text: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: colors.gold },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end' },
});
