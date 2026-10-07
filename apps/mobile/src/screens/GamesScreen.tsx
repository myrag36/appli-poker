import { useEffect, useRef, useState } from 'react';
import {
  type Avatar,
  defaultAvatar,
  levelProgress,
  parisDay,
  questProgress,
  questsFor,
} from '@appli-poker/engine';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GameDecor } from '../components/GameDecor';
import { ThemeChooser } from '../components/ThemeChooser';
import { AvatarBadge } from '../components/AvatarPicker';
import { useMyProgress } from '../online/progress';
import { loadAvatar } from '../online/supabase';
import { PlayingCard } from '../components/PlayingCard';
import { colors, gradients, shadow } from '../theme';

export type GameId = 'poker' | 'blackjack' | 'president' | 'yams' | 'belote';

interface Game {
  id: GameId;
  title: string;
  tagline: string;
  players: string;
  /** Cards fanned on the game's card, or dice faces for dice games. */
  art: string[];
  ready: boolean;
}

const GAMES: Game[] = [
  {
    id: 'poker',
    title: 'Poker',
    tagline: "Texas Hold'em ou Omaha, en ligne ou sur un seul téléphone.",
    players: '2 à 8 joueurs',
    art: ['As', 'Kh', 'Qd'],
    ready: true,
  },
  {
    id: 'blackjack',
    title: 'Blackjack',
    tagline: 'Approche-toi de 21 sans dépasser, contre la banque.',
    players: '1 à 7 joueurs',
    art: ['Ah', 'Js'],
    ready: true,
  },
  {
    id: 'president',
    title: 'Président',
    tagline: 'Débarrasse-toi de tes cartes le premier pour devenir président.',
    players: '3 à 8 joueurs',
    art: ['2c', '2d', '2h', '2s'],
    ready: true,
  },
  {
    id: 'yams',
    title: 'Yams',
    tagline: 'Cinq dés, trois lancers, une grille de combinaisons à remplir.',
    players: '1 à 6 joueurs',
    art: ['⚄', '⚄', '⚄', '⚀', '⚅'],
    ready: true,
  },
  {
    id: 'belote',
    title: 'Belote',
    tagline: 'Deux équipes, un atout, et la belote-rebelote pour les chanceux.',
    players: '4 joueurs',
    art: ['Jh', '9h', 'Ah', 'Kh', 'Qh'],
    ready: true,
  },
];

const GAP = 14;
/** Card height on a tall phone; smaller screens get shorter cards so the theme button still fits. */
const CARD_HEIGHT = 420;

interface Props {
  canResume: boolean;
  onPlay: (game: GameId) => void;
  onResume: () => void;
  onProfile: () => void;
  onShop: () => void;
}

function Art({ game }: { game: Game }) {
  if (game.id === 'yams') {
    return (
      <View style={styles.dice}>
        {game.art.map((d, i) => (
          <View key={i} style={[styles.die, { transform: [{ rotate: `${(i - 2) * 9}deg` }] }]}>
            <Text style={styles.dieText}>{d}</Text>
          </View>
        ))}
      </View>
    );
  }
  const mid = (game.art.length - 1) / 2;
  return (
    <View style={styles.fan}>
      {game.art.map((c, i) => (
        <View
          key={c}
          style={[
            styles.fanCard,
            { transform: [{ rotate: `${(i - mid) * 13}deg` }, { translateY: Math.abs(i - mid) * 8 }] },
          ]}
        >
          <PlayingCard card={c} width={62} />
        </View>
      ))}
    </View>
  );
}

/** The first screen: every game in a carousel you swipe through. */
export function GamesScreen({ canResume, onPlay, onResume, onProfile, onShop }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const cardHeight = Math.max(340, Math.min(CARD_HEIGHT, screenHeight - 480));
  const viewWidth = Math.min(screenWidth, 520);
  const cardWidth = Math.round(viewWidth * 0.76);
  const step = cardWidth + GAP;
  const side = (viewWidth - cardWidth) / 2;
  const scrollX = useRef(new Animated.Value(0)).current;
  const list = useRef<any>(null);
  const [index, setIndex] = useState(0);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / step);
    if (i !== index && i >= 0 && i < GAMES.length) setIndex(i);
  }

  function goTo(i: number) {
    list.current?.scrollTo({ x: i * step, animated: true });
    setIndex(i);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.chips}>
        <ProfileChip onPress={onProfile} />
        <CoinsChip onPress={onShop} />
      </View>
      <Text style={styles.title}>Jeux entre amis</Text>
      <Text style={styles.subtitle}>Glisse pour choisir ton jeu.</Text>

      {canResume && (
        <Pressable
          accessibilityRole="button"
          onPress={onResume}
          style={({ pressed }) => [styles.resume, pressed && styles.pressed]}
        >
          <Text style={styles.resumeText}>▶ Reprendre ma table de poker</Text>
        </Pressable>
      )}

      <View style={[styles.carouselWrap, { width: viewWidth }]}>
        <Animated.ScrollView
          ref={list}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: side, gap: GAP }}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: false,
            listener: onScroll,
          })}
        >
          {GAMES.map((game, i) => {
            const range = [(i - 1) * step, i * step, (i + 1) * step];
            const scale = scrollX.interpolate({
              inputRange: range,
              outputRange: [0.88, 1, 0.88],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange: range,
              outputRange: [0.55, 1, 0.55],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View key={game.id} style={{ width: cardWidth, transform: [{ scale }], opacity }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={game.ready ? `Jouer : ${game.title}` : `${game.title}, bientôt`}
                  onPress={() => (i === index ? game.ready && onPlay(game.id) : goTo(i))}
                  style={[styles.card, shadow, { height: cardHeight }]}
                >
                  <GameDecor id={game.id} width={cardWidth} height={cardHeight} />
                  <View style={styles.artBox}>
                    <Art game={game} />
                  </View>
                  <Text style={styles.cardTitle}>{game.title}</Text>
                  <Text style={styles.cardPlayers}>{game.players}</Text>
                  <Text style={styles.cardText}>{game.tagline}</Text>
                  <View style={styles.cardFooter}>
                    {game.ready ? (
                      <LinearGradient colors={gradients.gold} style={styles.play}>
                        <Text style={styles.playText}>Jouer</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.soon}>
                        <Text style={styles.soonText}>Bientôt</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </Animated.ScrollView>
      </View>

      <View style={styles.dots}>
        {GAMES.map((g, i) => (
          <Pressable
            key={g.id}
            accessibilityRole="button"
            accessibilityLabel={g.title}
            onPress={() => goTo(i)}
            hitSlop={6}
            style={[styles.dot, i === index && styles.dotActive]}
          />
        ))}
      </View>

      <View style={{ width: cardWidth }}>
        <ThemeChooser />
      </View>
    </View>
  );
}

/** My avatar, level and progress bar; opens my profile. */
function ProfileChip({ onPress }: { onPress: () => void }) {
  const progress = useMyProgress();
  const [avatar, setAvatar] = useState<Avatar>(defaultAvatar(0));
  useEffect(() => {
    loadAvatar().then((a) => a && setAvatar(a));
  }, []);
  const { level, ratio } = levelProgress(progress?.xp ?? 0);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mon profil, niveau ${level}`}
      onPress={onPress}
      style={({ pressed }) => [styles.profile, pressed && styles.pressed]}
    >
      <AvatarBadge avatar={{ ...avatar, frame: progress?.equipped.frame }} size={40} />
      <View style={styles.profileBody}>
        <Text style={styles.profileLevel}>Niveau {level}</Text>
        <View style={styles.profileTrack}>
          <View style={[styles.profileFill, { width: `${Math.max(4, ratio * 100)}%` }]} />
        </View>
      </View>
      <Text style={styles.profileGo}>Profil ›</Text>
    </Pressable>
  );
}

/** My coins, and how many finished quests wait to be paid. Opens the shop. */
function CoinsChip({ onPress }: { onPress: () => void }) {
  const progress = useMyProgress();
  const ready = progress
    ? questsFor(parisDay()).filter(
        (q) => questProgress(q, progress.today) >= q.target && !progress.claimed.includes(q.id),
      ).length
    : 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${progress?.coins ?? 0} pièces, quêtes et boutique${ready ? `, ${ready} quêtes à prendre` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.coins, pressed && styles.pressed]}
    >
      <Text style={styles.coinsText}>🪙 {progress?.coins ?? 0}</Text>
      <Text style={styles.coinsGo}>🛒</Text>
      {ready > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{ready}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  coins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 54,
    paddingHorizontal: 14,
    borderRadius: 28,
    backgroundColor: 'rgba(255,193,7,0.14)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  coinsText: { color: colors.gold, fontSize: 16, fontWeight: '900' },
  coinsGo: { fontSize: 18 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#e63946',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: 28,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  profileBody: { width: 76, gap: 4 },
  profileLevel: { color: colors.gold, fontSize: 14, fontWeight: '900' },
  profileTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.4)', overflow: 'hidden' },
  profileFill: { height: 6, borderRadius: 3, backgroundColor: colors.gold },
  profileGo: { color: colors.text, fontSize: 14, fontWeight: '800' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.gold, fontSize: 36, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: 4, textAlign: 'center' },
  resume: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.gold,
  },
  resumeText: { color: colors.onGold, fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.8 },
  carouselWrap: { marginTop: 24 },
  card: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'flex-end',
  },
  artBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fan: { flexDirection: 'row', justifyContent: 'center', height: 110 },
  fanCard: { marginHorizontal: -9 },
  dice: { flexDirection: 'row', gap: 4 },
  die: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f7f3e8',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
  },
  dieText: { fontSize: 40, lineHeight: 44, color: '#1b1b1b' },
  cardTitle: { color: '#fff', fontSize: 32, fontWeight: '900' },
  cardPlayers: { color: colors.gold, fontSize: 13, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },
  cardText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, lineHeight: 20, marginTop: 8 },
  cardFooter: { marginTop: 16 },
  play: { borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  playText: { color: colors.onGold, fontSize: 17, fontWeight: '900' },
  soon: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  soonText: { color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: '800' },
  dots: { flexDirection: 'row', gap: 8, marginTop: 18 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { width: 22, backgroundColor: colors.gold },
});
