import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  type Avatar,
  type Card,
  type TarotBid,
  type TarotContract,
  type TarotMove,
  type TarotPlayedCard,
  type TarotState,
  type TarotView,
  TAROT_CONTRACTS,
  TAROT_CONTRACT_NAMES,
  TAROT_MULTIPLIERS,
  TAROT_SUIT_SYMBOLS,
  type TarotSuit,
  botName,
  defaultAvatar,
  tarotApply,
  tarotBotEcart,
  tarotBotMove,
  tarotEcartCandidates,
  tarotEcartError,
  tarotIsTrump,
  tarotLedSuit,
  tarotLegalCards,
  tarotNewGame,
  tarotNextDeal,
  tarotTrickWinnerIndex,
} from '@appli-poker/engine';
import { AvatarBadge, AvatarPicker } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { reportLocalGame } from '../online/progress';
import { OnlineButton } from '../components/OnlineButton';
import { RulesButton } from '../components/Rules';
import { TAROT_RULES } from '../rules';
import { GameLayout } from '../components/GameLayout';
import { Pill } from '../components/LevelPicker';
import { Appear } from '../components/Motion';
import { Panel, PanelText } from '../components/Panel';
import { TAROT_RATIO, TarotCard } from '../components/TarotCard';
import { TopBar } from '../components/TopBar';
import { TurnTimer } from '../components/TurnTimer';
import { sounds } from '../feedback';
import type { OnlineBoardProps, OnlineOptionsProps } from '../online-games/types';
import { deviceRng } from '../rng';
import { lang, t, tn } from '../i18n';
import { colors, gradients, seatColors, shadow } from '../theme';

/** How long a robot seems to think, in ms. */
const BOT_DELAY = 850;
/** How long the chien stays face up when a robot takes it, in ms. */
const CHIEN_PAUSE = 2600;
/** How long a finished trick stays on the table, in ms. */
const TRICK_PAUSE = 1300;
const ME = 0;

interface Settings {
  names: string[];
  avatars: Avatar[];
  deals: number;
}

const half = (n: number) =>
  Number.isInteger(n) ? String(n) : lang === 'fr' ? n.toFixed(1).replace('.', ',') : n.toFixed(1);
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export function TarotScreen({ onBack, onOnline }: { onBack: () => void; onOnline?: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [round, setRound] = useState(0);
  if (!settings) return <TarotSetup onStart={setSettings} onBack={onBack} onOnline={onOnline} />;
  return (
    <TarotGame
      key={round}
      settings={settings}
      onReplay={() => setRound(round + 1)}
      onSettings={() => setSettings(null)}
      onBack={onBack}
    />
  );
}

// ------------------------------------------------------------------ Setup

function TarotSetup({
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
  const [deals, setDeals] = useState(4);

  const me = name.trim() || t('Toi');
  const names = [me];
  for (let i = 1; i < 4; i++) names.push(botName(names));
  const robot = (seat: number): Avatar => ({ emoji: '🤖', color: seatColors[seat + 1] });

  return (
    <ScrollView contentContainerStyle={styles.setup} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Tarot</Text>
      <Text style={styles.subtitle}>
        {t('Toi contre trois robots : à chaque donne, un preneur seul contre tous.')}
      </Text>
      {onOnline && <OnlineButton onPress={onOnline} />}
      <RulesButton rules={TAROT_RULES} />

      <Text style={styles.section}>{t('Joueurs')}</Text>
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
      {[1, 2, 3].map((seat) => (
        <View key={seat} style={styles.row}>
          <AvatarBadge avatar={robot(seat)} size={40} />
          <View style={[styles.input, styles.flex, styles.botRow]}>
            <Text style={styles.botName}>{names[seat]}</Text>
            <Text style={styles.botTag}>{t('Robot')}</Text>
          </View>
        </View>
      ))}

      <Text style={styles.section}>{t('Partie en')}</Text>
      <View style={styles.pills}>
        <Pill label={t('{n} donnes', { n: 4 })} active={deals === 4} onPress={() => setDeals(4)} />
        <Pill label={t('{n} donnes', { n: 8 })} active={deals === 8} onPress={() => setDeals(8)} />
      </View>
      <Text style={styles.hint}>
        {deals === 4
          ? t('Chacun donne une fois : une partie rapide.')
          : t('Chacun donne deux fois : la partie complète.')}
      </Text>

      <View style={styles.spacer} />
      <Button
        label={t('Lancer la partie')}
        onPress={() => onStart({ names, avatars: [avatar, robot(1), robot(2), robot(3)], deals })}
      />
      <Button label={t('Retour')} variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

// ------------------------------------------------------------------ Game

function TarotGame({
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
  const [game, setGame] = useState<TarotState>(() =>
    tarotNewGame({ deals: settings.deals, rng: deviceRng, dealer: deviceRng(4) }),
  );
  /** A finished trick stays in the middle for a moment before play goes on. */
  const [holding, setHolding] = useState(false);
  /** Cards I picked for my écart. */
  const [selected, setSelected] = useState<Card[]>([]);
  const names = settings.names;

  const active = game.phase === 'bidding' || game.phase === 'ecart' || game.phase === 'playing';
  const myTurn = active && game.toAct === ME && !holding;
  const robotTurn = active && game.toAct !== ME && !holding;

  function apply(player: number, move: TarotMove) {
    if (game.toAct !== player) return;
    const next = tarotApply(game, player, move);
    if (move.type === 'play') {
      sounds.card();
      if (next.trick.length === 0) setHolding(true);
    }
    if (move.type === 'ecart') setSelected([]);
    if (next.phase === 'gameOver' && game.phase !== 'gameOver') {
      const won = next.winners!.includes(ME);
      if (won) sounds.win();
      reportLocalGame('tarot', won);
    }
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
    const id = setTimeout(
      () => apply(player, tarotBotMove(game)),
      game.phase === 'ecart' ? CHIEN_PAUSE : BOT_DELAY,
    );
    return () => clearTimeout(id);
  }, [game, robotTurn]);

  const wasMyTurn = useRef(false);
  useEffect(() => {
    if (myTurn && !wasMyTurn.current) sounds.myTurn();
    wasMyTurn.current = myTurn;
  }, [myTurn]);

  const hand = game.hands[ME];
  const legal = game.phase === 'playing' && game.toAct === ME ? tarotLegalCards(hand, game.trick) : [];
  const ecarting = game.phase === 'ecart' && game.toAct === ME;
  const candidates = ecarting ? tarotEcartCandidates(hand) : [];
  const ecartError = ecarting ? tarotEcartError(hand, selected) : null;

  function toggle(card: Card) {
    if (selected.includes(card)) setSelected(selected.filter((c) => c !== card));
    else if (selected.length < 6) setSelected([...selected, card]);
  }

  // ---- Bottom: prompt, bids and my hand.
  let prompt: string;
  if (holding && game.lastTrick) {
    const w = game.lastTrick.winner;
    prompt = w === ME ? t('Tu remportes le pli !') : t('Pli pour {name}', { name: names[w] });
  } else if (game.phase === 'dealOver' || game.phase === 'gameOver') {
    prompt = game.phase === 'gameOver' ? t('Partie terminée') : t('Fin de la donne');
  } else if (robotTurn) {
    prompt =
      game.phase === 'bidding'
        ? t('🤖 {name} réfléchit…', { name: names[game.toAct] })
        : game.phase === 'ecart'
          ? t('🤖 {name} prend le chien et fait son écart…', { name: names[game.toAct] })
          : t('🤖 {name} joue…', { name: names[game.toAct] });
  } else if (game.phase === 'bidding') {
    prompt = t('À toi d’annoncer : prends-tu ?');
  } else if (ecarting) {
    prompt = t('Choisis 6 cartes pour ton écart ({n}/6)', { n: selected.length });
  } else {
    prompt = playHint(game, hand, legal);
  }

  function onNext() {
    setHolding(false);
    setSelected([]);
    setGame((g) => (g.phase === 'dealOver' ? tarotNextDeal(g, deviceRng) : g));
  }

  const result = game.result;
  const overlay = !result ? null : game.phase === 'gameOver' ? (
    <FinalPanel game={game} names={names} me={ME}>
      <View style={styles.finalButtons}>
        <Button compact label={t('Rejouer')} onPress={onReplay} />
        <Button compact variant="secondary" label={t('Réglages')} onPress={onSettings} />
      </View>
      <Button compact variant="secondary" label={t('Retour aux jeux')} onPress={onBack} />
    </FinalPanel>
  ) : result.kind === 'redeal' ? (
    <Appear>
      <Panel compact title={result.reason === 'petitSec' ? t('Petit sec !') : t('Personne ne prend')}>
        <PanelText>
          {result.reason === 'petitSec'
            ? result.player === ME
              ? t('Tu as le Petit pour seul atout : la donne est annulée.')
              : t('{name} a le Petit pour seul atout : la donne est annulée.', { name: names[result.player] })
            : t('Tout le monde passe : on redistribue, c’est au joueur suivant de donner.')}
        </PanelText>
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

  return (
    <GameLayout
      top={
        <TopBar onBack={onBack} backLabel={t('← Quitter')}>
          <Text style={styles.dealCount}>
            {t('Donne {n}/{total}', { n: Math.min(game.dealNumber, game.deals), total: game.deals })}
          </Text>
          <View style={[styles.score, styles.scoreMine]}>
            <Text style={styles.scoreLabel}>{t('Toi')}</Text>
            <Text style={styles.scoreValue}>{signed(game.scores[ME])}</Text>
          </View>
        </TopBar>
      }
      table={({ width, height }) => (
        <TarotTable
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
            {myTurn && game.phase === 'bidding' && (
              <BidButtons game={game} onBid={(bid) => apply(ME, { type: 'bid', bid })} />
            )}
            {ecarting && (
              <View style={styles.ecartButtons}>
                <Button
                  compact
                  variant="secondary"
                  label={t('Suggestion')}
                  onPress={() => setSelected(tarotBotEcart(hand))}
                />
                <Button
                  compact
                  disabled={ecartError !== null}
                  label={
                    selected.length === 6 && ecartError
                      ? t(ecartError)
                      : t('Écarter {n}/6', { n: selected.length })
                  }
                  onPress={() => apply(ME, { type: 'ecart', cards: selected })}
                />
              </View>
            )}
          </View>
          <TarotHand
            hand={hand}
            playable={ecarting ? candidates : myTurn ? legal : []}
            selected={selected}
            fresh={ecarting ? game.chien : []}
            dimOthers={(game.phase === 'playing' && myTurn) || ecarting}
            onPress={(card) => (ecarting ? toggle(card) : apply(ME, { type: 'play', card }))}
          />
        </>
      }
    />
  );
}

/** What the table shows: the local game's state, or what the server lets me see of an online one. */
type TableGame = Omit<TarotView, 'hands' | 'handCounts'>;

function playHint(game: TableGame, hand: Card[], legal: Card[]): string {
  const led = tarotLedSuit(game.trick);
  if (game.trick.length === 0) return t('À toi d’entamer');
  if (led === null || legal.length === hand.length) return t('À toi : joue ce que tu veux');
  if (led === 't')
    return legal.some(tarotIsTrump) ? t('À toi : atout demandé, monte si tu peux') : t('À toi');
  if (hand.some((c) => c.endsWith(led) && !tarotIsTrump(c)))
    return t('À toi : fournis à {suit}', { suit: TAROT_SUIT_SYMBOLS[led as TarotSuit] });
  const trumped = game.trick.some((p) => tarotIsTrump(p.card));
  return trumped ? t('À toi : surcoupe si tu peux !') : t('À toi : coupe à l’atout !');
}

/** Pass or a contract higher than the best one so far. */
function BidButtons({
  game,
  disabled,
  onBid,
}: {
  game: TableGame;
  disabled?: boolean;
  onBid: (bid: TarotBid) => void;
}) {
  const best = game.bids.reduce(
    (m, b) => (b.bid !== 'pass' && TAROT_CONTRACTS.indexOf(b.bid) > m ? TAROT_CONTRACTS.indexOf(b.bid) : m),
    -1,
  );
  const short: Record<TarotContract, string> = {
    petite: t('Petite'),
    garde: t('Garde'),
    gardeSans: t('G. sans'),
    gardeContre: t('G. contre'),
  };
  return (
    <View style={styles.bids}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Passe')}
        disabled={disabled}
        onPress={() => onBid('pass')}
        style={({ pressed }) => [styles.bid, styles.bidPass, pressed && styles.pressed]}
      >
        <Text style={styles.bidText}>{t('Passe')}</Text>
      </Pressable>
      {TAROT_CONTRACTS.map((c, i) => {
        const allowed = i > best;
        return (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={t(TAROT_CONTRACT_NAMES[c])}
            disabled={!allowed || disabled}
            onPress={() => onBid(c)}
            style={({ pressed }) => [styles.bid, !allowed && styles.bidOff, pressed && styles.pressed]}
          >
            {allowed && <LinearGradient colors={gradients.gold} style={StyleSheet.absoluteFill} />}
            <Text style={[styles.bidText, allowed && styles.bidTextGold]} numberOfLines={1}>
              {short[c]}
            </Text>
            <Text style={[styles.bidMult, allowed && styles.bidMultGold]}>×{TAROT_MULTIPLIERS[c]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** My cards, in one row or two overlapping rows when there are many. */
function TarotHand({
  hand,
  playable,
  selected,
  fresh,
  dimOthers,
  onPress,
}: {
  hand: Card[];
  /** Cards I may touch right now. */
  playable: Card[];
  /** Cards picked for the écart. */
  selected: Card[];
  /** Cards that just came from the chien. */
  fresh: Card[];
  dimOthers: boolean;
  onPress: (card: Card) => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const avail = Math.min(screenWidth, 560) - 24;
  const fit = (n: number) => Math.max(40, Math.min(58, Math.floor(avail / (1 + (n - 1) * 0.78))));
  const stepFor = (n: number, w: number) => (n > 1 ? Math.min(w + 3, (avail - w - 4) / (n - 1)) : 0);
  // On a phone a full hand of 18 is too wide for one row: use two rows for the whole deal, so the
  // table does not jump as cards are played. A wide screen keeps one row.
  const phone = fit(18) < 48;
  const twoRows = phone && hand.length > 5;
  const perRow = twoRows ? Math.ceil(hand.length / 2) : hand.length;
  const rows = twoRows ? [hand.slice(0, perRow), hand.slice(perRow)] : [hand];
  // Same size all deal long (the 24 cards of the écart only shrink them for a moment).
  const usual = phone ? fit(9) : fit(18);
  const cardW = Math.min(usual, fit(perRow));
  const cardH = Math.round(cardW * TAROT_RATIO);
  const overlap = Math.round(cardH * 0.3);
  const usualH = Math.round(usual * TAROT_RATIO);
  const height = phone ? 2 * usualH - Math.round(usualH * 0.3) : usualH;
  return (
    <View style={[styles.hand, { height: height + 12 }]}>
      {rows.map((row, r) => {
        const step = stepFor(row.length, cardW);
        return (
          <View key={r} style={[styles.handRow, r > 0 && { marginTop: -overlap }]}>
            {row.map((c, i) => {
              const can = playable.includes(c);
              const picked = selected.includes(c);
              return (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={t('Carte {card}', { card: c })}
                  disabled={!can}
                  onPress={() => onPress(c)}
                  style={[
                    styles.handCard,
                    { marginLeft: i === 0 ? 0 : step - cardW - 4 },
                    can && !picked && dimOthers && styles.handCardUp,
                    picked && styles.handCardPicked,
                    dimOthers && !can && styles.handCardDim,
                  ]}
                >
                  <Appear from={30} delay={(r * row.length + i) * 25}>
                    <TarotCard card={c} width={cardW} />
                    {picked && (
                      <View style={[styles.pickedRing, { borderRadius: Math.max(4, cardW * 0.1) }]} />
                    )}
                    {fresh.includes(c) && !picked && <View style={styles.freshDot} />}
                  </Appear>
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

// ------------------------------------------------------------------ Table

function bidText(bid: TarotBid): string {
  return bid === 'pass' ? t('Passe') : t('{contract} !', { contract: t(TAROT_CONTRACT_NAMES[bid]) });
}

function TarotTable({
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
}: {
  game: TableGame;
  /** How many cards each seat holds. */
  counts: number[];
  holding: boolean;
  width: number;
  height: number;
  names: string[];
  avatars: Avatar[];
  /** The seat drawn at the bottom of the screen. */
  bottom: number;
  /** My seat, or -1 when I am only watching. */
  me: number;
  overlay: ReactNode;
}) {
  const w = Math.min(width, 480);
  const h = Math.min(height, Math.round(w * 1.55));
  const cx = w / 2;
  const cy = h / 2 + 4;
  const cw = Math.max(40, Math.min(56, Math.floor(Math.min(w, h) * 0.14)));
  const ch = Math.round(cw * TAROT_RATIO);
  /** Play goes round counter-clockwise: after me, the player on my right. */
  const place = (seat: number) => [0, 3, 2, 1][(seat - bottom + 4) % 4];

  // Where each place sits: bottom, left, top, right.
  const seatPos = [
    { x: cx, y: h - 22 },
    { x: 50, y: cy - 14 },
    { x: cx, y: 44 },
    { x: w - 50, y: cy - 14 },
  ];
  // Where each place's card lands in the trick cross.
  const slot = [
    { x: cx - cw / 2, y: cy + 4, from: 30 },
    { x: cx - cw * 1.6, y: cy - ch / 2 - 4, from: 0 },
    { x: cx - cw / 2, y: cy - ch - 12, from: -30 },
    { x: cx + cw * 0.6, y: cy - ch / 2 - 4, from: 0 },
  ];

  const shownTrick: TarotPlayedCard[] = holding && game.lastTrick ? game.lastTrick.cards : game.trick;
  const winnerSeat =
    holding && game.lastTrick
      ? game.lastTrick.winner
      : game.trick.length > 0
        ? game.trick[tarotTrickWinnerIndex(game.trick)].player
        : null;
  const showResult = (game.phase === 'dealOver' || game.phase === 'gameOver') && !holding;
  const chienShown = game.phase === 'ecart';
  const chienHidden = game.phase === 'bidding';
  const miniW = Math.max(30, Math.round(cw * 0.72));

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

      {/* Contract and taker, in the corner. */}
      {game.contract && game.taker !== null && (
        <Appear style={styles.contractBox} from={-10}>
          <Text style={styles.contractLabel}>{t(TAROT_CONTRACT_NAMES[game.contract])}</Text>
          <Text style={styles.contractTaker} numberOfLines={1}>
            {game.taker === me ? t('prise par toi') : t('par {name}', { name: names[game.taker] })}
          </Text>
          {game.contract === 'gardeSans' && <Text style={styles.contractNote}>{t('chien au preneur')}</Text>}
          {game.contract === 'gardeContre' && (
            <Text style={styles.contractNote}>{t('chien à la défense')}</Text>
          )}
        </Appear>
      )}
      {game.phase === 'playing' && game.taker !== null && (
        <View style={styles.trickBox}>
          <Text style={styles.trickText}>{t('Plis du preneur : {n}', { n: game.tricksWon[0] })}</Text>
          <Text style={styles.trickText}>{t('de la défense : {n}', { n: game.tricksWon[1] })}</Text>
        </View>
      )}

      {/* Players around the table. */}
      {[1, 2, 3, 0].map((seat) => {
        const p = place(seat);
        const pos = seatPos[p];
        const turn = game.toAct === seat && !holding;
        const bid = game.phase === 'bidding' ? game.bids.find((b) => b.player === seat) : undefined;
        const count = counts[seat];
        const side = p === 1 || p === 3;
        const isTaker = game.taker === seat && game.phase !== 'bidding';
        return (
          <View
            key={seat}
            pointerEvents="none"
            style={[
              styles.seat,
              { width: side ? 96 : 130, left: pos.x - (side ? 48 : 65), top: pos.y - (p === 0 ? 14 : 30) },
            ]}
          >
            {p !== 0 && (
              <View style={[styles.avatarRing, turn && styles.avatarTurn]}>
                <AvatarBadge avatar={avatars[seat]} size={side ? 36 : 34} />
                {game.dealer === seat && <Text style={styles.dealerChip}>D</Text>}
              </View>
            )}
            <View style={[styles.plate, turn && styles.plateTurn, isTaker && styles.plateTaker]}>
              <Text style={styles.plateName} numberOfLines={1}>
                {names[seat]}
              </Text>
              <Text style={[styles.plateScore, game.scores[seat] < 0 && styles.plateScoreNeg]}>
                {signed(game.scores[seat])}
              </Text>
              {p === 0 && game.dealer === seat && <Text style={styles.dealerInline}>D</Text>}
            </View>
            {isTaker && <Text style={styles.takerTag}>{t('Preneur')}</Text>}
            {p !== 0 && count > 0 && (
              <View style={styles.backs}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={{ marginLeft: i === 0 ? 0 : -14, transform: [{ rotate: `${(i - 1) * 10}deg` }] }}
                  >
                    <TarotCard hidden width={18} />
                  </View>
                ))}
                <Text style={styles.backCount}>{count}</Text>
              </View>
            )}
            {bid && (
              <Appear
                key={`${game.dealNumber}-${game.dealer}-${bid.bid}`}
                from={-6}
                style={styles.bubbleWrap}
              >
                <Text style={[styles.bubble, bid.bid !== 'pass' && styles.bubbleTake]} numberOfLines={1}>
                  {bidText(bid.bid)}
                </Text>
              </Appear>
            )}
          </View>
        );
      })}

      {/* The chien: face down while bidding, face up when the taker picks it up. */}
      {(chienHidden || chienShown) && (
        <View style={[styles.chien, { top: cy - ch * 0.62, width: w }]} pointerEvents="none">
          <View style={styles.chienCards}>
            {/* Online, the cards of a hidden chien never reach the phone: only its six backs. */}
            {(chienShown ? game.chien : ['', '', '', '', '', '']).map((c, i) => (
              <View
                key={c || i}
                style={{ marginLeft: i === 0 ? 0 : chienShown ? -miniW * 0.18 : -miniW * 0.6 }}
              >
                {chienShown ? (
                  <Appear from={-20} delay={i * 80}>
                    <TarotCard card={c} width={miniW} />
                  </Appear>
                ) : (
                  <TarotCard hidden width={miniW} />
                )}
              </View>
            ))}
          </View>
          <Text style={styles.chienLabel}>
            {chienShown
              ? game.taker === me
                ? t('Le chien, pour toi')
                : t('Le chien, pour {name}', { name: names[game.taker!] })
              : t('Le chien')}
          </Text>
        </View>
      )}

      {/* The trick, as a cross. */}
      {shownTrick.map(({ player, card }) => {
        const p = place(player);
        return (
          <Appear
            key={`${game.dealNumber}-${game.dealer}-${card}`}
            from={slot[p].from}
            style={[
              styles.trickCard,
              { left: slot[p].x, top: slot[p].y, zIndex: p === 0 ? 3 : p === 2 ? 1 : 2 },
              winnerSeat === player && holding && styles.trickWinner,
            ]}
          >
            <TarotCard card={card} width={cw} />
          </Appear>
        );
      })}

      {showResult && game.result && overlay && <View style={styles.overlay}>{overlay}</View>}
    </View>
  );
}

function DealSummary({ game, names, me }: { game: TableGame; names: string[]; me: number }) {
  const r = game.result;
  if (!r || r.kind !== 'played') return null;
  const mine = r.taker === me;
  const title = mine
    ? r.made
      ? t('Contrat réussi ! 🎉')
      : t('Chute… 😬')
    : r.made
      ? t('{name} réussit', { name: names[r.taker] })
      : t('{name} chute ! 🎉', { name: names[r.taker] });
  const contract = t(TAROT_CONTRACT_NAMES[r.contract]);
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryTitle}>{title}</Text>
      <Text style={styles.summaryText}>
        {mine
          ? tn(
              r.oudlers,
              '{contract} prise par toi · {n} bout : il fallait {target}',
              '{contract} prise par toi · {n} bouts : il fallait {target}',
              { contract, target: r.target },
            )
          : tn(
              r.oudlers,
              '{contract} de {name} · {n} bout : il fallait {target}',
              '{contract} de {name} · {n} bouts : il fallait {target}',
              { contract, name: names[r.taker], target: r.target },
            )}
      </Text>
      <Text style={styles.summaryBig}>
        {t('{n} points', { n: half(r.points) })}{' '}
        <Text style={r.made ? styles.good : styles.bad}>
          ({r.made ? '+' : '−'}
          {r.gap})
        </Text>
      </Text>
      <Text style={styles.summaryNote}>
        (25 + {r.gap}) × {TAROT_MULTIPLIERS[r.contract]}
        {r.petitAuBout !== null
          ? ' · ' +
            (r.petitAuBout === 0
              ? t('Petit au bout du preneur +{n}', { n: 10 * TAROT_MULTIPLIERS[r.contract] })
              : t('Petit au bout de la défense −{n}', { n: 10 * TAROT_MULTIPLIERS[r.contract] }))
          : ''}
      </Text>
      <View style={styles.summaryTable}>
        <View style={styles.summaryRow}>
          <Text style={[styles.cell, styles.cellName]} />
          <Text style={[styles.cell, styles.cellHead]}>{t('Donne')}</Text>
          <Text style={[styles.cell, styles.cellHead]}>{t('Total')}</Text>
        </View>
        {[0, 1, 2, 3].map((p) => (
          <View key={p} style={styles.summaryRow}>
            <Text style={[styles.cell, styles.cellName]} numberOfLines={1}>
              {p === r.taker ? '★ ' : ''}
              {names[p]}
            </Text>
            <Text style={[styles.cell, r.dealScores[p] >= 0 ? styles.good : styles.bad]}>
              {signed(r.dealScores[p])}
            </Text>
            <Text style={[styles.cell, styles.cellScore]}>{signed(game.scores[p])}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function FinalPanel({
  game,
  names,
  me,
  children,
}: {
  game: TableGame;
  names: string[];
  me: number;
  children: ReactNode;
}) {
  const won = game.winners?.includes(me) ?? false;
  const ranking = [0, 1, 2, 3].sort((a, b) => game.scores[b] - game.scores[a]);
  const first = game.winners ?? [];
  const title = won
    ? first.length > 1
      ? t('Égalité en tête !')
      : t('Tu gagnes la partie !')
    : tn(first.length, '{names} gagne la partie', '{names} gagnent la partie', {
        names: first.map((p) => names[p]).join(t(' et ')),
      });
  return (
    <Appear>
      <View style={styles.summary}>
        <Text style={styles.trophy}>{won ? '🏆' : '😢'}</Text>
        <Text style={styles.finalTitle}>{title}</Text>
        <View style={styles.ranking}>
          {ranking.map((p, i) => (
            <View
              key={p}
              style={[styles.rankRow, first.includes(p) && styles.rankRowWin, p === me && styles.rankRowMe]}
            >
              <Text style={styles.rankPos}>{i + 1}</Text>
              <Text style={styles.rankName} numberOfLines={1}>
                {names[p]}
              </Text>
              <Text style={[styles.rankScore, game.scores[p] < 0 && styles.bad]}>
                {signed(game.scores[p])}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.summaryNote}>{t('En {n} donnes', { n: game.deals })}</Text>
        {children}
      </View>
    </Appear>
  );
}

// ------------------------------------------------------------------ Online

/** Length of the game, chosen when creating an online table. */
export function TarotOnlineOptions({ value, onChange }: OnlineOptionsProps) {
  const deals = value.deals === 8 ? 8 : 4;
  return (
    <View>
      <Text style={styles.section}>{t('Partie en')}</Text>
      <View style={styles.pills}>
        <Pill
          label={t('{n} donnes', { n: 4 })}
          active={deals === 4}
          onPress={() => onChange({ ...value, deals: 4 })}
        />
        <Pill
          label={t('{n} donnes', { n: 8 })}
          active={deals === 8}
          onPress={() => onChange({ ...value, deals: 8 })}
        />
      </View>
      <Text style={styles.hint}>
        {deals === 4
          ? t('Chacun donne une fois : une partie rapide.')
          : t('Chacun donne deux fois : la partie complète.')}
      </Text>
    </View>
  );
}

/** The same table, each player on their own phone: I always sit at the bottom. */
export function TarotOnlineBoard({
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
}: OnlineBoardProps<TarotView>) {
  const names = seats.map((s) => s.name);
  const avatars = seats.map((s) => s.avatar);
  const me = mySeat;
  const bottom = me >= 0 ? me : 0;
  const active = game.phase === 'bidding' || game.phase === 'ecart' || game.phase === 'playing';
  const myTurn = active && me >= 0 && game.toAct === me && actors.includes(seats[me].id);
  const actor = active ? seats[game.toAct] : undefined;
  const hand = me >= 0 ? game.hands[me] : [];

  /** Cards I picked for my écart. */
  const [selected, setSelected] = useState<Card[]>([]);
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
    const cardsLeft = (v: TarotView) => v.handCounts.reduce((a, b) => a + b, 0);
    const played = before.phase === 'playing' && cardsLeft(game) < cardsLeft(before);
    if (played) sounds.card();
    if (played && game.trick.length === 0 && game.lastTrick) setHolding(true);
    if (game.phase !== 'ecart') setSelected([]);
    if (game.phase === 'gameOver' && before.phase !== 'gameOver' && game.winners?.includes(me)) sounds.win();
    if (myTurn && !(before.toAct === me && before.phase === game.phase)) sounds.myTurn();
  }, [game]);

  const legal = myTurn && game.phase === 'playing' ? tarotLegalCards(hand, game.trick) : [];
  const ecarting = myTurn && game.phase === 'ecart';
  const candidates = ecarting ? tarotEcartCandidates(hand) : [];
  const ecartError = ecarting ? tarotEcartError(hand, selected) : null;

  function toggle(card: Card) {
    if (selected.includes(card)) setSelected(selected.filter((c) => c !== card));
    else if (selected.length < 6) setSelected([...selected, card]);
  }

  let prompt: string;
  if (shownHold && game.lastTrick) {
    const w = game.lastTrick.winner;
    prompt = w === me ? t('Tu remportes le pli !') : t('Pli pour {name}', { name: names[w] });
  } else if (game.phase === 'dealOver' || game.phase === 'gameOver') {
    prompt = game.phase === 'gameOver' ? t('Partie terminée') : t('Fin de la donne');
  } else if (myTurn) {
    prompt =
      game.phase === 'bidding'
        ? t('À toi d’annoncer : prends-tu ?')
        : ecarting
          ? t('Choisis 6 cartes pour ton écart ({n}/6)', { n: selected.length })
          : playHint(game, hand, legal);
  } else if (actor) {
    const who = `${actor.bot ? '🤖 ' : ''}${actor.name}`;
    prompt =
      game.phase === 'bidding'
        ? t('{name} réfléchit…', { name: who })
        : game.phase === 'ecart'
          ? t('{name} prend le chien et fait son écart…', { name: who })
          : t('{name} joue…', { name: who });
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
  const nextButton = (label: string) =>
    me >= 0 && <Button compact label={label} disabled={busy} onPress={() => onMove({ type: 'next' })} />;
  const result = game.result;
  const overlay = !result ? null : game.phase === 'gameOver' ? (
    <FinalPanel game={game} names={names} me={me}>
      <Button compact label={t('Quitter la table')} onPress={onLeave} />
    </FinalPanel>
  ) : result.kind === 'redeal' ? (
    <Appear>
      <Panel compact title={result.reason === 'petitSec' ? t('Petit sec !') : t('Personne ne prend')}>
        <PanelText>
          {result.reason === 'petitSec'
            ? result.player === me
              ? t('Tu as le Petit pour seul atout : la donne est annulée.')
              : t('{name} a le Petit pour seul atout : la donne est annulée.', { name: names[result.player] })
            : t('Tout le monde passe : on redistribue, c’est au joueur suivant de donner.')}
        </PanelText>
        {nextButton(t('Redistribuer'))}
        {nextHint}
      </Panel>
    </Appear>
  ) : (
    <Appear>
      <DealSummary game={game} names={names} me={me} />
      <View style={styles.nextButton}>
        {nextButton(t('Donne suivante'))}
        {nextHint}
      </View>
    </Appear>
  );

  return (
    <GameLayout
      top={
        <>
          <TopBar onBack={onLeave} backLabel={t('← Quitter')}>
            <Text style={styles.dealCount}>
              {t('Donne {n}/{total}', { n: Math.min(game.dealNumber, game.deals), total: game.deals })}
            </Text>
            {me >= 0 && (
              <View style={[styles.score, styles.scoreMine]}>
                <Text style={styles.scoreLabel}>{t('Toi')}</Text>
                <Text style={styles.scoreValue}>{signed(game.scores[me])}</Text>
              </View>
            )}
          </TopBar>
          {deadline && actor && !actor.bot && (
            <TurnTimer deadline={deadline} now={now} name={myTurn ? t('Toi') : actor.name} seconds={60} />
          )}
        </>
      }
      table={({ width, height }) => (
        <TarotTable
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
            {myTurn && game.phase === 'bidding' && (
              <BidButtons game={game} disabled={busy} onBid={(bid) => onMove({ type: 'bid', bid })} />
            )}
            {ecarting && (
              <View style={styles.ecartButtons}>
                <Button
                  compact
                  variant="secondary"
                  label={t('Suggestion')}
                  onPress={() => setSelected(tarotBotEcart(hand))}
                />
                <Button
                  compact
                  disabled={ecartError !== null || busy}
                  label={
                    selected.length === 6 && ecartError
                      ? t(ecartError)
                      : t('Écarter {n}/6', { n: selected.length })
                  }
                  onPress={() => onMove({ type: 'ecart', cards: selected })}
                />
              </View>
            )}
          </View>
          <TarotHand
            hand={hand}
            playable={busy ? [] : ecarting ? candidates : legal}
            selected={selected}
            fresh={ecarting ? game.chien : []}
            dimOthers={(game.phase === 'playing' && myTurn) || ecarting}
            onPress={(card) => (ecarting ? toggle(card) : onMove({ type: 'play', card }))}
          />
        </>
      }
    />
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
  dealCount: { color: colors.muted, fontSize: 12, fontWeight: '800' },
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

  // Bottom
  prompt: {
    alignSelf: 'center',
    maxWidth: '100%',
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
  controls: { minHeight: 84, justifyContent: 'center', gap: 6 },
  bids: { flexDirection: 'row', gap: 5 },
  bid: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
  },
  bidPass: { backgroundColor: colors.glass, borderColor: 'rgba(163, 207, 187, 0.45)' },
  bidOff: { backgroundColor: 'rgba(0,0,0,0.3)', borderColor: 'rgba(255,255,255,0.1)', opacity: 0.45 },
  bidText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  bidTextGold: { color: colors.onGold },
  bidMult: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  bidMultGold: { color: colors.onGoldMuted },
  pressed: { opacity: 0.7 },
  ecartButtons: { flexDirection: 'row', gap: 6 },
  hand: { alignItems: 'center', justifyContent: 'flex-end', paddingTop: 8 },
  handRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end' },
  handCard: { transform: [{ translateY: 0 }] },
  handCardUp: { transform: [{ translateY: -7 }] },
  handCardPicked: { transform: [{ translateY: -14 }] },
  handCardDim: { opacity: 0.4 },
  pickedRing: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 2,
    right: 2,
    borderWidth: 2.5,
    borderColor: colors.gold,
    boxShadow: '0 0 10px rgba(255, 193, 7, 0.9)',
  },
  freshDot: {
    position: 'absolute',
    top: -3,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gold,
    borderWidth: 1.5,
    borderColor: '#fff',
  },

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
  contractBox: {
    position: 'absolute',
    top: 18,
    left: 18,
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    maxWidth: 100,
    zIndex: 5,
  },
  contractLabel: { color: colors.gold, fontSize: 13, fontWeight: '900' },
  contractTaker: { color: colors.text, fontSize: 10, fontWeight: '600' },
  contractNote: { color: colors.muted, fontSize: 9, fontWeight: '600' },
  trickBox: { position: 'absolute', top: 20, right: 20, alignItems: 'flex-end', maxWidth: 110 },
  trickText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700', textAlign: 'right' },
  seat: { position: 'absolute', alignItems: 'center', zIndex: 4 },
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
    paddingHorizontal: 7,
    paddingVertical: 2,
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  plateTurn: { borderColor: colors.gold },
  plateTaker: { backgroundColor: 'rgba(90, 60, 0, 0.85)' },
  plateName: { color: colors.text, fontWeight: '700', fontSize: 12, textAlign: 'center', flexShrink: 1 },
  plateScore: { color: colors.gold, fontWeight: '900', fontSize: 11 },
  plateScoreNeg: { color: '#ff8a80' },
  takerTag: {
    marginTop: 2,
    color: colors.onGold,
    backgroundColor: colors.gold,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 5,
    borderRadius: 5,
    overflow: 'hidden',
  },
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
  backs: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  backCount: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', marginLeft: 4 },
  bubbleWrap: { position: 'absolute', top: -16, zIndex: 6 },
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
  chien: { position: 'absolute', left: 0, alignItems: 'center', zIndex: 2 },
  chienCards: { flexDirection: 'row' },
  chienLabel: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  trickCard: { position: 'absolute' },
  trickWinner: { boxShadow: '0 0 16px 4px rgba(255, 193, 7, 0.85)', borderRadius: 6 },
  overlay: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 64,
    bottom: 34,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  nextButton: { marginTop: 8 },
  summary: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    gap: 6,
    alignItems: 'stretch',
    minWidth: 270,
    maxWidth: 340,
    ...shadow,
  },
  summaryTitle: { color: colors.gold, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  summaryText: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  summaryBig: { color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  summaryNote: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  summaryTable: { gap: 2, marginTop: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  cell: { flex: 1, color: colors.text, fontSize: 14, textAlign: 'right', fontWeight: '700' },
  cellName: { flex: 1.6, textAlign: 'left', fontWeight: '800' },
  cellScore: { color: colors.gold, fontWeight: '900' },
  cellHead: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  good: { color: '#7ee2a8' },
  bad: { color: '#ff8a80' },
  trophy: { fontSize: 44, textAlign: 'center' },
  finalTitle: { color: colors.gold, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  ranking: { gap: 4 },
  rankRow: {
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
  rankRowWin: { borderColor: colors.gold },
  rankRowMe: { backgroundColor: 'rgba(255, 193, 7, 0.12)' },
  rankPos: { color: colors.muted, fontSize: 14, fontWeight: '900', width: 16 },
  rankName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '800' },
  rankScore: { color: colors.gold, fontSize: 18, fontWeight: '900' },
  finalButtons: { flexDirection: 'row', gap: 6 },
  errorLine: { color: colors.gold, textAlign: 'center', fontSize: 13 },
});
