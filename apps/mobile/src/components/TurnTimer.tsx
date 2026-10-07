import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const TURN_SECONDS = 45;

/** Seconds left for the player to act, with a bar that shrinks and turns red at the end. */
export function TurnTimer({
  deadline,
  now,
  name,
  seconds = TURN_SECONDS,
}: {
  deadline: number;
  now: number;
  name: string;
  /** Length of a full turn, for the bar. */
  seconds?: number;
}) {
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const ratio = Math.min(1, left / seconds);
  const urgent = left <= 10;
  return (
    <View style={styles.box}>
      <Text style={[styles.text, urgent && styles.urgent]}>
        {left > 0 ? `${name} : ${left} s` : `Temps écoulé pour ${name}`}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%` }, urgent && styles.fillUrgent]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 3 },
  text: { color: colors.muted, textAlign: 'center', fontWeight: '600', fontSize: 13 },
  urgent: { color: colors.danger },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.35)', overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.gold },
  fillUrgent: { backgroundColor: colors.danger },
});
