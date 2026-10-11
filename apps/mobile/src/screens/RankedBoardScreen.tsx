// The leaderboard of the tables classées: one per game and season, the top 100 or my friends,
// with my own position even when I am further down.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  RANKED_GAME_IDS,
  type RankedGameId,
  defaultAvatar,
  rankOf,
  seasonDaysLeft,
  seasonKey,
  seasonOfKey,
} from '@appli-poker/engine';
import { AvatarBadge } from '../components/AvatarPicker';
import { RankBadge, rankLabel, rankLine } from '../components/Ranked';
import { quickGameLook } from '../components/Strangers';
import { type RankedBoard, loadRankedBoard } from '../online/classees';
import { ensureSignedIn } from '../online/supabase';
import { tMessage } from '../online/messages';
import { colors } from '../theme';
import { useDesktop } from '../layout';
import { t, tn } from '../i18n';

interface Props {
  initialGame?: RankedGameId;
  onBack: () => void;
}

type Scope = 'all' | 'friends';

export function RankedBoardScreen({ initialGame, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const [game, setGame] = useState<RankedGameId>(initialGame ?? 'uno');
  const [scope, setScope] = useState<Scope>('all');
  const [board, setBoard] = useState<RankedBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    ensureSignedIn().then(setMe, () => {});
  }, []);

  useEffect(() => {
    let alive = true;
    setBoard(null);
    setError(null);
    loadRankedBoard(game, scope).then(
      (b) => alive && setBoard(b),
      (e) => alive && setError(tMessage((e as Error).message)),
    );
    return () => {
      alive = false;
    };
  }, [game, scope]);

  const season = seasonOfKey(board?.season ?? seasonKey());
  const look = quickGameLook(game);
  const mineShown = board?.lines.some((l) => l.user_id === me);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        desktop && styles.wide,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={10} style={styles.back}>
        <Text style={styles.backText}>{t('← Retour')}</Text>
      </Pressable>
      <Text style={[styles.title, desktop && styles.titleLarge]}>{t('📊 Classement classé')}</Text>
      <Text style={styles.subtitle}>
        {t('Saison {name}', { name: `${season.emoji} ${t(season.name)}` })} ·{' '}
        {t('Plus que {n} j', { n: seasonDaysLeft() })}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.games}>
        {RANKED_GAME_IDS.map((g) => {
          const l = quickGameLook(g);
          const active = g === game;
          return (
            <Pressable
              key={g}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setGame(g)}
              style={[styles.game, active && styles.gameActive]}
            >
              <Text style={[styles.gameText, active && styles.gameTextActive]} numberOfLines={1}>
                {l.emoji} {l.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.scopes}>
        {(['all', 'friends'] as Scope[]).map((s) => (
          <Pressable
            key={s}
            accessibilityRole="tab"
            accessibilityState={{ selected: scope === s }}
            onPress={() => setScope(s)}
            style={[styles.scope, scope === s && styles.scopeActive]}
          >
            <Text style={[styles.scopeText, scope === s && styles.scopeTextActive]}>
              {s === 'all' ? t('🌍 Top 100') : t('👥 Mes amis')}
            </Text>
          </Pressable>
        ))}
      </View>

      {board?.me && (
        <View style={styles.mine}>
          <RankBadge
            points={board.me.points}
            placement={board.me.placement}
            legend={board.me.legend}
            size={52}
          />
          <View style={styles.flex}>
            <Text style={styles.mineKicker}>{t('Ma place en {game}', { game: look.title })}</Text>
            <Text style={styles.mineRank}>{rankLine({ ...board.me })}</Text>
            <Text style={styles.mineSub}>
              {board.me.position
                ? t('{n}e du classement', { n: board.me.position })
                : t('Termine tes parties de placement pour apparaître.')}{' '}
              · {tn(board.me.games, '{n} partie', '{n} parties')}
            </Text>
          </View>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {!board && !error && <ActivityIndicator color={colors.gold} style={styles.loading} />}
      {board && board.lines.length === 0 && (
        <Text style={styles.empty}>
          {scope === 'friends'
            ? t('Aucun ami classé en {game} cette saison.', { game: look.title })
            : t('Personne n’est encore classé en {game} cette saison : à toi de jouer !', {
                game: look.title,
              })}
        </Text>
      )}
      {board && board.lines.length > 0 && (
        <View style={styles.list}>
          {board.lines.map((l) => {
            const rank = rankOf(l.points, l.legend);
            const isMe = l.user_id === me;
            return (
              <View key={l.user_id} style={[styles.line, isMe && styles.lineMe]}>
                <Text
                  style={[styles.position, l.position <= 3 && styles.podium]}
                  accessibilityLabel={t('{n}e', { n: l.position })}
                >
                  {l.position === 1 ? '🥇' : l.position === 2 ? '🥈' : l.position === 3 ? '🥉' : l.position}
                </Text>
                <AvatarBadge
                  avatar={{
                    emoji: l.avatar ?? defaultAvatar(0).emoji,
                    color: l.avatar_color ?? defaultAvatar(0).color,
                  }}
                  size={34}
                />
                <View style={styles.flex}>
                  <Text style={styles.name} numberOfLines={1}>
                    {l.name}
                    {isMe ? t(' (toi)') : ''}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {rankLabel(rank)} · {rank.rp} RP · {tn(l.wins, '{n} victoire', '{n} victoires')}
                  </Text>
                </View>
                <RankBadge points={l.points} legend={l.legend} size={36} />
              </View>
            );
          })}
          {board.me && board.me.position && !mineShown && (
            <Text style={styles.more}>{t('… et toi, {n}e.', { n: board.me.position })}</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16 },
  wide: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 32 },
  back: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  title: { color: colors.gold, fontSize: 28, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  titleLarge: { fontSize: 36 },
  subtitle: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 4 },
  games: { gap: 6, paddingVertical: 12 },
  game: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  gameActive: { borderColor: colors.gold, backgroundColor: 'rgba(255, 193, 7, 0.16)' },
  gameText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  gameTextActive: { color: colors.gold, fontWeight: '800' },
  scopes: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 12 },
  scope: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  scopeActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  scopeText: { color: colors.text, fontWeight: '700' },
  scopeTextActive: { color: colors.onGold, fontWeight: '900' },
  mine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: colors.gold,
    marginBottom: 12,
  },
  mineKicker: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  mineRank: { color: colors.gold, fontSize: 18, fontWeight: '900' },
  mineSub: { color: colors.text, fontSize: 13 },
  flex: { flex: 1, minWidth: 0 },
  error: { color: colors.gold, textAlign: 'center', marginTop: 16 },
  loading: { marginTop: 30 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 24, fontSize: 14, lineHeight: 20 },
  list: { gap: 6 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  lineMe: { borderColor: colors.gold, backgroundColor: 'rgba(255, 193, 7, 0.12)' },
  position: { width: 32, color: colors.muted, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  podium: { fontSize: 22 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12 },
  more: { color: colors.muted, textAlign: 'center', marginTop: 8 },
});
