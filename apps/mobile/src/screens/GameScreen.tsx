import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { type Action, type HandState, type SeatInput, applyAction, startHand } from '@appli-poker/engine';
import { ActionPanel } from '../components/ActionPanel';
import { Button } from '../components/Button';
import { HandSummary } from '../components/HandSummary';
import { Panel, PanelText } from '../components/Panel';
import { Table } from '../components/Table';
import { deviceRng } from '../rng';
import type { GameSettings } from './SetupScreen';

function deal(seats: SeatInput[], dealer: number, bigBlind: number) {
  return startHand({ seats, dealer, smallBlind: bigBlind / 2, bigBlind, rng: deviceRng });
}

/** Pass-and-play: the whole game runs on this phone, handed from player to player. */
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
  const [error, setError] = useState<string | null>(null);

  const actor = hand.toAct >= 0 ? hand.players[hand.toAct] : null;
  const remaining = hand.players.filter((p) => p.stack > 0);

  function play(action: Action) {
    if (!actor) return;
    try {
      setHand(applyAction(hand, actor.id, action));
      setRevealedFor(null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function nextHand() {
    const seats = remaining.map(({ id, name, stack }) => ({ id, name, stack }));
    // The button moves to the next player still in the game.
    const n = hand.players.length;
    let dealerId = remaining[0].id;
    for (let k = 1; k <= n; k++) {
      const p = hand.players[(hand.dealer + k) % n];
      if (p.stack > 0) {
        dealerId = p.id;
        break;
      }
    }
    setHand(deal(seats, seats.findIndex((s) => s.id === dealerId), settings.bigBlind));
    setRevealedFor(null);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Table hand={hand} />

      {actor && revealedFor !== actor.id && (
        <Panel title={`Au tour de ${actor.name}`}>
          <PanelText>Passe-lui le téléphone, les autres ne regardent pas !</PanelText>
          <Button label="Voir mes cartes" onPress={() => setRevealedFor(actor.id)} />
        </Panel>
      )}

      {actor && revealedFor === actor.id && (
        <ActionPanel
          hand={hand}
          playerId={actor.id}
          title={`${actor.name}, à toi de jouer`}
          hole={actor.hole}
          error={error}
          onAction={play}
        />
      )}

      {hand.street === 'finished' && (
        <HandSummary hand={hand}>
          {remaining.length > 1 ? (
            <Button label="Main suivante" onPress={nextHand} />
          ) : (
            <>
              <PanelText>🏆 {remaining[0]?.name} gagne la partie !</PanelText>
              <Button label="Nouvelle partie" onPress={onQuit} />
            </>
          )}
        </HandSummary>
      )}

      <View style={styles.spacer} />
      <Button label="Quitter la partie" variant="secondary" onPress={onQuit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 56 },
  spacer: { height: 16 },
});
