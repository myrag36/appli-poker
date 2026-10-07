import { useEffect, useState } from 'react';
import {
  type Avatar,
  type OnlineGameId,
  ONLINE_GAMES,
  cleanAvatar,
  defaultAvatar,
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
import { ONLINE_UI } from '../online-games';
import type { BoardSeat } from '../online-games/types';
import {
  type SavedRoom,
  callGames,
  ensureSignedIn,
  loadAvatar,
  loadLastGameRoom,
  saveAvatar,
  saveLastGameRoom,
} from '../online/supabase';
import { type GamePlayer, useGameRoom } from '../online/useGameRoom';
import { type OtherProgress, useProgressOf } from '../online/progress';
import { TitleBadge } from '../components/TitleBadge';
import { colors } from '../theme';

interface Props {
  game: OnlineGameId;
  initialName: string;
  onBack: () => void;
}

/** Blackjack, Président, Yams or Belote with friends, each on their own phone. */
export function OnlineGameScreen({ game, initialName, onBack }: Props) {
  const [table, setTable] = useState<{ roomId: string; userId: string } | null>(null);

  async function enter(roomId: string, name: string) {
    const userId = await ensureSignedIn();
    await saveLastGameRoom(game, { roomId, name });
    setTable({ roomId, userId });
  }

  if (!table) return <Lobby game={game} initialName={initialName} onEnter={enter} onBack={onBack} />;
  return (
    <Room
      game={game}
      roomId={table.roomId}
      userId={table.userId}
      onLeave={() => setTable(null)}
      onGone={() => {
        saveLastGameRoom(game, null);
        setTable(null);
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Create or join a table

function Lobby({
  game,
  initialName,
  onEnter,
  onBack,
}: {
  game: OnlineGameId;
  initialName: string;
  onEnter: (roomId: string, name: string) => Promise<void>;
  onBack: () => void;
}) {
  const ui = ONLINE_UI[game];
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState('');
  const [options, setOptions] = useState(ui.defaultOptions);
  const [avatar, setAvatar] = useState<Avatar>(() => defaultAvatar(Math.floor(Math.random() * 8)));
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [last, setLast] = useState<SavedRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAvatar().then((a) => a && setAvatar(cleanAvatar(a, a)));
    loadLastGameRoom(game).then((r) => {
      setLast(r);
      if (r && !initialName) setName(r.name);
    });
  }, [game, initialName]);

  function changeAvatar(a: Avatar) {
    setAvatar(a);
    saveAvatar(a);
  }

  const trimmed = name.trim();

  async function run(request: () => Promise<{ roomId: string }>) {
    setBusy(true);
    setError(null);
    try {
      const { roomId } = await request();
      await onEnter(roomId, trimmed);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const Options = ui.Options;
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.emoji}>{ui.emoji}</Text>
      <Text style={styles.title}>{ui.title} en ligne</Text>
      <Text style={styles.subtitle}>{ui.players}</Text>

      {last && (
        <View style={styles.resume}>
          <Button label="▶ Reprendre ma table" disabled={busy} onPress={() => run(async () => last)} />
        </View>
      )}

      <Text style={styles.label}>Ton prénom et ton avatar</Text>
      <View style={styles.row}>
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
        />
      </View>
      {pickingAvatar && <AvatarPicker value={avatar} onChange={changeAvatar} />}

      <Text style={styles.section}>Rejoindre des amis</Text>
      <TextInput
        style={[styles.input, styles.code]}
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        maxLength={6}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="CODE"
        placeholderTextColor={colors.muted}
        accessibilityLabel="Code de la table"
      />
      <Button
        label="Rejoindre"
        disabled={busy || !trimmed || code.trim().length !== 6}
        onPress={() => run(() => callGames({ type: 'join', game, name: trimmed, code, avatar }))}
      />

      <Text style={styles.section}>Ou créer une table</Text>
      {Options && <Options value={options} onChange={setOptions} />}
      <Button
        label="Créer la table"
        variant="secondary"
        disabled={busy || !trimmed}
        onPress={() => run(() => callGames({ type: 'create', game, name: trimmed, avatar, options }))}
      />

      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.spacer} />
      <Button label="Retour" variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// At the table: waiting for friends, then playing

function Room({
  game,
  roomId,
  userId,
  onLeave,
  onGone,
}: {
  game: OnlineGameId;
  roomId: string;
  userId: string;
  onLeave: () => void;
  onGone: () => void;
}) {
  const { room, players, myView, error, removed, refresh, now } = useGameRoom(roomId, userId);
  const progressOf = useProgressOf(players.filter((p) => !p.is_bot).map((p) => p.user_id));
  const [busy, setBusy] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

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
      setMoveError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!room) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.gold} />}
        <View style={styles.spacer} />
        <Button label="Retour" variant="secondary" onPress={error ? onGone : onLeave} />
      </View>
    );
  }

  const ui = ONLINE_UI[game];
  const state = room.public_state;
  if (room.status === 'lobby' || !state) {
    return (
      <WaitingRoom
        code={room.code}
        title={ui.title}
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
    avatar: avatarOf(byId.get(s.id), i, progressOf[s.id]),
  }));
  const mySeat = state.seats.findIndex((s) => s.id === userId);
  const Board = ui.Board;
  return (
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
    Share.share({ message: `Viens jouer au ${title} avec moi ! Code de la table : ${code}` }).catch(() => {});
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.label}>Code de la table</Text>
      <Text style={styles.bigCode} accessibilityLabel={`Code de la table ${code}`}>
        {code}
      </Text>
      <Text style={styles.subtitle}>
        Donne ce code à tes amis : ils choisissent {title} puis « Rejoindre ».
      </Text>
      <View style={styles.spacerSmall} />
      <Button label="Inviter des amis" variant="secondary" onPress={invite} />

      <Text style={styles.section}>
        À la table ({players.length}/{def.maxPlayers})
      </Text>
      {players.map((p, i) => (
        <View key={p.user_id} style={styles.playerRow}>
          <AvatarBadge avatar={avatarOf(p, i, progressOf[p.user_id])} size={40} />
          <View style={styles.flex}>
            <Text style={styles.playerName} numberOfLines={1}>
              {p.name}
              {p.user_id === userId ? ' (toi)' : ''}
            </Text>
            {!p.is_bot && <TitleBadge id={progressOf[p.user_id]?.title ?? 'debutant'} small />}
          </View>
          {p.is_bot && <Text style={styles.tag}>Robot</Text>}
          {isHost && p.user_id !== userId && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Retirer ${p.name}`}
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
            <Button label="+ Ajouter un robot 🤖" variant="secondary" disabled={busy} onPress={onAddBot} />
          )}
          {missing > 0 && (
            <Text style={styles.hint}>
              {missing === 1 ? 'Un robot complétera' : `${missing} robots compléteront`} la table au
              lancement.
            </Text>
          )}
          <View style={styles.spacerSmall} />
          <Button label="Lancer la partie" disabled={busy} onPress={onStart} />
        </>
      ) : (
        <Text style={styles.hint}>En attente du lancement par le créateur de la table…</Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.spacer} />
      <Button label="Quitter la table" variant="secondary" onPress={onLeave} />
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
});
