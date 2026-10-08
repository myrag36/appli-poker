import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { REWARD_KIND_NAMES } from '@appli-poker/engine';
import { type ProgressEvent, useProgressEvent } from '../online/progress';
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
                        kind: t(REWARD_KIND_NAMES[r.kind].replace(/s$/, '')),
                        name: r.kind === 'avatar' ? r.id : t(r.name),
                      })}
                    </Text>
                  ))}
                  <Text style={styles.hint}>{t('Va dans « Mon profil » pour les essayer.')}</Text>
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

const styles = StyleSheet.create({
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
