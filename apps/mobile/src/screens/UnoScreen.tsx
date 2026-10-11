import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  type Avatar,
  type Card,
  type Rng,
  type UnoMove,
  type UnoState,
  type UnoVariant,
  type UnoView,
  UNO_HIDDEN,
  UNO_MAX_PLAYERS,
  UNO_PENALTY,
  UNO_TARGETS,
  botName,
  defaultAvatar,
  unoApply,
  unoBotCatches,
  unoBotMove,
  unoCanCatch,
  unoCanDraw,
  unoCanSay,
  unoColorName,
  unoColors,
  unoHandPoints,
  unoIsWild,
  unoLegalCards,
  unoNewGame,
  unoNextRound,
  unoStandings,
  unoTop,
} from '@appli-poker/engine';
import { AvatarBadge, AvatarPicker } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { OnlineButton } from '../components/OnlineButton';
import { TurnTimer } from '../components/TurnTimer';
import type { OnlineBoardProps, OnlineOptionsProps } from '../online-games/types';
import { reportLocalGame } from '../online/progress';
import { RulesButton } from '../components/Rules';
import { HUIT_RULES, UNO_RULES } from '../rules';
import { GameLayout } from '../components/GameLayout';
import { Appear } from '../components/Motion';
import { Panel } from '../components/Panel';
import { TopBar } from '../components/TopBar';
import { GameCard, UNO_PAINT } from '../components/UnoCard';
import { sounds } from '../feedback';
import { deviceRng } from '../rng';
import { colors, gradients } from '../theme';
import { useDesktop } from '../layout';
import { t, tn } from '../i18n';
import { FeltFill, feltMark } from '../components/felts';

/** How long a robot seems to think before playing, in ms. */
const BOT_DELAY = 1000;
/** A robot waits longer when someone forgot their announcement, so a person can catch them first. */
const EXPOSED_DELAY = 2300;
/** How fast a robot catches a person, or another robot, who forgot to announce. */
const CATCH_HUMAN = 1100;
const CATCH_ROBOT = 1700;
const botRng: Rng = (max) => Math.floor(Math.random() * max);

const SEAT_W = 66;
const SEAT_H = 74;
/** On a computer the players around the table get bigger seats. */
const SEAT_W_LARGE = 104;
const SEAT_H_LARGE = 108;

interface Texts {
  title: string;
  subtitle: string;
  /** The announcement of the last card. */
  call: string;
  /** Catching someone who forgot to announce. */
  counter: string;
  hero: Card[];
}

const TEXTS: Record<UnoVariant, Texts> = {
  uno: {
    title: 'Uno',
    subtitle: t('Vide ta main le premier… et n’oublie pas de crier « Uno ! »'),
    call: t('Uno !'),
    counter: t('Contre-Uno !'),
    hero: ['r7a', 'yRa', 'gDa', 'bSa', 'wFa'],
  },
  huit: {
    title: t('8 américain'),
    subtitle: t('Couleur ou valeur : le premier qui pose sa dernière carte gagne.'),
    call: t('Carte !'),
    counter: t('Contre-Carte !'),
    hero: ['8s', '8h', '8d', '8c'],
  },
};

/**
 * Short words that mean something else in other games ("Passe" and "Garde" are Tarot bids, "Joker" an
 * avatar): their key carries a `{uno}` mark, empty in French, so the English can differ here.
 */
function tUno(fr: string): string {
  return t(`${fr}{uno}`, { uno: '' });
}

const SUIT_SYMBOLS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RANK_NAMES: Record<string, string> = { T: '10', J: t('Valet'), Q: t('Dame'), K: t('Roi'), A: t('As') };
const UNO_SYMBOL_NAMES: Record<string, string> = {
  S: tUno('Passe'),
  R: t('Inverse'),
  D: '+2',
  W: tUno('Joker'),
  F: '+4',
};

/** A color or suit name from the engine ("rouge", "cœur"…), in the chosen language. */
function colorName(variant: UnoVariant, color: string): string {
  return t(unoColorName(variant, color));
}

/** "un 7 rouge", "une Dame de cœur", "un Joker"… */
function describe(variant: UnoVariant, card: Card): string {
  if (variant === 'uno') {
    const s = card[1];
    if (card[0] === 'w') return t('un {name}', { name: UNO_SYMBOL_NAMES[s] });
    return t('un {name} {color}', { name: UNO_SYMBOL_NAMES[s] ?? s, color: colorName('uno', card[0]) });
  }
  const r = card[0];
  const name = RANK_NAMES[r] ?? r;
  return r === 'Q'
    ? t('une {name} de {suit}', { name, suit: colorName('huit', card[1]) })
    : t('un {name} de {suit}', { name, suit: colorName('huit', card[1]) });
}

/** The color asked for, written on its own chip. */
function colorLabel(variant: UnoVariant, color: string): string {
  const name = colorName(variant, color);
  return name[0].toUpperCase() + name.slice(1);
}

function colorPaint(variant: UnoVariant, color: string): string {
  if (variant === 'uno') return UNO_PAINT[color];
  return color === 'h' || color === 'd' ? '#c1121f' : '#1b1b1b';
}

interface Settings {
  names: string[];
  avatars: Avatar[];
  bots: boolean[];
  target: number;
}

interface ScreenProps {
  onBack: () => void;
  /** Opens the online tables of this game. */
  onOnline?: () => void;
}

export function UnoScreen({ onBack, onOnline }: ScreenProps) {
  return <SheddingScreen variant="uno" onBack={onBack} onOnline={onOnline} />;
}

export function HuitScreen({ onBack, onOnline }: ScreenProps) {
  return <SheddingScreen variant="huit" onBack={onBack} onOnline={onOnline} />;
}

function SheddingScreen({ variant, onBack, onOnline }: ScreenProps & { variant: UnoVariant }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  /** The last players, so coming back to the setup keeps them. */
  const [last, setLast] = useState<Settings | null>(null);
  const [gameKey, setGameKey] = useState(0);
  if (!settings)
    return (
      <Setup
        variant={variant}
        initial={last}
        onBack={onBack}
        onOnline={onOnline}
        onStart={(s) => {
          setLast(s);
          setSettings(s);
        }}
      />
    );
  return (
    <Game
      key={gameKey}
      variant={variant}
      settings={settings}
      onQuit={() => setSettings(null)}
      onReplay={() => setGameKey((k) => k + 1)}
    />
  );
}

/* ---------------------------------------------------------------- setup */

function Setup({
  variant,
  initial,
  onStart,
  onBack,
  onOnline,
}: {
  variant: UnoVariant;
  initial: Settings | null;
  onStart: (s: Settings) => void;
  onBack: () => void;
  onOnline?: () => void;
}) {
  const tx = TEXTS[variant];
  const [names, setNames] = useState(initial?.names ?? ['', 'Robby', 'Bip']);
  const [avatars, setAvatars] = useState<Avatar[]>(
    initial?.avatars ?? [
      defaultAvatar(0),
      { emoji: '🤖', color: defaultAvatar(1).color },
      { emoji: '🤖', color: defaultAvatar(2).color },
    ],
  );
  const [bots, setBots] = useState(initial?.bots ?? [false, true, true]);
  const [target, setTarget] = useState(initial?.target ?? UNO_TARGETS[variant][0]);
  const [picking, setPicking] = useState<number | null>(null);

  const cleaned = names.map(
    (n, i) => n.trim() || (i === 0 && !bots[0] ? t('Toi') : t('Joueur {n}', { n: i + 1 })),
  );
  const duplicate = new Set(cleaned).size !== cleaned.length;
  const humans = bots.filter((b) => !b).length;
  const valid = !duplicate && humans > 0 && names.length >= 2;

  function addPlayer(bot: boolean) {
    setNames([...names, bot ? botName(cleaned) : '']);
    setAvatars([
      ...avatars,
      bot ? { emoji: '🤖', color: defaultAvatar(names.length).color } : defaultAvatar(names.length),
    ]);
    setBots([...bots, bot]);
  }

  return (
    <ScrollView contentContainerStyle={styles.setup} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        {tx.hero.map((c, i) => {
          const mid = (tx.hero.length - 1) / 2;
          return (
            <View
              key={c}
              style={{
                marginHorizontal: -6,
                transform: [{ rotate: `${(i - mid) * 11}deg` }],
                marginTop: Math.abs(i - mid) * 7,
              }}
            >
              <GameCard variant={variant} card={c} width={48} />
            </View>
          );
        })}
      </View>
      <Text style={styles.title}>{tx.title}</Text>
      <Text style={styles.subtitle}>{tx.subtitle}</Text>
      {onOnline && <OnlineButton onPress={onOnline} />}
      <RulesButton rules={variant === 'uno' ? UNO_RULES : HUIT_RULES} />

      <Text style={styles.section}>{t('Joueurs')}</Text>
      {names.map((name, i) => (
        <View key={i}>
          <View style={styles.row}>
            {bots[i] ? (
              <>
                <AvatarBadge avatar={avatars[i]} size={40} />
                <View style={[styles.input, styles.flex, styles.botRow]}>
                  <Text style={styles.botName}>{name}</Text>
                  <Text style={styles.botTag}>{t('Robot')}</Text>
                </View>
              </>
            ) : (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("Changer l'avatar du joueur {n}", { n: i + 1 })}
                  onPress={() => setPicking(picking === i ? null : i)}
                >
                  <AvatarBadge avatar={avatars[i]} size={40} />
                </Pressable>
                <TextInput
                  style={[styles.input, styles.flex]}
                  placeholder={i === 0 ? t('Toi') : t('Joueur {n}', { n: i + 1 })}
                  placeholderTextColor={colors.muted}
                  value={name}
                  maxLength={14}
                  onChangeText={(v) => setNames(names.map((n, j) => (j === i ? v : n)))}
                />
              </>
            )}
            {names.length > 2 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Retirer {name}', { name: cleaned[i] })}
                onPress={() => {
                  setNames(names.filter((_, j) => j !== i));
                  setAvatars(avatars.filter((_, j) => j !== i));
                  setBots(bots.filter((_, j) => j !== i));
                  setPicking(null);
                }}
                style={styles.remove}
              >
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
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
      {names.length < UNO_MAX_PLAYERS && (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button label={t('+ Joueur')} variant="secondary" onPress={() => addPlayer(false)} />
          </View>
          <View style={styles.flex}>
            <Button label={t('+ Robot 🤖')} variant="secondary" onPress={() => addPlayer(true)} />
          </View>
        </View>
      )}
      <Text style={styles.hint}>
        {humans > 1
          ? t(
              'Plusieurs joueurs sur ce téléphone : on se le passe à chaque tour, et chacun cache ses cartes.',
            )
          : t('De 2 à {n} joueurs. Ajoute des amis pour jouer en se passant le téléphone.', {
              n: UNO_MAX_PLAYERS,
            })}
      </Text>
      {duplicate && <Text style={styles.error}>{t('Deux joueurs ont le même nom.')}</Text>}
      {humans === 0 && <Text style={styles.error}>{t('Il faut au moins un joueur humain.')}</Text>}

      <Text style={styles.section}>{t('Durée de la partie')}</Text>
      <View style={styles.counts}>
        {UNO_TARGETS[variant].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityState={{ selected: n === target }}
            onPress={() => setTarget(n)}
            style={[styles.count, n === target && styles.countOn]}
          >
            <Text style={[styles.countText, n === target && styles.countTextOn]}>
              {n === 0 ? t('1 manche') : t('{n} points', { n })}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>
        {target === 0
          ? t('Le premier qui vide sa main gagne la partie.')
          : t(
              'Le gagnant de chaque manche marque les cartes restées chez les autres. Premier à {n} points !',
              {
                n: target,
              },
            )}
      </Text>

      <View style={styles.spacer} />
      <Button
        label={t('Lancer la partie')}
        disabled={!valid}
        onPress={() => onStart({ names: cleaned, avatars, bots, target })}
      />
      <Button label={t('Retour')} variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

/* ---------------------------------------------------------------- game */

function Game({
  variant,
  settings,
  onQuit,
  onReplay,
}: {
  variant: UnoVariant;
  settings: Settings;
  onQuit: () => void;
  onReplay: () => void;
}) {
  const tx = TEXTS[variant];
  const { bots, avatars } = settings;
  const humans = useMemo(() => bots.flatMap((b, i) => (b ? [] : [i])), [bots]);
  const multi = humans.length > 1;
  const [state, setState] = useState<UnoState>(() =>
    unoNewGame(
      variant,
      settings.names.map((name, i) => ({ id: `p${i}`, name })),
      settings.target,
      deviceRng,
    ),
  );
  /** Whose hand is shown at the bottom of the table. */
  const [viewer, setViewer] = useState(humans[0]);
  /** Pass-and-play: the viewer has confirmed they hold the phone. */
  const [revealed, setRevealed] = useState(!multi);
  /** A wild card waiting for its color. */
  const [choosing, setChoosing] = useState<Card | null>(null);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const desktop = useDesktop();

  const isBot = (i: number) => bots[i];
  const playing = state.phase === 'playing';
  const humanTurn = playing && !isBot(state.current);
  const curtain = multi && humanTurn && (state.current !== viewer || !revealed);
  const myTurn = humanTurn && state.current === viewer && !curtain;
  const me = state.players[viewer];
  const legal = useMemo(() => (myTurn ? unoLegalCards(state, viewer) : []), [state, myTurn, viewer]);
  const showHand = !multi || revealed;
  const catchable =
    state.exposed !== null && state.exposed !== viewer && unoCanCatch(state, viewer, state.exposed);

  // Robots play on their own, and catch whoever forgot to announce their last card.
  useEffect(() => {
    if (state.phase !== 'playing' || curtain) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const { seq, exposed } = state;
    if (exposed !== null) {
      const catchers = state.players.map((_, i) => i).filter((i) => bots[i] && i !== exposed);
      if (catchers.length && unoBotCatches(state, botRng, bots[exposed] ? 40 : 70)) {
        const by = catchers[botRng(catchers.length)];
        timers.push(
          setTimeout(
            () =>
              setState((s) =>
                s.seq === seq && unoCanCatch(s, by, exposed)
                  ? unoApply(s, by, { type: 'catch', target: exposed }, deviceRng)
                  : s,
              ),
            bots[exposed] ? CATCH_ROBOT : CATCH_HUMAN,
          ),
        );
      }
    }
    if (bots[state.current]) {
      const delay = exposed !== null ? EXPOSED_DELAY : state.drawn ? BOT_DELAY * 0.7 : BOT_DELAY;
      timers.push(
        setTimeout(
          () =>
            setState((s) =>
              s.seq === seq && s.phase === 'playing'
                ? unoApply(s, s.current, unoBotMove(s, s.current, botRng), deviceRng)
                : s,
            ),
          delay,
        ),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [state, curtain]);

  // Sounds for what just happened.
  const prev = useRef(state);
  useEffect(() => {
    const before = prev.current;
    prev.current = state;
    if (before === state || before.seq === state.seq) return;
    if (state.phase !== 'playing' && before.phase === 'playing') {
      if (state.roundWinner !== null && !bots[state.roundWinner]) sounds.win();
      else if (state.roundWinner !== null) sounds.lose();
      else sounds.chips();
      return;
    }
    const e = state.last;
    if (e?.type === 'play') sounds.card();
    else if (e?.type === 'draw') sounds.fold();
    else if (e?.type === 'say') sounds.reaction();
    else if (e?.type === 'catch') sounds.chips();
    if (!bots[state.current] && (state.current !== before.current || before.phase !== 'playing'))
      sounds.myTurn();
  }, [state]);

  // Experience, once, when the game is over: a win if a person won it.
  const reported = useRef(false);
  useEffect(() => {
    if (state.phase === 'gameOver' && !reported.current) {
      reported.current = true;
      reportLocalGame(variant, !bots[state.winner!]);
    }
  }, [state.phase]);

  function act(move: UnoMove, by = viewer) {
    try {
      setState(unoApply(state, by, move, deviceRng));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      sounds.invalid();
    }
  }

  function tap(card: Card) {
    if (!myTurn || !legal.includes(card)) return;
    if (unoIsWild(variant, card)) setChoosing(card);
    else act({ type: 'play', card });
  }

  function stop() {
    // Stopping between rounds ends the game on the points so far.
    if (!reported.current && state.round > 1) {
      reported.current = true;
      const best = unoStandings(state)[0];
      reportLocalGame(variant, !bots[best.index]);
    }
    setFinished(true);
  }

  if (finished) {
    return (
      <FinalScreen
        variant={variant}
        state={state}
        bots={settings.bots}
        avatars={settings.avatars}
        onReplay={onReplay}
        onQuit={onQuit}
      />
    );
  }

  const current = state.players[state.current];
  const canSay = unoCanSay(state, viewer) && !curtain && !isBot(viewer);
  const top = unoTop(state);
  let prompt: string;
  if (!playing) prompt = t('Manche terminée');
  else if (curtain) prompt = t('Au tour de {name}', { name: current.name });
  else if (myTurn) {
    if (state.pendingDraw > 0)
      prompt = legal.length
        ? t('Pose un 2 ou pioche {n} cartes', { n: state.pendingDraw })
        : t('Pas de 2 : pioche {n} cartes', { n: state.pendingDraw });
    else if (state.drawn) prompt = t('La carte piochée va : joue-la ou garde-la');
    else if (me.hand.length === 2 && !me.said && legal.length)
      prompt = t('Plus que 2 cartes : annonce « {call} » avant de jouer', { call: tx.call });
    else if (legal.length)
      prompt = multi ? t('À toi, {name} ! Joue une carte', { name: me.name }) : t('À toi ! Joue une carte');
    else prompt = t('Aucune carte ne va : pioche');
  } else
    prompt = isBot(state.current)
      ? t('🤖 {name} réfléchit…', { name: current.name })
      : t('Au tour de {name}', { name: current.name });

  const drawLabel =
    state.drawn !== null
      ? t('Garder')
      : state.pendingDraw > 0
        ? t('Piocher {n}', { n: state.pendingDraw })
        : t('Piocher');

  return (
    <GameLayout
      top={
        <TopBar onBack={onQuit} backLabel={t('← Quitter')}>
          <Text style={styles.topInfo}>
            {state.target
              ? t('Manche {n} · {target} pts', { n: state.round, target: state.target })
              : tx.title}
          </Text>
          {state.target > 0 && (
            <View style={styles.scorePill}>
              <Text style={styles.scoreText}>{t('⭐ {n} pts', { n: me.score })}</Text>
            </View>
          )}
        </TopBar>
      }
      table={({ width, height }) => (
        <TableView
          variant={variant}
          state={state}
          avatars={avatars}
          bots={bots}
          viewer={viewer}
          width={width}
          height={height}
          canDraw={myTurn && unoCanDraw(state, viewer)}
          onDraw={() => act({ type: 'draw' })}
        >
          {choosing && (
            <ColorPicker
              variant={variant}
              onPick={(color) => {
                act({ type: 'play', card: choosing, color });
                setChoosing(null);
              }}
              onCancel={() => setChoosing(null)}
            />
          )}
          {curtain && (
            <HandOff
              name={current.name}
              avatar={avatars[state.current]}
              onReady={() => {
                setViewer(state.current);
                setRevealed(true);
              }}
            />
          )}
          {!playing && (
            <RoundRecap
              variant={variant}
              state={state}
              avatars={avatars}
              bots={bots}
              onNext={() => setState(unoNextRound(state, deviceRng))}
              onStop={stop}
              onResults={() => setFinished(true)}
            />
          )}
        </TableView>
      )}
      bottom={
        !playing ? null : (
          <View style={styles.bottom}>
            <Text
              style={[styles.prompt, desktop && styles.promptLarge, myTurn && styles.promptMine]}
              numberOfLines={1}
            >
              {prompt}
            </Text>
            <Hand
              variant={variant}
              cards={me.hand}
              hidden={!showHand}
              legal={legal}
              drawn={myTurn ? state.drawn : null}
              active={myTurn}
              onTap={tap}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={[styles.actions, desktop && styles.actionsDesktop]}>
              <View style={styles.flex}>
                <Button
                  compact
                  variant="secondary"
                  label={drawLabel}
                  disabled={!myTurn}
                  onPress={() => act(state.drawn !== null ? { type: 'pass' } : { type: 'draw' })}
                />
              </View>
              <View style={styles.flex}>
                <CallButton
                  label={catchable ? tx.counter : tx.call}
                  hot={canSay || catchable}
                  onPress={() =>
                    catchable ? act({ type: 'catch', target: state.exposed! }) : act({ type: 'say' }, viewer)
                  }
                />
              </View>
            </View>
          </View>
        )
      }
    />
  );
}

/** The big round "Uno !" / "Carte !" button; it glows when there is something to announce. */
function CallButton({ label, hot, onPress }: { label: string; hot: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!hot}
      onPress={onPress}
      style={({ pressed }) => [
        styles.call,
        hot && styles.callHot,
        !hot && styles.callOff,
        pressed && styles.pressed,
      ]}
    >
      {hot && <LinearGradient colors={['#ff5a4f', '#e0312f', '#a8161a']} style={StyleSheet.absoluteFill} />}
      <Text style={[styles.callText, !hot && styles.callTextOff]} numberOfLines={1}>
        📣 {label}
      </Text>
    </Pressable>
  );
}

/* ---------------------------------------------------------------- table */

function TableView({
  variant,
  state,
  avatars,
  bots,
  viewer,
  width,
  height,
  canDraw,
  onDraw,
  children,
}: {
  variant: UnoVariant;
  state: UnoState | UnoView;
  avatars: Avatar[];
  bots: boolean[];
  viewer: number;
  width: number;
  height: number;
  canDraw: boolean;
  onDraw: () => void;
  children?: ReactNode;
}) {
  const desktop = useDesktop();
  // A phone has a tall oval table; a computer a wide one, with bigger seats and cards.
  const w = desktop ? Math.min(width, 1080, Math.round(height * 1.8)) : Math.min(width, 460);
  const h = height;
  const seatW = desktop ? SEAT_W_LARGE : SEAT_W;
  const seatH = desktop ? SEAT_H_LARGE : SEAT_H;
  const n = state.players.length;
  const others = n - 1;
  const cx = w / 2;
  // The others sit on the upper half of an ellipse, in playing order from the left.
  const cy = Math.round(h * (desktop ? 0.66 : 0.6));
  const rx = w / 2 - seatW / 2 - (desktop ? 24 : 0);
  const ry = cy - seatH / 2 - (desktop ? 22 : 2);
  const seat = (k: number) => {
    const angle = others === 1 ? Math.PI / 2 : Math.PI - ((k + 0.5) * Math.PI) / others;
    return { x: cx + rx * Math.cos(angle), y: cy - ry * Math.sin(angle) };
  };
  const cardW = desktop
    ? Math.max(60, Math.min(100, Math.floor(h / 6.6)))
    : Math.max(52, Math.min(70, Math.floor(w / 6)));
  const pileY = desktop
    ? Math.round(Math.min(h - cardW * 1.4 - 128, cy - cardW * 0.85))
    : Math.round(Math.min(h - cardW * 1.4 - 60, Math.max(cy - cardW * 0.9, h * 0.34)));
  const last = state.last;
  const top = unoTop(state);
  const under = state.discard.slice(-3, -1);
  // Online, only the size of the draw pile is known.
  const deckCount = 'deckCount' in state ? state.deckCount : state.deck.length;

  /** A short bubble over a seat for what this player just did. */
  function bubble(i: number): { text: string; hot?: boolean } | null {
    const p = state.players[i];
    if (last?.type === 'catch' && last.target === i)
      return { text: t('Pris ! +{n}', { n: UNO_PENALTY }), hot: true };
    if (last?.type === 'play' && last.penalty?.player === i)
      return { text: `+${last.penalty.count}`, hot: true };
    if (last?.type === 'draw' && last.player === i && last.forced)
      return { text: `+${last.count}`, hot: true };
    if (p.hand.length === 1 && p.said) return { text: TEXTS[variant].call, hot: true };
    if (last?.type === 'draw' && last.player === i) return { text: t('Pioche') };
    if (last?.type === 'pass' && last.player === i) return { text: tUno('Garde') };
    return null;
  }

  let caption = '';
  if (last?.type === 'play') {
    caption = t('{who} : {card}', {
      who: who(state, last.player, viewer),
      card: describe(variant, last.card),
    });
    if (last.color) caption += ` → ${colorName(variant, last.color)}`;
    if (last.penalty)
      caption += ` · ${
        last.penalty.player === viewer
          ? t('tu pioches {n}', { n: last.penalty.count })
          : t('{name} pioche {n}', { name: state.players[last.penalty.player].name, n: last.penalty.count })
      }`;
  } else if (last?.type === 'draw')
    caption =
      last.player === viewer
        ? tn(last.count, 'Tu pioches {n} carte', 'Tu pioches {n} cartes')
        : tn(last.count, '{name} pioche {n} carte', '{name} pioche {n} cartes', {
            name: state.players[last.player].name,
          });
  else if (last?.type === 'pass')
    caption =
      last.player === viewer
        ? t('Tu gardes ta carte')
        : t('{name} garde sa carte', { name: state.players[last.player].name });
  else if (last?.type === 'say')
    caption =
      last.player === viewer
        ? t('Tu annonces « {call} »', { call: TEXTS[variant].call })
        : t('{name} annonce « {call} »', {
            name: state.players[last.player].name,
            call: TEXTS[variant].call,
          });
  else if (last?.type === 'catch')
    caption =
      last.target === viewer
        ? t('{name} t’attrape : +{n} pour toi !', { name: state.players[last.player].name, n: UNO_PENALTY })
        : last.player === viewer
          ? t('Tu attrapes {target} : +{n} !', { target: state.players[last.target].name, n: UNO_PENALTY })
          : t('{name} attrape {target} : +{n} !', {
              name: state.players[last.player].name,
              target: state.players[last.target].name,
              n: UNO_PENALTY,
            });
  else
    caption =
      state.current === viewer
        ? t('À toi de commencer')
        : t('{name} commence', { name: state.players[state.current].name });

  return (
    <View style={{ width: w, height: h }}>
      <View style={styles.rail}>
        <LinearGradient colors={gradients.wood} style={StyleSheet.absoluteFill} />
        <View style={styles.felt}>
          <FeltFill />
          <View style={styles.feltGlow} />
          <View style={styles.feltLine} />
          {feltMark() && (
            <Text style={[styles.feltMark, { fontSize: Math.round(w * 0.3) }]}>{feltMark()}</Text>
          )}
        </View>
      </View>

      {/* Which way the turn goes. */}
      <Text
        pointerEvents="none"
        style={[
          styles.direction,
          { top: pileY - cardW * 0.55, fontSize: cardW * 2.6, lineHeight: cardW * 2.9 },
        ]}
      >
        {state.direction === 1 ? '↻' : '↺'}
      </Text>

      <View
        pointerEvents="box-none"
        style={[styles.piles, desktop && styles.pilesLarge, { top: pileY, width: w }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Pioche, {n} cartes', { n: deckCount })}
          disabled={!canDraw}
          onPress={onDraw}
          style={styles.deck}
        >
          {[2, 1].map((k) =>
            deckCount > k * 6 ? (
              <View key={k} style={[styles.deckUnder, { top: -k * 2, left: k * 2 }]}>
                <GameCard variant={variant} width={cardW} hidden />
              </View>
            ) : null,
          )}
          {deckCount > 0 ? (
            <View style={canDraw && styles.deckReady}>
              <GameCard variant={variant} width={cardW} hidden />
            </View>
          ) : (
            <View style={[styles.emptyPile, { width: cardW, height: cardW * 1.4 }]} />
          )}
          <Text style={[styles.deckCount, desktop && styles.deckCountLarge]}>{deckCount}</Text>
        </Pressable>
        <View style={[styles.discard, { width: cardW + 16, height: cardW * 1.4 }]}>
          {under.map((c, k) => (
            <View
              key={c}
              style={[
                styles.discardUnder,
                { transform: [{ rotate: `${(k === 0 ? -1 : 1) * (8 + (c.charCodeAt(1) % 7))}deg` }] },
              ]}
            >
              <GameCard variant={variant} card={c} width={cardW} />
            </View>
          ))}
          <Appear key={`${top}-${state.discard.length}`} from={-40} style={styles.discardTop}>
            <GameCard variant={variant} card={top} width={cardW} />
          </Appear>
        </View>
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.under,
          desktop && styles.underLarge,
          { top: pileY + cardW * 1.4 + (desktop ? 14 : 8), width: w },
        ]}
      >
        <View style={styles.chips}>
          <View
            style={[
              styles.colorChip,
              desktop && styles.colorChipLarge,
              { borderColor: colorPaint(variant, state.color) },
            ]}
          >
            <View
              style={[
                styles.colorDot,
                desktop && styles.colorDotLarge,
                { backgroundColor: colorPaint(variant, state.color) },
              ]}
            >
              {variant === 'huit' && <Text style={styles.colorSuit}>{SUIT_SYMBOLS[state.color]}</Text>}
            </View>
            <Text style={[styles.colorText, desktop && styles.colorTextLarge]}>
              {colorLabel(variant, state.color)}
            </Text>
          </View>
          {state.pendingDraw > 0 && (
            <Appear from={6} style={styles.pendingChip}>
              <Text style={styles.pendingText}>{t('+{n} à piocher', { n: state.pendingDraw })}</Text>
            </Appear>
          )}
        </View>
        <Text style={[styles.caption, desktop && styles.captionLarge]} numberOfLines={1}>
          {caption}
        </Text>
      </View>

      {state.players.map((p, i) => {
        if (i === viewer) return null;
        const k = (i - viewer - 1 + n) % n;
        const { x, y } = seat(k);
        const active = state.phase === 'playing' && state.current === i;
        const b = bubble(i);
        return (
          <View
            key={p.id}
            pointerEvents="none"
            style={[styles.seat, { left: x - seatW / 2, top: y - seatH / 2, width: seatW }]}
          >
            <View
              style={[styles.avatarRing, desktop && styles.avatarRingLarge, active && styles.avatarActive]}
            >
              <AvatarBadge avatar={avatars[i]} size={desktop ? 58 : 38} />
            </View>
            <View
              style={[
                styles.plate,
                desktop && styles.plateLarge,
                { width: seatW },
                active && styles.plateActive,
              ]}
            >
              <Text style={[styles.name, desktop && styles.nameLarge]} numberOfLines={1}>
                {bots[i] ? '' : '👤 '}
                {p.name}
              </Text>
              {desktop ? (
                <SeatFan variant={variant} count={p.hand.length} />
              ) : (
                <Text style={[styles.cards, p.hand.length === 1 && styles.cardsLast]}>🂠 {p.hand.length}</Text>
              )}
            </View>
            {state.target > 0 && (
              <Text style={[styles.seatScore, desktop && styles.seatScoreLarge]}>
                {t('{n} pts', { n: p.score })}
              </Text>
            )}
            {b && (
              <Appear
                key={`${state.seq}-${b.text}`}
                from={6}
                style={[styles.bubble, desktop && styles.bubbleLarge]}
              >
                <Text
                  style={[styles.bubbleText, desktop && styles.bubbleTextLarge, b.hot && styles.bubbleHot]}
                >
                  {b.text}
                </Text>
              </Appear>
            )}
          </View>
        );
      })}

      <View pointerEvents="none" style={[styles.mePlate, { top: h - (desktop ? 46 : 30) }]}>
        <View
          style={[
            styles.meRing,
            desktop && styles.meRingLarge,
            state.current === viewer && state.phase === 'playing' && styles.avatarActive,
          ]}
        >
          <AvatarBadge avatar={avatars[viewer]} size={desktop ? 32 : 22} />
        </View>
        <Text style={[styles.meName, desktop && styles.meNameLarge]} numberOfLines={1}>
          {state.players[viewer].name}
        </Text>
        {(() => {
          const b = bubble(viewer);
          return b ? (
            <Appear key={`${state.seq}-${b.text}`} from={6}>
              <Text style={[styles.bubbleText, b.hot && styles.bubbleHot]}>{b.text}</Text>
            </Appear>
          ) : null;
        })()}
      </View>

      {children}
    </View>
  );
}

/** On a computer: a small fan of face-down cards under a seat, with how many there are. */
function SeatFan({ variant, count }: { variant: UnoVariant; count: number }) {
  const shown = Math.min(count, 7);
  const cw = 18;
  const step = 7;
  return (
    <View style={styles.fanRow}>
      <View style={{ width: shown ? cw + step * (shown - 1) : 0, height: Math.round(cw * 1.4) }}>
        {Array.from({ length: shown }, (_, k) => (
          <View key={k} style={{ position: 'absolute', left: k * step }}>
            <GameCard variant={variant} width={cw} hidden />
          </View>
        ))}
      </View>
      <Text style={[styles.cards, styles.cardsLarge, count === 1 && styles.cardsLast]}>{count}</Text>
    </View>
  );
}

function who(state: UnoState, i: number, viewer: number) {
  if (i === viewer) return t('Toi');
  return state.players[i].name;
}

/* ---------------------------------------------------------------- hand */

function Hand({
  variant,
  cards,
  hidden,
  legal,
  drawn,
  active,
  onTap,
}: {
  variant: UnoVariant;
  cards: Card[];
  hidden: boolean;
  legal: Card[];
  drawn: Card | null;
  active: boolean;
  onTap: (c: Card) => void;
}) {
  const { width, height } = useWindowDimensions();
  const desktop = useDesktop();
  // On a computer the hand spreads over the controls area (760 px at most) with bigger cards.
  const avail = Math.min(width, desktop ? 760 : 480) - 24;
  const cardW = desktop ? (cards.length > 14 ? 62 : height < 820 ? 68 : 78) : cards.length > 14 ? 48 : 56;
  const lift = desktop ? 16 : 12;
  // A long hand goes on two rows so every card stays easy to tap.
  const rows = cards.length > 16 ? 2 : 1;
  const perRow = Math.ceil(cards.length / rows);
  const step = perRow > 1 ? Math.min(cardW + 4, (avail - cardW) / (perRow - 1)) : 0;
  const rowH = cardW * 1.4;
  const rowGap = rows > 1 ? rowH * 0.45 : 0;
  return (
    <View style={[styles.hand, { height: rowH + lift + rowGap + 2 }]}>
      {cards.length === 0 && <Text style={styles.empty}>{t('Plus de cartes !')}</Text>}
      {Array.from({ length: rows }, (_, r) => {
        const row = cards.slice(r * perRow, (r + 1) * perRow);
        const total = row.length ? cardW + step * (row.length - 1) : 0;
        return (
          <View
            key={r}
            style={{ position: 'absolute', top: r * rowGap, width: total, height: rowH + lift }}
            pointerEvents="box-none"
          >
            {row.map((c, i) => {
              const ok = active && legal.includes(c);
              return (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={
                    hidden ? t('Carte cachée') : t('Carte {card}', { card: describe(variant, c) })
                  }
                  accessibilityState={{ disabled: !ok }}
                  disabled={!ok}
                  onPress={() => onTap(c)}
                  style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [
                    styles.handCard,
                    { left: i * step, top: ok ? (hovered ? -4 : 0) : lift },
                    ok && desktop && styles.handCardDesktop,
                  ]}
                >
                  <View style={[ok && styles.cardOk, c === drawn && styles.cardNew]}>
                    <GameCard variant={variant} card={hidden ? undefined : c} width={cardW} hidden={hidden} />
                    {active && !ok && <View style={styles.shade} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

/* ---------------------------------------------------------------- overlays */

function ColorPicker({
  variant,
  onPick,
  onCancel,
}: {
  variant: UnoVariant;
  onPick: (color: string) => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.overlay}>
      <Appear from={20} style={styles.overlayCard}>
        <Panel compact title={variant === 'uno' ? t('Quelle couleur ?') : t('Quelle couleur demandes-tu ?')}>
          <View style={styles.colorRow}>
            {unoColors(variant).map((c) => (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityLabel={colorName(variant, c)}
                onPress={() => onPick(c)}
                style={({ pressed }) => [styles.colorPick, pressed && styles.pressed]}
              >
                <View
                  style={[
                    styles.colorBall,
                    variant === 'uno'
                      ? { backgroundColor: UNO_PAINT[c] }
                      : { backgroundColor: '#fbf7ec', borderColor: colorPaint(variant, c) },
                  ]}
                >
                  {variant === 'huit' && (
                    <Text style={[styles.colorBallSuit, { color: colorPaint(variant, c) }]}>
                      {SUIT_SYMBOLS[c]}
                    </Text>
                  )}
                </View>
                <Text style={styles.colorName}>{colorLabel(variant, c)}</Text>
              </Pressable>
            ))}
          </View>
          <Button compact variant="secondary" label={t('Annuler')} onPress={onCancel} />
        </Panel>
      </Appear>
    </View>
  );
}

/** Pass-and-play: hides the table until the next person holds the phone. */
function HandOff({ name, avatar, onReady }: { name: string; avatar: Avatar; onReady: () => void }) {
  return (
    <View style={[styles.overlay, styles.overlayDark]}>
      <Appear from={20} style={styles.overlayCard}>
        <Panel compact title={t('Passe le téléphone')}>
          <View style={styles.handoff}>
            <AvatarBadge avatar={avatar} size={56} />
            <Text style={styles.handoffName}>{t('Au tour de {name}', { name })}</Text>
            <Text style={styles.exHint}>{t('Les autres, ne regardez pas ses cartes !')}</Text>
          </View>
          <Button compact label={t('Je suis {name}, voir mes cartes', { name })} onPress={onReady} />
        </Panel>
      </Appear>
    </View>
  );
}

function RoundRecap({
  variant,
  state,
  avatars,
  bots,
  me,
  hint,
  onNext,
  onStop,
  onResults,
}: {
  variant: UnoVariant;
  state: UnoState;
  avatars: Avatar[];
  bots: boolean[];
  /** Online: my seat, so the win is "Tu gagnes" only when it is mine. */
  me?: number;
  /** A line under the buttons, e.g. when the next round starts on its own. */
  hint?: string;
  /** Missing for someone who only watches an online game. */
  onNext?: () => void;
  /** Missing online: the game goes on until its target. */
  onStop?: () => void;
  onResults: () => void;
}) {
  const winner = state.roundWinner!;
  const name = state.players[winner].name;
  // With a single person at the table, their win is "Tu gagnes".
  const soloWin = me !== undefined ? me === winner : !bots[winner] && bots.filter((b) => !b).length === 1;
  const over = state.phase === 'gameOver';
  const single = state.target === 0;
  const rows = state.players
    .map((p, i) => ({ i, p, pts: unoHandPoints(state, i) }))
    .sort((a, b) => (a.i === winner ? -1 : b.i === winner ? 1 : a.pts - b.pts));
  return (
    <View style={styles.overlay}>
      <Appear from={20} style={styles.overlayCard}>
        <Panel compact title={single ? t('Fin de la partie') : t('Fin de la manche {n}', { n: state.round })}>
          <View style={styles.recapHead}>
            <Text style={styles.recapTrophy}>{bots[winner] ? '🃏' : '🏆'}</Text>
            <Text style={styles.recapWinner}>
              {single || over
                ? soloWin
                  ? t('Tu gagnes la partie !')
                  : t('{name} gagne la partie !', { name })
                : soloWin
                  ? t('Tu gagnes la manche !')
                  : t('{name} gagne la manche !', { name })}
            </Text>
            {!single && (
              <Text style={styles.exHint}>
                {soloWin
                  ? t('+{n} points pour toi', { n: state.roundPoints })
                  : t('+{n} points pour {name}', { n: state.roundPoints, name })}
              </Text>
            )}
          </View>
          {rows.map(({ i, p, pts }) => (
            <View key={p.id} style={[styles.recapRow, i === winner && styles.recapMe]}>
              <AvatarBadge avatar={avatars[i]} size={22} />
              <Text style={styles.recapName} numberOfLines={1}>
                {p.name}
              </Text>
              <View style={styles.recapCards}>
                {i === winner ? (
                  <Text style={styles.recapDone}>{t('Plus de cartes')}</Text>
                ) : (
                  p.hand.slice(0, 6).map((c, k) => (
                    <View key={c} style={{ marginLeft: k ? -14 : 0 }}>
                      <GameCard variant={variant} card={c} width={26} />
                    </View>
                  ))
                )}
                {p.hand.length > 6 && <Text style={styles.recapMore}>+{p.hand.length - 6}</Text>}
              </View>
              {!single && <Text style={styles.recapTotal}>{p.score}</Text>}
            </View>
          ))}
          {!single && !over && (
            <Text style={styles.exHint}>{t('Premier à {n} points', { n: state.target })}</Text>
          )}
          {over ? (
            <Button compact label={t('Voir le résultat')} onPress={onResults} />
          ) : (
            <View style={styles.actions}>
              {onStop && (
                <View style={styles.flex}>
                  <Button compact variant="secondary" label={t('Arrêter')} onPress={onStop} />
                </View>
              )}
              {onNext && (
                <View style={styles.flex}>
                  <Button compact label={t('Manche suivante')} onPress={onNext} />
                </View>
              )}
            </View>
          )}
          {hint && !over && <Text style={styles.exHint}>{hint}</Text>}
        </Panel>
      </Appear>
    </View>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

function FinalScreen({
  variant,
  state,
  bots,
  avatars,
  me,
  onReplay,
  onQuit,
  quitLabel = t('Retour'),
}: {
  variant: UnoVariant;
  state: UnoState;
  bots: boolean[];
  avatars: Avatar[];
  /** Online: my seat (-1 when watching), so "Tu gagnes" is only said to the winner. */
  me?: number;
  /** Missing online: a new game is a new table. */
  onReplay?: () => void;
  onQuit: () => void;
  quitLabel?: string;
}) {
  const single = state.target === 0;
  const standings = single
    ? // One round: the winner, then whoever has the fewest points left in hand.
      state.players
        .map((p, index) => ({ index, name: p.name, score: unoHandPoints(state, index) }))
        .sort((a, b) => a.score - b.score)
        .map((s, k, all) => ({ ...s, place: all.findIndex((x) => x.score === s.score) + 1 }))
    : unoStandings(state);
  const first = state.winner ?? standings[0].index;
  const humanWon = !bots[first];
  const humans = bots.filter((b) => !b).length;
  const youWon = me !== undefined ? me === first : humanWon && humans === 1;
  const rounds = state.round;
  return (
    <ScrollView contentContainerStyle={styles.setup}>
      <Appear>
        <Text style={styles.trophy}>{humanWon ? '🏆' : '🤖'}</Text>
      </Appear>
      <Text style={styles.title}>
        {youWon ? t('Tu gagnes !') : t('{name} gagne !', { name: state.players[first].name })}
      </Text>
      <Text style={styles.subtitle}>
        {TEXTS[variant].title} ·{' '}
        {single
          ? t('une manche')
          : tn(rounds, '{n} manche · objectif {target} points', '{n} manches · objectif {target} points', {
              target: state.target,
            })}
      </Text>
      <Panel title={t('Classement')}>
        {standings.map((s, k) => (
          <Appear key={s.index} delay={k * 80} from={10}>
            <View
              style={[
                styles.finalRow,
                (me !== undefined ? s.index === me : !bots[s.index]) && styles.recapMe,
              ]}
            >
              <Text style={styles.finalPlace}>{MEDALS[s.place - 1] ?? t('{n}ᵉ', { n: s.place })}</Text>
              <AvatarBadge avatar={avatars[s.index]} size={30} />
              <Text style={[styles.finalName, s.place === 1 && styles.finalNameFirst]} numberOfLines={1}>
                {state.players[s.index].name}
              </Text>
              <Text style={styles.finalScore}>
                {single
                  ? s.index === first
                    ? t('Main vide')
                    : tn(
                        state.players[s.index].hand.length,
                        '{n} carte · {pts} pts',
                        '{n} cartes · {pts} pts',
                        {
                          pts: s.score,
                        },
                      )
                  : t('{n} pts', { n: s.score })}
              </Text>
            </View>
          </Appear>
        ))}
        {single && (
          <Text style={styles.exHint}>{t('Ensuite, le moins de points restés en main l’emporte.')}</Text>
        )}
      </Panel>
      <View style={styles.spacer} />
      {onReplay && <Button label={t('Rejouer')} onPress={onReplay} />}
      <Button label={quitLabel} variant="secondary" onPress={onQuit} />
    </ScrollView>
  );
}

/* ---------------------------------------------------------------- online */

/** The length of the game, chosen when creating an online table. */
function SheddingOnlineOptions({ variant, value, onChange }: OnlineOptionsProps & { variant: UnoVariant }) {
  const targets = UNO_TARGETS[variant];
  const target = targets.includes(value.target as number) ? (value.target as number) : targets[1];
  return (
    <View>
      <Text style={styles.section}>{t('Durée de la partie')}</Text>
      <View style={styles.counts}>
        {targets.map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityState={{ selected: n === target }}
            onPress={() => onChange({ ...value, target: n })}
            style={[styles.count, n === target && styles.countOn]}
          >
            <Text style={[styles.countText, n === target && styles.countTextOn]}>
              {n === 0 ? t('1 manche') : t('{n} points', { n })}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>
        {target === 0
          ? t('Le premier qui vide sa main gagne la partie.')
          : t(
              'Le gagnant de chaque manche marque les cartes restées chez les autres. Premier à {n} points !',
              {
                n: target,
              },
            )}
      </Text>
    </View>
  );
}

export function UnoOnlineOptions(props: OnlineOptionsProps) {
  return <SheddingOnlineOptions variant="uno" {...props} />;
}

export function HuitOnlineOptions(props: OnlineOptionsProps) {
  return <SheddingOnlineOptions variant="huit" {...props} />;
}

export function UnoOnlineBoard(props: OnlineBoardProps<UnoView>) {
  return <SheddingOnlineBoard variant="uno" {...props} />;
}

export function HuitOnlineBoard(props: OnlineBoardProps<UnoView>) {
  return <SheddingOnlineBoard variant="huit" {...props} />;
}

/** The same table, each player on their own phone: my hand at the bottom, the others around. */
function SheddingOnlineBoard({
  variant,
  view: state,
  mySeat,
  seats,
  actors,
  deadline,
  now,
  betweenRounds,
  over,
  busy,
  error,
  onMove,
  onLeave,
}: OnlineBoardProps<UnoView> & { variant: UnoVariant }) {
  const tx = TEXTS[variant];
  const avatars = seats.map((s) => s.avatar);
  const bots = state.bots;
  const watching = mySeat < 0;
  // Someone who only watches sees the table from the first seat, without any hand.
  const viewer = watching ? 0 : mySeat;
  const [choosing, setChoosing] = useState<Card | null>(null);
  const [finished, setFinished] = useState(false);
  const desktop = useDesktop();
  const playing = state.phase === 'playing';
  const canAct = !watching && !busy && actors.includes(seats[mySeat].id);
  const myTurn = canAct && playing && state.current === mySeat;
  const me = state.players[viewer];
  const legal = useMemo(() => (myTurn ? unoLegalCards(state, mySeat) : []), [state, myTurn, mySeat]);
  const catchable = canAct && state.exposed !== null && unoCanCatch(state, mySeat, state.exposed);
  const canSay = canAct && unoCanSay(state, mySeat);

  // A wild card waiting for its color is forgotten once the turn has moved on.
  useEffect(() => {
    if (!myTurn) setChoosing(null);
  }, [myTurn]);

  // Sounds for what just happened, whoever did it.
  const prev = useRef(state);
  useEffect(() => {
    const before = prev.current;
    prev.current = state;
    if (before.seq === state.seq && before.round === state.round) return;
    if (state.phase !== 'playing' && before.phase === 'playing') {
      if (state.roundWinner === mySeat) sounds.win();
      else if (state.roundWinner !== null && !watching) sounds.lose();
      else sounds.chips();
      return;
    }
    const e = state.last;
    if (e?.type === 'play') sounds.card();
    else if (e?.type === 'draw') sounds.fold();
    else if (e?.type === 'say') sounds.reaction();
    else if (e?.type === 'catch') sounds.chips();
    if (!watching && state.current === mySeat && (before.current !== mySeat || before.phase !== 'playing'))
      sounds.myTurn();
  }, [state]);

  function tap(card: Card) {
    if (!myTurn || !legal.includes(card)) return;
    if (unoIsWild(variant, card)) setChoosing(card);
    else onMove({ type: 'play', card });
  }

  if (finished && over) {
    return (
      <FinalScreen
        variant={variant}
        state={state}
        bots={bots}
        avatars={avatars}
        me={mySeat}
        onQuit={onLeave}
        quitLabel={t('Quitter la table')}
      />
    );
  }

  const current = state.players[state.current];
  const currentBot = bots[state.current];
  let prompt: string;
  if (!playing) prompt = t('Manche terminée');
  else if (!watching && state.current === mySeat) {
    if (state.pendingDraw > 0)
      prompt = legal.length
        ? t('Pose un 2 ou pioche {n} cartes', { n: state.pendingDraw })
        : t('Pas de 2 : pioche {n} cartes', { n: state.pendingDraw });
    else if (state.drawn) prompt = t('La carte piochée va : joue-la ou garde-la');
    else if (me.hand.length === 2 && !me.said && legal.length)
      prompt = t('Plus que 2 cartes : annonce « {call} » avant de jouer', { call: tx.call });
    else if (legal.length) prompt = t('À toi ! Joue une carte');
    else prompt = t('Aucune carte ne va : pioche');
  } else
    prompt = currentBot
      ? t('🤖 {name} réfléchit…', { name: current.name })
      : t('Au tour de {name}', { name: current.name });

  const drawLabel =
    state.drawn !== null && state.current === mySeat
      ? t('Garder')
      : state.pendingDraw > 0
        ? t('Piocher {n}', { n: state.pendingDraw })
        : t('Piocher');
  const nextIn = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;

  return (
    <GameLayout
      top={
        <>
          <TopBar onBack={onLeave} backLabel={t('← Quitter')}>
            <Text style={styles.topInfo}>
              {state.target
                ? t('Manche {n} · {target} pts', { n: state.round, target: state.target })
                : tx.title}
            </Text>
            {state.target > 0 && !watching && (
              <View style={styles.scorePill}>
                <Text style={styles.scoreText}>{t('⭐ {n} pts', { n: me.score })}</Text>
              </View>
            )}
          </TopBar>
          {playing && deadline && !currentBot && (
            <TurnTimer
              deadline={deadline}
              now={now}
              name={state.current === mySeat ? t('Toi') : current.name}
              seconds={60}
            />
          )}
        </>
      }
      table={({ width, height }) => (
        <TableView
          variant={variant}
          state={state}
          avatars={avatars}
          bots={bots}
          viewer={viewer}
          width={width}
          height={height}
          canDraw={myTurn && unoCanDraw(state, mySeat)}
          onDraw={() => onMove({ type: 'draw' })}
        >
          {choosing && myTurn && (
            <ColorPicker
              variant={variant}
              onPick={(color) => {
                onMove({ type: 'play', card: choosing, color });
                setChoosing(null);
              }}
              onCancel={() => setChoosing(null)}
            />
          )}
          {!playing && state.roundWinner !== null && (
            <RoundRecap
              variant={variant}
              state={state}
              avatars={avatars}
              bots={bots}
              me={mySeat}
              hint={
                betweenRounds
                  ? nextIn
                    ? t('La suite commence toute seule dans {n} s.', { n: nextIn })
                    : t('La suite commence toute seule.')
                  : undefined
              }
              onNext={betweenRounds && !watching && !busy ? () => onMove({ type: 'next' }) : undefined}
              onResults={() => setFinished(true)}
            />
          )}
        </TableView>
      )}
      bottom={
        !playing ? null : (
          <View style={styles.bottom}>
            <Text
              style={[styles.prompt, desktop && styles.promptLarge, myTurn && styles.promptMine]}
              numberOfLines={1}
            >
              {prompt}
            </Text>
            {watching ? (
              <Text style={styles.prompt}>{t('Tu regardes la partie.')}</Text>
            ) : (
              <Hand
                variant={variant}
                cards={me.hand.filter((c) => c !== UNO_HIDDEN)}
                hidden={false}
                legal={legal}
                drawn={myTurn ? state.drawn : null}
                active={myTurn}
                onTap={tap}
              />
            )}
            {error && <Text style={styles.error}>{error}</Text>}
            {!watching && (
              <View style={[styles.actions, desktop && styles.actionsDesktop]}>
                <View style={styles.flex}>
                  <Button
                    compact
                    variant="secondary"
                    label={drawLabel}
                    disabled={!myTurn}
                    onPress={() => onMove(state.drawn !== null ? { type: 'pass' } : { type: 'draw' })}
                  />
                </View>
                <View style={styles.flex}>
                  <CallButton
                    label={catchable ? tx.counter : tx.call}
                    hot={canSay || catchable}
                    onPress={() =>
                      catchable ? onMove({ type: 'catch', target: state.exposed! }) : onMove({ type: 'say' })
                    }
                  />
                </View>
              </View>
            )}
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  setup: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  hero: { flexDirection: 'row', justifyContent: 'center', marginBottom: 12 },
  title: { color: colors.gold, fontSize: 32, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 15, textAlign: 'center', marginTop: 4 },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 22, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
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
  },
  botRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  botName: { color: colors.text, fontSize: 16 },
  botTag: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  remove: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  removeText: { color: colors.muted, fontSize: 16, fontWeight: '800' },
  counts: { flexDirection: 'row', gap: 8 },
  count: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  countOn: { backgroundColor: colors.gold, borderColor: colors.goldBorder },
  countText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  countTextOn: { color: colors.onGold },
  hint: { color: colors.muted, marginTop: 4, fontSize: 13 },
  error: { color: colors.gold, textAlign: 'center', fontSize: 13, marginTop: 4 },
  spacer: { height: 22 },

  topInfo: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  scorePill: {
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  scoreText: { color: colors.gold, fontWeight: '800', fontSize: 13 },

  rail: {
    position: 'absolute',
    top: 4,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 999,
    backgroundColor: colors.rail,
    borderWidth: 2,
    borderColor: colors.railBorder,
    padding: 10,
    overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(0,0,0,0.6), inset 0 2px 3px rgba(255,220,170,0.35)',
  },
  felt: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: colors.felt,
    borderWidth: 2,
    borderColor: colors.feltBorder,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 6px 18px rgba(0,0,0,0.55)',
  },
  feltGlow: {
    width: '60%',
    height: '50%',
    borderRadius: 999,
    backgroundColor: colors.glow,
    boxShadow: `0 0 60px 40px ${colors.glow}`,
  },
  feltLine: {
    position: 'absolute',
    top: 14,
    bottom: 14,
    left: 14,
    right: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 213, 120, 0.22)',
  },
  feltMark: { position: 'absolute', opacity: 0.1, color: '#ffffff' },
  direction: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(255, 230, 170, 0.13)',
    fontWeight: '300',
  },

  piles: { position: 'absolute', left: 0, flexDirection: 'row', justifyContent: 'center', gap: 26 },
  pilesLarge: { gap: 48 },
  deckCountLarge: { fontSize: 13, minWidth: 32, top: -10, right: -10, paddingVertical: 2 },
  underLarge: { gap: 8 },
  colorChipLarge: { paddingLeft: 4, paddingRight: 14, paddingVertical: 4, borderRadius: 18, gap: 8 },
  colorDotLarge: { width: 24, height: 24, borderRadius: 12 },
  colorTextLarge: { fontSize: 15 },
  captionLarge: { fontSize: 15, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 14 },
  avatarRingLarge: { borderRadius: 34, padding: 3 },
  plateLarge: { marginTop: -8, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3, gap: 2 },
  nameLarge: { fontSize: 14 },
  cardsLarge: { fontSize: 13 },
  fanRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  seatScoreLarge: { fontSize: 12, marginTop: 2 },
  bubbleLarge: { top: -8, right: -6 },
  bubbleTextLarge: { fontSize: 13, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  meRingLarge: { borderRadius: 20, padding: 2 },
  meNameLarge: { fontSize: 16, maxWidth: 220 },
  promptLarge: { fontSize: 16 },
  actionsDesktop: { width: '100%', maxWidth: 460, alignSelf: 'center' },
  handCardDesktop: { cursor: 'pointer' },
  deck: { alignItems: 'center' },
  deckUnder: { position: 'absolute' },
  deckReady: { borderRadius: 8, boxShadow: `0 0 0 2px ${colors.gold}, 0 0 16px ${colors.gold}` },
  deckCount: {
    position: 'absolute',
    top: -8,
    right: -8,
    minWidth: 26,
    textAlign: 'center',
    color: colors.onGold,
    backgroundColor: colors.gold,
    borderRadius: 10,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  emptyPile: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  discard: { alignItems: 'center', justifyContent: 'center' },
  discardUnder: { position: 'absolute', opacity: 0.85 },
  discardTop: { position: 'absolute' },
  under: { position: 'absolute', left: 0, alignItems: 'center', gap: 5 },
  chips: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  colorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 3,
    paddingRight: 10,
    paddingVertical: 3,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  colorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  colorSuit: { color: '#fff', fontSize: 11, lineHeight: 13, fontWeight: '900' },
  colorText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  pendingChip: {
    borderRadius: 14,
    backgroundColor: colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  caption: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
    maxWidth: '86%',
  },

  seat: { position: 'absolute', width: SEAT_W, alignItems: 'center' },
  avatarRing: { borderRadius: 24, padding: 2 },
  avatarActive: { backgroundColor: colors.gold, boxShadow: `0 0 14px ${colors.gold}` },
  plate: {
    marginTop: -6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignItems: 'center',
    width: SEAT_W,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  plateActive: { borderColor: colors.gold },
  name: { color: colors.text, fontWeight: '700', fontSize: 11 },
  cards: { color: colors.gold, fontWeight: '700', fontSize: 11 },
  cardsLast: { color: '#ff6b5e' },
  seatScore: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 1 },
  bubble: { position: 'absolute', top: -6, right: -10 },
  bubbleText: {
    backgroundColor: '#fffdf8',
    color: '#1b1b1b',
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
    boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
  },
  bubbleHot: { backgroundColor: '#e0312f', color: '#fff' },
  mePlate: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  meRing: { borderRadius: 14, padding: 2 },
  meName: { color: colors.text, fontWeight: '800', fontSize: 13, maxWidth: 140 },

  bottom: { gap: 6 },
  prompt: { color: colors.muted, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  promptMine: { color: colors.gold },
  hand: { alignItems: 'center' },
  handCard: { position: 'absolute' },
  cardOk: { borderRadius: 8, boxShadow: `0 0 0 2px ${colors.gold}, 0 6px 12px rgba(0,0,0,0.5)` },
  cardNew: { borderRadius: 8, boxShadow: `0 0 0 3px #4fd1ff, 0 0 14px #4fd1ff` },
  shade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 2,
    right: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(8, 20, 14, 0.5)',
  },
  empty: { color: colors.muted, position: 'absolute', alignSelf: 'center', top: 30 },
  actions: { flexDirection: 'row', gap: 8 },
  call: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  callHot: { borderColor: '#ffb4ad', boxShadow: '0 0 16px rgba(255, 80, 70, 0.7)' },
  callOff: { borderColor: colors.glassBorder, backgroundColor: colors.glass },
  callText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  callTextOff: { color: colors.muted, opacity: 0.6 },
  pressed: { opacity: 0.8 },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 24,
    padding: 6,
  },
  overlayDark: { backgroundColor: 'rgba(0,0,0,0.92)' },
  overlayCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 12,
    backgroundColor: colors.background,
    boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
  },
  colorRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 6 },
  colorPick: { alignItems: 'center', gap: 4, padding: 4 },
  colorBall: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 3px 8px rgba(0,0,0,0.5)',
  },
  colorBallSuit: { fontSize: 30, lineHeight: 34 },
  colorName: { color: colors.text, fontSize: 12, fontWeight: '800' },
  handoff: { alignItems: 'center', gap: 6, marginVertical: 8 },
  handoffName: { color: colors.gold, fontSize: 20, fontWeight: '900' },
  exHint: { color: colors.muted, textAlign: 'center', fontSize: 12 },
  recapHead: { alignItems: 'center', gap: 2, marginBottom: 4 },
  recapTrophy: { fontSize: 34 },
  recapWinner: { color: colors.gold, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  recapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  recapMe: { backgroundColor: 'rgba(255,255,255,0.1)' },
  recapName: { color: colors.text, fontWeight: '700', width: 82, fontSize: 13 },
  recapCards: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  recapDone: { color: colors.gold, fontSize: 12, fontWeight: '800' },
  recapMore: { color: colors.muted, fontSize: 11, fontWeight: '800', marginLeft: 4 },
  recapTotal: { color: colors.gold, fontWeight: '900', minWidth: 30, textAlign: 'right', fontSize: 13 },
  trophy: { fontSize: 64, textAlign: 'center' },
  finalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  finalPlace: { width: 30, textAlign: 'center', fontSize: 18, color: colors.muted, fontWeight: '700' },
  finalName: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  finalNameFirst: { color: colors.gold, fontWeight: '800' },
  finalScore: { color: colors.gold, fontSize: 15, fontWeight: '800' },
});
