import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Avatar, type HandView, handOutcomes } from '@appli-poker/engine';
import { AvatarBadge } from './AvatarPicker';
import { PlayingCard } from './PlayingCard';
import { supabase } from '../online/supabase';
import { colors } from '../theme';
import { t } from '../i18n';

/** How many past hands the panel shows. */
const LIMIT = 20;

interface PastHand {
  hand_number: number;
  summary: HandView;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  meId: string;
  avatars: Record<string, Avatar>;
}

function signed(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

function HandCard({
  hand,
  number,
  meId,
  avatars,
}: {
  hand: HandView;
  number: number;
  meId: string;
  avatars: Record<string, Avatar>;
}) {
  const outcomes = new Map(handOutcomes(hand).map((o) => [o.id, o]));
  const winners = hand.players.filter((p) => outcomes.get(p.id)?.won);
  const pot = hand.players.reduce((s, p) => s + p.totalBet, 0);
  const shownName = winners.map((w) => hand.showdown[w.id]?.name).find(Boolean);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.number}>{t('Main n° {n}', { n: number })}</Text>
        <Text style={styles.pot}>{t('Pot {n}', { n: pot })}</Text>
      </View>
      <Text style={styles.winner}>
        🏆 {winners.map((w) => (w.id === meId ? t('Toi') : w.name)).join(t(' et '))}
        {shownName ? ` · ${t(shownName)}` : hand.board.length < 5 ? t(' · les autres se sont couchés') : ''}
      </Text>
      {hand.board.length > 0 && (
        <View style={styles.board}>
          {hand.board.map((c) => (
            <PlayingCard key={c} card={c} width={30} />
          ))}
        </View>
      )}
      {hand.players.map((p) => {
        const o = outcomes.get(p.id)!;
        return (
          <View key={p.id} style={styles.player}>
            {avatars[p.id] ? (
              <AvatarBadge avatar={avatars[p.id]} size={24} />
            ) : (
              <View style={styles.noAvatar} />
            )}
            <Text style={[styles.name, p.folded && styles.folded]} numberOfLines={1}>
              {p.id === meId ? t('Toi') : p.name}
              {p.folded ? t(' (couché)') : ''}
            </Text>
            <View style={styles.hole}>
              {p.hole.map((c) => (
                <PlayingCard key={c} card={c} width={20} />
              ))}
            </View>
            <Text style={[styles.net, o.net < 0 && styles.loss, o.net === 0 && styles.even]}>
              {signed(o.net)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** The table's last finished hands: board, cards shown, winners and what each player won or lost. */
export function HistoryPanel({ visible, onClose, roomId, meId, avatars }: Props) {
  const insets = useSafeAreaInsets();
  const [hands, setHands] = useState<PastHand[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setError(null);
    supabase
      .from('hand_history')
      .select('hand_number, summary')
      .eq('room_id', roomId)
      .order('hand_number', { ascending: false })
      .limit(LIMIT)
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) setError(t("Impossible de charger l'historique"));
        else setHands(data as PastHand[]);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, roomId]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t("Fermer l'historique")} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('📜 Mains précédentes')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Fermer')}
              onPress={onClose}
              hitSlop={10}
              style={styles.close}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.list}>
            {error && <Text style={styles.empty}>{error}</Text>}
            {!hands && !error && <ActivityIndicator color={colors.gold} style={styles.loading} />}
            {hands?.length === 0 && (
              <Text style={styles.empty}>{t("Aucune main terminée pour l'instant.")}</Text>
            )}
            {hands?.map((h) => (
              <HandCard
                key={h.hand_number}
                hand={h.summary}
                number={h.hand_number}
                meId={meId}
                avatars={avatars}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    maxHeight: '85%',
    minHeight: '50%',
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  closeText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  list: { paddingHorizontal: 12, paddingBottom: 12, gap: 10 },
  loading: { marginTop: 30 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 30 },
  card: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  number: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  pot: { color: colors.gold, fontSize: 12, fontWeight: '800' },
  winner: { color: colors.text, fontSize: 15, fontWeight: '800' },
  board: { flexDirection: 'row', gap: 3, marginVertical: 2 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 30 },
  noAvatar: { width: 24 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  folded: { color: colors.muted },
  hole: { flexDirection: 'row', gap: 2 },
  net: { color: colors.gold, fontSize: 14, fontWeight: '900', width: 64, textAlign: 'right' },
  loss: { color: colors.danger },
  even: { color: colors.muted },
});
