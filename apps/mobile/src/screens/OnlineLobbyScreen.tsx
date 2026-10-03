import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { LevelPicker } from '../components/LevelPicker';
import { callServer, saveLastRoom } from '../online/supabase';
import { colors } from '../theme';

interface Props {
  initialName: string;
  onEnter: (roomId: string, name: string) => void;
  onBack: () => void;
}

/** Create a private table or join one with the code a friend shared. */
export function OnlineLobbyScreen({ initialName, onEnter, onBack }: Props) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState('');
  const [stack, setStack] = useState('1000');
  const [bigBlind, setBigBlind] = useState('20');
  const [levelMinutes, setLevelMinutes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();

  async function run(request: () => Promise<{ roomId: string }>) {
    setBusy(true);
    setError(null);
    try {
      const { roomId } = await request();
      await saveLastRoom({ roomId, name: trimmed });
      onEnter(roomId, trimmed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Jouer en ligne</Text>

      <Text style={styles.label}>Ton prénom</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        maxLength={16}
        placeholder="Simon"
        placeholderTextColor={colors.muted}
      />

      <Text style={styles.section}>Rejoindre une table</Text>
      <TextInput
        style={[styles.input, styles.code]}
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        maxLength={6}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="CODE"
        placeholderTextColor={colors.muted}
      />
      <Button
        label="Rejoindre"
        disabled={busy || !trimmed || code.trim().length !== 6}
        onPress={() => run(() => callServer({ type: 'join', name: trimmed, code }))}
      />

      <Text style={styles.section}>Ou créer une table</Text>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>Jetons de départ</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={stack} onChangeText={setStack} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>Grosse blinde</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={bigBlind} onChangeText={setBigBlind} />
        </View>
      </View>
      <LevelPicker value={levelMinutes} onChange={setLevelMinutes} />
      <Button
        label="Créer la table"
        variant="secondary"
        disabled={busy || !trimmed}
        onPress={() =>
          run(() =>
            callServer({
              type: 'create',
              name: trimmed,
              stack: parseInt(stack, 10),
              bigBlind: parseInt(bigBlind, 10),
              levelMinutes,
            }),
          )
        }
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.spacer} />
      <Button label="Retour" variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60 },
  title: { color: colors.gold, fontSize: 30, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  label: { color: colors.muted, marginBottom: 4 },
  input: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginVertical: 4,
  },
  code: { fontSize: 24, letterSpacing: 6, textAlign: 'center', fontWeight: '700' },
  error: { color: colors.gold, marginTop: 12, textAlign: 'center' },
  spacer: { height: 24 },
});
