import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { PlayingCard } from '../components/PlayingCard';
import { ThemePicker } from '../components/ThemePicker';
import { colors, gradients, shadow } from '../theme';

interface Props {
  canResume: boolean;
  playerName?: string;
  onOnline: () => void;
  onResume: () => void;
  onLocal: () => void;
}

/** Strongest hand first, with an example of each. */
const HAND_RANKS: { name: string; cards: string[] }[] = [
  { name: 'Quinte flush royale', cards: ['As', 'Ks', 'Qs', 'Js', 'Ts'] },
  { name: 'Quinte flush', cards: ['9h', '8h', '7h', '6h', '5h'] },
  { name: 'Carré', cards: ['Qc', 'Qd', 'Qh', 'Qs', '4d'] },
  { name: 'Full', cards: ['Kh', 'Kd', 'Ks', '7c', '7h'] },
  { name: 'Couleur', cards: ['Ad', 'Jd', '8d', '5d', '2d'] },
  { name: 'Quinte', cards: ['Tc', '9d', '8s', '7h', '6c'] },
  { name: 'Brelan', cards: ['8s', '8h', '8d', 'Kc', '3s'] },
  { name: 'Double paire', cards: ['Jh', 'Jc', '4s', '4d', 'Ah'] },
  { name: 'Paire', cards: ['Ts', 'Th', 'Kd', '6c', '2h'] },
  { name: 'Carte haute', cards: ['Ah', 'Jd', '8c', '5s', '3h'] },
];

function Choice({
  icon,
  title,
  text,
  highlight,
  onPress,
}: {
  icon: string;
  title: string;
  text: string;
  highlight?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        shadow,
        highlight && styles.choiceHighlight,
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient colors={highlight ? gradients.gold : gradients.glass} style={StyleSheet.absoluteFill} />
      <View style={[styles.icon, highlight && styles.iconHighlight]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <View style={styles.choiceBody}>
        <Text style={[styles.choiceTitle, highlight && styles.choiceTitleHighlight]}>{title}</Text>
        <Text style={[styles.choiceText, highlight && styles.choiceTextHighlight]}>{text}</Text>
      </View>
      <Text style={[styles.chevron, highlight && styles.choiceTitleHighlight]}>›</Text>
    </Pressable>
  );
}

export function HomeScreen({ canResume, playerName, onOnline, onResume, onLocal }: Props) {
  const insets = useSafeAreaInsets();
  const [showRules, setShowRules] = useState(false);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.hero}>
        <View style={styles.glow} />
        <View style={styles.fan}>
          {['As', 'Kh', 'Qd', 'Jc', 'Ts'].map((c, i) => (
            <View
              key={c}
              style={[
                styles.fanCard,
                { transform: [{ rotate: `${(i - 2) * 12}deg` }, { translateY: Math.abs(i - 2) * 8 }] },
              ]}
            >
              <PlayingCard card={c} width={58} />
            </View>
          ))}
        </View>
        <Text style={styles.title}>Appli Poker</Text>
        <Text style={styles.subtitle}>
          {playerName ? `Salut ${playerName} ! ` : ''}Texas Hold'em entre amis, avec des jetons pour de faux.
        </Text>
      </View>

      <View style={styles.choices}>
        {canResume && (
          <Choice
            icon="▶"
            title="Reprendre ma table"
            text="Retourne à ta dernière partie en ligne."
            highlight
            onPress={onResume}
          />
        )}
        <Choice
          icon="🌍"
          title="Jouer en ligne"
          text="Chacun sur son téléphone. Crée une table et partage le code, ou rejoins celle d'un ami."
          highlight={!canResume}
          onPress={onOnline}
        />
        <Choice
          icon="📱"
          title="Sur ce téléphone"
          text="Vous êtes ensemble ? Passez-vous le téléphone à chaque tour."
          onPress={onLocal}
        />
      </View>

      <ThemePicker />

      <Pressable
        accessibilityRole="button"
        onPress={() => setShowRules(!showRules)}
        style={styles.rulesToggle}
      >
        <Text style={styles.rulesToggleText}>
          {showRules ? 'Masquer les mains' : 'Quelle main gagne ? ▾'}
        </Text>
      </Pressable>

      {showRules && (
        <View style={styles.rules}>
          <Text style={styles.rulesIntro}>
            Chacun reçoit 2 cartes, 5 cartes sont posées au milieu. La meilleure combinaison de 5 cartes
            gagne.
          </Text>
          {HAND_RANKS.map((r, i) => (
            <View key={r.name} style={styles.rank}>
              <Text style={styles.rankName}>
                {i + 1}. {r.name}
              </Text>
              <View style={styles.rankCards}>
                {r.cards.map((c) => (
                  <PlayingCard key={c} card={c} width={24} />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  hero: { alignItems: 'center', marginBottom: 28 },
  glow: {
    position: 'absolute',
    top: 30,
    width: 140,
    height: 90,
    borderRadius: 70,
    backgroundColor: colors.glow,
    boxShadow: `0 0 70px 50px ${colors.glow}`,
  },
  fan: { flexDirection: 'row', justifyContent: 'center', height: 104, marginTop: 8 },
  fanCard: { marginHorizontal: -10 },
  title: {
    color: colors.gold,
    fontSize: 40,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.muted,
    textAlign: 'center',
    fontSize: 15,
    marginTop: 4,
    lineHeight: 21,
    maxWidth: 320,
  },
  choices: { gap: 12 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  choiceHighlight: { backgroundColor: colors.gold, borderColor: colors.goldBorder },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHighlight: { backgroundColor: 'rgba(0,0,0,0.12)' },
  iconText: { fontSize: 22 },
  choiceBody: { flex: 1, gap: 2 },
  choiceTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  choiceTitleHighlight: { color: colors.onGold },
  choiceText: { color: colors.muted, fontSize: 14, lineHeight: 19 },
  choiceTextHighlight: { color: colors.onGoldMuted },
  chevron: { color: colors.muted, fontSize: 30, fontWeight: '300' },
  rulesToggle: { alignSelf: 'center', marginTop: 24, padding: 8 },
  rulesToggleText: { color: colors.muted, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  rules: {
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 8,
  },
  rulesIntro: { color: colors.muted, fontSize: 14, lineHeight: 19, marginBottom: 4 },
  rank: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankName: { color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 },
  rankCards: { flexDirection: 'row' },
});
