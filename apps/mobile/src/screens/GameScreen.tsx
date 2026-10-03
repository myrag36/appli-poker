import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  type Action,
  type HandState,
  type SeatInput,
  applyAction,
  legalActions,
  startHand,
} from '@appli-poker/engine';
import { Button } from '../components/Button';
import { PlayingCard } from '../components/PlayingCard';
import { deviceRng } from '../rng';
import { colors } from '../theme';
import type { GameSettings } from './SetupScreen';

const STREET_NAMES: Record<string, string> = {
  preflop: 'Avant le flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  finished: 'Fin de la main',
};

function deal(seats: SeatInput[], dealer: number, bigBlind: number) {
  return startHand({ seats, dealer, smallBlind: bigBlind / 2, bigBlind, rng: deviceRng });
}

export function GameScreen({ settings, onQuit }: { settings: GameSettings; onQuit: () => void }) {
  const [hand, setHand] = useState<HandState>(() =>
    deal(
      settings.names.map((name, i) => ({ id: `p${i}`, name, stack: settings.stack })),
      0,
      settings.bigBlind,
    ),
  );
  /** Id of the player who has tapped to see their cards; reset whenever the turn passes. */
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const [raiseTo, setRaiseTo] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const actor = hand.toAct >= 0 ? hand.players[hand.toAct] : null;
  const legal = actor ? legalActions(hand, actor.id) : null;
  const pot = hand.players.reduce((s, p) => s + p.totalBet, 0);
  const revealed = actor !== null && revealedFor === actor.id;
  const remaining = hand.players.filter((p) => p.stack > 0);

  const raiseBounds = legal?.raise ?? null;
  const raiseValue = raiseBounds
    ? Math.min(Math.max(raiseTo, raiseBounds.min), raiseBounds.max)
    : 0;

  function play(action: Action) {
    if (!actor) return;
    try {
      const next = applyAction(hand, actor.id, action);
      setHand(next);
      setRevealedFor(null);
      setRaiseTo(0);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function nextHand() {
    const seats = hand.players.filter((p) => p.stack > 0).map(({ id, name, stack }) => ({ id, name, stack }));
    // The button moves to the next player still in the game.
    const n = hand.players.length;
    let dealerId = hand.players[(hand.dealer + 1) % n].id;
    for (let k = 1; k <= n; k++) {
      const p = hand.players[(hand.dealer + k) % n];
      if (p.stack > 0) {
        dealerId = p.id;
        break;
      }
    }
    setHand(deal(seats, seats.findIndex((s) => s.id === dealerId), settings.bigBlind));
    setRevealedFor(null);
    setRaiseTo(0);
  }

  const winners = useMemo(() => {
    const ids = new Set(hand.pots.flatMap((p) => p.winners));
    return hand.players.filter((p) => ids.has(p.id));
  }, [hand]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.street}>{STREET_NAMES[hand.street]}</Text>
        <Text style={styles.pot}>Pot : {pot}</Text>
      </View>

      <View style={styles.board}>
        {[0, 1, 2, 3, 4].map((i) => (
          <PlayingCard key={i} card={hand.board[i]} />
        ))}
      </View>

      <View style={styles.players}>
        {hand.players.map((p, i) => {
          const shown = hand.showdown[p.id];
          return (
            <View
              key={p.id}
              style={[styles.player, i === hand.toAct && styles.playerActive, p.folded && styles.playerFolded]}
            >
              <View style={styles.flex}>
                <Text style={styles.playerName}>
                  {p.name}
                  {i === hand.dealer ? '  Ⓓ' : ''}
                </Text>
                <Text style={styles.playerInfo}>
                  {p.stack} jetons
                  {p.bet > 0 ? ` · mise ${p.bet}` : ''}
                  {p.folded ? ' · couché' : p.allIn ? ' · tapis' : ''}
                </Text>
                {shown && <Text style={styles.handName}>{shown.name}</Text>}
              </View>
              {shown && (
                <View style={styles.row}>
                  {p.hole.map((c) => (
                    <PlayingCard key={c} card={c} small />
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {actor && legal && !revealed && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Au tour de {actor.name}</Text>
          <Text style={styles.panelText}>Passe-lui le téléphone, les autres ne regardent pas !</Text>
          <Button label="Voir mes cartes" onPress={() => setRevealedFor(actor.id)} />
        </View>
      )}

      {actor && legal && revealed && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{actor.name}, à toi de jouer</Text>
          <View style={[styles.row, styles.center]}>
            {actor.hole.map((c) => (
              <PlayingCard key={c} card={c} />
            ))}
          </View>
          <View style={styles.row}>
            {legal.fold && <Button label="Se coucher" variant="danger" onPress={() => play({ type: 'fold' })} />}
            {legal.check && <Button label="Checker" variant="secondary" onPress={() => play({ type: 'check' })} />}
            {legal.call > 0 && (
              <Button label={`Suivre ${legal.call}`} variant="secondary" onPress={() => play({ type: 'call' })} />
            )}
          </View>
          {raiseBounds && (
            <>
              <View style={[styles.row, styles.center]}>
                <Button
                  label="−"
                  variant="secondary"
                  onPress={() => setRaiseTo(Math.max(raiseBounds.min, raiseValue - hand.bigBlind))}
                />
                <Text style={styles.raiseValue}>{raiseValue}</Text>
                <Button
                  label="+"
                  variant="secondary"
                  onPress={() => setRaiseTo(Math.min(raiseBounds.max, raiseValue + hand.bigBlind))}
                />
              </View>
              <View style={styles.row}>
                <Button
                  label={`${hand.currentBet === 0 ? 'Miser' : 'Relancer à'} ${raiseValue}`}
                  onPress={() => play({ type: 'raise', to: raiseValue })}
                />
                <Button label="Tapis" variant="danger" onPress={() => play({ type: 'allin' })} />
              </View>
            </>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      )}

      {hand.street === 'finished' && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>
            {winners.map((w) => w.name).join(' et ')} {winners.length > 1 ? 'remportent' : 'remporte'} le pot
          </Text>
          {hand.log.slice(-hand.pots.length).map((line, i) => (
            <Text key={i} style={styles.panelText}>
              {line}
            </Text>
          ))}
          {remaining.length > 1 ? (
            <Button label="Main suivante" onPress={nextHand} />
          ) : (
            <>
              <Text style={styles.panelTitle}>🏆 {remaining[0]?.name} gagne la partie !</Text>
              <Button label="Nouvelle partie" onPress={onQuit} />
            </>
          )}
        </View>
      )}

      <View style={styles.spacer} />
      <Button label="Quitter la partie" variant="secondary" onPress={onQuit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 56 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  street: { color: colors.muted, fontSize: 16, fontWeight: '600' },
  pot: { color: colors.gold, fontSize: 18, fontWeight: '800' },
  board: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: colors.feltDark,
    borderRadius: 60,
    borderWidth: 6,
    borderColor: colors.rail,
  },
  players: { marginTop: 16, gap: 6 },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.feltDark,
  },
  playerActive: { borderWidth: 2, borderColor: colors.gold },
  playerFolded: { opacity: 0.45 },
  playerName: { color: colors.text, fontWeight: '700', fontSize: 16 },
  playerInfo: { color: colors.muted, fontSize: 13 },
  handName: { color: colors.gold, fontSize: 13, fontWeight: '600' },
  panel: { marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: colors.feltDark, gap: 6 },
  panelTitle: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  panelText: { color: colors.muted, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  center: { justifyContent: 'center', marginVertical: 6 },
  flex: { flex: 1 },
  raiseValue: { color: colors.text, fontSize: 22, fontWeight: '800', minWidth: 80, textAlign: 'center' },
  error: { color: colors.gold, textAlign: 'center' },
  spacer: { height: 16 },
});
