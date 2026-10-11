import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableStateCallbackType,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type Action,
  type Avatar,
  ALL_AVATAR_EMOJIS,
  emotesFor,
  cleanAvatar,
  defaultAvatar,
} from '@appli-poker/engine';
import { ActionPanel } from '../components/ActionPanel';
import { AvatarBadge } from '../components/AvatarPicker';
import { ChatPanel } from '../components/ChatPanel';
import { HistoryPanel } from '../components/HistoryPanel';
import { InviteFriends } from '../components/InviteFriends';
import { NotifyPrompt } from '../components/Notifications';
import { ManagePanel } from '../components/ManagePanel';
import { Button } from '../components/Button';
import { GameLayout } from '../components/GameLayout';
import { HandSummary } from '../components/HandSummary';
import { Panel, PanelText } from '../components/Panel';
import { PlayingCard } from '../components/PlayingCard';
import { Ranking } from '../components/Ranking';
import { RematchPanel } from '../components/RematchPanel';
import { Table } from '../components/Table';
import { TopBar } from '../components/TopBar';
import { TurnTimer } from '../components/TurnTimer';
import { callServer, loadAvatar, loadLastRoom, saveLastRoom, supabase } from '../online/supabase';
import { useRoom } from '../online/useRoom';
import { useMyProgress, useProgressOf } from '../online/progress';
import { sounds, useHandSounds } from '../feedback';
import { Appear } from '../components/Motion';
import { useDesktop } from '../layout';
import { colors } from '../theme';
import { t, tn } from '../i18n';
import { tMessage } from '../online/messages';
import { useDeadlineClock } from '../online/timers';

interface Props {
  roomId: string;
  userId: string;
  onLeave: () => void;
  /** Goes to another table: the rematch of this one. */
  onSwitch: (roomId: string) => void;
}

export function OnlineRoomScreen({ roomId, userId, onLeave, onSwitch }: Props) {
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
  const myEmotes = emotesFor(useMyProgress()?.owned ?? []);
  const [chatOpen, setChatOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const desktop = useDesktop();
  /** On a computer, the side panel next to the table shows the chat or the past hands. */
  const [sideTab, setSideTab] = useState<'chat' | 'history'>('chat');
  // On a computer the chat is drawn beside the table (always in the waiting room).
  const chatShown = chatOpen || (desktop && (!room?.public_state || sideTab === 'chat'));
  /** Names of the people watching, so their chat messages are signed. */
  const [spectators, setSpectators] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!chatShown) return;
    supabase
      .from('room_spectators')
      .select('user_id, name')
      .eq('room_id', roomId)
      .then(({ data }) => {
        if (data) setSpectators(Object.fromEntries(data.map((s) => [s.user_id, `👀 ${s.name}`])));
      });
  }, [chatShown, roomId]);
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
    if (chatShown || readUpTo === null) setReadUpTo(lastMessageId ?? 0);
  }, [messagesLoaded, lastMessageId, chatShown, readUpTo]);
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
  const lastTimeoutRequest = useRef(0);
  const insets = useSafeAreaInsets();

  const deadline = room?.public_state?.deadline ?? null;

  const now = useDeadlineClock(deadline, 500);

  // When time runs out, any phone at the table asks the server to play for the absent player.
  // The server checks the time itself, so an early or duplicate request is simply refused.
  useEffect(() => {
    const ts = Date.now();
    if (!deadline || ts < deadline || ts - lastTimeoutRequest.current < 1000) return;
    lastTimeoutRequest.current = ts;
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
      setError(tMessage((e as Error).message));
      sounds.invalid();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (removed) {
    return (
      <View style={styles.loading}>
        <Text style={styles.removedIcon}>🚪</Text>
        <Text style={styles.removedText}>{t('Le créateur de la table t’a retiré de la partie.')}</Text>
        <View style={styles.spacer} />
        <Button label={t("Retour à l'accueil")} onPress={onLeave} />
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
        <Button label={t('Retour')} variant="secondary" onPress={onLeave} />
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
  const chatProps = { messages, meId: userId, names, avatars, onSend: sendMessage };
  // On a computer the chat sits beside the table or the waiting room instead of in a sheet.
  const chat = !desktop && <ChatPanel visible={chatOpen} onClose={() => setChatOpen(false)} {...chatProps} />;
  const chatInline = <ChatPanel inline visible onClose={() => {}} {...chatProps} />;
  const chatButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        unread
          ? tn(unread, 'Discussion, {n} nouveau message', 'Discussion, {n} nouveaux messages')
          : t('Discussion')
      }
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
    const name = saved?.name ?? names[userId] ?? t('Joueur');
    await send({
      type: 'join',
      name,
      code: room!.code,
      avatar: cleanAvatar(avatar ?? defaultAvatar(players.length), defaultAvatar(players.length), UNLOCKABLE),
    });
  }

  /** Opens or joins the rematch table, then goes there. */
  async function rematch() {
    const { roomId: next } = await callServer<{ roomId: string }>({ type: 'rematch', roomId });
    const me = players.find((p) => p.user_id === userId);
    if (me) await saveLastRoom({ roomId: next, name: me.name });
    onSwitch(next);
  }

  const invite = () =>
    Share.share({
      message: t('Viens jouer au poker avec moi ! Code de la table : {code}', { code: room.code }),
    });

  if (!hand) {
    const codeBox = (
      <View style={[styles.codeBox, desktop && styles.codeBoxWide]}>
        <Text style={styles.codeLabel}>{t('Code de la table')}</Text>
        <Text style={[styles.code, desktop && styles.codeWide]}>{room.code}</Text>
        <View style={desktop && styles.centered}>
          <Button label={t('Inviter des amis')} variant="secondary" onPress={invite} />
        </View>
      </View>
    );
    const invites = !isSpectator && (
      <>
        <InviteFriends game="poker" code={room.code} />
        <NotifyPrompt />
      </>
    );
    const playerRows = players.map((p) => (
      <View key={p.user_id} style={[styles.lobbyPlayer, desktop && styles.lobbyPlayerWide]}>
        <AvatarBadge avatar={avatars[p.user_id]} size={desktop ? 40 : 34} />
        <Text style={styles.lobbyName} numberOfLines={desktop ? 1 : undefined}>
          {p.name}
          {p.user_id === room.host_id ? ' 👑' : ''}
          {p.user_id === userId ? t(' (toi)') : ''}
          {p.is_bot ? t(' · robot') : ''}
        </Text>
      </View>
    ));
    const playersPanel = (
      <Panel title={t('Joueurs ({n}/8)', { n: players.length })}>
        {/* Two columns of players on a computer. */}
        {desktop ? <View style={styles.lobbyGrid}>{playerRows}</View> : playerRows}
        {omaha && <PanelText>{t('🃏 Omaha : 4 cartes chacun, mises limitées au pot.')}</PanelText>}
        {room.level_minutes && (
          <PanelText>
            {t('🏆 Tournoi : les blindes augmentent toutes les {n} minutes.', { n: room.level_minutes })}
          </PanelText>
        )}
        {isSpectator ? (
          <>
            <PanelText>{t('👀 Tu regardes cette table.')}</PanelText>
            <Button
              label={t('Rejoindre la partie')}
              disabled={busy || players.length >= 8}
              onPress={joinGame}
            />
          </>
        ) : isHost ? (
          <Button
            label={players.length < 2 ? t("En attente d'un autre joueur…") : t('Lancer la partie')}
            disabled={busy || players.length < 2}
            onPress={() => send({ type: 'deal', roomId })}
          />
        ) : (
          <PanelText>
            {t('En attente que {name} lance la partie…', { name: host?.name ?? t('le créateur') })}
          </PanelText>
        )}
      </Panel>
    );
    const addBot = isHost && players.length < 8 && (
      <Button
        label={t('🤖 Ajouter un robot')}
        variant="secondary"
        disabled={busy}
        onPress={() => send({ type: 'addBot', roomId })}
      />
    );
    const manageButton = isHost && players.length > 1 && (
      <Button label={t('⚙️ Gérer la table')} variant="secondary" onPress={() => setManageOpen(true)} />
    );
    const back = <Button label={t("Retour à l'accueil")} variant="secondary" onPress={onLeave} />;

    if (desktop) {
      // On a computer: the table and its players on the left, invitations and the chat on the right.
      return (
        <ScrollView contentContainerStyle={[styles.lobbyWide, { paddingTop: insets.top + 32 }]}>
          <View style={styles.lobbyColumns}>
            <View style={styles.lobbyMain}>
              {codeBox}
              {playersPanel}
              <View style={styles.lobbyActions}>
                {addBot && <View style={styles.natural}>{addBot}</View>}
                {manageButton && <View style={styles.natural}>{manageButton}</View>}
                <View style={styles.flexSpacer} />
                <View style={styles.natural}>{back}</View>
              </View>
              {syncError && <Text style={styles.error}>{syncError}</Text>}
            </View>
            <View style={styles.lobbySide}>
              {invites}
              <SideCard title={t('💬 Discussion')}>{chatInline}</SideCard>
            </View>
          </View>
          {manage}
        </ScrollView>
      );
    }

    return (
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}>
        {codeBox}
        {invites}
        {playersPanel}
        <View style={styles.spacer} />
        <Button
          label={
            unread
              ? tn(unread, '💬 Discussion ({n} nouveau)', '💬 Discussion ({n} nouveaux)')
              : t('💬 Discussion')
          }
          variant="secondary"
          onPress={() => setChatOpen(true)}
        />
        {addBot && (
          <>
            <View style={styles.spacer} />
            {addBot}
          </>
        )}
        {manageButton && (
          <>
            <View style={styles.spacer} />
            {manageButton}
          </>
        )}
        {syncError && <Text style={styles.error}>{syncError}</Text>}
        <View style={styles.spacer} />
        {back}
        {chat}
        {manage}
      </ScrollView>
    );
  }

  const controls = (
    <>
      {actor && !botTurn && hand.deadline && (
        <TurnTimer deadline={hand.deadline} now={now} name={myTurn ? t('Toi') : actor.name} />
      )}

      {room.paused && (
        <View style={styles.pausePanel}>
          <Text style={styles.pauseTitle}>{t('⏸ Partie en pause')}</Text>
          {isHost ? (
            <Button
              compact
              label={t('▶ Reprendre')}
              disabled={busy}
              onPress={() => send({ type: 'pause', roomId, paused: false })}
            />
          ) : (
            <Text style={styles.waitText}>
              {t('{name} va bientôt reprendre la partie.', { name: host?.name ?? t('Le créateur') })}
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
          title={t('À toi de jouer')}
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
                  <PlayingCard card={c} width={(myCards.length > 2 ? 30 : 42) * (desktop ? 1.43 : 1)} />
                </Appear>
              ))}
            </View>
          )}
          <Text style={styles.waitText}>
            {isSpectator
              ? t('👀 Tu regardes')
              : !inHand
                ? t('Tu joueras à la prochaine main.')
                : botTurn
                  ? t('🤖 {name} réfléchit…', { name: actor?.name ?? '' })
                  : actor
                    ? t('Au tour de {name}', { name: actor.name })
                    : ''}
          </Text>
          {isSpectator && players.length < 8 && (
            <Button compact label={t('Rejoindre la partie')} disabled={busy} onPress={joinGame} />
          )}
          {isSpectator && error && <Text style={styles.error}>{error}</Text>}
        </View>
      )}

      {!room.paused && hand.street === 'finished' && (
        <HandSummary hand={hand}>
          {withChips.length < 2 ? (
            <>
              <PanelText>{t('🏆 {name} gagne la partie !', { name: withChips[0]?.name ?? '' })}</PanelText>
              <Ranking
                entries={players
                  .filter((p) => p.stack > 0 || p.place !== null)
                  .map((p) => ({ name: p.name, place: p.stack > 0 ? 1 : (p.place ?? players.length) }))}
              />
              {!isSpectator && <RematchPanel bare rematch={room.rematch} meId={userId} onRematch={rematch} />}
            </>
          ) : isHost ? (
            <Button
              compact
              label={t('Main suivante')}
              disabled={busy}
              onPress={() => send({ type: 'deal', roomId })}
            />
          ) : (
            <PanelText>
              {t('En attente que {name} distribue…', { name: host?.name ?? t('le créateur') })}
            </PanelText>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </HandSummary>
      )}

      {waiting.length > 0 && (
        <Text style={styles.note} numberOfLines={1}>
          {t('Rejoindront à la prochaine main : {names}', {
            names: waiting.map((p) => p.name).join(', '),
          })}
        </Text>
      )}
      {syncError && <Text style={styles.error}>{syncError}</Text>}
    </>
  );

  const table = (width: number, height: number, wide?: boolean) => (
    <Table
      hand={hand}
      meId={userId}
      maxWidth={width}
      maxHeight={height}
      reactions={reactions}
      avatars={avatars}
      bubbles={bubbles}
      nextLevelAt={hand.tournament?.nextLevelAt}
      wide={wide}
    />
  );

  return (
    <GameLayout
      top={
        <View style={styles.topWrap}>
          {/* Only an arrow here: the bar also holds the history, chat, reactions and table code. */}
          <TopBar onBack={onLeave} backLabel="←" backHint={t("Retour à l'accueil")}>
            {isHost && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Gérer la table')}
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
            {/* On a computer the history and the chat are always beside the table. */}
            {!desktop && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Mains précédentes')}
                onPress={() => {
                  setTrayOpen(false);
                  setHistoryOpen(true);
                }}
                hitSlop={8}
                style={styles.reactButton}
              >
                <Text style={styles.reactButtonText}>📜</Text>
              </Pressable>
            )}
            {!desktop && chatButton}
            {!isSpectator && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Réagir')}
                onPress={() => setTrayOpen(!trayOpen)}
                hitSlop={8}
                style={[styles.reactButton, trayOpen && styles.reactButtonOpen]}
              >
                <Text style={styles.reactButtonText}>😀</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Inviter des amis, code {code}', { code: room.code })}
              onPress={invite}
              hitSlop={8}
              style={styles.codePill}
            >
              {/* The host has one more button, so only the code fits on a small phone. */}
              <Text style={styles.codePillText}>
                <Text style={styles.codePillCode}>{room.code}</Text>
                {isHost && !desktop ? '' : t(' · Inviter')}
              </Text>
            </Pressable>
          </TopBar>
          {trayOpen && (
            <Appear from={-10} style={styles.tray}>
              {myEmotes.map((emoji) => (
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
      table={({ width, height }) =>
        desktop ? (
          // On a computer: the table and its controls on the left, the chat and past hands on the right.
          <View style={[styles.desk, { width, height }]}>
            <View style={styles.deskMain}>
              <Measured>{(size) => table(size.width, size.height, true)}</Measured>
              <View style={styles.deskControls}>{controls}</View>
            </View>
            <View style={styles.side}>
              <View style={styles.tabs}>
                <SideTab
                  label={t('💬 Discussion')}
                  active={sideTab === 'chat'}
                  badge={sideTab === 'chat' ? 0 : unread}
                  onPress={() => setSideTab('chat')}
                />
                <SideTab
                  label={t('📜 Mains précédentes')}
                  active={sideTab === 'history'}
                  onPress={() => setSideTab('history')}
                />
              </View>
              {sideTab === 'chat' ? (
                chatInline
              ) : (
                <HistoryPanel
                  inline
                  visible
                  onClose={() => setSideTab('chat')}
                  roomId={roomId}
                  meId={userId}
                  avatars={avatars}
                  reloadKey={room.hand_number * 2 + (hand.street === 'finished' ? 1 : 0)}
                />
              )}
            </View>
          </View>
        ) : (
          table(width, height)
        )
      }
      bottom={
        <>
          {!desktop && controls}
          {chat}
          {manage}
          {!desktop && (
            <HistoryPanel
              visible={historyOpen}
              onClose={() => setHistoryOpen(false)}
              roomId={roomId}
              meId={userId}
              avatars={avatars}
            />
          )}
        </>
      }
    />
  );
}

/** Fills the space it is given and hands its size to the content, once known. */
function Measured({ children }: { children: (size: { width: number; height: number }) => ReactNode }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  return (
    <View
      style={styles.measured}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {size && children(size)}
    </View>
  );
}

/** A tab at the top of the side panel, with a red count of unread messages. */
function SideTab({
  label,
  active,
  badge = 0,
  onPress,
}: {
  label: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={(state) => [
        styles.tab,
        (state as PressableStateCallbackType & { hovered?: boolean }).hovered && styles.tabHover,
        active && styles.tabActive,
      ]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
        {label}
      </Text>
      {badge > 0 && (
        <View style={styles.tabBadge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** A titled card in the side column of the waiting room. */
function SideCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.sideCard}>
      <Text style={styles.sideTitle}>{title}</Text>
      {children}
    </View>
  );
}

/** Every emoji levels can unlock: the server checks each player's own level. */
const UNLOCKABLE = ALL_AVATAR_EMOJIS;

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
    flexWrap: 'wrap',
    maxWidth: 288,
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
  natural: { alignSelf: 'flex-start' },
  centered: { alignSelf: 'center', marginTop: 4 },
  flexSpacer: { flex: 1 },
  // Waiting room on a computer.
  lobbyWide: { paddingHorizontal: 32, paddingBottom: 32 },
  lobbyColumns: { flexDirection: 'row', gap: 28, width: '100%', maxWidth: 1120, alignSelf: 'center' },
  lobbyMain: { flex: 1, minWidth: 0 },
  lobbySide: { width: 380 },
  codeBoxWide: {
    alignItems: 'center',
    marginTop: 0,
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.gold,
    gap: 6,
  },
  codeWide: { fontSize: 52, letterSpacing: 12 },
  lobbyGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  lobbyPlayerWide: { width: '50%', paddingRight: 12 },
  lobbyActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  sideCard: {
    marginTop: 14,
    height: 460,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingTop: 12,
    overflow: 'hidden',
  },
  sideTitle: { color: colors.text, fontSize: 17, fontWeight: '800', paddingHorizontal: 16, paddingBottom: 6 },
  // Game on a computer.
  desk: { flexDirection: 'row', gap: 20 },
  deskMain: { flex: 1, minWidth: 0 },
  measured: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' },
  deskControls: { width: '100%', maxWidth: 780, alignSelf: 'center', gap: 6, marginTop: 8 },
  side: {
    width: 340,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
    marginBottom: 6,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabHover: { backgroundColor: 'rgba(255,255,255,0.06)' },
  tabActive: { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.gold },
  tabText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: colors.text },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
});
