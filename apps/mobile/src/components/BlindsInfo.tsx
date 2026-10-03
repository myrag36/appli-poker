import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Current blinds and, in a tournament, a countdown to the next level. */
export function BlindsInfo({
  smallBlind,
  bigBlind,
  nextLevelAt,
}: {
  smallBlind: number;
  bigBlind: number;
  nextLevelAt?: number | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!nextLevelAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [nextLevelAt]);

  let tail = '';
  if (nextLevelAt)
    tail = nextLevelAt > now ? ` · hausse dans ${clock(nextLevelAt - now)}` : ' · hausse à la prochaine main';
  return (
    <Text style={styles.text} numberOfLines={1}>
      Blindes {smallBlind}/{bigBlind}
      {tail}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', marginTop: 2 },
});
