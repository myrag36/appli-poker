import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Avatar, ALL_AVATAR_EMOJIS, cleanAvatar, defaultAvatar } from '@appli-poker/engine';
import { AvatarBadge } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { TopBar } from '../components/TopBar';
import { type PlayerStats, loadAvatar, loadStats } from '../online/supabase';
import { colors, shadow } from '../theme';
import { t, tn } from '../i18n';
import { useDesktop } from '../layout';

const MEDALS = ['🥇', '🥈', '🥉'];

function avatarOf(p: PlayerStats, i: number): Avatar {
  return cleanAvatar({ emoji: p.avatar, color: p.avatar_color }, defaultAvatar(i), ALL_AVATAR_EMOJIS);
}

function signed(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

function Tile({
  icon,
  label,
  value,
  detail,
}: {
  icon: string;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <View style={[styles.tile, shadow]}>
      <Text style={styles.tileIcon}>{icon}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      {detail && <Text style={styles.tileDetail}>{detail}</Text>}
    </View>
  );
}

/** My results over every online game, and how I compare with the friends I played with. */
export function StatsScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<PlayerStats[] | null>(null);
  const [myAvatar, setMyAvatar] = useState<Avatar | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    loadStats()
      .then(setStats)
      .catch((e) => setError((e as Error).message));
  }

  useEffect(() => {
    load();
    loadAvatar().then(setMyAvatar);
  }, []);

  const me = stats?.find((p) => p.is_me);
  const friends = stats ?? [];
  const desktop = useDesktop();

  const mine = me && (
    <>
      <View style={styles.me}>
        <AvatarBadge avatar={myAvatar ?? avatarOf(me, 0)} size={64} />
        <Text style={styles.meName}>{me.hands_played > 0 || me.name !== 'Joueur' ? me.name : t('Toi')}</Text>
      </View>

      {me.hands_played === 0 ? (
        <Text style={styles.empty}>
          {t('Joue une partie en ligne avec tes amis : tes résultats et votre classement apparaîtront ici.')}
        </Text>
      ) : (
        <View style={styles.grid}>
          <Tile icon="🃏" label={t('Mains jouées')} value={`${me.hands_played}`} />
          <Tile
            icon="✋"
            label={t('Mains gagnées')}
            value={`${me.hands_won}`}
            detail={`${Math.round((me.hands_won / me.hands_played) * 100)} %`}
          />
          <Tile icon={me.net >= 0 ? '📈' : '📉'} label={t('Gains nets')} value={signed(me.net)} />
          <Tile icon="💰" label={t('Plus gros pot')} value={`${me.best_pot}`} />
          <Tile icon="🎲" label={t('Parties jouées')} value={`${me.games_played}`} />
          <Tile icon="🏆" label={t('Parties gagnées')} value={`${me.games_won}`} />
        </View>
      )}
    </>
  );

  const board = friends.length > 1 && (
    <View style={[styles.board, desktop && styles.boardDesktop]}>
      <Text style={styles.boardTitle}>{t('Classement entre amis')}</Text>
      <Text style={styles.boardHint}>{t('Par gains nets, avec tous ceux contre qui tu as joué.')}</Text>
      {friends.map((p, i) => (
        <View key={p.user_id} style={[styles.row, p.is_me && styles.rowMe]}>
          <Text style={styles.rank}>{MEDALS[i] ?? `${i + 1}.`}</Text>
          <AvatarBadge avatar={p.is_me && myAvatar ? myAvatar : avatarOf(p, i)} size={34} />
          <View style={styles.rowBody}>
            <Text style={styles.rowName} numberOfLines={1}>
              {p.name}
              {p.is_me ? t(' (toi)') : ''}
            </Text>
            <Text style={styles.rowDetail}>
              {tn(p.hands_played, '{n} main', '{n} mains')} ·{' '}
              {tn(p.games_won, '{n} partie gagnée', '{n} parties gagnées')}
            </Text>
          </View>
          <Text style={[styles.net, p.net < 0 && styles.netLoss]}>{signed(p.net)}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        desktop && styles.containerDesktop,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <TopBar onBack={onBack} />
      <Text style={styles.title}>{t('Mes statistiques')}</Text>

      {!stats && !error && <ActivityIndicator color={colors.gold} style={styles.loading} />}
      {error && (
        <View style={[styles.errorBox, desktop && styles.errorDesktop]}>
          <Text style={styles.error}>{error}</Text>
          <Button label={t('Réessayer')} variant="secondary" onPress={load} />
        </View>
      )}

      {desktop ? (
        // On a computer: my numbers on the left, the ranking between friends on the right.
        <View style={styles.columns}>
          <View style={styles.column}>{mine}</View>
          {board ? <View style={styles.column}>{board}</View> : null}
        </View>
      ) : (
        <>
          {mine}
          {board}
        </>
      )}

      {stats && (
        <Text style={styles.note}>
          {t(
            'Seules les parties en ligne comptent. Tes statistiques sont liées à ce téléphone (ou ce navigateur).',
          )}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, maxWidth: 520, width: '100%', alignSelf: 'center' },
  containerDesktop: { maxWidth: 1040, paddingHorizontal: 32 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 32 },
  column: { flex: 1, minWidth: 0 },
  boardDesktop: { marginTop: 16 },
  errorDesktop: { width: 420, alignSelf: 'center' },
  title: { color: colors.gold, fontSize: 30, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  loading: { marginTop: 40 },
  errorBox: { marginTop: 24, gap: 12 },
  error: { color: colors.gold, textAlign: 'center' },
  me: { alignItems: 'center', gap: 6, marginTop: 16 },
  meName: { color: colors.text, fontSize: 20, fontWeight: '800' },
  empty: { color: colors.muted, textAlign: 'center', fontSize: 15, lineHeight: 21, marginTop: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  tile: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tileIcon: { fontSize: 22 },
  tileValue: { color: colors.gold, fontSize: 22, fontWeight: '900', marginTop: 2 },
  tileLabel: { color: colors.muted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  tileDetail: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 2 },
  board: {
    marginTop: 22,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 8,
  },
  boardTitle: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  boardHint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6, borderRadius: 10 },
  rowMe: { backgroundColor: 'rgba(255,255,255,0.07)' },
  rank: { width: 28, textAlign: 'center', color: colors.muted, fontSize: 16, fontWeight: '800' },
  rowBody: { flex: 1 },
  rowName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowDetail: { color: colors.muted, fontSize: 12 },
  net: { color: colors.gold, fontSize: 16, fontWeight: '900' },
  netLoss: { color: colors.danger },
  note: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 18, lineHeight: 17 },
});
