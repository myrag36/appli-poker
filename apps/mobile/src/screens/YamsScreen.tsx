import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  type Avatar,
  type YamsBox,
  type YamsMove,
  type YamsState,
  YAMS_BONUS,
  YAMS_BONUS_THRESHOLD,
  YAMS_BOX_LABELS,
  YAMS_LOWER_BOXES,
  YAMS_MAX_PLAYERS,
  YAMS_ROLLS,
  YAMS_UPPER_BOXES,
  botName,
  defaultAvatar,
  yamsApply,
  yamsBonus,
  yamsBotMove,
  yamsNewGame,
  yamsRanking,
  yamsScoreBox,
  yamsTotal,
  yamsUpperTotal,
} from '@appli-poker/engine';
import { AvatarBadge, AvatarPicker } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { reportLocalGame, useFeat } from '../online/progress';
import { OnlineButton } from '../components/OnlineButton';
import { RulesButton } from '../components/Rules';
import { YAMS_RULES } from '../rules';
import { Die } from '../components/Die';
import { GameLayout } from '../components/GameLayout';
import { Appear, FloatUp } from '../components/Motion';
import { TopBar } from '../components/TopBar';
import { TurnTimer } from '../components/TurnTimer';
import type { OnlineBoardProps } from '../online-games/types';
import { sounds } from '../feedback';
import { deviceRng } from '../rng';
import { colors, gradients, shadow, theme } from '../theme';
import { t, tn } from '../i18n';

/** How long a robot seems to think before each step (roll, keep a die, score), in ms. */
const BOT_DELAY = 750;

interface Settings {
  names: string[];
  avatars: Avatar[];
  bots: boolean[];
}

export function YamsScreen({ onBack, onOnline }: { onBack: () => void; onOnline?: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  /** The last players, so coming back to the setup keeps them. */
  const [last, setLast] = useState<Settings | null>(null);
  const [round, setRound] = useState(0);
  if (!settings)
    return (
      <YamsSetup
        onBack={onBack}
        onOnline={onOnline}
        initial={last}
        onStart={(s) => {
          setLast(s);
          setSettings(s);
        }}
      />
    );
  return (
    <YamsGame
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

function YamsSetup({
  onStart,
  onBack,
  onOnline,
  initial,
}: {
  onStart: (s: Settings) => void;
  onBack: () => void;
  onOnline?: () => void;
  initial: Settings | null;
}) {
  const [names, setNames] = useState(initial?.names ?? ['', 'Robby']);
  const [avatars, setAvatars] = useState<Avatar[]>(
    initial?.avatars ?? [defaultAvatar(0), { emoji: '🤖', color: defaultAvatar(1).color }],
  );
  const [bots, setBots] = useState(initial?.bots ?? [false, true]);
  const [picking, setPicking] = useState<number | null>(null);

  const cleaned = names.map((n, i) => n.trim() || t('Joueur {n}', { n: i + 1 }));
  const duplicate = new Set(cleaned).size !== cleaned.length;
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
    <ScrollView contentContainerStyle={styles.setup} keyboardShouldPersistTaps="handled">
      <View style={styles.titleDice}>
        {[5, 6, 5].map((v, i) => (
          <View key={i} style={{ transform: [{ rotate: `${(i - 1) * 14}deg` }] }}>
            <Die value={v} size={34} />
          </View>
        ))}
      </View>
      <Text style={styles.title}>Yams</Text>
      <Text style={styles.subtitle}>{t('5 dés, 3 lancers, 13 cases à remplir')}</Text>
      {onOnline && <OnlineButton onPress={onOnline} />}
      <RulesButton rules={YAMS_RULES} />

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
                  style={[styles.input, styles.flex, styles.nameInput]}
                  placeholder={t('Joueur {n}', { n: i + 1 })}
                  placeholderTextColor={colors.muted}
                  value={name}
                  maxLength={14}
                  onChangeText={(v) => setNames(names.map((n, j) => (j === i ? v : n)))}
                />
              </>
            )}
            {names.length > 1 && (
              <View style={styles.remove}>
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
      {names.length < YAMS_MAX_PLAYERS && (
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
        {t('De 1 à 6 joueurs sur ce téléphone : on se le passe à chaque tour, rien n’est caché.')}
      </Text>
      {duplicate && <Text style={styles.error}>{t('Deux joueurs ont le même nom.')}</Text>}
      {!bots.includes(false) && <Text style={styles.error}>{t('Il faut au moins un joueur humain.')}</Text>}

      <View style={styles.spacer} />
      <Button
        label={t('Lancer la partie')}
        disabled={!valid}
        onPress={() => onStart({ names: cleaned, avatars, bots })}
      />
      <Button label={t('Retour')} variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Game

function YamsGame({
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
  const [game, setGame] = useState<YamsState>(() =>
    yamsNewGame(settings.names.map((name, i) => ({ name, bot: settings.bots[i] }))),
  );
  useFeat(
    'yams',
    game.players.some((p) => !p.bot && p.scores.yams === 50),
  );
  const [confirmZero, setConfirmZero] = useState<YamsBox | null>(null);
  const [error, setError] = useState<string | null>(null);
  const player = game.players[game.current];
  const humans = game.players.filter((p) => !p.bot).length;
  const botTurn = !game.finished && player.bot;
  const rolled = game.rollsLeft < YAMS_ROLLS;
  const turn = Math.min(13, Math.min(...game.players.map((p) => Object.keys(p.scores).length)) + 1);

  function play(move: YamsMove) {
    try {
      setGame((g) => yamsApply(g, move, deviceRng));
      setError(null);
      if (move.type === 'roll') sounds.card();
      if (move.type === 'score') sounds.chips();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Robots play one step at a time so everyone can follow.
  useEffect(() => {
    if (!botTurn) return;
    const move = yamsBotMove(game);
    const id = setTimeout(
      () => {
        setGame((g) => (g === game ? yamsApply(g, move, deviceRng) : g));
        if (move.type === 'roll') sounds.card();
        if (move.type === 'score') sounds.chips();
      },
      move.type === 'toggle' ? BOT_DELAY / 2 : move.type === 'score' ? BOT_DELAY * 1.4 : BOT_DELAY,
    );
    return () => clearTimeout(id);
  }, [game, botTurn]);

  // A new human turn: a little chime when the phone changes hands.
  const lastTurn = useRef(-1);
  useEffect(() => {
    if (game.finished) {
      sounds.win();
      return;
    }
    if (lastTurn.current !== game.current && !player.bot && humans > 1) sounds.myTurn();
    lastTurn.current = game.current;
  }, [game.current, game.finished]);

  if (game.finished)
    return <YamsResults game={game} avatars={settings.avatars} onReplay={onReplay} onHome={onHome} />;

  function pick(box: YamsBox) {
    if (botTurn || !rolled || player.scores[box] !== undefined) return;
    if (yamsScoreBox(game.dice, box) === 0) setConfirmZero(box);
    else play({ type: 'score', box });
  }

  const prompt = botTurn
    ? t('🤖 {name} réfléchit…', { name: player.name })
    : !rolled
      ? humans > 1
        ? t('À toi, {name} ! Lance les dés', { name: player.name })
        : t('À toi de jouer ! Lance les dés')
      : game.rollsLeft > 0
        ? t('Touche les dés à garder, puis relance')
        : t('Choisis une case dans ta grille');

  return (
    <GameLayout
      top={
        <>
          <TopBar onBack={onQuit} backLabel={t('← Quitter')}>
            <Text style={styles.turn}>{t('Tour {n}/13', { n: turn })}</Text>
          </TopBar>
          <Scoreboard game={game} avatars={settings.avatars} />
        </>
      }
      table={({ width, height }) => (
        <Tray
          game={game}
          width={width}
          height={height}
          prompt={prompt}
          canHold={!botTurn && rolled && game.rollsLeft > 0}
          onToggle={(i) => play({ type: 'toggle', index: i })}
        />
      )}
      bottom={
        <>
          {error && <Text style={styles.errorLine}>{error}</Text>}
          {confirmZero ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmText} numberOfLines={2}>
                {t('Barrer « {box} » pour 0 point ?', { box: t(YAMS_BOX_LABELS[confirmZero]) })}
              </Text>
              <View style={styles.confirmButtons}>
                <Button
                  compact
                  variant="secondary"
                  label={t('Annuler')}
                  onPress={() => setConfirmZero(null)}
                />
                <Button
                  compact
                  variant="danger"
                  label={t('Oui, 0')}
                  onPress={() => {
                    play({ type: 'score', box: confirmZero });
                    setConfirmZero(null);
                  }}
                />
              </View>
            </View>
          ) : (
            <Button
              label={
                botTurn
                  ? t('Tour de {name}', { name: player.name })
                  : game.rollsLeft === 0
                    ? t('Plus de lancer')
                    : game.rollsLeft === 1
                      ? t('Relancer (dernier lancer)')
                      : rolled
                        ? tn(game.rollsLeft - 1, 'Relancer ({n} restant)', 'Relancer ({n} restants)')
                        : tn(game.rollsLeft - 1, 'Lancer ({n} restant)', 'Lancer ({n} restants)')
              }
              disabled={botTurn || game.rollsLeft === 0 || game.held.every(Boolean)}
              onPress={() => play({ type: 'roll' })}
            />
          )}
          <ScoreGrid game={game} onPick={pick} interactive={!botTurn} selected={confirmZero} />
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Online: the same table, each player on their own phone

export function YamsOnlineBoard({
  view: game,
  mySeat,
  seats,
  deadline,
  now,
  busy,
  error,
  onMove,
  onLeave,
}: OnlineBoardProps<YamsState>) {
  const [confirmZero, setConfirmZero] = useState<YamsBox | null>(null);
  const avatars = seats.map((s) => s.avatar);
  const player = game.players[game.current];
  const myTurn = !game.finished && game.current === mySeat;
  const rolled = game.rollsLeft < YAMS_ROLLS;
  const turn = Math.min(13, Math.min(...game.players.map((p) => Object.keys(p.scores).length)) + 1);

  // Sounds follow what happens at the table, whoever played.
  const last = useRef(game);
  useEffect(() => {
    const before = last.current;
    last.current = game;
    if (game.finished && !before.finished) sounds.win();
    else if (game.rollCount > before.rollCount && game.current === before.current) sounds.card();
    if (
      game.players.some((p, i) => Object.keys(p.scores).length > Object.keys(before.players[i].scores).length)
    )
      sounds.chips();
    if (myTurn && before.current !== game.current) sounds.myTurn();
  }, [game]);

  if (game.finished)
    return <YamsResults game={game} avatars={avatars} onHome={onLeave} homeLabel={t('Quitter la table')} />;

  function pick(box: YamsBox) {
    if (!myTurn || busy || !rolled || player.scores[box] !== undefined) return;
    if (yamsScoreBox(game.dice, box) === 0) setConfirmZero(box);
    else onMove({ type: 'score', box });
  }

  const prompt = !myTurn
    ? t('{name} joue…', { name: `${player.bot ? '🤖 ' : ''}${player.name}` })
    : !rolled
      ? t('À toi ! Lance les dés')
      : game.rollsLeft > 0
        ? t('Touche les dés à garder, puis relance')
        : t('Choisis une case dans ta grille');

  return (
    <GameLayout
      top={
        <>
          <TopBar onBack={onLeave} backLabel={t('← Quitter')}>
            <Text style={styles.turn}>{t('Tour {n}/13', { n: turn })}</Text>
          </TopBar>
          <Scoreboard game={game} avatars={avatars} />
          {deadline && !player.bot && (
            <TurnTimer deadline={deadline} now={now} name={myTurn ? t('Toi') : player.name} seconds={60} />
          )}
        </>
      }
      table={({ width, height }) => (
        <Tray
          game={game}
          width={width}
          height={height}
          prompt={prompt}
          canHold={myTurn && !busy && rolled && game.rollsLeft > 0}
          onToggle={(i) => onMove({ type: 'toggle', index: i })}
        />
      )}
      bottom={
        <>
          {error && <Text style={styles.errorLine}>{error}</Text>}
          {confirmZero ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmText} numberOfLines={2}>
                {t('Barrer « {box} » pour 0 point ?', { box: t(YAMS_BOX_LABELS[confirmZero]) })}
              </Text>
              <View style={styles.confirmButtons}>
                <Button
                  compact
                  variant="secondary"
                  label={t('Annuler')}
                  onPress={() => setConfirmZero(null)}
                />
                <Button
                  compact
                  variant="danger"
                  label={t('Oui, 0')}
                  onPress={() => {
                    onMove({ type: 'score', box: confirmZero });
                    setConfirmZero(null);
                  }}
                />
              </View>
            </View>
          ) : (
            <Button
              label={
                !myTurn
                  ? t('Tour de {name}', { name: player.name })
                  : game.rollsLeft === 0
                    ? t('Plus de lancer')
                    : game.rollsLeft === 1
                      ? t('Relancer (dernier lancer)')
                      : rolled
                        ? tn(game.rollsLeft - 1, 'Relancer ({n} restant)', 'Relancer ({n} restants)')
                        : tn(game.rollsLeft - 1, 'Lancer ({n} restant)', 'Lancer ({n} restants)')
              }
              disabled={!myTurn || busy || game.rollsLeft === 0 || game.held.every(Boolean)}
              onPress={() => onMove({ type: 'roll' })}
            />
          )}
          <ScoreGrid game={game} onPick={pick} interactive={myTurn} selected={confirmZero} />
        </>
      }
    />
  );
}

function Scoreboard({ game, avatars }: { game: YamsState; avatars: Avatar[] }) {
  const narrow = game.players.length > 3;
  return (
    <View style={styles.board}>
      {game.players.map((p, i) => {
        const active = i === game.current && !game.finished;
        const name = (
          <Text style={[styles.boardName, active && styles.boardNameActive]} numberOfLines={1}>
            {p.name}
          </Text>
        );
        const total = <Text style={styles.boardTotal}>{yamsTotal(p.scores)}</Text>;
        // With many players there is no room beside the avatar: the name goes underneath.
        return narrow ? (
          <View key={p.id} style={[styles.boardCell, styles.boardCellNarrow, active && styles.boardActive]}>
            <View style={styles.boardTop}>
              <AvatarBadge avatar={avatars[i]} size={20} />
              {total}
            </View>
            {name}
          </View>
        ) : (
          <View key={p.id} style={[styles.boardCell, active && styles.boardActive]}>
            <AvatarBadge avatar={avatars[i]} size={26} />
            <View style={styles.boardText}>
              {name}
              {total}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Tray({
  game,
  width,
  height,
  prompt,
  canHold,
  onToggle,
}: {
  game: YamsState;
  width: number;
  height: number;
  prompt: string;
  canHold: boolean;
  onToggle: (i: number) => void;
}) {
  const w = Math.min(width, 440);
  const h = Math.min(height, 320);
  const size = Math.max(34, Math.min(64, Math.floor((w - 70) / 5) - 6, Math.floor(h * 0.32)));
  const last = game.lastScore;
  const lastName = last ? game.players[last.player].name : '';
  return (
    <View style={[styles.rail, { width: w, height: h }]}>
      <LinearGradient colors={gradients.wood} style={StyleSheet.absoluteFill} />
      <View style={styles.felt}>
        <LinearGradient colors={gradients.felt} style={StyleSheet.absoluteFill} />
        <View style={styles.feltGlow} />
        <View style={styles.feltLine} />
        {theme.feltMark && <Text style={[styles.feltMark, { fontSize: h * 0.5 }]}>{theme.feltMark}</Text>}
        <View style={styles.rolls}>
          {Array.from({ length: YAMS_ROLLS }, (_, i) => (
            <View key={i} style={[styles.rollDot, i < YAMS_ROLLS - game.rollsLeft && styles.rollDotUsed]} />
          ))}
        </View>
        <View style={[styles.dice, { gap: Math.max(6, size * 0.18) }]}>
          {game.dice.map((v, i) => (
            <Die
              key={i}
              value={v}
              size={size}
              held={game.held[i]}
              rollKey={game.rollCount}
              disabled={!canHold}
              onPress={() => onToggle(i)}
            />
          ))}
        </View>
        <Text style={styles.prompt} numberOfLines={1}>
          {prompt}
        </Text>
        {last && (
          <FloatUp key={`${game.rollCount}-${last.player}-${last.box}`} style={styles.toast}>
            <Text style={[styles.toastText, last.points === 0 && styles.toastZero]} numberOfLines={1}>
              {t('{name} : {points} en {box}', {
                name: lastName,
                points: last.points === 0 ? '0' : `+${last.points}`,
                box: t(YAMS_BOX_LABELS[last.box]),
              })}
            </Text>
          </FloatUp>
        )}
      </View>
    </View>
  );
}

function ScoreGrid({
  game,
  onPick,
  interactive,
  selected,
}: {
  game: YamsState;
  onPick: (b: YamsBox) => void;
  interactive: boolean;
  selected: YamsBox | null;
}) {
  const player = game.players[game.current];
  const upper = yamsUpperTotal(player.scores);
  const row = (box: YamsBox) => {
    const filled = player.scores[box];
    // Once the dice are rolled, every open box previews what it would score.
    const potential =
      game.rollsLeft < YAMS_ROLLS && filled === undefined ? yamsScoreBox(game.dice, box) : null;
    return (
      <Pressable
        key={box}
        accessibilityRole="button"
        accessibilityLabel={`${t(YAMS_BOX_LABELS[box])} ${filled ?? potential ?? ''}`}
        disabled={potential === null || !interactive}
        onPress={() => onPick(box)}
        style={({ pressed }) => [
          styles.cell,
          potential !== null && styles.cellOpen,
          potential !== null && potential > 0 && styles.cellGood,
          selected === box && styles.cellSelected,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.cellLabel, filled !== undefined && styles.cellLabelDone]} numberOfLines={1}>
          {t(YAMS_BOX_LABELS[box])}
        </Text>
        <Text
          style={[
            styles.cellValue,
            filled !== undefined && styles.cellFilled,
            potential !== null && (potential > 0 ? styles.cellPotential : styles.cellZero),
          ]}
        >
          {filled !== undefined ? (filled === 0 ? '✕' : filled) : potential !== null ? potential : '·'}
        </Text>
      </Pressable>
    );
  };
  return (
    <View style={styles.grid}>
      <View style={styles.gridHead}>
        <Text style={styles.gridTitle} numberOfLines={1}>
          {t('Grille de {name}', { name: player.name })}
        </Text>
        <Text style={styles.gridTotal}>{t('Total {n}', { n: yamsTotal(player.scores) })}</Text>
      </View>
      <View style={styles.gridCols}>
        <View style={styles.col}>
          {YAMS_UPPER_BOXES.map(row)}
          <View style={[styles.cell, styles.bonusCell]}>
            <Text style={styles.bonusLabel} numberOfLines={1}>
              {t('Bonus {n}/{max}', { n: Math.min(upper, YAMS_BONUS_THRESHOLD), max: YAMS_BONUS_THRESHOLD })}
            </Text>
            <Text style={[styles.cellValue, yamsBonus(player.scores) > 0 && styles.cellPotential]}>
              {yamsBonus(player.scores) > 0 ? `+${YAMS_BONUS}` : '·'}
            </Text>
          </View>
        </View>
        <View style={styles.col}>{YAMS_LOWER_BOXES.map(row)}</View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Results

const MEDALS = ['🥇', '🥈', '🥉'];

function YamsResults({
  game,
  avatars,
  onReplay,
  onHome,
  homeLabel = t('Retour aux jeux'),
}: {
  game: YamsState;
  avatars: Avatar[];
  /** Absent online: a new game starts from a new table. */
  onReplay?: () => void;
  onHome: () => void;
  homeLabel?: string;
}) {
  const ranking = yamsRanking(game);
  const winners = ranking.filter((r) => r.place === 1);
  // On this phone (not online), the game gives experience; a win counts if a person won.
  useEffect(() => {
    if (onReplay)
      reportLocalGame(
        'yams',
        winners.some((w) => !game.players[Number(w.id.slice(1))].bot),
      );
  }, []);
  const best = winners[0].total;
  const n = game.players.length;
  const cols = game.players.map((p, i) => ({ p, i }));
  const line = (
    label: string,
    value: (s: YamsState['players'][0]['scores']) => string | number,
    strong?: boolean,
  ) => (
    <View key={label} style={[styles.tRow, strong && styles.tRowStrong]}>
      <Text style={[styles.tLabel, strong && styles.tStrong]} numberOfLines={1}>
        {label}
      </Text>
      {cols.map(({ p }) => (
        <Text
          key={p.id}
          style={[
            styles.tCell,
            strong && styles.tStrong,
            strong && yamsTotal(p.scores) === best && styles.tWin,
          ]}
        >
          {value(p.scores)}
        </Text>
      ))}
    </View>
  );
  return (
    <ScrollView contentContainerStyle={styles.results}>
      <Appear>
        <Text style={styles.trophy}>🏆</Text>
        <Text style={styles.winner}>
          {winners.length > 1
            ? t('Égalité ! {names}', { names: winners.map((w) => w.name).join(` ${t('et')} `) })
            : n === 1
              ? t('{name} : {n} points !', { name: winners[0].name, n: best })
              : t('{name} gagne !', { name: winners[0].name })}
        </Text>
      </Appear>
      {n > 1 && (
        <View style={styles.podium}>
          {ranking.map((r) => (
            <View key={r.id} style={[styles.podiumRow, r.place === 1 && styles.podiumFirst]}>
              <Text style={styles.podiumPlace}>{MEDALS[r.place - 1] ?? t('{n}e', { n: r.place })}</Text>
              <AvatarBadge avatar={avatars[Number(r.id.slice(1))]} size={26} />
              <Text style={[styles.podiumName, r.place === 1 && styles.podiumNameFirst]} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={styles.podiumTotal}>{r.total}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.table}>
        <View style={[styles.tRow, styles.tHead]}>
          <Text style={styles.tLabel} />
          {cols.map(({ p, i }) => (
            <View key={p.id} style={styles.tCellHead}>
              <AvatarBadge avatar={avatars[i]} size={22} />
              <Text style={styles.tName} numberOfLines={1}>
                {p.name}
              </Text>
            </View>
          ))}
        </View>
        {YAMS_UPPER_BOXES.map((b) => line(t(YAMS_BOX_LABELS[b]), (s) => s[b] ?? 0))}
        {line(t('Sous-total'), (s) => yamsUpperTotal(s))}
        {line(t('Bonus (≥ {n})', { n: YAMS_BONUS_THRESHOLD }), (s) =>
          yamsBonus(s) ? `+${YAMS_BONUS}` : '–',
        )}
        {YAMS_LOWER_BOXES.map((b) => line(t(YAMS_BOX_LABELS[b]), (s) => s[b] ?? 0))}
        {line(t('Total'), (s) => yamsTotal(s), true)}
      </View>
      <View style={styles.spacerSmall} />
      {onReplay && <Button label={t('Rejouer')} onPress={onReplay} />}
      <Button label={homeLabel} variant="secondary" onPress={onHome} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Setup
  setup: { padding: 20, paddingTop: 40, paddingBottom: 30 },
  titleDice: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 6 },
  title: { color: colors.gold, fontSize: 34, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.muted, textAlign: 'center', marginBottom: 4 },
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
  remove: { width: 60 },
  nameInput: { minWidth: 0 },
  botRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  botName: { color: colors.text, fontSize: 16 },
  botTag: { color: colors.gold, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  hint: { color: colors.muted, marginTop: 8, fontSize: 13 },
  error: { color: colors.gold, marginTop: 8 },
  spacer: { height: 20 },
  spacerSmall: { height: 10 },

  // Game
  turn: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  board: { flexDirection: 'row', gap: 4, marginTop: 4, marginBottom: 8 },
  boardCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    minWidth: 0,
  },
  boardActive: { borderColor: colors.gold, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  boardText: { flex: 1, minWidth: 0 },
  boardCellNarrow: { flexDirection: 'column', alignItems: 'stretch', gap: 1, paddingHorizontal: 3 },
  boardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2 },
  boardName: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  boardNameActive: { color: colors.gold, fontWeight: '800' },
  boardTotal: { color: colors.text, fontSize: 15, fontWeight: '800' },

  rail: {
    borderRadius: 28,
    padding: 9,
    overflow: 'hidden',
    backgroundColor: colors.rail,
    borderWidth: 2,
    borderColor: colors.railBorder,
    boxShadow: '0 10px 30px rgba(0,0,0,0.6), inset 0 2px 3px rgba(255,220,170,0.35)',
  },
  felt: {
    flex: 1,
    borderRadius: 20,
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
    height: '50%',
    borderRadius: 999,
    backgroundColor: colors.glow,
    boxShadow: `0 0 60px 40px ${colors.glow}`,
  },
  feltLine: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    left: 8,
    right: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 213, 120, 0.22)',
  },
  feltMark: { position: 'absolute', opacity: 0.1, color: '#ffffff' },
  rolls: { position: 'absolute', top: 16, flexDirection: 'row', gap: 6 },
  rollDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  rollDotUsed: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.3)' },
  dice: { flexDirection: 'row', marginTop: 10 },
  prompt: {
    position: 'absolute',
    bottom: 16,
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
    paddingHorizontal: 12,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  toast: {
    position: 'absolute',
    top: 30,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  toastText: { color: colors.gold, fontWeight: '800', fontSize: 14 },
  toastZero: { color: colors.muted },
  errorLine: { color: colors.gold, textAlign: 'center', fontSize: 13 },

  confirm: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.gold,
    gap: 6,
  },
  confirmText: { color: colors.text, textAlign: 'center', fontWeight: '700', fontSize: 14 },
  confirmButtons: { flexDirection: 'row', gap: 8 },

  grid: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    ...shadow,
  },
  gridHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 4 },
  gridTitle: { color: colors.gold, fontWeight: '800', fontSize: 13, flex: 1 },
  gridTotal: { color: colors.text, fontWeight: '800', fontSize: 13 },
  gridCols: { flexDirection: 'row', gap: 6 },
  col: { flex: 1, gap: 3 },
  cell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 27,
    paddingHorizontal: 8,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cellOpen: { borderColor: 'rgba(255,255,255,0.18)', borderStyle: 'dashed' },
  cellGood: { borderColor: colors.gold, borderStyle: 'solid', backgroundColor: 'rgba(255,255,255,0.1)' },
  cellSelected: { borderColor: colors.danger, borderStyle: 'solid', borderWidth: 2 },
  pressed: { opacity: 0.6 },
  cellLabel: { color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  cellLabelDone: { color: colors.muted, fontWeight: '500' },
  cellValue: { color: colors.muted, fontSize: 14, fontWeight: '800', minWidth: 22, textAlign: 'right' },
  cellFilled: { color: colors.text },
  cellPotential: { color: colors.gold },
  cellZero: { color: 'rgba(255,255,255,0.35)' },
  bonusCell: { backgroundColor: 'rgba(0,0,0,0.2)' },
  bonusLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', flexShrink: 1 },

  // Results
  results: { padding: 16, paddingTop: 36, paddingBottom: 30 },
  trophy: { fontSize: 44, textAlign: 'center' },
  winner: { color: colors.gold, fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  podium: { gap: 4, marginBottom: 12 },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  podiumFirst: { backgroundColor: 'rgba(255,255,255,0.08)' },
  podiumPlace: { width: 28, textAlign: 'center', fontSize: 16, color: colors.muted, fontWeight: '700' },
  podiumName: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  podiumNameFirst: { color: colors.gold, fontWeight: '800' },
  podiumTotal: { color: colors.text, fontSize: 16, fontWeight: '800' },
  table: {
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tHead: { alignItems: 'flex-end', paddingBottom: 4 },
  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tRowStrong: { borderBottomWidth: 0, paddingTop: 5 },
  tLabel: { width: 104, color: colors.muted, fontSize: 12, fontWeight: '600' },
  tCellHead: { flex: 1, alignItems: 'center', gap: 2, minWidth: 0 },
  tName: { color: colors.text, fontSize: 10, fontWeight: '700', maxWidth: '100%' },
  tCell: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 13, fontWeight: '600' },
  tStrong: { fontSize: 15, fontWeight: '800', color: colors.text },
  tWin: { color: colors.gold },
});
