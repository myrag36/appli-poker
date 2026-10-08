import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors } from '../theme';
import { t } from '../i18n';
import { tMessage } from '../online/messages';

/** The rematch table written on a finished one, and who asked for it. */
export interface RematchInfo {
  roomId: string;
  code: string;
  byId: string;
  by: string;
}

interface Props {
  rematch: RematchInfo | null | undefined;
  meId: string;
  /** Asks the server for the rematch (opening it or joining it) and goes to its table. */
  onRematch: () => Promise<void>;
  /** Drawn inside another panel (no frame of its own). */
  bare?: boolean;
}

/**
 * Once an online game is over: one tap opens a new table with the same players, and the
 * others see who asked and follow with one tap, without typing a code.
 */
export function RematchPanel({ rematch, meId, onRematch, bare }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const someoneElse = rematch && rematch.byId !== meId;

  async function go() {
    setBusy(true);
    setError(null);
    try {
      await onRematch();
    } catch (e) {
      setError(tMessage((e as Error).message));
      setBusy(false);
    }
  }

  return (
    <View style={[styles.panel, !bare && styles.framed, someoneElse && !bare && styles.invited]}>
      {someoneElse ? (
        <Text style={styles.title} numberOfLines={2}>
          {t('🔁 {name} propose une revanche !', { name: rematch.by })}
        </Text>
      ) : (
        !rematch && <Text style={styles.hint}>{t('Mêmes joueurs, même table, sans code.')}</Text>
      )}
      <Button
        compact
        label={someoneElse ? t('Rejouer') : rematch ? t('Retourner à la revanche') : t('🔁 Revanche')}
        disabled={busy}
        onPress={go}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 6, alignItems: 'stretch' },
  framed: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  invited: { borderColor: colors.gold },
  title: { color: colors.gold, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  error: { color: colors.gold, textAlign: 'center', fontSize: 13 },
});
