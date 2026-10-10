import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cleanEquipped, cleanOwned, levelFromXp } from '@appli-poker/engine';
import { MessagesPanel, PresenceAvatar, friendAvatar } from '../components/Messagerie';
import { TitleBadge } from '../components/TitleBadge';
import { TopBar } from '../components/TopBar';
import { ClassementPanel } from './ClassementPanel';
import { type FriendRow, addFriend, loadFriends, removeFriend, syncMe } from '../online/progress';
import { type TableInvite, dismissInvite, loadInvites } from '../online/invites';
import { useOnline, useUnreadCount } from '../online/messagerie';
import { ONLINE_UI } from '../online-games';
import type { OnlineGameId } from '@appli-poker/engine';
import { sounds } from '../feedback';
import { t } from '../i18n';
import { useDesktop } from '../layout';
import { colors, gradients } from '../theme';

/**
 * My friend code, invitations and friends; the weekly ranking between us (and its podium
 * chest) is in the second tab.
 */
export function FriendsScreen({
  onBack,
  onJoin,
  initialTab = 'amis',
  initialFriend,
}: {
  onBack: () => void;
  /** Opens straight on the weekly ranking of online games, or on my messages. */
  initialTab?: Tab;
  /** Opens this friend's conversation (from a notification). */
  initialFriend?: string;
  /** Goes to a friend's table from an invitation. */
  onJoin?: (game: string, code: string) => void;
}) {
  const { width: screenW } = useWindowDimensions();
  const desktop = useDesktop();
  // On a computer: my code and invitations on the left, my friends on the right.
  const width = desktop ? Math.min(screenW - 64, DESK_WIDTH) : Math.min(screenW, 520);
  const [code, setCode] = useState<string | null>(null);
  const [rows, setRows] = useState<FriendRow[] | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [invites, setInvites] = useState<TableInvite[]>([]);
  const [tab, setTab] = useState<Tab>(initialFriend ? 'messages' : initialTab);
  const unread = useUnreadCount();
  const online = useOnline();

  async function reload() {
    try {
      setRows(await loadFriends());
    } catch (e) {
      setError(t((e as Error).message));
    }
  }

  useEffect(() => {
    syncMe().then(setCode);
    reload();
    loadInvites().then(setInvites);
  }, []);

  async function add() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await addFriend(typed);
      setTyped('');
      setMessage(t('Ami ajouté !'));
      sounds.win();
      await reload();
    } catch (e) {
      setError(t((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await removeFriend(id);
      setRemoving(null);
      await reload();
    } catch (e) {
      setError(t((e as Error).message));
    }
  }

  function share() {
    if (!code) return;
    Share.share({ message: t('Ajoute-moi dans La Tablée avec mon code ami : {code}', { code }) }).catch(
      () => {},
    );
  }

  // Friends by name: who is ahead this week is the ranking tab's business.
  const friends = (rows ?? []).filter((r) => !r.me).sort((a, b) => a.name.localeCompare(b.name));

  const mine = (
    <>
      <LinearGradient colors={['#1d3b6b', '#0f2140']} style={styles.codeCard}>
        <Text style={styles.codeLabel}>{t('Mon code ami')}</Text>
        {code ? (
          <Text selectable style={styles.code}>
            {code}
          </Text>
        ) : (
          <ActivityIndicator color={colors.gold} style={{ marginVertical: 10 }} />
        )}
        <Pressable accessibilityRole="button" onPress={share} disabled={!code} style={styles.shareButton}>
          <Text style={styles.shareText}>{t('📤 Envoyer mon code')}</Text>
        </Pressable>
      </LinearGradient>

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={typed}
          onChangeText={(text) => setTyped(text.toUpperCase())}
          placeholder={t('Code de ton ami')}
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          maxLength={8}
          onSubmitEditing={add}
        />
        <Pressable
          accessibilityRole="button"
          onPress={add}
          disabled={busy || typed.trim().length < 6}
          style={[styles.addButton, (busy || typed.trim().length < 6) && styles.disabled]}
        >
          <LinearGradient colors={gradients.gold} style={styles.addInner}>
            {busy ? (
              <ActivityIndicator color={colors.onGold} />
            ) : (
              <Text style={styles.addText}>{t('Ajouter')}</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
      {message && <Text style={styles.message}>{message}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      {invites.length > 0 && (
        <View style={styles.invites}>
          <Text style={styles.section}>{t('Invitations')}</Text>
          {invites.map((inv) => (
            <View key={inv.id} style={styles.invite}>
              <Text style={styles.inviteIcon}>{ONLINE_UI[inv.game as OnlineGameId]?.emoji ?? '🃏'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.inviteTitle} numberOfLines={1}>
                  {t('{name} t’invite à sa table', { name: inv.from_name })}
                </Text>
                <Text style={styles.inviteText}>
                  {t('{game} · code {code}', {
                    game: t(ONLINE_UI[inv.game as OnlineGameId]?.title ?? 'Poker'),
                    code: inv.room_code,
                  })}
                </Text>
              </View>
              {onJoin && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    dismissInvite(inv.id);
                    onJoin(inv.game, inv.room_code);
                  }}
                  style={styles.inviteJoin}
                >
                  <LinearGradient colors={gradients.gold} style={styles.inviteJoinInner}>
                    <Text style={styles.inviteJoinText}>{t('Rejoindre')}</Text>
                  </LinearGradient>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Ignorer l’invitation')}
                hitSlop={8}
                onPress={() => {
                  dismissInvite(inv.id);
                  setInvites((list) => list.filter((x) => x.id !== inv.id));
                }}
              >
                <Text style={styles.inviteClose}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </>
  );

  const ranking = (
    <>
      <View style={[styles.sectionRow, desktop && styles.sectionRowDesktop]}>
        <Text style={styles.section}>
          {rows === null ? t('Mes amis') : t('Mes amis ({n})', { n: friends.length })}
        </Text>
      </View>
      <Pressable accessibilityRole="button" onPress={() => setTab('classement')} style={styles.toRanking}>
        <Text style={styles.toRankingIcon}>🏆</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.toRankingTitle}>{t('Classement de la semaine')}</Text>
          <Text style={styles.toRankingText}>{t('Vos parties en ligne, et un coffre pour le podium.')}</Text>
        </View>
        <Text style={styles.toRankingArrow}>›</Text>
      </Pressable>

      {rows === null ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: 20 }} />
      ) : (
        <View style={styles.board}>
          {friends.map((r, i) => (
            <Row
              key={r.user_id}
              row={r}
              index={i + 1}
              online={online.has(r.user_id)}
              onLongPress={() => setRemoving(r.user_id)}
            />
          ))}
          {friends.length === 0 && (
            <Text style={styles.empty}>
              {t('Ajoute tes amis avec leur code pour vous affronter chaque semaine !')}
            </Text>
          )}
        </View>
      )}

      {removing && (
        <View style={styles.confirm}>
          <Text style={styles.confirmText}>
            {t('Retirer {name} de tes amis ?', {
              name: rows?.find((r) => r.user_id === removing)?.name ?? '',
            })}
          </Text>
          <View style={styles.confirmRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRemoving(null)}
              style={styles.confirmButton}
            >
              <Text style={styles.confirmCancel}>{t('Annuler')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => remove(removing)}
              style={styles.confirmButton}
            >
              <Text style={styles.confirmOk}>{t('Retirer')}</Text>
            </Pressable>
          </View>
        </View>
      )}
      {friends.length > 0 && <Text style={styles.tip}>{t('Appui long sur un ami pour le retirer.')}</Text>}
    </>
  );

  const header = (
    <>
      <TopBar onBack={onBack} backLabel={t('← Jeux')}>
        <Text style={styles.topTitle}>{t('Amis')}</Text>
      </TopBar>
      <View style={[styles.tabs, desktop && styles.tabsDesktop]} accessibilityRole="tablist">
        {TABS.map((id) => (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === id }}
            onPress={() => setTab(id)}
            style={[styles.tab, tab === id && styles.tabOn]}
          >
            <Text
              style={[styles.tabText, !desktop && styles.tabTextPhone, tab === id && styles.tabTextOn]}
              numberOfLines={1}
            >
              {id === 'amis'
                ? desktop
                  ? t('👥 Mes amis')
                  : t('👥 Amis')
                : id === 'messages'
                  ? // On a phone the unread badge needs the room of the emoji.
                    desktop || unread === 0
                    ? t('💬 Messages')
                    : t('Messages')
                  : t('🏆 Classement')}
            </Text>
            {id === 'messages' && unread > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>
    </>
  );

  // Messages fill the screen: the conversation scrolls by itself, the writing box stays below.
  if (tab === 'messages') {
    return (
      <View
        style={[
          styles.container,
          desktop && styles.containerDesktop,
          styles.messagesPage,
          { width, paddingBottom: desktop ? 32 : 0 },
        ]}
      >
        {header}
        <MessagesPanel
          friends={rows}
          desktop={desktop}
          initialFriend={initialFriend}
          onJoin={onJoin}
          onAddFriends={() => setTab('amis')}
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, desktop && styles.containerDesktop, { width }]}
      keyboardShouldPersistTaps="handled"
    >
      {header}
      {tab === 'classement' ? (
        <ClassementPanel desktop={desktop} />
      ) : desktop ? (
        <View style={styles.columns}>
          <View style={{ width: DESK_LEFT }}>{mine}</View>
          <View style={styles.right}>{ranking}</View>
        </View>
      ) : (
        <>
          {mine}
          {ranking}
        </>
      )}
    </ScrollView>
  );
}

type Tab = 'amis' | 'messages' | 'classement';
const TABS: Tab[] = ['amis', 'messages', 'classement'];

/** Desktop page width and its left column. */
const DESK_WIDTH = 1040;
const DESK_LEFT = 400;

/** A friend: avatar, name, title, level and days in a row; a long press offers to remove them. */
function Row({
  row,
  index,
  online,
  onLongPress,
}: {
  row: FriendRow;
  index: number;
  online: boolean;
  onLongPress: () => void;
}) {
  const level = levelFromXp(row.xp);
  const equipped = cleanEquipped(row.equipped, level, cleanOwned(row.owned));
  return (
    <Pressable
      onLongPress={onLongPress}
      accessibilityLabel={t('{name}, niveau {level}', { name: row.name, level })}
      style={styles.row}
    >
      <PresenceAvatar avatar={friendAvatar(row, index)} size={44} online={online} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {row.name}
          {online ? <Text style={styles.rowOnline}>{t(' · en ligne')}</Text> : null}
          {row.streak > 0 ? <Text style={styles.rowStreak}> 🔥{row.streak}</Text> : null}
        </Text>
        <TitleBadge id={equipped.title} small />
      </View>
      <View style={styles.rowScore}>
        <Text style={styles.rowLevel}>{t('Niv. {n}', { n: level })}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'center', padding: 16, paddingTop: 12, paddingBottom: 40 },
  containerDesktop: { paddingHorizontal: 0, paddingTop: 24, paddingBottom: 56 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 32, marginTop: 8 },
  right: { flex: 1, minWidth: 0 },
  sectionRowDesktop: { marginTop: 4 },
  topTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  tabs: {
    flexDirection: 'row',
    marginTop: 8,
    padding: 4,
    gap: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tabsDesktop: { alignSelf: 'flex-start', minWidth: 560 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#e63946',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  messagesPage: { flex: 1, minHeight: 0 },
  rowOnline: { color: '#3ddc84', fontSize: 12, fontWeight: '700' },
  tabOn: { backgroundColor: colors.gold },
  tabText: { color: colors.muted, fontSize: 14, fontWeight: '800' },
  tabTextPhone: { fontSize: 13 },
  tabTextOn: { color: colors.onGold, fontWeight: '900' },
  codeCard: {
    marginTop: 8,
    padding: 18,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4ea8de',
  },
  codeLabel: {
    color: '#a9d2ff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  code: { color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: 6, marginVertical: 4 },
  shareButton: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  shareText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  input: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 3,
  },
  addButton: { borderRadius: 12, overflow: 'hidden' },
  addInner: { flex: 1, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  addText: { color: colors.onGold, fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  message: { color: colors.gold, textAlign: 'center', marginTop: 10, fontWeight: '800' },
  error: { color: '#ff8a80', textAlign: 'center', marginTop: 10 },
  toRanking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(142,125,190,0.18)',
    borderWidth: 1,
    borderColor: '#8e7dbe',
  },
  toRankingIcon: { fontSize: 28 },
  toRankingTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  toRankingText: { color: '#cfc5ff', fontSize: 12.5, marginTop: 2 },
  toRankingArrow: { color: '#cfc5ff', fontSize: 26, fontWeight: '700' },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 22,
  },
  section: { color: colors.text, fontSize: 19, fontWeight: '800' },
  board: { marginTop: 10, gap: 8 },
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
  rowBody: { flex: 1, gap: 3 },
  rowName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  rowStreak: { color: '#ffb36b', fontSize: 13 },
  rowScore: { alignItems: 'flex-end' },
  rowLevel: { color: colors.gold, fontSize: 14, fontWeight: '900' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  confirm: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 10,
  },
  confirmText: { color: colors.text, fontSize: 15, textAlign: 'center' },
  confirmRow: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  confirmButton: { paddingHorizontal: 12, paddingVertical: 6 },
  confirmCancel: { color: colors.muted, fontSize: 15, fontWeight: '800' },
  confirmOk: { color: '#ff8a80', fontSize: 15, fontWeight: '900' },
  invites: { marginTop: 8, gap: 8 },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,193,7,0.1)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  inviteIcon: { fontSize: 28 },
  inviteTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  inviteText: { color: colors.muted, fontSize: 13 },
  inviteJoin: { borderRadius: 10, overflow: 'hidden' },
  inviteJoinInner: { paddingHorizontal: 12, paddingVertical: 8 },
  inviteJoinText: { color: colors.onGold, fontWeight: '900', fontSize: 14 },
  inviteClose: { color: colors.muted, fontSize: 16, fontWeight: '800', paddingHorizontal: 4 },
  tip: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
});
