import { StyleSheet, Text, View } from 'react-native';
import type { Variant } from '@appli-poker/engine';
import { Pill } from './LevelPicker';
import { colors } from '../theme';

/** Texas Hold'em, or Omaha where everyone gets four cards. */
export function VariantPicker({ value, onChange }: { value: Variant; onChange: (v: Variant) => void }) {
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <Pill label="Texas Hold'em" active={value === 'holdem'} onPress={() => onChange('holdem')} />
        <Pill label="Omaha" active={value === 'omaha'} onPress={() => onChange('omaha')} />
      </View>
      {value === 'omaha' && (
        <Text style={styles.hint}>
          4 cartes chacun, dont exactement 2 avec 3 du tableau. Les mises sont limitées à la taille du pot.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8, marginVertical: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
