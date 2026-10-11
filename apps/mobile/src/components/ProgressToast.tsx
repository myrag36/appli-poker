import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { type Avatar, REWARD_KIND_ONE, defaultAvatar } from '@appli-poker/engine';
import { type ProgressEvent, type UnlockEvent, useProgressEvent, useUnlockEvent } from '../online/progress';
import { loadAvatar } from '../online/supabase';
import { RewardPreview } from './RewardPreview';
import { sounds } from '../feedback';
import { colors, gradients, shadow } from '../theme';
import { t } from '../i18n';

/** "+50 XP" when experience comes in, and a celebration with the new rewards on a level up. */
export function ProgressToast() {
  const event = useProgressEvent();
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState<ProgressEvent | null>(null);
  const [levelUp, setLevelUp] = useState<ProgressEvent | null>(null);
  const y = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    if (!event) return;
    setShown(event);
    if (event.levelUp) {
      setLevelUp(event);
      sounds.win();
    }
    y.setValue(-80);
    Animated.sequence([
      Animated.spring(y, { toValue: 0, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(y, { toValue: -80, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [event?.key]);

  return (
    <>
      {shown && (
        <Animated.View
          pointerEvents="none"
          style={[styles.toastBox, { top: insets.top + 8, transform: [{ translateY: y }] }]}
        >
          <LinearGradient colors={gradients.gold} style={[styles.toast, shadow]}>
            <Text style={styles.toastText}>
              +{shown.gained} XP{shown.coins > 0 ? ` · +${shown.coins} 🪙` : ''}
              {shown.levelUp ? ` · ${t('Niveau {n} !', { n: shown.level })}` : ''}
            </Text>
          </LinearGradient>
        </Animated.View>
      )}
      <UnlockToast top={insets.top + (shown ? 56 : 8)} />
      <Modal
        visible={levelUp !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLevelUp(null)}
      >
        <View style={styles.backdrop}>
          {levelUp && (
            <View style={[styles.card, shadow]}>
              <Text style={styles.party}>🎉</Text>
              <Text style={styles.kicker}>{t('Niveau supérieur')}</Text>
              <Text style={styles.level}>{t('Niveau {n}', { n: levelUp.level })}</Text>
              {levelUp.rewards.length > 0 ? (
                <>
                  <Text style={styles.unlocked}>{t('Tu débloques :')}</Text>
                  {levelUp.rewards.map((r) => (
                    <Text key={`${r.kind}-${r.id}`} style={styles.reward}>
                      {t('{kind} : {name}', {
                        kind: t(REWARD_KIND_ONE[r.kind]),
                        name: r.kind === 'avatar' ? r.id : t(r.name),
                      })}
                    </Text>
                  ))}
                  <Text style={styles.hint}>{t('Va dans « Personnaliser » pour les essayer.')}</Text>
                </>
              ) : (
                <Text style={styles.hint}>{t('Continue comme ça, la prochaine récompense approche !')}</Text>
              )}
              <Pressable accessibilityRole="button" onPress={() => setLevelUp(null)} style={styles.ok}>
                <LinearGradient colors={gradients.gold} style={styles.okInner}>
                  <Text style={styles.okText}>{t('Super !')}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

/** "Débloqué !" with a picture of each item just earned by playing. */
function UnlockToast({ top }: { top: number }) {
  const event = useUnlockEvent();
  const [shown, setShown] = useState<UnlockEvent | null>(null);
  const [avatar, setAvatar] = useState<Avatar>(defaultAvatar(0));
  const y = useRef(new Animated.Value(-160)).current;

  useEffect(() => {
    if (!event) return;
    loadAvatar().then((a) => a && setAvatar(a));
    setShown(event);
    sounds.win();
    y.setValue(-160);
    Animated.sequence([
      Animated.spring(y, { toValue: 0, useNativeDriver: true }),
      Animated.delay(3600),
      Animated.timing(y, { toValue: -200, duration: 350, useNativeDriver: true }),
    ]).start(() => setShown(null));
  }, [event?.key]);

  if (!shown) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.toastBox, { top, transform: [{ translateY: y }] }]}>
      <View style={[styles.unlock, shadow]}>
        <Text style={styles.unlockKicker}>{t('🔓 Débloqué en jouant !')}</Text>
        {shown.rewards.slice(0, 3).map((r) => (
          <View key={`${r.kind}-${r.id}`} style={styles.unlockRow}>
            <View style={styles.unlockPreview}>
              <RewardPreview reward={r} avatar={avatar} />
            </View>
            <View>
              <Text style={styles.unlockKind}>{t(REWARD_KIND_ONE[r.kind])}</Text>
              <Text style={styles.unlockName}>{t(r.name)}</Text>
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  unlock: {
    minWidth: 250,
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.gold,
    gap: 8,
  },
  unlockKicker: { color: colors.gold, fontWeight: '900', fontSize: 14, textAlign: 'center' },
  unlockRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  unlockPreview: { width: 90, height: 64, alignItems: 'center', justifyContent: 'center' },
  unlockKind: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  unlockName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  toastBox: { position: 'absolute', alignSelf: 'center', zIndex: 50 },
  toast: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  toastText: { color: colors.onGold, fontWeight: '900', fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: 300,
    padding: 22,
    borderRadius: 22,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.gold,
    gap: 4,
  },
  party: { fontSize: 46 },
  kicker: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  level: { color: colors.gold, fontSize: 34, fontWeight: '900' },
  unlocked: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 8 },
  reward: { color: colors.text, fontSize: 15 },
  hint: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 8 },
  ok: { marginTop: 14, alignSelf: 'stretch', borderRadius: 14, overflow: 'hidden' },
  okInner: { paddingVertical: 12, alignItems: 'center' },
  okText: { color: colors.onGold, fontSize: 16, fontWeight: '800' },
});
