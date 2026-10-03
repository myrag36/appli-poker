import { StyleSheet, Text, View } from 'react-native';
import { colors, shadow } from '../theme';

/** Chip colors by value, like in a real casino. */
const DENOMINATIONS = [
  { value: 1000, color: '#f2c14e', edge: '#7a5a00' },
  { value: 500, color: '#7b2cbf', edge: '#f0e6ff' },
  { value: 100, color: '#1b1b1b', edge: '#f5f5f5' },
  { value: 25, color: '#2a9d4f', edge: '#ffffff' },
  { value: 5, color: '#d62839', edge: '#ffffff' },
  { value: 1, color: '#f1f1f1', edge: '#3a6ea5' },
];
const MAX_CHIPS = 6;

/** The chips that make up an amount, largest first, capped so the pile stays small. */
function breakdown(amount: number) {
  const chips: (typeof DENOMINATIONS)[number][] = [];
  let left = amount;
  for (const d of DENOMINATIONS) {
    while (left >= d.value && chips.length < MAX_CHIPS) {
      chips.push(d);
      left -= d.value;
    }
  }
  return chips.length > 0 ? chips : [DENOMINATIONS[DENOMINATIONS.length - 1]];
}

/** A small pile of chips with the amount next to it, used for bets and the pot. */
export function ChipStack({ amount, large }: { amount: number; large?: boolean }) {
  const size = large ? 22 : 16;
  const step = large ? 3 : 2.5;
  // Smallest chips on top of the pile.
  const chips = breakdown(amount).reverse();
  return (
    <View style={styles.row}>
      <View style={{ width: size, height: size + step * (chips.length - 1) }}>
        {chips.map((d, i) => (
          <View
            key={i}
            style={[
              styles.chip,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                bottom: (chips.length - 1 - i) * step,
                backgroundColor: d.color,
                borderColor: d.edge,
              },
            ]}
          >
            <View style={[styles.inner, { borderRadius: size / 2, borderColor: d.edge }]} />
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
  chip: {
    position: 'absolute',
    left: 0,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 2px rgba(0,0,0,0.6)',
  },
  inner: { width: '55%', height: '55%', borderWidth: 1, opacity: 0.7 },
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
