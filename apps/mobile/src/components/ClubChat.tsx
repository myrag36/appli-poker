// The club's lounge: members' messages, invitations to a table and what happened in the club.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type Avatar, type OnlineGameId, cleanAvatar, defaultAvatar } from '@appli-poker/engine';
import { AvatarBadge } from './AvatarPicker';
import { friendAvatar } from './Messagerie';
import {
  CLUB_MESSAGE_MAX,
  type ClubMember,
  type ClubMessage,
  inviteClubToTable,
  sendClubMessage,
} from '../online/clubs';
import { callGames, loadAvatar, loadName } from '../online/supabase';
import { tMessage } from '../online/messages';
import { ONLINE_UI } from '../online-games';
import { sounds } from '../feedback';
import { lang, t } from '../i18n';
import { colors, gradients } from '../theme';

const QUICK_EMOJIS = ['👋', '🔥', '💪', '😂', '👍', '🎉', '⚔️', '🏆'];

function clock(iso: string) {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const ago = Math.round((start(new Date()) - start(new Date(iso))) / 86_400_000);
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

/** What happened in the club, as a sentence. */
function eventText(body: string, name: string): string {
  const [code, ...rest] = body.split(':');
  const club = rest.join(':');
  switch (code) {
    case 'creation':
      return t('{name} a fondé le club 🎉', { name });
    case 'arrivee':
      return t('{name} a rejoint le club 👋', { name });
    case 'depart':
      return t('{name} a quitté le club', { name });
    case 'exclusion':
      return t('{name} a été exclu du club', { name });
    case 'createur':
      return t('{name} dirige maintenant le club 👑', { name });
    case 'admin':
      return t('{name} devient admin du club ⭐', { name });
    case 'defi_lance':
      return t('{name} a défié « {club} » ⚔️', { name, club });
    case 'defi_recu':
      return t('« {club} » défie le club ! ⚔️', { club });
    case 'defi_accepte':
      return t('Défi lancé contre « {club} » : chaque partie compte ! ⚔️', { club });
    case 'defi_refuse':
      return t('Pas de défi avec « {club} » cette semaine', { club });
  }
  return '';
}

function emojiOnly(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.length > 0 && trimmed.length <= 8 && !/[\p{L}\p{N}]/u.test(trimmed);
}

/** A member's avatar with their frame and level, as in the friends list. */
export function memberAvatar(m: ClubMember, index: number): Avatar {
  return friendAvatar(
    {
      user_id: m.user_id,
      name: m.name,
      avatar: m.avatar,
      avatar_color: m.avatar_color,
      xp: m.xp,
      equipped: m.equipped,
      owned: m.owned,
      week_xp: 0,
      week_wins: 0,
      streak: 0,
      last_week_xp: 0,
      me: m.me,
    },
    index,
  );
}

type Shown = ClubMessage & { pending?: boolean };

export function ClubChat({
  me,
  members,
  messages,
  more,
  height,
  desktop,
  onOlder,
  onSent,
  onJoin,
}: {
  me: string | null;
  members: ClubMember[];
  messages: ClubMessage[] | null;
  more: boolean;
  /** Height of the lounge: it scrolls by itself, the writing box stays below. */
  height: number;
  desktop: boolean;
  onOlder: () => void;
  onSent: (m: ClubMessage) => void;
  onJoin?: (game: string, code: string) => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Shown[]>([]);
  const [picking, setPicking] = useState(false);
  const [inviting, setInviting] = useState<OnlineGameId | null>(null);
  const list = useRef<ScrollView>(null);
  const stick = useRef(true);
  const byId = new Map(members.map((m, i) => [m.user_id, { m, i }]));
  const shown: Shown[] = [...(messages ?? []), ...pending];

  useEffect(() => {
    if (stick.current) setTimeout(() => list.current?.scrollToEnd({ animated: false }), 30);
  }, [shown.length]);

  function who(id: string | null): { name: string; avatar: Avatar } {
    const found = id ? byId.get(id) : undefined;
    if (!found) {
      return { name: t('Ancien membre'), avatar: cleanAvatar(null, defaultAvatar(3)) };
    }
    return { name: found.m.name, avatar: memberAvatar(found.m, found.i) };
  }

  async function send(value: string) {
    const body = value.trim();
    if (!body || !me) return;
    stick.current = true;
    setError(null);
    const temp: Shown = {
      id: Number.MAX_SAFE_INTEGER - Date.now(),
      club_id: '',
      sender_id: me,
      kind: 'text',
      body,
      game: null,
      room_code: null,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setPending((p) => [...p, temp]);
    if (value === text) setText('');
    try {
      onSent(await sendClubMessage(body));
    } catch (e) {
      if (value === text) setText(value);
      setError(tMessage((e as Error).message));
      sounds.invalid();
    } finally {
      setPending((p) => p.filter((m) => m.id !== temp.id));
    }
  }

  /** Opens a table of this game, invites the whole club to it and takes me there. */
  async function invite(game: OnlineGameId) {
    setInviting(game);
    setError(null);
    try {
      const [name, saved] = await Promise.all([loadName(), loadAvatar()]);
      const mine = me ? byId.get(me)?.m.name : undefined;
      const playerName = (name || mine || t('Joueur')).trim().slice(0, 16);
      const look = cleanAvatar(saved ?? defaultAvatar(0), defaultAvatar(0));
      const { code } = await callGames<{ roomId: string; code: string }>({
        type: 'create',
        game,
        name: playerName,
        avatar: look,
        options: ONLINE_UI[game].defaultOptions,
      });
      const { message } = await inviteClubToTable(game, code);
      onSent(message);
      sounds.win();
      setPicking(false);
      onJoin?.(game, code);
    } catch (e) {
      setError(tMessage((e as Error).message));
    } finally {
      setInviting(null);
    }
  }

  return (
    <View style={[styles.chat, { height }]}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.title}>{t('💬 Salon du club')}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {t('Tous les membres lisent ici')}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: picking }}
          onPress={() => {
            setError(null);
            setPicking((p) => !p);
          }}
          style={({ pressed }) => [styles.inviteButton, pressed && styles.pressed]}
        >
          <LinearGradient colors={gradients.gold} style={styles.inviteInner}>
            <Text style={styles.inviteText}>{desktop ? t('🎮 Inviter à une partie') : t('🎮 Inviter')}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {picking && (
        <View style={styles.picker}>
          <Text style={styles.pickerTitle}>{t('Ouvre une table et invite tout le club :')}</Text>
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
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              stick.current = false;
              onOlder();
            }}
            style={styles.older}
          >
            <Text style={styles.olderText}>{t('Messages précédents')}</Text>
          </Pressable>
        )}
        {messages === null && <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} />}
        {messages?.length === 0 && pending.length === 0 && (
          <View style={styles.placeholder}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.empty}>{t('Le salon est calme… Lance la discussion !')}</Text>
          </View>
        )}
        {shown.map((m, i) => {
          const prev = shown[i - 1];
          const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
          const person = who(m.sender_id);
          if (m.kind === 'event') {
            const line = eventText(m.body, person.name);
            if (!line) return null;
            return (
              <View key={m.id}>
                {newDay && <Text style={styles.day}>{dayLabel(m.created_at)}</Text>}
                <Text style={styles.event}>{line}</Text>
              </View>
            );
          }
          const mine = m.sender_id === me;
          const follow = !newDay && prev?.sender_id === m.sender_id && prev?.kind !== 'event';
          return (
            <View key={m.id}>
              {newDay && <Text style={styles.day}>{dayLabel(m.created_at)}</Text>}
              <View style={[styles.row, mine && styles.rowMine, follow && styles.rowFollow]}>
                {!mine && (
                  <View style={styles.avatarSlot}>{!follow && <AvatarBadge avatar={person.avatar} size={30} />}</View>
                )}
                {m.kind === 'invite' && m.game && m.room_code ? (
                  <View style={[styles.card, mine && styles.cardMine]}>
                    <Text style={styles.cardEmoji}>{ONLINE_UI[m.game as OnlineGameId]?.emoji ?? '🃏'}</Text>
                    <View style={styles.flex}>
                      <Text style={styles.cardTitle}>
                        {mine ? t('Tu invites le club à jouer') : t('{name} invite le club à jouer', { name: person.name })}
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
                      emojiOnly(m.body) ? styles.bubbleBare : mine ? styles.bubbleMine : styles.bubbleOther,
                      m.pending && styles.pending,
                    ]}
                  >
                    {!mine && !follow && !emojiOnly(m.body) && (
                      <Text style={styles.sender} numberOfLines={1}>
                        {person.name}
                      </Text>
                    )}
                    <Text
                      style={[styles.body, mine && styles.bodyMine, emojiOnly(m.body) && styles.bodyBig]}
                      selectable
                    >
                      {m.body}
                    </Text>
                    <Text style={[styles.time, mine && !emojiOnly(m.body) && styles.timeMine]}>
                      {m.pending ? '…' : clock(m.created_at)}
                    </Text>
                  </View>
                )}
              </View>
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
          placeholder={t('Écris au club…')}
          placeholderTextColor={colors.muted}
          maxLength={CLUB_MESSAGE_MAX}
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  chat: {
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 12 },
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
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyIcon: { fontSize: 40 },
  empty: { color: colors.muted, textAlign: 'center', lineHeight: 20, fontSize: 15 },
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
  event: {
    alignSelf: 'center',
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12.5,
    fontWeight: '700',
    fontStyle: 'italic',
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  rowMine: { justifyContent: 'flex-end' },
  rowFollow: { marginTop: -3 },
  avatarSlot: { width: 30 },
  bubble: { maxWidth: '78%', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  bubbleOther: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderBottomLeftRadius: 4,
  },
  bubbleMine: { backgroundColor: colors.gold, borderBottomRightRadius: 4 },
  bubbleBare: { paddingHorizontal: 2, paddingVertical: 0 },
  pending: { opacity: 0.6 },
  sender: { color: colors.gold, fontSize: 12, fontWeight: '900', marginBottom: 1 },
  body: { color: colors.text, fontSize: 15, lineHeight: 20 },
  bodyMine: { color: colors.onGold },
  bodyBig: { fontSize: 38, lineHeight: 46 },
  time: { color: colors.muted, fontSize: 10, alignSelf: 'flex-end', marginTop: 2 },
  timeMine: { color: colors.onGoldMuted },
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
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
});
