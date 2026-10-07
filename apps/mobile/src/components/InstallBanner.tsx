import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useInstall } from '../pwa';
import { colors, gradients, shadow } from '../theme';

/** Safari's share icon: a box with an arrow coming out of the top. */
function ShareIcon() {
  return (
    <View style={styles.shareIcon}>
      <View style={styles.shareBox} />
      <Text style={styles.shareArrow}>↑</Text>
    </View>
  );
}

function Step({ n, title, text, icon }: { n: number; title: string; text: string; icon?: boolean }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{n}</Text>
      </View>
      <View style={styles.stepBody}>
        <View style={styles.stepTitleRow}>
          <Text style={styles.stepTitle}>{title}</Text>
          {icon && <ShareIcon />}
        </View>
        <Text style={styles.stepText}>{text}</Text>
      </View>
    </View>
  );
}

/**
 * Invitation to put the web app on the home screen, floating at the bottom of the games
 * screen. Hidden once the app is installed, opened from the home screen, or dismissed.
 */
export function InstallBanner() {
  const { mode, install, dismiss } = useInstall();
  const [guide, setGuide] = useState(false);
  const insets = useSafeAreaInsets();
  if (!mode && !guide) return null;

  const onInstall = () => (mode === 'ios' ? setGuide(true) : install());

  return (
    <>
      {mode && (
        <View style={[styles.wrap, { bottom: insets.bottom + 12 }]} pointerEvents="box-none">
          <View style={[styles.banner, shadow]}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>📲</Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.title}>Installe l'appli</Text>
              <Text style={styles.text}>Tes jeux en un geste, depuis l'écran d'accueil.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onInstall}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <LinearGradient colors={gradients.gold} style={styles.install}>
                <Text style={styles.installText}>Installer</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ne plus proposer d'installer l'appli"
              onPress={dismiss}
              hitSlop={10}
              style={styles.close}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Modal visible={guide} transparent animationType="fade" onRequestClose={() => setGuide(false)}>
        <Pressable style={styles.overlay} onPress={() => setGuide(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Ajoute l'appli à ton écran d'accueil</Text>
            <Text style={styles.sheetLead}>
              Trois gestes dans Safari, et elle s'ouvre comme une vraie appli.
            </Text>
            <Step
              n={1}
              title="Touche Partager"
              text="Le carré avec une flèche, dans la barre de Safari."
              icon
            />
            <Step
              n={2}
              title="« Sur l'écran d'accueil »"
              text="Fais défiler la liste vers le bas si tu ne le vois pas."
            />
            <Step n={3} title="Touche « Ajouter »" text="L'icône Jeux amis rejoint tes autres applis." />
            <Pressable
              accessibilityRole="button"
              onPress={() => setGuide(false)}
              style={({ pressed }) => [styles.ok, pressed && styles.pressed]}
            >
              <LinearGradient colors={gradients.gold} style={styles.okInner}>
                <Text style={styles.okText}>J'ai compris</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setGuide(false);
                dismiss();
              }}
              hitSlop={8}
            >
              <Text style={styles.never}>Ne plus me le proposer</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  banner: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 8,
    borderRadius: 18,
    // Opaque: on small screens it sits over the theme button.
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  badge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  badgeText: { fontSize: 22 },
  body: { flex: 1 },
  title: { color: colors.gold, fontSize: 15, fontWeight: '900' },
  text: { color: colors.muted, fontSize: 12, lineHeight: 16, marginTop: 1 },
  install: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  installText: { color: colors.onGold, fontSize: 14, fontWeight: '900' },
  close: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  closeText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#15171c',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.12)',
    gap: 14,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  sheetTitle: { color: colors.gold, fontSize: 22, fontWeight: '900', marginTop: 4 },
  sheetLead: { color: colors.muted, fontSize: 14, lineHeight: 19, marginTop: -6 },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  stepNumberText: { color: colors.onGold, fontSize: 15, fontWeight: '900' },
  stepBody: { flex: 1, gap: 2 },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  stepText: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  shareIcon: { width: 22, height: 24, alignItems: 'center' },
  shareBox: {
    position: 'absolute',
    bottom: 0,
    width: 18,
    height: 14,
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    borderColor: '#4ea8de',
  },
  shareArrow: { color: '#4ea8de', fontSize: 17, lineHeight: 18, fontWeight: '900' },
  ok: { marginTop: 4 },
  okInner: { borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  okText: { color: colors.onGold, fontSize: 17, fontWeight: '900' },
  never: { color: colors.muted, fontSize: 14, fontWeight: '700', textAlign: 'center', paddingVertical: 4 },
});
