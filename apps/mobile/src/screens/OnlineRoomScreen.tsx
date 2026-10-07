import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type Action,
  type Avatar,
  MAX_LEVEL,
  avatarEmojisFor,
  cleanAvatar,
  defaultAvatar,
} from '@appli-poker/engine';
import { ActionPanel } from '../components/ActionPanel';
import { AvatarBadge } from '../components/AvatarPicker';
import { ChatPanel } from '../components/ChatPanel';
import { HistoryPanel } from '../components/HistoryPanel';
import { ManagePanel } from '../components/ManagePanel';
import { Button } from '../components/Button';
import { GameLayout } from '../components/GameLayout';
import { HandSummary } from '../components/HandSummary';
import { Panel, PanelText } from '../components/Panel';
import { PlayingCard } from '../components/PlayingCard';
import { Ranking } from '../components/Ranking';
import { Table } from '../components/Table';
import { TopBar } from '../components/TopBar';
import { TurnTimer } from '../components/TurnTimer';
import { callServer, loadAvatar, loadLastRoom, saveLastRoom, supabase } from '../online/supabase';
import { REACTIONS, useRoom } from '../online/useRoom';
import { useProgressOf } from '../online/progress';
import { sounds, useHandSounds } from '../feedback';
import { Appear } from '../components/Motion';
import { colors } from '../theme';

interface Props {
  roomId: string;
  userId: string;
  onLeave: () => void;
}

export function OnlineRoomScreen({ roomId, userId, onLeave }: Props) {
  const {
    room,
    players,
    myCards,
    error: syncError,
    refresh,
    reactions,
    sendReaction,
    messages,
    messagesLoaded,
    sendMessage,
    bubbles,
    removed,
  } = useRoom(roomId, userId);
  const [trayOpen, setTrayOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  /** Names of the people watching, so their chat messages are signed. */
  const [spectators, setSpectators] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!chatOpen) return;
    supabase
      .from('room_spectators')
      .select('user_id, name')
      .eq('room_id', roomId)
      .then(({ data }) => {
        if (data) setSpectators(Object.fromEntries(data.map((s) => [s.user_id, `👀 ${s.name}`])));
      });
  }, [chatOpen, roomId]);
  const [manageOpen, setManageOpen] = useState(false);
  useEffect(() => {
    // Don't offer to go back to a table I was removed from.
    if (removed) saveLastRoom(null);
  }, [removed]);
  // Newest message already seen; what came before I arrived counts as read.
  const [readUpTo, setReadUpTo] = useState<number | null>(null);
  const lastMessageId = messages.length ? messages[messages.length - 1].id : null;
  useEffect(() => {
    if (!messagesLoaded) return;
    if (chatOpen || readUpTo === null) setReadUpTo(lastMessageId ?? 0);
  }, [messagesLoaded, lastMessageId, chatOpen, readUpTo]);
  const unread = messages.filter((m) => m.user_id !== userId && m.id > (readUpTo ?? Infinity)).length;
  const lastOtherMessage = Object.entries(bubbles)
    .filter(([from]) => from !== userId)
    .reduce((m, [, b]) => Math.max(m, b.key), 0);
  useEffect(() => {
    if (lastOtherMessage) sounds.reaction();
  }, [lastOtherMessage]);
  useHandSounds(room?.public_state ?? null, userId);
  const progressOf = useProgressOf(players.filter((p) => !p.is_bot).map((p) => p.user_id));
  const lastReaction = Object.values(reactions).reduce((m, r) => Math.max(m, r.key), 0);
  useEffect(() => {
    if (lastReaction) sounds.reaction();
  }, [lastReaction]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastTimeoutRequest = useRef(0);
  const insets = useSafeAreaInsets();

  const deadline = room?.public_state?.deadline ?? null;

  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [deadline]);

  // When time runs out, any phone at the table asks the server to play for the absent player.
  // The server checks the time itself, so an early or duplicate request is simply refused.
  useEffect(() => {
    const t = Date.now();
    if (!deadline || t < deadline || t - lastTimeoutRequest.current < 1000) return;
    lastTimeoutRequest.current = t;
    callServer({ type: 'timeout', roomId })
      .then(refresh)
      .catch(() => {});
  }, [deadline, now, roomId, refresh]);

  async function send(request: Parameters<typeof callServer>[0]) {
    setBusy(true);
    setError(null);
    try {
      await callServer(request);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (removed) {
    return (
      <View style={styles.loading}>
        <Text style={styles.removedIcon}>🚪</Text>
        <Text style={styles.removedText}>Le créateur de la table t’a retiré de la partie.</Text>
        <View style={styles.spacer} />
        <Button label="Retour à l'accueil" onPress={onLeave} />
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.loading}>
        {syncError ? (
          <Text style={styles.error}>{syncError}</Text>
        ) : (
          <ActivityIndicator color={colors.gold} />
        )}
        <View style={styles.spacer} />
        <Button label="Retour" variant="secondary" onPress={onLeave} />
      </View>
    );
  }

  const isHost = room.host_id === userId;
  // Someone who opened the table with "Regarder" follows it without a seat.
  const isSpectator = !players.some((p) => p.user_id === userId);
  const omaha = room.variant === 'omaha';
  const host = players.find((p) => p.user_id === room.host_id);
  const hand = room.public_state;
  const actor = hand && hand.toAct >= 0 ? hand.players[hand.toAct] : null;
  const myTurn = actor?.id === userId;
  const botTurn = actor !== null && (hand?.bots?.includes(actor.id) ?? false);
  const inHand = hand?.players.some((p) => p.id === userId) ?? false;
  const withChips = players.filter((p) => p.stack > 0);
  const waiting = hand ? players.filter((p) => !hand.players.some((h) => h.id === p.user_id)) : [];

  const avatars: Record<string, Avatar> = Object.fromEntries(
    players.map((p) => [
      p.user_id,
      {
        ...cleanAvatar({ emoji: p.avatar, color: p.avatar_color }, defaultAvatar(p.seat), UNLOCKABLE),
        frame: progressOf[p.user_id]?.frame,
        level: p.is_bot ? undefined : (progressOf[p.user_id]?.level ?? 1),
      },
    ]),
  );

  const names = { ...spectators, ...Object.fromEntries(players.map((p) => [p.user_id, p.name])) };
  const chat = (
    <ChatPanel
      visible={chatOpen}
      onClose={() => setChatOpen(false)}
      messages={messages}
      meId={userId}
      names={names}
      avatars={avatars}
      onSend={sendMessage}
    />
  );
  const chatButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? `Discussion, ${unread} nouveaux messages` : 'Discussion'}
      onPress={() => {
        setTrayOpen(false);
        setChatOpen(true);
      }}
      hitSlop={8}
      style={styles.reactButton}
    >
      <Text style={styles.reactButtonText}>💬</Text>
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );

  const manage = isHost && (
    <ManagePanel
      visible={manageOpen}
      onClose={() => setManageOpen(false)}
      room={room}
      players={players}
      meId={userId}
      avatars={avatars}
      onChanged={refresh}
    />
  );

  async function joinGame() {
    const [saved, avatar] = await Promise.all([loadLastRoom(), loadAvatar()]);
    const name = saved?.name ?? names[userId] ?? 'Joueur';
    await send({
      type: 'join',
      name,
      code: room!.code,
      avatar: cleanAvatar(avatar ?? defaultAvatar(players.length), defaultAvatar(players.length), UNLOCKABLE),
    });
  }

  const invite = () =>
    Share.share({ message: `Viens jouer au poker avec moi ! Code de la table : ${room.code}` });

  if (!hand) {
    return (
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}>
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Code de la table</Text>
          <Text style={styles.code}>{room.code}</Text>
          <Button label="Inviter des amis" variant="secondary" onPress={invite} />
        </View>
        <Panel title={`Joueurs (${players.length}/8)`}>
          {players.map((p) => (
            <View key={p.user_id} style={styles.lobbyPlayer}>
              <AvatarBadge avatar={avatars[p.user_id]} size={34} />
              <Text style={styles.lobbyName}>
                {p.name}
                {p.user_id === room.host_id ? ' 👑' : ''}
                {p.user_id === userId ? ' (toi)' : ''}
                {p.is_bot ? ' · robot' : ''}
              </Text>
            </View>
          ))}
          {omaha && <PanelText>🃏 Omaha : 4 cartes chacun, mises limitées au pot.</PanelText>}
          {room.level_minutes && (
            <PanelText>
              🏆 Tournoi : les blindes augmentent toutes les {room.level_minutes} minutes.
            </PanelText>
          )}
          {isSpectator ? (
            <>
              <PanelText>👀 Tu regardes cette table.</PanelText>
              <Button label="Rejoindre la partie" disabled={busy || players.length >= 8} onPress={joinGame} />
            </>
          ) : isHost ? (
            <Button
              label={players.length < 2 ? "En attente d'un autre joueur…" : 'Lancer la partie'}
              disabled={busy || players.length < 2}
              onPress={() => send({ type: 'deal', roomId })}
            />
          ) : (
            <PanelText>En attente que {host?.name ?? 'le créateur'} lance la partie…</PanelText>
          )}
        </Panel>
        <View style={styles.spacer} />
        <Button
          label={unread ? `💬 Discussion (${unread} nouveau${unread > 1 ? 'x' : ''})` : '💬 Discussion'}
          variant="secondary"
          onPress={() => setChatOpen(true)}
        />
        {isHost && players.length < 8 && (
          <>
            <View style={styles.spacer} />
            <Button
              label="🤖 Ajouter un robot"
              variant="secondary"
              disabled={busy}
              onPress={() => send({ type: 'addBot', roomId })}
            />
          </>
        )}
        {isHost && players.length > 1 && (
          <>
            <View style={styles.spacer} />
            <Button label="⚙️ Gérer la table" variant="secondary" onPress={() => setManageOpen(true)} />
          </>
        )}
        {syncError && <Text style={styles.error}>{syncError}</Text>}
        <View style={styles.spacer} />
        <Button label="Retour à l'accueil" variant="secondary" onPress={onLeave} />
        {chat}
        {manage}
      </ScrollView>
    );
  }

  return (
    <GameLayout
      top={
        <View style={styles.topWrap}>
          {/* Only an arrow here: the bar also holds the history, chat, reactions and table code. */}
          <TopBar onBack={onLeave} backLabel="←" backHint="Retour à l'accueil">
            {isHost && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Gérer la table"
                onPress={() => {
                  setTrayOpen(false);
                  setManageOpen(true);
                }}
                hitSlop={8}
                style={[styles.reactButton, room.paused && styles.reactButtonOpen]}
              >
                <Text style={styles.reactButtonText}>⚙️</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mains précédentes"
              onPress={() => {
                setTrayOpen(false);
                setHistoryOpen(true);
              }}
              hitSlop={8}
              style={styles.reactButton}
            >
              <Text style={styles.reactButtonText}>📜</Text>
            </Pressable>
            {chatButton}
            {!isSpectator && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Réagir"
                onPress={() => setTrayOpen(!trayOpen)}
                hitSlop={8}
                style={[styles.reactButton, trayOpen && styles.reactButtonOpen]}
              >
                <Text style={styles.reactButtonText}>😀</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Inviter des amis, code ${room.code}`}
              onPress={invite}
              hitSlop={8}
              style={styles.codePill}
            >
              {/* The host has one more button, so only the code fits on a small phone. */}
              <Text style={styles.codePillText}>
                <Text style={styles.codePillCode}>{room.code}</Text>
                {isHost ? '' : ' · Inviter'}
              </Text>
            </Pressable>
          </TopBar>
          {trayOpen && (
            <Appear from={-10} style={styles.tray}>
              {REACTIONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  accessibilityRole="button"
                  onPress={() => {
                    sendReaction(emoji);
                    setTrayOpen(false);
                  }}
                  style={({ pressed }) => [styles.trayItem, pressed && styles.trayItemPressed]}
                >
                  <Text style={styles.trayEmoji}>{emoji}</Text>
                </Pressable>
              ))}
            </Appear>
          )}
        </View>
      }
      table={({ width, height }) => (
        <Table
          hand={hand}
          meId={userId}
          maxWidth={width}
          maxHeight={height}
          reactions={reactions}
          avatars={avatars}
          bubbles={bubbles}
          nextLevelAt={hand.tournament?.nextLevelAt}
        />
      )}
      bottom={
        <>
          {actor && !botTurn && hand.deadline && (
            <TurnTimer deadline={hand.deadline} now={now} name={myTurn ? 'Toi' : actor.name} />
          )}

          {room.paused && (
            <View style={styles.pausePanel}>
              <Text style={styles.pauseTitle}>⏸ Partie en pause</Text>
              {isHost ? (
                <Button
                  compact
                  label="▶ Reprendre"
                  disabled={busy}
                  onPress={() => send({ type: 'pause', roomId, paused: false })}
                />
              ) : (
                <Text style={styles.waitText}>
                  {host?.name ?? 'Le créateur'} va bientôt reprendre la partie.
                </Text>
              )}
              {error && <Text style={styles.error}>{error}</Text>}
            </View>
          )}

          {!room.paused && myTurn && hand.street !== 'finished' && (
            <ActionPanel
              key={room.version}
              hand={hand}
              playerId={userId}
              title="À toi de jouer"
              hole={myCards}
              error={error}
              busy={busy}
              onAction={(action: Action) => send({ type: 'act', roomId, action })}
            />
          )}

          {!room.paused && !myTurn && hand.street !== 'finished' && (
            <View style={styles.waitPanel}>
              {inHand && myCards.length > 0 && (
                <View style={styles.cards}>
                  {myCards.map((c, i) => (
                    <Appear key={c} delay={i * 140}>
                      <PlayingCard card={c} width={myCards.length > 2 ? 30 : 42} />
                    </Appear>
                  ))}
                </View>
              )}
              <Text style={styles.waitText}>
                {isSpectator
                  ? '👀 Tu regardes'
                  : !inHand
                    ? 'Tu joueras à la prochaine main.'
                    : botTurn
                      ? `🤖 ${actor?.name} réfléchit…`
                      : actor
                        ? `Au tour de ${actor.name}`
                        : ''}
              </Text>
              {isSpectator && players.length < 8 && (
                <Button compact label="Rejoindre la partie" disabled={busy} onPress={joinGame} />
              )}
              {isSpectator && error && <Text style={styles.error}>{error}</Text>}
            </View>
          )}

          {!room.paused && hand.street === 'finished' && (
            <HandSummary hand={hand}>
              {withChips.length < 2 ? (
                <>
                  <PanelText>🏆 {withChips[0]?.name} gagne la partie !</PanelText>
                  <Ranking
                    entries={players
                      .filter((p) => p.stack > 0 || p.place !== null)
                      .map((p) => ({ name: p.name, place: p.stack > 0 ? 1 : (p.place ?? players.length) }))}
                  />
                </>
              ) : isHost ? (
                <Button
                  compact
                  label="Main suivante"
                  disabled={busy}
                  onPress={() => send({ type: 'deal', roomId })}
                />
              ) : (
                <PanelText>En attente que {host?.name ?? 'le créateur'} distribue…</PanelText>
              )}
              {error && <Text style={styles.error}>{error}</Text>}
            </HandSummary>
          )}

          {waiting.length > 0 && (
            <Text style={styles.note} numberOfLines={1}>
              Rejoindront à la prochaine main : {waiting.map((p) => p.name).join(', ')}
            </Text>
          )}
          {syncError && <Text style={styles.error}>{syncError}</Text>}
          {chat}
          {manage}
          <HistoryPanel
            visible={historyOpen}
            onClose={() => setHistoryOpen(false)}
            roomId={roomId}
            meId={userId}
            avatars={avatars}
          />
        </>
      }
    />
  );
}

/** Every emoji levels can unlock: the server checks each player's own level. */
const UNLOCKABLE = avatarEmojisFor(MAX_LEVEL);

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 56 },
  loading: { flex: 1, justifyContent: 'center', padding: 24 },
  codeBox: { alignItems: 'stretch', marginTop: 16, gap: 4 },
  codeLabel: { color: colors.muted, textAlign: 'center' },
  code: { color: colors.gold, fontSize: 40, fontWeight: '800', letterSpacing: 8, textAlign: 'center' },
  cards: { flexDirection: 'row', gap: 2 },
  codePill: {
    backgroundColor: colors.glass,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  topWrap: { zIndex: 10 },
  lobbyPlayer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  lobbyName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  reactButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  reactButtonOpen: { borderColor: colors.gold },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
  reactButtonText: { fontSize: 17 },
  tray: {
    position: 'absolute',
    top: 40,
    right: 0,
    flexDirection: 'row',
    gap: 4,
    padding: 6,
    borderRadius: 24,
    backgroundColor: 'rgba(6, 28, 19, 0.95)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
    zIndex: 20,
  },
  trayItem: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  trayItemPressed: { backgroundColor: 'rgba(255,255,255,0.12)' },
  trayEmoji: { fontSize: 26 },
  codePillText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  codePillCode: { color: colors.gold, fontWeight: '800', letterSpacing: 2 },
  waitPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    minHeight: 79,
  },
  pausePanel: {
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.gold,
    minHeight: 79,
    justifyContent: 'center',
  },
  pauseTitle: { color: colors.gold, fontSize: 18, fontWeight: '900' },
  removedIcon: { fontSize: 48, textAlign: 'center' },
  removedText: { color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center', marginTop: 12 },
  waitText: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center' },
  note: { color: colors.muted, textAlign: 'center', fontSize: 12 },
  error: { color: colors.gold, textAlign: 'center' },
  spacer: { height: 16 },
});
