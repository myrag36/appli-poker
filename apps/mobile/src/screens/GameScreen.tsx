import { useState } from 'react';
import {
  type Action,
  type HandState,
  type SeatInput,
  applyAction,
  bigBlindAt,
  blindLevel,
  startHand,
} from '@appli-poker/engine';
import { ActionPanel } from '../components/ActionPanel';
import { Button } from '../components/Button';
import { GameLayout } from '../components/GameLayout';
import { HandSummary } from '../components/HandSummary';
import { Panel, PanelText } from '../components/Panel';
import { Ranking } from '../components/Ranking';
import { Table } from '../components/Table';
import { TopBar } from '../components/TopBar';
import { useHandSounds } from '../feedback';
import { deviceRng } from '../rng';
import type { GameSettings } from './SetupScreen';

function deal(seats: SeatInput[], dealer: number, bigBlind: number) {
  return startHand({ seats, dealer, smallBlind: bigBlind / 2, bigBlind, rng: deviceRng });
}

/** Pass-and-play: the whole game runs on this phone, handed from player to player. */
export function GameScreen({ settings, onQuit }: { settings: GameSettings; onQuit: () => void }) {
  const [startedAt] = useState(() => Date.now());
  /** Final place of each player already knocked out, by name. */
  const [places, setPlaces] = useState<Record<string, number>>({});
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
  // Players knocked out in this hand share the place just behind everyone still in.
  const knockedOut = hand.street === 'finished' ? hand.players.filter((p) => p.stack === 0) : [];
  const allPlaces = {
    ...places,
    ...Object.fromEntries(knockedOut.map((p) => [p.name, remaining.length + 1])),
  };
  const level = settings.levelMinutes ? blindLevel(startedAt, Date.now(), settings.levelMinutes) : null;

  useHandSounds(hand, null);
  const avatars = Object.fromEntries(settings.avatars.map((a, i) => [`p${i}`, a]));

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
    const bigBlind = level ? bigBlindAt(settings.bigBlind, level.level) : settings.bigBlind;
    setPlaces(allPlaces);
    setHand(
      deal(
        seats,
        seats.findIndex((s) => s.id === dealerId),
        bigBlind,
      ),
    );
    setRevealedFor(null);
  }

  return (
    <GameLayout
      top={<TopBar onBack={onQuit} backLabel="← Quitter" />}
      table={({ width, height }) => (
        <Table
          hand={hand}
          maxWidth={width}
          maxHeight={height}
          nextLevelAt={level?.nextLevelAt}
          avatars={avatars}
        />
      )}
      bottom={
        <>
          {actor && revealedFor !== actor.id && (
            <Panel compact title={`Au tour de ${actor.name}`}>
              <PanelText>Passe-lui le téléphone, les autres ne regardent pas !</PanelText>
              <Button compact label="Voir mes cartes" onPress={() => setRevealedFor(actor.id)} />
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
                <Button compact label="Main suivante" onPress={nextHand} />
              ) : (
                <>
                  <PanelText>🏆 {remaining[0]?.name} gagne la partie !</PanelText>
                  <Ranking
                    entries={[
                      ...remaining.map((p) => ({ name: p.name, place: 1 })),
                      ...Object.entries(allPlaces).map(([name, place]) => ({ name, place })),
                    ]}
                  />
                  <Button compact label="Nouvelle partie" onPress={onQuit} />
                </>
              )}
            </HandSummary>
          )}
        </>
      }
    />
  );
}
