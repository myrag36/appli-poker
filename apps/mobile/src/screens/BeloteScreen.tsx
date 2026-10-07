import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  type Avatar,
  type BeloteMove,
  type BelotePlayedCard,
  type BeloteState,
  type BeloteSuit,
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
import { AvatarBadge, AvatarPicker } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { GameLayout } from '../components/GameLayout';
import { Pill } from '../components/LevelPicker';
import { Appear, FloatUp } from '../components/Motion';
import { Panel, PanelText } from '../components/Panel';
import { PlayingCard } from '../components/PlayingCard';
import { TopBar } from '../components/TopBar';
import { sounds } from '../feedback';
import { deviceRng } from '../rng';
import { colors, gradients, seatColors, shadow } from '../theme';

/** How long a robot seems to think, in ms. */
const BOT_DELAY = 900;
/** How long a finished trick stays on the table, in ms. */
const TRICK_PAUSE = 1300;
const ME = 0;
const TEAM_NAMES = ['Nous', 'Eux'];

interface Settings {
  names: string[];
  avatars: Avatar[];
  target: number;
}

const isRed = (s: string) => s === 'h' || s === 'd';

export function BeloteScreen({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [round, setRound] = useState(0);
  if (!settings) return <BeloteSetup onStart={setSettings} onBack={onBack} />;
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

function BeloteSetup({ onStart, onBack }: { onStart: (s: Settings) => void; onBack: () => void }) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<Avatar>(defaultAvatar(0));
  const [picking, setPicking] = useState(false);
  const [target, setTarget] = useState(1000);
  const [help, setHelp] = useState(false);

  const me = name.trim() || 'Toi';
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
    <ScrollView contentContainerStyle={styles.setup} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Belote</Text>
      <Text style={styles.subtitle}>Toi et ton partenaire robot contre deux robots.</Text>

      <Text style={styles.section}>Nous</Text>
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
      {robotRow('Partenaire', 2)}

      <Text style={styles.section}>Eux</Text>
      {robotRow('Adversaire', 1)}
      {robotRow('Adversaire', 3)}

      <Text style={styles.section}>Partie en</Text>
      <View style={styles.pills}>
        <Pill label="501 points" active={target === 501} onPress={() => setTarget(501)} />
        <Pill label="1000 points" active={target === 1000} onPress={() => setTarget(1000)} />
      </View>
      <Text style={styles.hint}>
        {target === 501 ? 'Une partie rapide, environ 5 donnes.' : 'La partie classique, environ 10 donnes.'}
      </Text>

      <View style={styles.helpButton}>
        <Button
          label={help ? 'Masquer les règles' : 'Comment jouer ?'}
          variant="secondary"
          onPress={() => setHelp(!help)}
        />
      </View>
      {help && <BeloteRules />}

      <View style={styles.spacer} />
      <Button
        label="Lancer la partie"
        onPress={() => onStart({ names, avatars: [avatar, robot(1), robot(2), robot(3)], target })}
      />
      <Button label="Retour" variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

function BeloteRules() {
  const lines = [
    '32 cartes, 5 chacun puis on retourne une carte.',
    '1er tour : « Prendre » à la couleur retournée, ou passer. 2e tour : choisir une autre couleur, ou passer.',
    'Le preneur ramasse la retourne ; tout le monde finit avec 8 cartes.',
    'Il faut fournir la couleur. Sinon, couper (et surcouper si on peut), sauf si ton partenaire est maître.',
    'À l’atout : Valet 20, 9 14, As 11, 10 10, Roi 4, Dame 3.',
    'Ailleurs : As 11, 10 10, Roi 4, Dame 3, Valet 2.',
    'Dernier pli : +10. Roi + Dame d’atout : belote-rebelote, +20.',
    'Le preneur doit faire plus que la défense, sinon il est « dedans » : 162 pour les autres.',
    'Tous les plis : capot, 252 points !',
  ];
  return (
    <Panel compact title="Comment jouer ?">
      {lines.map((l) => (
        <Text key={l} style={styles.ruleLine}>
          • {l}
        </Text>
      ))}
    </Panel>
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
  const { width: screenWidth } = useWindowDimensions();
  const names = settings.names;

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
    prompt = w === ME ? 'Tu remportes le pli !' : `Pli pour ${names[w]}`;
  } else if (game.phase === 'dealOver' || game.phase === 'gameOver') {
    prompt = game.phase === 'gameOver' ? 'Partie terminée' : 'Fin de la donne';
  } else if (robotTurn) {
    prompt = `🤖 ${names[game.toAct]} ${bidding ? 'réfléchit…' : 'joue…'}`;
  } else if (game.phase === 'bidding1') {
    prompt = `À toi : tu prends à ${BELOTE_SUIT_SYMBOLS[game.turnUp![1] as BeloteSuit]} ?`;
  } else if (game.phase === 'bidding2') {
    prompt = 'Second tour : choisis l’atout ou passe';
  } else {
    prompt = playHint(game, legal);
  }

  const turned = game.turnUp?.[1] as BeloteSuit | undefined;
  const bidButtons =
    myTurn && game.phase === 'bidding1' ? (
      <View style={styles.bids}>
        <Button
          compact
          label={`Prendre ${BELOTE_SUIT_SYMBOLS[turned!]}`}
          onPress={() => apply(ME, { type: 'take' })}
        />
        <Button compact variant="secondary" label="Passer" onPress={() => apply(ME, { type: 'pass' })} />
      </View>
    ) : myTurn && game.phase === 'bidding2' ? (
      <View style={styles.bids}>
        {BELOTE_SUITS.filter((s) => s !== turned).map((s) => (
          <Button
            key={s}
            compact
            label={`À ${BELOTE_SUIT_SYMBOLS[s]}`}
            onPress={() => apply(ME, { type: 'choose', suit: s })}
          />
        ))}
        <Button compact variant="secondary" label="Passer" onPress={() => apply(ME, { type: 'pass' })} />
      </View>
    ) : null;

  const hand = game.hands[ME];
  const avail = Math.min(screenWidth, 520) - 20;
  const cardW = Math.min(60, Math.floor(avail / 6.2));
  const step = hand.length > 1 ? Math.min(cardW + 4, (avail - cardW - 4) / (hand.length - 1)) : 0;

  return (
    <GameLayout
      top={
        <TopBar onBack={onBack} backLabel="← Quitter">
          <ScorePill label="Nous" value={game.scores[0]} mine />
          <ScorePill label="Eux" value={game.scores[1]} />
          <Text style={styles.target}>/ {game.target}</Text>
        </TopBar>
      }
      table={({ width, height }) => (
        <BeloteTable
          game={game}
          holding={holding}
          width={width}
          height={height}
          settings={settings}
          onNext={() => {
            setHolding(false);
            setGame((g) => (g.phase === 'dealOver' ? beloteNextDeal(g, deviceRng) : g));
          }}
          onReplay={onReplay}
          onSettings={onSettings}
          onBack={onBack}
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
            {bidButtons}
          </View>
          <View style={[styles.hand, { height: Math.round(cardW * 1.4) + 10 }]}>
            {hand.map((c, i) => {
              const playable = myTurn && game.phase === 'playing' && legal.includes(c);
              const dim = game.phase === 'playing' && game.toAct === ME && !holding && !playable;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={`Jouer ${c}`}
                  disabled={!playable}
                  onPress={() => apply(ME, { type: 'play', card: c })}
                  style={[
                    styles.handCard,
                    { marginLeft: i === 0 ? 0 : step - cardW - 4 },
                    playable && styles.handCardUp,
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
        </>
      }
    />
  );
}

function playHint(game: BeloteState, legal: string[]): string {
  const hand = game.hands[ME];
  if (game.trick.length === 0) return 'À toi d’entamer';
  const led = game.trick[0].card[1] as BeloteSuit;
  const trump = game.trump!;
  if (legal.length === hand.length) return 'À toi : joue ce que tu veux';
  if (hand.some((c) => c[1] === led)) {
    if (led === trump && legal.length < hand.filter((c) => c[1] === led).length)
      return 'À toi : monte à l’atout !';
    return `À toi : fournis à ${BELOTE_SUIT_SYMBOLS[led]}`;
  }
  const trumped = game.trick.some((p) => p.card[1] === trump);
  return trumped && legal.length < hand.filter((c) => c[1] === trump).length
    ? 'À toi : surcoupe !'
    : `À toi : coupe à ${BELOTE_SUIT_SYMBOLS[trump]} !`;
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
  if (bid === 'pass') return 'Passe';
  if (bid === 'take') return 'Je prends !';
  return `À ${BELOTE_SUIT_SYMBOLS[bid]} !`;
}

function BeloteTable({
  game,
  holding,
  width,
  height,
  settings,
  onNext,
  onReplay,
  onSettings,
  onBack,
}: {
  game: BeloteState;
  holding: boolean;
  width: number;
  height: number;
  settings: Settings;
  onNext: () => void;
  onReplay: () => void;
  onSettings: () => void;
  onBack: () => void;
}) {
  const w = Math.min(width, 480);
  const h = Math.min(height, Math.round(w * 1.5));
  const cx = w / 2;
  const cy = h / 2 + 6;
  const cw = Math.max(40, Math.min(58, Math.floor(Math.min(w, h) * 0.15)));
  const ch = Math.round(cw * 1.4);
  const names = settings.names;
  const bidding = game.phase === 'bidding1' || game.phase === 'bidding2';
  const round = game.phase === 'bidding1' ? 1 : 2;

  // Where each seat sits: South bottom, West left, North top, East right.
  const seatPos = [
    { x: cx, y: h - 22 },
    { x: 38, y: cy - 10 },
    { x: cx, y: 42 },
    { x: w - 38, y: cy - 10 },
  ];
  // Where each seat's card lands in the trick cross.
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
  const result = game.result;
  const showResult = (game.phase === 'dealOver' || game.phase === 'gameOver') && !holding;

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

      {/* Trump and taker, in the corner. */}
      {game.trump && game.taker !== null && (
        <Appear style={styles.trumpBox} from={-10}>
          <Text style={styles.trumpLabel}>Atout</Text>
          <SuitChip suit={game.trump} size={30} />
          <Text style={styles.trumpTaker} numberOfLines={1}>
            {game.taker === ME ? 'pris par toi' : `pris par ${names[game.taker]}`}
          </Text>
        </Appear>
      )}
      <View style={styles.dealBox}>
        <Text style={styles.dealText}>Donne {game.dealNumber}</Text>
        {game.phase === 'playing' && (
          <Text style={styles.dealText}>
            Plis {game.tricksWon[0]}–{game.tricksWon[1]}
          </Text>
        )}
      </View>

      {/* Players around the table. */}
      {[1, 2, 3, 0].map((seat) => {
        const pos = seatPos[seat];
        const turn = game.toAct === seat && !holding;
        const bid = bidding
          ? [...game.bids].reverse().find((b) => b.player === seat && b.round === round)
          : undefined;
        const count = game.hands[seat].length;
        const side = seat === 1 || seat === 3;
        const backW = side ? 20 : 24;
        return (
          <View
            key={seat}
            pointerEvents="none"
            style={[
              styles.seat,
              { width: side ? 76 : 110, left: pos.x - (side ? 38 : 55), top: pos.y - (seat === 0 ? 14 : 30) },
            ]}
          >
            {seat !== 0 && (
              <View style={[styles.avatarRing, turn && styles.avatarTurn]}>
                <AvatarBadge avatar={settings.avatars[seat]} size={side ? 36 : 34} />
                {game.dealer === seat && <Text style={styles.dealerChip}>D</Text>}
              </View>
            )}
            <View
              style={[styles.plate, turn && styles.plateTurn, beloteTeamOf(seat) === 0 && styles.plateUs]}
            >
              <Text style={styles.plateName} numberOfLines={1}>
                {names[seat]}
              </Text>
              {seat === 0 && game.dealer === 0 && <Text style={styles.dealerInline}>D</Text>}
            </View>
            {seat !== 0 && count > 0 && (
              <View style={styles.backs}>
                {game.hands[seat].map((c, i) => (
                  <View key={c} style={{ marginLeft: i === 0 ? 0 : side ? -17 : -18 }}>
                    <PlayingCard card={c} hidden width={backW} />
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
                <Text style={styles.announceText}>{game.announce.text} !</Text>
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
          <Text style={styles.turnUpLabel}>{game.phase === 'bidding1' ? 'Retournée' : '2e tour'}</Text>
        </View>
      )}

      {/* The trick, as a cross. */}
      {shownTrick.map(({ player, card }) => (
        <Appear
          key={`${game.dealNumber}-${card}`}
          from={slot[player].from}
          style={[
            styles.trickCard,
            { left: slot[player].x, top: slot[player].y, zIndex: player === 0 ? 3 : player === 2 ? 1 : 2 },
            winnerSeat === player && holding && styles.trickWinner,
          ]}
        >
          <PlayingCard card={card} width={cw} />
        </Appear>
      ))}

      {showResult && result && (
        <View style={styles.overlay}>
          {game.phase === 'gameOver' ? (
            <FinalPanel game={game} onReplay={onReplay} onSettings={onSettings} onBack={onBack} />
          ) : result.kind === 'redeal' ? (
            <Appear>
              <Panel compact title="Personne ne prend">
                <PanelText>On redistribue, c’est au joueur suivant de donner.</PanelText>
                <Button compact label="Redistribuer" onPress={onNext} />
              </Panel>
            </Appear>
          ) : (
            <Appear>
              <DealSummary game={game} names={names} />
              <View style={styles.nextButton}>
                <Button compact label="Donne suivante" onPress={onNext} />
              </View>
            </Appear>
          )}
        </View>
      )}
    </View>
  );
}

function DealSummary({ game, names }: { game: BeloteState; names: string[] }) {
  const r = game.result;
  if (!r || r.kind !== 'played') return null;
  const us = r.takerTeam === 0;
  let title: string;
  if (r.capot !== null) title = r.capot === 0 ? 'Capot ! 🎉' : 'Capot pour eux…';
  else if (!r.made) title = us ? 'Dedans… 😬' : 'Ils sont dedans ! 🎉';
  else title = us ? 'Contrat réussi ✅' : 'Contrat réussi pour eux';
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryTitle}>{title}</Text>
      <View style={styles.summaryTaker}>
        <Text style={styles.summaryText}>{r.taker === ME ? 'Tu as pris' : `${names[r.taker]} a pris`} à</Text>
        <SuitChip suit={r.trump} size={20} />
      </View>
      <View style={styles.summaryTable}>
        <View style={styles.summaryRow}>
          <Text style={[styles.cell, styles.cellHead, styles.cellName]} />
          <Text style={[styles.cell, styles.cellHead]}>Points</Text>
          <Text style={[styles.cell, styles.cellHead]}>Belote</Text>
          <Text style={[styles.cell, styles.cellHead]}>Marqué</Text>
        </View>
        {[0, 1].map((team) => (
          <View key={team} style={styles.summaryRow}>
            <Text style={[styles.cell, styles.cellName]}>{TEAM_NAMES[team]}</Text>
            <Text style={styles.cell}>{r.cardPoints[team]}</Text>
            <Text style={styles.cell}>{r.belote[team] ? '+20' : '–'}</Text>
            <Text style={[styles.cell, styles.cellScore]}>+{r.dealPoints[team]}</Text>
          </View>
        ))}
      </View>
      {!r.made && (
        <Text style={styles.summaryNote}>
          Le preneur n’a pas fait plus que la défense : {r.capot !== null ? 252 : 162} pour la défense.
        </Text>
      )}
      <Text style={styles.summaryTotal}>
        Nous {game.scores[0]} · Eux {game.scores[1]}
      </Text>
    </View>
  );
}

function FinalPanel({
  game,
  onReplay,
  onSettings,
  onBack,
}: {
  game: BeloteState;
  onReplay: () => void;
  onSettings: () => void;
  onBack: () => void;
}) {
  const won = game.winner === 0;
  return (
    <Appear>
      <View style={styles.summary}>
        <Text style={styles.trophy}>{won ? '🏆' : '😢'}</Text>
        <Text style={styles.finalTitle}>{won ? 'Vous gagnez la partie !' : 'Eux gagnent la partie'}</Text>
        <View style={styles.finalScores}>
          <View style={[styles.finalTeam, won && styles.finalTeamWin]}>
            <Text style={styles.finalTeamName}>Nous</Text>
            <Text style={styles.finalTeamScore}>{game.scores[0]}</Text>
          </View>
          <View style={[styles.finalTeam, !won && styles.finalTeamWin]}>
            <Text style={styles.finalTeamName}>Eux</Text>
            <Text style={styles.finalTeamScore}>{game.scores[1]}</Text>
          </View>
        </View>
        <Text style={styles.summaryText}>
          En {game.dealNumber} donnes · objectif {game.target}
        </Text>
        <DealSummaryLine game={game} />
        <View style={styles.finalButtons}>
          <Button compact label="Rejouer" onPress={onReplay} />
          <Button compact variant="secondary" label="Réglages" onPress={onSettings} />
        </View>
        <Button compact variant="secondary" label="Retour aux jeux" onPress={onBack} />
      </View>
    </Appear>
  );
}

function DealSummaryLine({ game }: { game: BeloteState }) {
  const r = game.result;
  if (!r || r.kind !== 'played') return null;
  return (
    <Text style={styles.summaryNote}>
      Dernière donne : Nous +{r.dealPoints[0]}, Eux +{r.dealPoints[1]}
      {r.capot !== null ? ' (capot)' : !r.made ? ' (dedans)' : ''}
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
  helpButton: { marginTop: 18 },
  ruleLine: { color: colors.text, fontSize: 13, lineHeight: 19 },
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
  bids: { flexDirection: 'row', gap: 6 },
  hand: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', paddingTop: 4 },
  handCard: { transform: [{ translateY: 0 }] },
  handCardUp: { transform: [{ translateY: -8 }] },
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
});
