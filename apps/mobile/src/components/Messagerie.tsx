import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ALL_AVATAR_EMOJIS,
  type Avatar,
  type OnlineGameId,
  cleanAvatar,
  cleanEquipped,
  cleanOwned,
  defaultAvatar,
  levelFromXp,
} from '@appli-poker/engine';
import { AvatarBadge } from './AvatarPicker';
import type { FriendRow } from '../online/progress';
import {
  type Conversation,
  DIRECT_MESSAGE_MAX,
  type DirectMessage,
  loadConversations,
  loadThread,
  markRead,
  sendDirect,
  useDirectMessages,
  useOnline,
} from '../online/messagerie';
import { inviteFriend } from '../online/invites';
import { callGames, ensureSignedIn, loadAvatar, loadName } from '../online/supabase';
import { tMessage } from '../online/messages';
import { ONLINE_UI } from '../online-games';
import { sounds } from '../feedback';
import { lang, t } from '../i18n';
import { colors, gradients } from '../theme';

/** One tap sends these. */
const QUICK_EMOJIS = ['👋', '😂', '👍', '🔥', '🎉', '😮', '❤️', '🃏', '🎲', '🏆'];

/** The avatar a friend chose, with their frame. */
export function friendAvatar(row: FriendRow, index: number): Avatar {
  const level = levelFromXp(row.xp);
  const equipped = cleanEquipped(row.equipped, level, cleanOwned(row.owned));
  const avatar = cleanAvatar(
    { emoji: row.avatar, color: row.avatar_color },
    defaultAvatar(index),
    ALL_AVATAR_EMOJIS,
  );
  return { ...avatar, frame: equipped.frame, level };
}

/** A friend's avatar with a green dot when they have the app open. */
export function PresenceAvatar({ avatar, size, online }: { avatar: Avatar; size: number; online: boolean }) {
  const dot = Math.max(10, Math.round(size * 0.28));
  return (
    <View style={{ width: size, height: size }}>
      <AvatarBadge avatar={avatar} size={size} />
      {online && (
        <View
          accessibilityLabel={t('En ligne{p}', { p: '' })}
          style={[styles.dot, { width: dot, height: dot, borderRadius: dot / 2 }]}
        />
      )}
    </View>
  );
}

function clock(iso: string) {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function daysAgo(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((start(today) - start(d)) / 86_400_000);
}

/** "14:05", "Hier", or the date. */
function when(iso: string) {
  const ago = daysAgo(iso);
  if (ago <= 0) return clock(iso);
  if (ago === 1) return t('Hier');
  const d = new Date(iso);
  return lang === 'en' ? `${d.getMonth() + 1}/${d.getDate()}` : `${d.getDate()}/${d.getMonth() + 1}`;
}

function dayLabel(iso: string) {
  const ago = daysAgo(iso);
  if (ago <= 0) return t('Aujourd’hui');
  if (ago === 1) return t('Hier');
  return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function gameTitle(game: string | null) {
  return t(ONLINE_UI[game as OnlineGameId]?.title ?? 'Poker');
}

function preview(c: Conversation) {
  if (c.last_game) return t('🎲 Invitation : {game}', { game: gameTitle(c.last_game) });
  const body = c.last_body.replace(/\s+/g, ' ');
  return c.last_mine ? t('Toi : {text}', { text: body }) : body;
}

interface PanelProps {
  friends: FriendRow[] | null;
  desktop: boolean;
  /** Opens straight on this friend's conversation (from a notification). */
  initialFriend?: string | null;
  onJoin?: (game: string, code: string) => void;
  /** Goes to the tab where friends are added. */
  onAddFriends: () => void;
}

/** My conversations with friends; on a computer the list and the open conversation side by side. */
export function MessagesPanel({ friends, desktop, initialFriend, onJoin, onAddFriends }: PanelProps) {
  const online = useOnline();
  const [conversations, setConversations] = useState<Record<string, Conversation>>({});
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<string | null>(initialFriend ?? null);
  const openRef = useRef(open);
  openRef.current = open;

  const reload = useCallback(async () => {
    try {
      const list = await loadConversations();
      setConversations(Object.fromEntries(list.map((c) => [c.friend_id, c])));
    } catch {
      // Offline: the list shows friends without their last message.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // A new message moves its conversation to the top (and counts as unread unless it is open).
  useDirectMessages(
    useCallback((m: DirectMessage) => {
      ensureSignedIn().then((me) => {
        const friend = m.sender_id === me ? m.recipient_id : m.sender_id;
        setConversations((all) => {
          const before = all[friend];
          if (before && before.last_id > m.id) return all;
          const mine = m.sender_id === me;
          const isNew = !before || before.last_id !== m.id;
          return {
            ...all,
            [friend]: {
              friend_id: friend,
              last_id: m.id,
              last_body: m.body,
              last_game: m.game,
              last_mine: mine,
              last_at: m.created_at,
              last_read: !!m.read_at,
              unread: (before?.unread ?? 0) + (!mine && isNew && friend !== openRef.current ? 1 : 0),
            },
          };
        });
      });
    }, []),
  );

  const sorted = (friends ?? [])
    .filter((f) => !f.me)
    .map((f, i) => ({ row: f, index: i + 1, conversation: conversations[f.user_id] }))
    .sort((a, b) => {
      const at = a.conversation?.last_id ?? 0;
      const bt = b.conversation?.last_id ?? 0;
      if (at !== bt) return bt - at;
      return Number(online.has(b.row.user_id)) - Number(online.has(a.row.user_id));
    });

  // On a computer, show the latest conversation rather than an empty pane.
  useEffect(() => {
    if (desktop && !open && loaded && sorted.length > 0) setOpen(sorted[0].row.user_id);
  }, [desktop, open, loaded, sorted.length]);

  const me = friends?.find((f) => f.me);
  const current = sorted.find((s) => s.row.user_id === open);

  function choose(id: string) {
    setOpen(id);
    setConversations((all) => (all[id] ? { ...all, [id]: { ...all[id], unread: 0 } } : all));
  }

  const list = (
    <ScrollView style={desktop ? styles.listPane : styles.flex} contentContainerStyle={styles.listContent}>
      {friends === null || !loaded ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} />
      ) : sorted.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.empty}>{t('Ajoute des amis avec leur code pour discuter avec eux !')}</Text>
          <Pressable accessibilityRole="button" onPress={onAddFriends} style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>{t('👥 Ajouter un ami')}</Text>
          </Pressable>
        </View>
      ) : (
        sorted.map(({ row, index, conversation: c }) => {
          const selected = desktop && row.user_id === open;
          const isOnline = online.has(row.user_id);
          return (
            <Pressable
              key={row.user_id}
              accessibilityRole="button"
              accessibilityLabel={
                c && c.unread > 0
                  ? t('{name}, {n} messages non lus', { name: row.name, n: c.unread })
                  : row.name
              }
              onPress={() => choose(row.user_id)}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                styles.convRow,
                selected && styles.convRowOn,
                (pressed || hovered) && !selected && styles.convRowHover,
              ]}
            >
              <PresenceAvatar avatar={friendAvatar(row, index)} size={48} online={isOnline} />
              <View style={styles.convBody}>
                <View style={styles.convTop}>
                  <Text style={styles.convName} numberOfLines={1}>
                    {row.name}
                  </Text>
                  {c && (
                    <Text style={[styles.convTime, c.unread > 0 && styles.convTimeNew]}>
                      {when(c.last_at)}
                    </Text>
                  )}
                </View>
                <View style={styles.convTop}>
                  <Text
                    style={[styles.convPreview, c && c.unread > 0 && styles.convPreviewNew]}
                    numberOfLines={1}
                  >
                    {c
                      ? preview(c)
                      : isOnline
                        ? t('En ligne · dis-lui bonjour !')
                        : t('Pas encore de message')}
                  </Text>
                  {c && c.unread > 0 && (
                    <View style={styles.unread}>
                      <Text style={styles.unreadText}>{c.unread > 99 ? '99+' : c.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );

  const conversation = current ? (
    <ConversationView
      key={current.row.user_id}
      friend={current.row}
      avatar={friendAvatar(current.row, current.index)}
      online={online.has(current.row.user_id)}
      myName={me?.name ?? ''}
      desktop={desktop}
      onBack={desktop ? undefined : () => setOpen(null)}
      onJoin={onJoin}
      onRead={() =>
        setConversations((all) =>
          all[current.row.user_id]
            ? { ...all, [current.row.user_id]: { ...all[current.row.user_id], unread: 0 } }
            : all,
        )
      }
    />
  ) : null;

  if (desktop) {
    return (
      <View style={styles.panes}>
        {list}
        <View style={styles.chatPane}>
          {conversation ?? (
            <View style={styles.placeholder}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.empty}>{t('Choisis un ami pour discuter.')}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }
  return conversation ?? list;
}

interface ConversationProps {
  friend: FriendRow;
  avatar: Avatar;
  online: boolean;
  myName: string;
  desktop: boolean;
  onBack?: () => void;
  onJoin?: (game: string, code: string) => void;
  onRead: () => void;
}

/** A pending message I just sent, before the server answers. */
type Shown = DirectMessage & { pending?: boolean };

/** Oldest first, messages still being sent last. */
function byOrder(list: Shown[]): Shown[] {
  return list.sort((a, b) => (a.pending ? 1 : 0) - (b.pending ? 1 : 0) || a.id - b.id);
}

function ConversationView({
  friend,
  avatar,
  online,
  myName,
  desktop,
  onBack,
  onJoin,
  onRead,
}: ConversationProps) {
  const [me, setMe] = useState<string | null>(null);
  const [messages, setMessages] = useState<Shown[] | null>(null);
  const [more, setMore] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [inviting, setInviting] = useState<OnlineGameId | null>(null);
  const list = useRef<ScrollView>(null);
  const stick = useRef(true);
  const id = friend.user_id;

  useEffect(() => {
    ensureSignedIn().then(setMe);
    loadThread(id)
      .then((rows) => {
        setMessages(rows);
        setMore(rows.length >= 60);
        markRead(id).then(onRead);
      })
      .catch((e) => {
        setMessages([]);
        setError((e as Error).message);
      });
  }, [id]);

  useDirectMessages(
    useCallback(
      (m: DirectMessage) => {
        if (m.sender_id !== id && m.recipient_id !== id) return;
        setMessages((list) => {
          if (!list) return list;
          const at = list.findIndex((x) => x.id === m.id);
          if (at >= 0) return list.map((x) => (x.id === m.id ? m : x));
          return byOrder([...list, m]);
        });
        if (m.sender_id === id && !m.read_at) {
          sounds.reaction();
          markRead(id).then(onRead);
        }
      },
      [id],
    ),
  );

  useEffect(() => {
    if (stick.current) setTimeout(() => list.current?.scrollToEnd({ animated: false }), 30);
  }, [messages?.length]);

  async function older() {
    const first = messages?.find((m) => !m.pending);
    if (!first) return;
    stick.current = false;
    const rows = await loadThread(id, first.id).catch(() => []);
    setMore(rows.length >= 60);
    setMessages((list) => [...rows, ...(list ?? [])]);
  }

  async function send(value: string) {
    const body = value.trim();
    if (!body || !me) return;
    stick.current = true;
    setError(null);
    const temp: Shown = {
      id: Number.MAX_SAFE_INTEGER - Date.now(),
      sender_id: me,
      recipient_id: id,
      body,
      game: null,
      room_code: null,
      created_at: new Date().toISOString(),
      read_at: null,
      pending: true,
    };
    setMessages((list) => [...(list ?? []), temp]);
    if (value === text) setText('');
    try {
      const saved = await sendDirect(id, body);
      setMessages((list) => {
        const rest = (list ?? []).filter((m) => m.id !== temp.id && m.id !== saved.id);
        return byOrder([...rest, saved]);
      });
    } catch (e) {
      setMessages((list) => (list ?? []).filter((m) => m.id !== temp.id));
      if (value === text) setText(value);
      setError(tMessage((e as Error).message));
      sounds.invalid();
    }
  }

  /** Opens a table of this game, invites my friend to it and takes me there. */
  async function invite(game: OnlineGameId) {
    setInviting(game);
    setError(null);
    try {
      const [name, saved] = await Promise.all([loadName(), loadAvatar()]);
      const who = (name || myName || t('Joueur')).trim().slice(0, 16);
      const look = cleanAvatar(saved ?? defaultAvatar(0), defaultAvatar(0));
      const { code } = await callGames<{ roomId: string; code: string }>({
        type: 'create',
        game,
        name: who,
        avatar: look,
        options: ONLINE_UI[game].defaultOptions,
      });
      await inviteFriend(id, game, code);
      sounds.win();
      setPicking(false);
      onJoin?.(game, code);
    } catch (e) {
      setError(tMessage((e as Error).message));
    } finally {
      setInviting(null);
    }
  }

  const lastMine = messages
    ? [...messages].reverse().find((m) => m.sender_id === me && !m.pending)
    : undefined;

  return (
    <View style={styles.chat}>
      <View style={styles.chatHeader}>
        {onBack && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Retour aux messages')}
            onPress={onBack}
            hitSlop={10}
            style={styles.back}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>
        )}
        <PresenceAvatar avatar={avatar} size={40} online={online} />
        <View style={styles.flex}>
          <Text style={styles.chatName} numberOfLines={1}>
            {friend.name}
          </Text>
          <Text style={[styles.chatStatus, online && styles.chatStatusOn]}>
            {online ? t('● En ligne') : t('Hors ligne')}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: picking }}
          onPress={() => setPicking((p) => !p)}
          style={({ pressed }) => [styles.inviteButton, pressed && styles.pressed]}
        >
          <LinearGradient colors={gradients.gold} style={styles.inviteInner}>
            <Text style={styles.inviteText}>{desktop ? t('🎮 Inviter à une partie') : t('🎮 Inviter')}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {picking && (
        <View style={styles.picker}>
          <Text style={styles.pickerTitle}>
            {t('Ouvre une table et invite {name} :', { name: friend.name })}
          </Text>
          <View style={styles.pickerGrid}>
            {(Object.keys(ONLINE_UI) as OnlineGameId[]).map((game) => (
              <Pressable
                key={game}
                accessibilityRole="button"
                disabled={inviting !== null}
                onPress={() => invite(game)}
                style={({ pressed }) => [
                  styles.pickerChip,
                  inviting === game && styles.pickerChipOn,
                  pressed && styles.pressed,
                  inviting !== null && inviting !== game && styles.disabled,
                ]}
              >
                {inviting === game ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : (
                  <Text style={styles.pickerEmoji}>{ONLINE_UI[game].emoji}</Text>
                )}
                <Text style={styles.pickerText} numberOfLines={1}>
                  {gameTitle(game)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <ScrollView
        ref={list}
        style={styles.flex}
        contentContainerStyle={styles.messages}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          stick.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
        }}
        scrollEventThrottle={100}
      >
        {more && (
          <Pressable accessibilityRole="button" onPress={older} style={styles.older}>
            <Text style={styles.olderText}>{t('Messages précédents')}</Text>
          </Pressable>
        )}
        {messages === null && <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} />}
        {messages?.length === 0 && (
          <View style={styles.placeholder}>
            <Text style={styles.emptyIcon}>👋</Text>
            <Text style={styles.empty}>{t('Dis bonjour à {name} !', { name: friend.name })}</Text>
          </View>
        )}
        {messages?.map((m, i) => {
          const mine = m.sender_id === me;
          const prev = messages[i - 1];
          const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
          const follow = !newDay && prev?.sender_id === m.sender_id;
          return (
            <View key={m.id}>
              {newDay && <Text style={styles.day}>{dayLabel(m.created_at)}</Text>}
              <View style={[styles.row, mine && styles.rowMine, follow && styles.rowFollow]}>
                {m.game && m.room_code ? (
                  <View style={[styles.card, mine && styles.cardMine]}>
                    <Text style={styles.cardEmoji}>{ONLINE_UI[m.game as OnlineGameId]?.emoji ?? '🃏'}</Text>
                    <View style={styles.flex}>
                      <Text style={styles.cardTitle}>
                        {mine
                          ? t('Tu as invité {name} à jouer', { name: friend.name })
                          : t('{name} t’invite à jouer', { name: friend.name })}
                      </Text>
                      <Text style={styles.cardText}>
                        {t('{game} · code {code}', { game: gameTitle(m.game), code: m.room_code })}
                      </Text>
                      <Text style={styles.cardTime}>{clock(m.created_at)}</Text>
                    </View>
                    {onJoin && (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => onJoin(m.game!, m.room_code!)}
                        style={styles.cardJoin}
                      >
                        <LinearGradient colors={gradients.gold} style={styles.cardJoinInner}>
                          <Text style={styles.cardJoinText}>{mine ? t('Ma table') : t('Rejoindre')}</Text>
                        </LinearGradient>
                      </Pressable>
                    )}
                  </View>
                ) : (
                  <View
                    style={[
                      styles.bubble,
                      mine ? styles.bubbleMine : styles.bubbleOther,
                      m.pending && styles.pending,
                    ]}
                  >
                    <Text style={[styles.body, mine && styles.bodyMine]} selectable>
                      {m.body}
                    </Text>
                    <Text style={[styles.time, mine && styles.timeMine]}>
                      {m.pending ? '…' : clock(m.created_at)}
                    </Text>
                  </View>
                )}
              </View>
              {lastMine && m.id === lastMine.id && m.read_at && <Text style={styles.seen}>{t('Vu ✓✓')}</Text>}
            </View>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickBar}
        contentContainerStyle={styles.quick}
        keyboardShouldPersistTaps="handled"
      >
        {QUICK_EMOJIS.map((e) => (
          <Pressable
            key={e}
            accessibilityRole="button"
            accessibilityLabel={t('Envoyer {emoji}', { emoji: e })}
            onPress={() => send(e)}
            style={({ pressed }) => [styles.emoji, pressed && styles.pressed]}
          >
            <Text style={styles.emojiText}>{e}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('Écris à {name}…', { name: friend.name })}
          placeholderTextColor={colors.muted}
          maxLength={DIRECT_MESSAGE_MAX}
          returnKeyType="send"
          onSubmitEditing={() => send(text)}
          blurOnSubmit={false}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Envoyer')}
          disabled={!text.trim()}
          onPress={() => send(text)}
          style={({ pressed }) => [styles.send, !text.trim() && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.sendText}>➤</Text>
        </Pressable>
      </View>
      {text.length > DIRECT_MESSAGE_MAX - 80 && (
        <Text style={styles.counter}>
          {text.length}/{DIRECT_MESSAGE_MAX}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  dot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    backgroundColor: '#3ddc84',
    borderWidth: 2,
    borderColor: '#0b1f17',
  },
  panes: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  listPane: {
    width: 340,
    flexGrow: 0,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  chatPane: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  listContent: { padding: 8, gap: 4 },
  convRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14 },
  convRowOn: { backgroundColor: 'rgba(255,193,7,0.14)' },
  convRowHover: { backgroundColor: 'rgba(255,255,255,0.06)' },
  convBody: { flex: 1, minWidth: 0, gap: 3 },
  convTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  convName: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '800' },
  convTime: { color: colors.muted, fontSize: 12 },
  convTimeNew: { color: colors.gold, fontWeight: '800' },
  convPreview: { flex: 1, color: colors.muted, fontSize: 14 },
  convPreviewNew: { color: colors.text, fontWeight: '700' },
  unread: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: '#e63946',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  emptyBox: { alignItems: 'center', gap: 10, marginTop: 30, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 40 },
  empty: { color: colors.muted, textAlign: 'center', lineHeight: 20, fontSize: 15 },
  emptyButton: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  emptyButtonText: { color: colors.gold, fontWeight: '800', fontSize: 14 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  chat: { flex: 1, minHeight: 0 },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  back: { paddingRight: 2 },
  backText: { color: colors.text, fontSize: 32, lineHeight: 34, fontWeight: '600' },
  chatName: { color: colors.text, fontSize: 17, fontWeight: '900' },
  chatStatus: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  chatStatusOn: { color: '#3ddc84' },
  inviteButton: { borderRadius: 12, overflow: 'hidden' },
  inviteInner: { paddingHorizontal: 12, paddingVertical: 9 },
  inviteText: { color: colors.onGold, fontWeight: '900', fontSize: 14 },
  picker: {
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  pickerTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pickerChipOn: { borderColor: colors.gold },
  pickerEmoji: { fontSize: 18 },
  pickerText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  messages: { paddingHorizontal: 12, paddingVertical: 10, gap: 6, flexGrow: 1 },
  older: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  olderText: { color: colors.gold, fontWeight: '800', fontSize: 13 },
  day: {
    alignSelf: 'center',
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginVertical: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  row: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowFollow: { marginTop: -3 },
  bubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  bubbleOther: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderBottomLeftRadius: 4,
  },
  bubbleMine: { backgroundColor: colors.gold, borderBottomRightRadius: 4 },
  pending: { opacity: 0.6 },
  body: { color: colors.text, fontSize: 15, lineHeight: 20 },
  bodyMine: { color: colors.onGold },
  time: { color: colors.muted, fontSize: 10, alignSelf: 'flex-end', marginTop: 2 },
  timeMine: { color: colors.onGoldMuted },
  seen: { alignSelf: 'flex-end', color: colors.muted, fontSize: 11, marginTop: 2, marginRight: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 380,
    flexShrink: 1,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,193,7,0.1)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  cardMine: { backgroundColor: 'rgba(255,193,7,0.05)', borderStyle: 'dashed' },
  cardEmoji: { fontSize: 30 },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  cardText: { color: colors.muted, fontSize: 13 },
  cardTime: { color: colors.muted, fontSize: 10, marginTop: 2 },
  cardJoin: { borderRadius: 10, overflow: 'hidden' },
  cardJoinInner: { paddingHorizontal: 12, paddingVertical: 8 },
  cardJoinText: { color: colors.onGold, fontWeight: '900', fontSize: 13 },
  quickBar: { flexGrow: 0, flexShrink: 0 },
  quick: { gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  emoji: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
  },
  emojiText: { fontSize: 20 },
  error: { color: '#ff8a80', textAlign: 'center', fontSize: 13, marginBottom: 4, paddingHorizontal: 12 },
  inputRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    color: colors.text,
    fontSize: 16,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  sendText: { color: colors.onGold, fontSize: 18, fontWeight: '900' },
  counter: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'right',
    paddingRight: 70,
    marginTop: -8,
    marginBottom: 6,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
});
