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
  defaultAvatar,
  ownedKey,
  parisDay,
  questProgress,
  questsFor,
} from '@appli-poker/engine';
import { RewardPreview } from '../components/RewardPreview';
import { TopBar } from '../components/TopBar';
import { buyItem, claimQuest, equipReward, useMyProgress } from '../online/progress';
import { loadAvatar, saveAvatar } from '../online/supabase';
import { sounds } from '../feedback';
import { colors, gradients, shadow } from '../theme';

const KINDS: RewardKind[] = ['frame', 'title', 'avatar', 'cardBack', 'banner'];

/** Coins, the quests of the day and the items they buy. */
export function ShopScreen({ onBack }: { onBack: () => void }) {
  const progress = useMyProgress();
  const { width: screenW } = useWindowDimensions();
  const width = Math.min(screenW, 520);
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
    r.kind === 'avatar' ? avatar.emoji === r.id : progress?.equipped[r.kind as keyof Equipped] === r.id;

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setError((e as Error).message);
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
      saveAvatar({ emoji: next.emoji, color: next.color });
    } else {
      await run(item.id, () => equipReward(item.kind as keyof Equipped, item.id));
    }
    setBuying(null);
  }

  function open(item: Reward) {
    setError(null);
    setBought(false);
    if (has(item)) wear(item);
    else setBuying(item);
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { width }]}>
      <TopBar onBack={onBack} backLabel="← Retour">
        <Text style={styles.topTitle}>Boutique</Text>
      </TopBar>

      <LinearGradient colors={['#4a3200', '#2a1c00']} style={[styles.wallet, shadow]}>
        <Text style={styles.walletLabel}>Mes pièces</Text>
        <Text style={styles.walletCoins}>🪙 {coins}</Text>
        <Text style={styles.walletHow}>
          +{COINS_PLAY} par partie finie, +{COINS_WIN} de plus si tu gagnes, et les quêtes du jour.
        </Text>
      </LinearGradient>

      <Text style={styles.section}>Quêtes du jour</Text>
      <View style={styles.card}>
        {quests.map((q) => {
          const done = questProgress(q, progress?.today ?? {});
          const finished = done >= q.target;
          const claimed = progress?.claimed.includes(q.id) ?? false;
          return (
            <View key={q.id} style={styles.quest}>
              <View style={styles.questBody}>
                <Text style={[styles.questText, claimed && styles.questDone]}>{q.text}</Text>
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
                <Text style={styles.claimed}>✓ Prise</Text>
              ) : finished ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Prendre ${q.coins} pièces`}
                  onPress={() => claim(q.id)}
                  disabled={busy !== null}
                  style={({ pressed }) => [styles.claim, pressed && { opacity: 0.8 }]}
                >
                  <LinearGradient colors={gradients.gold} style={styles.claimInner}>
                    {busy === q.id ? (
                      <ActivityIndicator color={colors.onGold} />
                    ) : (
                      <Text style={styles.claimText}>Prendre +{q.coins} 🪙</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              ) : (
                <Text style={styles.reward}>+{q.coins} 🪙</Text>
              )}
            </View>
          );
        })}
        <Text style={styles.renew}>De nouvelles quêtes chaque jour à minuit.</Text>
      </View>
      {error && !buying && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.section}>Articles</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {KINDS.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityState={{ selected: k === kind }}
            onPress={() => setKind(k)}
            style={[styles.tab, k === kind && styles.tabActive]}
          >
            <Text style={[styles.tabText, k === kind && styles.tabTextActive]}>{REWARD_KIND_NAMES[k]}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.grid}>
        {SHOP_ITEMS.filter((x) => x.kind === kind).map((item) => {
          const mine = has(item);
          const on = mine && worn(item);
          const short = !mine && coins < (item.price ?? 0);
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${mine ? (on ? 'porté' : 'à toi') : `${item.price} pièces`}`}
              onPress={() => open(item)}
              style={({ pressed }) => [styles.tile, on && styles.tileWorn, pressed && { opacity: 0.8 }]}
            >
              <View style={styles.tilePreview}>
                <RewardPreview reward={item} avatar={avatar} />
              </View>
              <Text style={styles.tileName} numberOfLines={1}>
                {item.name}
              </Text>
              {mine ? (
                <Text style={[styles.tileState, on && styles.tileStateOn]}>{on ? '✓ Porté' : 'Porter'}</Text>
              ) : (
                <View style={[styles.price, short && styles.priceShort]}>
                  <Text style={styles.priceText}>🪙 {item.price}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <Modal
        visible={buying !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setBuying(null)}
      >
        <View style={styles.backdrop}>
          {buying && (
            <View style={[styles.modal, shadow]}>
              <Text style={styles.kicker}>{bought ? 'C’est à toi !' : REWARD_KIND_NAMES[buying.kind]}</Text>
              <View style={styles.modalPreview}>
                <RewardPreview reward={buying} avatar={avatar} big />
              </View>
              <Text style={styles.modalName}>{buying.name}</Text>
              {bought ? (
                <>
                  <Button label="Le porter maintenant" onPress={() => wear(buying)} gold />
                  <Button label="Plus tard" onPress={() => setBuying(null)} />
                </>
              ) : (
                <>
                  <Text style={styles.modalPrice}>🪙 {buying.price}</Text>
                  {coins < (buying.price ?? 0) ? (
                    <Text style={styles.modalShort}>
                      Il te manque {(buying.price ?? 0) - coins} pièces. Joue quelques parties ou finis tes
                      quêtes !
                    </Text>
                  ) : (
                    <Button
                      label={busy === buying.id ? '…' : 'Acheter'}
                      onPress={() => buy(buying)}
                      gold
                      disabled={busy !== null}
                    />
                  )}
                  {error && <Text style={styles.error}>{error}</Text>}
                  <Button label="Annuler" onPress={() => setBuying(null)} />
                </>
              )}
            </View>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

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
});
