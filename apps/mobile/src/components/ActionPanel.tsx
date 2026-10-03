import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type Action, type HandView, legalActions } from '@appli-poker/engine';
import { Button } from './Button';
import { PlayingCard } from './PlayingCard';
import { colors } from '../theme';

interface Props {
  hand: HandView;
  playerId: string;
  title: string;
  hole: string[];
  error?: string | null;
  busy?: boolean;
  onAction: (action: Action) => void;
}

/** The acting player's cards and the buttons for every legal action. */
export function ActionPanel({ hand, playerId, title, hole, error, busy, onAction }: Props) {
  const [raiseTo, setRaiseTo] = useState(0);
  const legal = legalActions(hand, playerId);
  const bounds = legal?.raise ?? null;
  const raiseValue = bounds ? Math.min(Math.max(raiseTo, bounds.min), bounds.max) : 0;

  function play(action: Action) {
    setRaiseTo(0);
    onAction(action);
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.row, styles.center]}>
        {hole.map((c) => (
          <PlayingCard key={c} card={c} />
        ))}
      </View>
      {legal && (
        <>
          <View style={styles.row}>
            {legal.fold && (
              <Button label="Se coucher" variant="danger" disabled={busy} onPress={() => play({ type: 'fold' })} />
            )}
            {legal.check && (
              <Button label="Checker" variant="secondary" disabled={busy} onPress={() => play({ type: 'check' })} />
            )}
            {legal.call > 0 && (
              <Button
                label={`Suivre ${legal.call}`}
                variant="secondary"
                disabled={busy}
                onPress={() => play({ type: 'call' })}
              />
            )}
          </View>
          {bounds && (
            <>
              <View style={[styles.row, styles.center]}>
                <Button
                  label="−"
                  variant="secondary"
                  onPress={() => setRaiseTo(Math.max(bounds.min, raiseValue - hand.bigBlind))}
                />
                <Text style={styles.raiseValue}>{raiseValue}</Text>
                <Button
                  label="+"
                  variant="secondary"
                  onPress={() => setRaiseTo(Math.min(bounds.max, raiseValue + hand.bigBlind))}
                />
              </View>
              <View style={styles.row}>
                <Button
                  label={`${hand.currentBet === 0 ? 'Miser' : 'Relancer à'} ${raiseValue}`}
                  disabled={busy}
                  onPress={() => play({ type: 'raise', to: raiseValue })}
                />
                <Button label="Tapis" variant="danger" disabled={busy} onPress={() => play({ type: 'allin' })} />
              </View>
            </>
          )}
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: colors.feltDark, gap: 6 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  center: { justifyContent: 'center', marginVertical: 6 },
  raiseValue: { color: colors.text, fontSize: 22, fontWeight: '800', minWidth: 80, textAlign: 'center' },
  error: { color: colors.gold, textAlign: 'center' },
});
