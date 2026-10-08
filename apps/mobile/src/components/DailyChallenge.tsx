import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { challengeFor, challengeProgress, challengeStreakBonus, parisDay } from '@appli-poker/engine';
import { claimChallenge, useMyProgress } from '../online/progress';
import { sounds } from '../feedback';
import { colors, gradients } from '../theme';
import { t } from '../i18n';

/** The challenge of the day, the same for everyone: progress and the button to take its coins. */
export function DailyChallenge({ width }: { width: number }) {
  const progress = useMyProgress();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const challenge = challengeFor(parisDay());
  const done = progress ? challengeProgress(challenge, progress.today, progress.games) : 0;
  const claimed = progress?.challengeClaimed ?? false;
  const ready = !claimed && done >= challenge.target;
  // The streak goes on if today's challenge is taken: that is the bonus it will pay.
  const streak = progress?.challengeStreak ?? 0;
  const bonus = claimed ? 0 : challengeStreakBonus(streak + 1);
  const ratio = claimed ? 1 : done / challenge.target;

  async function claim() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await claimChallenge();
      sounds.win();
      setMessage(
        r.bonus > 0
          ? t('+{coins} 🪙 dont {bonus} de série !', { coins: challenge.coins + r.bonus, bonus: r.bonus })
          : t('+{coins} 🪙 !', { coins: challenge.coins }),
      );
    } catch (e) {
      setMessage(t((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      style={[styles.wrap, { width }, ready && styles.wrapReady]}
      accessibilityLabel={t('Défi du jour : {text}, {done} sur {target}', {
        text: t(challenge.text),
        done,
        target: challenge.target,
      })}
    >
      <LinearGradient
        colors={['rgba(124,58,237,0.55)', 'rgba(219,39,119,0.35)', 'rgba(255,193,7,0.18)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.icon}>
        <Text style={styles.iconText}>{challenge.emoji}</Text>
        {streak > 0 ? (
          <View style={styles.streakBadge} accessibilityLabel={t('Série de {n} défis', { n: streak })}>
            <Text style={styles.streak}>🔥{streak}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.label} numberOfLines={1}>
          {t('⚡ DÉFI DU JOUR')}
        </Text>
        <Text style={[styles.text, claimed && styles.textDone]} numberOfLines={2}>
          {t(challenge.text)}
        </Text>
        {message ? (
          <Text style={styles.hint} numberOfLines={1}>
            {message}
          </Text>
        ) : challenge.hint && !claimed ? (
          <Text style={styles.hint} numberOfLines={1}>
            {t(challenge.hint)}
          </Text>
        ) : null}
        <View style={styles.barRow}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(3, ratio * 100)}%` }]} />
          </View>
          <Text style={styles.count}>
            {claimed ? challenge.target : done}/{challenge.target}
          </Text>
        </View>
      </View>
      {claimed ? (
        <View style={styles.side}>
          <Text style={styles.claimed}>{t('✓ Réussi')}</Text>
          <Text style={styles.later}>{t('Nouveau défi demain')}</Text>
        </View>
      ) : ready ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Prendre {n} pièces', { n: challenge.coins + bonus })}
          disabled={busy}
          onPress={claim}
          style={({ pressed }) => [styles.claim, pressed && { opacity: 0.8 }]}
        >
          <LinearGradient colors={gradients.gold} style={styles.claimInner}>
            {busy ? (
              <ActivityIndicator color={colors.onGold} />
            ) : (
              <>
                <Text style={styles.claimText}>{t('Prendre')}</Text>
                <Text style={styles.claimCoins}>+{challenge.coins + bonus} 🪙</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      ) : (
        <View style={styles.side}>
          <Text style={styles.reward}>+{challenge.coins} 🪙</Text>
          {bonus > 0 ? <Text style={styles.bonus}>{t('+{n} série', { n: bonus })}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,214,102,0.55)',
    backgroundColor: '#1d1033',
    boxShadow: '0 4px 18px rgba(124,58,237,0.35)',
  },
  wrapReady: { borderColor: '#ffd666', borderWidth: 2, boxShadow: '0 0 18px rgba(255,214,102,0.6)' },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,214,102,0.5)',
  },
  iconText: { fontSize: 22 },
  body: { flex: 1, gap: 3 },
  label: { color: '#ffd666', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  streakBadge: {
    position: 'absolute',
    bottom: -6,
    paddingHorizontal: 5,
    borderRadius: 8,
    backgroundColor: '#3b1d0a',
    borderWidth: 1,
    borderColor: '#ffb36b',
  },
  streak: { color: '#ffb36b', fontSize: 10, fontWeight: '900' },
  text: { color: '#fff', fontSize: 14, fontWeight: '800', lineHeight: 18 },
  textDone: { color: 'rgba(255,255,255,0.6)', textDecorationLine: 'line-through' },
  hint: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.4)', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: '#ffd666' },
  count: { color: '#fff', fontSize: 11, fontWeight: '800', minWidth: 30, textAlign: 'right' },
  side: { alignItems: 'center', minWidth: 64, maxWidth: 104 },
  reward: { color: '#ffd666', fontSize: 16, fontWeight: '900' },
  bonus: { color: '#ffb36b', fontSize: 11, fontWeight: '800', marginTop: 2 },
  claimed: { color: '#7ee2a8', fontSize: 14, fontWeight: '900' },
  later: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  claim: { borderRadius: 12, overflow: 'hidden' },
  claimInner: { paddingVertical: 7, paddingHorizontal: 10, minWidth: 76, alignItems: 'center' },
  claimText: { color: colors.onGold, fontSize: 14, fontWeight: '900' },
  claimCoins: { color: colors.onGold, fontSize: 12, fontWeight: '800' },
});
