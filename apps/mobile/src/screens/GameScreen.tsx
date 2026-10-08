import { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import {
  type Action,
  type HandState,
  type SeatInput,
  type Variant,
  applyAction,
  type Rng,
  bigBlindAt,
  blindLevel,
  chooseBotAction,
  startHand,
} from '@appli-poker/engine';
import { ActionPanel } from '../components/ActionPanel';
import { Button } from '../components/Button';
import { GameLayout } from '../components/GameLayout';
import { reportLocalGame, useFeat } from '../online/progress';
import { HandSummary } from '../components/HandSummary';
import { Panel, PanelText } from '../components/Panel';
import { PlayingCard } from '../components/PlayingCard';
import { Ranking } from '../components/Ranking';
import { Table } from '../components/Table';
import { TopBar } from '../components/TopBar';
import { useHandSounds } from '../feedback';
import { deviceRng } from '../rng';
import type { GameSettings } from './SetupScreen';
import { useDesktop } from '../layout';
import { colors } from '../theme';
import { t } from '../i18n';
import { tMessage } from '../online/messages';

/** How long a robot seems to think before playing, in ms. */
const BOT_DELAY = 1100;
/** Robots only need ordinary randomness to vary their play. */
const botRng: Rng = (max) => Math.floor(Math.random() * max);

function deal(seats: SeatInput[], dealer: number, bigBlind: number, variant: Variant) {
  return startHand({ seats, dealer, smallBlind: bigBlind / 2, bigBlind, rng: deviceRng, variant });
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
      settings.variant,
    ),
  );
  /** Id of the player who has tapped to see their cards; reset whenever the turn passes. */
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const desktop = useDesktop();

  const actor = hand.toAct >= 0 ? hand.players[hand.toAct] : null;
  const isBot = (id: string) => settings.bots[Number(id.slice(1))] === true;
  const humans = settings.names.map((_, i) => `p${i}`).filter((id) => !isBot(id));
  // Alone against robots, nobody else looks at the screen: no need to hide the cards.
  const solo = humans.length === 1 ? humans[0] : null;
  // A pot won by a person with four of a kind or better (category 7 and up).
  useFeat(
    'carre',
    hand.pots.some((pot) => pot.winners.some((w) => !isBot(w) && (hand.showdown[w]?.score[0] ?? 0) >= 7)),
  );
  const botTurn = actor !== null && isBot(actor.id);
  // Alone against robots, my cards stay in view while they play.
  const mine = solo ? hand.players.find((p) => p.id === solo && !p.folded) : undefined;
  const remaining = hand.players.filter((p) => p.stack > 0);
  // Players knocked out in this hand share the place just behind everyone still in.
  const knockedOut = hand.street === 'finished' ? hand.players.filter((p) => p.stack === 0) : [];
  const allPlaces = {
    ...places,
    ...Object.fromEntries(knockedOut.map((p) => [p.name, remaining.length + 1])),
  };
  const level = settings.levelMinutes ? blindLevel(startedAt, Date.now(), settings.levelMinutes) : null;

  useHandSounds(hand, null);
  // The game is over once one player has every chip: it gives experience to this phone.
  const gameOver = hand.street === 'finished' && remaining.length === 1;
  useEffect(() => {
    if (gameOver) reportLocalGame('poker', !isBot(remaining[0].id));
  }, [gameOver]);
  const avatars = Object.fromEntries(settings.avatars.map((a, i) => [`p${i}`, a]));

  function play(action: Action) {
    if (!actor) return;
    try {
      setHand(applyAction(hand, actor.id, action));
      setRevealedFor(null);
      setError(null);
    } catch (e) {
      setError(tMessage((e as Error).message));
    }
  }

  useEffect(() => {
    if (!actor || !isBot(actor.id)) return;
    const id = setTimeout(() => {
      setHand((current) => {
        const bot = current.toAct >= 0 ? current.players[current.toAct] : null;
        if (!bot || bot.id !== actor.id) return current;
        return applyAction(current, bot.id, chooseBotAction(current, bot.id, botRng));
      });
    }, BOT_DELAY);
    return () => clearTimeout(id);
    // The hand object changes after every move, which is what restarts the robot's turn.
  }, [hand]);

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
        settings.variant,
      ),
    );
    setRevealedFor(null);
  }

  return (
    <GameLayout
      top={<TopBar onBack={onQuit} backLabel={t('← Quitter')} />}
      table={({ width, height }) => (
        <Table
          hand={hand}
          meId={solo ?? undefined}
          maxWidth={width}
          maxHeight={height}
          nextLevelAt={level?.nextLevelAt}
          avatars={avatars}
          wide={desktop}
        />
      )}
      bottom={
        <>
          {botTurn && (
            <View style={styles.botPanel}>
              {mine && (
                <View style={styles.cards}>
                  {mine.hole.map((c) => (
                    <PlayingCard
                      key={c}
                      card={c}
                      // As big as in the action bar, so the cards keep their size from turn to turn.
                      width={(mine.hole.length > 2 ? 30 : 42) * (desktop ? 1.43 : 1)}
                    />
                  ))}
                </View>
              )}
              <Text style={styles.botText}>{t('🤖 {name} réfléchit…', { name: actor.name })}</Text>
            </View>
          )}

          {actor && !botTurn && !solo && revealedFor !== actor.id && (
            <Panel compact title={t('Au tour de {name}', { name: actor.name })}>
              <PanelText>{t('Passe-lui le téléphone, les autres ne regardent pas !')}</PanelText>
              <Button compact label={t('Voir mes cartes')} onPress={() => setRevealedFor(actor.id)} />
            </Panel>
          )}

          {actor && !botTurn && (solo || revealedFor === actor.id) && (
            <ActionPanel
              // A fresh panel for every turn, so a raise amount never carries over.
              key={hand.log.length}
              hand={hand}
              playerId={actor.id}
              title={solo ? t('À toi de jouer') : t('{name}, à toi de jouer', { name: actor.name })}
              hole={actor.hole}
              error={error}
              onAction={play}
            />
          )}

          {hand.street === 'finished' && (
            <HandSummary hand={hand}>
              {remaining.length > 1 ? (
                <Button compact label={t('Main suivante')} onPress={nextHand} />
              ) : (
                <>
                  <PanelText>{t('🏆 {name} gagne la partie !', { name: remaining[0]?.name })}</PanelText>
                  <Ranking
                    entries={[
                      ...remaining.map((p) => ({ name: p.name, place: 1 })),
                      ...Object.entries(allPlaces).map(([name, place]) => ({ name, place })),
                    ]}
                  />
                  <Button compact label={t('Nouvelle partie')} onPress={onQuit} />
                </>
              )}
            </HandSummary>
          )}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  botPanel: {
    flexDirection: 'row',
    gap: 12,
    minHeight: 79,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  botText: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center' },
  cards: { flexDirection: 'row', gap: 2 },
});
