import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ACHIEVEMENTS, type AchievementStats, achievementProgress, streakCoins } from '@appli-poker/engine';
import { type MyProgress, claimAchievement } from '../online/progress';
import { sounds } from '../feedback';
import { colors, gradients } from '../theme';

export function statsOf(p: MyProgress): AchievementStats {
  return {
    games: p.games,
    xp: p.xp,
    bestStreak: p.bestStreak,
    owned: p.owned.length,
    questsDone: p.questsDone,
    feats: p.feats,
  };
}

/** Achievements reached whose coins are not taken yet. */
export function achievementsReady(p: MyProgress | null): number {
  if (!p) return 0;
  const s = statsOf(p);
  return ACHIEVEMENTS.filter(
    (a) => !p.achievements.includes(a.id) && achievementProgress(a.id, s) >= a.target,
  ).length;
}

/** Days in a row: the flame, the record and what tomorrow's first game pays. */
export function StreakCard({ progress }: { progress: MyProgress | null }) {
  const streak = progress?.streak ?? 0;
  const next = streakCoins(streak + 1);
  return (
    <LinearGradient colors={['#5a1e00', '#2b0e00']} style={styles.streak}>
      <Text style={styles.flame}>🔥</Text>
      <View style={styles.streakBody}>
        <Text style={styles.streakDays}>
          {streak} jour{streak > 1 ? 's' : ''} d’affilée
        </Text>
        <Text style={styles.streakText}>
          Record : {progress?.bestStreak ?? 0}. Demain, ta première partie rapporte {next} 🪙
          {(streak + 1) % 7 === 0 ? ' et un grand coffre' : ''}.
        </Text>
      </View>
    </LinearGradient>
  );
}

/** Every achievement with its progress; reached ones pay their coins once. */
export function AchievementList({ progress }: { progress: MyProgress | null }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stats = progress ? statsOf(progress) : null;
  const done = ACHIEVEMENTS.filter((a) => progress?.achievements.includes(a.id)).length;

  async function claim(id: string) {
    setBusy(id);
    setError(null);
    try {
      await claimAchievement(id);
      sounds.win();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  // Ready to take first, then those in progress, then those already taken.
  const order = (id: string, reached: boolean) => (progress?.achievements.includes(id) ? 2 : reached ? 0 : 1);
  const list = ACHIEVEMENTS.map((a) => {
    const value = stats ? achievementProgress(a.id, stats) : 0;
    return { a, value, reached: value >= a.target };
  }).sort((x, y) => order(x.a.id, x.reached) - order(y.a.id, y.reached));

  return (
    <View>
      <Text style={styles.count}>
        {done} / {ACHIEVEMENTS.length} obtenus
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.grid}>
        {list.map(({ a, value, reached }) => {
          const taken = progress?.achievements.includes(a.id) ?? false;
          return (
            <View key={a.id} style={[styles.tile, taken && styles.tileTaken, !reached && styles.tileLocked]}>
              <Text style={[styles.icon, !reached && styles.iconLocked]}>{a.icon}</Text>
              <Text style={styles.name} numberOfLines={1}>
                {a.name}
              </Text>
              <Text style={styles.text} numberOfLines={2}>
                {a.text}
              </Text>
              {taken ? (
                <Text style={styles.taken}>✓ Obtenu</Text>
              ) : reached ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${a.name} : prendre ${a.coins} pièces`}
                  onPress={() => claim(a.id)}
                  disabled={busy !== null}
                  style={styles.claim}
                >
                  <LinearGradient colors={gradients.gold} style={styles.claimInner}>
                    {busy === a.id ? (
                      <ActivityIndicator color={colors.onGold} size="small" />
                    ) : (
                      <Text style={styles.claimText}>+{a.coins} 🪙</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              ) : (
                <>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.max(4, (value / a.target) * 100)}%` }]} />
                  </View>
                  <Text style={styles.value}>
                    {value} / {a.target}
                  </Text>
                </>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  streak: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ff8a3d',
  },
  flame: { fontSize: 38 },
  streakBody: { flex: 1, gap: 2 },
  streakDays: { color: '#ffb36b', fontSize: 20, fontWeight: '900' },
  streakText: { color: '#ffe2c4', fontSize: 13, lineHeight: 18 },
  count: { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 4, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '47%',
    flexGrow: 1,
    alignItems: 'center',
    padding: 10,
    gap: 3,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  tileTaken: { borderColor: colors.glassBorder },
  tileLocked: { borderColor: colors.glassBorder, opacity: 0.75 },
  icon: { fontSize: 30 },
  iconLocked: { opacity: 0.35 },
  name: { color: colors.text, fontSize: 14, fontWeight: '800' },
  text: { color: colors.muted, fontSize: 12, textAlign: 'center', minHeight: 32 },
  taken: { color: colors.gold, fontSize: 12, fontWeight: '800' },
  claim: { borderRadius: 10, overflow: 'hidden', alignSelf: 'stretch' },
  claimInner: { paddingVertical: 6, alignItems: 'center' },
  claimText: { color: colors.onGold, fontSize: 13, fontWeight: '900' },
  track: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.4)',
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: '#4ea8de' },
  value: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  error: { color: colors.gold, textAlign: 'center', marginBottom: 6 },
});
