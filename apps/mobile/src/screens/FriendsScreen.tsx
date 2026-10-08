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
import {
  ALL_AVATAR_EMOJIS,
  cleanAvatar,
  cleanEquipped,
  cleanOwned,
  defaultAvatar,
  levelFromXp,
  podiumChest,
  weekStart,
} from '@appli-poker/engine';
import { AvatarBadge } from '../components/AvatarPicker';
import { TitleBadge } from '../components/TitleBadge';
import { TopBar } from '../components/TopBar';
import {
  type FriendRow,
  addFriend,
  claimPodium,
  loadFriends,
  removeFriend,
  syncMe,
  useMyProgress,
} from '../online/progress';
import { sounds } from '../feedback';
import { t, tn } from '../i18n';
import { colors, gradients } from '../theme';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Days left before the weekly ranking starts over (Monday, Paris time). */
function daysToMonday(): number {
  const monday = new Date(`${weekStart()}T00:00:00Z`);
  const next = monday.getTime() + 7 * 86_400_000;
  return Math.max(1, Math.ceil((next - Date.now()) / 86_400_000));
}

/** My friend code, my friends, and the ranking of the week between us. */
export function FriendsScreen({ onBack }: { onBack: () => void }) {
  const progress = useMyProgress();
  const { width: screenW } = useWindowDimensions();
  const width = Math.min(screenW, 520);
  const [code, setCode] = useState<string | null>(null);
  const [rows, setRows] = useState<FriendRow[] | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

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

  async function podium() {
    setError(null);
    try {
      await claimPodium();
      sounds.win();
      setMessage(t('Ton coffre t’attend dans la boutique !'));
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

  const me = rows?.find((r) => r.me);
  const chest = me
    ? podiumChest(
        me.user_id,
        (rows ?? []).map((r) => ({ user_id: r.user_id, xp: r.last_week_xp })),
      )
    : null;
  const podiumReady = chest !== null && progress?.podiumClaimed !== weekStart();
  const friends = (rows ?? []).filter((r) => !r.me);

  return (
    <ScrollView contentContainerStyle={[styles.container, { width }]} keyboardShouldPersistTaps="handled">
      <TopBar onBack={onBack} backLabel={t('← Jeux')}>
        <Text style={styles.topTitle}>{t('Amis')}</Text>
      </TopBar>

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

      {podiumReady && (
        <Pressable accessibilityRole="button" onPress={podium} style={styles.podium}>
          <LinearGradient colors={['#6b4b00', '#3a2800']} style={styles.podiumInner}>
            <Text style={styles.podiumIcon}>{chest === 'grand' ? '🏆' : '🎖️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.podiumTitle}>{t('Tu étais sur le podium la semaine dernière !')}</Text>
              <Text style={styles.podiumText}>
                {chest === 'grand'
                  ? t('Touche pour prendre ton grand coffre.')
                  : t('Touche pour prendre ton coffre.')}
              </Text>
            </View>
          </LinearGradient>
        </Pressable>
      )}

      <View style={styles.sectionRow}>
        <Text style={styles.section}>{t('Classement de la semaine')}</Text>
        <Text style={styles.reset}>{tn(daysToMonday(), 'Fin dans {n} jour', 'Fin dans {n} jours')}</Text>
      </View>
      <Text style={styles.hint}>
        {t('L’XP gagnée depuis lundi. Le podium gagne un coffre (le premier un grand coffre).')}
      </Text>

      {rows === null ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: 20 }} />
      ) : (
        <View style={styles.board}>
          {rows.map((r, i) => (
            <Row key={r.user_id} row={r} place={i} onLongPress={() => !r.me && setRemoving(r.user_id)} />
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
    </ScrollView>
  );
}

function Row({ row, place, onLongPress }: { row: FriendRow; place: number; onLongPress: () => void }) {
  const level = levelFromXp(row.xp);
  const equipped = cleanEquipped(row.equipped, level, cleanOwned(row.owned));
  const avatar = cleanAvatar(
    { emoji: row.avatar, color: row.avatar_color },
    defaultAvatar(place),
    ALL_AVATAR_EMOJIS,
  );
  return (
    <Pressable
      onLongPress={onLongPress}
      accessibilityLabel={t('{place}e, {name}, {xp} XP cette semaine', {
        place: place + 1,
        name: row.name,
        xp: row.week_xp,
      })}
      style={[styles.row, row.me && styles.rowMe]}
    >
      <Text style={styles.place}>{MEDALS[place] ?? `${place + 1}`}</Text>
      <AvatarBadge avatar={{ ...avatar, frame: equipped.frame, level }} size={44} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {row.name}
          {row.me ? t(' (moi)') : ''}
          {row.streak > 0 ? <Text style={styles.rowStreak}> 🔥{row.streak}</Text> : null}
        </Text>
        <TitleBadge id={equipped.title} small />
      </View>
      <View style={styles.rowScore}>
        <Text style={styles.rowXp}>{row.week_xp} XP</Text>
        <Text style={styles.rowWins}>{tn(row.week_wins, '{n} victoire', '{n} victoires')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'center', padding: 16, paddingTop: 12, paddingBottom: 40 },
  topTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
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
  podium: { marginTop: 14, borderRadius: 14, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.gold },
  podiumInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  podiumIcon: { fontSize: 36 },
  podiumTitle: { color: colors.gold, fontSize: 15, fontWeight: '900' },
  podiumText: { color: '#f3e3b5', fontSize: 13 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 22,
  },
  section: { color: colors.text, fontSize: 19, fontWeight: '800' },
  reset: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12, marginTop: 4 },
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
  rowMe: { borderColor: colors.gold, backgroundColor: 'rgba(255,193,7,0.1)' },
  place: { color: colors.text, fontSize: 18, fontWeight: '900', width: 28, textAlign: 'center' },
  rowBody: { flex: 1, gap: 3 },
  rowName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  rowStreak: { color: '#ffb36b', fontSize: 13 },
  rowScore: { alignItems: 'flex-end' },
  rowXp: { color: colors.gold, fontSize: 16, fontWeight: '900' },
  rowWins: { color: colors.muted, fontSize: 12 },
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
  tip: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
});
