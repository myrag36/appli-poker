import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type Avatar,
  ELO_START,
  QUICK_GAMES,
  QUICK_GAME_IDS,
  type QuickGameId,
  cleanAvatar,
  defaultAvatar,
  quickRequest,
} from '@appli-poker/engine';
import { AvatarBadge, AvatarPicker } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { Pill } from '../components/LevelPicker';
import { NotifyPrompt } from '../components/Notifications';
import { OpenTablesList, quickGameLook } from '../components/Strangers';
import { reducedMotion } from '../components/Motion';
import {
  QUEUE_FILL_AFTER_MS,
  QUEUE_PING_MS,
  type OpenTable,
  type QueueState,
  fillQueue,
  joinQueue,
  leaveQueue,
  leaveQueueOnClose,
  pingQueue,
  useMyRatings,
  waitedLabel,
} from '../online/rapide';
import { loadAvatar, loadName, saveAvatar, saveName } from '../online/supabase';
import { tMessage } from '../online/messages';
import { sounds } from '../feedback';
import { colors } from '../theme';
import { useDesktop } from '../layout';
import { t, tn } from '../i18n';

interface Props {
  /** The game chosen beforehand (from a game's online page). */
  initialGame?: QuickGameId;
  initialName: string;
  onBack: () => void;
  /** A table was found and dealt: go and play. */
  onMatched: (game: QuickGameId, roomId: string, code: string, name: string) => void;
  /** A public table picked in "Tables ouvertes". */
  onJoinTable: (table: OpenTable) => void;
}

type Phase = 'pick' | 'search' | 'found';

/** "⚡ Partie rapide": choose a game, wait a few seconds, play with strangers of your level. */
export function QuickMatchScreen({ initialGame, initialName, onBack, onMatched, onJoinTable }: Props) {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const ratings = useMyRatings();
  const [game, setGame] = useState<QuickGameId>(initialGame ?? 'uno');
  const [size, setSize] = useState(QUICK_GAMES[initialGame ?? 'uno'].size);
  const [variant, setVariant] = useState(quickRequest(initialGame ?? 'uno').variant);
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState<Avatar>(() => defaultAvatar(Math.floor(Math.random() * 8)));
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [phase, setPhase] = useState<Phase>('pick');
  const [queue, setQueue] = useState<QueueState | null>(null);
  /** When the last answer arrived (phone clock), to count the time waited between answers. */
  const [answeredAt, setAnsweredAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phaseRef = useRef<Phase>('pick');
  const lastRejoin = useRef(0);
  phaseRef.current = phase;

  useEffect(() => {
    loadAvatar().then((a) => a && setAvatar(cleanAvatar(a, a)));
    loadName().then((n) => n && setName((old) => old || n));
  }, []);

  function choose(g: QuickGameId) {
    setGame(g);
    setSize(QUICK_GAMES[g].size);
    setVariant(quickRequest(g).variant);
  }

  const trimmed = name.trim();
  const request = { game, size, variant, name: trimmed, avatar };

  function answer(s: QueueState) {
    setAnsweredAt(Date.now());
    if (s.status === 'matched' && s.roomId && s.code) {
      setQueue(s);
      if (phaseRef.current === 'found') return;
      setPhase('found');
      phaseRef.current = 'found';
      sounds.win();
      const { roomId, code } = s;
      const found = s.game ?? game;
      setTimeout(() => onMatched(found, roomId, code, trimmed), reducedMotion() ? 200 : 1200);
      return;
    }
    if (s.status === 'none') {
      // My search was forgotten (the phone slept too long): search again, once in a while.
      if (phaseRef.current === 'search' && Date.now() - lastRejoin.current > 10_000) {
        lastRejoin.current = Date.now();
        joinQueue(request).then(answer, () => {});
      }
      return;
    }
    setQueue(s);
  }

  async function start() {
    setError(null);
    setBusy(true);
    try {
      await saveName(trimmed);
      await saveAvatar(avatar);
      setQueue(null);
      setPhase('search');
      phaseRef.current = 'search';
      lastRejoin.current = Date.now();
      answer(await joinQueue(request));
    } catch (e) {
      setPhase('pick');
      setError(tMessage((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  /** A public table: sits down with my name and avatar (the table screen reads them back). */
  async function joinTable(table: OpenTable) {
    if (trimmed) await saveName(trimmed);
    await saveAvatar(avatar);
    onJoinTable(table);
  }

  async function cancel() {
    setPhase('pick');
    phaseRef.current = 'pick';
    setQueue(null);
    await leaveQueue().catch(() => {});
  }

  async function fill() {
    setBusy(true);
    setError(null);
    try {
      answer(await fillQueue());
    } catch (e) {
      setError(tMessage((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  // While searching: a ping every few seconds keeps my place and brings the news.
  useEffect(() => {
    if (phase !== 'search') return;
    const ping = setInterval(() => {
      pingQueue().then(
        (s) => {
          setError(null);
          answer(s);
        },
        () => setError(t('Connexion perdue, nouvel essai…')),
      );
    }, QUEUE_PING_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(ping);
      clearInterval(clock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Leaving the screen or closing the page stops the search, so nobody is seated with a ghost.
  useEffect(() => {
    const onHide = () => phaseRef.current === 'search' && leaveQueueOnClose();
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.addEventListener('pagehide', onHide);
    return () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.removeEventListener('pagehide', onHide);
      if (phaseRef.current === 'search') leaveQueue().catch(() => {});
    };
  }, []);

  const look = quickGameLook(game);
  const def = QUICK_GAMES[game];
  const myRating = ratings[game];

  if (phase !== 'pick') {
    const waited = (queue?.waited ?? 0) + (queue ? Math.max(0, now - answeredAt) : 0);
    const need = (queue?.size ?? size) - 1;
    const found = Math.min(need, queue?.found ?? 0);
    const canFill = phase === 'search' && (queue?.canFill || waited >= QUEUE_FILL_AFTER_MS);
    return (
      <ScrollView
        contentContainerStyle={[
          styles.container,
          styles.searchContainer,
          desktop && styles.column,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Radar emoji={look.emoji} found={phase === 'found'} />
        <Text style={styles.searchTitle}>
          {phase === 'found' ? t('🎉 Adversaire trouvé !') : t('Recherche de joueurs…')}
        </Text>
        <Text style={styles.searchGame}>
          {look.title} · {tn(queue?.size ?? size, '{n} joueur', '{n} joueurs')}
          {game === 'poker' ? ` · ${variant === 'omaha' ? 'Omaha' : "Hold'em"}` : ''}
        </Text>

        <View style={styles.seats} accessibilityLabel={t('{found} sur {need} joueurs trouvés', { found, need })}>
          <AvatarBadge avatar={avatar} size={46} />
          {Array.from({ length: need }, (_, i) => (
            <View key={i} style={[styles.seat, (i < found || phase === 'found') && styles.seatFound]}>
              <Text style={styles.seatText}>{i < found || phase === 'found' ? '👤' : '?'}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.foundText}>
          {phase === 'found'
            ? t('La partie commence…')
            : tn(found, '{n} joueur trouvé sur {need}', '{n} joueurs trouvés sur {need}', { need })}
        </Text>
        <Text style={styles.clock} accessibilityLabel={t('Temps d’attente')}>
          ⏱ {waitedLabel(waited)}
        </Text>
        <Text style={styles.searchHint}>
          {t('Ta cote : {rating}. On cherche d’abord des joueurs de ton niveau, puis plus large.', {
            rating: queue?.rating ?? myRating?.rating ?? ELO_START,
          })}
        </Text>

        {canFill && (
          <View style={styles.fillCard}>
            <Text style={styles.fillTitle}>{t('Pas assez de monde pour l’instant ?')}</Text>
            <Text style={styles.fillText}>
              {found > 0
                ? t('Lance avec les joueurs trouvés : des robots prennent les places libres.')
                : t('Lance contre des robots : la partie ne comptera pas pour la cote.')}
            </Text>
            <Button label={t('🤖 Compléter avec des robots')} disabled={busy} onPress={fill} />
            <Text style={styles.fillText}>{t('La recherche continue en attendant.')}</Text>
          </View>
        )}

        {phase === 'search' && (
          <NotifyPrompt
            title={t('Être prévenu quand un adversaire est trouvé ?')}
            text={t('Une notification si l’appli est en arrière-plan quand ta partie commence.')}
          />
        )}
        {error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.spacer} />
        {phase === 'search' && (
          <View style={styles.cancel}>
            <Button label={t('Annuler la recherche')} variant="secondary" onPress={cancel} />
          </View>
        )}
      </ScrollView>
    );
  }

  const picker = (
    <>
      <Text style={[styles.label, desktop && styles.labelFirst]}>{t('Ton prénom et ton avatar')}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Changer d'avatar")}
          onPress={() => setPickingAvatar(!pickingAvatar)}
        >
          <AvatarBadge avatar={avatar} size={44} />
          <Text style={styles.edit}>✎</Text>
        </Pressable>
        <TextInput
          style={[styles.input, styles.flex]}
          value={name}
          onChangeText={setName}
          maxLength={16}
          placeholder={t('Ton prénom')}
          placeholderTextColor={colors.muted}
        />
      </View>
      {pickingAvatar && (
        <AvatarPicker
          value={avatar}
          onChange={(a) => {
            setAvatar(a);
            saveAvatar(a);
          }}
        />
      )}

      <Text style={styles.section}>{t('Choisis ton jeu')}</Text>
      <View style={styles.games}>
        {QUICK_GAME_IDS.map((g) => {
          const l = quickGameLook(g);
          const active = g === game;
          return (
            <Pressable
              key={g}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => choose(g)}
              style={({ pressed }) => [
                styles.gameTile,
                desktop && styles.gameTileDesktop,
                active && styles.gameTileActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.gameEmoji}>{l.emoji}</Text>
              <Text style={[styles.gameName, active && styles.gameNameActive]} numberOfLines={1}>
                {l.title}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {(def.sizes.length > 1 || def.variants) && (
        <View style={styles.options}>
          {def.sizes.length > 1 && (
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>{t('Joueurs')}</Text>
              {def.sizes.map((n) => (
                <Pill key={n} label={String(n)} active={n === size} onPress={() => setSize(n)} />
              ))}
            </View>
          )}
          {def.variants && (
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>{t('Variante')}</Text>
              <Pill label="Hold'em" active={variant === 'holdem'} onPress={() => setVariant('holdem')} />
              <Pill label="Omaha" active={variant === 'omaha'} onPress={() => setVariant('omaha')} />
            </View>
          )}
        </View>
      )}
      <Text style={styles.ratingLine}>
        {myRating
          ? t('Ta cote {game} : {rating} · {played}', {
              game: look.title,
              rating: myRating.rating,
              played: tn(myRating.games, '{n} partie', '{n} parties'),
            })
          : t('Ta cote {game} : {rating} (première partie classée)', { game: look.title, rating: ELO_START })}
      </Text>
      <View style={styles.spacerSmall} />
      <Button
        label={t('⚡ Chercher une partie de {game}', { game: look.title })}
        disabled={busy || !trimmed}
        onPress={start}
      />
      <Text style={styles.hint}>
        {t('Des joueurs de ton niveau, en quelques secondes. Seuls ton pseudo, ton avatar et ton niveau sont visibles.')}
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}
    </>
  );

  const open = (
    <>
      <Text style={[styles.section, desktop && styles.sectionFirst]}>{t('🌍 Tables ouvertes')}</Text>
      <Text style={styles.subHint}>{t('Des tables publiques qui attendent des joueurs : un geste pour s’asseoir.')}</Text>
      <OpenTablesList onJoin={joinTable} />
    </>
  );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        desktop && styles.wide,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={10} style={styles.back}>
        <Text style={styles.backText}>{t('← Retour')}</Text>
      </Pressable>
      <Text style={[styles.title, desktop && styles.titleLarge]}>{t('⚡ Partie rapide')}</Text>
      <Text style={styles.subtitle}>{t('Joue en ligne tout de suite avec d’autres joueurs.')}</Text>
      {desktop ? (
        <View style={styles.columns}>
          <View style={[styles.card, styles.cardMain]}>{picker}</View>
          <View style={[styles.card, styles.cardSide]}>{open}</View>
        </View>
      ) : (
        <>
          {picker}
          {open}
        </>
      )}
    </ScrollView>
  );
}

/** Rings growing out of the game's emoji while the search goes on; still once found. */
function Radar({ emoji, found }: { emoji: string; found: boolean }) {
  const rings = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (found || reducedMotion()) return;
    const native = Platform.OS !== 'web';
    const loops = rings.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 700),
          Animated.timing(v, { toValue: 1, duration: 2100, easing: Easing.out(Easing.quad), useNativeDriver: native }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: native }),
        ]),
      ),
    );
    const turn = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: native }),
    );
    loops.forEach((l) => l.start());
    turn.start();
    return () => {
      loops.forEach((l) => l.stop());
      turn.stop();
    };
  }, [found, rings, spin]);
  return (
    <View style={styles.radar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {!found &&
        rings.map((v, i) => (
          <Animated.View
            key={i}
            style={[
              styles.ring,
              {
                opacity: v.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.7, 0] }),
                transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.25] }) }],
              },
            ]}
          />
        ))}
      {!found && (
        <Animated.View
          style={[
            styles.sweep,
            { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
          ]}
        />
      )}
      <View style={[styles.core, found && styles.coreFound]}>
        <Text style={styles.coreEmoji}>{found ? '🎉' : emoji}</Text>
      </View>
    </View>
  );
}

const RADAR = 200;

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  wide: { width: '100%', maxWidth: 1040, alignSelf: 'center', paddingHorizontal: 32 },
  back: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  title: { color: colors.gold, fontSize: 30, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  titleLarge: { fontSize: 38 },
  subtitle: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 4 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 22, marginTop: 24 },
  card: {
    padding: 22,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  },
  cardMain: { flex: 3, minWidth: 0 },
  cardSide: { flex: 2, minWidth: 0 },
  label: { color: colors.muted, marginTop: 18, marginBottom: 4 },
  labelFirst: { marginTop: 0 },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 22, marginBottom: 10 },
  sectionFirst: { marginTop: 0 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  flex: { flex: 1 },
  edit: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    color: colors.onGold,
    backgroundColor: colors.gold,
    borderRadius: 9,
    width: 18,
    height: 18,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 18,
    overflow: 'hidden',
  },
  input: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginVertical: 4,
  },
  games: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gameTile: {
    width: '31.5%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  gameTileDesktop: { width: '18%' },
  gameTileActive: { borderColor: colors.gold, backgroundColor: 'rgba(255, 193, 7, 0.16)' },
  gameEmoji: { fontSize: 24 },
  gameName: { color: colors.text, fontSize: 13, fontWeight: '600' },
  gameNameActive: { color: colors.gold, fontWeight: '800' },
  pressed: { opacity: 0.75 },
  options: { gap: 8, marginTop: 14 },
  optionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  optionLabel: { color: colors.muted, fontSize: 14, width: 70 },
  ratingLine: { color: colors.muted, fontSize: 13, marginTop: 12, textAlign: 'center' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 8, textAlign: 'center' },
  subHint: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: -4, marginBottom: 10 },
  error: { color: colors.gold, marginTop: 12, textAlign: 'center' },
  spacer: { height: 20 },
  spacerSmall: { height: 8 },
  searchContainer: { alignItems: 'center' },
  radar: { width: RADAR, height: RADAR, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  ring: {
    position: 'absolute',
    width: RADAR,
    height: RADAR,
    borderRadius: RADAR / 2,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  sweep: {
    position: 'absolute',
    width: RADAR * 0.72,
    height: RADAR * 0.72,
    borderRadius: RADAR * 0.36,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: colors.gold,
    opacity: 0.8,
  },
  core: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 2,
    borderColor: colors.goldBorder,
    boxShadow: '0 0 30px rgba(255, 193, 7, 0.35)',
  },
  coreFound: { backgroundColor: 'rgba(255, 193, 7, 0.25)', borderColor: colors.gold },
  coreEmoji: { fontSize: 44 },
  searchTitle: { color: colors.gold, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  searchGame: { color: colors.text, fontSize: 15, marginTop: 4, textAlign: 'center' },
  seats: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' },
  seat: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.glassBorder,
  },
  seatFound: { borderStyle: 'solid', borderColor: colors.gold, backgroundColor: 'rgba(255, 193, 7, 0.18)' },
  seatText: { color: colors.muted, fontSize: 20, fontWeight: '700' },
  foundText: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  clock: { color: colors.muted, fontSize: 22, fontWeight: '700', marginTop: 6, fontVariant: ['tabular-nums'] },
  searchHint: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 10, textAlign: 'center', maxWidth: 360 },
  fillCard: {
    alignSelf: 'stretch',
    gap: 6,
    marginTop: 18,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  fillTitle: { color: colors.gold, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  fillText: { color: colors.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  cancel: { alignSelf: 'stretch' },
});
