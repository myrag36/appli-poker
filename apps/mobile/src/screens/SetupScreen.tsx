import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { colors } from '../theme';

export interface GameSettings {
  names: string[];
  stack: number;
  bigBlind: number;
}

const MAX_PLAYERS = 8;

export function SetupScreen({ onStart }: { onStart: (settings: GameSettings) => void }) {
  const [names, setNames] = useState(['', '']);
  const [stack, setStack] = useState('1000');
  const [bigBlind, setBigBlind] = useState('20');

  const cleaned = names.map((n, i) => n.trim() || `Joueur ${i + 1}`);
  const stackValue = parseInt(stack, 10);
  const bbValue = parseInt(bigBlind, 10);
  const valid =
    bbValue >= 2 && bbValue % 2 === 0 && stackValue >= bbValue && new Set(cleaned).size === cleaned.length;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Appli Poker</Text>
      <Text style={styles.subtitle}>Texas Hold'em entre amis, jetons fictifs</Text>

      <Text style={styles.section}>Joueurs</Text>
      {names.map((name, i) => (
        <View key={i} style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex]}
            placeholder={`Joueur ${i + 1}`}
            placeholderTextColor={colors.muted}
            value={name}
            maxLength={16}
            onChangeText={(t) => setNames(names.map((n, j) => (j === i ? t : n)))}
          />
          {names.length > 2 && (
            <Button
              label="✕"
              variant="secondary"
              onPress={() => setNames(names.filter((_, j) => j !== i))}
            />
          )}
        </View>
      ))}
      {names.length < MAX_PLAYERS && (
        <Button label="+ Ajouter un joueur" variant="secondary" onPress={() => setNames([...names, ''])} />
      )}

      <Text style={styles.section}>Réglages</Text>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>Jetons de départ</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={stack} onChangeText={setStack} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>Grosse blinde</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={bigBlind}
            onChangeText={setBigBlind}
          />
        </View>
      </View>
      <Text style={styles.hint}>
        Petite blinde : {bbValue >= 2 ? bbValue / 2 : '?'}. Pour l'instant, la partie se joue sur un seul
        téléphone qu'on se passe à tour de rôle.
      </Text>
      {new Set(cleaned).size !== cleaned.length && (
        <Text style={styles.error}>Deux joueurs ont le même nom.</Text>
      )}

      <View style={styles.spacer} />
      <Button
        label="Lancer la partie"
        disabled={!valid}
        onPress={() => onStart({ names: cleaned, stack: stackValue, bigBlind: bbValue })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60 },
  title: { color: colors.gold, fontSize: 34, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.muted, textAlign: 'center', marginBottom: 20 },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  label: { color: colors.muted, marginBottom: 4 },
  input: {
    backgroundColor: colors.feltDark,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginVertical: 4,
  },
  hint: { color: colors.muted, marginTop: 8, fontSize: 13 },
  error: { color: colors.gold, marginTop: 8 },
  spacer: { height: 24 },
});
