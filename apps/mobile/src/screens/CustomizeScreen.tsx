import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  type Avatar,
  CUSTOM_KINDS,
  DEFAULT_EQUIPPED,
  type Equipped,
  RARITIES,
  RARITY_NAMES,
  REWARDS,
  REWARD_KIND_ONE,
  type Rarity,
  type Reward,
  type RewardKind,
  conditionProgress,
  defaultAvatar,
  forSale,
  isUnlocked,
  monthOf,
  rarityOf,
  unlockStats,
  unlockText,
} from '@appli-poker/engine';
import { AvatarBadge } from '../components/AvatarPicker';
import { CardBackFace } from '../components/cardBacks';
import { ChipFace } from '../components/chipStyles';
import { FeltFill, FeltPreview } from '../components/felts';
import { RewardPreview } from '../components/RewardPreview';
import { TopBar } from '../components/TopBar';
import { type MyProgress, buyItem, equipReward, useMyProgress } from '../online/progress';
import { loadAvatar } from '../online/supabase';
import { sounds } from '../feedback';
import { t, tn } from '../i18n';
import { useDesktop } from '../layout';
import { colors, gradients } from '../theme';

type Slot = 'cardBack' | 'chip' | 'felt' | 'frame';

/** Border and label color of each rarity. */
export const RARITY_COLORS: Record<Rarity, string> = {
  commun: '#9aa5b1',
  rare: '#4ea8de',
  epique: '#b06cff',
  legendaire: '#ffb02e',
};

/** Short tab labels (the empty {_} keeps them apart from other texts with the same French words). */
const KIND_TAB: Record<Slot, string> = {
  cardBack: t('Dos{_}', { _: '' }),
  chip: t('Jetons'),
  felt: t('Tapis{_}', { _: '' }),
  frame: t('Bordures'),
};

/** Catalog of a kind, from the most common to the most precious. */
function catalog(kind: RewardKind): Reward[] {
  const order = (r: Reward) => RARITIES.indexOf(rarityOf(r));
  return REWARDS.filter((r) => r.kind === kind && !(kind === 'frame' && r.id === 'none')).sort(
    (a, b) => order(a) - order(b) || (a.price ?? a.level * 30) - (b.price ?? b.level * 30),
  );
}

/** How to get an item, in the app's language. */
function howTo(reward: Reward): string {
  const { text, vars } = unlockText(reward);
  return t(text, typeof vars.name === 'string' ? { ...vars, name: t(vars.name) } : vars);
}

function statsOf(p: MyProgress | null) {
  return unlockStats({
    xp: p?.xp ?? 0,
    games: p?.games ?? {},
    best_streak: p?.bestStreak ?? 0,
    owned: p?.owned ?? [],
    quests_done: p?.questsDone ?? 0,
    feats: p?.feats ?? [],
    challenges_done: p?.challengesDone ?? 0,
  });
}

/**
 * A small table dressed with what is chosen: the felt, three cards face down, a few chips,
 * and my avatar in its frame.
 */
export function MiniTable({
  width,
  look,
  avatar,
}: {
  width: number;
  look: Pick<Equipped, Slot>;
  avatar: Avatar;
}) {
  const h = Math.round(width * 0.6);
  const card = Math.round(width * 0.13);
  const chip = Math.max(18, Math.round(width * 0.075));
  return (
    <View style={{ width, height: h + 26 }}>
      <View style={[styles.rail, { width, height: h, borderRadius: h / 2 }]}>
        <LinearGradient colors={gradients.wood} style={StyleSheet.absoluteFill} />
        <View style={[styles.felt, { borderRadius: h / 2 }]}>
          <FeltFill id={look.felt} />
          <View style={[styles.feltShade, { borderRadius: h / 2 }]} />
          <View style={[styles.feltLine, { borderRadius: h / 2 }]} />
        </View>
      </View>
      {/* Three cards face down, fanned a little, on the left of the middle. */}
      <View style={[styles.cards, { left: width * 0.2, top: h * 0.3 }]}>
        {[-12, 0, 12].map((a, i) => (
          <View
            key={a}
            style={{
              position: 'absolute',
              left: i * card * 0.55,
              transform: [{ rotate: `${a}deg` }, { translateY: Math.abs(a) * 0.3 }],
            }}
          >
            <CardBackFace
              id={look.cardBack}
              width={card}
              height={Math.round(card * 1.4)}
              radius={card * 0.1}
            />
          </View>
        ))}
      </View>
      {/* Two piles of chips on the right. */}
      {[0, 1].map((pile) => (
        <View
          key={pile}
          style={{
            position: 'absolute',
            left: width * (0.6 + pile * 0.1),
            top: h * (0.36 + pile * 0.06),
            width: chip,
            height: chip + 4 * 4,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ position: 'absolute', bottom: i * 4 }}>
              <ChipFace
                style={look.chip}
                index={pile === 0 ? [2, 2, 3, 4][i] : [0, 1, 1, 3][i]}
                size={chip}
              />
            </View>
          ))}
        </View>
      ))}
      <View style={[styles.seat, { left: width / 2 - 34, top: h - 46 }]}>
        <AvatarBadge avatar={{ ...avatar, frame: look.frame }} size={68} />
      </View>
    </View>
  );
}

/** Card backs, chips, felts and frames: try them on a small table, wear them, see how to get the others. */
export function CustomizeScreen({ onBack, onShop }: { onBack: () => void; onShop: () => void }) {
  const progress = useMyProgress();
  const desktop = useDesktop();
  const { width: screenW } = useWindowDimensions();
  const width = desktop ? Math.min(screenW - 64, DESK_WIDTH) : Math.min(screenW, 560);
  const leftWidth = desktop ? DESK_LEFT : width - 32;
  const rightWidth = width - DESK_LEFT - DESK_GAP;
  const columns = desktop ? (rightWidth >= 620 ? 5 : 4) : 3;
  const tileWidth = Math.floor(((desktop ? rightWidth : width - 32) - 10 * (columns - 1)) / columns);
  const [avatar, setAvatar] = useState<Avatar>(defaultAvatar(0));
  const [kind, setKind] = useState<Slot>('cardBack');
  const [picked, setPicked] = useState<Reward | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadAvatar().then((a) => a && setAvatar(a));
  }, []);

  const level = progress?.level ?? 1;
  const owned = progress?.owned ?? [];
  const coins = progress?.coins ?? 0;
  const equipped = progress?.equipped ?? DEFAULT_EQUIPPED;
  const stats = statsOf(progress);
  const month = monthOf();
  const items = catalog(kind);
  const has = (r: Reward) => isUnlocked(r.kind, r.id, level, owned);
  const worn = (r: Reward) => equipped[r.kind as Slot] === r.id;
  const current = picked && picked.kind === kind ? picked : (items.find(worn) ?? items[0]);
  const look = { ...pick(equipped), [kind]: current.id } as Pick<Equipped, Slot>;

  function choose(kindNext: Slot) {
    setKind(kindNext);
    setPicked(null);
    setConfirm(false);
    setMessage(null);
  }

  function select(r: Reward) {
    setPicked(r);
    setConfirm(false);
    setMessage(null);
  }

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(done);
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  async function wear(r: Reward) {
    if (await run(() => equipReward(r.kind as Slot, r.id), t('C’est équipé partout !'))) sounds.chips();
  }

  async function buy(r: Reward) {
    if (await run(() => buyItem(r.kind, r.id), t('C’est à toi !'))) {
      sounds.win();
      await equipReward(r.kind as Slot, r.id).catch(() => undefined);
    }
  }

  const rarity = rarityOf(current);
  const mine = has(current);
  const on = worn(current);
  const forSaleNow = current.price !== undefined && forSale(current, month);
  const short = (current.price ?? 0) - coins;
  const goal = current.unlock ? conditionProgress(current.unlock, stats) : null;

  let action;
  if (mine) {
    action = on ? (
      <View style={[styles.action, styles.actionDone]}>
        <Text style={styles.actionDoneText}>{t('✓ Équipé')}</Text>
      </View>
    ) : (
      <ActionButton label={t('Équiper')} onPress={() => wear(current)} busy={busy} />
    );
  } else if (forSaleNow) {
    action =
      short > 0 ? (
        <View style={styles.lockBox}>
          <Text style={styles.lockText}>🪙 {current.price}</Text>
          <Text style={styles.lockHint}>
            {tn(short, 'Il te manque {n} pièce.', 'Il te manque {n} pièces.')}{' '}
            <Text style={styles.link} onPress={onShop}>
              {t('Gagner des pièces ›')}
            </Text>
          </Text>
        </View>
      ) : (
        <ActionButton
          label={
            confirm
              ? t('Confirmer : {n} pièces', { n: current.price ?? 0 })
              : t('Acheter 🪙 {n}', { n: current.price ?? 0 })
          }
          onPress={() => (confirm ? buy(current) : setConfirm(true))}
          busy={busy}
        />
      );
  } else {
    action = (
      <View style={styles.lockBox}>
        <Text style={styles.lockText}>🔒 {howTo(current)}</Text>
        {current.season !== undefined && current.price !== undefined && (
          <Text style={styles.lockHint}>{t('Revient en boutique pendant sa saison.')}</Text>
        )}
        {goal && (
          <>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(4, (goal.done / goal.target) * 100)}%` }]} />
            </View>
            <Text style={styles.lockHint}>
              {goal.done} / {goal.target}
            </Text>
          </>
        )}
        {!goal && current.price === undefined && (
          <Text style={styles.lockHint}>{t('Tu es niveau {n}.', { n: level })}</Text>
        )}
      </View>
    );
  }

  const preview = (
    <View style={[styles.previewCard, desktop && styles.previewCardDesktop]}>
      <View style={{ alignItems: 'center' }}>
        <MiniTable width={Math.min(leftWidth - 24, 420)} look={look} avatar={avatar} />
      </View>
      <View style={styles.pickedHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pickedKind}>{t(REWARD_KIND_ONE[current.kind])}</Text>
          <Text style={styles.pickedName} numberOfLines={1}>
            {t(current.name)}
          </Text>
        </View>
        <RarityPill rarity={rarity} />
      </View>
      {action}
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );

  const unlockedCount = (k: Slot) => catalog(k).filter(has).length;

  const tabs = (
    <View style={styles.tabs}>
      {CUSTOM_KINDS.map((k) => {
        const slot = k as Slot;
        const active = slot === kind;
        return (
          <Pressable
            key={k}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => choose(slot)}
            style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && { opacity: 0.8 }]}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
              {KIND_TAB[slot]}
            </Text>
            <Text style={[styles.tabCount, active && styles.tabTextActive]}>
              {unlockedCount(slot)}/{catalog(k).length}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const grid = (
    <View style={styles.grid}>
      {items.map((r) => {
        const unlocked = has(r);
        const selected = r.kind === current.kind && r.id === current.id;
        const color = RARITY_COLORS[rarityOf(r)];
        const legendary = rarityOf(r) === 'legendaire';
        const buyable = !unlocked && r.price !== undefined && forSale(r, month);
        return (
          <Pressable
            key={r.id}
            accessibilityRole="button"
            accessibilityLabel={`${t(r.name)}, ${t(RARITY_NAMES[rarityOf(r)])}, ${
              unlocked ? (worn(r) ? t('équipé') : t('débloqué')) : howTo(r)
            }`}
            accessibilityState={{ selected }}
            onPress={() => select(r)}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
              styles.tile,
              { width: tileWidth, borderColor: selected ? colors.text : color },
              legendary && { boxShadow: `0 0 14px ${color}66` },
              hovered && desktop && styles.tileHover,
              pressed && { opacity: 0.85 },
            ]}
          >
            <LinearGradient
              colors={[`${color}55`, `${color}00`]}
              style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
            />
            <View style={[styles.tilePreview, !unlocked && styles.tileLocked]}>
              {r.kind === 'felt' ? (
                <FeltPreview id={r.id} width={Math.min(84, tileWidth - 20)} height={52} />
              ) : (
                <RewardPreview reward={r} avatar={avatar} />
              )}
            </View>
            {!unlocked && <Text style={styles.lockBadge}>{buyable ? '🛒' : '🔒'}</Text>}
            <Text style={styles.tileName} numberOfLines={1}>
              {t(r.name)}
            </Text>
            <Text style={[styles.tileRarity, { color }]}>{t(RARITY_NAMES[rarityOf(r)])}</Text>
            <Text style={[styles.tileState, worn(r) && styles.tileStateOn]} numberOfLines={1}>
              {unlocked ? (worn(r) ? t('✓ Équipé') : t('Débloqué')) : buyable ? `🪙 ${r.price}` : shortHow(r)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={[styles.container, desktop && styles.containerDesktop, { width }]}>
      <TopBar onBack={onBack} backLabel={t('← Retour')}>
        <Text style={styles.topTitle}>{t('Personnaliser')}</Text>
        <Pressable accessibilityRole="button" onPress={onShop} style={styles.coins}>
          <Text style={styles.coinsText}>🪙 {coins}</Text>
        </Pressable>
      </TopBar>
      {!progress && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.gold} />
        </View>
      )}
      {desktop ? (
        <View style={styles.columns}>
          <View style={{ width: DESK_LEFT }}>{preview}</View>
          <View style={styles.right}>
            {tabs}
            {grid}
            <Legend />
          </View>
        </View>
      ) : (
        <>
          {preview}
          {tabs}
          {grid}
          <Legend />
        </>
      )}
    </ScrollView>
  );
}

/** The four slots of Equipped this screen deals with. */
function pick(e: Equipped): Pick<Equipped, Slot> {
  return { cardBack: e.cardBack, chip: e.chip, felt: e.felt, frame: e.frame };
}

/** A few words under a locked tile. */
function shortHow(r: Reward): string {
  if (r.unlock)
    return 'challenges' in r.unlock ? t('🎯 {n} défis', { n: r.unlock.challenges }) : t('🏅 Succès');
  if (r.season !== undefined) return t('📅 Saison');
  return t('🔒 Niveau {n}', { n: r.level });
}

function RarityPill({ rarity }: { rarity: Rarity }) {
  const color = RARITY_COLORS[rarity];
  return (
    <View style={[styles.rarityPill, { borderColor: color, backgroundColor: `${color}26` }]}>
      <Text style={[styles.rarityText, { color }]}>{t(RARITY_NAMES[rarity])}</Text>
    </View>
  );
}

/** What the colors mean, and the ways to get items. */
function Legend() {
  return (
    <View style={styles.legend}>
      <View style={styles.legendRow}>
        {RARITIES.map((r) => (
          <RarityPill key={r} rarity={r} />
        ))}
      </View>
      <Text style={styles.legendText}>
        {t(
          'Monte de niveau, réussis des succès et des défis du jour, ou achète en boutique : ce que tu gagnes en jouant arrive tout seul dans ta collection.',
        )}
      </Text>
      <Text style={styles.legendText}>
        {t(
          'Ce que tu équipes s’affiche sur toutes les tables ; ta bordure est visible par les autres joueurs.',
        )}
      </Text>
    </View>
  );
}

function ActionButton({ label, onPress, busy }: { label: string; onPress: () => void; busy: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}
    >
      <LinearGradient colors={gradients.gold} style={styles.actionInner}>
        {busy ? <ActivityIndicator color={colors.onGold} /> : <Text style={styles.actionText}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

const DESK_WIDTH = 1160;
const DESK_LEFT = 440;
const DESK_GAP = 32;

const styles = StyleSheet.create({
  container: { alignSelf: 'center', padding: 16, paddingTop: 12, paddingBottom: 40 },
  containerDesktop: { paddingHorizontal: 0, paddingTop: 24, paddingBottom: 56 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: DESK_GAP, marginTop: 8 },
  right: { flex: 1, minWidth: 0 },
  topTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  coins: {
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,193,7,0.18)',
  },
  coinsText: { color: colors.gold, fontWeight: '900', fontSize: 14 },
  loading: { padding: 10, alignItems: 'center' },
  previewCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 10,
  },
  previewCardDesktop: { padding: 14 },
  rail: {
    overflow: 'hidden',
    padding: 8,
    borderWidth: 2,
    borderColor: colors.railBorder,
    boxShadow: '0 8px 22px rgba(0,0,0,0.55)',
  },
  felt: { flex: 1, overflow: 'hidden', borderWidth: 2, borderColor: colors.feltBorder },
  feltShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    boxShadow: 'inset 0 0 36px 4px rgba(0,0,0,0.45)',
  },
  feltLine: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    left: 10,
    right: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 213, 120, 0.22)',
  },
  cards: { position: 'absolute' },
  seat: { position: 'absolute' },
  pickedHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  pickedKind: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  pickedName: { color: colors.text, fontSize: 22, fontWeight: '900' },
  rarityPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  rarityText: { fontSize: 12, fontWeight: '900' },
  action: { borderRadius: 14, overflow: 'hidden' },
  actionInner: { paddingVertical: 12, alignItems: 'center', borderRadius: 14 },
  actionText: { color: colors.onGold, fontSize: 16, fontWeight: '900' },
  actionDone: {
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: 'rgba(255,193,7,0.12)',
  },
  actionDoneText: { color: colors.gold, fontSize: 16, fontWeight: '900' },
  lockBox: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 6,
    alignItems: 'center',
  },
  lockText: { color: colors.text, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  lockHint: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  link: { color: colors.gold, fontWeight: '800' },
  track: {
    alignSelf: 'stretch',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.gold },
  message: { color: colors.gold, textAlign: 'center', fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 6, marginTop: 16, marginBottom: 10 },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tabActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  tabText: { color: colors.text, fontWeight: '800', fontSize: 13 },
  tabTextActive: { color: colors.onGold },
  tabCount: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    // Nearly opaque: the room's decor must not show through the names.
    backgroundColor: `${colors.background}f0`,
    borderWidth: 2,
    gap: 2,
    overflow: 'hidden',
  },
  tileHover: { transform: [{ translateY: -2 }], cursor: 'pointer' },
  tilePreview: { height: 78, alignItems: 'center', justifyContent: 'center' },
  tileLocked: { opacity: 0.45 },
  lockBadge: { position: 'absolute', top: 6, right: 8, fontSize: 14 },
  tileName: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 4 },
  tileRarity: { fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  tileState: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  tileStateOn: { color: colors.gold },
  legend: { marginTop: 18, gap: 8, alignItems: 'center' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  legendText: { color: colors.muted, fontSize: 12, textAlign: 'center', lineHeight: 17 },
});
