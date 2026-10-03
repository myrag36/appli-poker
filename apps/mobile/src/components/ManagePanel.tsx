import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Avatar } from '@appli-poker/engine';
import { AvatarBadge } from './AvatarPicker';
import { Button } from './Button';
import { callServer } from '../online/supabase';
import type { Room, RoomPlayer } from '../online/useRoom';
import { colors } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  room: Room;
  players: RoomPlayer[];
  meId: string;
  avatars: Record<string, Avatar>;
  onChanged: () => void;
}

/** The host's tools: pause the game and remove players. */
export function ManagePanel({ visible, onClose, room, players, meId, avatars, onChanged }: Props) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Removing someone takes a second tap, so a slip of the finger does nothing.
  const [confirming, setConfirming] = useState<string | null>(null);

  const hand = room.public_state;
  const inHand = (id: string) =>
    hand !== null && hand.street !== 'finished' && hand.players.some((p) => p.id === id);

  async function run(request: Parameters<typeof callServer>[0]) {
    setBusy(true);
    setError(null);
    try {
      await callServer(request);
      onChanged();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: string) {
    if (confirming !== userId) {
      setConfirming(userId);
      return;
    }
    setConfirming(null);
    await run({ type: 'remove', roomId: room.id, userId });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer le menu" />
        <View style={[styles.sheet, { marginBottom: insets.bottom }]}>
          <View style={styles.header}>
            <Text style={styles.title}>⚙️ Gérer la table</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              onPress={onClose}
              hitSlop={10}
              style={styles.close}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            {hand && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pause</Text>
                <Text style={styles.hint}>
                  {room.paused
                    ? 'Personne ne peut jouer. À la reprise, le joueur dont c’est le tour a de nouveau 45 secondes.'
                    : 'Arrête le chrono et les coups le temps d’une pause.'}
                </Text>
                <Button
                  label={room.paused ? '▶ Reprendre la partie' : '⏸ Mettre en pause'}
                  disabled={busy}
                  onPress={async () => {
                    if (await run({ type: 'pause', roomId: room.id, paused: !room.paused })) onClose();
                  }}
                />
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Joueurs</Text>
              <Text style={styles.hint}>
                Un joueur retiré perd ses jetons à cette table. Pendant une main, attends qu’elle se termine.
              </Text>
              {players.map((p) => (
                <View key={p.user_id} style={styles.player}>
                  <AvatarBadge avatar={avatars[p.user_id]} size={32} />
                  <View style={styles.playerBody}>
                    <Text style={styles.playerName} numberOfLines={1}>
                      {p.name}
                      {p.user_id === meId ? ' (toi)' : ''}
                    </Text>
                    <Text style={styles.playerStack}>
                      {p.is_bot ? 'Robot · ' : ''}
                      {p.stack} jetons
                    </Text>
                  </View>
                  {p.user_id !== meId && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Retirer ${p.name}`}
                      disabled={busy || inHand(p.user_id)}
                      onPress={() => remove(p.user_id)}
                      style={({ pressed }) => [
                        styles.remove,
                        confirming === p.user_id && styles.removeConfirm,
                        (busy || inHand(p.user_id)) && styles.removeDisabled,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.removeText}>
                        {inHand(p.user_id) ? 'En jeu' : confirming === p.user_id ? 'Confirmer ?' : 'Retirer'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
            {players.length < 8 && (
              <Button
                label="🤖 Ajouter un robot"
                variant="secondary"
                disabled={busy}
                onPress={() => run({ type: 'addBot', roomId: room.id })}
              />
            )}
            {error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 12 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 4,
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
  body: { padding: 16, gap: 18 },
  section: { gap: 8 },
  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  playerBody: { flex: 1 },
  playerName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  playerStack: { color: colors.muted, fontSize: 12 },
  remove: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  removeConfirm: { backgroundColor: colors.danger },
  removeDisabled: { opacity: 0.4 },
  removeText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  error: { color: colors.gold, textAlign: 'center' },
});
