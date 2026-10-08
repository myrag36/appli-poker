import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  type Avatar,
  CHEST_NAMES,
  CHEST_REASONS,
  type Chest,
  REWARD_KIND_NAMES,
  type RewardKind,
  findReward,
} from '@appli-poker/engine';
import { RewardPreview } from './RewardPreview';
import { openChest } from '../online/progress';
import { sounds } from '../feedback';
import { colors, gradients, shadow } from '../theme';

/** A treasure chest drawn with shapes; the big one is gold and glows. */
export function ChestArt({ grand, size = 64, open }: { grand?: boolean; size?: number; open?: boolean }) {
  const w = size;
  const body = grand
    ? (['#ffe27a', '#d99a00', '#8a5a00'] as const)
    : (['#b5733a', '#8a4f22', '#5a3112'] as const);
  const band = grand ? '#fff6c8' : '#e9b949';
  return (
    <View style={{ width: w, height: w * 0.86 }}>
      {grand && <View style={[styles.glow, { width: w * 1.1, height: w * 0.9, borderRadius: w }]} />}
      {/* Lid */}
      <View
        style={[
          styles.lid,
          {
            top: open ? -w * 0.22 : 0,
            width: w,
            height: w * 0.36,
            borderTopLeftRadius: w * 0.3,
            borderTopRightRadius: w * 0.3,
            transform: [{ rotate: open ? '-14deg' : '0deg' }],
          },
        ]}
      >
        <LinearGradient colors={body} style={StyleSheet.absoluteFill} />
        <View style={[styles.bandV, { left: w * 0.16, width: w * 0.1, backgroundColor: band }]} />
        <View style={[styles.bandV, { right: w * 0.16, width: w * 0.1, backgroundColor: band }]} />
      </View>
      {open && (
        <View style={[styles.light, { top: w * 0.18, left: w * 0.1, width: w * 0.8, height: w * 0.2 }]} />
      )}
      {/* Body */}
      <View
        style={[
          styles.chestBody,
          {
            top: w * 0.36,
            width: w,
            height: w * 0.5,
            borderBottomLeftRadius: w * 0.08,
            borderBottomRightRadius: w * 0.08,
          },
        ]}
      >
        <LinearGradient colors={body} style={StyleSheet.absoluteFill} />
        <View style={[styles.bandV, { left: w * 0.16, width: w * 0.1, backgroundColor: band }]} />
        <View style={[styles.bandV, { right: w * 0.16, width: w * 0.1, backgroundColor: band }]} />
        <View style={[styles.bandH, { height: w * 0.06, backgroundColor: band }]} />
        <View
          style={[
            styles.lock,
            {
              left: w / 2 - w * 0.09,
              width: w * 0.18,
              height: w * 0.2,
              borderRadius: w * 0.04,
              borderColor: band,
            },
          ]}
        />
      </View>
    </View>
  );
}

/** My chests waiting to be opened, as a row of tiles; tapping one opens it. */
export function ChestRow({ chests, avatar }: { chests: Chest[]; avatar: Avatar }) {
  const [opening, setOpening] = useState<Chest | null>(null);
  if (chests.length === 0 && !opening) return null;
  return (
    <>
      <Text style={styles.section}>Mes coffres</Text>
      <View style={styles.row}>
        {chests.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={`Ouvrir : ${CHEST_NAMES[c.kind]}`}
            onPress={() => setOpening(c)}
            style={({ pressed }) => [
              styles.tile,
              c.kind === 'grand' && styles.tileGrand,
              pressed && { opacity: 0.8 },
            ]}
          >
            <ChestArt grand={c.kind === 'grand'} size={58} />
            <Text style={styles.tileName}>{CHEST_NAMES[c.kind]}</Text>
            <Text style={styles.tileReason} numberOfLines={1}>
              {CHEST_REASONS[c.reason] ?? ''}
            </Text>
            <Text style={styles.tileOpen}>Ouvrir</Text>
          </Pressable>
        ))}
      </View>
      {opening && <ChestOpening chest={opening} avatar={avatar} onClose={() => setOpening(null)} />}
    </>
  );
}

/** The opening: the chest shakes, bursts open and shows what it held. */
function ChestOpening({ chest, avatar, onClose }: { chest: Chest; avatar: Avatar; onClose: () => void }) {
  const shake = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const [got, setGot] = useState<{ coins: number; item: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const wobble = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 80, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 160, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 80, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    wobble.start();
    const started = Date.now();
    openChest(chest.id)
      .then(async (r) => {
        // Let the suspense last a moment.
        await new Promise((res) => setTimeout(res, Math.max(0, 1100 - (Date.now() - started))));
        wobble.stop();
        shake.setValue(0);
        setGot(r);
        sounds.win();
        Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start();
      })
      .catch((e) => {
        wobble.stop();
        setError((e as Error).message);
      });
    return () => wobble.stop();
  }, [chest.id]);

  const [kind, id] = got?.item ? (got.item.split(/:(.*)/s) as [RewardKind, string]) : [null, null];
  const reward = kind ? findReward(kind, id) : undefined;
  const rotate = shake.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modal, shadow]}>
          <Text style={styles.kicker}>{CHEST_NAMES[chest.kind]}</Text>
          <Animated.View style={{ transform: [{ rotate }], marginVertical: 14 }}>
            <ChestArt grand={chest.kind === 'grand'} size={120} open={got !== null} />
          </Animated.View>
          {got ? (
            <Animated.View style={[styles.loot, { opacity: pop, transform: [{ scale: pop }] }]}>
              <Text style={styles.lootCoins}>+{got.coins} 🪙</Text>
              {reward && (
                <View style={styles.lootItem}>
                  <RewardPreview reward={reward} avatar={avatar} big />
                  <Text style={styles.lootName}>
                    {REWARD_KIND_NAMES[reward.kind].replace(/s$/, '')} : {reward.name}
                  </Text>
                  <Text style={styles.lootHint}>Il t’attend dans ton profil !</Text>
                </View>
              )}
            </Animated.View>
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <Text style={styles.wait}>Ouverture…</Text>
          )}
          {(got || error) && (
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.ok}>
              <LinearGradient colors={gradients.gold} style={styles.okInner}>
                <Text style={styles.okText}>Super !</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    alignSelf: 'center',
    top: '-5%',
    backgroundColor: 'rgba(255, 210, 80, 0.25)',
    boxShadow: '0 0 24px 8px rgba(255, 210, 80, 0.45)',
  },
  lid: {
    position: 'absolute',
    left: 0,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.35)',
  },
  chestBody: {
    position: 'absolute',
    left: 0,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.35)',
  },
  bandV: { position: 'absolute', top: 0, bottom: 0 },
  bandH: { position: 'absolute', left: 0, right: 0, top: 0 },
  lock: { position: 'absolute', top: '22%', backgroundColor: '#3a2208', borderWidth: 2 },
  light: {
    position: 'absolute',
    borderRadius: 40,
    backgroundColor: 'rgba(255, 240, 170, 0.95)',
    boxShadow: '0 0 30px 14px rgba(255, 225, 120, 0.8)',
  },
  section: { color: colors.text, fontSize: 19, fontWeight: '800', marginTop: 22 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  tile: {
    width: '31%',
    alignItems: 'center',
    padding: 10,
    gap: 3,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
  },
  tileGrand: { borderColor: colors.gold, backgroundColor: 'rgba(255,193,7,0.12)' },
  tileName: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 4 },
  tileReason: { color: colors.muted, fontSize: 11 },
  tileOpen: { color: colors.gold, fontSize: 13, fontWeight: '900' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  modal: {
    width: 310,
    padding: 22,
    borderRadius: 22,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  kicker: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  loot: { alignItems: 'center', gap: 8 },
  lootCoins: { color: colors.gold, fontSize: 34, fontWeight: '900' },
  lootItem: { alignItems: 'center', gap: 6, marginTop: 4 },
  lootName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  lootHint: { color: colors.muted, fontSize: 13 },
  wait: { color: colors.muted, fontSize: 15, fontStyle: 'italic' },
  error: { color: colors.gold, textAlign: 'center' },
  ok: { marginTop: 16, alignSelf: 'stretch', borderRadius: 14, overflow: 'hidden' },
  okInner: { paddingVertical: 12, alignItems: 'center' },
  okText: { color: colors.onGold, fontSize: 16, fontWeight: '800' },
});
