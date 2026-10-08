import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type PushStatus, dismissPrompt, promptDismissed, useNotifications } from '../notifications';
import { colors, gradients } from '../theme';
import { t } from '../i18n';

/** Why notifications cannot be turned on here, and what to do about it. */
function explain(status: PushStatus | null): string | null {
  switch (status) {
    case 'needs-install':
      return t(
        'Sur iPhone et iPad, les notifications ne marchent que si La Tablée est installée sur l’écran d’accueil (iOS 16.4 ou plus récent) : dans Safari, touche Partager puis « Sur l’écran d’accueil », puis ouvre l’appli depuis son icône.',
      );
    case 'denied':
      return t(
        'Les notifications sont bloquées pour La Tablée. Autorise-les dans les réglages de ton navigateur (ou de ton téléphone), puis reviens ici.',
      );
    case 'unsupported':
      return t(
        'Ce navigateur ne peut pas recevoir de notifications. Essaie avec Chrome, Firefox, Edge ou Safari.',
      );
    default:
      return null;
  }
}

/** A switch drawn like the phone's own. */
function Switch({ on, disabled }: { on: boolean; disabled: boolean }) {
  return (
    <View style={[styles.switch, on && styles.switchOn, disabled && styles.disabled]}>
      <View style={[styles.knob, on && styles.knobOn]} />
    </View>
  );
}

/** "Activer les notifications", in the profile. */
export function NotificationSettings() {
  const { status, busy, error, enable, disable } = useNotifications();
  if (Platform.OS !== 'web') return null;
  const on = status === 'on';
  const blocked = status !== 'on' && status !== 'off';
  const why = explain(status);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: on, disabled: blocked || busy }}
        accessibilityLabel={t('Activer les notifications')}
        disabled={blocked || busy || status === null}
        onPress={on ? disable : enable}
        style={({ pressed }) => [styles.toggleRow, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.bell}>{on ? '🔔' : '🔕'}</Text>
        <View style={styles.flex}>
          <Text style={styles.toggleTitle}>{t('Activer les notifications')}</Text>
          <Text style={styles.toggleText}>
            {t('Quand un ami t’invite à sa table, et quand c’est ton tour dans une partie en ligne.')}
          </Text>
        </View>
        {busy ? <ActivityIndicator color={colors.gold} /> : <Switch on={on} disabled={blocked} />}
      </Pressable>
      {why && (
        <View style={styles.why}>
          <Text style={styles.whyIcon}>{status === 'needs-install' ? '📲' : 'ℹ️'}</Text>
          <Text style={styles.whyText}>{why}</Text>
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/**
 * A gentle offer when sitting down at an online table: shown until answered once, and only
 * where notifications can work (or could, once the app is installed).
 */
export function NotifyPrompt() {
  const { status, busy, error, enable } = useNotifications();
  const [hidden, setHidden] = useState(() => Platform.OS !== 'web' || promptDismissed());
  if (hidden || (status !== 'off' && status !== 'needs-install')) return null;

  function later() {
    dismissPrompt();
    setHidden(true);
  }

  return (
    <View style={styles.prompt}>
      <Text style={styles.bell}>🔔</Text>
      <View style={styles.flex}>
        <Text style={styles.promptTitle}>{t('Être prévenu quand c’est ton tour ?')}</Text>
        <Text style={styles.toggleText}>
          {status === 'needs-install'
            ? t('Installe La Tablée sur l’écran d’accueil pour recevoir une notification quand c’est à toi.')
            : t('Une notification si l’appli est en arrière-plan quand c’est à toi de jouer.')}
        </Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.promptRow}>
          {status === 'off' && (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={async () => {
                await enable();
                dismissPrompt();
              }}
              style={({ pressed }) => [styles.promptButton, pressed && { opacity: 0.8 }]}
            >
              <LinearGradient colors={gradients.gold} style={styles.promptButtonInner}>
                {busy ? (
                  <ActivityIndicator color={colors.onGold} />
                ) : (
                  <Text style={styles.promptButtonText}>{t('Activer')}</Text>
                )}
              </LinearGradient>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" onPress={later} hitSlop={8} style={styles.later}>
            <Text style={styles.laterText}>{status === 'off' ? t('Plus tard') : t('Compris')}</Text>
          </Pressable>
        </View>
      </View>
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
    gap: 10,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bell: { fontSize: 26 },
  toggleTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  toggleText: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
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
  disabled: { opacity: 0.4 },
  why: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  whyIcon: { fontSize: 18 },
  whyText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 19 },
  error: { color: '#ff8a80', fontSize: 13, marginTop: 4 },
  prompt: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,193,7,0.1)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  promptTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10 },
  promptButton: { borderRadius: 10, overflow: 'hidden' },
  promptButtonInner: { paddingHorizontal: 18, paddingVertical: 8, minWidth: 90, alignItems: 'center' },
  promptButtonText: { color: colors.onGold, fontWeight: '900', fontSize: 14 },
  later: { paddingVertical: 6 },
  laterText: { color: colors.muted, fontWeight: '800', fontSize: 14 },
});
