import { useEffect, useRef, useState } from 'react';
import {
  type Avatar,
  defaultAvatar,
  levelProgress,
  parisDay,
  questProgress,
  questsFor,
  seasonOf,
} from '@appli-poker/engine';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
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
import { InstallBanner } from '../components/InstallBanner';
import { Tutorial, tutorialPending } from '../components/Tutorial';
import { AvatarBadge } from '../components/AvatarPicker';
import { achievementsReady } from '../components/Achievements';
import { DailyChallenge } from '../components/DailyChallenge';
import { useMyProgress } from '../online/progress';
import { loadAvatar } from '../online/supabase';
import { PlayingCard } from '../components/PlayingCard';
import { Token } from '../components/Token';
import { BatailleArt } from './BatailleScreen';
import { UnoCard } from '../components/UnoCard';
import { TarotCard } from '../components/TarotCard';
import { colors, gradients, shadow } from '../theme';
import { LANGS, lang, setLang, t } from '../i18n';
import { PAGE_MAX_WIDTH, useDesktop } from '../layout';

export type GameId =
  | 'poker'
  | 'blackjack'
  | 'president'
  | 'yams'
  | 'belote'
  | 'puissance4'
  | 'bataille'
  | 'rami'
  | 'uno'
  | 'huit'
  | 'tarot'
  | 'perudo';

interface Game {
  id: GameId;
  title: string;
  tagline: string;
  players: string;
  /** Cards fanned on the game's card, dice faces for dice games, or 'r'/'y' tokens for Puissance 4. */
  art: string[];
  ready: boolean;
}

const GAMES: Game[] = [
  {
    id: 'poker',
    title: 'Poker',
    tagline: t("Texas Hold'em ou Omaha, en ligne ou sur un seul téléphone."),
    players: t('2 à 8 joueurs'),
    art: ['As', 'Kh', 'Qd'],
    ready: true,
  },
  {
    id: 'blackjack',
    title: 'Blackjack',
    tagline: t('Approche-toi de 21 sans dépasser, contre la banque.'),
    players: t('1 à 7 joueurs'),
    art: ['Ah', 'Js'],
    ready: true,
  },
  {
    id: 'president',
    title: t('Président'),
    tagline: t('Débarrasse-toi de tes cartes le premier pour devenir président.'),
    players: t('3 à 8 joueurs'),
    art: ['2c', '2d', '2h', '2s'],
    ready: true,
  },
  {
    id: 'yams',
    title: 'Yams',
    tagline: t('Cinq dés, trois lancers, une grille de combinaisons à remplir.'),
    players: t('1 à 6 joueurs'),
    art: ['⚄', '⚄', '⚄', '⚀', '⚅'],
    ready: true,
  },
  {
    id: 'belote',
    title: 'Belote',
    tagline: t('Deux équipes, un atout, et la belote-rebelote pour les chanceux.'),
    players: t('4 joueurs'),
    art: ['Jh', '9h', 'Ah', 'Kh', 'Qh'],
    ready: true,
  },
  {
    id: 'puissance4',
    title: t('Puissance 4'),
    tagline: t('Fais tomber tes jetons et aligne-en quatre avant l’autre.'),
    players: t('2 joueurs ou contre le robot'),
    art: ['r', 'y', 'r', 'y', 'r'],
    ready: true,
  },
  {
    id: 'bataille',
    title: t('Bataille navale'),
    tagline: t('Cache ta flotte, tire à l’aveugle et coule tous les navires adverses.'),
    players: t('2 joueurs ou contre le robot'),
    art: [],
    ready: true,
  },
  {
    id: 'rami',
    title: 'Rami',
    tagline: t('Pose tes suites et tes brelans, ouvre à 51 et vide ta main le premier.'),
    players: t('2 à 6 joueurs'),
    art: ['7d', '8d', 'Xr', '9d'],
    ready: true,
  },
  {
    id: 'uno',
    title: 'Uno',
    tagline: t('Couleur ou chiffre, +2, +4 et Joker : crie « Uno ! » avant de gagner.'),
    players: t('2 à 6 joueurs'),
    art: ['bSa', 'y7a', 'wFa', 'rDa', 'g2a'],
    ready: true,
  },
  {
    id: 'huit',
    title: t('8 américain'),
    tagline: t('Le 8 change la couleur, le 2 fait piocher : vide ta main le premier.'),
    players: t('2 à 6 joueurs'),
    art: ['2h', '8s', '8h', 'Jd'],
    ready: true,
  },
  {
    id: 'tarot',
    title: 'Tarot',
    tagline: t('Prends, garde ou passe : seul contre trois, avec les bouts pour alliés.'),
    players: t('4 joueurs'),
    art: ['1t', 'EX', '21t', 'Rh', 'Cs'],
    ready: true,
  },
  {
    id: 'perudo',
    title: 'Perudo',
    tagline: t('Des dés cachés sous les gobelets : surenchéris, bluffe ou crie « Dudo ! ».'),
    players: t('2 à 6 joueurs'),
    art: ['⚀', '⚃', '⚃', '⚀', '⚃'],
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
  onCustomize: () => void;
  onFriends: () => void;
  onTournaments: () => void;
}

function Art({ game }: { game: Game }) {
  if (game.id === 'bataille') return <BatailleArt />;
  if (game.id === 'puissance4') {
    return (
      <View style={styles.tokens}>
        {game.art.map((tok, i) => (
          <Token
            key={i}
            player={tok === 'r' ? 0 : 1}
            size={46}
            style={{ transform: [{ translateY: (i % 2 ? 10 : -8) + Math.abs(i - 2) * 3 }] }}
          />
        ))}
      </View>
    );
  }
  if (game.id === 'yams' || game.id === 'perudo') {
    const perudo = game.id === 'perudo';
    return (
      <View style={styles.dice}>
        {game.art.map((d, i) => (
          <View
            key={i}
            style={[styles.die, perudo && styles.dieRed, { transform: [{ rotate: `${(i - 2) * 9}deg` }] }]}
          >
            <Text style={[styles.dieText, perudo && styles.dieTextRed]}>{d}</Text>
          </View>
        ))}
      </View>
    );
  }
  const mid = (game.art.length - 1) / 2;
  const tarot = game.id === 'tarot';
  if (game.id === 'uno') {
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
            <UnoCard card={c} width={62} />
          </View>
        ))}
      </View>
    );
  }
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
          {tarot ? <TarotCard card={c} width={56} /> : <PlayingCard card={c} width={62} />}
        </View>
      ))}
    </View>
  );
}

/** The first screen: every game in a carousel you swipe through. */
export function GamesScreen({
  canResume,
  onPlay,
  onResume,
  onProfile,
  onShop,
  onCustomize,
  onFriends,
  onTournaments,
}: Props) {
  const insets = useSafeAreaInsets();
  const [tutorial, setTutorial] = useState(tutorialPending);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const desktop = useDesktop();
  const cardHeight = Math.max(300, Math.min(CARD_HEIGHT, screenHeight - 520));
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

  if (desktop) {
    return (
      <DesktopGames
        canResume={canResume}
        onPlay={onPlay}
        onResume={onResume}
        onProfile={onProfile}
        onShop={onShop}
        onCustomize={onCustomize}
        onFriends={onFriends}
        onTournaments={onTournaments}
        tutorial={tutorial}
        onTutorialClose={() => setTutorial(false)}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.chips}>
        <ProfileChip onPress={onProfile} />
        <CoinsChip onPress={onShop} />
        <LangChip />
      </View>
      <Text style={styles.title}>La Tablée</Text>
      <View style={styles.social}>
        <Pressable
          accessibilityRole="button"
          onPress={onFriends}
          style={({ pressed }) => [styles.socialButton, pressed && styles.pressed]}
        >
          <Text style={styles.socialText}>{t('👥 Amis')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onTournaments}
          style={({ pressed }) => [styles.socialButton, pressed && styles.pressed]}
        >
          <Text style={styles.socialText}>{t('🏆 Tournois')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Personnaliser')}
          onPress={onCustomize}
          style={({ pressed }) => [styles.socialButton, pressed && styles.pressed]}
        >
          <Text style={styles.socialText}>{t('🎨 Style')}</Text>
        </Pressable>
        <SeasonPill onPress={onShop} />
      </View>

      <DailyChallenge width={Math.min(viewWidth - 32, 440)} />

      {canResume && (
        <Pressable
          accessibilityRole="button"
          onPress={onResume}
          style={({ pressed }) => [styles.resume, pressed && styles.pressed]}
        >
          <Text style={styles.resumeText}>{t('▶ Reprendre ma table de poker')}</Text>
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
                  accessibilityLabel={
                    game.ready
                      ? t('Jouer : {game}', { game: game.title })
                      : t('{game}, bientôt', { game: game.title })
                  }
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
                        <Text style={styles.playText}>{t('Jouer')}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.soon}>
                        <Text style={styles.soonText}>{t('Bientôt')}</Text>
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

      {!tutorial && <InstallBanner />}
      <Tutorial visible={tutorial} onClose={() => setTutorial(false)} />
    </View>
  );
}

/** Props of the desktop home: the games screen's own, plus the tutorial it owns. */
interface DesktopProps extends Props {
  tutorial: boolean;
  onTutorialClose: () => void;
}

type PressState = { pressed: boolean; hovered?: boolean };

/** Smooth hover movement on the web (ignored elsewhere). */
const HOVER_TRANSITION =
  Platform.OS === 'web'
    ? ({ transitionProperty: 'transform, box-shadow, border-color', transitionDuration: '160ms' } as object)
    : null;

const DESK_PAD = 32;
const DESK_GAP = 18;

/**
 * The home on a computer: a top bar, the challenge and social buttons in a row,
 * then every game at once in a grid instead of the phone's one-card carousel.
 */
function DesktopGames({
  canResume,
  onPlay,
  onResume,
  onProfile,
  onShop,
  onCustomize,
  onFriends,
  onTournaments,
  tutorial,
  onTutorialClose,
}: DesktopProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const pageWidth = Math.min(screenWidth, PAGE_MAX_WIDTH) - 2 * DESK_PAD;
  const columns = pageWidth >= 1100 ? 5 : 4;
  const cardWidth = Math.floor((pageWidth - (columns - 1) * DESK_GAP) / columns);
  const cardHeight = Math.round(Math.max(250, Math.min(cardWidth * 1.3, (screenHeight - 250) / 2)));
  const hoverable =
    (extra?: object) =>
    ({ pressed, hovered }: PressState) => [
      desk.action,
      extra,
      HOVER_TRANSITION,
      hovered && desk.actionHover,
      pressed && styles.pressed,
    ];

  return (
    <View style={desk.root}>
      <ScrollView contentContainerStyle={desk.scroll}>
        <View style={[desk.page, { width: pageWidth }]}>
          <View style={desk.top}>
            <View style={desk.brand}>
              <Text style={desk.logo}>La Tablée</Text>
              <Text style={desk.tagline}>
                {t('12 jeux de cartes, de dés et de plateau à partager entre amis')}
              </Text>
            </View>
            <View style={desk.chips}>
              <ProfileChip onPress={onProfile} />
              <CoinsChip onPress={onShop} />
              <LangChip />
            </View>
          </View>

          <View style={desk.strip}>
            <DailyChallenge width={Math.min(580, Math.round(pageWidth * 0.5))} />
            <View style={desk.actions}>
              {canResume && (
                <Pressable accessibilityRole="button" onPress={onResume} style={hoverable(desk.resume)}>
                  <Text style={styles.resumeText}>{t('▶ Reprendre ma table de poker')}</Text>
                </Pressable>
              )}
              <Pressable accessibilityRole="button" onPress={onFriends} style={hoverable()}>
                <Text style={desk.actionText}>{t('👥 Amis')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onTournaments} style={hoverable()}>
                <Text style={desk.actionText}>{t('🏆 Tournois')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onCustomize} style={hoverable()}>
                <Text style={desk.actionText}>{t('🎨 Personnaliser')}</Text>
              </Pressable>
              <SeasonPill onPress={onShop} style={hoverable()} />
            </View>
          </View>

          <Text style={desk.heading}>{t('Choisis ton jeu')}</Text>
          <View style={desk.grid}>
            {GAMES.map((game) => (
              <DesktopCard
                key={game.id}
                game={game}
                width={cardWidth}
                height={cardHeight}
                onPress={() => game.ready && onPlay(game.id)}
              />
            ))}
          </View>

          <View style={desk.theme}>
            <ThemeChooser />
          </View>
        </View>
      </ScrollView>
      {!tutorial && <InstallBanner />}
      <Tutorial visible={tutorial} onClose={onTutorialClose} />
    </View>
  );
}

/** One game of the desktop grid: its scenery, cards, name, players and a Play button. Lifts on hover. */
function DesktopCard({
  game,
  width,
  height,
  onPress,
}: {
  game: Game;
  width: number;
  height: number;
  onPress: () => void;
}) {
  // Short cards (small windows) drop the tagline; the cards and dice shrink to the room left above the name.
  const tagline = height >= 280;
  const artScale = Math.min(1, width / 290, (height - (tagline ? 190 : 140)) / 125);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        game.ready ? t('Jouer : {game}', { game: game.title }) : t('{game}, bientôt', { game: game.title })
      }
      onPress={onPress}
      style={({ pressed, hovered }: PressState) => [
        styles.card,
        desk.card,
        { width, height },
        HOVER_TRANSITION,
        hovered && desk.cardHover,
        pressed && desk.cardPressed,
      ]}
    >
      {({ hovered }: PressState) => (
        <>
          <GameDecor id={game.id} width={width} height={height} />
          <View style={styles.artBox}>
            <View style={[{ transform: [{ scale: artScale * (hovered ? 1.06 : 1) }] }, HOVER_TRANSITION]}>
              <Art game={game} />
            </View>
          </View>
          <Text style={desk.cardTitle} numberOfLines={1}>
            {game.title}
          </Text>
          <Text style={styles.cardPlayers}>{game.players}</Text>
          {tagline && (
            <Text style={desk.cardText} numberOfLines={2}>
              {game.tagline}
            </Text>
          )}
          {game.ready ? (
            <LinearGradient colors={gradients.gold} style={[desk.play, hovered && desk.playHover]}>
              <Text style={desk.playText}>{t('Jouer')}</Text>
            </LinearGradient>
          ) : (
            <View style={[styles.soon, desk.play]}>
              <Text style={styles.soonText}>{t('Bientôt')}</Text>
            </View>
          )}
        </>
      )}
    </Pressable>
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
      accessibilityLabel={t('Mon profil, niveau {n}', { n: level })}
      onPress={onPress}
      style={({ pressed }) => [styles.profile, pressed && styles.pressed]}
    >
      <AvatarBadge avatar={{ ...avatar, frame: progress?.equipped.frame }} size={40} />
      <View style={styles.profileBody}>
        <Text style={styles.profileLevel}>
          {t('Niveau {n}', { n: level })}
          {progress && progress.streak > 0 ? (
            <Text style={styles.profileStreak}> 🔥{progress.streak}</Text>
          ) : null}
        </Text>
        <View style={styles.profileTrack}>
          <View style={[styles.profileFill, { width: `${Math.max(4, ratio * 100)}%` }]} />
        </View>
      </View>
      <Text style={styles.profileGo}>{t('Profil ›')}</Text>
    </Pressable>
  );
}

/** My coins, and how many finished quests wait to be paid. Opens the shop. */
function CoinsChip({ onPress }: { onPress: () => void }) {
  const progress = useMyProgress();
  const ready = progress
    ? questsFor(parisDay()).filter(
        (q) => questProgress(q, progress.today) >= q.target && !progress.claimed.includes(q.id),
      ).length +
      progress.chests.length +
      achievementsReady(progress)
    : 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        ready
          ? t('{coins} pièces, quêtes et boutique, {n} récompenses à prendre', {
              coins: progress?.coins ?? 0,
              n: ready,
            })
          : t('{coins} pièces, quêtes et boutique', { coins: progress?.coins ?? 0 })
      }
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

/** The flag of the app's language; switches to the next language (the app reloads). */
function LangChip() {
  if (Platform.OS !== 'web') return null;
  const i = LANGS.findIndex((l) => l.id === lang);
  const next = LANGS[(i + 1) % LANGS.length];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${LANGS[i].name} → ${next.name}`}
      onPress={() => setLang(next.id)}
      style={({ pressed }) => [styles.lang, pressed && styles.pressed]}
    >
      <Text style={styles.langFlag}>{LANGS[i].flag}</Text>
    </Pressable>
  );
}

/** The season of the month, with its limited items in the shop. */
function SeasonPill({
  onPress,
  style,
}: {
  onPress: () => void;
  /** The desktop home's bigger button style, with hover. */
  style?: (state: PressState) => unknown;
}) {
  const season = seasonOf();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('Saison {name}, articles limités à la boutique', { name: t(season.name) })}
      onPress={onPress}
      style={(state: PressState) =>
        style ? (style(state) as object) : [styles.socialButton, state.pressed && styles.pressed]
      }
    >
      <LinearGradient
        colors={season.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: style ? 22 : 18 }]}
      />
      <Text style={style ? desk.actionText : styles.socialText}>
        {t('{emoji} Saison', { emoji: season.emoji })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  social: { flexDirection: 'row', gap: 8, marginTop: 12 },
  socialButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  socialText: { color: colors.text, fontSize: 14, fontWeight: '800' },
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
  lang: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  langFlag: { fontSize: 20 },
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
  profileStreak: { color: '#ffb36b', fontSize: 13, fontWeight: '900' },
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
  tokens: { flexDirection: 'row', gap: 3 },
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
  dieRed: { backgroundColor: '#b3261e' },
  dieTextRed: { color: '#fff4e0' },
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

/** The desktop home (see DesktopGames). */
const desk = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', paddingTop: 28, paddingBottom: 40 },
  page: { gap: 0 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24 },
  brand: { flexShrink: 1 },
  logo: { color: colors.gold, fontSize: 40, fontWeight: '900', letterSpacing: 0.5 },
  tagline: { color: colors.muted, fontSize: 15, fontWeight: '600', marginTop: 2 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    marginTop: 12,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  action: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    cursor: 'pointer',
  },
  actionHover: { transform: [{ translateY: -2 }], borderColor: colors.gold },
  actionText: { color: colors.text, fontSize: 16, fontWeight: '800' },
  resume: { backgroundColor: colors.gold, borderColor: colors.goldBorder },
  heading: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 30, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: DESK_GAP },
  card: {
    padding: 16,
    borderRadius: 20,
    cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
  },
  cardHover: {
    transform: [{ translateY: -8 }],
    borderColor: colors.gold,
    boxShadow: '0 18px 34px rgba(0,0,0,0.55)',
  },
  cardPressed: { transform: [{ translateY: -4 }, { scale: 0.98 }] },
  cardTitle: { color: '#fff', fontSize: 26, fontWeight: '900' },
  cardText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 18, marginTop: 6, minHeight: 36 },
  play: { marginTop: 12, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  playHover: { boxShadow: '0 0 16px rgba(255,193,7,0.55)' },
  playText: { color: colors.onGold, fontSize: 16, fontWeight: '900' },
  theme: { width: 440, alignSelf: 'center', marginTop: 16 },
});
