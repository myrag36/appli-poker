import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors } from '../theme';
import type { OnlineBoardProps } from './types';

/** Placeholder board while a game is not playable online yet. */
export function ComingSoonBoard({ onLeave }: OnlineBoardProps) {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>Ce jeu arrive bientôt en ligne.</Text>
      <Button label="Retour" variant="secondary" onPress={onLeave} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  text: { color: colors.text, textAlign: 'center', fontSize: 16 },
});
