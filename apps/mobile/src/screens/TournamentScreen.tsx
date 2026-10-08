import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  type Avatar,
  type OnlineGameId,
  ALL_AVATAR_EMOJIS,
  cleanAvatar,
  defaultAvatar,
} from '@appli-poker/engine';
import { AvatarBadge, AvatarPicker } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { TopBar } from '../components/TopBar';
import {
  type SavedTournament,
  type Tournament,
  type TournamentPlayer,
  callGames,
  ensureSignedIn,
  forgetTournament,
  loadAvatar,
  loadSavedTournaments,
  saveAvatar,
  saveName,
  saveTournament,
  supabase,
} from '../online/supabase';
import type { TournamentTable } from './OnlineGameScreen';
import { colors, gradients, shadow } from '../theme';

const GAMES: { id: OnlineGameId; title: string; emoji: string }[] = [
  { id: 'blackjack', title: 'Blackjack', emoji: '🂡' },
  { id: 'president', title: 'Président', emoji: '👑' },
  { id: 'yams', title: 'Yams', emoji: '🎲' },
  { id: 'belote', title: 'Belote', emoji: '♠️' },
];
const GAME = Object.fromEntries(GAMES.map((g) => [g.id, g])) as Record<OnlineGameId, (typeof GAMES)[number]>;
const MEDALS = ['🥇', '🥈', '🥉'];
const MAX_GAMES = 8;
/** How often the tournament is reloaded in case a realtime event was missed. */
const POLL_MS = 15_000;

interface Props {
  /** The tournament to show first, when coming back from one of its tables. */
  initialId?: string;
  initialName: string;
  onBack: () => void;
  onPlay: (game: OnlineGameId, tournament: TournamentTable) => void;
}

/** Tournaments between friends: several online games in a row, points added up. */
export function TournamentScreen({ initialId, initialName, onBack, onPlay }: Props) {
  const [openId, setOpenId] = useState<string | null>(initialId ?? null);
  if (openId) {
    return (
      <TournamentView
        id={openId}
        onBack={() => setOpenId(null)}
        onPlay={(game, join) => onPlay(game, { id: openId, join })}
      />
    );
  }
  return <TournamentHome initialName={initialName} onBack={onBack} onOpen={setOpenId} />;
}

function avatarOf(p: TournamentPlayer, i: number): Avatar {
  return cleanAvatar({ emoji: p.avatar, color: p.avatar_color }, defaultAvatar(i), ALL_AVATAR_EMOJIS);
}

function statusLabel(t: Pick<Tournament, 'status' | 'round' | 'games'>) {
  if (t.status === 'finished') return 'Terminé';
  const g = GAME[t.games[t.round]];
  return `Manche ${t.round + 1}/${t.games.length}${g ? ` · ${g.title}` : ''}`;
}

/** The game's emoji on a light token, so the black spade and card stay visible on dark themes. */
function GameIcon({ game, size = 30 }: { game: OnlineGameId; size?: number }) {
  return (
    <View style={[styles.token, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ fontSize: size * 0.6, lineHeight: size * 0.8 }}>{GAME[game]?.emoji ?? '🎮'}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Create, join or reopen a tournament

function TournamentHome({
  initialName,
  onBack,
  onOpen,
}: {
  initialName: string;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState<Avatar>(() => defaultAvatar(Math.floor(Math.random() * 8)));
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [title, setTitle] = useState('');
  const [games, setGames] = useState<OnlineGameId[]>([]);
  const [code, setCode] = useState('');
  const [mine, setMine] = useState<(SavedTournament & Partial<Tournament>)[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAvatar().then((a) => a && setAvatar(cleanAvatar(a, a)));
    loadSavedTournaments().then(async (saved) => {
      setMine(saved);
      if (saved.length === 0) return;
      try {
        await ensureSignedIn();
        const { data } = await supabase
          .from('tournaments')
          .select('id, name, code, status, round, games')
          .in(
            'id',
            saved.map((t) => t.id),
          );
        const byId = new Map(((data ?? []) as Tournament[]).map((t) => [t.id, t]));
        setMine(saved.map((t) => ({ ...t, ...byId.get(t.id) })));
      } catch {
        // The saved names are enough to show the list.
      }
    });
  }, []);

  useEffect(() => setName((n) => n || initialName), [initialName]);

  const trimmed = name.trim();

  async function run(request: () => Promise<{ tournamentId: string; code?: string }>, fallbackName: string) {
    setBusy(true);
    setError(null);
    try {
      const { tournamentId, code: newCode } = await request();
      // The tables of the tournament will use the same name and avatar.
      saveName(trimmed);
      saveAvatar(avatar);
      await saveTournament({ id: tournamentId, name: fallbackName, code: newCode ?? code });
      onOpen(tournamentId);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  function changeAvatar(a: Avatar) {
    setAvatar(a);
    saveAvatar(a);
  }

  const tournamentTitle = title.trim() || 'Tournoi entre amis';
  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 30 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <TopBar onBack={onBack} backLabel="← Jeux" />
      <Text style={styles.trophy}>🏆</Text>
      <Text style={styles.title}>Tournois</Text>
      <Text style={styles.subtitle}>
        Plusieurs jeux à la suite entre amis : 3 points par victoire, 1 point par participation.
      </Text>

      <View style={[styles.card, styles.me]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Changer d'avatar"
          onPress={() => setPickingAvatar(!pickingAvatar)}
        >
          <AvatarBadge avatar={avatar} size={48} />
          <Text style={styles.edit}>✎</Text>
        </Pressable>
        <TextInput
          style={[styles.input, styles.flex]}
          value={name}
          onChangeText={setName}
          maxLength={16}
          placeholder="Ton prénom"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Ton prénom"
        />
      </View>
      {pickingAvatar && <AvatarPicker value={avatar} onChange={changeAvatar} />}

      {mine.length > 0 && (
        <>
          <Text style={styles.section}>Mes tournois</Text>
          {mine.map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityLabel={`Ouvrir le tournoi ${t.name}`}
              onPress={() => onOpen(t.id)}
              style={({ pressed }) => [styles.card, styles.mineRow, pressed && styles.pressed]}
            >
              <Text style={styles.mineIcon}>{t.status === 'finished' ? '🏆' : '🎯'}</Text>
              <View style={styles.flex}>
                <Text style={styles.mineName} numberOfLines={1}>
                  {t.name}
                </Text>
                <Text style={styles.mineDetail} numberOfLines={1}>
                  {t.games && t.round !== undefined && t.status
                    ? statusLabel({ status: t.status, round: t.round, games: t.games })
                    : `Code ${t.code}`}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </>
      )}

      <Text style={styles.section}>Rejoindre avec un code</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.code, styles.codeInput]}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          maxLength={6}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="CODE"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Code du tournoi"
        />
        <View style={styles.joinButton}>
          <Button
            label="Rejoindre"
            disabled={busy || !trimmed || code.trim().length !== 6}
            onPress={() =>
              run(() => callGames({ type: 'tournamentJoin', code, name: trimmed, avatar }), 'Tournoi')
            }
          />
        </View>
      </View>

      <Text style={styles.section}>Créer un tournoi</Text>
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          maxLength={30}
          placeholder="Tournoi entre amis"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Nom du tournoi"
        />
        <Text style={styles.label}>Touche les jeux dans l’ordre où vous les jouerez</Text>
        <View style={styles.chips}>
          {GAMES.map((g) => (
            <Pressable
              key={g.id}
              accessibilityRole="button"
              accessibilityLabel={`Ajouter ${g.title}`}
              disabled={games.length >= MAX_GAMES}
              onPress={() => setGames([...games, g.id])}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <GameIcon game={g.id} size={26} />
              <Text style={styles.chipText}>{g.title}</Text>
              <Text style={styles.chipPlus}>+</Text>
            </Pressable>
          ))}
        </View>
        {games.length === 0 ? (
          <Text style={styles.empty}>Aucun jeu pour l’instant.</Text>
        ) : (
          <View style={styles.sequence}>
            {games.map((id, i) => (
              <View key={`${id}-${i}`} style={styles.step}>
                <Text style={styles.stepNumber}>{i + 1}</Text>
                <GameIcon game={id} />
                <Text style={[styles.stepName, styles.flex]}>{GAME[id].title}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Retirer ${GAME[id].title} (manche ${i + 1})`}
                  hitSlop={8}
                  onPress={() => setGames(games.filter((_, j) => j !== i))}
                >
                  <Text style={styles.remove}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <Text style={[styles.hint, (games.length === 1 || games.length > 6) && styles.warn]}>
          {games.length} manche{games.length > 1 ? 's' : ''} · 2 à 6 jeux conseillés
        </Text>
        <Button
          label="Créer le tournoi"
          disabled={busy || !trimmed || games.length === 0}
          onPress={() =>
            run(
              () =>
                callGames({ type: 'tournamentCreate', title: tournamentTitle, games, name: trimmed, avatar }),
              tournamentTitle,
            )
          }
        />
      </View>
      {!trimmed && <Text style={styles.hint}>Écris ton prénom pour créer ou rejoindre un tournoi.</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// One tournament: its games, the standings and the next table

function useTournament(id: string) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++latestRequest.current;
    try {
      setUserId(await ensureSignedIn());
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    const [t, p] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('tournament_players')
        .select('user_id, name, avatar, avatar_color, points, wins')
        .eq('tournament_id', id),
    ]);
    // A newer refresh started meanwhile: let it win so the screen never goes back in time.
    if (request !== latestRequest.current) return;
    if (t.error || p.error) {
      setError('Connexion perdue, nouvel essai…');
      return;
    }
    if (!t.data) {
      setMissing(true);
      return;
    }
    const sorted = ((p.data ?? []) as TournamentPlayer[])
      .slice()
      .sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
    setTournament(t.data as Tournament);
    setPlayers(sorted);
    setError(null);
    saveTournament({ id, name: t.data.name, code: t.data.code });
  }, [id]);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`tournament:${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournament_players', filter: `tournament_id=eq.${id}` },
        refresh,
      )
      .subscribe((status) => {
        // Catch up on anything missed while the connection was down.
        if (status === 'SUBSCRIBED') refresh();
      });
    const poll = setInterval(refresh, POLL_MS);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [id, refresh]);

  return { tournament, players, userId, error, missing, refresh };
}

function TournamentView({
  id,
  onBack,
  onPlay,
}: {
  id: string;
  onBack: () => void;
  onPlay: (game: OnlineGameId, join?: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { tournament: t, players, userId, error, missing, refresh } = useTournament(id);
  const [copied, setCopied] = useState(false);

  const top = { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 30 };
  if (!t) {
    return (
      <ScrollView contentContainerStyle={[styles.container, top]}>
        <TopBar onBack={onBack} backLabel="← Tournois" />
        <View style={styles.spacer} />
        {missing ? (
          <>
            <Text style={styles.error}>Ce tournoi n’existe plus ou tu n’en fais pas partie.</Text>
            <View style={styles.spacer} />
            <Button
              label="Le retirer de ma liste"
              variant="secondary"
              onPress={() => forgetTournament(id).then(onBack)}
            />
          </>
        ) : error ? (
          <>
            <Text style={styles.error}>{error}</Text>
            <View style={styles.spacer} />
            <Button label="Réessayer" variant="secondary" onPress={refresh} />
          </>
        ) : (
          <ActivityIndicator color={colors.gold} />
        )}
      </ScrollView>
    );
  }

  const finished = t.status === 'finished';
  const isHost = t.host_id === userId;
  const current = t.games[t.round];
  const best = players[0]?.points ?? 0;
  const champions = finished ? players.filter((p) => p.points === best) : [];
  // Players with the same points share a rank.
  const rankOf = (p: TournamentPlayer) => 1 + players.filter((o) => o.points > p.points).length;

  async function shareCode() {
    const message = `Rejoins mon tournoi « ${t!.name} » ! Ouvre Tournois puis « Rejoindre » avec le code : ${t!.code}`;
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (Platform.OS === 'web' && nav && !nav.share && nav.clipboard) {
      try {
        await nav.clipboard.writeText(t!.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Copying can be refused; the code stays on screen.
      }
      return;
    }
    Share.share({ message }).catch(() => {});
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, top]}>
      <TopBar onBack={onBack} backLabel="← Tournois" />

      <View style={[styles.hero, shadow]}>
        <LinearGradient colors={gradients.glass} style={StyleSheet.absoluteFill} />
        <Text style={styles.heroTrophy}>{finished ? '🏆' : '🎯'}</Text>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {t.name}
        </Text>
        <Text style={styles.heroStatus}>
          {finished ? 'Tournoi terminé' : statusLabel(t)} · {players.length} joueur
          {players.length > 1 ? 's' : ''}
        </Text>
        <View style={styles.codeRow}>
          <View>
            <Text style={styles.codeLabel}>Code du tournoi</Text>
            <Text style={styles.bigCode} accessibilityLabel={`Code du tournoi ${t.code}`}>
              {t.code}
            </Text>
          </View>
          {!finished && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Partager le code"
              onPress={shareCode}
              style={({ pressed }) => [styles.share, pressed && styles.pressed]}
            >
              <Text style={styles.shareText}>{copied ? '✓ Copié' : '📤 Partager'}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {finished ? (
        <Podium players={players} champions={champions} rankOf={rankOf} />
      ) : (
        <View style={styles.action}>
          {t.room_code ? (
            <>
              <Button
                label={`Rejoindre la table ${t.room_code}`}
                onPress={() => onPlay(current, t.room_code!)}
              />
              <Text style={styles.hint}>
                {GAME[current]?.title} : la table de la manche {t.round + 1} est ouverte.
              </Text>
            </>
          ) : isHost ? (
            <>
              <Button
                label={`Lancer la manche ${t.round + 1} : ${GAME[current]?.title ?? current}`}
                onPress={() => onPlay(current)}
              />
              <Text style={styles.hint}>Les autres joueurs verront la table apparaître ici.</Text>
            </>
          ) : (
            <Text style={styles.waiting}>
              ⏳ En attente de l’organisateur pour lancer la manche {t.round + 1} : {GAME[current]?.title}
            </Text>
          )}
        </View>
      )}

      <Text style={styles.section}>Programme</Text>
      <View style={[styles.card, styles.program]}>
        {t.games.map((g, i) => {
          const done = finished || i < t.round;
          const now = !finished && i === t.round;
          return (
            <View key={i} style={[styles.step, now && styles.stepNow]}>
              <Text style={[styles.stepMark, done && styles.stepDone, now && styles.stepCurrent]}>
                {done ? '✓' : now ? '▶' : `${i + 1}`}
              </Text>
              <GameIcon game={g} />
              <Text style={[styles.stepName, styles.flex, done && styles.stepNameDone]}>
                {GAME[g]?.title ?? g}
              </Text>
              {now && <Text style={styles.nowTag}>{t.room_code ? 'en cours' : 'à jouer'}</Text>}
            </View>
          );
        })}
      </View>

      <Text style={styles.section}>Classement</Text>
      <View style={[styles.card, styles.board]}>
        {players.map((p, i) => {
          const rank = rankOf(p);
          return (
            <View key={p.user_id} style={[styles.standing, p.user_id === userId && styles.standingMe]}>
              <Text style={styles.rank}>{MEDALS[rank - 1] ?? `${rank}.`}</Text>
              <AvatarBadge avatar={avatarOf(p, i)} size={36} />
              <View style={styles.flex}>
                <Text style={styles.playerName} numberOfLines={1}>
                  {p.name}
                  {p.user_id === userId ? ' (toi)' : ''}
                  {p.user_id === t.host_id ? ' 👑' : ''}
                </Text>
                <Text style={styles.playerDetail}>
                  {p.wins} victoire{p.wins > 1 ? 's' : ''}
                </Text>
              </View>
              <Text style={styles.points}>{p.points}</Text>
              <Text style={styles.pointsUnit}>pts</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.note}>
        Victoire : 3 points · Participation : 1 point. Le champion gagne un grand coffre.
      </Text>
    </ScrollView>
  );
}

function Podium({
  players,
  champions,
  rankOf,
}: {
  players: TournamentPlayer[];
  champions: TournamentPlayer[];
  rankOf: (p: TournamentPlayer) => number;
}) {
  // Second on the left, first in the middle, third on the right.
  const order = [players[1], players[0], players[2]];
  const heights = [70, 100, 50];
  return (
    <View style={[styles.podiumCard, shadow]}>
      <LinearGradient colors={gradients.glass} style={StyleSheet.absoluteFill} />
      <Text style={styles.champion}>
        Champion{champions.length > 1 ? 's' : ''} : {champions.map((p) => p.name).join(' et ')} 🏆
      </Text>
      <View style={styles.podium}>
        {order.map((p, slot) =>
          p ? (
            <View key={p.user_id} style={styles.podiumSlot}>
              <AvatarBadge avatar={avatarOf(p, players.indexOf(p))} size={slot === 1 ? 54 : 42} />
              <Text style={styles.podiumName} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={styles.podiumPoints}>{p.points} pts</Text>
              <View style={[styles.step3d, { height: heights[slot] }]}>
                <LinearGradient
                  colors={slot === 1 ? gradients.gold : gradients.wood}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.podiumMedal}>{MEDALS[rankOf(p) - 1] ?? rankOf(p)}</Text>
              </View>
            </View>
          ) : (
            <View key={slot} style={styles.podiumSlot} />
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, maxWidth: 520, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pressed: { opacity: 0.7 },
  spacer: { height: 24 },
  trophy: { fontSize: 44, textAlign: 'center', marginTop: 4 },
  title: { color: colors.gold, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 4, lineHeight: 19 },
  section: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 22, marginBottom: 8 },
  label: { color: colors.muted, fontSize: 13, marginTop: 10, marginBottom: 6 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 8, textAlign: 'center' },
  warn: { color: colors.gold },
  empty: { color: colors.muted, fontSize: 13, textAlign: 'center', marginVertical: 8, fontStyle: 'italic' },
  error: { color: colors.gold, marginTop: 12, textAlign: 'center' },
  note: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 14, lineHeight: 17 },
  card: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  me: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
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
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  code: { fontSize: 20, letterSpacing: 5, textAlign: 'center', fontWeight: '800' },
  // Without a zero basis the input of react-native-web keeps its default width and pushes the button out.
  codeInput: { flexGrow: 1, flexBasis: 0, minWidth: 0 },
  joinButton: { width: 130 },
  mineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  mineIcon: { fontSize: 24 },
  mineName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  mineDetail: { color: colors.muted, fontSize: 12, marginTop: 1 },
  chevron: { color: colors.gold, fontSize: 26, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  token: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  chipPlus: { color: colors.gold, fontSize: 16, fontWeight: '900' },
  sequence: { marginTop: 12, gap: 6 },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  stepNow: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: colors.gold },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gold,
    color: colors.onGold,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '900',
    fontSize: 13,
    overflow: 'hidden',
  },
  stepMark: { width: 24, textAlign: 'center', color: colors.muted, fontSize: 15, fontWeight: '900' },
  stepDone: { color: '#7bd88f' },
  stepCurrent: { color: colors.gold },
  stepName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  stepNameDone: { color: colors.muted },
  nowTag: { color: colors.gold, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  remove: { color: colors.muted, fontSize: 18, paddingHorizontal: 6 },
  hero: {
    marginTop: 10,
    padding: 16,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: colors.glass,
  },
  heroTrophy: { fontSize: 40 },
  heroTitle: { color: colors.gold, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  heroStatus: { color: colors.muted, fontSize: 14, marginTop: 2, textAlign: 'center' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14 },
  codeLabel: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  bigCode: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: 6, textAlign: 'center' },
  share: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  shareText: { color: colors.text, fontWeight: '800', fontSize: 14 },
  action: { marginTop: 16 },
  waiting: {
    color: colors.text,
    fontSize: 14,
    textAlign: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  program: { gap: 6 },
  board: { gap: 4, paddingVertical: 8 },
  standing: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6, borderRadius: 10 },
  standingMe: { backgroundColor: 'rgba(255,255,255,0.08)' },
  rank: { width: 30, textAlign: 'center', color: colors.muted, fontSize: 17, fontWeight: '900' },
  playerName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  playerDetail: { color: colors.muted, fontSize: 12 },
  points: { color: colors.gold, fontSize: 20, fontWeight: '900' },
  pointsUnit: { color: colors.muted, fontSize: 12, marginLeft: -6, marginTop: 4 },
  podiumCard: {
    marginTop: 16,
    paddingTop: 16,
    paddingHorizontal: 12,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: colors.glass,
  },
  champion: { color: colors.gold, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 14 },
  podiumSlot: { flex: 1, alignItems: 'center' },
  podiumName: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 4, maxWidth: '100%' },
  podiumPoints: { color: colors.muted, fontSize: 12, marginBottom: 6 },
  step3d: {
    width: '100%',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumMedal: { fontSize: 26 },
});
