import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ALL_AVATAR_EMOJIS, cleanAvatar, defaultAvatar } from '@appli-poker/engine';
import { AvatarBadge } from './AvatarPicker';
import { type FriendRow, loadFriends } from '../online/progress';
import { inviteFriend } from '../online/invites';
import { tMessage } from '../online/messages';
import { colors } from '../theme';
import { t } from '../i18n';

type Sent = 'sending' | 'notified' | 'listed' | { error: string };

/** "Inviter un ami": my friends list, each with a button that sends them this table. */
export function InviteFriends({ game, code }: { game: string; code: string }) {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<FriendRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, Sent>>({});

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && friends === null) {
      try {
        setFriends((await loadFriends()).filter((f) => !f.me));
      } catch (e) {
        setLoadError((e as Error).message);
      }
    }
  }

  async function invite(friend: FriendRow) {
    setSent((s) => ({ ...s, [friend.user_id]: 'sending' }));
    try {
      const { notified } = await inviteFriend(friend.user_id, game, code);
      setSent((s) => ({ ...s, [friend.user_id]: notified ? 'notified' : 'listed' }));
    } catch (e) {
      setSent((s) => ({ ...s, [friend.user_id]: { error: tMessage((e as Error).message) } }));
    }
  }

  return (
    <View style={styles.box}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={({ pressed }) => [styles.header, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.headerText}>{t('👋 Inviter un ami de ma liste')}</Text>
        <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open && (
        <View style={styles.list}>
          {loadError && <Text style={styles.error}>{loadError}</Text>}
          {friends === null && !loadError && <ActivityIndicator color={colors.gold} />}
          {friends?.length === 0 && (
            <Text style={styles.hint}>
              {t('Ajoute des amis avec leur code ami (écran Amis) pour les inviter ici.')}
            </Text>
          )}
          {friends?.map((f, i) => {
            const state = sent[f.user_id];
            const done = state === 'notified' || state === 'listed';
            return (
              <View key={f.user_id} style={styles.row}>
                <AvatarBadge
                  avatar={cleanAvatar(
                    { emoji: f.avatar, color: f.avatar_color },
                    defaultAvatar(i),
                    ALL_AVATAR_EMOJIS,
                  )}
                  size={34}
                />
                <View style={styles.flex}>
                  <Text style={styles.name} numberOfLines={1}>
                    {f.name}
                  </Text>
                  {state === 'notified' && <Text style={styles.ok}>{t('Invitation envoyée 🔔')}</Text>}
                  {state === 'listed' && (
                    <Text style={styles.note}>{t('Envoyée : à retrouver dans son écran Amis.')}</Text>
                  )}
                  {typeof state === 'object' && <Text style={styles.error}>{state.error}</Text>}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('Inviter {name}', { name: f.name })}
                  disabled={state === 'sending' || done}
                  onPress={() => invite(f)}
                  style={[styles.button, (state === 'sending' || done) && styles.buttonDone]}
                >
                  {state === 'sending' ? (
                    <ActivityIndicator color={colors.gold} size="small" />
                  ) : (
                    <Text style={styles.buttonText}>{done ? '✓' : t('Inviter')}</Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  headerText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '800' },
  chevron: { color: colors.muted, fontSize: 16 },
  list: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  ok: { color: colors.gold, fontSize: 12, fontWeight: '700' },
  note: { color: colors.muted, fontSize: 12 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: '#ff8a80', fontSize: 12 },
  button: {
    minWidth: 76,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  buttonDone: { opacity: 0.5 },
  buttonText: { color: colors.gold, fontWeight: '800', fontSize: 14 },
});
