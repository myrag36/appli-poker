import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type Action, type HandView, legalActions } from '@appli-poker/engine';
import { Button } from './Button';
import { Appear } from './Motion';
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
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.row}>
        <View style={styles.cards}>
          {hole.map((c, i) => (
            <Appear key={c} delay={i * 140}>
              <PlayingCard card={c} width={42} />
            </Appear>
          ))}
        </View>
        {legal && (
          <View style={[styles.row, styles.grow]}>
            {legal.fold && (
              <Button
                compact
                label="Coucher"
                variant="danger"
                disabled={busy}
                onPress={() => play({ type: 'fold' })}
              />
            )}
            {legal.check && (
              <Button
                compact
                label="Checker"
                variant="secondary"
                disabled={busy}
                onPress={() => play({ type: 'check' })}
              />
            )}
            {legal.call > 0 && (
              <Button
                compact
                label={`Suivre ${legal.call}`}
                variant="secondary"
                disabled={busy}
                onPress={() => play({ type: 'call' })}
              />
            )}
          </View>
        )}
      </View>
      {legal && bounds && (
        <View style={styles.row}>
          <View style={styles.step}>
            <Button
              compact
              label="−"
              variant="secondary"
              onPress={() => setRaiseTo(Math.max(bounds.min, raiseValue - hand.bigBlind))}
            />
          </View>
          <Text style={styles.raiseValue} numberOfLines={1}>
            {raiseValue}
          </Text>
          <View style={styles.step}>
            <Button
              compact
              label="+"
              variant="secondary"
              onPress={() => setRaiseTo(Math.min(bounds.max, raiseValue + hand.bigBlind))}
            />
          </View>
          <Button
            compact
            label={hand.currentBet === 0 ? 'Miser' : 'Relancer'}
            disabled={busy}
            onPress={() => play({ type: 'raise', to: raiseValue })}
          />
          <Button
            compact
            label="Tapis"
            variant="danger"
            disabled={busy}
            onPress={() => play({ type: 'allin' })}
          />
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 8,
  },
  title: { color: colors.text, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  grow: { flex: 1 },
  cards: { flexDirection: 'row', gap: 2 },
  step: { width: 40 },
  raiseValue: { color: colors.text, fontSize: 17, fontWeight: '800', minWidth: 48, textAlign: 'center' },
  error: { color: colors.gold, textAlign: 'center' },
});
