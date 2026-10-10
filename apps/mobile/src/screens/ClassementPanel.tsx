// Weekly ranking between friends, made of the online games we finished (the experience of the
// week breaks ties): shown in a tab of the friends screen, with last week's podium and its
// chest. The server sends each player's games by game, so picking one game ranks again on the
// phone without waiting.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ALL_AVATAR_EMOJIS,
  type LeaderboardLine,
  type LeaderboardPlayer,
  LEADERBOARD_PLAY_POINTS,
  LEADERBOARD_WIN_POINTS,
  type OnlineGameId,
  cleanAvatar,
  cleanEquipped,
  cleanOwned,
  defaultAvatar,
  leaderboardGames,
  leaderboardPodium,
  levelFromXp,
  rankLeaderboard,
  weekEndsAt,
} from '@appli-poker/engine';
import { AvatarBadge } from '../components/AvatarPicker';
import { TitleBadge } from '../components/TitleBadge';
import { type Leaderboard, claimPodium, loadLeaderboard, useMyProgress } from '../online/progress';
import { sounds } from '../feedback';
import { ONLINE_UI } from '../online-games';
import { t, tn } from '../i18n';
import { colors, gradients } from '../theme';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Name and emoji of a game, poker included, for the filter and the best game. */
function gameLabel(game: string): { title: string; emoji: string } {
  if (game === 'poker') return { title: 'Poker', emoji: '♣️' };
  const ui = ONLINE_UI[game as OnlineGameId];
  return { title: t(ui?.title ?? game), emoji: ui?.emoji ?? '🎲' };
}

/** "2 j 14 h", "5 h 12 min" or "8 min" until the end of the week. */
function timeLeft(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d > 0) return t('{d} j {h} h', { d, h });
  if (h > 0) return t('{h} h {m} min', { h, m });
  return t('{m} min', { m });
}

function useNow(every = 30_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}

export function ClassementPanel({ desktop }: { desktop: boolean }) {
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const progress = useMyProgress();
  const now = useNow();

  async function reload() {
    setError(null);
    try {
      setBoard(await loadLeaderboard());
    } catch (e) {
      setError(t((e as Error).message));
    }
  }

  useEffect(() => {
    reload();
  }, []);

  // A new week started while the screen was open: ask for the new ranking.
  const endsAt = board?.endsAt ?? weekEndsAt(now);
  useEffect(() => {
    if (board && now >= board.endsAt) reload();
  }, [now >= endsAt]);

  // Last week's podium chest, until it is taken (once a week: the server checks it too).
  const chest = board?.chest ?? null;
  const chestReady =
    !!board && chest !== null && progress?.podiumClaimed !== board.week && claimed !== board.week;

  async function claim() {
    if (!board || claiming) return;
    setClaiming(true);
    setClaimError(null);
    try {
      await claimPodium();
      setClaimed(board.week);
      sounds.win();
    } catch (e) {
      setClaimError(t((e as Error).message));
    } finally {
      setClaiming(false);
    }
  }

  const players = board?.players ?? [];
  const lines = rankLeaderboard(players, 'week', game);
  const podium = leaderboardPodium(players, game);
  const mine = lines.find((l) => l.player.me);
  const friends = players.filter((p) => !p.me).length;
  const nobodyPlayed = lines.every((l) => l.played === 0);

  const header = (
    <LinearGradient colors={['#3a2a6b', '#1b1440']} style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{t('🏆 Classement des amis')}</Text>
        <Text style={styles.headerText}>
          {t('Parties en ligne · {win} pts la victoire, {play} pt la partie perdue', {
            win: LEADERBOARD_WIN_POINTS,
            play: LEADERBOARD_PLAY_POINTS,
          })}
        </Text>
        <Text style={styles.headerText}>
          {t('En cas d’égalité, l’XP de la semaine départage. Le podium gagne un coffre.')}
        </Text>
      </View>
      <View
        style={styles.countdown}
        accessibilityLabel={t('Fin de la semaine dans {time}', { time: timeLeft(endsAt - now) })}
      >
        <Text style={styles.countdownLabel}>{t('Fin dans')}</Text>
        <Text style={styles.countdownValue}>{timeLeft(endsAt - now)}</Text>
      </View>
    </LinearGradient>
  );

  const reward =
    chestReady || claimed || claimError ? (
      <View style={styles.rewardWrap}>
        {chestReady && (
          <Pressable
            accessibilityRole="button"
            onPress={claim}
            disabled={claiming}
            style={[styles.reward, claiming && { opacity: 0.6 }]}
          >
            <LinearGradient colors={['#6b4b00', '#3a2800']} style={styles.rewardInner}>
              <Text style={styles.rewardIcon}>{chest === 'grand' ? '🏆' : '🎖️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rewardTitle}>{t('Tu étais sur le podium la semaine dernière !')}</Text>
                <Text style={styles.rewardText}>
                  {chest === 'grand'
                    ? t('Touche pour prendre ton grand coffre.')
                    : t('Touche pour prendre ton coffre.')}
                </Text>
              </View>
              {claiming && <ActivityIndicator color={colors.gold} />}
            </LinearGradient>
          </Pressable>
        )}
        {claimed && !chestReady && (
          <Text style={styles.rewardDone}>{t('Ton coffre t’attend dans la boutique !')}</Text>
        )}
        {claimError && <Text style={styles.error}>{claimError}</Text>}
      </View>
    ) : null;

  const chips = [null, ...leaderboardGames()].map((g) => {
    const on = g === game;
    const label = g === null ? { title: t('Tous les jeux'), emoji: '🎯' } : gameLabel(g);
    return (
      <Pressable
        key={g ?? 'all'}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => setGame(g)}
        style={[styles.chip, on && styles.chipOn]}
      >
        <Text style={[styles.chipText, on && styles.chipTextOn]}>
          {label.emoji} {label.title}
        </Text>
      </Pressable>
    );
  });
  // On a computer every game fits on two lines; a phone scrolls them sideways.
  const filter = desktop ? (
    <View style={[styles.filterScroll, styles.filter, styles.filterDesktop]}>{chips}</View>
  ) : (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroll}
      contentContainerStyle={styles.filter}
    >
      {chips}
    </ScrollView>
  );

  const list =
    board === null ? (
      error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={reload} style={styles.retry}>
            <Text style={styles.retryText}>{t('Réessayer')}</Text>
          </Pressable>
        </View>
      ) : (
        <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} />
      )
    ) : (
      <View style={styles.board}>
        <Text style={styles.section}>{t('Cette semaine')}</Text>
        {lines.map((l, i) => (
          <Line key={l.player.user_id} line={l} index={i} showBest={game === null} />
        ))}
        {nobodyPlayed && (
          <Text style={styles.empty}>
            {game === null
              ? t('Aucune partie en ligne cette semaine. Lance une table avec tes amis !')
              : t('Aucune partie de {game} en ligne cette semaine.', { game: gameLabel(game).title })}
          </Text>
        )}
        {friends === 0 && (
          <Text style={styles.empty}>
            {t('Ajoute tes amis avec leur code pour vous affronter chaque semaine !')}
          </Text>
        )}
      </View>
    );

  const lastWeek = board && (
    <View style={styles.podiumCard}>
      <Text style={styles.section}>{t('Podium de la semaine dernière')}</Text>
      <Text style={styles.podiumHint}>{t('🎁 Grand coffre pour le 1ᵉʳ, coffre pour le 2ᵉ et le 3ᵉ')}</Text>
      {podium.length === 0 ? (
        <Text style={styles.empty}>{t('Pas de podium la semaine dernière.')}</Text>
      ) : (
        <View style={styles.podium}>
          {/* Second, first, third: the winner stands in the middle. */}
          {[podium[1], podium[0], podium[2]].map((l, i) =>
            l ? <Step key={l.player.user_id} line={l} /> : <View key={`empty${i}`} style={styles.step} />,
          )}
        </View>
      )}
    </View>
  );

  const summary = mine && board && (
    <View style={styles.summary}>
      <Text style={styles.summaryTitle}>{t('Ma semaine')}</Text>
      <View style={styles.summaryRow}>
        <Stat value={mine.place === 1 ? t('1ᵉʳ') : t('{n}ᵉ', { n: mine.place })} label={t('Place')} />
        <Stat value={String(mine.points)} label={t('Points')} />
        <Stat value={String(mine.won)} label={tn(mine.won, 'Victoire', 'Victoires')} />
        <Stat value={String(mine.played)} label={tn(mine.played, 'Partie', 'Parties')} />
        <Stat value={String(mine.xp)} label={t('XP')} />
      </View>
      {mine.best && (
        <Text style={styles.summaryBest}>
          {t('Meilleur jeu : {emoji} {game}', {
            emoji: gameLabel(mine.best).emoji,
            game: gameLabel(mine.best).title,
          })}
        </Text>
      )}
    </View>
  );

  if (desktop) {
    return (
      <View>
        {header}
        {reward}
        <View style={styles.columns}>
          <View style={styles.left}>
            {filter}
            {list}
          </View>
          <View style={styles.right}>
            {summary}
            {lastWeek}
          </View>
        </View>
      </View>
    );
  }
  return (
    <View>
      {header}
      {reward}
      {filter}
      {summary}
      {list}
      {lastWeek}
    </View>
  );
}

function avatarOf(p: LeaderboardPlayer, index: number) {
  const level = levelFromXp(p.xp);
  const equipped = cleanEquipped(p.equipped, level, cleanOwned(p.owned));
  const avatar = cleanAvatar(
    { emoji: p.avatar, color: p.avatar_color },
    defaultAvatar(index),
    ALL_AVATAR_EMOJIS,
  );
  return { avatar: { ...avatar, frame: equipped.frame, level }, title: equipped.title };
}

function Line({ line, index, showBest }: { line: LeaderboardLine; index: number; showBest: boolean }) {
  const p = line.player;
  const { avatar, title } = avatarOf(p, index);
  const best = line.best ? gameLabel(line.best) : null;
  return (
    <View
      accessibilityLabel={t('{place}e, {name}, {points} points', {
        place: line.place,
        name: p.name,
        points: line.points,
      })}
      style={[styles.row, p.me && styles.rowMe]}
    >
      <Text style={styles.place}>{line.played > 0 ? (MEDALS[line.place - 1] ?? `${line.place}`) : '–'}</Text>
      <AvatarBadge avatar={avatar} size={44} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {p.name}
          {p.me ? t(' (moi)') : ''}
        </Text>
        <View style={styles.rowTags}>
          <TitleBadge id={title} small />
          {showBest && best && (
            <Text style={styles.rowBest} numberOfLines={1}>
              {best.emoji} {best.title}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.rowScore}>
        <Text style={styles.rowPoints}>{tn(line.points, '{n} pt', '{n} pts')}</Text>
        <Text style={styles.rowWins}>
          {line.played === 0
            ? t('Pas encore joué')
            : `${tn(line.won, '{n} victoire', '{n} victoires')} · ${tn(line.played, '{n} partie', '{n} parties')}`}
        </Text>
        {showBest && line.xp > 0 && <Text style={styles.rowXp}>{t('{n} XP', { n: line.xp })}</Text>}
      </View>
    </View>
  );
}

const STEP_HEIGHT = [64, 46, 34];

function Step({ line }: { line: LeaderboardLine }) {
  const { avatar } = avatarOf(line.player, line.place);
  return (
    <View style={styles.step}>
      <AvatarBadge avatar={avatar} size={line.place === 1 ? 56 : 46} />
      <Text style={[styles.stepName, line.player.me && styles.stepMe]} numberOfLines={1}>
        {line.player.name}
      </Text>
      <Text style={styles.stepPoints}>{tn(line.points, '{n} pt', '{n} pts')}</Text>
      <LinearGradient
        colors={line.place === 1 ? gradients.gold : ['#5a6b80', '#3a4656']}
        style={[styles.stepBlock, { height: STEP_HEIGHT[line.place - 1] ?? 30 }]}
      >
        <Text style={styles.stepMedal}>{MEDALS[line.place - 1]}</Text>
      </LinearGradient>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 12,
    padding: 16,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#8e7dbe',
  },
  headerTitle: { color: '#fff', fontSize: 19, fontWeight: '900' },
  headerText: { color: '#cfc5ff', fontSize: 12, marginTop: 4, lineHeight: 17 },
  countdown: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  countdownLabel: { color: '#cfc5ff', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  countdownValue: { color: colors.gold, fontSize: 17, fontWeight: '900', marginTop: 2 },
  filterScroll: { marginTop: 12, flexGrow: 0 },
  filter: { gap: 8, paddingRight: 8 },
  filterDesktop: { flexDirection: 'row', flexWrap: 'wrap', paddingRight: 0 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: colors.onGold, fontWeight: '900' },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  left: { flex: 1, minWidth: 0 },
  right: { width: 360, paddingTop: 12 },
  section: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 2 },
  board: { marginTop: 16, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  rowMe: { borderColor: colors.gold, borderWidth: 2, backgroundColor: 'rgba(255,193,7,0.12)' },
  place: { color: colors.text, fontSize: 18, fontWeight: '900', width: 28, textAlign: 'center' },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  rowName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  rowTags: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rowBest: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  rowScore: { alignItems: 'flex-end' },
  rowPoints: { color: colors.gold, fontSize: 17, fontWeight: '900' },
  rowWins: { color: colors.muted, fontSize: 11.5 },
  rowXp: { color: '#cfc5ff', fontSize: 11, fontWeight: '700' },
  rewardWrap: { marginTop: 12 },
  reward: { borderRadius: 14, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.gold },
  rewardInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rewardIcon: { fontSize: 36 },
  rewardTitle: { color: colors.gold, fontSize: 15, fontWeight: '900' },
  rewardText: { color: '#f3e3b5', fontSize: 13 },
  rewardDone: { color: colors.gold, textAlign: 'center', fontWeight: '800' },
  podiumHint: { color: colors.muted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  errorBox: { alignItems: 'center', marginTop: 20, gap: 10 },
  error: { color: '#ff8a80', textAlign: 'center' },
  retry: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.glass },
  retryText: { color: colors.text, fontWeight: '800' },
  podiumCard: {
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginTop: 12 },
  step: { flex: 1, alignItems: 'center', gap: 3, minWidth: 0 },
  stepName: { color: colors.text, fontSize: 13, fontWeight: '800', maxWidth: '100%' },
  stepMe: { color: colors.gold },
  stepPoints: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  stepBlock: {
    alignSelf: 'stretch',
    marginTop: 4,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepMedal: { fontSize: 24 },
  summary: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,193,7,0.08)',
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  summaryTitle: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryRow: { flexDirection: 'row', marginTop: 8 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
  summaryBest: { color: colors.text, fontSize: 13, textAlign: 'center', marginTop: 10, fontWeight: '700' },
});
