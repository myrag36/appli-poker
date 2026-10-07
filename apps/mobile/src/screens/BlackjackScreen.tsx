import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  type Avatar,
  type BjAction,
  type BjHand,
  type BjResult,
  type BjState,
  type Card,
  BJ_MAX_SEATS,
  bjActor,
  bjApply,
  bjBotMove,
  bjCurrentHand,
  bjHandValue,
  bjIsOver,
  bjLegalActions,
  bjMinBet,
  bjNewGame,
  bjNextRound,
  bjRanking,
  bjRoundNet,
  bjTotalLabel,
  botName,
  defaultAvatar,
} from '@appli-poker/engine';
import { AvatarBadge, AvatarPicker } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { ChipStack } from '../components/Chip';
import { GameLayout } from '../components/GameLayout';
import { Appear } from '../components/Motion';
import { Panel } from '../components/Panel';
import { PlayingCard } from '../components/PlayingCard';
import { TopBar } from '../components/TopBar';
import { sounds } from '../feedback';
import { deviceRng } from '../rng';
import { colors, gradients, shadow, theme } from '../theme';

interface Settings {
  names: string[];
  bots: boolean[];
  avatars: Avatar[];
  stack: number;
}

const STACKS = [500, 1000, 2000];
const QUICK_CHIPS = [10, 25, 50, 100];
/** How long a robot seems to think before playing, in ms. */
const BOT_DELAY = 900;
/** Pause between two cards of the dealer, in ms. */
const DEALER_STEP = 650;

const ACTION_LABELS: Record<BjAction, string> = {
  hit: 'Tirer',
  stand: 'Rester',
  double: 'Doubler',
  split: 'Séparer',
};

const RESULT_LABELS: Record<BjResult, string> = {
  blackjack: 'Blackjack !',
  win: 'Gagné',
  push: 'Égalité',
  lose: 'Perdu',
  bust: 'Sauté',
};

function newGame(settings: Settings): BjState {
  return bjNewGame(
    {
      players: settings.names.map((name, i) => ({ id: `p${i}`, name, bot: settings.bots[i] })),
      stack: settings.stack,
    },
    deviceRng,
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/** Blackjack against the bank, on one phone passed from player to player. */
export function BlackjackScreen({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [game, setGame] = useState<BjState | null>(null);
  const [stopped, setStopped] = useState(false);

  if (!settings || !game) {
    return (
      <BlackjackSetup
        initial={settings}
        onBack={onBack}
        onStart={(s) => {
          setSettings(s);
          setGame(newGame(s));
          setStopped(false);
        }}
      />
    );
  }
  if (stopped) {
    return (
      <RankingView
        game={game}
        settings={settings}
        onReplay={() => {
          setGame(newGame(settings));
          setStopped(false);
        }}
        onSetup={() => setGame(null)}
        onBack={onBack}
      />
    );
  }
  return <BlackjackGame game={game} setGame={setGame} settings={settings} onStop={() => setStopped(true)} />;
}

// ---------------------------------------------------------------------------------------------
// Setup

function BlackjackSetup({
  initial,
  onStart,
  onBack,
}: {
  initial: Settings | null;
  onStart: (s: Settings) => void;
  onBack: () => void;
}) {
  const [names, setNames] = useState(initial?.names ?? ['', 'Robby']);
  const [bots, setBots] = useState(initial?.bots ?? [false, true]);
  const [avatars, setAvatars] = useState<Avatar[]>(
    initial?.avatars ?? [defaultAvatar(0), { emoji: '🤖', color: defaultAvatar(1).color }],
  );
  const [stack, setStack] = useState(initial?.stack ?? 1000);
  const [picking, setPicking] = useState<number | null>(null);
  const [help, setHelp] = useState(false);

  const cleaned = names.map((n, i) => n.trim() || `Joueur ${i + 1}`);
  const duplicate = new Set(cleaned.map((n) => n.toLowerCase())).size !== cleaned.length;
  const valid = !duplicate && bots.includes(false);

  function addPlayer(bot: boolean) {
    setNames([...names, bot ? botName(cleaned) : '']);
    setAvatars([
      ...avatars,
      bot ? { emoji: '🤖', color: defaultAvatar(names.length).color } : defaultAvatar(names.length),
    ]);
    setBots([...bots, bot]);
  }

  return (
    <ScrollView contentContainerStyle={setup.container} keyboardShouldPersistTaps="handled">
      <View style={setup.hero}>
        <View style={setup.heroCards}>
          <View style={setup.heroCardLeft}>
            <PlayingCard card="As" width={52} />
          </View>
          <View style={setup.heroCardRight}>
            <PlayingCard card="Kh" width={52} />
          </View>
        </View>
        <Text style={setup.title}>Blackjack</Text>
        <Text style={setup.subtitle}>Tous contre la banque, sur ce téléphone</Text>
      </View>

      <Pressable accessibilityRole="button" onPress={() => setHelp(!help)} style={setup.helpToggle}>
        <Text style={setup.helpToggleText}>{help ? 'Masquer les règles ▴' : 'Comment jouer ? ▾'}</Text>
      </Pressable>
      {help && <RulesHelp />}

      <Text style={setup.section}>Joueurs</Text>
      {names.map((name, i) => (
        <View key={i}>
          <View style={setup.row}>
            {bots[i] ? (
              <>
                <AvatarBadge avatar={avatars[i]} size={40} />
                <View style={[setup.input, setup.flex, setup.botRow]}>
                  <Text style={setup.botName}>{name}</Text>
                  <Text style={setup.botTag}>Robot</Text>
                </View>
              </>
            ) : (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Changer l'avatar du joueur ${i + 1}`}
                  onPress={() => setPicking(picking === i ? null : i)}
                >
                  <AvatarBadge avatar={avatars[i]} size={40} />
                </Pressable>
                <TextInput
                  style={[setup.input, setup.flex]}
                  placeholder={`Joueur ${i + 1}`}
                  placeholderTextColor={colors.muted}
                  value={name}
                  maxLength={12}
                  onChangeText={(t) => setNames(names.map((n, j) => (j === i ? t : n)))}
                />
              </>
            )}
            {names.length > 1 && (
              <View style={setup.remove}>
                <Button
                  label="✕"
                  variant="secondary"
                  onPress={() => {
                    setNames(names.filter((_, j) => j !== i));
                    setAvatars(avatars.filter((_, j) => j !== i));
                    setBots(bots.filter((_, j) => j !== i));
                    setPicking(null);
                  }}
                />
              </View>
            )}
          </View>
          {picking === i && (
            <AvatarPicker
              value={avatars[i]}
              onChange={(a) => setAvatars(avatars.map((x, j) => (j === i ? a : x)))}
            />
          )}
        </View>
      ))}
      {names.length < BJ_MAX_SEATS && (
        <View style={setup.row}>
          <View style={setup.flex}>
            <Button label="+ Joueur" variant="secondary" onPress={() => addPlayer(false)} />
          </View>
          <View style={setup.flex}>
            <Button label="+ Robot 🤖" variant="secondary" onPress={() => addPlayer(true)} />
          </View>
        </View>
      )}
      <Text style={setup.hint}>
        De 1 à 7 places. On se passe le téléphone : rien n’est caché, chacun joue contre le croupier.
      </Text>

      <Text style={setup.section}>Jetons de départ</Text>
      <View style={setup.row}>
        {STACKS.map((v) => (
          <Pressable
            key={v}
            accessibilityRole="button"
            accessibilityState={{ selected: v === stack }}
            onPress={() => setStack(v)}
            style={[setup.choice, v === stack && setup.choiceOn]}
          >
            <Text style={[setup.choiceText, v === stack && setup.choiceTextOn]}>{v}</Text>
          </Pressable>
        ))}
      </View>

      {duplicate && <Text style={setup.error}>Deux joueurs ont le même nom.</Text>}
      {!bots.includes(false) && <Text style={setup.error}>Il faut au moins un joueur humain.</Text>}

      <View style={setup.spacer} />
      <Button
        label="Lancer la partie"
        disabled={!valid}
        onPress={() => onStart({ names: cleaned, bots, avatars, stack })}
      />
      <Button label="Retour" variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

function RulesHelp() {
  const lines = [
    'Approche-toi le plus possible de 21 sans dépasser, et bats le croupier.',
    'Les figures valent 10, l’as vaut 1 ou 11. « 7/17 » : la main peut compter 7 ou 17.',
    'Blackjack = as + carte à 10 dès les deux premières cartes : payé 3 contre 2.',
    'Tirer : une carte de plus. Rester : tu t’arrêtes là.',
    'Doubler : tu doubles ta mise et reçois une seule carte.',
    'Séparer : avec une paire, tu joues deux mains (une fois). Les as séparés reçoivent une carte chacun.',
    'Le croupier tire jusqu’à 16 et reste sur 17. S’il a un as ou un 10 visible, il vérifie son blackjack.',
    'Gagné : mise payée 1 contre 1. Égalité : mise rendue. À 0 jeton, on est éliminé.',
  ];
  return (
    <Panel compact title="Comment jouer ?">
      {lines.map((l) => (
        <Text key={l} style={setup.helpLine}>
          • {l}
        </Text>
      ))}
    </Panel>
  );
}

const setup = StyleSheet.create({
  container: { padding: 20, paddingTop: 40, paddingBottom: 40 },
  hero: { alignItems: 'center', marginBottom: 6 },
  heroCards: { flexDirection: 'row', height: 80, marginBottom: 6 },
  heroCardLeft: { transform: [{ rotate: '-10deg' }, { translateX: 8 }] },
  heroCardRight: { transform: [{ rotate: '10deg' }, { translateX: -8 }, { translateY: 4 }] },
  title: { color: colors.gold, fontSize: 32, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 2 },
  helpToggle: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  helpToggleText: { color: colors.gold, fontWeight: '700', fontSize: 15 },
  helpLine: { color: colors.text, fontSize: 13, lineHeight: 18 },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 18, marginBottom: 8 },
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
  hint: { color: colors.muted, marginTop: 8, fontSize: 13 },
  remove: { width: 60 },
  botRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  botName: { color: colors.text, fontSize: 16 },
  botTag: { color: colors.gold, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  choice: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  choiceOn: { borderColor: colors.gold, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  choiceText: { color: colors.muted, fontSize: 17, fontWeight: '700' },
  choiceTextOn: { color: colors.gold },
  error: { color: colors.gold, marginTop: 8 },
  spacer: { height: 20 },
});

// ---------------------------------------------------------------------------------------------
// Game

function BlackjackGame({
  game,
  setGame,
  settings,
  onStop,
}: {
  game: BjState;
  setGame: (update: (g: BjState | null) => BjState | null) => void;
  settings: Settings;
  onStop: () => void;
}) {
  const actorId = bjActor(game);
  const actor = game.players.find((p) => p.id === actorId) ?? null;
  const botTurn = actor?.bot ?? false;
  const humans = game.players.filter((p) => !p.bot);
  const solo = humans.length === 1;
  const avatars = Object.fromEntries(settings.avatars.map((a, i) => [`p${i}`, a]));
  const [lastBets, setLastBets] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  // The dealer's cards are turned over one by one once the players are done.
  const [reveal, setReveal] = useState(1);
  const settled = game.phase === 'settled';
  useEffect(() => {
    if (!settled) {
      setReveal(1);
      return;
    }
    setReveal(2);
    let n = 2;
    const id = setInterval(() => {
      n++;
      setReveal(n);
      if (n >= game.dealer.length) clearInterval(id);
    }, DEALER_STEP);
    return () => clearInterval(id);
  }, [settled, game.round]);
  const revealDone = settled && reveal >= game.dealer.length;

  // Sounds: a card for every new card, chips for bets, a fanfare when a human wins.
  const cardCount =
    game.dealer.length + game.seats.reduce((n, s) => n + s.hands.reduce((m, h) => m + h.cards.length, 0), 0);
  const prevCards = useRef(cardCount);
  useEffect(() => {
    if (cardCount > prevCards.current) sounds.card();
    prevCards.current = cardCount;
  }, [cardCount]);
  useEffect(() => {
    if (revealDone && game.players.some((p) => !p.bot && bjRoundNet(game, p.id) > 0)) sounds.win();
  }, [revealDone]);
  useEffect(() => {
    if (actor && !actor.bot && !solo) sounds.myTurn();
  }, [actorId, game.phase]);

  function apply(move: Parameters<typeof bjApply>[1]) {
    try {
      setGame((g) => (g ? bjApply(g, move, deviceRng) : g));
      setError(null);
      if (move.type === 'bet' || move.type === 'double' || move.type === 'split') sounds.chips();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    if (!actor || !actor.bot) return;
    const id = setTimeout(
      () => {
        setGame((g) => {
          if (!g || bjActor(g) !== actor.id) return g;
          return bjApply(g, bjBotMove(g), deviceRng);
        });
        if (game.phase === 'betting') sounds.chips();
      },
      game.phase === 'betting' ? 450 : BOT_DELAY,
    );
    return () => clearTimeout(id);
  }, [game]);

  const over = bjIsOver(game);
  const name = (id: string) => game.players.find((p) => p.id === id)?.name ?? '';
  const who = (n: string) => (solo ? 'toi' : n);

  let bottom;
  if (game.phase === 'betting' && actor && !botTurn) {
    bottom = (
      <BetPanel
        key={`${game.round}-${actor.id}`}
        title={solo ? 'À toi de miser' : `À ${actor.name} de miser`}
        stack={actor.stack}
        initial={lastBets[actor.id] ?? 50}
        onBet={(amount) => {
          setLastBets({ ...lastBets, [actor.id]: amount });
          apply({ type: 'bet', amount });
        }}
      />
    );
  } else if (game.phase === 'playing' && actor && !botTurn) {
    const hand = bjCurrentHand(game)!;
    const seat = game.seats[game.turn!.seat];
    const legal = bjLegalActions(game);
    bottom = (
      <View style={[ui.panel, ui.turnPanel]}>
        <View style={ui.turnHeader}>
          <Text style={ui.turnTitle} numberOfLines={1}>
            {solo ? 'À toi de jouer' : `À ${actor.name} de jouer`}
          </Text>
          {seat.hands.length > 1 && (
            <Text style={ui.turnSub}>
              Main {game.turn!.hand + 1}/{seat.hands.length}
            </Text>
          )}
        </View>
        <View style={ui.turnHand}>
          <View style={ui.bigCards}>
            {hand.cards.map((c, i) => (
              <Appear key={`${i}-${c}`} from={-12}>
                <PlayingCard card={c} width={44} />
              </Appear>
            ))}
          </View>
          <TotalBadge cards={hand.cards} large />
          <ChipStack amount={hand.bet} />
        </View>
        <View style={ui.actions}>
          {(['hit', 'stand', 'double', 'split'] as BjAction[]).map((a) => (
            <View key={a} style={ui.action}>
              <Button
                compact
                label={ACTION_LABELS[a]}
                variant={a === 'hit' ? 'primary' : 'secondary'}
                disabled={!legal.includes(a)}
                onPress={() => apply({ type: a })}
              />
            </View>
          ))}
        </View>
        {error && <Text style={ui.error}>{error}</Text>}
      </View>
    );
  } else if (actor && botTurn) {
    bottom = (
      <View style={[ui.panel, ui.botPanel]}>
        <Text style={ui.botText}>
          🤖 {actor.name} {game.phase === 'betting' ? 'mise…' : 'réfléchit…'}
        </Text>
      </View>
    );
  } else if (settled && !revealDone) {
    bottom = (
      <View style={[ui.panel, ui.botPanel]}>
        <Text style={ui.botText}>
          {game.dealerBlackjack ? 'Le croupier a un blackjack !' : 'Le croupier joue…'}
        </Text>
      </View>
    );
  } else if (settled) {
    const dealerTotal = bjHandValue(game.dealer).total;
    bottom = (
      <View style={[ui.panel, ui.resultPanel]}>
        <Text style={ui.turnTitle}>
          {game.dealerBlackjack
            ? 'Blackjack du croupier'
            : dealerTotal > 21
              ? `Le croupier saute (${dealerTotal}) !`
              : `Le croupier fait ${dealerTotal}`}
        </Text>
        <View style={ui.nets}>
          {game.seats.map((s) => {
            const net = bjRoundNet(game, s.playerId);
            return (
              <View key={s.playerId} style={ui.netChip}>
                <Text style={ui.netName} numberOfLines={1}>
                  {name(s.playerId)}
                </Text>
                <Text style={[ui.netValue, net > 0 ? ui.netUp : net < 0 ? ui.netDown : null]}>
                  {signed(net)}
                </Text>
              </View>
            );
          })}
        </View>
        {over ? (
          <>
            <Text style={ui.overText}>
              {solo ? 'Plus de jetons… la banque gagne !' : 'Plus aucun joueur n’a de jetons.'}
            </Text>
            <Button compact label="Voir le classement" onPress={onStop} />
          </>
        ) : (
          <View style={ui.row}>
            <View style={ui.flex2}>
              <Button
                compact
                label="Manche suivante"
                onPress={() => setGame((g) => (g ? bjNextRound(g) : g))}
              />
            </View>
            <View style={ui.flex1}>
              <Button compact variant="secondary" label="Arrêter" onPress={onStop} />
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <GameLayout
      top={
        <TopBar onBack={onStop} backLabel="← Arrêter">
          <Text style={ui.round}>Manche {game.round}</Text>
          <View style={ui.shoe}>
            <Text style={ui.shoeText}>🂠 {game.shoe.length}</Text>
          </View>
        </TopBar>
      }
      table={({ width, height }) => (
        <BlackjackTable
          game={game}
          width={width}
          height={height}
          avatars={avatars}
          reveal={settled ? reveal : 1}
          showResults={revealDone}
          meId={solo ? humans[0].id : null}
        />
      )}
      bottom={bottom}
    />
  );
}

function BetPanel({
  title,
  stack,
  initial,
  onBet,
}: {
  title: string;
  stack: number;
  initial: number;
  onBet: (amount: number) => void;
}) {
  const min = bjMinBet(stack);
  const [bet, setBet] = useState(Math.max(min, Math.min(stack, initial)));
  return (
    <View style={[ui.panel, ui.betPanel]}>
      <View style={ui.turnHeader}>
        <Text style={ui.turnTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={ui.turnSub}>Tapis : {stack}</Text>
      </View>
      <View style={ui.betRow}>
        <Pressable accessibilityRole="button" onPress={() => setBet(0)} hitSlop={6}>
          <Text style={ui.clear}>Effacer</Text>
        </Pressable>
        <View style={ui.betAmount}>
          <ChipStack amount={bet} large />
        </View>
        <Pressable accessibilityRole="button" onPress={() => setBet(stack)} style={ui.maxChip}>
          <Text style={ui.maxText}>Max</Text>
        </Pressable>
      </View>
      <View style={ui.chips}>
        {QUICK_CHIPS.map((v) => (
          <Pressable
            key={v}
            accessibilityRole="button"
            accessibilityLabel={`Ajouter ${v}`}
            disabled={bet >= stack}
            onPress={() => setBet(Math.min(stack, bet + v))}
            style={({ pressed }) => [ui.chip, pressed && ui.chipPressed, bet >= stack && ui.chipOff]}
          >
            <View style={ui.chipInner}>
              <Text style={ui.chipText}>+{v}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <Button
        compact
        label={bet >= min ? `Miser ${bet}` : `Mise minimum : ${min}`}
        disabled={bet < min}
        onPress={() => onBet(bet)}
      />
    </View>
  );
}

function TotalBadge({
  cards,
  large,
  result,
  final,
}: {
  cards: Card[];
  large?: boolean;
  result?: BjResult | null;
  /** The hand is complete: show only its best total. */
  final?: boolean;
}) {
  const v = bjHandValue(cards);
  const bust = v.total > 21;
  const bj = cards.length === 2 && v.total === 21;
  return (
    <View
      style={[
        ui.badge,
        large && ui.badgeLarge,
        bust && ui.badgeBust,
        (bj || result === 'blackjack') && !bust && ui.badgeGold,
      ]}
    >
      <Text
        style={[ui.badgeText, large && ui.badgeTextLarge, (bj || result === 'blackjack') && ui.badgeTextGold]}
      >
        {final ? v.total : bjTotalLabel(cards)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Table

const POD_HEIGHT = 150;

function BlackjackTable({
  game,
  width,
  height,
  avatars,
  reveal,
  showResults,
  meId,
}: {
  game: BjState;
  width: number;
  height: number;
  avatars: Record<string, Avatar>;
  /** How many dealer cards are face up. */
  reveal: number;
  showResults: boolean;
  meId: string | null;
}) {
  const w = Math.min(width, 460);
  const h = Math.min(height, Math.round(w * 1.35));
  const cx = w / 2;
  // Semicircle at the bottom, flat side at the dealer.
  const n = game.players.length;
  const podW = Math.min(112, Math.floor((w - 16) / n) - 2);
  // Too many seats for the arc: they sit in a tidy two-column list instead.
  const list = podW < 78;
  const radius = list ? Math.min(90, w / 4) : Math.min(w / 2, Math.max(120, h - 200));
  const arcY = h - radius;
  const rx = w / 2 - podW / 2 - 8;
  const ry = radius - 44;
  const dealerCard = list
    ? Math.max(34, Math.min(46, Math.floor(h / 11)))
    : Math.max(38, Math.min(54, Math.floor(h / 9)));
  const mottoTop = 16 + 26 + dealerCard * 1.4 + (list ? 8 : 26);
  const listTop = mottoTop + 22;
  const rows = Math.ceil(n / 2);
  const tileW = Math.floor((w - 36 - 6) / 2);
  const tileH = Math.min(96, Math.floor((h - listTop - 22 - (rows - 1) * 6) / rows));
  const actorId = bjActor(game);
  const turn = game.turn;
  const dealerShown = game.dealer.slice(0, Math.max(1, reveal));
  // A long dealer hand gets smaller cards so it stays on the table.
  const dealerW = Math.min(dealerCard, Math.floor((w - 48) / Math.max(2, dealerShown.length)) - 4);
  const dealerHidden = game.dealer.length > 0 && reveal < 2;

  return (
    <View style={{ width: w, height: h }}>
      <View style={[tbl.rail, { borderBottomLeftRadius: radius, borderBottomRightRadius: radius }]}>
        <LinearGradient colors={gradients.wood} style={StyleSheet.absoluteFill} />
        <View
          style={[tbl.felt, { borderBottomLeftRadius: radius - 10, borderBottomRightRadius: radius - 10 }]}
        >
          <LinearGradient colors={gradients.felt} style={StyleSheet.absoluteFill} />
          <View style={tbl.glow} />
          <View
            style={[
              tbl.feltLine,
              { borderBottomLeftRadius: radius - 18, borderBottomRightRadius: radius - 18 },
            ]}
          />
          {theme.feltMark && (
            <Text style={[tbl.feltMark, { top: arcY - w * 0.12, fontSize: Math.round(w * 0.22) }]}>
              {theme.feltMark}
            </Text>
          )}
        </View>
      </View>

      {/* The dealer, along the flat edge. */}
      <View style={tbl.dealer}>
        <View style={tbl.dealerLabelRow}>
          <Text style={tbl.dealerLabel}>Croupier</Text>
          {game.dealer.length > 0 && (
            <TotalBadge
              cards={dealerHidden ? game.dealer.slice(0, 1) : dealerShown}
              final={game.phase === 'settled' && reveal >= game.dealer.length}
            />
          )}
        </View>
        <View style={[tbl.dealerCards, { height: dealerCard * 1.4 }]}>
          {game.dealer.length === 0 ? (
            <>
              <PlayingCard width={dealerCard} />
              <PlayingCard width={dealerCard} />
            </>
          ) : (
            <>
              {dealerShown.map((c, i) => (
                <Appear key={`${game.round}-${i}`} from={-10} delay={game.phase === 'playing' ? i * 120 : 0}>
                  <PlayingCard card={c} width={dealerW} />
                </Appear>
              ))}
              {dealerHidden && (
                <Appear key={`${game.round}-hole`} from={-10} delay={240}>
                  <PlayingCard card={game.dealer[1]} hidden width={dealerW} />
                </Appear>
              )}
            </>
          )}
        </View>
      </View>

      <View style={[tbl.motto, { top: mottoTop }]} pointerEvents="none">
        <Text style={tbl.mottoMain}>LE BLACKJACK PAIE 3 CONTRE 2</Text>
        {!list && <Text style={tbl.mottoSub}>Le croupier tire jusqu’à 16 et reste sur 17</Text>}
        {game.reshuffled && game.phase !== 'betting' && (
          <Appear key={`shuffle-${game.round}`}>
            <Text style={tbl.shuffle}>🔀 Sabot remélangé</Text>
          </Appear>
        )}
      </View>

      {list ? (
        <View style={[tbl.list, { top: listTop }]}>
          {game.players.map((p) => (
            <SeatTile
              key={p.id}
              game={game}
              playerId={p.id}
              avatar={avatars[p.id]}
              width={tileW}
              height={tileH}
              showResults={showResults}
              me={p.id === meId}
            />
          ))}
        </View>
      ) : (
        game.players.map((p, i) => {
          const x = 8 + (i + 0.5) * ((w - 16) / n);
          const dx = (x - cx) / rx;
          const y = arcY + ry * Math.sqrt(Math.max(0, 1 - dx * dx));
          const seatIndex = game.seats.findIndex((s) => s.playerId === p.id);
          const seat = seatIndex >= 0 ? game.seats[seatIndex] : null;
          const out = p.stack === 0 && !seat;
          const active = actorId === p.id;
          const pending = game.phase === 'betting' ? game.bets[p.id] : undefined;
          return (
            <View
              key={p.id}
              pointerEvents="none"
              style={[tbl.pod, { left: x - podW / 2, top: y - POD_HEIGHT + 26, width: podW }, out && tbl.out]}
            >
              {seat &&
                (seat.hands.length === 1 ? (
                  <SeatHand
                    hand={seat.hands[0]}
                    width={podW - 4}
                    focus={turn?.seat === seatIndex && turn.hand === 0}
                    showResult={showResults}
                  />
                ) : (
                  <View style={tbl.splitRow}>
                    {seat.hands.map((hand, k) => (
                      <SeatHand
                        key={k}
                        hand={hand}
                        width={(podW - 6) / 2}
                        focus={turn?.seat === seatIndex && turn.hand === k}
                        showResult={showResults}
                        split
                      />
                    ))}
                  </View>
                ))}
              {!seat && pending !== undefined && (
                <Appear from={-8}>
                  <ChipStack amount={pending} />
                </Appear>
              )}
              {!seat && game.phase === 'betting' && pending === undefined && !out && (
                <Text style={tbl.waiting}>{active ? 'Mise…' : ' '}</Text>
              )}
              <View style={[tbl.plate, active && tbl.plateActive]}>
                <AvatarBadge avatar={avatars[p.id]} size={podW < 56 ? 22 : 26} />
                <View style={tbl.plateText}>
                  <Text style={[tbl.name, active && tbl.nameActive]} numberOfLines={1}>
                    {p.id === meId ? 'Toi' : p.name}
                  </Text>
                  <Text style={tbl.stack} numberOfLines={1}>
                    {out ? 'Éliminé' : p.stack}
                  </Text>
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

/** Overlapping small cards, squeezed to fit `maxWidth`. */
function MiniCards({ cards, width, maxWidth }: { cards: Card[]; width: number; maxWidth: number }) {
  const k = cards.length;
  const step = k > 1 ? Math.min(width * 0.55, (maxWidth - width) / (k - 1)) : 0;
  return (
    <View style={{ width: width + step * (k - 1), height: Math.round(width * 1.4) }}>
      {cards.map((c, i) => (
        <View key={`${i}-${c}`} style={{ position: 'absolute', left: step * i - 2, top: 0 }}>
          <Appear from={-14}>
            <PlayingCard card={c} width={width} />
          </Appear>
        </View>
      ))}
    </View>
  );
}

function ResultLabel({ result }: { result: BjResult }) {
  return (
    <Appear from={-6}>
      <Text
        style={[
          tbl.result,
          result === 'win' || result === 'blackjack'
            ? tbl.resultWin
            : result === 'push'
              ? tbl.resultPush
              : tbl.resultLose,
        ]}
        numberOfLines={1}
      >
        {RESULT_LABELS[result]}
      </Text>
    </Appear>
  );
}

/** A seat in the list layout: name and chips on top, hands below. */
function SeatTile({
  game,
  playerId,
  avatar,
  width,
  height,
  showResults,
  me,
}: {
  game: BjState;
  playerId: string;
  avatar: Avatar;
  width: number;
  height: number;
  showResults: boolean;
  me: boolean;
}) {
  const p = game.players.find((x) => x.id === playerId)!;
  const seatIndex = game.seats.findIndex((s) => s.playerId === playerId);
  const seat = seatIndex >= 0 ? game.seats[seatIndex] : null;
  const out = p.stack === 0 && !seat;
  const active = bjActor(game) === playerId;
  const pending = game.phase === 'betting' ? game.bets[playerId] : undefined;
  const cw = Math.max(18, Math.min(28, Math.floor((height - 34) / 1.4)));
  const split = (seat?.hands.length ?? 0) > 1;
  const net = bjRoundNet(game, playerId);
  return (
    <View style={[tbl.tile, { width, height }, active && tbl.tileActive, out && tbl.out]}>
      <View style={tbl.tileHead}>
        <AvatarBadge avatar={avatar} size={20} />
        <Text style={[tbl.name, tbl.tileName, active && tbl.nameActive]} numberOfLines={1}>
          {me ? 'Toi' : p.name}
        </Text>
        <Text style={tbl.stack}>{out ? 'Éliminé' : p.stack}</Text>
      </View>
      <View style={tbl.tileBody}>
        {seat?.hands.map((hand, k) => {
          const focus = game.turn?.seat === seatIndex && game.turn.hand === k;
          const result = showResults ? hand.result : null;
          return (
            <View key={k} style={[tbl.tileHand, focus && tbl.handFocus]}>
              <MiniCards
                cards={hand.cards}
                width={split ? cw - 4 : cw}
                maxWidth={split ? width / 2 - 40 : width - 110}
              />
              <View style={tbl.tileInfo}>
                {result ? <ResultLabel result={result} /> : <TotalBadge cards={hand.cards} />}
                {split && <Text style={tbl.splitBet}>{hand.bet}</Text>}
              </View>
            </View>
          );
        })}
        {seat && !split && !showResults && <ChipStack amount={seat.hands[0].bet} />}
        {seat && showResults && game.phase === 'settled' && (
          <Text style={[tbl.tileNet, net > 0 ? tbl.tileNetUp : net < 0 ? tbl.tileNetDown : null]}>
            {signed(net)}
          </Text>
        )}
        {!seat && pending !== undefined && (
          <Appear from={-8}>
            <ChipStack amount={pending} />
          </Appear>
        )}
        {!seat && active && <Text style={tbl.waiting}>Mise…</Text>}
      </View>
    </View>
  );
}

/** One hand at a seat: small overlapping cards, the total, the bet, and the result at the end. */
function SeatHand({
  hand,
  width,
  focus,
  showResult,
  split,
}: {
  hand: BjHand;
  width: number;
  focus: boolean;
  showResult: boolean;
  split?: boolean;
}) {
  const cw = Math.max(20, Math.min(split ? 26 : 34, Math.floor(width * 0.48)));
  const result = showResult ? hand.result : null;
  return (
    <View style={[tbl.hand, focus && tbl.handFocus]}>
      {result ? <ResultLabel result={result} /> : <TotalBadge cards={hand.cards} />}
      <MiniCards cards={hand.cards} width={cw} maxWidth={width} />
      {split ? (
        <Text style={tbl.splitBet} numberOfLines={1}>
          {hand.bet}
        </Text>
      ) : (
        <ChipStack amount={hand.bet} />
      )}
    </View>
  );
}

const tbl = StyleSheet.create({
  rail: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: colors.rail,
    borderWidth: 2,
    borderColor: colors.railBorder,
    padding: 10,
    overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(0,0,0,0.6), inset 0 2px 3px rgba(255,220,170,0.35)',
  },
  felt: {
    flex: 1,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: colors.felt,
    borderWidth: 2,
    borderColor: colors.feltBorder,
    overflow: 'hidden',
    alignItems: 'center',
    boxShadow: 'inset 0 6px 18px rgba(0,0,0,0.55)',
  },
  glow: {
    position: 'absolute',
    top: '20%',
    width: '70%',
    height: '45%',
    borderRadius: 999,
    backgroundColor: colors.glow,
    boxShadow: `0 0 60px 40px ${colors.glow}`,
  },
  feltLine: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 213, 120, 0.2)',
  },
  feltMark: { position: 'absolute', opacity: 0.08, color: '#ffffff' },
  dealer: { position: 'absolute', top: 16, left: 0, right: 0, alignItems: 'center', gap: 4 },
  dealerLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 22 },
  dealerLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  dealerCards: { flexDirection: 'row', gap: 2 },
  motto: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 2 },
  mottoMain: { color: colors.gold, opacity: 0.55, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  mottoSub: { color: colors.muted, opacity: 0.7, fontSize: 10.5 },
  shuffle: {
    marginTop: 6,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  pod: {
    position: 'absolute',
    height: POD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
  },
  out: { opacity: 0.4 },
  list: {
    position: 'absolute',
    left: 18,
    right: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  tile: {
    borderRadius: 10,
    padding: 5,
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tileActive: { borderColor: colors.gold, boxShadow: `0 0 10px ${colors.gold}` },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tileName: { flex: 1, fontSize: 12 },
  tileBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileHand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    padding: 1,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tileNet: { color: colors.muted, fontSize: 13, fontWeight: '800', marginLeft: 'auto' },
  tileNetUp: { color: colors.gold },
  tileNetDown: { color: colors.danger },
  tileInfo: { alignItems: 'center', gap: 2 },
  splitBet: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 5,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  splitRow: { flexDirection: 'row', gap: 2, alignItems: 'flex-end' },
  hand: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 2,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  handFocus: { borderColor: colors.gold, backgroundColor: 'rgba(255,255,255,0.08)' },
  result: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  resultWin: { color: colors.onGold, backgroundColor: colors.gold },
  resultPush: { color: colors.text, backgroundColor: 'rgba(0,0,0,0.5)' },
  resultLose: { color: colors.text, backgroundColor: colors.danger },
  waiting: { color: colors.gold, fontSize: 11, fontWeight: '700', height: 16 },
  plate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    paddingLeft: 2,
    paddingRight: 6,
    paddingVertical: 2,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  plateActive: { borderColor: colors.gold, boxShadow: `0 0 10px ${colors.gold}` },
  plateText: { flexShrink: 1, minWidth: 0 },
  name: { color: colors.text, fontSize: 11, fontWeight: '700' },
  nameActive: { color: colors.gold },
  stack: { color: colors.muted, fontSize: 10, fontWeight: '600' },
});

const ui = StyleSheet.create({
  panel: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 8,
  },
  turnPanel: {},
  betPanel: {},
  resultPanel: {},
  botPanel: { minHeight: 64, alignItems: 'center', justifyContent: 'center' },
  botText: { color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  turnHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  turnTitle: { color: colors.gold, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  turnSub: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  turnHand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  bigCards: { flexDirection: 'row' },
  actions: { flexDirection: 'row', gap: 6 },
  action: { flex: 1 },
  error: { color: colors.gold, textAlign: 'center', fontSize: 13 },
  row: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  badge: {
    minWidth: 26,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  badgeLarge: { height: 30, borderRadius: 15, minWidth: 40, paddingHorizontal: 10 },
  badgeBust: { backgroundColor: colors.danger, borderColor: 'rgba(255,255,255,0.5)' },
  badgeGold: { backgroundColor: colors.gold, borderColor: colors.goldBorder },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  badgeTextLarge: { fontSize: 17 },
  badgeTextGold: { color: colors.onGold },
  betRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  betAmount: { flex: 1, alignItems: 'center' },
  clear: { color: colors.muted, fontSize: 13, fontWeight: '700', width: 56 },
  maxChip: {
    width: 56,
    paddingVertical: 6,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  maxText: { color: colors.text, fontWeight: '800', fontSize: 13 },
  chips: { flexDirection: 'row', justifyContent: 'space-around' },
  chip: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.felt,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  chipPressed: { transform: [{ scale: 0.92 }] },
  chipOff: { opacity: 0.35 },
  chipInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  chipText: { color: colors.text, fontWeight: '800', fontSize: 13 },
  nets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  netChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  netName: { color: colors.text, fontSize: 13, fontWeight: '600', maxWidth: 90 },
  netValue: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  netUp: { color: colors.gold },
  netDown: { color: colors.danger },
  overText: { color: colors.text, textAlign: 'center', fontSize: 14 },
  round: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  shoe: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  shoeText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
});

// ---------------------------------------------------------------------------------------------
// Ranking

const MEDALS = ['🥇', '🥈', '🥉'];

function RankingView({
  game,
  settings,
  onReplay,
  onSetup,
  onBack,
}: {
  game: BjState;
  settings: Settings;
  onReplay: () => void;
  onSetup: () => void;
  onBack: () => void;
}) {
  const rows = bjRanking(game);
  const avatars = Object.fromEntries(settings.avatars.map((a, i) => [`p${i}`, a]));
  return (
    <ScrollView contentContainerStyle={rank.container}>
      <Text style={rank.title}>Classement</Text>
      <Text style={rank.subtitle}>
        Après {game.phase === 'settled' ? game.round : game.round - 1} manche
        {(game.phase === 'settled' ? game.round : game.round - 1) > 1 ? 's' : ''}
      </Text>
      <View style={rank.list}>
        {rows.map((r, i) => {
          const diff = r.chips - settings.stack;
          return (
            <Appear key={r.id} delay={i * 90} from={14}>
              <View style={[rank.row, r.place === 1 && rank.first]}>
                <Text style={rank.place}>{MEDALS[r.place - 1] ?? `${r.place}e`}</Text>
                <AvatarBadge avatar={avatars[r.id]} size={34} />
                <Text style={[rank.name, r.place === 1 && rank.nameFirst]} numberOfLines={1}>
                  {r.name}
                </Text>
                <View style={rank.amounts}>
                  <Text style={rank.chips}>{r.chips}</Text>
                  <Text style={[rank.diff, diff > 0 ? rank.up : diff < 0 ? rank.down : null]}>
                    {signed(diff)}
                  </Text>
                </View>
              </View>
            </Appear>
          );
        })}
      </View>
      <View style={rank.spacer} />
      <Button label="Rejouer" onPress={onReplay} />
      <Button label="Changer les joueurs" variant="secondary" onPress={onSetup} />
      <Button label="Retour aux jeux" variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

const rank = StyleSheet.create({
  container: { padding: 20, paddingTop: 60 },
  title: { color: colors.gold, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.muted, textAlign: 'center', marginTop: 4, marginBottom: 18 },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  first: { borderColor: colors.gold, borderWidth: 2 },
  place: { width: 32, textAlign: 'center', fontSize: 20, color: colors.muted, fontWeight: '700' },
  name: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  nameFirst: { color: colors.gold },
  amounts: { alignItems: 'flex-end' },
  chips: { color: colors.text, fontSize: 17, fontWeight: '800' },
  diff: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  up: { color: colors.gold },
  down: { color: colors.danger },
  spacer: { height: 24 },
});
