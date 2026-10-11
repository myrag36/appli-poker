import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
  COINS_PLAY,
  COINS_WIN,
  type Equipped,
  REWARD_KIND_NAMES,
  type Reward,
  type RewardKind,
  SHOP_ITEMS,
  forSale,
  seasonDaysLeft,
  seasonOf,
  defaultAvatar,
  ownedKey,
  parisDay,
  questProgress,
  questsFor,
} from '@appli-poker/engine';
import { ChestRow } from '../components/Chests';
import { RewardPreview } from '../components/RewardPreview';
import { TopBar } from '../components/TopBar';
import { buyItem, claimQuest, equipReward, syncMe, useMyProgress } from '../online/progress';
import { loadAvatar, saveAvatar } from '../online/supabase';
import { sounds } from '../feedback';
import { t, tn } from '../i18n';
import { useDesktop } from '../layout';
import { colors, gradients, shadow } from '../theme';

const KINDS: RewardKind[] = ['frame', 'title', 'avatar', 'emote', 'cardBack', 'chip', 'felt', 'banner'];

/** Coins, the quests of the day and the items they buy. */
export function ShopScreen({ onBack, onCustomize }: { onBack: () => void; onCustomize: () => void }) {
  const progress = useMyProgress();
  const { width: screenW } = useWindowDimensions();
  const desktop = useDesktop();
  // On a computer: coins, chests and quests on the left, the items on the right in a wider grid.
  const width = desktop ? Math.min(screenW - 64, DESK_WIDTH) : Math.min(screenW, 520);
  const rightWidth = width - DESK_LEFT - DESK_GAP;
  const tileColumns = rightWidth >= 640 ? 5 : 4;
  const tileWidth = Math.floor((rightWidth - 10 * (tileColumns - 1)) / tileColumns);
  const [avatar, setAvatar] = useState<Avatar>(defaultAvatar(0));
  const [kind, setKind] = useState<RewardKind>('frame');
  const [buying, setBuying] = useState<Reward | null>(null);
  const [bought, setBought] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAvatar().then((a) => a && setAvatar(a));
  }, []);

  const coins = progress?.coins ?? 0;
  const owned = progress?.owned ?? [];
  const quests = questsFor(parisDay());
  const has = (r: Reward) => owned.includes(ownedKey(r.kind, r.id));
  const worn = (r: Reward) =>
    r.kind === 'emote'
      ? false
      : r.kind === 'avatar'
        ? avatar.emoji === r.id
        : progress?.equipped[r.kind as keyof Equipped] === r.id;

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setError(t((e as Error).message));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function claim(id: string) {
    if (await run(id, () => claimQuest(id))) sounds.win();
  }

  async function buy(item: Reward) {
    if (await run(item.id, () => buyItem(item.kind, item.id))) {
      sounds.win();
      setBought(true);
    }
  }

  async function wear(item: Reward) {
    if (item.kind === 'avatar') {
      const next = { ...avatar, emoji: item.id };
      setAvatar(next);
      saveAvatar({ emoji: next.emoji, color: next.color }).then(syncMe);
    } else {
      await run(item.id, () => equipReward(item.kind as keyof Equipped, item.id));
    }
    setBuying(null);
  }

  function open(item: Reward) {
    setError(null);
    setBought(false);
    if (has(item)) {
      if (item.kind !== 'emote') wear(item);
    } else setBuying(item);
  }

  /** One item; `fixed` gives it the desktop grid's width instead of a third of the row. */
  function tile(item: Reward, fixed?: boolean) {
    const mine = has(item);
    const on = mine && worn(item);
    const short = !mine && coins < (item.price ?? 0);
    return (
      <Pressable
        key={item.id}
        accessibilityRole="button"
        accessibilityLabel={`${t(item.name)}, ${mine ? (on ? t('porté') : t('à toi')) : t('{n} pièces', { n: item.price ?? 0 })}`}
        onPress={() => open(item)}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          styles.tile,
          fixed && desktop && { width: tileWidth, flexGrow: 0 },
          hovered && desktop && styles.tileHover,
          on && styles.tileWorn,
          pressed && { opacity: 0.8 },
        ]}
      >
        <View style={styles.tilePreview}>
          <RewardPreview reward={item} avatar={avatar} />
        </View>
        <Text style={styles.tileName} numberOfLines={1}>
          {t(item.name)}
        </Text>
        {mine ? (
          <Text style={[styles.tileState, on && styles.tileStateOn]}>
            {item.kind === 'emote' ? t('✓ À toi') : on ? t('✓ Porté') : t('Porter')}
          </Text>
        ) : (
          <View style={[styles.price, short && styles.priceShort]}>
            <Text style={styles.priceText}>🪙 {item.price}</Text>
          </View>
        )}
      </Pressable>
    );
  }

  const season = seasonOf();
  const seasonItems = SHOP_ITEMS.filter((x) => forSale(x, season.month) && x.season !== undefined);

  const wallet = (
    <>
      <LinearGradient colors={['#4a3200', '#2a1c00']} style={[styles.wallet, shadow]}>
        <Text style={styles.walletLabel}>{t('Mes pièces')}</Text>
        <Text style={styles.walletCoins}>🪙 {coins}</Text>
        <Text style={styles.walletHow}>
          {t('+{play} par partie finie, +{win} de plus si tu gagnes, et les quêtes du jour.', {
            play: COINS_PLAY,
            win: COINS_WIN,
          })}
        </Text>
      </LinearGradient>

      <ChestRow chests={progress?.chests ?? []} avatar={avatar} />

      <Text style={styles.section}>{t('Quêtes du jour')}</Text>
      <View style={styles.card}>
        {quests.map((q) => {
          const done = questProgress(q, progress?.today ?? {});
          const finished = done >= q.target;
          const claimed = progress?.claimed.includes(q.id) ?? false;
          return (
            <View key={q.id} style={styles.quest}>
              <View style={styles.questBody}>
                <Text style={[styles.questText, claimed && styles.questDone]}>{t(q.text)}</Text>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.fill,
                      { width: `${Math.max(4, (done / q.target) * 100)}%` },
                      finished && styles.fillDone,
                    ]}
                  />
                </View>
                <Text style={styles.questCount}>
                  {done} / {q.target}
                </Text>
              </View>
              {claimed ? (
                <Text style={styles.claimed}>{t('✓ Prise')}</Text>
              ) : finished ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('Prendre {n} pièces', { n: q.coins })}
                  onPress={() => claim(q.id)}
                  disabled={busy !== null}
                  style={({ pressed }) => [styles.claim, pressed && { opacity: 0.8 }]}
                >
                  <LinearGradient colors={gradients.gold} style={styles.claimInner}>
                    {busy === q.id ? (
                      <ActivityIndicator color={colors.onGold} />
                    ) : (
                      <Text style={styles.claimText}>{t('Prendre +{n} 🪙', { n: q.coins })}</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              ) : (
                <Text style={styles.reward}>+{q.coins} 🪙</Text>
              )}
            </View>
          );
        })}
        <Text style={styles.renew}>{t('De nouvelles quêtes chaque jour à minuit.')}</Text>
      </View>
      {error && !buying && <Text style={styles.error}>{error}</Text>}
    </>
  );

  const items = (
    <>
      <LinearGradient
        colors={season.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.season, desktop && styles.seasonDesktop]}
      >
        <View style={styles.seasonHead}>
          <Text style={styles.seasonEmoji}>{season.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.seasonKicker}>{t('Saison du mois')}</Text>
            <Text style={styles.seasonName}>{t(season.name)}</Text>
          </View>
          <View style={styles.seasonLeft}>
            <Text style={styles.seasonLeftText}>{t('Plus que {n} j', { n: seasonDaysLeft() })}</Text>
          </View>
        </View>
        <Text style={styles.seasonText}>{t('Ces articles ne sont en vente que ce mois-ci.')}</Text>
        <View style={styles.grid}>{seasonItems.map((x) => tile(x))}</View>
      </LinearGradient>

      <Text style={styles.section}>{t('Articles')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {KINDS.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityState={{ selected: k === kind }}
            onPress={() => setKind(k)}
            style={[styles.tab, k === kind && styles.tabActive]}
          >
            <Text style={[styles.tabText, k === kind && styles.tabTextActive]}>
              {t(REWARD_KIND_NAMES[k])}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.grid}>
        {SHOP_ITEMS.filter((x) => x.kind === kind && x.season === undefined).map((x) => tile(x, true))}
      </View>
      <Pressable accessibilityRole="button" onPress={onCustomize} hitSlop={8}>
        <Text style={styles.more}>{t('🎨 Essaie-les sur une table : Personnaliser ›')}</Text>
      </Pressable>
    </>
  );

  return (
    <ScrollView contentContainerStyle={[styles.container, desktop && styles.containerDesktop, { width }]}>
      <TopBar onBack={onBack} backLabel={t('← Retour')}>
        <Text style={styles.topTitle}>{t('Boutique')}</Text>
      </TopBar>
      {desktop ? (
        <View style={styles.columns}>
          <View style={{ width: DESK_LEFT }}>{wallet}</View>
          <View style={styles.right}>{items}</View>
        </View>
      ) : (
        <>
          {wallet}
          {items}
        </>
      )}

      <Modal
        visible={buying !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setBuying(null)}
      >
        <View style={styles.backdrop}>
          {buying && (
            <View style={[styles.modal, shadow]}>
              <Text style={styles.kicker}>
                {bought ? t('C’est à toi !') : t(REWARD_KIND_NAMES[buying.kind])}
              </Text>
              <View style={styles.modalPreview}>
                <RewardPreview reward={buying} avatar={avatar} big />
              </View>
              <Text style={styles.modalName}>{t(buying.name)}</Text>
              {bought ? (
                <>
                  <Button label={t('Le porter maintenant')} onPress={() => wear(buying)} gold />
                  <Button label={t('Plus tard')} onPress={() => setBuying(null)} />
                </>
              ) : (
                <>
                  <Text style={styles.modalPrice}>🪙 {buying.price}</Text>
                  {coins < (buying.price ?? 0) ? (
                    <Text style={styles.modalShort}>
                      {tn(
                        (buying.price ?? 0) - coins,
                        'Il te manque {n} pièce. Joue quelques parties ou finis tes quêtes !',
                        'Il te manque {n} pièces. Joue quelques parties ou finis tes quêtes !',
                      )}
                    </Text>
                  ) : (
                    <Button
                      label={busy === buying.id ? '…' : t('Acheter')}
                      onPress={() => buy(buying)}
                      gold
                      disabled={busy !== null}
                    />
                  )}
                  {error && <Text style={styles.error}>{error}</Text>}
                  <Button label={t('Annuler')} onPress={() => setBuying(null)} />
                </>
              )}
            </View>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

/** Desktop page width, its left column and the gap between the columns. */
const DESK_WIDTH = 1120;
const DESK_LEFT = 400;
const DESK_GAP = 32;

function Button({
  label,
  onPress,
  gold,
  disabled,
}: {
  label: string;
  onPress: () => void;
  gold?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
    >
      {gold ? (
        <LinearGradient colors={gradients.gold} style={styles.buttonInner}>
          <Text style={styles.buttonGoldText}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.buttonInner}>
          <Text style={styles.buttonText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'center', padding: 16, paddingTop: 12, paddingBottom: 40 },
  containerDesktop: { paddingHorizontal: 0, paddingTop: 24, paddingBottom: 56 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: DESK_GAP, marginTop: 8 },
  right: { flex: 1, minWidth: 0 },
  seasonDesktop: { marginTop: 8 },
  tileHover: { borderColor: colors.gold, cursor: 'pointer' },
  topTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  wallet: {
    marginTop: 8,
    padding: 18,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  walletLabel: {
    color: '#f5d77a',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  walletCoins: { color: colors.gold, fontSize: 44, fontWeight: '900', marginVertical: 2 },
  walletHow: { color: '#f3e3b5', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  section: { color: colors.text, fontSize: 19, fontWeight: '800', marginTop: 22 },
  card: {
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 14,
  },
  quest: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  questBody: { flex: 1, gap: 5 },
  questText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  questDone: { color: colors.muted, textDecorationLine: 'line-through' },
  questCount: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.4)', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#4ea8de' },
  fillDone: { backgroundColor: colors.gold },
  reward: { color: colors.gold, fontSize: 15, fontWeight: '900', opacity: 0.7 },
  claimed: { color: colors.muted, fontSize: 14, fontWeight: '800' },
  claim: { borderRadius: 12, overflow: 'hidden' },
  claimInner: { paddingVertical: 9, paddingHorizontal: 12, minWidth: 110, alignItems: 'center' },
  claimText: { color: colors.onGold, fontSize: 14, fontWeight: '900' },
  renew: { color: colors.muted, fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
  tabs: { gap: 8, paddingVertical: 10 },
  season: { marginTop: 22, padding: 14, borderRadius: 18, gap: 10, overflow: 'hidden' },
  seasonHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  seasonEmoji: { fontSize: 40 },
  seasonKicker: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  seasonName: { color: '#fff', fontSize: 22, fontWeight: '900' },
  seasonLeft: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  seasonLeftText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  seasonText: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tabActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  tabText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  tabTextActive: { color: colors.onGold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '31%',
    flexGrow: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    gap: 5,
  },
  tileWorn: { borderColor: colors.gold, backgroundColor: 'rgba(255,193,7,0.12)' },
  tilePreview: { height: 64, alignItems: 'center', justifyContent: 'center' },
  tileName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  tileState: { color: colors.text, fontSize: 12, fontWeight: '800' },
  tileStateOn: { color: colors.gold },
  price: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,193,7,0.2)',
  },
  priceShort: { opacity: 0.55 },
  priceText: { color: colors.gold, fontSize: 13, fontWeight: '900' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  modal: {
    width: 310,
    padding: 22,
    borderRadius: 22,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.gold,
    gap: 8,
  },
  kicker: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  modalPreview: { minHeight: 110, alignItems: 'center', justifyContent: 'center', marginVertical: 6 },
  modalName: { color: colors.text, fontSize: 22, fontWeight: '900' },
  modalPrice: { color: colors.gold, fontSize: 24, fontWeight: '900' },
  modalShort: { color: colors.text, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  button: { alignSelf: 'stretch', borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  buttonInner: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  buttonGoldText: { color: colors.onGold, fontSize: 16, fontWeight: '800' },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  error: { color: colors.gold, marginTop: 10, textAlign: 'center' },
  more: { color: colors.gold, fontSize: 14, fontWeight: '800', textAlign: 'center', marginTop: 14 },
});
