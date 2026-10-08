import { useRef, useState } from 'react';
import { type GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import { type Action, type HandView, legalActions } from '@appli-poker/engine';
import { Button } from './Button';
import { Appear } from './Motion';
import { PlayingCard } from './PlayingCard';
import { useDesktop } from '../layout';
import { colors } from '../theme';
import { t } from '../i18n';

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
  const me = hand.players.find((p) => p.id === playerId);
  // In Omaha the biggest bet is often the pot, not every chip.
  const potLimited = bounds !== null && me !== undefined && bounds.max < me.bet + me.stack;

  const desktop = useDesktop();

  function play(action: Action) {
    setRaiseTo(0);
    onAction(action);
  }

  if (desktop) {
    // On a computer: one bar under the table, the cards on the left and every button at its natural width.
    return (
      <View style={[styles.panel, styles.panelWide]}>
        <View style={styles.cardsWide}>
          {hole.map((c, i) => (
            <Appear key={c} delay={i * 140}>
              <PlayingCard card={c} width={hole.length > 2 ? 44 : 60} />
            </Appear>
          ))}
        </View>
        <View style={styles.controls}>
          <View style={styles.row}>
            <Text style={[styles.title, styles.titleWide]} numberOfLines={1}>
              {title}
            </Text>
            {legal?.fold && (
              <View style={styles.wideButton}>
                <Button
                  compact
                  label={t('Coucher')}
                  variant="danger"
                  disabled={busy}
                  onPress={() => play({ type: 'fold' })}
                />
              </View>
            )}
            {legal?.check && (
              <View style={styles.wideButton}>
                <Button
                  compact
                  label={t('Checker')}
                  variant="secondary"
                  disabled={busy}
                  onPress={() => play({ type: 'check' })}
                />
              </View>
            )}
            {legal && legal.call > 0 && (
              <View style={styles.wideButton}>
                <Button
                  compact
                  label={t('Suivre {n}', { n: legal.call })}
                  variant="secondary"
                  disabled={busy}
                  onPress={() => play({ type: 'call' })}
                />
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
              <RaiseSlider
                min={bounds.min}
                max={bounds.max}
                value={raiseValue}
                step={hand.bigBlind}
                onChange={setRaiseTo}
              />
              <View style={styles.step}>
                <Button
                  compact
                  label="+"
                  variant="secondary"
                  onPress={() => setRaiseTo(Math.min(bounds.max, raiseValue + hand.bigBlind))}
                />
              </View>
              <Text style={[styles.raiseValue, styles.raiseValueWide]} numberOfLines={1}>
                {raiseValue}
              </Text>
              <View style={styles.wideButton}>
                <Button
                  compact
                  label={hand.currentBet === 0 ? t('Miser') : t('Relancer')}
                  disabled={busy}
                  onPress={() => play({ type: 'raise', to: raiseValue })}
                />
              </View>
              <View style={styles.wideButton}>
                <Button
                  compact
                  label={potLimited ? t('Pot') : t('Tapis')}
                  variant="danger"
                  disabled={busy}
                  onPress={() => play({ type: 'allin' })}
                />
              </View>
            </View>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      </View>
    );
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
              <PlayingCard card={c} width={hole.length > 2 ? 30 : 42} />
            </Appear>
          ))}
        </View>
        {legal && (
          <View style={[styles.row, styles.grow]}>
            {legal.fold && (
              <Button
                compact
                label={t('Coucher')}
                variant="danger"
                disabled={busy}
                onPress={() => play({ type: 'fold' })}
              />
            )}
            {legal.check && (
              <Button
                compact
                label={t('Checker')}
                variant="secondary"
                disabled={busy}
                onPress={() => play({ type: 'check' })}
              />
            )}
            {legal.call > 0 && (
              <Button
                compact
                label={t('Suivre {n}', { n: legal.call })}
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
            label={hand.currentBet === 0 ? t('Miser') : t('Relancer')}
            disabled={busy}
            onPress={() => play({ type: 'raise', to: raiseValue })}
          />
          <Button
            compact
            label={potLimited ? t('Pot') : t('Tapis')}
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

/** A bar to drag (or click) for the raise amount, on a computer. */
function RaiseSlider({
  min,
  max,
  value,
  step,
  onChange,
}: {
  min: number;
  max: number;
  value: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const box = useRef({ left: 0, width: 1 });
  const ratio = max > min ? (value - min) / (max - min) : 1;

  function moveTo(pageX: number) {
    const r = Math.min(1, Math.max(0, (pageX - box.current.left) / box.current.width));
    // Whole steps of the big blind, except at the very end where every chip counts.
    onChange(r >= 1 ? max : Math.min(max, Math.max(min, min + Math.round((r * (max - min)) / step) * step)));
  }

  function start(e: GestureResponderEvent) {
    // The press lands on the bar itself (its children ignore the pointer), so this finds its left edge.
    box.current.left = e.nativeEvent.pageX - e.nativeEvent.locationX;
    moveTo(e.nativeEvent.pageX);
  }

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={t('Montant de la relance')}
      accessibilityValue={{ min, max, now: value }}
      onLayout={(e) => {
        box.current.width = Math.max(1, e.nativeEvent.layout.width);
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={start}
      onResponderMove={(e) => moveTo(e.nativeEvent.pageX)}
      style={styles.slider}
    >
      <View pointerEvents="none" style={styles.track}>
        <View style={[styles.trackFill, { width: `${ratio * 100}%` }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, { left: `${ratio * 100}%` }]} />
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
  panelWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cardsWide: { flexDirection: 'row', gap: 4 },
  controls: { flex: 1, gap: 10 },
  titleWide: { flex: 1, textAlign: 'left', fontSize: 17 },
  wideButton: { minWidth: 112 },
  raiseValueWide: { minWidth: 64, fontSize: 18, color: colors.gold },
  slider: { flex: 1, height: 36, justifyContent: 'center', marginHorizontal: 4, cursor: 'pointer' },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  trackFill: { height: 6, backgroundColor: colors.gold },
  thumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    marginLeft: -11,
    borderRadius: 11,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: '#fff8e1',
    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
  },
});
