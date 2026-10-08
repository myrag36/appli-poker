import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Avatar } from '@appli-poker/engine';
import { AvatarBadge } from './AvatarPicker';
import { type ChatMessage, MAX_MESSAGE_LENGTH } from '../online/useRoom';
import { colors } from '../theme';
import { t } from '../i18n';

/** Ready-made lines, one tap to send. */
const QUICK = [
  t('Bien joué ! 👏'),
  t('Allez ! 🔥'),
  t('Je bluffe pas 😏'),
  t('Trop de chance 😅'),
  'GG 🤝',
  t('Dépêche ⏰'),
];

interface Props {
  visible: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  meId: string;
  names: Record<string, string>;
  avatars: Record<string, Avatar>;
  onSend: (text: string) => Promise<void>;
}

function time(iso: string) {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** The table's conversation, in a sheet that slides over the game. */
export function ChatPanel({ visible, onClose, messages, meId, names, avatars, onSend }: Props) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) setTimeout(() => list.current?.scrollToEnd({ animated: false }), 50);
  }, [visible, messages.length]);

  async function send(value: string) {
    if (!value.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSend(value);
      setText('');
    } catch (e) {
      setError(t((e as Error).message));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('Fermer la discussion')} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('💬 Discussion')}</Text>
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

          <ScrollView ref={list} style={styles.list} contentContainerStyle={styles.listContent}>
            {messages.length === 0 && (
              <Text style={styles.empty}>{t('Pas encore de message. Dis bonjour à la table !')}</Text>
            )}
            {messages.map((m, i) => {
              const mine = m.user_id === meId;
              const sameAuthor = messages[i - 1]?.user_id === m.user_id;
              return (
                <View key={m.id} style={[styles.row, mine && styles.rowMine, sameAuthor && styles.rowFollow]}>
                  {!mine && (
                    <View style={styles.avatar}>
                      {!sameAuthor && avatars[m.user_id] && (
                        <AvatarBadge avatar={avatars[m.user_id]} size={28} />
                      )}
                    </View>
                  )}
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                    {!mine && !sameAuthor && (
                      <Text style={styles.author}>{names[m.user_id] ?? t('Ancien joueur')}</Text>
                    )}
                    <Text style={[styles.body, mine && styles.bodyMine]}>{m.body}</Text>
                    <Text style={[styles.time, mine && styles.timeMine]}>{time(m.created_at)}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickBar}
            contentContainerStyle={styles.quick}
          >
            {QUICK.map((q) => (
              <Pressable
                key={q}
                accessibilityRole="button"
                disabled={sending}
                onPress={() => send(q)}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
              >
                <Text style={styles.chipText}>{q}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('Écris un message…')}
              placeholderTextColor={colors.muted}
              maxLength={MAX_MESSAGE_LENGTH}
              returnKeyType="send"
              onSubmitEditing={() => send(text)}
              blurOnSubmit={false}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Envoyer')}
              disabled={sending || !text.trim()}
              onPress={() => send(text)}
              style={({ pressed }) => [
                styles.send,
                (sending || !text.trim()) && styles.sendDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.sendText}>➤</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: '75%',
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
  list: { flex: 1 },
  listContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  rowMine: { justifyContent: 'flex-end' },
  rowFollow: { marginTop: -5 },
  avatar: { width: 28 },
  bubble: { maxWidth: '78%', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14 },
  bubbleOther: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderBottomLeftRadius: 4,
  },
  bubbleMine: { backgroundColor: colors.gold, borderBottomRightRadius: 4 },
  author: { color: colors.gold, fontSize: 12, fontWeight: '800', marginBottom: 1 },
  body: { color: colors.text, fontSize: 15, lineHeight: 20 },
  bodyMine: { color: colors.onGold },
  time: { color: colors.muted, fontSize: 10, alignSelf: 'flex-end', marginTop: 2 },
  timeMine: { color: colors.onGoldMuted },
  quickBar: { flexGrow: 0, flexShrink: 0 },
  quick: { alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  error: { color: colors.gold, textAlign: 'center', fontSize: 13, marginBottom: 4 },
  inputRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12 },
  input: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    color: colors.text,
    fontSize: 16,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: colors.onGold, fontSize: 18, fontWeight: '900' },
});
