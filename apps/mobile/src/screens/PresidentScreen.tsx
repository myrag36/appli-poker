import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  type Avatar,
  type Card,
  type PresidentMove,
  type PresidentPlay,
  type PresidentState,
  type PresidentTitle,
  type PresidentView,
  type Rng,
  PRESIDENT_DEFAULT_ROUNDS,
  PRESIDENT_ROUND_CHOICES,
  PRESIDENT_TITLE_NAMES,
  botName,
  defaultAvatar,
  presidentApply,
  presidentBotMove,
  presidentCanPass,
  presidentCanPlay,
  presidentLegalPlays,
  presidentNewGame,
  presidentNextRound,
  presidentPoints,
  presidentStandings,
  presidentToBeat,
} from '@appli-poker/engine';
import { AvatarBadge, AvatarPicker } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { reportLocalGame, useFeat } from '../online/progress';
import { OnlineButton } from '../components/OnlineButton';
import { RulesButton } from '../components/Rules';
import { PRESIDENT_RULES } from '../rules';
import { GameLayout } from '../components/GameLayout';
import { Appear } from '../components/Motion';
import { Panel } from '../components/Panel';
import { PlayingCard } from '../components/PlayingCard';
import { TopBar } from '../components/TopBar';
import { TurnTimer } from '../components/TurnTimer';
import type { OnlineBoardProps, OnlineOptionsProps } from '../online-games/types';
import { sounds } from '../feedback';
import { deviceRng } from '../rng';
import { lang, t, tn } from '../i18n';
import { colors, gradients, shadow, theme } from '../theme';

/** How long a robot seems to think before playing, in ms. */
const BOT_DELAY = 950;
/** A won trick stays in view a little longer before the next lead. */
const TRICK_PAUSE = 1500;
const botRng: Rng = (max) => Math.floor(Math.random() * max);
const ME = 0;

const SEAT_W = 66;
const SEAT_H = 74;

const SHORT_TITLES: Record<PresidentTitle, string> = {
  president: t('👑 Président'),
  'vice-president': t('Vice-prés.'),
  neutre: t('Neutre'),
  'vice-trouduc': t('Vice-trou.'),
  trouduc: t('Trouduc'),
};

const RANK_NAMES: Record<string, string> = { T: '10', J: t('Valet'), Q: t('Dame'), K: t('Roi'), A: t('As') };
const SET_NAMES = ['', '', 'une paire de {rank}', 'un brelan de {rank}', 'un carré de {rank}'];

function describe(cards: Card[]): string {
  const r = cards[0][0];
  const name = RANK_NAMES[r] ?? r;
  if (cards.length === 1) return r === 'Q' ? t('une {rank}', { rank: name }) : t('un {rank}', { rank: name });
  // French keeps numbers and "As" as they are ("une paire de 7"); English always adds an s ("a pair of 7s").
  const plural = lang === 'en' || !/\d|s$/.test(name) ? `${name}s` : name;
  return t(SET_NAMES[cards.length], { rank: plural });
}

function titleColor(title: PresidentTitle): { bg: string; fg: string } {
  switch (title) {
    case 'president':
      return { bg: colors.gold, fg: colors.onGold };
    case 'vice-president':
      return { bg: colors.goldBorder, fg: colors.onGold };
    case 'trouduc':
      return { bg: colors.danger, fg: '#fff' };
    case 'vice-trouduc':
      return { bg: '#8a5a44', fg: '#fff' };
    default:
      return { bg: 'rgba(255,255,255,0.18)', fg: colors.text };
  }
}

function TitleBadge({ title, full }: { title: PresidentTitle; full?: boolean }) {
  const c = titleColor(title);
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]} numberOfLines={1}>
        {full ? t(PRESIDENT_TITLE_NAMES[title]) : SHORT_TITLES[title]}
      </Text>
    </View>
  );
}

interface Settings {
  name: string;
  avatar: Avatar;
  robots: number;
}

export function PresidentScreen({ onBack, onOnline }: { onBack: () => void; onOnline?: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [gameKey, setGameKey] = useState(0);
  if (!settings) return <Setup onStart={setSettings} onBack={onBack} onOnline={onOnline} />;
  return (
    <Game
      key={gameKey}
      settings={settings}
      onQuit={() => setSettings(null)}
      onReplay={() => setGameKey((k) => k + 1)}
    />
  );
}

/* ---------------------------------------------------------------- setup */

function Setup({
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
  const [robots, setRobots] = useState(3);

  return (
    <ScrollView contentContainerStyle={styles.setup} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        {['2c', '2d', '2h', '2s'].map((c, i) => (
          <View
            key={c}
            style={{ transform: [{ rotate: `${(i - 1.5) * 10}deg` }], marginTop: Math.abs(i - 1.5) * 6 }}
          >
            <PlayingCard card={c} width={46} />
          </View>
        ))}
      </View>
      <Text style={styles.title}>{t('Président')}</Text>
      <Text style={styles.subtitle}>{t('Vide ta main le premier pour devenir Président !')}</Text>
      {onOnline && <OnlineButton onPress={onOnline} />}
      <RulesButton rules={PRESIDENT_RULES} />

      <Text style={styles.section}>{t('Ton nom')}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Changer d'avatar")}
          onPress={() => setPicking(!picking)}
        >
          <AvatarBadge avatar={avatar} size={44} />
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
        {[2, 3, 4, 5, 6, 7].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityState={{ selected: n === robots }}
            onPress={() => setRobots(n)}
            style={[styles.count, n === robots && styles.countOn]}
          >
            <Text style={[styles.countText, n === robots && styles.countTextOn]}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>
        {52 % (robots + 1) === 0
          ? t('{players} joueurs autour de la table · {n} cartes chacun', {
              players: robots + 1,
              n: 52 / (robots + 1),
            })
          : t('{players} joueurs autour de la table · {min} ou {max} cartes chacun', {
              players: robots + 1,
              min: Math.floor(52 / (robots + 1)),
              max: Math.ceil(52 / (robots + 1)),
            })}
      </Text>

      <View style={styles.spacer} />
      <Button
        label={t('Lancer la partie')}
        onPress={() => onStart({ name: name.trim() || t('Toi'), avatar, robots })}
      />
      <Button label={t('Retour')} variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

/* ---------------------------------------------------------------- game */

function Game({
  settings,
  onQuit,
  onReplay,
}: {
  settings: Settings;
  onQuit: () => void;
  onReplay: () => void;
}) {
  const roster = useMemo(() => {
    const names = [settings.name];
    for (let i = 0; i < settings.robots; i++) names.push(botName(names));
    return names.map((name, i) => ({ id: `p${i}`, name }));
  }, [settings]);
  const avatars = useMemo(
    () => [settings.avatar, ...Array.from({ length: settings.robots }, (_, i) => defaultAvatar(i + 1))],
    [settings],
  );
  const [state, setState] = useState<PresidentState>(() => presidentNewGame(roster, deviceRng));
  const [selected, setSelected] = useState<Card[]>([]);
  const [stopped, setStopped] = useState(false);
  useFeat('president', state.titles[ME] === 'president');
  /** Round whose exchange recap I have closed; robots wait until then. */
  const [exchangeSeen, setExchangeSeen] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const me = state.players[ME];
  const n = state.players.length;
  const myTurn = state.toAct === ME;
  const iGave = state.exchanges.some((e) => e.from === ME || e.to === ME);
  const showExchange = state.phase === 'playing' && state.round > 1 && iGave && exchangeSeen < state.round;
  const legal = useMemo(
    () => (myTurn && state.phase === 'playing' ? presidentLegalPlays(state, ME) : []),
    [state, myTurn],
  );
  const pending = state.phase === 'exchange' ? state.pendingGives[0] : undefined;

  // Sounds for what just happened.
  const prev = useRef(state);
  useEffect(() => {
    const before = prev.current;
    prev.current = state;
    if (before === state) return;
    if (state.phase === 'roundOver' && before.phase !== 'roundOver') {
      if (state.titles[ME] === 'president') sounds.win();
      else sounds.chips();
      return;
    }
    if (state.played.length > before.played.length) sounds.card();
    else if (state.players.some((p, i) => p.passed && !before.players[i].passed)) sounds.fold();
    if (state.toAct === ME && before.toAct !== ME) sounds.myTurn();
  }, [state]);

  // Robots play on their own after a short pause.
  useEffect(() => {
    if (state.toAct <= ME || showExchange) return;
    const delay = state.trick.length === 0 && state.lastTrick ? TRICK_PAUSE : BOT_DELAY;
    const id = setTimeout(() => {
      setState((s) => (s.toAct > ME ? presidentApply(s, s.toAct, presidentBotMove(s, s.toAct, botRng)) : s));
    }, delay);
    return () => clearTimeout(id);
  }, [state, showExchange]);

  function act(move: PresidentMove) {
    try {
      setState(presidentApply(state, ME, move));
      setSelected([]);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // A card can be tapped if some legal play holds it together with what is already picked.
  function enabled(card: Card): boolean {
    if (pending && myTurn) return selected.includes(card) || selected.length < pending.count;
    if (!myTurn || state.phase !== 'playing') return false;
    return legal.some((p) => p.includes(card));
  }

  function tap(card: Card) {
    if (selected.includes(card)) return setSelected(selected.filter((c) => c !== card));
    if (pending) return setSelected([...selected, card]);
    const withIt = [...selected, card];
    if (legal.some((p) => withIt.every((c) => p.includes(c)))) setSelected(withIt);
    else setSelected([card]);
  }

  function nextRound() {
    setState(presidentNextRound(state, deviceRng));
    setSelected([]);
  }

  const canPlay = myTurn && selected.length > 0 && presidentCanPlay(state, ME, selected);
  const toBeat = presidentToBeat(state);
  const received = new Set(state.exchanges.filter((e) => e.to === ME).flatMap((e) => e.cards));

  let prompt: string;
  if (state.phase === 'roundOver') prompt = t('Manche terminée');
  else if (pending && myTurn)
    prompt = tn(
      pending.count,
      'Choisis {n} carte à rendre à {name}',
      'Choisis {n} cartes à rendre à {name}',
      {
        name: state.players[pending.to].name,
      },
    );
  else if (pending)
    prompt = t('{name} choisit les cartes à rendre…', { name: state.players[state.toAct].name });
  else if (myTurn && !toBeat)
    prompt =
      state.round === 1 && state.played.length === 0
        ? t('À toi ! Ouvre avec le 3 de trèfle')
        : t('À toi de mener : joue ce que tu veux');
  else if (myTurn) {
    const last = state.trick[state.trick.length - 1];
    prompt = legal.length
      ? t('À toi ! Bats {cards} ou passe', { cards: describe(last.cards) })
      : t('Tu ne peux pas suivre : passe');
  } else if (me.hand.length === 0) prompt = t('Tu as fini, regarde les autres…');
  else prompt = t('{name} réfléchit…', { name: state.players[state.toAct]?.name });

  if (stopped) {
    return <FinalRanking state={state} avatars={avatars} onReplay={onReplay} onQuit={onQuit} />;
  }

  function stop() {
    setStopped(true);
    // Experience once at least one round is over; a win if I lead the points.
    if (state.round > 1 || state.phase === 'roundOver')
      reportLocalGame(
        'president',
        presidentStandings(state).some((r) => r.index === ME && r.place === 1),
      );
  }

  return (
    <GameLayout
      top={
        <TopBar onBack={onQuit} backLabel={t('← Quitter')}>
          <Text style={styles.topInfo}>{t('Manche {n}', { n: state.round })}</Text>
          <View style={styles.scorePill}>
            <Text style={styles.scoreText}>{tn(me.score, '⭐ {n} pt', '⭐ {n} pts')}</Text>
          </View>
        </TopBar>
      }
      table={({ width, height }) => (
        <TableView state={state} avatars={avatars} width={width} height={height}>
          {state.phase === 'roundOver' && (
            <RoundRecap state={state} avatars={avatars} onNext={nextRound} onStop={stop} />
          )}
          {showExchange && <ExchangeRecap state={state} onClose={() => setExchangeSeen(state.round)} />}
        </TableView>
      )}
      bottom={
        state.phase === 'roundOver' ? null : (
          <View style={styles.bottom}>
            <Text style={[styles.prompt, myTurn && styles.promptMine]} numberOfLines={1}>
              {prompt}
            </Text>
            <Hand
              cards={me.hand}
              selected={selected}
              received={received}
              enabled={enabled}
              onTap={tap}
              active={myTurn && !showExchange}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            {pending && myTurn ? (
              <Button
                compact
                label={t('Donner {i}/{n}', { i: selected.length, n: pending.count })}
                disabled={selected.length !== pending.count}
                onPress={() => act({ type: 'give', cards: selected })}
              />
            ) : (
              <View style={styles.actions}>
                <View style={styles.flex}>
                  <Button
                    compact
                    variant="secondary"
                    label={t('Passer')}
                    disabled={!presidentCanPass(state, ME) || showExchange}
                    onPress={() => act({ type: 'pass' })}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    compact
                    label={
                      selected.length
                        ? tn(selected.length, 'Jouer {n} carte', 'Jouer {n} cartes')
                        : t('Jouer')
                    }
                    disabled={!canPlay || showExchange}
                    onPress={() => act({ type: 'play', cards: selected })}
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

/* ---------------------------------------------------------------- table */

function TableView({
  state,
  avatars,
  width,
  height,
  children,
}: {
  state: PresidentState;
  avatars: Avatar[];
  width: number;
  height: number;
  children?: ReactNode;
}) {
  const w = Math.min(width, 460);
  const h = height;
  const n = state.players.length;
  const robots = n - 1;
  const cx = w / 2;
  // Robots sit on the upper half of an ellipse whose center is a little below the middle.
  const cy = Math.round(h * 0.58);
  const rx = w / 2 - SEAT_W / 2;
  const ry = cy - SEAT_H / 2 - 2;
  const seat = (k: number) => {
    const angle = Math.PI - ((k + 0.5) * Math.PI) / robots;
    return { x: cx + rx * Math.cos(angle), y: cy - ry * Math.sin(angle) };
  };
  const trickY = Math.round(Math.min(h - 70, cy + 14));
  const cardW = Math.max(38, Math.min(54, Math.floor(w / 7)));

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

      <Trick state={state} cardW={cardW} top={trickY} width={w} />

      {state.players.slice(1).map((p, k) => {
        const i = k + 1;
        const { x, y } = seat(k);
        const active = state.toAct === i;
        const title = state.titles[i];
        const place = state.finished.indexOf(i);
        return (
          <View
            key={p.id}
            pointerEvents="none"
            style={[styles.seat, { left: x - SEAT_W / 2, top: y - SEAT_H / 2 }]}
          >
            <View
              style={[styles.avatarRing, active && styles.avatarActive, p.hand.length === 0 && styles.out]}
            >
              <AvatarBadge avatar={avatars[i]} size={38} />
            </View>
            <View style={[styles.plate, active && styles.plateActive]}>
              <Text style={styles.name} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={styles.cards}>
                {p.hand.length > 0
                  ? `🂠 ${p.hand.length}`
                  : place >= 0
                    ? t('Fini {n}ᵉ', { n: place + 1 })
                    : '—'}
              </Text>
            </View>
            {title && state.phase !== 'roundOver' && <TitleBadge title={title} />}
            {p.passed && (
              <Appear from={6} style={styles.passBubble}>
                <Text style={styles.passText}>{t('Passe')}</Text>
              </Appear>
            )}
          </View>
        );
      })}

      <View pointerEvents="none" style={[styles.mePlate, { top: h - 34 }]}>
        <AvatarBadge avatar={avatars[ME]} size={24} />
        <Text style={styles.meName} numberOfLines={1}>
          {state.players[ME].name}
        </Text>
        {state.titles[ME] && state.phase !== 'roundOver' && <TitleBadge title={state.titles[ME]!} />}
        {state.players[ME].passed && <Text style={styles.mePassed}>{t('Passe')}</Text>}
        {state.players[ME].hand.length === 0 && state.phase === 'playing' && (
          <Text style={styles.mePassed}>{t('Fini {n}ᵉ', { n: state.finished.indexOf(ME) + 1 })}</Text>
        )}
      </View>

      {children}
    </View>
  );
}

function Fan({ cards, cardW, dim }: { cards: Card[]; cardW: number; dim?: boolean }) {
  return (
    <View style={styles.fan}>
      {cards.map((c, i) => (
        <View
          key={c}
          style={{
            marginLeft: i === 0 ? 0 : -cardW * 0.45,
            transform: [
              { rotate: `${(i - (cards.length - 1) / 2) * 8}deg` },
              { translateY: Math.abs(i - (cards.length - 1) / 2) * 3 },
            ],
          }}
        >
          <PlayingCard card={c} width={cardW} />
          {dim && <View style={[styles.shade, { borderRadius: Math.max(4, cardW * 0.1) }]} />}
        </View>
      ))}
    </View>
  );
}

function Trick({
  state,
  cardW,
  top,
  width,
}: {
  state: PresidentState;
  cardW: number;
  top: number;
  width: number;
}) {
  const plays: PresidentPlay[] = state.trick.length ? state.trick : (state.lastTrick?.plays ?? []);
  const shown = plays.slice(-3);
  const last = shown[shown.length - 1];
  const cardH = cardW * 1.4;
  let caption = '';
  if (state.phase === 'exchange') caption = t('Échange des cartes…');
  else if (state.trick.length && last)
    caption = t('{name} : {cards}', { name: who(state, last.player), cards: describe(last.cards) });
  else if (state.lastTrick) {
    const winner = state.lastTrick.winner;
    if (state.toAct === ME)
      caption =
        winner === ME
          ? t('Pli pour toi · à toi de mener')
          : t('Pli pour {name} · à toi de mener', { name: who(state, winner) });
    else if (state.toAct >= 0)
      caption =
        winner === ME
          ? t('Pli pour toi · {lead} mène', { lead: who(state, state.toAct) })
          : t('Pli pour {name} · {lead} mène', { name: who(state, winner), lead: who(state, state.toAct) });
    else caption = winner === ME ? t('Pli pour toi') : t('Pli pour {name}', { name: who(state, winner) });
  } else if (state.toAct === ME) caption = t('À toi de commencer');
  else if (state.toAct >= 0) caption = t('{name} commence', { name: who(state, state.toAct) });

  return (
    <View pointerEvents="none" style={[styles.trick, { top: top - cardH / 2, width }]}>
      <View style={{ height: cardH + 10, justifyContent: 'center', alignItems: 'center' }}>
        {shown.length === 0 && <PlayingCard width={cardW} />}
        {shown.map((p, k) => {
          const back = shown.length - 1 - k;
          return (
            <View
              key={`${p.player}-${p.cards.join()}`}
              style={[
                styles.trickPlay,
                {
                  transform: [
                    { translateX: -back * 22 },
                    { translateY: -back * 8 },
                    { scale: 1 - back * 0.08 },
                  ],
                },
                { zIndex: k },
              ]}
            >
              {back === 0 ? (
                <Appear from={-30}>
                  <Fan cards={p.cards} cardW={cardW} dim={state.trick.length === 0} />
                </Appear>
              ) : (
                <Fan cards={p.cards} cardW={cardW} dim />
              )}
            </View>
          );
        })}
      </View>
      {caption !== '' && (
        <Text style={styles.caption} numberOfLines={1}>
          {caption}
        </Text>
      )}
    </View>
  );
}

function who(state: PresidentState, i: number) {
  return i === ME ? t('Toi') : state.players[i].name;
}

/* ---------------------------------------------------------------- hand */

function Hand({
  cards,
  selected,
  received,
  enabled,
  onTap,
  active,
}: {
  cards: Card[];
  selected: Card[];
  received: Set<Card>;
  enabled: (c: Card) => boolean;
  onTap: (c: Card) => void;
  active: boolean;
}) {
  const { width } = useWindowDimensions();
  const avail = Math.min(width, 480) - 24;
  const cardW = cards.length > 15 ? 48 : 54;
  const step = cards.length > 1 ? Math.min(cardW + 4, (avail - cardW) / (cards.length - 1)) : 0;
  const total = cards.length ? cardW + step * (cards.length - 1) : 0;
  const lift = 14;
  return (
    <View style={[styles.hand, { height: cardW * 1.4 + lift + 2 }]}>
      {cards.length === 0 && <Text style={styles.empty}>{t('Plus de cartes !')}</Text>}
      <View style={{ width: total, height: cardW * 1.4 + lift }}>
        {cards.map((c, i) => {
          const on = selected.includes(c);
          const ok = active && enabled(c);
          return (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={t('Carte {card}', { card: c })}
              accessibilityState={{ selected: on, disabled: !ok }}
              disabled={!ok}
              onPress={() => onTap(c)}
              style={[styles.handCard, { left: i * step, top: on ? 0 : lift }]}
            >
              <View style={[on && styles.cardOn, received.has(c) && !on && styles.cardNew]}>
                <PlayingCard card={c} width={cardW} />
                {!ok && active && <View style={styles.shade} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ---------------------------------------------------------------- recaps */

function ExchangeRecap({ state, onClose }: { state: PresidentState; onClose: () => void }) {
  const mine = state.exchanges.filter((e) => e.from === ME || e.to === ME);
  return (
    <View style={styles.overlay}>
      <Appear from={20} style={styles.overlayCard}>
        <Panel compact title={t('Échange des cartes')}>
          {mine.map((e, k) => (
            <View key={k} style={styles.exRow}>
              <Text style={styles.exText}>
                {e.from === ME
                  ? t('Tu donnes à {name}', { name: state.players[e.to].name })
                  : t('{name} te donne', { name: state.players[e.from].name })}
              </Text>
              <View style={styles.fanRow}>
                {e.cards.map((c) => (
                  <PlayingCard key={c} card={c} width={34} />
                ))}
              </View>
            </View>
          ))}
          <Text style={styles.exHint}>
            {state.titles[ME] === 'trouduc'
              ? t('Tu es Trouduc : à toi de commencer. Courage !')
              : t('{name} (Trouduc) commence la manche.', {
                  name: state.players[state.titles.indexOf('trouduc')].name,
                })}
          </Text>
          <Button compact label={t("C'est parti !")} onPress={onClose} />
        </Panel>
      </Appear>
    </View>
  );
}

function RoundRecap({
  state,
  avatars,
  onNext,
  onStop,
  note,
  disabled,
}: {
  state: PresidentState;
  avatars: Avatar[];
  onNext: () => void;
  /** Absent online: the game ends after the rounds chosen for the table. */
  onStop?: () => void;
  /** A line under the buttons (online: the next round starts on its own). */
  note?: string;
  disabled?: boolean;
}) {
  const n = state.players.length;
  const mine = state.exchanges.filter((e) => e.from === ME || e.to === ME);
  return (
    <View style={styles.overlay}>
      <Appear from={20} style={styles.overlayCard}>
        <Panel compact title={t('Fin de la manche {n}', { n: state.round })}>
          {state.finished.map((p, pos) => {
            const title = state.titles[p]!;
            return (
              <View key={p} style={[styles.recapRow, p === ME && styles.recapMe]}>
                <Text style={styles.recapPos}>{pos + 1}</Text>
                <AvatarBadge avatar={avatars[p]} size={22} />
                <Text style={styles.recapName} numberOfLines={1}>
                  {who(state, p)}
                </Text>
                <TitleBadge title={title} full />
                <Text style={styles.recapPts}>+{presidentPoints(title, n)}</Text>
                <Text style={styles.recapTotal}>{state.players[p].score}</Text>
              </View>
            );
          })}
          {mine.length > 0 && (
            <View style={styles.recapEx}>
              {mine.map((e, k) => (
                <View key={k} style={styles.exRowSmall}>
                  <Text style={styles.exTextSmall}>
                    {e.from === ME
                      ? t('Donné à {name}', { name: state.players[e.to].name })
                      : t('Reçu de {name}', { name: state.players[e.from].name })}
                  </Text>
                  <View style={styles.fanRow}>
                    {e.cards.map((c) => (
                      <PlayingCard key={c} card={c} width={22} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.exHint}>
            {state.titles[ME] === 'president'
              ? t('Bravo, Président ! Le Trouduc va te donner ses 2 meilleures cartes.')
              : state.titles[ME] === 'trouduc'
                ? t('Aïe, Trouduc… Tu donneras tes 2 meilleures cartes au Président.')
                : t('Prochaine manche : échange des cartes puis le Trouduc commence.')}
          </Text>
          <View style={styles.actions}>
            {onStop && (
              <View style={styles.flex}>
                <Button compact variant="secondary" label={t('Arrêter')} onPress={onStop} />
              </View>
            )}
            <View style={styles.flex}>
              <Button compact label={t('Manche suivante')} onPress={onNext} disabled={disabled} />
            </View>
          </View>
          {note && <Text style={styles.exHint}>{note}</Text>}
        </Panel>
      </Appear>
    </View>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

function FinalRanking({
  state,
  avatars,
  onReplay,
  onQuit,
  quitLabel = t('Retour'),
  spectator,
}: {
  state: PresidentState;
  avatars: Avatar[];
  /** Absent online: a new game starts from a new table. */
  onReplay?: () => void;
  onQuit: () => void;
  quitLabel?: string;
  /** Watching an online table: nobody is "me". */
  spectator?: boolean;
}) {
  const standings = presidentStandings(state);
  const rounds = state.phase === 'roundOver' ? state.round : state.round - 1;
  const myPlace = spectator ? 0 : standings.find((s) => s.index === ME)!.place;
  return (
    <ScrollView contentContainerStyle={styles.setup}>
      <Appear>
        <Text style={styles.trophy}>{myPlace === 1 ? '🏆' : '🃏'}</Text>
      </Appear>
      <Text style={styles.title}>{myPlace === 1 ? t('Tu gagnes !') : t('Partie terminée')}</Text>
      <Text style={styles.subtitle}>{tn(rounds, '{n} manche jouée', '{n} manches jouées')}</Text>
      <Panel title={t('Classement')}>
        {standings.map((s, k) => (
          <Appear key={s.index} delay={k * 80} from={10}>
            <View style={[styles.finalRow, s.index === ME && !spectator && styles.recapMe]}>
              <Text style={styles.finalPlace}>{MEDALS[s.place - 1] ?? t('{n}ᵉ', { n: s.place })}</Text>
              <AvatarBadge avatar={avatars[s.index]} size={30} />
              <Text style={[styles.finalName, s.place === 1 && styles.finalNameFirst]} numberOfLines={1}>
                {spectator ? state.players[s.index].name : who(state, s.index)}
              </Text>
              <Text style={styles.finalScore}>{tn(s.score, '{n} pt', '{n} pts')}</Text>
            </View>
          </Appear>
        ))}
      </Panel>
      <View style={styles.spacer} />
      {onReplay && <Button label={t('Rejouer')} onPress={onReplay} />}
      <Button label={quitLabel} variant="secondary" onPress={onQuit} />
    </ScrollView>
  );
}

/* ---------------------------------------------------------------- online */

/** Turns the table so that seat `by` sits at index ME (the bottom), as the local screen draws it. */
function rotateView(v: PresidentView, by: number): PresidentState {
  const n = v.players.length;
  if (by <= 0) return v;
  const r = (i: number) => (i < 0 ? i : (i - by + n) % n);
  const turn = <T,>(a: T[]) => a.map((_, i) => a[(i + by) % n]);
  const play = (p: PresidentPlay) => ({ ...p, player: r(p.player) });
  return {
    ...v,
    players: turn(v.players),
    titles: turn(v.titles),
    toAct: r(v.toAct),
    trick: v.trick.map(play),
    lastTrick: v.lastTrick && { winner: r(v.lastTrick.winner), plays: v.lastTrick.plays.map(play) },
    finished: v.finished.map(r),
    pendingGives: v.pendingGives.map((g) => ({ ...g, from: r(g.from), to: r(g.to) })),
    exchanges: v.exchanges.map((e) => ({ ...e, from: r(e.from), to: r(e.to) })),
  };
}

/** The same table as the local game, each player on their own phone. */
export function PresidentOnlineBoard({
  view,
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
}: OnlineBoardProps<PresidentView>) {
  const spectator = mySeat < 0;
  const by = Math.max(0, mySeat);
  const state = useMemo(() => rotateView(view, by), [view, by]);
  const avatars = useMemo(() => seats.map((_, i) => seats[(i + by) % seats.length].avatar), [seats, by]);
  const [selected, setSelected] = useState<Card[]>([]);
  /** Round whose exchange recap I have closed. */
  const [exchangeSeen, setExchangeSeen] = useState(1);

  const me = state.players[ME];
  const myTurn = !spectator && state.toAct === ME && actors.includes(seats[mySeat]?.id);
  const iGave = !spectator && state.exchanges.some((e) => e.from === ME || e.to === ME);
  const showExchange = state.phase === 'playing' && state.round > 1 && iGave && exchangeSeen < state.round;
  const legal = useMemo(
    () => (myTurn && state.phase === 'playing' ? presidentLegalPlays(state, ME) : []),
    [state, myTurn],
  );
  const pending = state.phase === 'exchange' ? state.pendingGives[0] : undefined;

  // Picked cards that left my hand, or a turn that went by, clear the selection.
  useEffect(() => {
    setSelected((sel) => (myTurn ? sel.filter((c) => me.hand.includes(c)) : []));
  }, [state, myTurn]);

  // Sounds follow what happens at the table, whoever played.
  const prev = useRef(state);
  useEffect(() => {
    const before = prev.current;
    prev.current = state;
    if (before === state) return;
    if (state.phase === 'roundOver' && before.phase !== 'roundOver') {
      if (!spectator && state.titles[ME] === 'president') sounds.win();
      else sounds.chips();
      return;
    }
    if (state.played.length > before.played.length) sounds.card();
    else if (state.players.some((p, i) => p.passed && !before.players[i]?.passed)) sounds.fold();
    if (myTurn && before.toAct !== ME) sounds.myTurn();
  }, [state]);

  if (over) {
    return (
      <FinalRanking
        state={state}
        avatars={avatars}
        onQuit={onLeave}
        quitLabel={t('Quitter la table')}
        spectator={spectator}
      />
    );
  }

  function enabled(card: Card): boolean {
    if (busy) return false;
    if (pending && myTurn) return selected.includes(card) || selected.length < pending.count;
    if (!myTurn || state.phase !== 'playing') return false;
    return legal.some((p) => p.includes(card));
  }

  function tap(card: Card) {
    if (selected.includes(card)) return setSelected(selected.filter((c) => c !== card));
    if (pending) return setSelected([...selected, card]);
    const withIt = [...selected, card];
    if (legal.some((p) => withIt.every((c) => p.includes(c)))) setSelected(withIt);
    else setSelected([card]);
  }

  const canPlay = myTurn && !busy && selected.length > 0 && presidentCanPlay(state, ME, selected);
  const toBeat = presidentToBeat(state);
  const received = new Set(state.exchanges.filter((e) => e.to === ME).flatMap((e) => e.cards));
  const actor = state.toAct >= 0 ? state.players[state.toAct] : undefined;
  const actorSeat = view.toAct >= 0 ? seats[view.toAct] : undefined;
  const actorName = actor ? `${actorSeat?.bot ? '🤖 ' : ''}${actor.name}` : '';

  let prompt: string;
  if (state.phase === 'roundOver') prompt = t('Manche terminée');
  else if (pending && myTurn)
    prompt = tn(
      pending.count,
      'Choisis {n} carte à rendre à {name}',
      'Choisis {n} cartes à rendre à {name}',
      {
        name: state.players[pending.to].name,
      },
    );
  else if (pending) prompt = t('{name} choisit les cartes à rendre…', { name: actorName });
  else if (myTurn && !toBeat)
    prompt =
      state.round === 1 && state.played.length === 0
        ? t('À toi ! Ouvre avec le 3 de trèfle')
        : t('À toi de mener : joue ce que tu veux');
  else if (myTurn) {
    const last = state.trick[state.trick.length - 1];
    prompt = legal.length
      ? t('À toi ! Bats {cards} ou passe', { cards: describe(last.cards) })
      : t('Tu ne peux pas suivre : passe');
  } else if (spectator) prompt = t('Tu regardes la partie · {name} joue', { name: actorName });
  else if (me.hand.length === 0) prompt = t('Tu as fini, regarde les autres…');
  else prompt = t('{name} réfléchit…', { name: actorName });

  const secondsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
  const showTimer = deadline !== null && !betweenRounds && actorSeat !== undefined && !actorSeat.bot;

  return (
    <GameLayout
      top={
        <>
          <TopBar onBack={onLeave} backLabel={t('← Quitter')}>
            <Text style={styles.topInfo}>
              {t('Manche {n}/{total}', { n: state.round, total: view.rounds })}
            </Text>
            {!spectator && (
              <View style={styles.scorePill}>
                <Text style={styles.scoreText}>{tn(me.score, '⭐ {n} pt', '⭐ {n} pts')}</Text>
              </View>
            )}
          </TopBar>
          {showTimer && (
            <TurnTimer deadline={deadline!} now={now} name={myTurn ? t('Toi') : actor!.name} seconds={60} />
          )}
        </>
      }
      table={({ width, height }) => (
        <TableView state={state} avatars={avatars} width={width} height={height}>
          {betweenRounds && state.phase === 'roundOver' && (
            <RoundRecap
              state={state}
              avatars={avatars}
              onNext={() => onMove({ type: 'next' })}
              disabled={busy || spectator}
              note={
                secondsLeft > 0
                  ? t('La manche suivante commence toute seule dans {n} s', { n: secondsLeft })
                  : t('La manche suivante commence toute seule…')
              }
            />
          )}
          {showExchange && <ExchangeRecap state={state} onClose={() => setExchangeSeen(state.round)} />}
        </TableView>
      )}
      bottom={
        state.phase === 'roundOver' ? null : (
          <View style={styles.bottom}>
            <Text style={[styles.prompt, myTurn && styles.promptMine]} numberOfLines={1}>
              {prompt}
            </Text>
            {!spectator && (
              <Hand
                cards={me.hand}
                selected={selected}
                received={received}
                enabled={enabled}
                onTap={tap}
                active={myTurn && !showExchange}
              />
            )}
            {error && <Text style={styles.error}>{error}</Text>}
            {spectator ? null : pending && myTurn ? (
              <Button
                compact
                label={t('Donner {i}/{n}', { i: selected.length, n: pending.count })}
                disabled={busy || selected.length !== pending.count}
                onPress={() => onMove({ type: 'give', cards: selected })}
              />
            ) : (
              <View style={styles.actions}>
                <View style={styles.flex}>
                  <Button
                    compact
                    variant="secondary"
                    label={t('Passer')}
                    disabled={!myTurn || busy || !presidentCanPass(state, ME) || showExchange}
                    onPress={() => onMove({ type: 'pass' })}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    compact
                    label={
                      selected.length
                        ? tn(selected.length, 'Jouer {n} carte', 'Jouer {n} cartes')
                        : t('Jouer')
                    }
                    disabled={!canPlay || showExchange}
                    onPress={() => onMove({ type: 'play', cards: selected })}
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

/** How many rounds the online game lasts, chosen when creating the table. */
export function PresidentOnlineOptions({ value, onChange }: OnlineOptionsProps) {
  const rounds = typeof value.rounds === 'number' ? value.rounds : PRESIDENT_DEFAULT_ROUNDS;
  return (
    <View style={styles.options}>
      <Text style={styles.optionsLabel}>{t('Nombre de manches')}</Text>
      <View style={styles.counts}>
        {PRESIDENT_ROUND_CHOICES.map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityState={{ selected: n === rounds }}
            onPress={() => onChange({ ...value, rounds: n })}
            style={[styles.count, n === rounds && styles.countOn]}
          >
            <Text style={[styles.countText, n === rounds && styles.countTextOn]}>{n}</Text>
          </Pressable>
        ))}
      </View>
    </View>
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
  hero: { flexDirection: 'row', justifyContent: 'center', marginBottom: 10 },
  title: { color: colors.gold, fontSize: 32, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 15, textAlign: 'center', marginTop: 4 },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 22, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  countText: { color: colors.text, fontSize: 18, fontWeight: '800' },
  countTextOn: { color: colors.onGold },
  hint: { color: colors.muted, marginTop: 8, fontSize: 13 },
  options: { gap: 6, marginBottom: 10 },
  optionsLabel: { color: colors.muted, fontSize: 14, fontWeight: '700' },
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

  seat: { position: 'absolute', width: SEAT_W, alignItems: 'center' },
  avatarRing: { borderRadius: 24, padding: 2 },
  avatarActive: { backgroundColor: colors.gold, boxShadow: `0 0 14px ${colors.gold}` },
  out: { opacity: 0.45 },
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
  badge: { marginTop: 2, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, maxWidth: 120 },
  badgeText: { fontSize: 9, fontWeight: '800' },
  passBubble: { position: 'absolute', top: -4, right: -6 },
  passText: {
    backgroundColor: '#fffdf8',
    color: '#1b1b1b',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
    boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
  },
  mePlate: {
    position: 'absolute',
    alignSelf: 'center',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  meName: { color: colors.text, fontWeight: '800', fontSize: 13, maxWidth: 110 },
  mePassed: { color: colors.gold, fontWeight: '800', fontSize: 12 },

  trick: { position: 'absolute', left: 0, alignItems: 'center' },
  trickPlay: { position: 'absolute' },
  fan: { flexDirection: 'row' },
  shade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 2,
    right: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(8, 20, 14, 0.45)',
  },
  caption: {
    marginTop: 4,
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

  bottom: { gap: 6 },
  prompt: { color: colors.muted, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  promptMine: { color: colors.gold },
  error: { color: colors.gold, textAlign: 'center', fontSize: 12 },
  hand: { alignItems: 'center', justifyContent: 'flex-end' },
  handCard: { position: 'absolute' },
  cardOn: { borderRadius: 8, boxShadow: `0 0 0 2px ${colors.gold}, 0 6px 12px rgba(0,0,0,0.5)` },
  cardNew: { borderRadius: 8, boxShadow: `0 0 0 2px ${colors.goldBorder}` },
  empty: { color: colors.muted, position: 'absolute', alignSelf: 'center', top: 30 },
  actions: { flexDirection: 'row', gap: 8 },

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
  overlayCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 12,
    backgroundColor: colors.background,
    boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
  },
  exRow: { alignItems: 'center', gap: 6, marginVertical: 4 },
  exText: { color: colors.text, fontWeight: '700' },
  exRowSmall: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exTextSmall: { color: colors.muted, fontSize: 12 },
  fanRow: { flexDirection: 'row' },
  exHint: { color: colors.muted, textAlign: 'center', fontSize: 12 },
  recapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  recapMe: { backgroundColor: 'rgba(255,255,255,0.1)' },
  recapPos: { color: colors.muted, width: 14, fontWeight: '800', textAlign: 'center' },
  recapName: { color: colors.text, fontWeight: '700', flex: 1, fontSize: 13 },
  recapPts: { color: colors.gold, fontWeight: '800', width: 22, textAlign: 'right', fontSize: 13 },
  recapTotal: { color: colors.text, fontWeight: '800', width: 24, textAlign: 'right', fontSize: 13 },
  recapEx: { gap: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.glassBorder },
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
