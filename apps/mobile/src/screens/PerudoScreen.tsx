import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  type Avatar,
  type PerudoBid,
  type PerudoMove,
  type PerudoState,
  type PerudoView,
  type Rng,
  PACO,
  PERUDO_MAX_PLAYERS,
  botName,
  defaultAvatar,
  perudoApply,
  perudoBidOptions,
  perudoBotMove,
  perudoCanCalza,
  perudoMatches,
  perudoNewGame,
  perudoNextRound,
  perudoRanking,
  perudoTotalDice,
} from '@appli-poker/engine';
import { AvatarBadge, AvatarPicker, type SeatAvatar } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { Die } from '../components/Die';
import { GameLayout } from '../components/GameLayout';
import { Appear, FloatUp } from '../components/Motion';
import { OnlineButton } from '../components/OnlineButton';
import { RulesButton } from '../components/Rules';
import { TopBar } from '../components/TopBar';
import { TurnTimer } from '../components/TurnTimer';
import type { OnlineBoardProps, OnlineOptionsProps } from '../online-games/types';
import { reportLocalGame } from '../online/progress';
import { PERUDO_RULES } from '../rules';
import { sounds } from '../feedback';
import { deviceRng } from '../rng';
import { colors, gradients, theme } from '../theme';
import { COLUMN_MAX_WIDTH, useDesktop } from '../layout';
import { t, tn } from '../i18n';

/** How long a robot seems to think before bidding or calling, in ms. */
const BOT_DELAY = 1300;
/** When I am out, how long each reveal stays before the robots play on. */
const WATCH_DELAY = 2600;
const botRng: Rng = (max) => Math.floor(Math.random() * max);

/** Dice faces as characters, for one-line texts. */
const FACE_CHARS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const SEAT_W = 84;
const SEAT_H = 82;
const SEAT_W_LARGE = 128;
const SEAT_H_LARGE = 120;

interface Settings {
  name: string;
  avatar: Avatar;
  robots: number;
  calza: boolean;
}

/** "3 × ⚃", or "2 Pacos" for the wild ones. */
function bidText(bid: PerudoBid): string {
  return bid.face === PACO
    ? tn(bid.quantity, '{n} Paco', '{n} Pacos')
    : t('{n} × {face}', { n: bid.quantity, face: FACE_CHARS[bid.face] });
}

export function PerudoScreen({ onBack, onOnline }: { onBack: () => void; onOnline?: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [last, setLast] = useState<Settings | null>(null);
  const [round, setRound] = useState(0);
  if (!settings)
    return (
      <PerudoSetup
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
    <PerudoGame
      key={round}
      settings={settings}
      onQuit={() => setSettings(null)}
      onReplay={() => setRound((r) => r + 1)}
      onHome={onBack}
    />
  );
}

// ---------------------------------------------------------------------------
// Setup

function PerudoSetup({
  initial,
  onStart,
  onBack,
  onOnline,
}: {
  initial: Settings | null;
  onStart: (s: Settings) => void;
  onBack: () => void;
  onOnline?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [avatar, setAvatar] = useState<Avatar>(initial?.avatar ?? defaultAvatar(0));
  const [robots, setRobots] = useState(initial?.robots ?? 3);
  const [calza, setCalza] = useState(initial?.calza ?? true);
  const [picking, setPicking] = useState(false);
  const desktop = useDesktop();

  return (
    <ScrollView
      contentContainerStyle={[styles.setup, desktop && styles.column]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Cup size={54} />
        <View style={styles.heroDice}>
          {[1, 4, 4].map((v, i) => (
            <View key={i} style={{ transform: [{ rotate: `${(i - 1) * 16}deg` }] }}>
              <Die value={v} size={30} />
            </View>
          ))}
        </View>
      </View>
      <Text style={styles.title}>Perudo</Text>
      <Text style={styles.subtitle}>{t('Dés menteurs : bluffe, surenchéris ou crie « Dudo ! »')}</Text>
      {onOnline && <OnlineButton onPress={onOnline} />}
      <RulesButton rules={PERUDO_RULES} />

      <Text style={styles.section}>{t('Ton nom')}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Changer mon avatar')}
          onPress={() => setPicking(!picking)}
        >
          <AvatarBadge avatar={avatar} size={40} />
        </Pressable>
        <TextInput
          style={[styles.input, styles.flex]}
          placeholder={t('Toi')}
          placeholderTextColor={colors.muted}
          value={name}
          maxLength={14}
          onChangeText={setName}
        />
      </View>
      {picking && <AvatarPicker value={avatar} onChange={setAvatar} />}

      <Text style={styles.section}>{t('Robots adversaires')}</Text>
      <View style={styles.counts}>
        {Array.from({ length: PERUDO_MAX_PLAYERS - 1 }, (_, i) => i + 1).map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={tn(n, '{n} robot', '{n} robots')}
            accessibilityState={{ selected: n === robots }}
            onPress={() => setRobots(n)}
            style={[styles.count, n === robots && styles.countOn]}
          >
            <Text style={[styles.countText, n === robots && styles.countTextOn]}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>
        {tn(robots + 1, '{n} joueur', '{n} joueurs')} · {tn((robots + 1) * 5, '{n} dé', '{n} dés')}
      </Text>

      <Text style={styles.section}>{t('Calza')}</Text>
      <CalzaChoice value={calza} onChange={setCalza} />

      <View style={styles.spacer} />
      <Button
        label={t('Lancer la partie')}
        onPress={() => onStart({ name: name.trim() || t('Toi'), avatar, robots, calza })}
      />
      <Button label={t('Retour')} variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

function CalzaChoice({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <>
      <View style={styles.counts}>
        {[true, false].map((on) => (
          <Pressable
            key={String(on)}
            accessibilityRole="button"
            accessibilityState={{ selected: on === value }}
            onPress={() => onChange(on)}
            style={[styles.count, styles.countWide, on === value && styles.countOn]}
          >
            <Text style={[styles.countText, on === value && styles.countTextOn]}>
              {on ? t('Avec Calza') : t('Sans Calza')}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>
        {value
          ? t('Annonce que l’enchère est pile juste : gagné, tu récupères un dé ; raté, tu en perds un.')
          : t('Seulement surenchérir ou crier « Dudo ! ».')}
      </Text>
    </>
  );
}

// ---------------------------------------------------------------------------
// Solo game against robots

function PerudoGame({
  settings,
  onQuit,
  onReplay,
  onHome,
}: {
  settings: Settings;
  onQuit: () => void;
  onReplay: () => void;
  onHome: () => void;
}) {
  const { names, avatars, bots } = useMemo(() => {
    const names = [settings.name];
    for (let i = 0; i < settings.robots; i++) names.push(botName(names));
    return {
      names,
      avatars: names.map((_, i) =>
        i === 0 ? settings.avatar : { emoji: '🤖', color: defaultAvatar(i).color },
      ) as Avatar[],
      bots: names.map((_, i) => i > 0),
    };
  }, [settings]);
  const [state, setState] = useState<PerudoState>(() =>
    perudoNewGame(
      names.map((name, i) => ({ id: `p${i}`, name })),
      deviceRng,
      { calza: settings.calza },
    ),
  );
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meOut = state.players[0].count === 0;
  const myTurn = state.phase === 'bidding' && state.current === 0;

  function play(move: PerudoMove) {
    try {
      setState((s) => perudoApply(s, 0, move));
      setError(null);
    } catch (e) {
      setError(t((e as Error).message));
    }
  }

  // Robots bid or call on their turn; once I am out, the rounds go on by themselves.
  useEffect(() => {
    if (state.phase === 'bidding' && bots[state.current]) {
      const seq = state.seq;
      const id = setTimeout(
        () =>
          setState((s) =>
            s.seq === seq && s.phase === 'bidding'
              ? perudoApply(s, s.current, perudoBotMove(s, s.current, botRng))
              : s,
          ),
        BOT_DELAY,
      );
      return () => clearTimeout(id);
    }
    if (state.phase === 'reveal' && meOut) {
      const seq = state.seq;
      const id = setTimeout(
        () => setState((s) => (s.seq === seq && s.phase === 'reveal' ? perudoNextRound(s, deviceRng) : s)),
        WATCH_DELAY,
      );
      return () => clearTimeout(id);
    }
  }, [state, meOut]);

  usePerudoSounds(state, 0);

  /** Plays the robots out to the end at once, when I am out and do not want to watch. */
  function skipToEnd() {
    let s = state;
    for (let guard = 0; s.phase !== 'over' && guard < 5000; guard++)
      s =
        s.phase === 'reveal'
          ? perudoNextRound(s, deviceRng)
          : perudoApply(s, s.current, perudoBotMove(s, s.current, botRng));
    setState(s);
    setFinished(true);
  }

  if (finished && state.phase === 'over')
    return (
      <PerudoResults
        state={state}
        avatars={avatars}
        bots={bots}
        me={0}
        onReplay={onReplay}
        onHome={onHome}
        report
      />
    );

  return (
    <PerudoBoard
      state={state}
      viewer={0}
      watching={false}
      avatars={avatars}
      bots={bots}
      myTurn={myTurn}
      busy={false}
      error={error}
      onMove={play}
      onBack={onQuit}
      top={null}
      onNext={
        state.phase === 'reveal' && !meOut ? () => setState((s) => perudoNextRound(s, deviceRng)) : undefined
      }
      onResults={() => setFinished(true)}
      onSkip={meOut && state.phase !== 'over' ? skipToEnd : undefined}
    />
  );
}

/** Little sounds for what happens at the table, whoever did it. */
function usePerudoSounds(state: PerudoState, viewer: number) {
  const prev = useRef(state);
  useEffect(() => {
    const before = prev.current;
    prev.current = state;
    if (before.seq === state.seq) return;
    if (state.phase === 'over' && before.phase !== 'over') {
      if (state.winner === viewer) sounds.win();
      else sounds.lose();
      return;
    }
    if (state.phase === 'reveal' && before.phase === 'bidding') sounds.fold();
    else if (state.phase === 'bidding' && before.phase === 'reveal') sounds.dice();
    else if (state.bids.length > before.bids.length) sounds.chips();
    if (state.phase === 'bidding' && state.current === viewer && state.players[viewer]?.count > 0)
      if (before.current !== viewer || before.phase !== 'bidding') sounds.myTurn();
  }, [state]);
}

// ---------------------------------------------------------------------------
// The table, shared by the solo game and the online one

function PerudoBoard({
  state,
  viewer,
  watching,
  avatars,
  bots,
  myTurn,
  busy,
  error,
  onMove,
  onBack,
  top,
  onNext,
  nextHint,
  onResults,
  onSkip,
}: {
  state: PerudoState;
  viewer: number;
  watching: boolean;
  avatars: SeatAvatar[];
  bots: boolean[];
  myTurn: boolean;
  busy: boolean;
  error: string | null;
  onMove: (m: PerudoMove) => void;
  onBack: () => void;
  top: ReactNode;
  onNext?: () => void;
  nextHint?: string;
  onResults: () => void;
  onSkip?: () => void;
}) {
  const desktop = useDesktop();
  const current = state.players[state.current];
  const me = state.players[viewer];
  const [face, setFace] = useState<number | null>(null);
  const total = perudoTotalDice(state);

  let prompt: string;
  if (state.phase !== 'bidding')
    prompt = state.phase === 'over' ? t('Partie terminée') : t('Manche terminée');
  else if (myTurn)
    prompt = state.bid ? t('À toi : surenchéris ou crie « Dudo ! »') : t('À toi d’ouvrir les enchères');
  else if (!watching && me.count === 0) prompt = t('Tu es éliminé : les autres finissent la partie');
  else
    prompt = bots[state.current]
      ? t('🤖 {name} réfléchit…', { name: current.name })
      : t('Au tour de {name}', { name: current.name });

  return (
    <GameLayout
      top={
        <>
          <TopBar onBack={onBack} backLabel={t('← Quitter')}>
            <Text style={styles.topInfo}>{t('Manche {n}', { n: state.round })}</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{tn(total, '🎲 {n} dé en jeu', '🎲 {n} dés en jeu')}</Text>
            </View>
          </TopBar>
          {top}
        </>
      }
      table={({ width, height }) => (
        <PerudoTable
          state={state}
          viewer={viewer}
          watching={watching}
          avatars={avatars}
          bots={bots}
          width={width}
          height={height}
          highlight={myTurn ? face : null}
        >
          {state.phase !== 'bidding' && state.challenge && (
            <RevealPanel
              state={state}
              viewer={viewer}
              desktop={desktop}
              onNext={onNext}
              hint={nextHint}
              onResults={state.phase === 'over' ? onResults : undefined}
            />
          )}
        </PerudoTable>
      )}
      bottom={
        <View style={styles.bottom}>
          <Text
            style={[styles.prompt, desktop && styles.promptLarge, myTurn && styles.promptMine]}
            numberOfLines={1}
          >
            {prompt}
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}
          {myTurn && (
            <BidPicker
              state={state}
              seat={viewer}
              busy={busy}
              onMove={onMove}
              onFace={setFace}
              desktop={desktop}
            />
          )}
          {onSkip && (
            <Button compact variant="secondary" label={t('Voir la fin tout de suite')} onPress={onSkip} />
          )}
        </View>
      }
    />
  );
}

/** Seat of the k-th other player on the upper half of the oval, from the left. */
function seatPosition(
  k: number,
  others: number,
  w: number,
  cy: number,
  seatW: number,
  seatH: number,
  desktop: boolean,
) {
  const cx = w / 2;
  const rx = w / 2 - seatW / 2 - (desktop ? 30 : 2);
  const ry = cy - seatH / 2 - (desktop ? 18 : 4);
  const angle = others === 1 ? Math.PI / 2 : Math.PI - ((k + 0.5) * Math.PI) / others;
  return { x: cx + rx * Math.cos(angle), y: cy - ry * Math.sin(angle) };
}

function PerudoTable({
  state,
  viewer,
  watching,
  avatars,
  bots,
  width,
  height,
  highlight,
  children,
}: {
  state: PerudoState;
  viewer: number;
  watching: boolean;
  avatars: SeatAvatar[];
  bots: boolean[];
  width: number;
  height: number;
  /** The face I am about to bid: my dice that count for it glow. */
  highlight: number | null;
  children?: ReactNode;
}) {
  const desktop = useDesktop();
  const w = desktop ? Math.min(width, 1080, Math.round(height * 1.9)) : Math.min(width, 470);
  const h = height;
  const seatW = desktop ? SEAT_W_LARGE : SEAT_W;
  const seatH = desktop ? SEAT_H_LARGE : SEAT_H;
  const n = state.players.length;
  const others = n - 1;
  const cy = Math.round(h * (desktop ? 0.5 : 0.44));
  const revealed = state.phase !== 'bidding';
  const face = state.challenge?.bid.face ?? null;
  const me = state.players[viewer];
  const myDie = desktop
    ? Math.max(44, Math.min(68, Math.floor(h / 8.5)))
    : Math.max(34, Math.min(50, Math.floor((w - 60) / 6)));
  const centerTop = desktop ? cy - 70 : cy + 6;

  /** My last bid this round, or the call that ended it, over a seat. */
  function bubble(i: number): { text: string; bid?: PerudoBid; hot?: boolean } | null {
    const c = state.challenge;
    if (revealed && c) {
      if (c.caller === i) return { text: c.type === 'dudo' ? t('Dudo !') : t('Calza !'), hot: true };
    }
    const mine = [...state.bids].reverse().find((b) => b.seat === i);
    return mine ? { text: bidText(mine.bid), bid: mine.bid } : null;
  }

  return (
    <View style={{ width: w, height: h }}>
      <View style={styles.rail}>
        <LinearGradient colors={gradients.wood} style={StyleSheet.absoluteFill} />
        <View style={styles.felt}>
          <LinearGradient colors={gradients.felt} style={StyleSheet.absoluteFill} />
          <View style={styles.feltGlow} />
          <View style={styles.feltLine} />
          {theme.feltMark && (
            <Text style={[styles.feltMark, { fontSize: Math.round(w * 0.3) }]}>{theme.feltMark}</Text>
          )}
        </View>
      </View>

      {!revealed && (
        <View pointerEvents="none" style={[styles.center, { top: centerTop, width: w }]}>
          <CurrentBid state={state} viewer={viewer} large={desktop} />
        </View>
      )}

      {state.players.map((p, i) => {
        if (i === viewer && !watching) return null;
        const k = watching ? i : (i - viewer - 1 + n) % n;
        const { x, y } = seatPosition(k, watching ? n : others, w, cy, seatW, seatH, desktop);
        const active = state.phase === 'bidding' && state.current === i;
        const out = p.count === 0 && !(revealed && state.challenge?.loser === i);
        const b = bubble(i);
        const lost = revealed && state.challenge?.loser === i;
        const gained = revealed && state.challenge?.gainer === i;
        return (
          <View
            key={p.id}
            pointerEvents="none"
            style={[
              styles.seat,
              { left: x - seatW / 2, top: y - seatH / 2, width: seatW },
              out && styles.seatOut,
            ]}
          >
            <View
              style={[styles.avatarRing, desktop && styles.avatarRingLarge, active && styles.avatarActive]}
            >
              <AvatarBadge avatar={avatars[i]} size={desktop ? 54 : 36} />
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
              {out ? (
                <Text style={styles.outText}>{t('Éliminé')}</Text>
              ) : revealed ? (
                <View style={styles.miniDice}>
                  {p.dice.map((d, j) => (
                    <Appear key={`${state.seq}-${j}`} delay={j * 90 + k * 60} from={-10}>
                      <MiniDie
                        value={d}
                        size={desktop ? 18 : 14}
                        match={face !== null && perudoMatches([d], face) > 0}
                      />
                    </Appear>
                  ))}
                </View>
              ) : (
                <View style={styles.cupRow}>
                  <Cup size={desktop ? 30 : 20} />
                  <Text style={[styles.cupCount, desktop && styles.cupCountLarge]}>× {p.count}</Text>
                </View>
              )}
            </View>
            {(lost || gained) && (
              <FloatUp key={`d${state.seq}`} style={styles.loss}>
                <Text style={[styles.lossText, gained && styles.gainText]}>
                  {gained ? t('+1 dé') : t('−1 dé')}
                </Text>
              </FloatUp>
            )}
            {b && !out && (
              <Appear
                key={`${state.seq}-${b.text}`}
                from={6}
                style={[styles.bubble, desktop && styles.bubbleLarge]}
              >
                <BubbleContent bubble={b} large={desktop} />
              </Appear>
            )}
          </View>
        );
      })}

      {!watching && (
        <View pointerEvents="none" style={[styles.mine, { bottom: desktop ? 22 : 14, width: w }]}>
          <View style={styles.mineHead}>
            <AvatarBadge avatar={avatars[viewer]} size={desktop ? 28 : 20} />
            <Text style={[styles.mineLabel, desktop && styles.mineLabelLarge]} numberOfLines={1}>
              {me.count === 0 && !(revealed && state.challenge?.loser === viewer)
                ? t('Tu es éliminé')
                : tn(me.count, 'Tes dés · {n} restant', 'Tes dés · {n} restants')}
            </Text>
            {(() => {
              const b = bubble(viewer);
              return b ? (
                <Appear key={`${state.seq}-${b.text}`} from={6}>
                  <BubbleContent bubble={b} large={false} />
                </Appear>
              ) : null;
            })()}
          </View>
          <View style={[styles.myDice, { gap: Math.round(myDie * 0.16) }]}>
            {me.dice.map((d, j) => {
              const glow =
                (revealed && face !== null && perudoMatches([d], face) > 0) ||
                (!revealed && highlight !== null && perudoMatches([d], highlight) > 0);
              return (
                <View
                  key={j}
                  style={[
                    styles.myDie,
                    { borderRadius: myDie * 0.24 },
                    glow && styles.myDieGlow,
                    revealed && !glow && styles.dim,
                  ]}
                >
                  <Die
                    value={d}
                    size={myDie}
                    rollKey={state.round}
                    accessibilityLabel={t('Dé {n}', { n: d })}
                  />
                </View>
              );
            })}
          </View>
        </View>
      )}

      {children}
    </View>
  );
}

/** What a seat just did: its last bid drawn with a small die, or its call. */
function BubbleContent({
  bubble,
  large,
}: {
  bubble: { text: string; bid?: PerudoBid; hot?: boolean };
  large: boolean;
}) {
  if (!bubble.bid)
    return (
      <Text style={[styles.bubbleText, large && styles.bubbleTextLarge, bubble.hot && styles.bubbleHot]}>
        {bubble.text}
      </Text>
    );
  return (
    <View style={styles.bubbleRow} accessibilityLabel={bubble.text}>
      <Text style={[styles.bubbleText, large && styles.bubbleTextLarge]}>{bubble.bid.quantity} ×</Text>
      <MiniDie value={bubble.bid.face} size={large ? 18 : 14} />
    </View>
  );
}

/** The bid to beat, in the middle of the table. */
function CurrentBid({ state, viewer, large }: { state: PerudoState; viewer: number; large: boolean }) {
  const bid = state.bid;
  const size = large ? 54 : 40;
  if (!bid || state.bidder === null)
    return (
      <View style={styles.bidBox}>
        <Text style={[styles.bidLabel, large && styles.bidLabelLarge]}>{t('Nouvelle manche')}</Text>
        <Text style={[styles.bidOpen, large && styles.bidOpenLarge]}>
          {state.current === viewer
            ? t('À toi d’ouvrir')
            : t('{name} ouvre', { name: state.players[state.current].name })}
        </Text>
        <Text style={styles.bidHint}>{t('Les 1 (Pacos) comptent pour toutes les faces')}</Text>
      </View>
    );
  return (
    <Appear key={state.seq} from={-12} style={styles.bidBox}>
      <Text style={[styles.bidLabel, large && styles.bidLabelLarge]}>
        {state.bidder === viewer
          ? t('Ton enchère')
          : t('Enchère de {name}', { name: state.players[state.bidder].name })}
      </Text>
      <View style={styles.bidRow}>
        <Text style={[styles.bidQty, large && styles.bidQtyLarge]}>{bid.quantity}</Text>
        <Text style={[styles.bidTimes, large && styles.bidTimesLarge]}>×</Text>
        <Die value={bid.face} size={size} accessibilityLabel={bidText(bid)} />
      </View>
      <Text style={styles.bidHint}>
        {bid.face === PACO
          ? t('Des Pacos (les 1) sur toute la table')
          : t('Des {face} sur toute la table, Pacos compris', { face: FACE_CHARS[bid.face] })}
      </Text>
    </Appear>
  );
}

/** After a Dudo or a Calza: who called, how many dice there really were, who loses a die. */
function RevealPanel({
  state,
  viewer,
  desktop,
  onNext,
  hint,
  onResults,
}: {
  state: PerudoState;
  viewer: number;
  desktop: boolean;
  onNext?: () => void;
  hint?: string;
  onResults?: () => void;
}) {
  const c = state.challenge!;
  const name = (i: number) => (i === viewer ? t('Toi') : state.players[i].name);
  const title = c.type === 'dudo' ? t('Dudo !') : t('Calza !');
  const bid = bidText(c.bid);
  let said: string;
  if (c.type === 'calza')
    said =
      c.caller === viewer
        ? t('Tu dis que {bid}, c’est pile juste', { bid })
        : t('{caller} dit que {bid}, c’est pile juste', { caller: name(c.caller), bid });
  else if (c.caller === viewer)
    said = t('Tu ne crois pas à {bid} de {bidder}', { bid, bidder: name(c.bidder) });
  else if (c.bidder === viewer)
    said = t('{caller} ne croit pas à tes {bid}', { caller: name(c.caller), bid });
  else
    said = t('{caller} ne croit pas à {bid} de {bidder}', {
      caller: name(c.caller),
      bid,
      bidder: name(c.bidder),
    });
  let result: string;
  if (c.gainer !== null)
    result =
      c.gainer === viewer
        ? t('Pile juste ! Tu récupères un dé')
        : t('Pile juste ! {name} récupère un dé', { name: name(c.gainer) });
  else if (c.loser === viewer) result = c.eliminated ? t('Tu perds ton dernier dé…') : t('Tu perds un dé');
  else
    result = c.eliminated
      ? t('{name} perd son dernier dé et sort', { name: name(c.loser!) })
      : t('{name} perd un dé', { name: name(c.loser!) });
  const good = c.gainer === viewer || (c.loser !== null && c.loser !== viewer);
  return (
    <View pointerEvents="box-none" style={[styles.revealWrap, desktop && styles.revealWrapLarge]}>
      <FloatUp key={`call${state.seq}`} style={[styles.callBurst, desktop && styles.callBurstHigh]}>
        <Text style={[styles.callBurstText, desktop && styles.callBurstLarge]}>{title}</Text>
      </FloatUp>
      <Appear delay={500} style={[styles.reveal, desktop && styles.revealLarge]}>
        <Text style={[styles.revealTitle, desktop && styles.revealTitleLarge]}>{title}</Text>
        <Text style={styles.revealText}>{said}</Text>
        <View style={styles.revealCount}>
          <Text style={[styles.revealBig, desktop && styles.revealBigLarge]}>
            {tn(c.actual, 'Il y en a {n}', 'Il y en a {n}')}
          </Text>
          <Die value={c.bid.face} size={desktop ? 34 : 26} />
        </View>
        <Text style={[styles.revealResult, good ? styles.revealGood : styles.revealBad]}>{result}</Text>
        {state.phase === 'over' && state.winner !== null && (
          <Text style={styles.revealWinner}>
            {state.winner === viewer
              ? t('🏆 Tu gagnes la partie !')
              : t('🏆 {name} gagne la partie', { name: state.players[state.winner].name })}
          </Text>
        )}
        {onResults ? (
          <Button compact label={t('Voir le classement')} onPress={onResults} />
        ) : onNext ? (
          <Button compact label={t('Manche suivante')} onPress={onNext} />
        ) : null}
        {hint && <Text style={styles.revealHint}>{hint}</Text>}
      </Appear>
    </View>
  );
}

/** Choosing a face and a quantity, then bidding, or calling Dudo or Calza. */
function BidPicker({
  state,
  seat,
  busy,
  onMove,
  onFace,
  desktop,
}: {
  state: PerudoState;
  seat: number;
  busy: boolean;
  onMove: (m: PerudoMove) => void;
  onFace: (face: number | null) => void;
  desktop: boolean;
}) {
  const options = useMemo(() => perudoBidOptions(state), [state]);
  const min = (f: number) => options.find((o) => o.face === f)?.min ?? null;
  const total = perudoTotalDice(state);
  const mine = state.players[seat].dice;
  /** A sensible face to start from: the bid's own face, or the one I hold most of. */
  function defaultFace(): number | null {
    if (state.bid && min(state.bid.face) !== null) return state.bid.face;
    let best: number | null = null;
    let most = -1;
    for (const o of options) {
      const m = perudoMatches(mine, o.face);
      if (o.face !== PACO && m > most) {
        most = m;
        best = o.face;
      }
    }
    return best ?? options[0]?.face ?? null;
  }
  const [face, setFace] = useState<number | null>(defaultFace);
  const [qty, setQty] = useState<number>(() => (face !== null ? (min(face) ?? 1) : 1));
  useEffect(() => {
    const f = defaultFace();
    setFace(f);
    setQty(f !== null ? (min(f) ?? 1) : 1);
  }, [state.seq]);
  useEffect(() => {
    onFace(face);
    return () => onFace(null);
  }, [face]);

  const low = face !== null ? (min(face) ?? total) : total;
  const canBid = face !== null && min(face) !== null && qty >= low && qty <= total && !busy;
  const calza = perudoCanCalza(state, seat);
  const held = face !== null ? perudoMatches(mine, face) : 0;

  const faces = (
    <View style={[styles.faces, desktop && styles.facesLarge]}>
      {[1, 2, 3, 4, 5, 6].map((f) => {
        const m = min(f);
        const on = f === face;
        return (
          <Pressable
            key={f}
            accessibilityRole="button"
            accessibilityLabel={f === PACO ? t('Pacos') : t('Dé {n}', { n: f })}
            accessibilityState={{ selected: on, disabled: m === null }}
            disabled={m === null || busy}
            onPress={() => {
              setFace(f);
              setQty(Math.max(m!, Math.min(total, f === face ? qty : m!)));
            }}
            style={({ pressed }) => [
              styles.faceBtn,
              on && styles.faceOn,
              m === null && styles.faceOff,
              pressed && styles.pressed,
            ]}
          >
            <Die value={f} size={desktop ? 36 : 30} />
            {f === PACO && <Text style={styles.pacoTag}>{t('Paco')}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
  const stepper = (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Un dé de moins')}
        disabled={qty <= low || busy}
        onPress={() => setQty(qty - 1)}
        style={({ pressed }) => [styles.step, qty <= low && styles.faceOff, pressed && styles.pressed]}
      >
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <View style={styles.qtyBox}>
        <Text style={styles.qty}>{qty}</Text>
        <Text style={styles.qtyHint} numberOfLines={1}>
          {tn(held, 'tu en as {n}', 'tu en as {n}')}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Un dé de plus')}
        disabled={qty >= total || busy}
        onPress={() => setQty(qty + 1)}
        style={({ pressed }) => [styles.step, qty >= total && styles.faceOff, pressed && styles.pressed]}
      >
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
  const bidButton = (
    <Button
      compact
      label={face !== null ? t('Annoncer {bid}', { bid: bidText({ quantity: qty, face }) }) : t('Annoncer')}
      disabled={!canBid}
      onPress={() => face !== null && onMove({ type: 'bid', quantity: qty, face })}
    />
  );
  const calls = state.bid && (
    <>
      <View style={styles.flex}>
        <Button
          compact
          variant="danger"
          label={t('Dudo ! (menteur)')}
          disabled={busy}
          onPress={() => onMove({ type: 'dudo' })}
        />
      </View>
      {calza && (
        <View style={styles.flex}>
          <Button
            compact
            variant="secondary"
            label={t('Calza (pile)')}
            disabled={busy}
            onPress={() => onMove({ type: 'calza' })}
          />
        </View>
      )}
    </>
  );
  if (desktop)
    return (
      <View style={styles.picker}>
        <View style={[styles.pickRow, styles.pickRowLarge]}>
          {faces}
          {stepper}
        </View>
        <View style={styles.pickRow}>
          <View style={styles.flex2}>{bidButton}</View>
          {calls}
        </View>
      </View>
    );
  return (
    <View style={styles.picker}>
      {faces}
      <View style={styles.pickRow}>
        {stepper}
        <View style={styles.flex}>{bidButton}</View>
      </View>
      {calls && <View style={styles.pickRow}>{calls}</View>}
    </View>
  );
}

/** A small die for the seats around the table, its matching faces outlined in gold. */
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [
    [0, 2],
    [2, 0],
  ],
  3: [
    [0, 2],
    [1, 1],
    [2, 0],
  ],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  5: [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ],
  6: [
    [0, 0],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 2],
  ],
};

function MiniDie({ value, size, match }: { value: number; size: number; match?: boolean }) {
  const pip = Math.max(2, Math.round(size * 0.2));
  const pad = size * 0.12;
  const cell = (size - 2 * pad) / 3;
  return (
    <View
      style={[
        styles.mini,
        { width: size, height: size, borderRadius: size * 0.22 },
        match === true && styles.miniMatch,
        match === false && styles.miniDim,
      ]}
    >
      {(PIPS[value] ?? []).map(([r, c], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: pip,
            height: pip,
            borderRadius: pip,
            backgroundColor: value === 1 ? colors.red : colors.black,
            left: pad + c * cell + cell / 2 - pip / 2,
            top: pad + r * cell + cell / 2 - pip / 2,
          }}
        />
      ))}
    </View>
  );
}

/** A leather dice cup, upside down on the table. */
function Cup({ size }: { size: number }) {
  return (
    <View style={{ width: size, height: size * 0.95, alignItems: 'center' }}>
      <View
        style={[
          styles.cupBody,
          {
            width: size * 0.78,
            height: size * 0.8,
            borderTopLeftRadius: size * 0.18,
            borderTopRightRadius: size * 0.18,
          },
        ]}
      >
        <LinearGradient colors={['#a0522d', '#6b2f17', '#41190b']} style={StyleSheet.absoluteFill} />
        <View style={[styles.cupBand, { top: size * 0.18, height: Math.max(2, size * 0.08) }]} />
      </View>
      <View
        style={[styles.cupRim, { width: size, height: Math.max(3, size * 0.16), borderRadius: size * 0.08 }]}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Results

const MEDALS = ['🥇', '🥈', '🥉'];

function PerudoResults({
  state,
  avatars,
  bots,
  me,
  onReplay,
  onHome,
  homeLabel = t('Retour aux jeux'),
  report,
}: {
  state: PerudoState;
  avatars: SeatAvatar[];
  bots: boolean[];
  me: number;
  onReplay?: () => void;
  onHome: () => void;
  homeLabel?: string;
  /** On this phone (not online), the game gives experience. */
  report?: boolean;
}) {
  const desktop = useDesktop();
  const ranking = perudoRanking(state);
  const winner = state.winner ?? ranking[0];
  useEffect(() => {
    if (report) reportLocalGame('perudo', winner === me);
  }, []);
  return (
    <ScrollView contentContainerStyle={[styles.results, desktop && styles.column]}>
      <Appear>
        <Text style={styles.trophy}>{winner === me ? '🏆' : '🎲'}</Text>
        <Text style={styles.winner}>
          {winner === me
            ? t('Tu gagnes la partie !')
            : t('{name} gagne !', { name: state.players[winner].name })}
        </Text>
        <Text style={styles.subtitle}>{tn(state.round, '{n} manche jouée', '{n} manches jouées')}</Text>
      </Appear>
      <View style={styles.podium}>
        {ranking.map((i, place) => (
          <Appear key={i} delay={place * 80} from={10}>
            <View style={[styles.podiumRow, place === 0 && styles.podiumFirst]}>
              <Text style={styles.podiumPlace}>{MEDALS[place] ?? t('{n}e', { n: place + 1 })}</Text>
              <AvatarBadge avatar={avatars[i]} size={28} />
              <Text style={[styles.podiumName, place === 0 && styles.podiumNameFirst]} numberOfLines={1}>
                {bots[i] ? '🤖 ' : ''}
                {state.players[i].name}
                {i === me && state.players[i].name !== t('Toi') ? ` ${t('(toi)')}` : ''}
              </Text>
              <Text style={styles.podiumTotal}>
                {state.players[i].count > 0 ? tn(state.players[i].count, '{n} dé', '{n} dés') : t('Éliminé')}
              </Text>
            </View>
          </Appear>
        ))}
      </View>
      <View style={styles.spacer} />
      {onReplay && <Button label={t('Rejouer')} onPress={onReplay} />}
      <Button label={homeLabel} variant="secondary" onPress={onHome} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Online

/** Calza or not, chosen when creating an online table. */
export function PerudoOnlineOptions({ value, onChange }: OnlineOptionsProps) {
  return (
    <View>
      <Text style={styles.section}>{t('Calza')}</Text>
      <CalzaChoice value={value.calza !== false} onChange={(calza) => onChange({ ...value, calza })} />
    </View>
  );
}

/** The same table, each player on their own phone: my dice at the bottom, the others' cups around. */
export function PerudoOnlineBoard({
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
}: OnlineBoardProps<PerudoView>) {
  const avatars = seats.map((s) => s.avatar);
  const bots = seats.map((s) => s.bot);
  const watching = mySeat < 0;
  const viewer = watching ? 0 : mySeat;
  const [finished, setFinished] = useState(false);
  const myTurn =
    !watching &&
    !busy &&
    state.phase === 'bidding' &&
    actors.includes(seats[mySeat].id) &&
    state.current === mySeat;
  usePerudoSounds(state, viewer);

  if (finished && over)
    return (
      <PerudoResults
        state={state}
        avatars={avatars}
        bots={bots}
        me={mySeat}
        onHome={onLeave}
        homeLabel={t('Quitter la table')}
      />
    );

  const current = state.players[state.current];
  const nextIn = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  return (
    <PerudoBoard
      state={state}
      viewer={viewer}
      watching={watching}
      avatars={avatars}
      bots={bots}
      myTurn={myTurn}
      busy={busy}
      error={error ? t(error) : null}
      onMove={onMove}
      onBack={onLeave}
      top={
        <>
          {state.phase === 'bidding' && deadline && !bots[state.current] && (
            <TurnTimer
              deadline={deadline}
              now={now}
              name={state.current === mySeat ? t('Toi') : current.name}
              seconds={60}
            />
          )}
          {watching && <Text style={styles.watching}>{t('Tu regardes la partie.')}</Text>}
        </>
      }
      onNext={
        betweenRounds && !watching && !busy
          ? () => onMove({ type: 'next' } as unknown as PerudoMove)
          : undefined
      }
      nextHint={
        betweenRounds
          ? nextIn
            ? t('La suite commence toute seule dans {n} s.', { n: nextIn })
            : t('La suite commence toute seule.')
          : undefined
      }
      onResults={() => setFinished(true)}
    />
  );
}

const styles = StyleSheet.create({
  // Setup
  setup: { padding: 20, paddingTop: 40, paddingBottom: 30 },
  column: { width: '100%', maxWidth: COLUMN_MAX_WIDTH, alignSelf: 'center' },
  hero: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginBottom: 6 },
  heroDice: { flexDirection: 'row', gap: 4, marginBottom: 2 },
  title: { color: colors.gold, fontSize: 34, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.muted, textAlign: 'center', marginBottom: 4 },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  flex2: { flex: 2 },
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
    minWidth: 0,
  },
  counts: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  count: {
    minWidth: 48,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  countWide: { flex: 1 },
  countOn: { borderColor: colors.gold, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.12)' },
  countText: { color: colors.muted, fontWeight: '800', fontSize: 16 },
  countTextOn: { color: colors.gold },
  hint: { color: colors.muted, marginTop: 8, fontSize: 13 },
  spacer: { height: 20 },
  pressed: { opacity: 0.6 },

  // Table
  topInfo: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pillText: { color: colors.gold, fontWeight: '800', fontSize: 13 },
  watching: { color: colors.muted, textAlign: 'center', fontSize: 13 },
  rail: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 40,
    padding: 9,
    overflow: 'hidden',
    backgroundColor: colors.rail,
    borderWidth: 2,
    borderColor: colors.railBorder,
    boxShadow: '0 10px 30px rgba(0,0,0,0.6), inset 0 2px 3px rgba(255,220,170,0.35)',
  },
  felt: {
    flex: 1,
    borderRadius: 32,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.felt,
    borderWidth: 2,
    borderColor: colors.feltBorder,
    boxShadow: 'inset 0 6px 18px rgba(0,0,0,0.55)',
  },
  feltGlow: {
    position: 'absolute',
    width: '60%',
    height: '45%',
    borderRadius: 999,
    backgroundColor: colors.glow,
    boxShadow: `0 0 60px 40px ${colors.glow}`,
  },
  feltLine: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    left: 10,
    right: 10,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 213, 120, 0.22)',
  },
  feltMark: { position: 'absolute', opacity: 0.1, color: '#ffffff' },

  seat: { position: 'absolute', alignItems: 'center' },
  seatOut: { opacity: 0.45 },
  avatarRing: { borderRadius: 999, borderWidth: 2, borderColor: 'transparent', padding: 1 },
  avatarRingLarge: { borderWidth: 3 },
  avatarActive: { borderColor: colors.gold, boxShadow: `0 0 12px ${colors.gold}` },
  plate: {
    marginTop: -4,
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    gap: 2,
  },
  plateLarge: { paddingVertical: 5, borderRadius: 12, gap: 4 },
  plateActive: { borderColor: colors.gold },
  name: { color: colors.text, fontSize: 11, fontWeight: '700', maxWidth: '100%' },
  nameLarge: { fontSize: 14 },
  outText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  cupRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cupCount: { color: colors.gold, fontWeight: '900', fontSize: 13 },
  cupCountLarge: { fontSize: 17 },
  miniDice: { flexDirection: 'row', gap: 2, minHeight: 12 },
  mini: { backgroundColor: colors.card, borderWidth: 1, borderColor: '#d9d0b8' },
  miniMatch: { borderColor: colors.gold, borderWidth: 1.5, boxShadow: `0 0 5px ${colors.gold}` },
  miniDim: { opacity: 0.4 },
  cupBody: { overflow: 'hidden', boxShadow: '0 3px 6px rgba(0,0,0,0.5)' },
  cupBand: { position: 'absolute', left: 0, right: 0, backgroundColor: 'rgba(232,199,102,0.65)' },
  cupRim: { backgroundColor: '#2a1006', marginTop: -1 },
  bubble: {
    position: 'absolute',
    top: -12,
    right: -10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  bubbleLarge: { top: -14, right: -18, paddingHorizontal: 10, paddingVertical: 4 },
  bubbleRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  bubbleText: { color: colors.text, fontWeight: '800', fontSize: 12 },
  bubbleTextLarge: { fontSize: 15 },
  bubbleHot: { color: colors.gold },
  loss: { position: 'absolute', top: 30, left: 0, right: 0, alignItems: 'center' },
  lossText: {
    color: '#ff8a80',
    fontWeight: '900',
    fontSize: 16,
    textShadowColor: '#000',
    textShadowRadius: 4,
  },
  gainText: { color: '#9cf09c' },

  center: { position: 'absolute', left: 0, alignItems: 'center' },
  bidBox: { alignItems: 'center', gap: 2, paddingHorizontal: 12 },
  bidLabel: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bidLabelLarge: { fontSize: 14 },
  bidOpen: { color: colors.gold, fontWeight: '800', fontSize: 20 },
  bidOpenLarge: { fontSize: 26 },
  bidRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bidQty: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 38,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  bidQtyLarge: { fontSize: 52 },
  bidTimes: { color: colors.muted, fontWeight: '800', fontSize: 24 },
  bidTimesLarge: { fontSize: 30 },
  bidHint: { color: 'rgba(255,255,255,0.6)', fontSize: 11, textAlign: 'center' },

  mine: { position: 'absolute', left: 0, alignItems: 'center', gap: 6 },
  mineHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mineLabel: { color: colors.text, fontWeight: '700', fontSize: 12 },
  mineLabelLarge: { fontSize: 15 },
  myDice: { flexDirection: 'row' },
  myDie: { borderWidth: 2, borderColor: 'transparent' },
  myDieGlow: { borderColor: colors.gold, boxShadow: `0 0 12px ${colors.gold}` },
  dim: { opacity: 0.45 },

  revealWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  revealWrapLarge: { paddingTop: 30 },
  callBurst: { position: 'absolute', top: '38%' },
  callBurstHigh: { top: '20%' },
  callBurstText: {
    color: colors.gold,
    fontSize: 44,
    fontWeight: '900',
    textShadowColor: '#000',
    textShadowRadius: 8,
  },
  callBurstLarge: { fontSize: 64 },
  reveal: {
    width: 270,
    padding: 12,
    gap: 5,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,10,0.82)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  revealLarge: { width: 360, padding: 16, gap: 8 },
  revealTitle: { color: colors.gold, fontSize: 20, fontWeight: '900' },
  revealTitleLarge: { fontSize: 26 },
  revealText: { color: colors.text, fontSize: 13, textAlign: 'center' },
  revealCount: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  revealBig: { color: colors.text, fontWeight: '900', fontSize: 20 },
  revealBigLarge: { fontSize: 26 },
  revealResult: { fontWeight: '800', fontSize: 15, textAlign: 'center' },
  revealGood: { color: '#9cf09c' },
  revealBad: { color: '#ff8a80' },
  revealWinner: { color: colors.gold, fontWeight: '900', fontSize: 15, textAlign: 'center' },
  revealHint: { color: colors.muted, fontSize: 11, textAlign: 'center' },

  // Controls
  bottom: { gap: 6 },
  prompt: { color: colors.muted, textAlign: 'center', fontWeight: '700', fontSize: 14 },
  promptLarge: { fontSize: 16 },
  promptMine: { color: colors.gold },
  error: { color: colors.gold, textAlign: 'center', fontSize: 13 },
  picker: { gap: 6 },
  pickRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  faces: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  facesLarge: { gap: 8 },
  pickRowLarge: { justifyContent: 'center', gap: 28 },
  faceBtn: {
    padding: 4,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  faceOn: { borderColor: colors.gold, backgroundColor: 'rgba(255,255,255,0.14)' },
  faceOff: { opacity: 0.3 },
  pacoTag: { color: colors.gold, fontSize: 9, fontWeight: '800', marginTop: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  step: {
    width: 38,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  stepText: { color: colors.text, fontSize: 22, fontWeight: '800' },
  qtyBox: { minWidth: 54, alignItems: 'center' },
  qty: { color: colors.text, fontSize: 24, fontWeight: '900' },
  qtyHint: { color: colors.muted, fontSize: 10 },

  // Results
  results: { padding: 16, paddingTop: 36, paddingBottom: 30 },
  trophy: { fontSize: 44, textAlign: 'center' },
  winner: { color: colors.gold, fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  podium: { gap: 4, marginTop: 14 },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  podiumFirst: { backgroundColor: 'rgba(255,255,255,0.08)' },
  podiumPlace: { width: 28, textAlign: 'center', fontSize: 16, color: colors.muted, fontWeight: '700' },
  podiumName: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  podiumNameFirst: { color: colors.gold, fontWeight: '800' },
  podiumTotal: { color: colors.text, fontSize: 14, fontWeight: '700' },
});
