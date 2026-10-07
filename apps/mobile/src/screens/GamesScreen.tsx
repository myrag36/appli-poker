import { useRef, useState } from 'react';
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
  tint: [string, string];
  ready: boolean;
}

const GAMES: Game[] = [
  {
    id: 'poker',
    title: 'Poker',
    tagline: "Texas Hold'em ou Omaha, en ligne ou sur un seul téléphone.",
    players: '2 à 8 joueurs',
    art: ['As', 'Kh', 'Qd'],
    tint: ['#1f7a4d', '#0b3d26'],
    ready: true,
  },
  {
    id: 'blackjack',
    title: 'Blackjack',
    tagline: 'Approche-toi de 21 sans dépasser, contre la banque.',
    players: '1 à 7 joueurs',
    art: ['Ah', 'Js'],
    tint: ['#8a2a2a', '#3d0f0f'],
    ready: false,
  },
  {
    id: 'president',
    title: 'Président',
    tagline: 'Débarrasse-toi de tes cartes le premier pour devenir président.',
    players: '3 à 8 joueurs',
    art: ['2c', '2d', '2h', '2s'],
    tint: ['#2f4f8a', '#10203d'],
    ready: false,
  },
  {
    id: 'yams',
    title: 'Yams',
    tagline: 'Cinq dés, trois lancers, une grille de combinaisons à remplir.',
    players: '1 à 6 joueurs',
    art: ['⚄', '⚄', '⚄', '⚀', '⚅'],
    tint: ['#7a5a1f', '#3d2a0b'],
    ready: false,
  },
  {
    id: 'belote',
    title: 'Belote',
    tagline: 'Deux équipes, un atout, et la belote-rebelote pour les chanceux.',
    players: '4 joueurs',
    art: ['Jh', '9h', 'Ah', 'Kh', 'Qh'],
    tint: ['#5a2f7a', '#250f3d'],
    ready: false,
  },
];

const GAP = 14;

interface Props {
  canResume: boolean;
  onPlay: (game: GameId) => void;
  onResume: () => void;
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
export function GamesScreen({ canResume, onPlay, onResume }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
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
                  accessibilityLabel={game.ready ? `Jouer au ${game.title}` : `${game.title}, bientôt`}
                  onPress={() => (i === index ? game.ready && onPlay(game.id) : goTo(i))}
                  style={[styles.card, shadow]}
                >
                  <LinearGradient colors={game.tint} style={StyleSheet.absoluteFill} />
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
    </View>
  );
}

const styles = StyleSheet.create({
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
    height: 420,
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
