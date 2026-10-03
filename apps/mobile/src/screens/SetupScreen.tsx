import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { type Avatar, defaultAvatar } from '@appli-poker/engine';
import { AvatarBadge, AvatarPicker } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { LevelPicker } from '../components/LevelPicker';
import { colors } from '../theme';

export interface GameSettings {
  names: string[];
  stack: number;
  bigBlind: number;
  /** Tournament level length in minutes, or null for fixed blinds. */
  levelMinutes: number | null;
  /** One avatar per player, in the same order as `names`. */
  avatars: Avatar[];
}

const MAX_PLAYERS = 8;

interface Props {
  onStart: (settings: GameSettings) => void;
  onBack: () => void;
}

export function SetupScreen({ onStart, onBack }: Props) {
  const [names, setNames] = useState(['', '']);
  const [avatars, setAvatars] = useState<Avatar[]>([defaultAvatar(0), defaultAvatar(1)]);
  /** Index of the player whose avatar is being picked. */
  const [picking, setPicking] = useState<number | null>(null);
  const [stack, setStack] = useState('1000');
  const [bigBlind, setBigBlind] = useState('20');
  const [levelMinutes, setLevelMinutes] = useState<number | null>(null);

  const cleaned = names.map((n, i) => n.trim() || `Joueur ${i + 1}`);
  const stackValue = parseInt(stack, 10);
  const bbValue = parseInt(bigBlind, 10);
  const valid =
    bbValue >= 2 && bbValue % 2 === 0 && stackValue >= bbValue && new Set(cleaned).size === cleaned.length;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Sur ce téléphone</Text>

      <Text style={styles.section}>Joueurs</Text>
      {names.map((name, i) => (
        <View key={i}>
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Changer l'avatar du joueur ${i + 1}`}
              onPress={() => setPicking(picking === i ? null : i)}
            >
              <AvatarBadge avatar={avatars[i]} size={40} />
            </Pressable>
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
                onPress={() => {
                  setNames(names.filter((_, j) => j !== i));
                  setAvatars(avatars.filter((_, j) => j !== i));
                  setPicking(null);
                }}
              />
            )}
          </View>
          {picking === i && (
            <AvatarPicker
              value={avatars[i]}
              onChange={(a) => setAvatars(avatars.map((x, j) => (j === i ? a : x)))}
            />
          )}
        </View>
      ))}
      {names.length < MAX_PLAYERS && (
        <Button
          label="+ Ajouter un joueur"
          variant="secondary"
          onPress={() => {
            setNames([...names, '']);
            setAvatars([...avatars, defaultAvatar(names.length)]);
          }}
        />
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
        Petite blinde : {bbValue >= 2 ? bbValue / 2 : '?'}. La partie se joue sur un seul téléphone qu'on se
        passe à tour de rôle.
      </Text>
      <LevelPicker value={levelMinutes} onChange={setLevelMinutes} />
      {new Set(cleaned).size !== cleaned.length && (
        <Text style={styles.error}>Deux joueurs ont le même nom.</Text>
      )}

      <View style={styles.spacer} />
      <Button
        label="Lancer la partie"
        disabled={!valid}
        onPress={() =>
          onStart({ names: cleaned, stack: stackValue, bigBlind: bbValue, levelMinutes, avatars })
        }
      />
      <Button label="Retour" variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60 },
  title: { color: colors.gold, fontSize: 30, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  hint: { color: colors.muted, marginTop: 8, fontSize: 13 },
  error: { color: colors.gold, marginTop: 8 },
  spacer: { height: 24 },
});
