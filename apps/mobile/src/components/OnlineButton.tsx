import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors } from '../theme';

/** On a game's setup: play with friends, each on their own phone. */
export function OnlineButton({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.box}>
      <Button label="🌍 Jouer en ligne avec des amis" onPress={onPress} />
      <Text style={styles.hint}>Chacun sur son téléphone, avec le code de la table.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 14, marginBottom: 4 },
  hint: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 2 },
});
