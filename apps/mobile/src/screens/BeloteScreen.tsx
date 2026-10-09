import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  type Avatar,
  type BeloteMove,
  type BelotePlayedCard,
  type BeloteState,
  type BeloteSuit,
  type BeloteView,
  type Card,
  BELOTE_SUITS,
  BELOTE_SUIT_SYMBOLS,
  beloteApply,
  beloteBotMove,
  beloteLegalCards,
  beloteNewGame,
  beloteNextDeal,
  beloteTeamOf,
  beloteTrickWinnerIndex,
  botName,
  defaultAvatar,
} from '@appli-poker/engine';
import { AvatarBadge, AvatarPicker, SeatReaction } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { reportLocalGame, useFeat } from '../online/progress';
import { OnlineButton } from '../components/OnlineButton';
import { RulesButton } from '../components/Rules';
import { BELOTE_RULES } from '../rules';
import { GameLayout } from '../components/GameLayout';
import { Pill } from '../components/LevelPicker';
import { Appear, FloatUp } from '../components/Motion';
import { Panel, PanelText } from '../components/Panel';
import { PlayingCard } from '../components/PlayingCard';
import {
  ActionRow,
  SetupFrame,
  SideLine,
  SideSection,
  TableWithSide,
  isHovered,
} from '../components/TableSide';
import { TopBar } from '../components/TopBar';
import { TurnTimer } from '../components/TurnTimer';
import { sounds } from '../feedback';
import { COLUMN_MAX_WIDTH, useDesktop } from '../layout';
import type { OnlineBoardProps, OnlineOptionsProps } from '../online-games/types';
import { deviceRng } from '../rng';
import { t, tn } from '../i18n';
import { colors, gradients, seatColors, shadow } from '../theme';

/** How long a robot seems to think, in ms. */
const BOT_DELAY = 900;
/** How long a finished trick stays on the table, in ms. */
const TRICK_PAUSE = 1300;
const ME = 0;
const TEAM_NAMES = [t('Nous'), t('Eux')];

interface Settings {
  names: string[];
  avatars: Avatar[];
  target: number;
}

const isRed = (s: string) => s === 'h' || s === 'd';

export function BeloteScreen({ onBack, onOnline }: { onBack: () => void; onOnline?: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [round, setRound] = useState(0);
  if (!settings) return <BeloteSetup onStart={setSettings} onBack={onBack} onOnline={onOnline} />;
  return (
    <BeloteGame
      key={round}
      settings={settings}
      onReplay={() => setRound(round + 1)}
      onSettings={() => setSettings(null)}
      onBack={onBack}
    />
  );
}

// ------------------------------------------------------------------ Setup

function BeloteSetup({
  onStart,
  onBack,
  onOnline,
}: {
  onStart: (s: Settings) => void;
  onBack: () => void;
  onOnline?: () => void;
}) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<Avatar>(defaultAvatar(0));
  const [picking, setPicking] = useState(false);
  const [target, setTarget] = useState(1000);

  const me = name.trim() || t('Toi');
  const north = botName([me]);
  const west = botName([me, north]);
  const east = botName([me, north, west]);
  const names = [me, west, north, east];
  const robot = (seat: number): Avatar => ({ emoji: '🤖', color: seatColors[seat + 1] });

  const robotRow = (label: string, seat: number) => (
    <View style={styles.row}>
      <AvatarBadge avatar={robot(seat)} size={40} />
      <View style={[styles.input, styles.flex, styles.botRow]}>
        <Text style={styles.botName}>{names[seat]}</Text>
        <Text style={styles.botTag}>{label}</Text>
      </View>
    </View>
  );

  return (
    <SetupFrame
      phoneStyle={styles.setup}
      hero={['Jc', '9c', 'Ac', 'Tc'].map((c, i) => (
        <View
          key={c}
          style={{ transform: [{ rotate: `${(i - 1.5) * 9}deg` }, { translateY: Math.abs(i - 1.5) * 7 }] }}
        >
          <PlayingCard card={c} width={64} />
        </View>
      ))}
      intro={
        <>
          <Text style={styles.title}>Belote</Text>
          <Text style={styles.subtitle}>{t('Toi et ton partenaire robot contre deux robots.')}</Text>
          {onOnline && <OnlineButton onPress={onOnline} />}
          <RulesButton rules={BELOTE_RULES} />
        </>
      }
    >
      <Text style={styles.section}>{t('Nous')}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Changer ton avatar')}
          onPress={() => setPicking(!picking)}
        >
          <AvatarBadge avatar={avatar} size={40} />
        </Pressable>
        <TextInput
          style={[styles.input, styles.flex]}
          placeholder={t('Ton prénom')}
          placeholderTextColor={colors.muted}
          value={name}
          maxLength={14}
          onChangeText={setName}
        />
      </View>
      {picking && <AvatarPicker value={avatar} onChange={setAvatar} />}
      {robotRow(t('Partenaire'), 2)}

      <Text style={styles.section}>{t('Eux')}</Text>
      {robotRow(t('Adversaire'), 1)}
      {robotRow(t('Adversaire'), 3)}

      <Text style={styles.section}>{t('Partie en')}</Text>
      <View style={styles.pills}>
        <Pill label={t('501 points')} active={target === 501} onPress={() => setTarget(501)} />
        <Pill label={t('1000 points')} active={target === 1000} onPress={() => setTarget(1000)} />
      </View>
      <Text style={styles.hint}>
        {target === 501
          ? t('Une partie rapide, environ 5 donnes.')
          : t('La partie classique, environ 10 donnes.')}
      </Text>

      <View style={styles.spacer} />
      <Button
        label={t('Lancer la partie')}
        onPress={() => onStart({ names, avatars: [avatar, robot(1), robot(2), robot(3)], target })}
      />
      <Button label={t('Retour')} variant="secondary" onPress={onBack} />
    </SetupFrame>
  );
}

// ------------------------------------------------------------------ Game

function BeloteGame({
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
  const [game, setGame] = useState<BeloteState>(() =>
    beloteNewGame({ target: settings.target, rng: deviceRng, dealer: deviceRng(4) }),
  );
  /** A finished trick stays in the middle for a moment before play goes on. */
  const [holding, setHolding] = useState(false);
  const names = settings.names;
  const desktop = useDesktop();
  useFeat('capot', game.result?.kind === 'played' && game.result.capot === 0);

  const bidding = game.phase === 'bidding1' || game.phase === 'bidding2';
  const active = bidding || game.phase === 'playing';
  const myTurn = active && game.toAct === ME && !holding;
  const robotTurn = active && game.toAct !== ME && !holding;

  function apply(player: number, move: BeloteMove) {
    if (game.toAct !== player) return;
    const next = beloteApply(game, player, move);
    if (move.type === 'play') {
      sounds.card();
      if (next.trick.length === 0) setHolding(true);
    }
    if (next.phase === 'gameOver' && next.winner === 0) sounds.win();
    else if (next.phase === 'gameOver' && game.phase !== 'gameOver') sounds.lose();
    if (next.phase === 'gameOver' && game.phase !== 'gameOver') reportLocalGame('belote', next.winner === 0);
    setGame(next);
  }

  useEffect(() => {
    if (!holding) return;
    const id = setTimeout(() => setHolding(false), TRICK_PAUSE);
    return () => clearTimeout(id);
  }, [holding]);

  useEffect(() => {
    if (!robotTurn) return;
    const player = game.toAct;
    const id = setTimeout(() => apply(player, beloteBotMove(game)), BOT_DELAY);
    return () => clearTimeout(id);
  }, [game, robotTurn]);

  const wasMyTurn = useRef(false);
  useEffect(() => {
    if (myTurn && !wasMyTurn.current) sounds.myTurn();
    wasMyTurn.current = myTurn;
  }, [myTurn]);

  const legal =
    game.phase === 'playing' && game.toAct === ME
      ? beloteLegalCards(game.hands[ME], game.trick, game.trump!, ME)
      : [];

  // ---- Bottom: prompt, bids and my hand.
  let prompt: string;
  if (holding && game.lastTrick) {
    const w = game.lastTrick.winner;
    prompt = w === ME ? t('Tu remportes le pli !') : t('Pli pour {name}', { name: names[w] });
  } else if (game.phase === 'dealOver' || game.phase === 'gameOver') {
    prompt = game.phase === 'gameOver' ? t('Partie terminée') : t('Fin de la donne');
  } else if (robotTurn) {
    prompt = bidding
      ? t('🤖 {name} réfléchit…', { name: names[game.toAct] })
      : t('🤖 {name} joue…', { name: names[game.toAct] });
  } else {
    prompt = myPrompt(game, game.hands[ME], legal);
  }

  const result = game.result;
  const overlay = !result ? null : game.phase === 'gameOver' ? (
    <FinalPanel game={game} me={ME} names={names}>
      <View style={styles.finalButtons}>
        <Button compact label={t('Rejouer')} onPress={onReplay} />
        <Button compact variant="secondary" label={t('Réglages')} onPress={onSettings} />
      </View>
      <Button compact variant="secondary" label={t('Retour aux jeux')} onPress={onBack} />
    </FinalPanel>
  ) : result.kind === 'redeal' ? (
    <Appear>
      <Panel compact title={t('Personne ne prend')}>
        <PanelText>{t('On redistribue, c’est au joueur suivant de donner.')}</PanelText>
        <Button compact label={t('Redistribuer')} onPress={onNext} />
      </Panel>
    </Appear>
  ) : (
    <Appear>
      <DealSummary game={game} names={names} me={ME} />
      <View style={styles.nextButton}>
        <Button compact label={t('Donne suivante')} onPress={onNext} />
      </View>
    </Appear>
  );

  function onNext() {
    setHolding(false);
    setGame((g) => (g.phase === 'dealOver' ? beloteNextDeal(g, deviceRng) : g));
  }

  return (
    <GameLayout
      top={
        <TopBar onBack={onBack} backLabel={t('← Quitter')}>
          {/* On a computer the scores are in the panel beside the table. */}
          {!desktop && (
            <>
              <ScorePill label={t('Nous')} value={game.scores[0]} mine />
              <ScorePill label={t('Eux')} value={game.scores[1]} />
              <Text style={styles.target}>/ {game.target}</Text>
            </>
          )}
        </TopBar>
      }
      table={({ width, height }) => (
        <BeloteTable
          game={game}
          counts={game.hands.map((h) => h.length)}
          holding={holding}
          width={width}
          height={height}
          names={names}
          avatars={settings.avatars}
          bottom={ME}
          me={ME}
          overlay={overlay}
        />
      )}
      bottom={
        <>
          <View style={styles.controls}>
            <View style={[styles.prompt, myTurn && styles.promptMine]}>
              <Text style={[styles.promptText, myTurn && styles.promptTextMine]} numberOfLines={1}>
                {prompt}
              </Text>
            </View>
            {myTurn && <BidButtons game={game} onMove={(m) => apply(ME, m)} />}
          </View>
          <BeloteHand
            hand={game.hands[ME]}
            legal={myTurn ? legal : []}
            myPlay={game.phase === 'playing' && game.toAct === ME && !holding}
            onPlay={(card) => apply(ME, { type: 'play', card })}
          />
        </>
      }
    />
  );
}

/** What to tell me when it is my turn. */
function myPrompt(game: Omit<BeloteState, 'hands' | 'stock'>, hand: Card[], legal: Card[]): string {
  if (game.phase === 'bidding1')
    return t('À toi : tu prends à {suit} ?', { suit: BELOTE_SUIT_SYMBOLS[game.turnUp![1] as BeloteSuit] });
  if (game.phase === 'bidding2') return t('Second tour : choisis l’atout ou passe');
  return playHint(game, hand, legal);
}

/** Take or pass in the first round, a suit or pass in the second; nothing while cards are played. */
function BidButtons({
  game,
  disabled,
  onMove,
}: {
  game: Omit<BeloteState, 'hands' | 'stock'>;
  disabled?: boolean;
  onMove: (move: BeloteMove) => void;
}) {
  const turned = game.turnUp?.[1] as BeloteSuit | undefined;
  if (game.phase === 'bidding1')
    return (
      <ActionRow>
        <Button
          compact
          disabled={disabled}
          label={t('Prendre {suit}', { suit: BELOTE_SUIT_SYMBOLS[turned!] })}
          onPress={() => onMove({ type: 'take' })}
        />
        <Button
          compact
          disabled={disabled}
          variant="secondary"
          label={t('Passer')}
          onPress={() => onMove({ type: 'pass' })}
        />
      </ActionRow>
    );
  if (game.phase === 'bidding2')
    return (
      <ActionRow>
        {BELOTE_SUITS.filter((s) => s !== turned).map((s) => (
          <Button
            key={s}
            compact
            disabled={disabled}
            label={t('À {suit}', { suit: BELOTE_SUIT_SYMBOLS[s] })}
            onPress={() => onMove({ type: 'choose', suit: s })}
          />
        ))}
        <Button
          compact
          disabled={disabled}
          variant="secondary"
          label={t('Passer')}
          onPress={() => onMove({ type: 'pass' })}
        />
      </ActionRow>
    );
  return null;
}

/** My cards, fanned at the bottom: the playable ones rise, the others dim when it is my turn. */
function BeloteHand({
  hand,
  legal,
  myPlay,
  onPlay,
}: {
  hand: Card[];
  /** Cards I may play right now (empty when I may not play). */
  legal: Card[];
  /** It is my turn to play a card (to dim the others). */
  myPlay: boolean;
  onPlay: (card: Card) => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const desktop = useDesktop();
  // On a computer the hand gets the whole controls width, and bigger cards.
  const avail = desktop ? COLUMN_MAX_WIDTH + 180 : Math.min(screenWidth, 520) - 20;
  const cardW = desktop ? 88 : Math.min(60, Math.floor(avail / 6.2));
  const step = hand.length > 1 ? Math.min(cardW + 4, (avail - cardW - 4) / (hand.length - 1)) : 0;
  return (
    <View style={[styles.hand, { height: Math.round(cardW * 1.4) + 10 }]}>
      {hand.map((c, i) => {
        const playable = legal.includes(c);
        const dim = myPlay && !playable;
        return (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={t('Jouer {card}', { card: c })}
            disabled={!playable}
            onPress={() => onPlay(c)}
            style={(state) => [
              styles.handCard,
              { marginLeft: i === 0 ? 0 : step - cardW - 4 },
              playable && styles.handCardUp,
              playable && isHovered(state) && styles.handCardHover,
              dim && styles.handCardDim,
            ]}
          >
            <Appear from={30} delay={i * 40}>
              <PlayingCard card={c} width={cardW} />
            </Appear>
          </Pressable>
        );
      })}
    </View>
  );
}

function playHint(game: Omit<BeloteState, 'hands' | 'stock'>, hand: Card[], legal: Card[]): string {
  if (game.trick.length === 0) return t('À toi d’entamer');
  const led = game.trick[0].card[1] as BeloteSuit;
  const trump = game.trump!;
  if (legal.length === hand.length) return t('À toi : joue ce que tu veux');
  if (hand.some((c) => c[1] === led)) {
    if (led === trump && legal.length < hand.filter((c) => c[1] === led).length)
      return t('À toi : monte à l’atout !');
    return t('À toi : fournis à {suit}', { suit: BELOTE_SUIT_SYMBOLS[led] });
  }
  const trumped = game.trick.some((p) => p.card[1] === trump);
  return trumped && legal.length < hand.filter((c) => c[1] === trump).length
    ? t('À toi : surcoupe !')
    : t('À toi : coupe à {suit} !', { suit: BELOTE_SUIT_SYMBOLS[trump] });
}

function ScorePill({ label, value, mine }: { label: string; value: number; mine?: boolean }) {
  return (
    <View style={[styles.score, mine && styles.scoreMine]}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={styles.scoreValue}>{value}</Text>
    </View>
  );
}

function SuitChip({ suit, size = 22 }: { suit: BeloteSuit; size?: number }) {
  return (
    <View style={[styles.suitChip, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text
        style={{
          fontSize: size * 0.7,
          lineHeight: size * 0.9,
          color: isRed(suit) ? colors.red : colors.black,
        }}
      >
        {BELOTE_SUIT_SYMBOLS[suit]}
      </Text>
    </View>
  );
}

// ------------------------------------------------------------------ Table

function bidText(bid: 'pass' | 'take' | BeloteSuit): string {
  if (bid === 'pass') return t('Passe');
  if (bid === 'take') return t('Je prends !');
  return t('À {suit} !', { suit: BELOTE_SUIT_SYMBOLS[bid] });
}

/** The deal as the table shows it: hands are given as counts, so a player's own view is enough. */
type TableGame = Omit<BeloteState, 'hands' | 'stock'>;

/** Team names from my side of the table; a spectator sees the players' names instead. */
function teamName(team: number, me: number, names: string[]): string {
  if (me < 0) return `${names[team]} & ${names[team + 2]}`;
  return team === beloteTeamOf(me) ? t('Nous') : t('Eux');
}

type TableProps = {
  game: TableGame;
  /** How many cards each seat holds. */
  counts: number[];
  holding: boolean;
  width: number;
  height: number;
  names: string[];
  avatars: Avatar[];
  /** The seat drawn at the bottom (South of the screen). */
  bottom: number;
  /** My seat, or -1 when I am only watching. */
  me: number;
  /** Shown over the table once the deal is over. */
  overlay: ReactNode;
};

/** The table; on a computer it is landscape, with the scores in a panel on its right. */
function BeloteTable(props: TableProps) {
  const desktop = useDesktop();
  if (!desktop) return <BeloteFelt {...props} />;
  return (
    <TableWithSide
      width={props.width}
      height={props.height}
      maxAspect={1.75}
      side={<BeloteSide game={props.game} me={props.me} names={props.names} bottom={props.bottom} />}
      table={(size) => <BeloteFelt {...props} {...size} desktop />}
    />
  );
}

function BeloteFelt({
  game,
  counts,
  holding,
  width,
  height,
  names,
  avatars,
  bottom,
  me,
  overlay,
  desktop,
}: TableProps & { desktop?: boolean }) {
  // A phone gets a portrait table; a computer a landscape one filling the room.
  const w = desktop ? Math.min(width, Math.round(height * 1.75)) : Math.min(width, 480);
  const h = desktop ? Math.min(height, 680) : Math.min(height, Math.round(w * 1.5));
  const cx = w / 2;
  // On a computer the trick sits between the top player's cards and my name, as big as fits there.
  const cy = desktop ? Math.round((h + 138) / 2) : h / 2 + 6;
  const cw = desktop
    ? Math.max(58, Math.min(86, Math.floor((h - 242) / 2 / 1.4), Math.floor(h * 0.15)))
    : Math.max(40, Math.min(58, Math.floor(Math.min(w, h) * 0.15)));
  const ch = Math.round(cw * 1.4);
  const bidding = game.phase === 'bidding1' || game.phase === 'bidding2';
  const round = game.phase === 'bidding1' ? 1 : 2;
  /** Place of a seat on screen: 0 bottom, 1 left, 2 top, 3 right. */
  const place = (seat: number) => (seat - bottom + 4) % 4;

  // Where each place sits: bottom, left, top, right.
  const sideX = desktop ? Math.max(80, Math.round(w * 0.1)) : 38;
  const seatPos = [
    { x: cx, y: h - 22 },
    { x: sideX, y: desktop ? h / 2 : cy - 10 },
    { x: cx, y: desktop ? 54 : 42 },
    { x: w - sideX, y: desktop ? h / 2 : cy - 10 },
  ];
  // Where each place's card lands in the trick cross.
  const slot = [
    { x: cx - cw / 2, y: cy + 2, from: 30 },
    { x: cx - cw * 1.55, y: cy - ch / 2 - 6, from: 0 },
    { x: cx - cw / 2, y: cy - ch - 14, from: -30 },
    { x: cx + cw * 0.55, y: cy - ch / 2 - 6, from: 0 },
  ];

  const shownTrick: BelotePlayedCard[] = holding && game.lastTrick ? game.lastTrick.cards : game.trick;
  const winnerSeat =
    holding && game.lastTrick
      ? game.lastTrick.winner
      : game.trick.length > 0 && game.trump
        ? game.trick[beloteTrickWinnerIndex(game.trick, game.trump)].player
        : null;
  const showResult = (game.phase === 'dealOver' || game.phase === 'gameOver') && !holding;
  const ourTeam = beloteTeamOf(bottom);
  const myTeamTricks = game.tricksWon[ourTeam];
  const theirTricks = game.tricksWon[1 - ourTeam];

  return (
    <View style={{ width: w, height: h }}>
      <View style={styles.rail}>
        <LinearGradient colors={gradients.wood} style={StyleSheet.absoluteFill} />
        <View style={styles.felt}>
          <LinearGradient colors={gradients.felt} style={StyleSheet.absoluteFill} />
          <View style={styles.feltGlow} />
          <View style={styles.feltLine} />
        </View>
      </View>

      {/* Trump and taker, in the corner (in the side panel on a computer). */}
      {!desktop && game.trump && game.taker !== null && (
        <Appear style={styles.trumpBox} from={-10}>
          <Text style={styles.trumpLabel}>{t('Atout')}</Text>
          <SuitChip suit={game.trump} size={30} />
          <Text style={styles.trumpTaker} numberOfLines={1}>
            {game.taker === me ? t('pris par toi') : t('pris par {name}', { name: names[game.taker] })}
          </Text>
        </Appear>
      )}
      {!desktop && (
        <View style={styles.dealBox}>
          <Text style={styles.dealText}>{t('Donne {n}', { n: game.dealNumber })}</Text>
          {game.phase === 'playing' && (
            <Text style={styles.dealText}>
              {t('Plis {us}–{them}', { us: myTeamTricks, them: theirTricks })}
            </Text>
          )}
        </View>
      )}

      {/* Players around the table. */}
      {[1, 2, 3, 0].map((p) => {
        const seat = (p + bottom) % 4;
        const pos = seatPos[p];
        const turn = game.toAct === seat && !holding;
        const bid = bidding
          ? [...game.bids].reverse().find((b) => b.player === seat && b.round === round)
          : undefined;
        const count = counts[seat];
        const side = p === 1 || p === 3;
        const backW = desktop ? 30 : side ? 20 : 24;
        const seatW = desktop ? 150 : side ? 76 : 110;
        return (
          <View
            key={seat}
            pointerEvents="none"
            style={[
              styles.seat,
              {
                width: seatW,
                left: pos.x - seatW / 2,
                top: pos.y - (p === 0 ? 14 : desktop ? 40 : 30),
              },
            ]}
          >
            {p !== 0 && (
              <View style={[styles.avatarRing, turn && styles.avatarTurn]}>
                <AvatarBadge avatar={avatars[seat]} size={desktop ? 48 : side ? 36 : 34} />
                {game.dealer === seat && <Text style={styles.dealerChip}>D</Text>}
              </View>
            )}
            <View
              style={[
                styles.plate,
                desktop && styles.plateDesktop,
                turn && styles.plateTurn,
                beloteTeamOf(seat) === ourTeam && styles.plateUs,
              ]}
            >
              <Text style={[styles.plateName, desktop && styles.plateNameDesktop]} numberOfLines={1}>
                {names[seat]}
              </Text>
              {p === 0 && game.dealer === seat && <Text style={styles.dealerInline}>D</Text>}
            </View>
            {p === 0 && <SeatReaction avatar={avatars[seat]} size={30} />}
            {p !== 0 && count > 0 && (
              <View style={styles.backs}>
                {Array.from({ length: count }, (_, i) => (
                  <View key={i} style={{ marginLeft: i === 0 ? 0 : desktop ? -22 : side ? -17 : -18 }}>
                    <PlayingCard card="As" hidden width={backW} />
                  </View>
                ))}
              </View>
            )}
            {bid && (
              <Appear key={`${game.dealNumber}-${bid.round}-${bid.bid}`} from={-6} style={styles.bubbleWrap}>
                <Text style={[styles.bubble, bid.bid !== 'pass' && styles.bubbleTake]}>
                  {bidText(bid.bid)}
                </Text>
              </Appear>
            )}
            {game.announce?.player === seat && (
              <FloatUp key={`${game.dealNumber}-${game.announce.text}`} style={styles.announce}>
                <Text style={styles.announceText}>
                  {game.announce.text === 'Belote' ? t('Belote !') : t('Rebelote !')}
                </Text>
              </FloatUp>
            )}
          </View>
        );
      })}

      {/* Turned-up card during bidding. */}
      {bidding && game.turnUp && (
        <View style={[styles.turnUp, { left: cx - cw * 0.9, top: cy - ch * 0.75 }]}>
          <View style={styles.stockStack}>
            <PlayingCard card="As" hidden width={Math.round(cw * 0.8)} />
          </View>
          <Appear key={`${game.dealNumber}`} from={-20}>
            <PlayingCard card={game.turnUp} width={cw} />
          </Appear>
          <Text style={styles.turnUpLabel}>{game.phase === 'bidding1' ? t('Retournée') : t('2e tour')}</Text>
        </View>
      )}

      {/* The trick, as a cross. */}
      {shownTrick.map(({ player, card }) => {
        const p = place(player);
        return (
          <Appear
            key={`${game.dealNumber}-${card}`}
            from={slot[p].from}
            style={[
              styles.trickCard,
              { left: slot[p].x, top: slot[p].y, zIndex: p === 0 ? 3 : p === 2 ? 1 : 2 },
              winnerSeat === player && holding && styles.trickWinner,
            ]}
          >
            <PlayingCard card={card} width={cw} />
          </Appear>
        );
      })}

      {showResult && game.result && overlay && <View style={styles.overlay}>{overlay}</View>}
    </View>
  );
}

/** The panel beside the table on a computer: scores, trump and the current deal. */
function BeloteSide({
  game,
  me,
  names,
  bottom,
}: {
  game: TableGame;
  me: number;
  names: string[];
  bottom: number;
}) {
  const ourTeam = beloteTeamOf(bottom);
  const bidding = game.phase === 'bidding1' || game.phase === 'bidding2';
  return (
    <>
      <SideSection title={t('Score')}>
        {[ourTeam, 1 - ourTeam].map((team) => (
          <View key={team} style={[styles.sideTeam, team === ourTeam && styles.sideTeamMine]}>
            <View style={styles.sideTeamHead}>
              <Text style={styles.sideTeamName} numberOfLines={1}>
                {teamName(team, me, names)}
              </Text>
              <Text style={styles.sideTeamScore}>{game.scores[team]}</Text>
            </View>
            <View style={styles.sideBar}>
              <View
                style={[
                  styles.sideBarFill,
                  { width: `${Math.min(100, (100 * game.scores[team]) / game.target)}%` },
                ]}
              />
            </View>
          </View>
        ))}
        <Text style={styles.sideNote}>{t('Partie en {n} points', { n: game.target })}</Text>
      </SideSection>

      <SideSection title={t('Atout')}>
        {game.trump && game.taker !== null ? (
          <View style={styles.sideTrump}>
            <SuitChip suit={game.trump} size={36} />
            <Text style={styles.sideTrumpText} numberOfLines={2}>
              {game.taker === me ? t('pris par toi') : t('pris par {name}', { name: names[game.taker] })}
            </Text>
          </View>
        ) : (
          <Text style={styles.sideNote}>{bidding ? t('Enchères en cours…') : '–'}</Text>
        )}
      </SideSection>

      <SideSection title={t('Donne {n}', { n: game.dealNumber })}>
        {[ourTeam, 1 - ourTeam].map((team) => (
          <SideLine
            key={team}
            label={teamName(team, me, names)}
            value={tn(game.tricksWon[team], '{n} pli', '{n} plis')}
          />
        ))}
      </SideSection>
    </>
  );
}

function DealSummary({ game, names, me }: { game: TableGame; names: string[]; me: number }) {
  const r = game.result;
  if (!r || r.kind !== 'played') return null;
  const myTeam = me >= 0 ? beloteTeamOf(me) : 0;
  const other = 1 - myTeam;
  const us = r.takerTeam === myTeam;
  let title: string;
  if (me < 0) {
    title = r.capot !== null ? t('Capot !') : r.made ? t('Contrat réussi') : t('Dedans !');
  } else if (r.capot !== null) title = r.capot === myTeam ? t('Capot ! 🎉') : t('Capot pour eux…');
  else if (!r.made) title = us ? t('Dedans… 😬') : t('Ils sont dedans ! 🎉');
  else title = us ? t('Contrat réussi ✅') : t('Contrat réussi pour eux');
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryTitle}>{title}</Text>
      <View style={styles.summaryTaker}>
        <Text style={styles.summaryText}>
          {r.taker === me ? t('Tu as pris à') : t('{name} a pris à', { name: names[r.taker] })}
        </Text>
        <SuitChip suit={r.trump} size={20} />
      </View>
      <View style={styles.summaryTable}>
        <View style={styles.summaryRow}>
          <Text style={[styles.cell, styles.cellHead, styles.cellName]} />
          <Text style={[styles.cell, styles.cellHead]}>{t('Points')}</Text>
          <Text style={[styles.cell, styles.cellHead]}>{t('Belote')}</Text>
          <Text style={[styles.cell, styles.cellHead]}>{t('Marqué')}</Text>
        </View>
        {[myTeam, other].map((team) => (
          <View key={team} style={styles.summaryRow}>
            <Text style={[styles.cell, styles.cellName]} numberOfLines={1}>
              {teamName(team, me, names)}
            </Text>
            <Text style={styles.cell}>{r.cardPoints[team]}</Text>
            <Text style={styles.cell}>{r.belote[team] ? '+20' : '–'}</Text>
            <Text style={[styles.cell, styles.cellScore]}>+{r.dealPoints[team]}</Text>
          </View>
        ))}
      </View>
      {!r.made && (
        <Text style={styles.summaryNote}>
          {t('Le preneur n’a pas fait plus que la défense : {n} pour la défense.', {
            n: r.capot !== null ? 252 : 162,
          })}
        </Text>
      )}
      <Text style={styles.summaryTotal}>
        {teamName(myTeam, me, names)} {game.scores[myTeam]} · {teamName(other, me, names)}{' '}
        {game.scores[other]}
      </Text>
    </View>
  );
}

function FinalPanel({
  game,
  me,
  names,
  children,
}: {
  game: TableGame;
  me: number;
  names: string[];
  /** The buttons under the result. */
  children: ReactNode;
}) {
  const myTeam = me >= 0 ? beloteTeamOf(me) : 0;
  const other = 1 - myTeam;
  const won = game.winner === myTeam;
  const title =
    me < 0
      ? t('{team} gagnent la partie !', { team: teamName(game.winner ?? 0, me, names) })
      : won
        ? t('Vous gagnez la partie !')
        : t('Eux gagnent la partie');
  return (
    <Appear>
      <View style={styles.summary}>
        <Text style={styles.trophy}>{won || me < 0 ? '🏆' : '😢'}</Text>
        <Text style={styles.finalTitle}>{title}</Text>
        <View style={styles.finalScores}>
          {[myTeam, other].map((team) => (
            <View key={team} style={[styles.finalTeam, game.winner === team && styles.finalTeamWin]}>
              <Text style={styles.finalTeamName} numberOfLines={1}>
                {teamName(team, me, names)}
              </Text>
              <Text style={styles.finalTeamScore}>{game.scores[team]}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.summaryText}>
          {t('En {n} donnes · objectif {target}', { n: game.dealNumber, target: game.target })}
        </Text>
        <DealSummaryLine game={game} me={me} names={names} />
        {children}
      </View>
    </Appear>
  );
}

function DealSummaryLine({ game, me, names }: { game: TableGame; me: number; names: string[] }) {
  const r = game.result;
  if (!r || r.kind !== 'played') return null;
  const myTeam = me >= 0 ? beloteTeamOf(me) : 0;
  const other = 1 - myTeam;
  return (
    <Text style={styles.summaryNote}>
      {t(
        r.capot !== null
          ? 'Dernière donne : {us} +{a}, {them} +{b} (capot)'
          : !r.made
            ? 'Dernière donne : {us} +{a}, {them} +{b} (dedans)'
            : 'Dernière donne : {us} +{a}, {them} +{b}',
        {
          us: teamName(myTeam, me, names),
          a: r.dealPoints[myTeam],
          them: teamName(other, me, names),
          b: r.dealPoints[other],
        },
      )}
    </Text>
  );
}

// ------------------------------------------------------------------ Styles

const styles = StyleSheet.create({
  // Setup
  setup: { padding: 20, paddingTop: 60, maxWidth: 520, width: '100%', alignSelf: 'center' },
  title: { color: colors.gold, fontSize: 34, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.muted, textAlign: 'center', marginTop: 4, fontSize: 14 },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 20, marginBottom: 6 },
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
  pills: { flexDirection: 'row', gap: 6 },
  hint: { color: colors.muted, marginTop: 8, fontSize: 13 },
  spacer: { height: 20 },

  // Top bar
  score: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  scoreMine: { borderColor: colors.goldBorder },
  scoreLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  scoreValue: { color: colors.gold, fontSize: 16, fontWeight: '900' },
  target: { color: colors.muted, fontSize: 12, fontWeight: '700' },

  // Bottom
  prompt: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  promptMine: { backgroundColor: 'rgba(0,0,0,0.5)', borderColor: colors.gold },
  promptText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  promptTextMine: { color: colors.gold },
  controls: { height: 84, justifyContent: 'center', gap: 6 },
  hand: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', paddingTop: 4 },
  handCard: { transform: [{ translateY: 0 }] },
  handCardUp: { transform: [{ translateY: -8 }] },
  handCardHover: { transform: [{ translateY: -18 }] },
  handCardDim: { opacity: 0.38 },

  // Table
  rail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 36,
    backgroundColor: colors.rail,
    borderWidth: 2,
    borderColor: colors.railBorder,
    padding: 9,
    overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(0,0,0,0.6), inset 0 2px 3px rgba(255,220,170,0.35)',
  },
  felt: {
    flex: 1,
    borderRadius: 28,
    backgroundColor: colors.felt,
    borderWidth: 2,
    borderColor: colors.feltBorder,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 6px 18px rgba(0,0,0,0.55)',
  },
  feltGlow: {
    width: '55%',
    height: '40%',
    borderRadius: 999,
    backgroundColor: colors.glow,
    boxShadow: `0 0 60px 40px ${colors.glow}`,
  },
  feltLine: {
    position: 'absolute',
    top: 12,
    bottom: 12,
    left: 12,
    right: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 213, 120, 0.22)',
  },
  trumpBox: {
    position: 'absolute',
    top: 18,
    left: 18,
    alignItems: 'center',
    padding: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    gap: 2,
    maxWidth: 88,
  },
  trumpLabel: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  trumpTaker: { color: colors.text, fontSize: 10, fontWeight: '600' },
  suitChip: { backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow },
  dealBox: { position: 'absolute', top: 20, right: 20, alignItems: 'flex-end' },
  dealText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700' },
  seat: { position: 'absolute', width: 110, alignItems: 'center', zIndex: 4 },
  avatarRing: { borderRadius: 30, borderWidth: 2, borderColor: 'transparent', padding: 1 },
  avatarTurn: { borderColor: colors.gold, boxShadow: '0 0 14px rgba(255, 193, 7, 0.9)' },
  dealerChip: {
    position: 'absolute',
    right: -8,
    top: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: '#fff',
    color: '#111',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 18,
  },
  plate: {
    marginTop: -4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  plateUs: { borderColor: 'rgba(255, 213, 120, 0.4)' },
  plateTurn: { borderColor: colors.gold },
  plateName: { color: colors.text, fontWeight: '700', fontSize: 12, textAlign: 'center', flexShrink: 1 },
  plateDesktop: { paddingHorizontal: 10, paddingVertical: 3 },
  plateNameDesktop: { fontSize: 14 },
  dealerInline: {
    width: 15,
    height: 15,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    color: '#111',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 15,
  },
  backs: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 3, rowGap: 2 },
  bubbleWrap: { position: 'absolute', top: -14, zIndex: 6 },
  bubble: {
    color: '#212529',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  bubbleTake: { backgroundColor: 'rgba(255, 224, 130, 0.97)' },
  announce: { position: 'absolute', top: -30, zIndex: 8 },
  announceText: {
    color: colors.onGold,
    backgroundColor: colors.gold,
    fontWeight: '900',
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  turnUp: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
  stockStack: { marginRight: -10, transform: [{ rotate: '-8deg' }] },
  turnUpLabel: {
    position: 'absolute',
    bottom: -20,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  trickCard: { position: 'absolute' },
  trickWinner: { boxShadow: '0 0 16px 4px rgba(255, 193, 7, 0.85)', borderRadius: 6 },
  overlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 70,
    bottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  nextButton: { marginTop: 8 },
  summary: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    gap: 8,
    alignItems: 'stretch',
    minWidth: 260,
    maxWidth: 340,
  },
  summaryTitle: { color: colors.gold, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  summaryTaker: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  summaryText: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  summaryTable: { gap: 2 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  cell: { flex: 1, color: colors.text, fontSize: 14, textAlign: 'center' },
  cellHead: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  cellName: { textAlign: 'left', fontWeight: '800' },
  cellScore: { color: colors.gold, fontWeight: '900' },
  summaryNote: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  summaryTotal: { color: colors.text, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  trophy: { fontSize: 44, textAlign: 'center' },
  finalTitle: { color: colors.gold, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  finalScores: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  finalTeam: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  finalTeamWin: { borderColor: colors.gold },
  finalTeamName: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  finalTeamScore: { color: colors.text, fontSize: 26, fontWeight: '900' },
  finalButtons: { flexDirection: 'row', gap: 6 },
  errorLine: { color: colors.gold, textAlign: 'center', fontSize: 13 },

  // Side panel (computer)
  sideTeam: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 7,
  },
  sideTeamMine: { borderColor: colors.goldBorder },
  sideTeamHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  sideTeamName: { color: colors.text, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  sideTeamScore: { color: colors.gold, fontSize: 26, fontWeight: '900' },
  sideBar: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  sideBarFill: { height: 5, borderRadius: 3, backgroundColor: colors.gold },
  sideNote: { color: colors.muted, fontSize: 13 },
  sideTrump: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sideTrumpText: { color: colors.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
});

// ------------------------------------------------------------------ Online

/** Length of the game, chosen when creating an online table. */
export function BeloteOnlineOptions({ value, onChange }: OnlineOptionsProps) {
  const target = value.target === 501 ? 501 : 1000;
  return (
    <View>
      <Text style={styles.section}>{t('Partie en')}</Text>
      <View style={styles.pills}>
        <Pill
          label={t('501 points')}
          active={target === 501}
          onPress={() => onChange({ ...value, target: 501 })}
        />
        <Pill
          label={t('1000 points')}
          active={target === 1000}
          onPress={() => onChange({ ...value, target: 1000 })}
        />
      </View>
      <Text style={styles.hint}>
        {target === 501
          ? t('Une partie rapide, environ 5 donnes.')
          : t('La partie classique, environ 10 donnes.')}
      </Text>
    </View>
  );
}

/** The same table, each player on their own phone: I always sit at the bottom. */
export function BeloteOnlineBoard({
  view: game,
  mySeat,
  seats,
  actors,
  deadline,
  now,
  busy,
  error,
  onMove,
  onLeave,
}: OnlineBoardProps<BeloteView>) {
  const names = seats.map((s) => s.name);
  const avatars = seats.map((s) => s.avatar);
  const me = mySeat;
  const bottom = me >= 0 ? me : 0;
  const desktop = useDesktop();
  const myTeam = beloteTeamOf(bottom);
  const bidding = game.phase === 'bidding1' || game.phase === 'bidding2';
  const active = bidding || game.phase === 'playing';
  const myTurn = active && me >= 0 && game.toAct === me && actors.includes(seats[me].id);
  const actor = active ? seats[game.toAct] : undefined;

  /** A finished trick stays in the middle for a moment, until the next card is played. */
  const [holding, setHolding] = useState(false);
  const shownHold = holding && game.trick.length === 0;
  useEffect(() => {
    if (!holding) return;
    const id = setTimeout(() => setHolding(false), TRICK_PAUSE);
    return () => clearTimeout(id);
  }, [holding]);

  // Sounds and the trick pause follow what happens at the table, whoever played.
  const last = useRef(game);
  useEffect(() => {
    const before = last.current;
    last.current = game;
    if (before === game) return;
    const cardsLeft = (v: BeloteView) => v.handCounts.reduce((a, b) => a + b, 0);
    const played = before.phase === 'playing' && cardsLeft(game) < cardsLeft(before);
    if (played) sounds.card();
    if (played && game.trick.length === 0 && game.lastTrick) setHolding(true);
    if (game.phase === 'gameOver' && before.phase !== 'gameOver') {
      if (game.winner === myTeam) sounds.win();
      else if (me >= 0) sounds.lose();
    }
    if (myTurn && !(before.toAct === me && before.phase === game.phase)) sounds.myTurn();
  }, [game]);

  const legal =
    myTurn && game.phase === 'playing' ? beloteLegalCards(game.hands[me], game.trick, game.trump!, me) : [];

  let prompt: string;
  if (shownHold && game.lastTrick) {
    const w = game.lastTrick.winner;
    prompt = w === me ? t('Tu remportes le pli !') : t('Pli pour {name}', { name: names[w] });
  } else if (game.phase === 'dealOver' || game.phase === 'gameOver') {
    prompt = game.phase === 'gameOver' ? t('Partie terminée') : t('Fin de la donne');
  } else if (myTurn) {
    prompt = myPrompt(game, game.hands[me], legal);
  } else if (actor) {
    const who = `${actor.bot ? '🤖 ' : ''}${actor.name}`;
    prompt = bidding ? t('{name} réfléchit…', { name: who }) : t('{name} joue…', { name: who });
  } else {
    prompt = '';
  }

  const nextIn = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  const nextHint = (
    <Text style={styles.summaryNote}>
      {nextIn
        ? t('La suite commence toute seule dans {n} s.', { n: nextIn })
        : t('La suite commence toute seule.')}
    </Text>
  );
  const result = game.result;
  const overlay = !result ? null : game.phase === 'gameOver' ? (
    <FinalPanel game={game} me={me} names={names}>
      <Button compact label={t('Quitter la table')} onPress={onLeave} />
    </FinalPanel>
  ) : result.kind === 'redeal' ? (
    <Appear>
      <Panel compact title={t('Personne ne prend')}>
        <PanelText>{t('On redistribue, c’est au joueur suivant de donner.')}</PanelText>
        {me >= 0 && (
          <Button
            compact
            label={t('Redistribuer')}
            disabled={busy}
            onPress={() => onMove({ type: 'next' })}
          />
        )}
        {nextHint}
      </Panel>
    </Appear>
  ) : (
    <Appear>
      <DealSummary game={game} names={names} me={me} />
      <View style={styles.nextButton}>
        {me >= 0 && (
          <Button
            compact
            label={t('Donne suivante')}
            disabled={busy}
            onPress={() => onMove({ type: 'next' })}
          />
        )}
        {nextHint}
      </View>
    </Appear>
  );

  return (
    <GameLayout
      top={
        <>
          <TopBar onBack={onLeave} backLabel={t('← Quitter')}>
            {!desktop && (
              <>
                <ScorePill label={teamName(myTeam, me, names)} value={game.scores[myTeam]} mine />
                <ScorePill label={teamName(1 - myTeam, me, names)} value={game.scores[1 - myTeam]} />
                <Text style={styles.target}>/ {game.target}</Text>
              </>
            )}
          </TopBar>
          {deadline && actor && !actor.bot && (
            <TurnTimer deadline={deadline} now={now} name={myTurn ? t('Toi') : actor.name} seconds={60} />
          )}
        </>
      }
      table={({ width, height }) => (
        <BeloteTable
          game={game}
          counts={game.handCounts}
          holding={shownHold}
          width={width}
          height={height}
          names={names}
          avatars={avatars}
          bottom={bottom}
          me={me}
          overlay={overlay}
        />
      )}
      bottom={
        <>
          <View style={styles.controls}>
            <View style={[styles.prompt, myTurn && styles.promptMine]}>
              <Text style={[styles.promptText, myTurn && styles.promptTextMine]} numberOfLines={1}>
                {prompt}
              </Text>
            </View>
            {error && <Text style={styles.errorLine}>{error}</Text>}
            {myTurn && <BidButtons game={game} disabled={busy} onMove={onMove} />}
          </View>
          <BeloteHand
            hand={me >= 0 ? game.hands[me] : []}
            legal={busy ? [] : legal}
            myPlay={myTurn && game.phase === 'playing'}
            onPlay={(card) => onMove({ type: 'play', card })}
          />
        </>
      }
    />
  );
}
