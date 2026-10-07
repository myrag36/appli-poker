import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  type Avatar,
  type Card,
  type RamiMeld,
  type RamiMove,
  type RamiState,
  RAMI_OPENING,
  botName,
  defaultAvatar,
  ramiAddToMeld,
  ramiApply,
  ramiBotMove,
  ramiIsJoker,
  ramiLayout,
  ramiMeldPoints,
  ramiNewGame,
  ramiNextRound,
  ramiRanking,
  ramiSortHand,
  ramiSwapJoker,
} from '@appli-poker/engine';
import { AvatarBadge, AvatarPicker } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { reportLocalGame } from '../online/progress';
import { RulesButton } from '../components/Rules';
import { RAMI_RULES } from '../rules';
import { GameLayout } from '../components/GameLayout';
import { Pill } from '../components/LevelPicker';
import { Appear, FloatUp } from '../components/Motion';
import { PlayingCard } from '../components/PlayingCard';
import { TopBar } from '../components/TopBar';
import { sounds } from '../feedback';
import { deviceRng } from '../rng';
import { colors, gradients, seatColors, shadow } from '../theme';

/** How long a robot seems to think before each step, in ms. */
const BOT_DELAY = 850;
const ME = 0;
const MEDALS = ['🥇', '🥈', '🥉'];
const SUIT_SYMBOLS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

interface Settings {
  names: string[];
  avatars: Avatar[];
  target: number;
}

/** "10♥", "R♠"… as people say them; "joker" for a joker. */
function cardLabel(card: Card): string {
  if (ramiIsJoker(card)) return 'joker';
  const r = card[0];
  const rank = r === 'T' ? '10' : r === 'J' ? 'V' : r === 'Q' ? 'D' : r === 'K' ? 'R' : r;
  return rank + SUIT_SYMBOLS[card[1]];
}

export function RamiScreen({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [last, setLast] = useState<Settings | null>(null);
  const [round, setRound] = useState(0);
  if (!settings)
    return (
      <RamiSetup
        initial={last}
        onBack={onBack}
        onStart={(s) => {
          setLast(s);
          setSettings(s);
        }}
      />
    );
  return (
    <RamiGame
      key={round}
      settings={settings}
      onReplay={() => setRound(round + 1)}
      onSettings={() => setSettings(null)}
      onBack={onBack}
    />
  );
}

// ------------------------------------------------------------------ Setup

function RamiSetup({
  initial,
  onStart,
  onBack,
}: {
  initial: Settings | null;
  onStart: (s: Settings) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState(initial && initial.names[0] !== 'Toi' ? initial.names[0] : '');
  const [avatar, setAvatar] = useState<Avatar>(initial?.avatars[0] ?? defaultAvatar(0));
  const [picking, setPicking] = useState(false);
  const [robots, setRobots] = useState(initial ? initial.names.length - 1 : 2);
  const [target, setTarget] = useState(initial?.target ?? 300);

  const me = name.trim() || 'Toi';
  const names = [me];
  for (let i = 0; i < robots; i++) names.push(botName(names));
  const robot = (seat: number): Avatar => ({ emoji: '🤖', color: seatColors[seat] });

  return (
    <ScrollView contentContainerStyle={styles.setup} keyboardShouldPersistTaps="handled">
      <View style={styles.titleCards}>
        {['7d', '8d', 'Xr', '9d'].map((c, i) => (
          <View
            key={c}
            style={{ transform: [{ rotate: `${(i - 1.5) * 10}deg` }, { translateY: Math.abs(i - 1.5) * 5 }] }}
          >
            <PlayingCard card={c} width={40} />
          </View>
        ))}
      </View>
      <Text style={styles.title}>Rami</Text>
      <Text style={styles.subtitle}>Pose tes combinaisons et vide ta main le premier.</Text>
      <RulesButton rules={RAMI_RULES} />

      <Text style={styles.section}>Toi</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Changer ton avatar"
          onPress={() => setPicking(!picking)}
        >
          <AvatarBadge avatar={avatar} size={40} />
        </Pressable>
        <TextInput
          style={[styles.input, styles.flex]}
          placeholder="Ton prénom"
          placeholderTextColor={colors.muted}
          value={name}
          maxLength={14}
          onChangeText={setName}
        />
      </View>
      {picking && <AvatarPicker value={avatar} onChange={setAvatar} />}

      <Text style={styles.section}>Adversaires</Text>
      <View style={styles.pills}>
        {[1, 2, 3].map((n) => (
          <Pill
            key={n}
            label={`${n} robot${n > 1 ? 's' : ''}`}
            active={robots === n}
            onPress={() => setRobots(n)}
          />
        ))}
      </View>
      {names.slice(1).map((n, i) => (
        <View key={n} style={styles.row}>
          <AvatarBadge avatar={robot(i + 1)} size={40} />
          <View style={[styles.input, styles.flex, styles.botRow]}>
            <Text style={styles.botName}>{n}</Text>
            <Text style={styles.botTag}>Robot</Text>
          </View>
        </View>
      ))}

      <Text style={styles.section}>Partie en</Text>
      <View style={styles.pills}>
        {[150, 300, 500].map((t) => (
          <Pill key={t} label={`${t} points`} active={target === t} onPress={() => setTarget(t)} />
        ))}
      </View>
      <Text style={styles.hint}>
        Les cartes qui restent en main sont des points de pénalité. Dès que quelqu’un atteint {target}, la
        partie s’arrête : le plus petit score gagne.
      </Text>

      <View style={styles.spacer} />
      <Button
        label="Lancer la partie"
        onPress={() =>
          onStart({
            names,
            avatars: [avatar, ...names.slice(1).map((_, i) => robot(i + 1))],
            target,
          })
        }
      />
      <Button label="Retour" variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

// ------------------------------------------------------------------ Game

function RamiGame({
  settings,
  onReplay,
  onSettings,
  onBack,
}: {
  settings: Settings;
  onReplay: () => void;
  onSettings: () => void;
  onBack: () => void;
}) {
  const [game, setGame] = useState<RamiState>(() =>
    ramiNewGame({
      players: settings.names.map((name, i) => ({ name, bot: i !== ME })),
      target: settings.target,
      rng: deviceRng,
    }),
  );
  const [selected, setSelected] = useState<Card[]>([]);
  /** Melds put aside before opening, until they reach 51 points together. */
  const [staged, setStaged] = useState<Card[][]>([]);
  const [sortBy, setSortBy] = useState<'suit' | 'rank'>('suit');
  const [error, setError] = useState<string | null>(null);
  /** The card I just drew, shown with a glow. */
  const [fresh, setFresh] = useState<Card | null>(null);
  const names = settings.names;

  const active = game.phase === 'draw' || game.phase === 'play';
  const myTurn = active && game.current === ME;
  const robotTurn = active && game.current !== ME;
  const myPlay = myTurn && game.phase === 'play';
  const opened = game.opened[ME];

  function apply(move: RamiMove) {
    try {
      const next = ramiApply(game, move, deviceRng);
      if (move.type === 'draw' || move.type === 'take') {
        const added = next.hands[ME].find((c) => !game.hands[ME].includes(c));
        setFresh(added ?? null);
      }
      if (move.type === 'swap') setFresh(next.hands[ME].find((c) => !game.hands[ME].includes(c)) ?? null);
      afterMove(game, next, move);
      setSelected([]);
      setError(null);
      setGame(next);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function afterMove(before: RamiState, next: RamiState, move: RamiMove) {
    if (move.type === 'meld' || move.type === 'add' || move.type === 'swap') sounds.chips();
    else sounds.card();
    if (next.phase === 'gameOver' && before.phase !== 'gameOver') {
      const won = ramiRanking(next)[0].score === next.scores[ME];
      if (won) sounds.win();
      reportLocalGame('rami', won);
    } else if (next.phase === 'roundOver' && next.result?.winner === ME) sounds.win();
  }

  // Robots play one step at a time so everyone can follow.
  useEffect(() => {
    if (!robotTurn) return;
    const move = ramiBotMove(game);
    const delay = move.type === 'meld' ? BOT_DELAY * 1.4 : move.type === 'draw' ? BOT_DELAY * 0.8 : BOT_DELAY;
    const id = setTimeout(() => {
      const next = ramiApply(game, move, deviceRng);
      afterMove(game, next, move);
      setGame(next);
    }, delay);
    return () => clearTimeout(id);
  }, [game, robotTurn]);

  const wasMyTurn = useRef(false);
  useEffect(() => {
    if (myTurn && !wasMyTurn.current) sounds.myTurn();
    wasMyTurn.current = myTurn;
    if (!myTurn) {
      setStaged([]);
      setSelected([]);
    }
  }, [myTurn]);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 3200);
    return () => clearTimeout(id);
  }, [error]);

  const stagedCards = staged.flat();
  const stagedPoints = staged.reduce((s, m) => s + ramiMeldPoints(ramiLayout(m)!), 0);
  const hand = ramiSortHand(game.hands[ME], sortBy).filter((c) => !stagedCards.includes(c));
  const layout = selected.length >= 3 ? ramiLayout(selected) : null;
  /** Melds on the table the selection can go on (adding to them, or winning their joker back). */
  const targets =
    myPlay && opened && selected.length > 0
      ? game.melds.filter(
          (m) =>
            ramiAddToMeld(m, selected) !== null ||
            (selected.length === 1 && ramiSwapJoker(m, selected[0]) !== null),
        )
      : [];

  function toggle(card: Card) {
    setSelected(selected.includes(card) ? selected.filter((c) => c !== card) : [...selected, card]);
  }

  function lay() {
    if (!layout) return;
    if (opened) return apply({ type: 'meld', melds: [selected] });
    const all = [...staged, selected];
    const total = stagedPoints + ramiMeldPoints(layout);
    if (total >= RAMI_OPENING) {
      setStaged([]);
      apply({ type: 'meld', melds: all });
    } else {
      setStaged(all);
      setSelected([]);
      sounds.card();
    }
  }

  function onMeld(meld: RamiMeld) {
    if (!myPlay || selected.length === 0) return;
    if (!opened) return setError(`Ouvre d’abord avec ${RAMI_OPENING} points`);
    if (selected.length === 1 && ramiSwapJoker(meld, selected[0]))
      return apply({ type: 'swap', meld: meld.id, card: selected[0] });
    apply({ type: 'add', meld: meld.id, cards: selected });
  }

  function discard() {
    if (selected.length !== 1) return;
    setStaged([]);
    apply({ type: 'discard', card: selected[0] });
  }

  // ---- What to tell the player.
  let prompt: string;
  if (game.phase === 'roundOver' || game.phase === 'gameOver')
    prompt = game.phase === 'gameOver' ? 'Partie terminée' : 'Fin de la manche';
  else if (robotTurn) prompt = `🤖 ${names[game.current]} joue…`;
  else if (game.phase === 'draw') prompt = 'À toi : pioche ou prends la défausse';
  else if (staged.length > 0 && !layout)
    prompt = `Ouverture : ${stagedPoints}/${RAMI_OPENING} pts, encore ${RAMI_OPENING - stagedPoints}`;
  else if (layout)
    prompt =
      !opened && stagedPoints + ramiMeldPoints(layout) < RAMI_OPENING
        ? `${ramiMeldPoints(layout)} pts : mets-la de côté avec Poser`
        : 'Combinaison valable : appuie sur Poser';
  else if (targets.length > 0) prompt = 'Touche une combinaison qui brille';
  else if (selected.length === 1) prompt = 'Défausse-la pour finir ton tour';
  else if (game.turns === 0 && game.hands[ME].length > 13) prompt = 'Tu commences : pose ou défausse';
  else
    prompt = opened ? 'Pose, complète ou défausse' : `Choisis tes cartes (${RAMI_OPENING} pts pour ouvrir)`;

  return (
    <GameLayout
      top={
        <>
          <TopBar onBack={onBack} backLabel="← Quitter">
            <Text style={styles.roundText}>Manche {game.round}</Text>
            <Text style={styles.targetText}>· {game.target} pts</Text>
          </TopBar>
          <Scoreboard game={game} names={names} avatars={settings.avatars} />
        </>
      }
      table={({ width, height }) => (
        <View style={[styles.rail, { width: Math.min(width, 520), height }]}>
          <LinearGradient colors={gradients.wood} style={StyleSheet.absoluteFill} />
          <View style={styles.felt}>
            <LinearGradient colors={gradients.felt} style={StyleSheet.absoluteFill} />
            <Piles
              game={game}
              names={names}
              canDraw={myTurn && game.phase === 'draw'}
              onDraw={() => apply({ type: 'draw' })}
              onTake={() => apply({ type: 'take' })}
            />
            <Melds
              melds={game.melds}
              avatars={settings.avatars}
              targets={targets}
              staged={staged}
              stagedPoints={stagedPoints}
              onMeld={onMeld}
              onUnstage={() => setStaged([])}
              width={Math.min(width, 520) - 40}
            />
            {(game.phase === 'roundOver' || game.phase === 'gameOver') && (
              <View style={styles.overlay}>
                {game.phase === 'gameOver' ? (
                  <FinalPanel game={game} avatars={settings.avatars}>
                    <View style={styles.finalButtons}>
                      <View style={styles.flex}>
                        <Button compact label="Rejouer" onPress={onReplay} />
                      </View>
                      <View style={styles.flex}>
                        <Button compact variant="secondary" label="Réglages" onPress={onSettings} />
                      </View>
                    </View>
                    <Button compact variant="secondary" label="Retour aux jeux" onPress={onBack} />
                  </FinalPanel>
                ) : (
                  <RoundPanel game={game} avatars={settings.avatars}>
                    <Button
                      compact
                      label="Manche suivante"
                      onPress={() => {
                        setFresh(null);
                        setGame((g) => (g.phase === 'roundOver' ? ramiNextRound(g, deviceRng) : g));
                      }}
                    />
                  </RoundPanel>
                )}
              </View>
            )}
          </View>
        </View>
      )}
      bottom={
        <>
          <View style={[styles.prompt, myTurn && styles.promptMine, error !== null && styles.promptError]}>
            <Text
              style={[
                styles.promptText,
                myTurn && styles.promptTextMine,
                error !== null && styles.promptTextError,
              ]}
              numberOfLines={2}
            >
              {error ?? prompt}
            </Text>
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Trier"
              onPress={() => setSortBy(sortBy === 'suit' ? 'rank' : 'suit')}
              style={({ pressed }) => [styles.sort, pressed && styles.pressed]}
            >
              <Text style={styles.sortIcon}>⇅</Text>
              <Text style={styles.sortText}>{sortBy === 'suit' ? 'Couleur' : 'Valeur'}</Text>
            </Pressable>
            <View style={styles.flex}>
              <Button
                compact
                label={layout ? `Poser · ${ramiMeldPoints(layout)}` : 'Poser'}
                disabled={!myPlay || !layout}
                onPress={lay}
              />
            </View>
            <View style={styles.flex}>
              <Button
                compact
                variant="secondary"
                label="Défausser"
                disabled={!myPlay || selected.length !== 1}
                onPress={discard}
              />
            </View>
          </View>
          <Hand hand={hand} selected={selected} fresh={fresh} enabled={myPlay} onToggle={toggle} />
        </>
      }
    />
  );
}

// ------------------------------------------------------------------ Pieces

function Scoreboard({ game, names, avatars }: { game: RamiState; names: string[]; avatars: Avatar[] }) {
  const active = game.phase === 'draw' || game.phase === 'play';
  return (
    <View style={styles.board}>
      {names.map((name, i) => {
        const turn = active && game.current === i;
        return (
          <View key={i} style={[styles.boardCell, turn && styles.boardActive]}>
            <View>
              <AvatarBadge avatar={avatars[i]} size={22} />
              {game.opened[i] && (
                <View style={styles.openedDot}>
                  <Text style={styles.openedDotText}>✓</Text>
                </View>
              )}
            </View>
            <View style={styles.boardText}>
              <Text style={[styles.boardName, turn && styles.boardNameActive]} numberOfLines={1}>
                {i === ME ? 'Toi' : name}
              </Text>
              <View style={styles.boardLine}>
                <Text style={styles.boardScore} numberOfLines={1}>
                  {game.scores[i]}
                </Text>
                <View style={styles.boardCount}>
                  <View style={styles.boardBack} />
                  <Text style={styles.boardCards}>{game.hands[i].length}</Text>
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Stock and discard pile, with what just happened beside them. */
function Piles({
  game,
  names,
  canDraw,
  onDraw,
  onTake,
}: {
  game: RamiState;
  names: string[];
  canDraw: boolean;
  onDraw: () => void;
  onTake: () => void;
}) {
  const top = game.discard[game.discard.length - 1];
  const ev = game.last;
  let text = '';
  if (ev) {
    const who = ev.player === ME ? 'Tu' : names[ev.player];
    const me = ev.player === ME;
    if (ev.type === 'draw') text = me ? 'Tu as pioché' : `${who} pioche`;
    else if (ev.type === 'reshuffle') text = 'Pioche vide : la défausse est remélangée';
    else if (ev.type === 'take') text = `${who} ${me ? 'prends' : 'prend'} le ${cardLabel(ev.cards[0])}`;
    else if (ev.type === 'meld')
      text = ev.opening
        ? `${who} ${me ? 'ouvres' : 'ouvre'} avec ${ev.points} points !`
        : `${who} ${me ? 'poses' : 'pose'} ${ev.cards.length} cartes`;
    else if (ev.type === 'add')
      text = `${who} ${me ? 'complètes' : 'complète'} avec ${ev.cards.map(cardLabel).join(' ')}`;
    else if (ev.type === 'swap') text = `${who} ${me ? 'récupères' : 'récupère'} un joker !`;
    else if (ev.type === 'discard')
      text = `${who} ${me ? 'défausses' : 'défausse'} le ${cardLabel(ev.cards[0])}`;
  }
  const cw = 50;
  return (
    <View style={styles.piles}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Piocher"
        disabled={!canDraw}
        onPress={onDraw}
        style={[styles.pile, canDraw && styles.pileReady]}
      >
        {game.stock.length > 0 ? (
          <View>
            {game.stock.length > 1 && (
              <View style={styles.stockUnder}>
                <PlayingCard card="As" hidden width={cw} />
              </View>
            )}
            <PlayingCard card="As" hidden width={cw} />
          </View>
        ) : (
          <PlayingCard width={cw} />
        )}
        <Text style={styles.pileLabel}>Pioche · {game.stock.length}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Prendre la défausse"
        disabled={!canDraw || !top}
        onPress={onTake}
        style={[styles.pile, canDraw && top && styles.pileReady]}
      >
        {top ? (
          <Appear key={`${top}-${game.discard.length}`} from={-14}>
            <PlayingCard card={top} width={cw} />
          </Appear>
        ) : (
          <PlayingCard width={cw} />
        )}
        <Text style={styles.pileLabel}>Défausse</Text>
      </Pressable>
      <View style={styles.event}>
        {ev && (
          <Appear key={`${game.round}-${game.turns}-${ev.type}-${ev.cards.join('')}`} from={-8}>
            <Text style={styles.eventText} numberOfLines={3}>
              {text}
            </Text>
          </Appear>
        )}
        {ev?.type === 'swap' && (
          <FloatUp key={`swap-${game.turns}`} style={styles.float}>
            <Text style={styles.floatText}>🤡 Joker !</Text>
          </FloatUp>
        )}
        {ev?.type === 'meld' && ev.opening && (
          <FloatUp key={`open-${game.round}-${ev.player}`} style={styles.float}>
            <Text style={styles.floatText}>Ouverture !</Text>
          </FloatUp>
        )}
      </View>
    </View>
  );
}

/** The melds on the table, wrapped in rows; the ones my selection fits glow and can be tapped. */
function Melds({
  melds,
  avatars,
  targets,
  staged,
  stagedPoints,
  onMeld,
  onUnstage,
  width,
}: {
  melds: RamiMeld[];
  avatars: Avatar[];
  targets: RamiMeld[];
  staged: Card[][];
  stagedPoints: number;
  onMeld: (m: RamiMeld) => void;
  onUnstage: () => void;
  width: number;
}) {
  const cw = 34;
  const step = 17;
  return (
    <ScrollView style={styles.meldScroll} contentContainerStyle={styles.meldWrap}>
      {staged.length > 0 && (
        <Appear style={[styles.staged, { width }]}>
          <View style={styles.stagedHead}>
            <Text style={styles.stagedTitle}>
              Ta pose : {stagedPoints} / {RAMI_OPENING} pts
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reprendre mes cartes"
              onPress={onUnstage}
            >
              <Text style={styles.stagedCancel}>✕ Reprendre</Text>
            </Pressable>
          </View>
          <View style={styles.stagedRow}>
            {staged.map((m, i) => (
              <MeldCards key={i} cards={ramiLayout(m)!.cards} cw={cw} step={step} />
            ))}
          </View>
        </Appear>
      )}
      {melds.length === 0 && staged.length === 0 && (
        <Text style={styles.emptyTable}>Aucune combinaison posée pour l’instant</Text>
      )}
      {melds.map((m) => {
        const fits = targets.some((t) => t.id === m.id);
        return (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            accessibilityLabel={`Combinaison ${m.cards.map(cardLabel).join(' ')}`}
            disabled={!fits}
            onPress={() => onMeld(m)}
            style={[styles.meld, fits && styles.meldFits]}
          >
            <View style={[styles.meldOwner, { backgroundColor: avatars[m.owner]?.color ?? colors.gold }]} />
            <Appear key={m.cards.length} from={-6}>
              <MeldCards cards={m.cards} cw={cw} step={step} />
            </Appear>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function MeldCards({ cards, cw, step }: { cards: Card[]; cw: number; step: number }) {
  return (
    <View style={styles.meldCards}>
      {cards.map((c, i) => (
        <View key={c} style={{ marginLeft: i === 0 ? 0 : step - cw - 4 }}>
          <PlayingCard card={c} width={cw} />
        </View>
      ))}
    </View>
  );
}

/** My hand: two rows when it is long, every card tappable; selected cards rise. */
function Hand({
  hand,
  selected,
  fresh,
  enabled,
  onToggle,
}: {
  hand: Card[];
  selected: Card[];
  fresh: Card | null;
  enabled: boolean;
  onToggle: (c: Card) => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const avail = Math.min(screenWidth, 520) - 24;
  // A hand holds 14 cards at most: two rows of 7, always the same size so nothing jumps.
  const perRow = 7;
  const gap = 3;
  const cw = Math.min(60, Math.floor((avail - (perRow - 1) * gap) / perRow) - 4);
  const rows: Card[][] = [];
  const split = hand.length > perRow ? Math.ceil(hand.length / 2) : perRow;
  for (let i = 0; i < hand.length; i += split) rows.push(hand.slice(i, i + split));
  const ch = Math.round(cw * 1.4);
  return (
    <View style={[styles.hand, { height: 2 * (ch + 4) + 16 }]}>
      {rows.map((row, r) => (
        <View key={r} style={[styles.handRow, { gap }]}>
          {row.map((c) => {
            const on = selected.includes(c);
            return (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityLabel={`Carte ${cardLabel(c)}`}
                disabled={!enabled}
                onPress={() => onToggle(c)}
                style={[styles.handCard, on && styles.handCardOn, c === fresh && !on && styles.handCardFresh]}
              >
                <PlayingCard card={c} width={cw} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function RoundPanel({
  game,
  avatars,
  children,
}: {
  game: RamiState;
  avatars: Avatar[];
  children: ReactNode;
}) {
  const r = game.result!;
  const title =
    r.winner === null
      ? 'Manche bloquée'
      : r.winner === ME
        ? 'Tu gagnes la manche ! 🎉'
        : `${game.players[r.winner].name} gagne la manche`;
  return (
    <Appear>
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>{title}</Text>
        {r.sec && (
          <Text style={styles.summaryNote}>Rami sec : tout posé d’un coup, pénalités doublées !</Text>
        )}
        {game.players.map((p, i) => (
          <View key={i} style={[styles.resultRow, i === r.winner && styles.resultRowWin]}>
            <AvatarBadge avatar={avatars[i]} size={22} />
            <View style={styles.flex}>
              <View style={styles.resultNameLine}>
                <Text style={styles.resultName} numberOfLines={1}>
                  {i === ME ? 'Toi' : p.name}
                </Text>
                {!game.opened[i] && i !== r.winner && <Text style={styles.resultTag}>pas ouvert</Text>}
              </View>
              {r.hands[i].length > 0 && (
                <View style={styles.resultCards}>
                  {r.hands[i].slice(0, 10).map((c, k) => (
                    <View key={c} style={{ marginLeft: k === 0 ? 0 : -12 }}>
                      <PlayingCard card={c} width={22} />
                    </View>
                  ))}
                  {r.hands[i].length > 10 && <Text style={styles.resultMore}>+{r.hands[i].length - 10}</Text>}
                </View>
              )}
            </View>
            <Text style={[styles.resultPenalty, r.penalties[i] === 0 && styles.resultZero]}>
              {r.penalties[i] === 0 ? '0' : `+${r.penalties[i]}`}
            </Text>
            <Text style={styles.resultTotal}>{game.scores[i]}</Text>
          </View>
        ))}
        {children}
      </View>
    </Appear>
  );
}

function FinalPanel({
  game,
  avatars,
  children,
}: {
  game: RamiState;
  avatars: Avatar[];
  children: ReactNode;
}) {
  const ranking = ramiRanking(game);
  const won = ranking[0].score === game.scores[ME];
  const winners = ranking.filter((r) => r.place === 1);
  const title = won
    ? winners.length > 1
      ? 'Égalité en tête !'
      : 'Tu gagnes la partie !'
    : `${winners[0].name} gagne la partie`;
  const r = game.result!;
  return (
    <Appear>
      <View style={styles.summary}>
        <Text style={styles.trophy}>{won ? '🏆' : '😢'}</Text>
        <Text style={styles.finalTitle}>{title}</Text>
        <Text style={styles.summaryNote}>
          {game.round} manche{game.round > 1 ? 's' : ''} ·{' '}
          {r.winner === null
            ? 'dernière manche bloquée'
            : `dernière manche pour ${r.winner === ME ? 'toi' : game.players[r.winner].name}`}
        </Text>
        {ranking.map((row) => (
          <View key={row.player} style={[styles.podiumRow, row.place === 1 && styles.podiumFirst]}>
            <Text style={styles.podiumPlace}>{MEDALS[row.place - 1] ?? `${row.place}e`}</Text>
            <AvatarBadge avatar={avatars[row.player]} size={24} />
            <Text style={[styles.podiumName, row.place === 1 && styles.podiumNameFirst]} numberOfLines={1}>
              {row.player === ME ? 'Toi' : row.name}
            </Text>
            <Text style={styles.podiumScore}>{row.score}</Text>
          </View>
        ))}
        {children}
      </View>
    </Appear>
  );
}

// ------------------------------------------------------------------ Styles

const styles = StyleSheet.create({
  // Setup
  setup: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 30,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  titleCards: { flexDirection: 'row', justifyContent: 'center', marginBottom: 8, height: 64 },
  title: { color: colors.gold, fontSize: 34, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.muted, textAlign: 'center', marginTop: 4, fontSize: 14 },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 18, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  input: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginVertical: 4,
  },
  botRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  botName: { color: colors.text, fontSize: 16 },
  botTag: { color: colors.gold, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  pills: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  hint: { color: colors.muted, marginTop: 8, fontSize: 13 },
  spacer: { height: 20 },

  // Top
  roundText: { color: colors.gold, fontSize: 15, fontWeight: '900' },
  targetText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  board: { flexDirection: 'row', gap: 5, marginTop: 6, marginBottom: 6 },
  boardCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    minWidth: 0,
  },
  boardActive: { borderColor: colors.gold, boxShadow: '0 0 10px rgba(255, 193, 7, 0.55)' },
  boardText: { flex: 1, minWidth: 0 },
  boardName: { color: colors.muted, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  boardNameActive: { color: colors.gold },
  boardLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2 },
  boardCount: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  boardBack: {
    width: 7,
    height: 10,
    borderRadius: 1.5,
    backgroundColor: '#9b2335',
    borderWidth: 1,
    borderColor: '#fff',
  },
  boardScore: { color: colors.text, fontSize: 14, fontWeight: '900', flexShrink: 1 },
  boardCards: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  openedDot: {
    position: 'absolute',
    left: -4,
    top: -4,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#2fbf71',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  openedDotText: { color: '#fff', fontSize: 8, fontWeight: '900', lineHeight: 10 },

  // Table
  rail: {
    borderRadius: 30,
    padding: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.railBorder,
    backgroundColor: colors.rail,
    boxShadow: '0 10px 30px rgba(0,0,0,0.6), inset 0 2px 3px rgba(255,220,170,0.35)',
  },
  felt: {
    flex: 1,
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.feltBorder,
    backgroundColor: colors.felt,
    boxShadow: 'inset 0 6px 18px rgba(0,0,0,0.55)',
  },
  piles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 213, 120, 0.18)',
  },
  pile: { alignItems: 'center', padding: 3, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  pileReady: { borderColor: colors.gold, boxShadow: '0 0 12px rgba(255, 193, 7, 0.7)' },
  stockUnder: { position: 'absolute', top: -3, left: 3 },
  pileLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800', marginTop: 3 },
  event: { flex: 1, justifyContent: 'center', minHeight: 60 },
  eventText: { color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  float: { position: 'absolute', alignSelf: 'center', top: -6 },
  floatText: {
    color: colors.onGold,
    backgroundColor: colors.gold,
    fontWeight: '900',
    fontSize: 14,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  meldScroll: { flex: 1 },
  meldWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 10,
    justifyContent: 'center',
  },
  emptyTable: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 30,
    textAlign: 'center',
  },
  meld: {
    paddingHorizontal: 4,
    paddingTop: 5,
    paddingBottom: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  meldFits: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(255, 193, 7, 0.18)',
    boxShadow: '0 0 12px rgba(255, 193, 7, 0.8)',
  },
  meldOwner: { position: 'absolute', top: 2, left: 8, right: 8, height: 2, borderRadius: 1 },
  meldCards: { flexDirection: 'row' },
  staged: {
    padding: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.gold,
    backgroundColor: 'rgba(0,0,0,0.3)',
    gap: 6,
  },
  stagedHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stagedTitle: { color: colors.gold, fontSize: 13, fontWeight: '900' },
  stagedCancel: { color: colors.text, fontSize: 12, fontWeight: '700' },
  stagedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    zIndex: 20,
  },

  // Bottom
  prompt: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    maxWidth: '100%',
  },
  promptMine: { backgroundColor: 'rgba(0,0,0,0.5)', borderColor: colors.gold },
  promptError: { borderColor: colors.danger, backgroundColor: 'rgba(80,0,0,0.6)' },
  promptText: { color: colors.text, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  promptTextMine: { color: colors.gold },
  promptTextError: { color: '#ffd6d6' },
  actions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  sort: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  sortIcon: { color: colors.gold, fontSize: 16, fontWeight: '900' },
  sortText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.75 },
  hand: { justifyContent: 'flex-end', gap: 6, paddingTop: 10 },
  handRow: { flexDirection: 'row', justifyContent: 'center' },
  handCard: { borderRadius: 7, borderWidth: 2, borderColor: 'transparent' },
  handCardOn: {
    transform: [{ translateY: -10 }],
    borderColor: colors.gold,
    boxShadow: '0 0 10px rgba(255, 193, 7, 0.9)',
  },
  handCardFresh: { borderColor: 'rgba(120, 220, 255, 0.85)' },

  // Results
  summary: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.86)',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    gap: 8,
    width: 330,
    maxWidth: '100%',
    ...shadow,
  },
  summaryTitle: { color: colors.gold, fontSize: 19, fontWeight: '900', textAlign: 'center' },
  summaryNote: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 6,
    borderRadius: 10,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  resultRowWin: { borderColor: colors.gold },
  resultNameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultTag: {
    color: '#ffb3b3',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(220,53,69,0.3)',
    overflow: 'hidden',
  },
  resultName: { color: colors.text, fontSize: 14, fontWeight: '800', flexShrink: 1 },
  resultCards: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  resultMore: { color: colors.muted, fontSize: 11, fontWeight: '700', marginLeft: 6 },
  resultPenalty: { color: '#ff9b9b', fontSize: 14, fontWeight: '900', minWidth: 36, textAlign: 'right' },
  resultZero: { color: '#7be0a5' },
  resultTotal: { color: colors.gold, fontSize: 17, fontWeight: '900', minWidth: 36, textAlign: 'right' },
  trophy: { fontSize: 44, textAlign: 'center' },
  finalTitle: { color: colors.gold, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  podiumFirst: { borderColor: colors.gold },
  podiumPlace: { fontSize: 18, width: 28, textAlign: 'center', color: colors.text, fontWeight: '800' },
  podiumName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  podiumNameFirst: { color: colors.gold },
  podiumScore: { color: colors.text, fontSize: 18, fontWeight: '900' },
  finalButtons: { flexDirection: 'row', gap: 6 },
});
