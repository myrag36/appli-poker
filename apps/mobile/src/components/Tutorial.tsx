import { type ReactNode, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, shadow } from '../theme';
import { t } from '../i18n';
import { PlayingCard } from './PlayingCard';

const SEEN_KEY = 'appli-poker-tutoriel';

/** True until the player has gone through (or skipped) the tutorial once. */
export function tutorialPending(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    return localStorage.getItem(SEEN_KEY) !== '1';
  } catch {
    return false;
  }
}

function markSeen() {
  if (Platform.OS !== 'web') return;
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Private browsing: the tutorial will simply show again next time.
  }
}

function Fan() {
  const cards = ['Ah', 'Ks', 'Qd'];
  return (
    <View style={styles.fan}>
      {cards.map((c, i) => (
        <View
          key={c}
          style={{
            marginHorizontal: -10,
            transform: [{ rotate: `${(i - 1) * 12}deg` }, { translateY: i === 1 ? -8 : 0 }],
          }}
        >
          <PlayingCard card={c} width={70} />
        </View>
      ))}
    </View>
  );
}

function GamePills() {
  const games = ['🃏 Poker', '🂡 Blackjack', '🎲 Yams', '🔴 Uno', '♣ Belote', '👑 Tarot'];
  return (
    <View style={styles.pills}>
      {games.map((g, i) => (
        <View key={g} style={[styles.pill, i === 0 && styles.pillActive]}>
          <Text style={[styles.pillText, i === 0 && styles.pillTextActive]}>{g}</Text>
        </View>
      ))}
      <Text style={styles.swipe}>{t('← glisse →')}</Text>
    </View>
  );
}

function TableCode() {
  return (
    <View style={styles.codeWrap}>
      <View style={styles.phones}>
        {['📱', '📱', '📱'].map((p, i) => (
          <Text key={i} style={styles.phone}>
            {p}
          </Text>
        ))}
      </View>
      <View style={styles.code}>
        <Text style={styles.codeLabel}>{t('CODE DE LA TABLE')}</Text>
        <Text style={styles.codeValue}>K7Q2</Text>
      </View>
    </View>
  );
}

function Rewards() {
  const items = [
    { icon: '⭐', label: t('XP') },
    { icon: '🪙', label: t('Pièces') },
    { icon: '🎁', label: t('Coffres') },
    { icon: '🏆', label: t('Succès') },
  ];
  return (
    <View style={styles.rewards}>
      {items.map((it) => (
        <View key={it.icon} style={styles.reward}>
          <Text style={styles.rewardIcon}>{it.icon}</Text>
          <Text style={styles.rewardLabel}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

interface Slide {
  visual: ReactNode;
  title: string;
  text: string;
}

/**
 * A few screens shown on first launch: what the app is, how to pick a game, how to play
 * online with friends, and what you win. Can be opened again from the profile.
 */
export function Tutorial({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const insets = useSafeAreaInsets();

  const slides: Slide[] = [
    {
      visual: <Fan />,
      title: t('Bienvenue à La Tablée !'),
      text: t(
        'Poker, belote, tarot, Uno, Yams… 14 jeux à partager entre amis, en ligne ou sur un seul téléphone.',
      ),
    },
    {
      visual: <GamePills />,
      title: t('Choisis ton jeu'),
      text: t(
        'Sur l’accueil, glisse les cartes pour voir les jeux, puis touche « Jouer ». Les règles sont expliquées dans chaque jeu.',
      ),
    },
    {
      visual: <TableCode />,
      title: t('Joue avec tes amis'),
      text: t(
        'Crée une table en ligne et envoie son code : chacun joue sur son téléphone. Tous au même endroit ? Passez-vous le téléphone, ou ajoutez des robots.',
      ),
    },
    {
      visual: <Rewards />,
      title: t('Gagne des récompenses'),
      text: t(
        'Chaque partie rapporte de l’XP et des pièces. Monte de niveau, ouvre des coffres et achète des avatars, des cartes et des tables dans la boutique.',
      ),
    },
  ];

  const last = index === slides.length - 1;
  const slide = slides[index];

  const close = () => {
    markSeen();
    setIndex(0);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={[styles.overlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.card, shadow]}>
          {!last && (
            <Pressable accessibilityRole="button" onPress={close} hitSlop={10} style={styles.skip}>
              <Text style={styles.skipText}>{t('Passer{tuto}', { tuto: '' })}</Text>
            </Pressable>
          )}
          <View style={styles.visual}>{slide.visual}</View>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.text}>{slide.text}</Text>

          <View style={styles.dots}>
            {slides.map((_, i) => (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={t('Étape {n}', { n: i + 1 })}
                onPress={() => setIndex(i)}
                hitSlop={6}
                style={[styles.dot, i === index && styles.dotActive]}
              />
            ))}
          </View>

          <View style={styles.buttons}>
            {index > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setIndex(index - 1)}
                style={({ pressed }) => [styles.back, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.backText}>{t('Retour')}</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => (last ? close() : setIndex(index + 1))}
              style={({ pressed }) => [styles.next, pressed && { opacity: 0.85 }]}
            >
              <LinearGradient colors={gradients.gold} style={styles.nextInner}>
                <Text style={styles.nextText}>{last ? t('C’est parti !') : t('Suivant')}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    borderRadius: 24,
    backgroundColor: '#15171c',
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  skip: { position: 'absolute', top: 14, right: 18, zIndex: 1 },
  skipText: { color: colors.muted, fontSize: 15, fontWeight: '700' },
  visual: { height: 170, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  title: { color: colors.gold, fontSize: 24, fontWeight: '900', textAlign: 'center', marginTop: 6 },
  text: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 10,
    minHeight: 92,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { width: 22, backgroundColor: colors.gold },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 18 },
  back: {
    paddingHorizontal: 18,
    borderRadius: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  backText: { color: colors.text, fontSize: 16, fontWeight: '800' },
  next: { flex: 1 },
  nextInner: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  nextText: { color: colors.onGold, fontSize: 17, fontWeight: '900' },

  fan: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, maxWidth: 320 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  pillActive: { borderColor: colors.gold, backgroundColor: 'rgba(255,193,7,0.15)' },
  pillText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  pillTextActive: { color: colors.gold },
  swipe: { width: '100%', textAlign: 'center', color: colors.muted, fontSize: 13, marginTop: 4 },
  codeWrap: { alignItems: 'center', gap: 12 },
  phones: { flexDirection: 'row', gap: 18 },
  phone: { fontSize: 40 },
  code: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(255,193,7,0.1)',
  },
  codeLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  codeValue: { color: colors.gold, fontSize: 30, fontWeight: '900', letterSpacing: 6 },
  rewards: { flexDirection: 'row', gap: 10 },
  reward: {
    width: 68,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  rewardIcon: { fontSize: 30 },
  rewardLabel: { color: colors.text, fontSize: 12, fontWeight: '800' },
});
