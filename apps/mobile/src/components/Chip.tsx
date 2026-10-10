import { StyleSheet, Text, View } from 'react-native';
import { colors, shadow } from '../theme';
import { CHIP_VALUES, ChipFace, useChipStyle } from './chipStyles';

const MAX_CHIPS = 6;

/** The chips that make up an amount (indexes in CHIP_VALUES), largest first, capped so the pile stays small. */
function breakdown(amount: number) {
  const chips: number[] = [];
  let left = amount;
  CHIP_VALUES.forEach((value, i) => {
    while (left >= value && chips.length < MAX_CHIPS) {
      chips.push(i);
      left -= value;
    }
  });
  return chips.length > 0 ? chips : [CHIP_VALUES.length - 1];
}

/** A small pile of chips, in the style the player chose, with the amount next to it. */
export function ChipStack({ amount, large }: { amount: number; large?: boolean }) {
  const style = useChipStyle();
  const size = large ? 22 : 16;
  const step = large ? 3 : 2.5;
  // Smallest chips on top of the pile.
  const chips = breakdown(amount).reverse();
  return (
    <View style={styles.row}>
      <View style={{ width: size, height: size + step * (chips.length - 1) }}>
        {chips.map((index, i) => (
          <View key={i} style={[styles.chip, { bottom: (chips.length - 1 - i) * step }]}>
            <ChipFace style={style} index={index} size={size} />
          </View>
        ))}
      </View>
      <Text style={[styles.amount, large && styles.amountLarge]}>{amount}</Text>
    </View>
  );
}

/** The dealer button. */
export function DealerButton() {
  return (
    <View style={[styles.dealer, shadow]}>
      <Text style={styles.dealerText}>D</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingVertical: 2,
    paddingLeft: 2,
    paddingRight: 7,
    borderRadius: 12,
  },
  chip: { position: 'absolute', left: 0 },
  amount: { color: colors.text, fontWeight: '700', fontSize: 12 },
  amountLarge: { fontSize: 16, color: colors.gold },
  dealer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealerText: { color: colors.black, fontWeight: '900', fontSize: 11 },
});
