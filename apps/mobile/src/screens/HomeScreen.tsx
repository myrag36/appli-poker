import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors } from '../theme';

interface Props {
  canResume: boolean;
  onOnline: () => void;
  onResume: () => void;
  onLocal: () => void;
}

export function HomeScreen({ canResume, onOnline, onResume, onLocal }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>♠ ♥ ♣ ♦</Text>
      <Text style={styles.title}>Appli Poker</Text>
      <Text style={styles.subtitle}>Texas Hold'em entre amis, jetons fictifs</Text>
      <View style={styles.buttons}>
        {canResume && <Button label="Reprendre ma table" onPress={onResume} />}
        <Button
          label="Jouer en ligne avec mes amis"
          variant={canResume ? 'secondary' : 'primary'}
          onPress={onOnline}
        />
        <Button label="Jouer sur ce téléphone" variant="secondary" onPress={onLocal} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { color: colors.text, fontSize: 28, textAlign: 'center', letterSpacing: 6 },
  title: { color: colors.gold, fontSize: 38, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  subtitle: { color: colors.muted, textAlign: 'center', marginBottom: 32 },
  buttons: { gap: 6 },
});
