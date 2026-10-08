import { useEffect, useState } from 'react';
import {
  type Avatar,
  type OnlineGameId,
  ONLINE_GAMES,
  cleanAvatar,
  defaultAvatar,
  emotesFor,
} from '@appli-poker/engine';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AvatarBadge, AvatarPicker } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { ReactionButton } from '../components/ReactionButton';
import { RematchPanel } from '../components/RematchPanel';
import { ONLINE_UI } from '../online-games';
import type { BoardSeat } from '../online-games/types';
import {
  type SavedRoom,
  callGames,
  ensureSignedIn,
  loadAvatar,
  loadLastGameRoom,
  loadName,
  saveAvatar,
  saveLastGameRoom,
} from '../online/supabase';
import { type GamePlayer, useGameRoom } from '../online/useGameRoom';
import { type OtherProgress, useMyProgress, useProgressOf } from '../online/progress';
import { sounds } from '../feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TitleBadge } from '../components/TitleBadge';
import { InviteFriends } from '../components/InviteFriends';
import { NotifyPrompt } from '../components/Notifications';
import { colors } from '../theme';
import { t, tn } from '../i18n';
import { tMessage } from '../online/messages';

/** A table of a tournament: the host creates it for the current round, the others join it. */
export interface TournamentTable {
  id: string;
  /** Code of the table already opened for this round, to join it directly. */
  join?: string;
}

interface Props {
  game: OnlineGameId;
  initialName: string;
  onBack: () => void;
  tournament?: TournamentTable;
  /** Code of a table to join straight away (from an invitation or a notification). */
  joinCode?: string;
}

/** Blackjack, Président, Yams or Belote with friends, each on their own phone. */
export function OnlineGameScreen({ game, initialName, onBack, tournament, joinCode }: Props) {
  const [table, setTable] = useState<{ roomId: string; userId: string } | null>(null);

  async function enter(roomId: string, name: string) {
    const userId = await ensureSignedIn();
    await saveLastGameRoom(game, { roomId, name });
    setTable({ roomId, userId });
  }

  if (!table) {
    return (
      <Lobby
        game={game}
        initialName={initialName}
        tournament={tournament}
        joinCode={joinCode}
        onEnter={enter}
        onBack={onBack}
      />
    );
  }
  return (
    <Room
      // A rematch moves everyone to a new table: start that one afresh.
      key={table.roomId}
      game={game}
      roomId={table.roomId}
      userId={table.userId}
      inTournament={!!tournament}
      onSwitch={enter}
      // A tournament table goes back to the tournament, not to the lobby.
      onLeave={() => (tournament ? onBack() : setTable(null))}
      onGone={() => {
        saveLastGameRoom(game, null);
        if (tournament) onBack();
        else setTable(null);
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Create or join a table

function Lobby({
  game,
  initialName,
  tournament,
  joinCode,
  onEnter,
  onBack,
}: {
  game: OnlineGameId;
  initialName: string;
  tournament?: TournamentTable;
  joinCode?: string;
  onEnter: (roomId: string, name: string) => Promise<void>;
  onBack: () => void;
}) {
  const ui = ONLINE_UI[game];
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(joinCode ?? '');
  const [options, setOptions] = useState(ui.defaultOptions);
  const [avatar, setAvatar] = useState<Avatar>(() => defaultAvatar(Math.floor(Math.random() * 8)));
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [last, setLast] = useState<SavedRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Joining the table of a tournament needs nothing more than my name: go straight in.
  const [autoJoining, setAutoJoining] = useState(!!(tournament?.join ?? joinCode));

  useEffect(() => {
    loadAvatar().then((a) => a && setAvatar(cleanAvatar(a, a)));
    loadLastGameRoom(game).then((r) => {
      setLast(r);
      if (r && !initialName) setName(r.name);
    });
  }, [game, initialName]);

  // The saved name can arrive after the first render.
  useEffect(() => setName((n) => n || initialName), [initialName]);

  useEffect(() => {
    const code = tournament?.join ?? joinCode;
    if (!code) return;
    Promise.all([loadAvatar(), loadName()]).then(([a, saved]) => {
      const who = (saved || initialName).trim();
      if (!who) {
        setAutoJoining(false);
        return;
      }
      setName(who);
      const look = a ? cleanAvatar(a, a) : avatar;
      run(() => callGames({ type: 'join', game, name: who, code, avatar: look }), who).then(() =>
        setAutoJoining(false),
      );
    });
  }, []);

  function changeAvatar(a: Avatar) {
    setAvatar(a);
    saveAvatar(a);
  }

  const trimmed = name.trim();

  async function run(request: () => Promise<{ roomId: string }>, who = trimmed) {
    setBusy(true);
    setError(null);
    try {
      const { roomId } = await request();
      await onEnter(roomId, who);
    } catch (e) {
      setError(tMessage((e as Error).message));
      setBusy(false);
    }
  }

  const join = () =>
    run(() => callGames({ type: 'join', game, name: trimmed, code: tournament?.join ?? code, avatar }));
  const create = () =>
    run(() =>
      callGames({ type: 'create', game, name: trimmed, avatar, options, tournamentId: tournament?.id }),
    );

  const Options = ui.Options;
  if (tournament) {
    return (
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.emoji}>{ui.emoji}</Text>
        <Text style={styles.title}>{t(ui.title)}</Text>
        <Text style={styles.subtitle}>
          {t('🏆 Manche de tournoi · {players}', { players: t(ui.players) })}
        </Text>
        {autoJoining && !error ? (
          <>
            <View style={styles.spacer} />
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.hint}>
              {t('Arrivée à la table {code}…', { code: tournament.join ?? '' })}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.label}>{t('Ton prénom et ton avatar')}</Text>
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Changer d'avatar")}
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
                placeholder={t('Ton prénom')}
                placeholderTextColor={colors.muted}
              />
            </View>
            {pickingAvatar && <AvatarPicker value={avatar} onChange={changeAvatar} />}
            {tournament.join ? (
              <>
                <View style={styles.spacer} />
                <Button
                  label={t('Rejoindre la table {code}', { code: tournament.join })}
                  disabled={busy || !trimmed}
                  onPress={join}
                />
              </>
            ) : (
              <>
                {Options ? (
                  <>
                    <Text style={styles.section}>{t('Réglages de la manche')}</Text>
                    <Options value={options} onChange={setOptions} />
                  </>
                ) : (
                  <View style={styles.spacer} />
                )}
                <Button label={t('Créer la table')} disabled={busy || !trimmed} onPress={create} />
                <Text style={styles.hint}>
                  {t('Les joueurs du tournoi verront la table et pourront la rejoindre.')}
                </Text>
              </>
            )}
          </>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.spacer} />
        <Button label={t('Retour au tournoi')} variant="secondary" onPress={onBack} />
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.emoji}>{ui.emoji}</Text>
      <Text style={styles.title}>{t('{game} en ligne', { game: t(ui.title) })}</Text>
      <Text style={styles.subtitle}>{t(ui.players)}</Text>

      {last && (
        <View style={styles.resume}>
          <Button label={t('▶ Reprendre ma table')} disabled={busy} onPress={() => run(async () => last)} />
        </View>
      )}

      <Text style={styles.label}>{t('Ton prénom et ton avatar')}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Changer d'avatar")}
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
          placeholder={t('Ton prénom')}
          placeholderTextColor={colors.muted}
        />
      </View>
      {pickingAvatar && <AvatarPicker value={avatar} onChange={changeAvatar} />}

      <Text style={styles.section}>{t('Rejoindre des amis')}</Text>
      <TextInput
        style={[styles.input, styles.code]}
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
        maxLength={6}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder={t('CODE')}
        placeholderTextColor={colors.muted}
        accessibilityLabel={t('Code de la table')}
      />
      <Button label={t('Rejoindre')} disabled={busy || !trimmed || code.trim().length !== 6} onPress={join} />

      <Text style={styles.section}>{t('Ou créer une table')}</Text>
      {Options && <Options value={options} onChange={setOptions} />}
      <Button label={t('Créer la table')} variant="secondary" disabled={busy || !trimmed} onPress={create} />

      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.spacer} />
      <Button label={t('Retour')} variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// At the table: waiting for friends, then playing

function Room({
  game,
  roomId,
  userId,
  inTournament,
  onSwitch,
  onLeave,
  onGone,
}: {
  game: OnlineGameId;
  roomId: string;
  userId: string;
  inTournament: boolean;
  /** Goes to another table: the rematch of this one. */
  onSwitch: (roomId: string, name: string) => Promise<void>;
  onLeave: () => void;
  onGone: () => void;
}) {
  const { room, players, myView, error, removed, refresh, now, reactions, sendReaction } = useGameRoom(
    roomId,
    userId,
  );
  const progressOf = useProgressOf(players.filter((p) => !p.is_bot).map((p) => p.user_id));
  const myEmotes = emotesFor(useMyProgress()?.owned ?? []);
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  // A little sound when someone else reacts.
  const lastOtherReaction = Object.entries(reactions)
    .filter(([from]) => from !== userId)
    .reduce((m, [, r]) => Math.max(m, r.key), 0);
  useEffect(() => {
    if (lastOtherReaction) sounds.reaction();
  }, [lastOtherReaction]);

  useEffect(() => {
    if (removed) onGone();
  }, [removed]);

  async function send(request: Parameters<typeof callGames>[0]) {
    setBusy(true);
    setMoveError(null);
    try {
      await callGames(request);
      await refresh();
    } catch (e) {
      setMoveError(tMessage((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  if (!room) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.gold} />}
        <View style={styles.spacer} />
        <Button label={t('Retour')} variant="secondary" onPress={error ? onGone : onLeave} />
      </View>
    );
  }

  const ui = ONLINE_UI[game];
  const state = room.public_state;
  if (room.status === 'lobby' || !state) {
    return (
      <WaitingRoom
        code={room.code}
        title={t(ui.title)}
        inTournament={inTournament}
        players={players}
        progressOf={progressOf}
        isHost={room.host_id === userId}
        userId={userId}
        game={game}
        busy={busy}
        error={moveError ?? error}
        onAddBot={() => send({ type: 'addBot', roomId })}
        onRemove={(id) => send({ type: 'remove', roomId, userId: id })}
        onStart={() => send({ type: 'start', roomId })}
        onLeave={async () => {
          if (room.host_id !== userId) await send({ type: 'remove', roomId, userId });
          onGone();
        }}
      />
    );
  }

  const byId = new Map(players.map((p) => [p.user_id, p]));
  const seats: BoardSeat[] = state.seats.map((s, i) => ({
    ...s,
    avatar: { ...avatarOf(byId.get(s.id), i, progressOf[s.id]), reaction: reactions[s.id] },
  }));
  const mySeat = state.seats.findIndex((s) => s.id === userId);
  const Board = ui.Board;
  const rematch = async () => {
    const { roomId: next } = await callGames<{ roomId: string }>({ type: 'rematch', roomId });
    await onSwitch(next, byId.get(userId)?.name ?? '');
  };
  return (
    <View style={styles.flex}>
      <View style={styles.flex}>
        <Board
          view={mySeat >= 0 && myView != null ? myView : state.view}
          mySeat={mySeat}
          seats={seats}
          actors={state.actors}
          deadline={state.deadline}
          now={now}
          betweenRounds={state.betweenRounds}
          over={state.over}
          busy={busy}
          error={moveError}
          onMove={(move) => send({ type: 'move', roomId, move })}
          onLeave={state.over ? onGone : onLeave}
        />
      </View>
      {state.over && mySeat >= 0 && !inTournament && (
        <View style={[styles.rematch, { paddingBottom: insets.bottom + 10 }]}>
          <RematchPanel rematch={room.rematch} meId={userId} onRematch={rematch} />
        </View>
      )}
      {mySeat >= 0 && (
        <ReactionButton
          emojis={myEmotes}
          onSend={sendReaction}
          // In the middle of the top bar, the one place every game leaves free.
          style={[styles.react, { top: insets.top + 6 }]}
        />
      )}
    </View>
  );
}

function avatarOf(p: GamePlayer | undefined, seat: number, progress?: OtherProgress): Avatar {
  const base = p?.avatar
    ? { emoji: p.avatar, color: p.avatar_color ?? defaultAvatar(seat).color }
    : defaultAvatar(seat);
  if (!p || p.is_bot) return base;
  return { ...base, frame: progress?.frame, level: progress?.level ?? 1 };
}

function WaitingRoom({
  code,
  title,
  inTournament,
  players,
  progressOf,
  isHost,
  userId,
  game,
  busy,
  error,
  onAddBot,
  onRemove,
  onStart,
  onLeave,
}: {
  code: string;
  title: string;
  inTournament: boolean;
  players: GamePlayer[];
  progressOf: Record<string, OtherProgress>;
  isHost: boolean;
  userId: string;
  game: OnlineGameId;
  busy: boolean;
  error: string | null;
  onAddBot: () => void;
  onRemove: (userId: string) => void;
  onStart: () => void;
  onLeave: () => void;
}) {
  const def = ONLINE_GAMES[game];
  const full = players.length >= def.maxPlayers;
  const fillTo = Math.max(def.fillTo ?? 0, def.minPlayers);
  const missing = Math.max(0, fillTo - players.length);
  const invite = () =>
    Share.share({
      message: t('Viens jouer au {game} avec moi ! Code de la table : {code}', { game: title, code }),
    }).catch(() => {});
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.label}>{t('Code de la table')}</Text>
      <Text style={styles.bigCode} accessibilityLabel={t('Code de la table {code}', { code })}>
        {code}
      </Text>
      <Text style={styles.subtitle}>
        {inTournament
          ? t('Les joueurs du tournoi la rejoignent depuis l’écran du tournoi.')
          : t('Donne ce code à tes amis : ils choisissent {game} puis « Rejoindre ».', { game: title })}
      </Text>
      <View style={styles.spacerSmall} />
      <Button label={t('Inviter des amis')} variant="secondary" onPress={invite} />
      {!inTournament && <InviteFriends game={game} code={code} />}
      <NotifyPrompt />

      <Text style={styles.section}>
        {t('À la table ({n}/{max})', { n: players.length, max: def.maxPlayers })}
      </Text>
      {players.map((p, i) => (
        <View key={p.user_id} style={styles.playerRow}>
          <AvatarBadge avatar={avatarOf(p, i, progressOf[p.user_id])} size={40} />
          <View style={styles.flex}>
            <Text style={styles.playerName} numberOfLines={1}>
              {p.name}
              {p.user_id === userId ? t(' (toi)') : ''}
            </Text>
            {!p.is_bot && <TitleBadge id={progressOf[p.user_id]?.title ?? 'debutant'} small />}
          </View>
          {p.is_bot && <Text style={styles.tag}>{t('Robot')}</Text>}
          {isHost && p.user_id !== userId && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Retirer {name}', { name: p.name })}
              onPress={() => onRemove(p.user_id)}
              disabled={busy}
            >
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          )}
        </View>
      ))}

      {isHost ? (
        <>
          {!full && (
            <Button
              label={t('+ Ajouter un robot 🤖')}
              variant="secondary"
              disabled={busy}
              onPress={onAddBot}
            />
          )}
          {missing > 0 && (
            <Text style={styles.hint}>
              {tn(
                missing,
                'Un robot complétera la table au lancement.',
                '{n} robots compléteront la table au lancement.',
              )}
            </Text>
          )}
          <View style={styles.spacerSmall} />
          <Button label={t('Lancer la partie')} disabled={busy} onPress={onStart} />
        </>
      ) : (
        <Text style={styles.hint}>{t('En attente du lancement par le créateur de la table…')}</Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.spacer} />
      <Button label={t('Quitter la table')} variant="secondary" onPress={onLeave} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 50, paddingBottom: 30 },
  center: { flex: 1, justifyContent: 'center', padding: 24 },
  emoji: { fontSize: 40, textAlign: 'center' },
  title: { color: colors.gold, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 4 },
  resume: { marginTop: 16 },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 8 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 8, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  flex: { flex: 1 },
  label: { color: colors.muted, marginTop: 16, marginBottom: 4, textAlign: 'center' },
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
  code: { fontSize: 24, letterSpacing: 6, textAlign: 'center', fontWeight: '700' },
  bigCode: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
    borderRadius: 10,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  playerName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  tag: { color: colors.muted, fontSize: 12 },
  remove: { color: colors.muted, fontSize: 18, paddingHorizontal: 8 },
  error: { color: colors.gold, marginTop: 12, textAlign: 'center' },
  spacer: { height: 24 },
  spacerSmall: { height: 10 },
  rematch: { paddingHorizontal: 10, paddingTop: 6 },
  react: { left: 0, right: 0, alignItems: 'center' },
});
