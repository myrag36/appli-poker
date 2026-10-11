// Pieces of the tables classées: the rank emblem of each tier, a rank's name, the lock shown below
// level 10, the RP bar after a ranked game (with the promotion), and the season rewards.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  DIVISION_NUMERALS,
  PLACEMENT_GAMES,
  RANKED_LEVEL,
  RANK_TIERS,
  type Rank,
  type RankTierId,
  type SeasonReward,
  divisionProgress,
  findReward,
  levelProgress,
  rankOf,
  rankTier,
  rpLabel,
  seasonOfKey,
  xpForLevel,
} from '@appli-poker/engine';
import { type RankedChange, useRankedChange } from '../online/classees';
import { reducedMotion } from './Motion';
import { sounds } from '../feedback';
import { colors, gradients, shadow } from '../theme';
import { t } from '../i18n';

const native = Platform.OS !== 'web';

/** "Or II", "Maître" or "Légende", in the app's language. */
export function rankLabel(rank: Rank): string {
  const name = t(rankTier(rank.tier).name);
  return rank.division ? `${name} ${DIVISION_NUMERALS[rank.division]}` : name;
}

/** "Or II · 40 RP", "Maître · 230 RP", or "Placement 2/5". */
export function rankLine(r: { points: number; placement: number; legend?: boolean }): string {
  if (r.placement > 0) {
    return t('Placement {n}/{total}', { n: PLACEMENT_GAMES - r.placement, total: PLACEMENT_GAMES });
  }
  const rank = rankOf(r.points, r.legend);
  return `${rankLabel(rank)} · ${rank.rp} RP`;
}

/** A rank stored as "or-2" or "maitre" (the promotions the server saved). */
export function parseRankCode(code: string | null): Rank | null {
  if (!code) return null;
  const [tier, div] = code.split('-');
  if (!RANK_TIERS.some((x) => x.id === tier)) return null;
  const division = div ? (Number(div) as 1 | 2 | 3) : null;
  return { tier: tier as RankTierId, division, rp: 0 };
}

/**
 * The emblem of a rank: a gem in the tier's colors with its symbol, and the division in Roman
 * numerals on a ribbon. Grey with a "?" while placing.
 */
export function RankBadge({
  points,
  placement = 0,
  legend = false,
  size = 44,
  tier: forcedTier,
}: {
  points?: number;
  placement?: number;
  legend?: boolean;
  size?: number;
  /** Draws a tier without a division (the tier list, the rewards). */
  tier?: RankTierId;
}) {
  const placing = placement > 0 && !forcedTier;
  const rank: Rank = forcedTier ? { tier: forcedTier, division: null, rp: 0 } : rankOf(points ?? 0, legend);
  const tier = rankTier(rank.tier);
  const gem = size * 0.66;
  const fill = placing ? (['#d8d8d8', '#8a8a8a', '#4a4a4a'] as const) : tier.colors;
  const high = !placing && ['diamant', 'maitre', 'legende'].includes(rank.tier);
  const label = placing ? t('En placement') : rankLabel(rank);
  return (
    <View
      style={{ width: size, height: size * 1.12, alignItems: 'center' }}
      accessibilityLabel={label}
      accessible
    >
      {!placing && (rank.tier === 'maitre' || rank.tier === 'legende') && (
        <>
          <Text style={[styles.wing, { fontSize: size * 0.3, left: -size * 0.04, top: size * 0.26 }]}>
            🌿
          </Text>
          <Text
            style={[
              styles.wing,
              { fontSize: size * 0.3, right: -size * 0.04, top: size * 0.26, transform: [{ scaleX: -1 }] },
            ]}
          >
            🌿
          </Text>
        </>
      )}
      <View
        style={[
          styles.gem,
          {
            width: gem,
            height: gem,
            top: size * 0.17,
            borderRadius: gem * 0.2,
            borderWidth: Math.max(1.5, size * 0.045),
            borderColor: placing ? '#bdbdbd' : tier.rim,
            boxShadow: high
              ? `0 0 ${Math.round(size * 0.3)}px ${tier.colors[1]}`
              : `0 ${Math.round(size * 0.05)}px ${Math.round(size * 0.12)}px rgba(0,0,0,0.45)`,
          },
        ]}
      >
        <LinearGradient
          colors={fill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={[styles.glyphBox, { top: 0, height: size }]}>
        <Text style={{ fontSize: size * 0.34, lineHeight: size * 0.62, textAlign: 'center' }}>
          {placing ? '❔' : tier.glyph}
        </Text>
      </View>
      {rank.tier === 'legende' && !placing && (
        <Text style={[styles.crown, { fontSize: size * 0.3, top: -size * 0.14 }]}>👑</Text>
      )}
      {(rank.division || placing) && (
        <View
          style={[
            styles.ribbon,
            {
              bottom: 0,
              minWidth: size * 0.5,
              paddingHorizontal: size * 0.08,
              borderRadius: size * 0.12,
              backgroundColor: placing ? '#9e9e9e' : tier.rim,
            },
          ]}
        >
          <Text style={[styles.ribbonText, { fontSize: Math.max(8, size * 0.21) }]}>
            {placing
              ? `${PLACEMENT_GAMES - placement}/${PLACEMENT_GAMES}`
              : DIVISION_NUMERALS[rank.division!]}
          </Text>
        </View>
      )}
    </View>
  );
}

/** A small emblem and the rank's name, for lists and tables. */
export function RankChip({
  points,
  placement = 0,
  legend = false,
  showRp = false,
}: {
  points: number;
  placement?: number;
  legend?: boolean;
  showRp?: boolean;
}) {
  const rank = rankOf(points, legend);
  return (
    <View style={styles.chip}>
      <RankBadge points={points} placement={placement} legend={legend} size={24} />
      <Text style={styles.chipText} numberOfLines={1}>
        {placement > 0
          ? t('Placement {n}/{total}', { n: PLACEMENT_GAMES - placement, total: PLACEMENT_GAMES })
          : showRp
            ? `${rankLabel(rank)} · ${rank.rp} RP`
            : rankLabel(rank)}
      </Text>
    </View>
  );
}

/** The short tag shown after a name at a ranked table: "🥇 Or II". */
export function rankTag(r: { points: number; placement: number; legend?: boolean } | undefined): string {
  if (!r || r.placement > 0) return '';
  const rank = rankOf(r.points, r.legend);
  const tier = rankTier(rank.tier);
  return `${tier.glyph}${rank.division ? DIVISION_NUMERALS[rank.division] : ''}`;
}

// ---------------------------------------------------------------------------
// Locked below level 10

/**
 * "Niveau 10 requis": what ranked tables are, the way to level 10, and the tiers to win.
 */
export function RankedLock({ xp }: { xp: number }) {
  const { level } = levelProgress(xp);
  const ratio = Math.min(1, xp / xpForLevel(RANKED_LEVEL));
  const missing = Math.max(0, xpForLevel(RANKED_LEVEL) - xp);
  return (
    <View style={styles.lock}>
      <Text style={styles.lockIcon}>🔒</Text>
      <Text style={styles.lockTitle}>{t('Niveau {n} requis', { n: RANKED_LEVEL })}</Text>
      <Text style={styles.lockText}>
        {t(
          'Les tables classées s’ouvrent au niveau {n} : des parties contre des joueurs de ton rang, des rangs à gagner dans chaque jeu et des récompenses à chaque fin de saison.',
          { n: RANKED_LEVEL },
        )}
      </Text>
      <View style={styles.lockTrack}>
        <LinearGradient
          colors={gradients.gold}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.lockFill, { width: `${Math.max(4, ratio * 100)}%` }]}
        />
      </View>
      <Text style={styles.lockProgress}>{t('Niveau {level} · encore {xp} XP', { level, xp: missing })}</Text>
      <View style={styles.tiers}>
        {RANK_TIERS.map((tier) => (
          <View key={tier.id} style={styles.tierItem}>
            <RankBadge tier={tier.id} size={34} />
            <Text style={styles.tierName} numberOfLines={1}>
              {t(tier.name)}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.lockGets}>
        {t(
          'À gagner : des pièces, des coffres, des titres de saison, des bordures et des dos de cartes exclusifs.',
        )}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// After a ranked game

/**
 * The RP bar once a ranked game ends: it fills (or empties) to the new rank, and a promotion
 * gets its own little show ("Promu Or II !").
 */
export function RankedResult({ roomId, active = true }: { roomId: string; active?: boolean }) {
  const change = useRankedChange(roomId, active);
  if (!change) {
    return active ? (
      <View style={[styles.result, styles.resultWaiting]}>
        <Text style={styles.resultWait}>{t('🏆 Calcul de ton rang…')}</Text>
      </View>
    ) : null;
  }
  return <RankedChangeView change={change} />;
}

export function RankedChangeView({ change }: { change: RankedChange }) {
  const promoted = parseRankCode(change.promoted);
  const demoted = parseRankCode(change.demoted);
  const placing = change.placement > 0;
  const after = rankOf(change.points_after);
  // The bar: within the division before, then within the new one after a change of division.
  const changed = promoted || demoted;
  const from = changed ? (promoted ? 0 : 1) : divisionProgress(change.points_before);
  const to = divisionProgress(change.points_after);
  const bar = useRef(new Animated.Value(placing ? 0 : from)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const [shownDelta, setShownDelta] = useState(0);

  useEffect(() => {
    const still = reducedMotion();
    if (promoted || change.placed) sounds.win();
    else if (change.delta < 0) sounds.lose();
    if (still) {
      bar.setValue(to);
      pop.setValue(1);
      setShownDelta(change.delta);
      return;
    }
    Animated.timing(bar, {
      toValue: placing ? 0 : to,
      duration: 1100,
      delay: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    Animated.spring(pop, {
      toValue: 1,
      friction: 4,
      tension: 70,
      delay: 900,
      useNativeDriver: native,
    }).start();
    // The number counts up to the change.
    const steps = 18;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setShownDelta(Math.round((change.delta * i) / steps));
      if (i >= steps) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const up = change.delta >= 0;
  const headline = change.forfeit
    ? t('Abandon : compté comme une défaite')
    : promoted
      ? t('Promu {rank} !', { rank: rankLabel(promoted) })
      : demoted
        ? t('Rétrogradé {rank}', { rank: rankLabel(demoted) })
        : change.placed
          ? t('Classé {rank} !', { rank: rankLabel(after) })
          : placing
            ? t('Placement {n}/{total}', {
                n: PLACEMENT_GAMES - change.placement,
                total: PLACEMENT_GAMES,
              })
            : rankLabel(after);
  return (
    <View style={[styles.result, promoted && styles.resultPromoted]}>
      <View style={styles.resultRow}>
        <Animated.View
          style={{
            transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          }}
        >
          <RankBadge points={change.points_after} placement={change.placement} size={promoted ? 58 : 46} />
        </Animated.View>
        <View style={styles.resultBody}>
          <Text style={[styles.resultTitle, promoted && styles.resultTitlePromoted]} numberOfLines={2}>
            {promoted ? '🎉 ' : ''}
            {headline}
          </Text>
          {!placing && (
            <View style={styles.rpTrack}>
              <Animated.View
                style={[
                  styles.rpFill,
                  {
                    width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    backgroundColor: up ? colors.gold : '#e76f51',
                  },
                ]}
              />
            </View>
          )}
          {placing && (
            <View style={styles.dots}>
              {Array.from({ length: PLACEMENT_GAMES }, (_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i < PLACEMENT_GAMES - change.placement && styles.dotDone]}
                />
              ))}
            </View>
          )}
          <Text style={styles.resultSub} numberOfLines={2}>
            {placing
              ? t('Ton rang s’affiche après {n} parties de placement.', { n: PLACEMENT_GAMES })
              : change.saved === 'shield'
                ? t('🛡️ Bouclier de promotion : pas de rétrogradation cette fois.')
                : change.saved === 'floor'
                  ? t('Tu restes en {rank} : la prochaine défaite à 0 RP te fera descendre.', {
                      rank: rankLabel(after),
                    })
                  : `${rankLabel(after)} · ${after.rp} RP`}
          </Text>
        </View>
        <Text style={[styles.delta, up ? styles.deltaUp : styles.deltaDown]}>{rpLabel(shownDelta)}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// End of season

/** The rewards of the seasons that just ended, shown once when they were given. */
export function SeasonRewardsModal({ rewards, onClose }: { rewards: SeasonReward[]; onClose: () => void }) {
  return (
    <Modal visible={rewards.length > 0} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modal, shadow]}>
          <Text style={styles.modalParty}>🏆</Text>
          <Text style={styles.modalKicker}>{t('Fin de saison classée')}</Text>
          {rewards.map((r) => {
            const season = seasonOfKey(r.season);
            const title = findReward('title', r.items[0]?.split(':')[1]);
            return (
              <View key={r.season} style={styles.modalSeason}>
                <RankBadge tier={r.tier} size={64} />
                <Text style={styles.modalTitle}>
                  {t('Saison {name}', { name: `${season.emoji} ${t(season.name)}` })}
                </Text>
                <Text style={styles.modalText}>
                  {t('Meilleur rang : {rank}', { rank: t(rankTier(r.tier).name) })}
                </Text>
                <Text style={styles.modalGift}>
                  🪙 +{r.coins}
                  {r.chest ? ` · 🎁 ${t(r.chest === 'grand' ? 'Grand coffre' : 'Coffre')}` : ''}
                </Text>
                {title && (
                  <Text style={styles.modalGift}>{t('Titre « {name} »', { name: t(title.name) })}</Text>
                )}
                {r.items.some((i) => i.startsWith('frame:')) && (
                  <Text style={styles.modalGift}>{t('+ une bordure exclusive')}</Text>
                )}
                {r.items.some((i) => i.startsWith('cardBack:')) && (
                  <Text style={styles.modalGift}>{t('+ un dos de cartes exclusif')}</Text>
                )}
              </View>
            );
          })}
          <Text style={styles.modalHint}>
            {t('Nouvelle saison : tu repars un palier plus bas. Bonne chance !')}
          </Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalOk}>
            <LinearGradient colors={gradients.gold} style={styles.modalOkInner}>
              <Text style={styles.modalOkText}>{t('Super !')}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gem: { position: 'absolute', overflow: 'hidden', transform: [{ rotate: '45deg' }] },
  glyphBox: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  wing: { position: 'absolute' },
  crown: { position: 'absolute', alignSelf: 'center' },
  ribbon: {
    position: 'absolute',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.35)',
  },
  ribbonText: { color: '#2a1a05', fontWeight: '900', letterSpacing: 0.5 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  lock: {
    alignItems: 'center',
    gap: 8,
    padding: 18,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  lockIcon: { fontSize: 36 },
  lockTitle: { color: colors.gold, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  lockText: { color: colors.text, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 440 },
  lockTrack: {
    alignSelf: 'stretch',
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginTop: 4,
  },
  lockFill: { height: '100%', borderRadius: 6 },
  lockProgress: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  tiers: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 6 },
  tierItem: { alignItems: 'center', width: 52, gap: 2 },
  tierName: { color: colors.muted, fontSize: 10.5, fontWeight: '700' },
  lockGets: { color: colors.muted, fontSize: 12.5, lineHeight: 18, textAlign: 'center', maxWidth: 420 },
  result: {
    alignSelf: 'stretch',
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  resultWaiting: { alignItems: 'center' },
  resultWait: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  resultPromoted: { borderColor: colors.gold, boxShadow: '0 0 18px rgba(255, 200, 60, 0.55)' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultBody: { flex: 1, minWidth: 0, gap: 4 },
  resultTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  resultTitlePromoted: { color: colors.gold, fontSize: 17 },
  resultSub: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  rpTrack: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  rpFill: { height: '100%', borderRadius: 5 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 14, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)' },
  dotDone: { backgroundColor: colors.gold },
  delta: { fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  deltaUp: { color: '#7ee081' },
  deltaDown: { color: '#ff8a7a' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: 6,
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  modalParty: { fontSize: 44 },
  modalKicker: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  modalSeason: { alignItems: 'center', gap: 4, marginVertical: 6 },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  modalText: { color: colors.text, fontSize: 14 },
  modalGift: { color: colors.gold, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  modalHint: { color: colors.muted, fontSize: 12.5, textAlign: 'center', marginTop: 4 },
  modalOk: { alignSelf: 'stretch', marginTop: 10, borderRadius: 12, overflow: 'hidden' },
  modalOkInner: { paddingVertical: 12, alignItems: 'center' },
  modalOkText: { color: colors.onGold, fontWeight: '900', fontSize: 16 },
});
