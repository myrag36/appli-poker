import { StyleSheet, Text, View } from 'react-native';
import { colors, shadow } from '../theme';

/** A small stack of chips with an amount, used for bets and the pot. */
export function ChipStack({ amount, large }: { amount: number; large?: boolean }) {
  const size = large ? 22 : 16;
  return (
    <View style={styles.row}>
      <View style={[styles.chip, shadow, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[styles.inner, { borderRadius: size / 2 }]} />
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
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: '#fff',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { width: '45%', height: '45%', backgroundColor: '#fff', opacity: 0.85 },
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
