import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { PlayingCard } from '../components/PlayingCard';
import { RulesButton } from '../components/Rules';
import { POKER_RULES } from '../rules';
import { colors, gradients, shadow } from '../theme';
import { t } from '../i18n';

interface Props {
  canResume: boolean;
  playerName?: string;
  onOnline: () => void;
  onResume: () => void;
  onLocal: () => void;
  onStats: () => void;
  onBack: () => void;
}

/** Strongest hand first, with an example of each. */

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

export function HomeScreen({ canResume, playerName, onOnline, onResume, onLocal, onStats, onBack }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={10} style={styles.back}>
        <Text style={styles.backText}>{t('← Tous les jeux')}</Text>
      </Pressable>
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
          {playerName ? t('Salut {name} ! ', { name: playerName }) : ''}
          {t("Texas Hold'em entre amis, avec des jetons pour de faux.")}
        </Text>
      </View>

      <View style={styles.choices}>
        {canResume && (
          <Choice
            icon="▶"
            title={t('Reprendre ma table')}
            text={t('Retourne à ta dernière partie en ligne.')}
            highlight
            onPress={onResume}
          />
        )}
        <Choice
          icon="🌍"
          title={t('Jouer en ligne')}
          text={t("Chacun sur son téléphone. Crée une table et partage le code, ou rejoins celle d'un ami.")}
          highlight={!canResume}
          onPress={onOnline}
        />
        <Choice
          icon="📱"
          title={t('Sur ce téléphone')}
          text={t('Vous êtes ensemble ? Passez-vous le téléphone à chaque tour.')}
          onPress={onLocal}
        />
        <Choice
          icon="📊"
          title={t('Mes statistiques')}
          text={t('Tes résultats en ligne et le classement entre amis.')}
          onPress={onStats}
        />
      </View>

      <RulesButton rules={POKER_RULES} />
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
  back: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8 },
  backText: { color: colors.muted, fontSize: 15, fontWeight: '700' },
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
});
