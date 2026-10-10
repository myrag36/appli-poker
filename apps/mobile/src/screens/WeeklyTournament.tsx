// The Friday tournament: every Friday at 21:00 (Paris time), a knockout bracket on one online
// game. A card with the countdown and the sign-up, and a page with the bracket and the champions.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  type Avatar,
  type OnlineGameId,
  type WeeklyEntrant,
  type WeeklyMatch,
  ALL_AVATAR_EMOJIS,
  WEEKLY_COINS,
  cleanAvatar,
  defaultAvatar,
  isOnlineGame,
  weeklyKnockedOut,
  weeklyMatchOf,
  weeklyRoundName,
} from '@appli-poker/engine';
import { AvatarBadge } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { TitleBadge } from '../components/TitleBadge';
import { TopBar } from '../components/TopBar';
import {
  type WeeklyInfo,
  type WeeklyPerson,
  type WeeklyState,
  callGames,
  ensureSignedIn,
  loadAvatar,
  loadName,
  saveName,
} from '../online/supabase';
import { ONLINE_UI } from '../online-games';
import { locale, t, tn } from '../i18n';
import { useDesktop } from '../layout';
import { colors, gradients, shadow } from '../theme';

/** The server is asked again this often: it is also what moves the tournament on. */
const POLL_MS = 15_000;

export function weeklyGameTitle(game: string): string {
  return isOnlineGame(game) ? t(ONLINE_UI[game].title) : game;
}

function gameEmoji(game: string): string {
  return isOnlineGame(game) ? ONLINE_UI[game].emoji : '🎮';
}

function avatarOf(p: { avatar?: string | null; avatar_color?: string | null; bot?: boolean }, i = 0): Avatar {
  if (p.bot) return { emoji: '🤖', color: p.avatar_color ?? '#90be6d' };
  return cleanAvatar({ emoji: p.avatar, color: p.avatar_color }, defaultAvatar(i), ALL_AVATAR_EMOJIS);
}

/** Time left, short: "2 j 5 h", "3 h 12 min", "08:41". */
export function timeLeft(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return t('{d} j {h} h', { d, h });
  if (h > 0) return t('{h} h {m} min', { h, m });
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function fridayLabel(friday: string): string {
  return new Date(`${friday}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** The Friday tournament from the server, asked again regularly (this moves it on too). */
export function useWeekly() {
  const [state, setState] = useState<WeeklyState | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const offset = useRef(0);
  const latest = useRef(0);

  const apply = useCallback((next: WeeklyState) => {
    offset.current = next.now - Date.now();
    setState(next);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    const request = ++latest.current;
    try {
      setUserId(await ensureSignedIn());
      const next = await callGames<WeeklyState>({ type: 'weekly' });
      if (request === latest.current) apply(next);
    } catch (e) {
      if (request === latest.current) setError((e as Error).message);
    }
  }, [apply]);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, POLL_MS);
    return () => clearInterval(poll);
  }, [refresh]);

  async function act(request: () => Promise<WeeklyState>) {
    setBusy(true);
    try {
      latest.current++;
      apply(await request());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function register(name?: string, avatar?: Avatar) {
    const [savedName, savedAvatar] = await Promise.all([loadName(), loadAvatar()]);
    const who = (name ?? savedName ?? '').trim();
    if (!who) {
      setError(t('Écris ton prénom pour t’inscrire.'));
      return;
    }
    saveName(who);
    const look = avatar ?? (savedAvatar ? cleanAvatar(savedAvatar, savedAvatar) : defaultAvatar(0));
    await act(() => callGames<WeeklyState>({ type: 'weeklyRegister', name: who, avatar: look }));
  }

  const unregister = () => act(() => callGames<WeeklyState>({ type: 'weeklyUnregister' }));

  return { state, userId, error, busy, refresh, register, unregister, offset };
}

/** A clock that ticks every second, on the server's time. */
function useNow(offset: { current: number }) {
  const [now, setNow] = useState(() => Date.now() + offset.current);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => clearInterval(timer);
  }, [offset]);
  return now;
}

/** My match in a tournament being played, and what to tell me about it. */
function myMatch(info: WeeklyInfo | null, userId: string | null) {
  if (!info?.bracket || !userId || !info.entrants.some((e) => e.id === userId)) return null;
  const match = weeklyMatchOf(info.bracket, userId);
  const out = weeklyKnockedOut(info.bracket, userId);
  const champion = info.winner?.id === userId;
  return { match, out, champion };
}

/** The first round still being played. */
function liveRound(bracket: WeeklyInfo['bracket']): number {
  if (!bracket) return 0;
  const r = bracket.rounds.findIndex((round) => round.some((m) => !m.winner));
  return r < 0 ? bracket.rounds.length - 1 : r;
}

function opponentOf(m: WeeklyMatch, userId: string): WeeklyEntrant | null {
  return m.a?.id === userId ? m.b : m.a;
}

function GameToken({ game, size = 40 }: { game: string; size?: number }) {
  return (
    <View style={[styles.token, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ fontSize: size * 0.58, lineHeight: size * 0.78 }}>{gameEmoji(game)}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The card: countdown, game, sign-ups, register button

interface CardProps {
  weekly: ReturnType<typeof useWeekly>;
  /** Name and avatar to sign up with (the tournaments screen has them); saved ones otherwise. */
  name?: string;
  avatar?: Avatar;
  /** Opens the bracket page; absent on that page. */
  onOpen?: () => void;
  onPlay: (game: OnlineGameId, code: string) => void;
}

export function WeeklyCard({ weekly, name, avatar, onOpen, onPlay }: CardProps) {
  const { state, userId, error, busy, register, unregister, offset, refresh } = weekly;
  const now = useNow(offset);
  const desktop = useDesktop();

  if (!state) {
    return (
      <View style={[styles.card, styles.cardLoading]}>
        <Text style={styles.kicker}>{t('🏆 Tournoi du vendredi')}</Text>
        {error ? (
          <>
            <Text style={styles.error}>{error}</Text>
            <Button label={t('Réessayer')} variant="secondary" compact onPress={refresh} />
          </>
        ) : (
          <ActivityIndicator color={colors.gold} />
        )}
      </View>
    );
  }

  const next = state.upcoming;
  const current = state.current;
  const mine = myMatch(current, userId);
  const live = current?.status === 'running';
  const left = next.startsAt - now;
  const trimmed = name?.trim();
  const shownGame = live ? current!.game : next.game;

  const status = live ? (
    <View style={styles.liveBox}>
      <View style={styles.liveRow}>
        <Text style={styles.liveDot}>●</Text>
        <Text style={styles.liveText}>{tn(current!.registered, '{n} joueur', '{n} joueurs')}</Text>
      </View>
      {mine?.match?.code && mine.match.roomId && opponentOf(mine.match, userId!) ? (
        <Button
          label={t('Jouer mon match contre {name}', { name: opponentOf(mine.match, userId!)!.name })}
          onPress={() => isOnlineGame(current!.game) && onPlay(current!.game, mine.match!.code!)}
        />
      ) : mine?.match ? (
        <Text style={styles.liveHint}>
          {t('⏳ Tu es qualifié·e : ton prochain adversaire termine son match.')}
        </Text>
      ) : mine?.out ? (
        <Text style={styles.liveHint}>{t('Tu es éliminé·e. Suis la suite du tableau !')}</Text>
      ) : null}
    </View>
  ) : current?.status === 'finished' && current.winner ? (
    <View style={styles.liveBox}>
      <View style={styles.liveRow}>
        <AvatarBadge avatar={avatarOf(current.winner)} size={30} />
        <Text style={[styles.liveText, styles.flex]} numberOfLines={2}>
          {current.winner.id === userId
            ? t('Tu as remporté le tournoi de {game} ! 🏆', { game: weeklyGameTitle(current.game) })
            : t('{name} a remporté le tournoi de {game} 🏆', {
                name: current.winner.name,
                game: weeklyGameTitle(current.game),
              })}
        </Text>
      </View>
    </View>
  ) : null;

  return (
    <View style={[styles.card, styles.hero, shadow, desktop && styles.heroDesktop]}>
      <LinearGradient colors={gradients.glass} style={StyleSheet.absoluteFill} />
      <View style={[styles.heroTop, desktop && styles.heroTopDesktop]}>
        <View style={styles.heroIdentity}>
          <GameToken game={shownGame} size={desktop ? 58 : 48} />
          <View style={styles.flex}>
            <Text style={styles.kicker}>{t('🏆 Tournoi du vendredi')}</Text>
            <Text style={styles.heroGame} numberOfLines={1}>
              {weeklyGameTitle(shownGame)}
            </Text>
            <Text style={styles.heroWhen}>
              {t('{day} à 21 h · élimination directe', {
                day: fridayLabel(live ? current!.friday : next.friday),
              })}
            </Text>
          </View>
        </View>
        {live ? (
          <View style={[styles.countdown, styles.countdownLive, desktop && styles.countdownDesktop]}>
            <Text style={styles.countdownLabel}>
              <Text style={styles.liveDot}>● </Text>
              {t('En direct')}
            </Text>
            <Text style={styles.countdownRound} numberOfLines={1}>
              {t(weeklyRoundName(liveRound(current!.bracket), current!.bracket?.rounds.length ?? 1))}
            </Text>
          </View>
        ) : (
          <View style={[styles.countdown, desktop && styles.countdownDesktop]}>
            <Text style={styles.countdownLabel}>{t('Début dans')}</Text>
            <Text style={styles.countdownValue} accessibilityLiveRegion="polite">
              {timeLeft(left)}
            </Text>
          </View>
        )}
      </View>

      {live ? (
        status
      ) : (
        <View style={[styles.signupRow, desktop && styles.signupRowDesktop]}>
          <View style={styles.entrants}>
            <View style={styles.faces}>
              {next.entrants.slice(0, 5).map((e, i) => (
                <View key={e.id} style={[styles.face, i > 0 && styles.faceOverlap]}>
                  <AvatarBadge avatar={avatarOf(e, i)} size={28} />
                </View>
              ))}
            </View>
            <Text style={styles.entrantsText}>
              {next.registered === 0
                ? t('Personne d’inscrit pour l’instant')
                : tn(next.registered, '{n} inscrit', '{n} inscrits')}
            </Text>
          </View>
          <View style={[styles.signupButton, desktop && styles.signupButtonDesktop]}>
            {next.me ? (
              <View style={styles.registered}>
                <Text style={styles.registeredText}>{t('✓ Inscrit·e')}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={unregister}
                  disabled={busy}
                  hitSlop={8}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.unregister}>{t('Me désinscrire')}</Text>
                </Pressable>
              </View>
            ) : (
              <Button
                label={t('Je m’inscris')}
                disabled={busy || (name !== undefined && !trimmed)}
                onPress={() => register(trimmed || undefined, avatar)}
              />
            )}
          </View>
        </View>
      )}
      {!live && name !== undefined && !trimmed && !next.me && (
        <Text style={styles.hint}>{t('Écris ton prénom pour t’inscrire.')}</Text>
      )}

      {!live && status}
      {live && (
        <Text style={styles.nextLine}>
          {t('Prochain tournoi : {game}, {day} à 21 h', {
            game: weeklyGameTitle(next.game),
            day: fridayLabel(next.friday),
          })}
        </Text>
      )}

      <View style={styles.rewardRow}>
        <Text style={styles.rewardText}>
          {t('Le champion gagne {coins} pièces et le titre', { coins: WEEKLY_COINS })}
        </Text>
        <TitleBadge id="vendredi" small />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {onOpen && (
        <Pressable
          accessibilityRole="button"
          onPress={onOpen}
          style={({ pressed }) => [styles.openLink, pressed && styles.pressed]}
        >
          <Text style={styles.openText}>
            {live ? t('Voir le tableau en direct ›') : t('Tableau et palmarès ›')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The bracket

function EntrantRow({
  e,
  won,
  lost,
  me,
  index,
}: {
  e: WeeklyEntrant | null;
  won: boolean;
  lost: boolean;
  me: boolean;
  index: number;
}) {
  return (
    <View style={[styles.entrant, won && styles.entrantWon]}>
      {e ? <AvatarBadge avatar={avatarOf(e, index)} size={22} /> : <View style={styles.entrantEmpty} />}
      <Text
        style={[
          styles.entrantName,
          me && styles.entrantMe,
          lost && styles.entrantLost,
          !e && styles.entrantTbd,
        ]}
        numberOfLines={1}
      >
        {e ? e.name : t('à venir')}
      </Text>
      {won && <Text style={styles.entrantCheck}>✓</Text>}
    </View>
  );
}

const MATCH_H = 64;
const GAP_V = 14;
const HEADER_H = 28;

function Bracket({
  info,
  userId,
  onPlay,
}: {
  info: WeeklyInfo;
  userId: string | null;
  onPlay: (game: OnlineGameId, code: string) => void;
}) {
  const desktop = useDesktop();
  const bracket = info.bracket!;
  const colW = desktop ? 196 : 158;
  const gapH = desktop ? 40 : 26;
  const unit = MATCH_H + GAP_V;
  const rounds = bracket.rounds.length;
  const height = bracket.rounds[0].length * unit;
  const width = rounds * colW + (rounds - 1) * gapH;
  const top = (r: number, s: number) => HEADER_H + (s * 2 ** r + (2 ** r - 1) / 2) * unit;
  const left = (r: number) => r * (colW + gapH);
  const lines: { key: string; style: object }[] = [];
  bracket.rounds.forEach((round, r) => {
    if (r === 0) return;
    round.forEach((m, s) => {
      const y1 = top(r - 1, 2 * s) + MATCH_H / 2;
      const y2 = top(r - 1, 2 * s + 1) + MATCH_H / 2;
      const x = left(r - 1) + colW;
      const mid = x + gapH / 2;
      lines.push(
        { key: `${r}-${s}-a`, style: { left: x, top: y1, width: gapH / 2, height: 2 } },
        { key: `${r}-${s}-b`, style: { left: x, top: y2, width: gapH / 2, height: 2 } },
        { key: `${r}-${s}-v`, style: { left: mid, top: y1, width: 2, height: y2 - y1 + 2 } },
        { key: `${r}-${s}-c`, style: { left: mid, top: (y1 + y2) / 2, width: gapH / 2, height: 2 } },
      );
    });
  });

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.bracketScroll}>
      <View style={{ width, height: height + HEADER_H }}>
        {bracket.rounds.map((_, r) => (
          <Text key={r} style={[styles.roundName, { left: left(r), width: colW }]} numberOfLines={1}>
            {t(weeklyRoundName(r, rounds))}
          </Text>
        ))}
        {lines.map((l) => (
          <View key={l.key} style={[styles.line, l.style]} />
        ))}
        {bracket.rounds.flat().map((m) => {
          const mine = !!userId && (m.a?.id === userId || m.b?.id === userId);
          const playing = !!m.roomId && !m.winner;
          const canJoin = mine && playing && !!m.code && isOnlineGame(info.game);
          const boxStyle = [
            styles.match,
            { left: left(m.round), top: top(m.round, m.slot), width: colW, height: MATCH_H },
            mine && styles.matchMine,
            playing && styles.matchLive,
          ];
          const content = (
            <>
              <EntrantRow
                e={m.a}
                won={!!m.winner && m.winner === m.a?.id}
                lost={!!m.winner && m.winner !== m.a?.id}
                me={m.a?.id === userId}
                index={2 * m.slot}
              />
              <View style={styles.matchSplit} />
              <EntrantRow
                e={m.b}
                won={!!m.winner && m.winner === m.b?.id}
                lost={!!m.winner && m.winner !== m.b?.id}
                me={m.b?.id === userId}
                index={2 * m.slot + 1}
              />
              {playing && <Text style={styles.matchTag}>{canJoin ? t('▶ jouer') : t('en cours')}</Text>}
              {m.by === 'timeout' && <Text style={styles.matchTag}>⏱</Text>}
            </>
          );
          return canJoin ? (
            <Pressable
              key={`${m.round}-${m.slot}`}
              accessibilityRole="button"
              accessibilityLabel={t('Jouer mon match')}
              onPress={() => onPlay(info.game as OnlineGameId, m.code!)}
              style={({ pressed }) => [...boxStyle, pressed && styles.pressed]}
            >
              {content}
            </Pressable>
          ) : (
            <View key={`${m.round}-${m.slot}`} style={boxStyle}>
              {content}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// The page: card, bracket, champions

export function WeeklyScreen({
  onBack,
  onPlay,
}: {
  onBack: () => void;
  onPlay: (game: OnlineGameId, code: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const weekly = useWeekly();
  const { state, userId } = weekly;
  // The bracket of the tournament being played (or just played); before that, the sign-ups.
  const shown = state?.current?.bracket ? state.current : null;

  const hall = state && state.hall.length > 0 && (
    <>
      <Text style={styles.section}>{t('Palmarès')}</Text>
      <View style={styles.card}>
        {state.hall.map((h, i) => (
          <View
            key={`${h.user_id}-${h.name}`}
            style={[styles.hallRow, h.user_id === userId && styles.hallMe]}
          >
            <Text style={styles.hallRank}>{['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}</Text>
            <AvatarBadge avatar={avatarOf(h, i)} size={32} />
            <Text style={[styles.hallName, styles.flex]} numberOfLines={1}>
              {h.name}
              {h.user_id === userId ? t(' (toi)') : ''}
            </Text>
            <Text style={styles.hallWins}>{'🏆'.repeat(Math.min(h.wins, 5))}</Text>
            <Text style={styles.hallCount}>{h.wins}</Text>
          </View>
        ))}
      </View>
    </>
  );

  const past = state && state.past.length > 0 && (
    <>
      <Text style={styles.section}>{t('Derniers vainqueurs')}</Text>
      <View style={styles.card}>
        {state.past.map((p) => (
          <View key={p.friday} style={styles.pastRow}>
            <GameToken game={p.game} size={30} />
            <View style={styles.flex}>
              <Text style={styles.pastName} numberOfLines={1}>
                🏆 {p.winner.name}
              </Text>
              <Text style={styles.pastDetail} numberOfLines={1}>
                {fridayLabel(p.friday)} · {weeklyGameTitle(p.game)} ·{' '}
                {tn(p.players, '{n} joueur', '{n} joueurs')}
              </Text>
            </View>
            <AvatarBadge avatar={avatarOf(p.winner)} size={30} />
          </View>
        ))}
      </View>
    </>
  );

  const entrants = state && !shown && (
    <>
      <Text style={styles.section}>{t('Inscrits')}</Text>
      <View style={[styles.card, styles.entrantsGrid]}>
        {state.upcoming.entrants.length === 0 ? (
          <Text style={styles.empty}>{t('Sois le premier à t’inscrire !')}</Text>
        ) : (
          state.upcoming.entrants.map((e, i) => (
            <View key={e.id} style={styles.entrantChip}>
              <AvatarBadge avatar={avatarOf(e, i)} size={26} />
              <Text style={[styles.entrantChipName, e.id === userId && styles.entrantMe]} numberOfLines={1}>
                {e.name}
              </Text>
            </View>
          ))
        )}
      </View>
      <Text style={styles.note}>
        {t(
          'Le tableau est tiré au sort vendredi à 21 h. Des robots complètent les places libres. Chaque match se joue en un contre un ; un match abandonné est fini par le serveur au bout de 25 min.',
        )}
      </Text>
    </>
  );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.page,
        desktop && styles.pageDesktop,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 30 },
      ]}
    >
      <TopBar onBack={onBack} backLabel={t('← Tournois')} />
      <WeeklyCard weekly={weekly} onPlay={onPlay} />
      {shown && (
        <>
          <Text style={styles.section}>
            {shown.status === 'running'
              ? t('Tableau en direct · {game}', { game: weeklyGameTitle(shown.game) })
              : t('Tableau du {day} · {game}', {
                  day: fridayLabel(shown.friday),
                  game: weeklyGameTitle(shown.game),
                })}
          </Text>
          <View style={[styles.card, styles.bracketCard]}>
            <Bracket info={shown} userId={userId} onPlay={onPlay} />
          </View>
        </>
      )}
      {desktop ? (
        <View style={styles.columns}>
          <View style={styles.column}>{entrants || hall}</View>
          <View style={styles.column}>
            {entrants ? hall : null}
            {past}
          </View>
        </View>
      ) : (
        <>
          {entrants}
          {hall}
          {past}
        </>
      )}
      {!state && !weekly.error && <ActivityIndicator color={colors.gold} style={styles.loading} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
  page: { paddingHorizontal: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  pageDesktop: { maxWidth: 1100, paddingHorizontal: 32 },
  loading: { marginTop: 24 },
  columns: { flexDirection: 'row', gap: 28, alignItems: 'flex-start' },
  column: { flex: 1, minWidth: 0 },
  section: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 22, marginBottom: 8 },
  note: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 10, lineHeight: 17 },
  empty: { color: colors.muted, fontSize: 13, textAlign: 'center', marginVertical: 6, fontStyle: 'italic' },
  error: { color: colors.gold, marginTop: 8, textAlign: 'center', fontSize: 13 },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 4 },
  card: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  cardLoading: { marginTop: 14, alignItems: 'center', gap: 10 },
  token: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  hero: { marginTop: 12, padding: 16, borderRadius: 18, overflow: 'hidden', borderColor: colors.goldBorder },
  heroDesktop: { padding: 20 },
  heroTop: { gap: 12 },
  heroTopDesktop: { flexDirection: 'row', alignItems: 'center' },
  heroIdentity: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  kicker: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroGame: { color: colors.text, fontSize: 24, fontWeight: '900' },
  heroWhen: { color: colors.muted, fontSize: 13 },
  countdown: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  countdownDesktop: { minWidth: 190 },
  countdownLive: { borderColor: 'rgba(255,90,95,0.6)' },
  countdownRound: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 2 },
  nextLine: { color: colors.muted, fontSize: 13, marginTop: 12 },
  countdownLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  countdownValue: { color: colors.gold, fontSize: 26, fontWeight: '900', fontVariant: ['tabular-nums'] },
  signupRow: { marginTop: 14, gap: 10 },
  signupRowDesktop: { flexDirection: 'row', alignItems: 'center' },
  entrants: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  faces: { flexDirection: 'row' },
  face: { borderRadius: 16 },
  faceOverlap: { marginLeft: -9 },
  entrantsText: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  signupButton: {},
  signupButtonDesktop: { width: 230 },
  registered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(123,216,143,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(123,216,143,0.5)',
  },
  registeredText: { color: '#7bd88f', fontSize: 16, fontWeight: '900' },
  unregister: { color: colors.muted, fontSize: 13, textDecorationLine: 'underline' },
  liveBox: {
    marginTop: 14,
    padding: 12,
    gap: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { color: '#ff5a5f', fontSize: 14 },
  liveText: { color: colors.text, fontSize: 14, fontWeight: '800', flexShrink: 1 },
  liveHint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  rewardRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 14 },
  rewardText: { color: colors.muted, fontSize: 13 },
  openLink: { marginTop: 12, alignSelf: 'flex-end' },
  openText: { color: colors.gold, fontSize: 15, fontWeight: '800' },
  bracketCard: { paddingHorizontal: 0, paddingVertical: 8 },
  bracketScroll: { paddingHorizontal: 12, paddingBottom: 6, flexGrow: 1, justifyContent: 'center' },
  roundName: {
    position: 'absolute',
    top: 0,
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  line: { position: 'absolute', backgroundColor: colors.glassBorder },
  match: {
    position: 'absolute',
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  matchMine: { borderColor: colors.gold },
  matchLive: { backgroundColor: 'rgba(255,193,7,0.10)' },
  matchSplit: { height: 1, backgroundColor: colors.glassBorder, marginVertical: 2 },
  matchTag: {
    position: 'absolute',
    right: 6,
    bottom: -9,
    color: colors.onGold,
    backgroundColor: colors.gold,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
  entrant: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 27 },
  entrantWon: {},
  entrantEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.glassBorder,
  },
  entrantName: { color: colors.text, fontSize: 13, fontWeight: '700', flex: 1 },
  entrantMe: { color: colors.gold },
  entrantLost: { color: colors.muted, textDecorationLine: 'line-through' },
  entrantTbd: { color: colors.muted, fontStyle: 'italic', fontWeight: '400' },
  entrantCheck: { color: '#7bd88f', fontSize: 14, fontWeight: '900' },
  entrantsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  entrantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    maxWidth: 160,
  },
  entrantChipName: { color: colors.text, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  hallRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 4 },
  hallMe: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10 },
  hallRank: { width: 28, textAlign: 'center', color: colors.muted, fontSize: 16, fontWeight: '900' },
  hallName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  hallWins: { fontSize: 13 },
  hallCount: { color: colors.gold, fontSize: 18, fontWeight: '900', minWidth: 20, textAlign: 'right' },
  pastRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  pastName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  pastDetail: { color: colors.muted, fontSize: 12 },
});
