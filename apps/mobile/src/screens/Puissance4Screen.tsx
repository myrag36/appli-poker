import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  type Avatar,
  type P4Level,
  type P4Player,
  type P4OnlineState,
  type P4State,
  P4_COLS,
  P4_ONLINE_DEFAULT_ROUNDS,
  P4_ONLINE_ROUND_CHOICES,
  P4_LEVEL_LABELS,
  P4_ROWS,
  defaultAvatar,
  p4BotMove,
  p4Drop,
  p4DropRow,
  p4Finished,
  p4NewGame,
  p4NextRound,
} from '@appli-poker/engine';
import { AvatarBadge, AvatarPicker } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { GameLayout } from '../components/GameLayout';
import { Pill } from '../components/LevelPicker';
import { Appear } from '../components/Motion';
import { OnlineButton } from '../components/OnlineButton';
import { RulesButton } from '../components/Rules';
import { TOKEN_COLORS, TOKEN_NAMES, Token } from '../components/Token';
import { TopBar } from '../components/TopBar';
import { TurnTimer } from '../components/TurnTimer';
import type { OnlineBoardProps, OnlineOptionsProps } from '../online-games/types';
import { sounds } from '../feedback';
import { reportFeat, reportLocalGame, useFeat } from '../online/progress';
import { deviceRng } from '../rng';
import { PUISSANCE4_RULES } from '../rules';
import { colors } from '../theme';
import { t, tn } from '../i18n';

const native = Platform.OS !== 'web';

/** How long the robot seems to think before dropping its token, in ms. */
const BOT_DELAY = 750;

const BOARD_BLUE = '#1f5fd1';
const BOARD_BLUE_DARK = '#123f9a';

const LEVEL_HINTS: Record<P4Level, string> = {
  facile: t('Il joue un peu au hasard et rate parfois tes menaces.'),
  moyen: t('Il bloque tes alignements et prépare les siens.'),
  difficile: t('Il calcule plusieurs coups à l’avance. Bonne chance !'),
};

interface Settings {
  names: [string, string];
  avatars: [Avatar, Avatar];
  /** Player 1 (yellow) is a robot. */
  vsBot: boolean;
  level: P4Level;
}

export function Puissance4Screen({ onBack, onOnline }: { onBack: () => void; onOnline?: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  /** The last settings, so coming back to the setup keeps them. */
  const [last, setLast] = useState<Settings | null>(null);
  const [match, setMatch] = useState(0);
  if (!settings)
    return (
      <Setup
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
    <Match
      key={match}
      settings={settings}
      onQuit={() => setSettings(null)}
      onReplay={() => setMatch((m) => m + 1)}
      onHome={onBack}
    />
  );
}

// ---------------------------------------------------------------------------
// Setup

const ROBOT_AVATAR: Avatar = { emoji: '🤖', color: defaultAvatar(1).color };

function Setup({
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
  const [vsBot, setVsBot] = useState(initial?.vsBot ?? true);
  const [level, setLevel] = useState<P4Level>(initial?.level ?? 'moyen');
  const [names, setNames] = useState<[string, string]>(
    initial ? [initial.names[0], initial.vsBot ? '' : initial.names[1]] : ['', ''],
  );
  const [avatars, setAvatars] = useState<[Avatar, Avatar]>(
    initial?.avatars ?? [defaultAvatar(0), defaultAvatar(1)],
  );
  const [picking, setPicking] = useState<0 | 1 | null>(null);

  const cleaned: [string, string] = [
    names[0].trim() || t('Joueur {n}', { n: 1 }),
    vsBot ? 'Robby' : names[1].trim() || t('Joueur {n}', { n: 2 }),
  ];
  const duplicate = cleaned[0] === cleaned[1];

  const playerRow = (i: 0 | 1) => (
    <View key={i}>
      <View style={styles.row}>
        <Token player={i} size={30} />
        {vsBot && i === 1 ? (
          <>
            <AvatarBadge avatar={ROBOT_AVATAR} size={40} />
            <View style={[styles.input, styles.flex, styles.botRow]}>
              <Text style={styles.botName}>Robby</Text>
              <Text style={styles.botTag}>{t('Robot · {level}', { level: t(P4_LEVEL_LABELS[level]) })}</Text>
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
              value={names[i]}
              maxLength={14}
              onChangeText={(v) => setNames(i === 0 ? [v, names[1]] : [names[0], v])}
            />
          </>
        )}
      </View>
      {picking === i && !(vsBot && i === 1) && (
        <AvatarPicker
          value={avatars[i]}
          onChange={(a) => setAvatars(i === 0 ? [a, avatars[1]] : [avatars[0], a])}
        />
      )}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.setup} keyboardShouldPersistTaps="handled">
      <View style={styles.titleTokens}>
        {([0, 1, 0] as P4Player[]).map((p, i) => (
          <Token key={i} player={p} size={34} style={{ transform: [{ translateY: i === 1 ? -6 : 0 }] }} />
        ))}
      </View>
      <Text style={styles.title}>{t('Puissance 4')}</Text>
      <Text style={styles.subtitle}>{t('7 colonnes, 6 rangées, 4 jetons à aligner')}</Text>
      {onOnline && <OnlineButton onPress={onOnline} />}
      <RulesButton rules={PUISSANCE4_RULES} />

      <Text style={styles.section}>{t('Adversaire')}</Text>
      <View style={styles.pills}>
        <Pill label={t('🤖 Contre le robot')} active={vsBot} onPress={() => setVsBot(true)} />
        <Pill label={t('👥 À deux sur ce téléphone')} active={!vsBot} onPress={() => setVsBot(false)} />
      </View>
      {vsBot && (
        <>
          <Text style={styles.section}>{t('Niveau du robot')}</Text>
          <View style={styles.pills}>
            {(['facile', 'moyen', 'difficile'] as P4Level[]).map((l) => (
              <Pill key={l} label={t(P4_LEVEL_LABELS[l])} active={level === l} onPress={() => setLevel(l)} />
            ))}
          </View>
          <Text style={styles.hint}>{LEVEL_HINTS[level]}</Text>
        </>
      )}

      <Text style={styles.section}>{t('Joueurs')}</Text>
      {playerRow(0)}
      {playerRow(1)}
      <Text style={styles.hint}>
        {vsBot
          ? t('Tu joues les rouges. On joue autant de manches que tu veux, et on alterne qui commence.')
          : t('On se passe le téléphone à chaque coup. Rouge commence la première manche, puis on alterne.')}
      </Text>
      {duplicate && <Text style={styles.error}>{t('Les deux joueurs ont le même nom.')}</Text>}

      <View style={styles.spacer} />
      <Button
        label={t('Lancer la partie')}
        disabled={duplicate}
        onPress={() =>
          onStart({
            names: cleaned,
            avatars: vsBot ? [avatars[0], ROBOT_AVATAR] : avatars,
            vsBot,
            level,
          })
        }
      />
      <Button label={t('Retour')} variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Game

function Match({
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
  const [game, setGame] = useState<P4State>(() => p4NewGame(0));
  const [over, setOver] = useState(false);
  const finished = p4Finished(game);
  const isBot = (p: P4Player) => settings.vsBot && p === 1;
  const botTurn = !finished && isBot(game.current);
  const name = (p: P4Player) => settings.names[p];

  function drop(col: number) {
    if (botTurn || finished || p4DropRow(game.board, col) < 0) return;
    setGame(p4Drop(game, col));
    sounds.card();
  }

  // The robot drops its token after a short pause, once the previous token has landed.
  useEffect(() => {
    if (!botTurn) return;
    const id = setTimeout(() => {
      const col = p4BotMove(game, settings.level, deviceRng);
      setGame((g) => (g === game ? p4Drop(g, col) : g));
      sounds.card();
    }, BOT_DELAY);
    return () => clearTimeout(id);
  }, [game, botTurn]);

  // Each finished round counts as a game for experience, and gets its sound.
  const reported = useRef(0);
  useEffect(() => {
    if (!finished || reported.current === game.round) return;
    reported.current = game.round;
    const humanWon = game.winner !== null && !isBot(game.winner);
    reportLocalGame('puissance4', humanWon);
    if (humanWon && settings.vsBot) reportFeat('puissance4');
    const id = setTimeout(() => {
      if (game.draw) sounds.chips();
      else if (humanWon) sounds.win();
      else sounds.fold();
    }, 350);
    return () => clearTimeout(id);
  }, [finished, game.round]);

  if (over)
    return (
      <MatchResults game={game} settings={settings} onReplay={onReplay} onSettings={onQuit} onHome={onHome} />
    );

  const humans = settings.vsBot ? 1 : 2;
  const prompt = finished
    ? game.draw
      ? t('🤝 Grille pleine : match nul !')
      : t('🏆 {name} gagne la manche !', { name: name(game.winner!) })
    : botTurn
      ? t('🤖 {name} réfléchit…', { name: name(game.current) })
      : humans > 1
        ? t('À toi, {name} !', { name: name(game.current) })
        : t('À toi de jouer !');

  return (
    <GameLayout
      top={
        <>
          <TopBar onBack={onQuit} backLabel={t('← Quitter')}>
            <Text style={styles.round}>{t('Manche {n}', { n: game.round })}</Text>
          </TopBar>
          <Scoreboard game={game} settings={settings} />
        </>
      }
      table={({ width, height }) => (
        <Board
          game={game}
          width={width}
          height={height}
          canPlay={!botTurn && !finished}
          onDrop={drop}
          prompt={prompt}
        />
      )}
      bottom={
        <View style={styles.bottomBox}>
          {finished ? (
            <View style={styles.buttons}>
              <View style={styles.flex}>
                <Button
                  label={t('Manche suivante')}
                  onPress={() => {
                    setGame(p4NextRound(game));
                    sounds.chips();
                  }}
                />
              </View>
              <View style={styles.flex}>
                <Button label={t('Terminer')} variant="secondary" onPress={() => setOver(true)} />
              </View>
            </View>
          ) : (
            <Text style={styles.help}>
              {botTurn
                ? t('{name} joue…', { name: TOKEN_NAMES[game.current] })
                : t('Touche une colonne pour y faire tomber ton jeton.')}
            </Text>
          )}
        </View>
      }
    />
  );
}

function Scoreboard({
  game,
  settings,
  subs,
}: {
  game: P4State;
  settings: Settings;
  /** What is written under each name, when not the default (color, or robot level). */
  subs?: [string, string];
}) {
  const finished = p4Finished(game);
  const cell = (p: P4Player) => {
    const active = finished ? game.winner === p : game.current === p;
    return (
      <View style={[styles.scoreCell, active && styles.scoreActive, p === 1 && styles.scoreCellRight]}>
        <View>
          <AvatarBadge avatar={settings.avatars[p]} size={30} />
          <Token player={p} size={15} style={styles.scoreToken} />
        </View>
        <View style={[styles.scoreText, p === 1 && styles.scoreTextRight]}>
          <Text style={[styles.scoreName, active && styles.scoreNameActive]} numberOfLines={1}>
            {settings.names[p]}
          </Text>
          <Text style={styles.scoreSub} numberOfLines={1}>
            {subs
              ? subs[p]
              : settings.vsBot && p === 1
                ? t('Robot {level}', { level: t(P4_LEVEL_LABELS[settings.level]) })
                : TOKEN_NAMES[p]}
          </Text>
        </View>
        <Text style={[styles.scoreValue, { color: TOKEN_COLORS[p].fill }]}>{game.scores[p]}</Text>
      </View>
    );
  };
  return (
    <View style={styles.scoreboard}>
      {cell(0)}
      <View style={styles.scoreMiddle}>
        <Text style={styles.scoreVs}>{t('VS')}</Text>
        {game.draws > 0 && <Text style={styles.scoreDraws}>{tn(game.draws, '{n} nul', '{n} nuls')}</Text>}
      </View>
      {cell(1)}
    </View>
  );
}

/** A token falling from above the board into its cell, with a little bounce. */
function Falling({
  player,
  size,
  from,
  x,
  y,
}: {
  player: P4Player;
  size: number;
  from: number;
  x: number;
  y: number;
}) {
  const fall = useRef(new Animated.Value(from)).current;
  useEffect(() => {
    Animated.timing(fall, {
      toValue: 0,
      duration: 260 + Math.sqrt(Math.abs(from)) * 22,
      easing: Easing.bounce,
      useNativeDriver: native,
    }).start();
  }, [fall]);
  return (
    <Animated.View style={[styles.abs, { left: x, top: y, transform: [{ translateY: fall }] }]}>
      <Token player={player} size={size} />
    </Animated.View>
  );
}

/** White rings that pulse around the winning tokens. */
function WinRing({ x, y, size }: { x: number; y: number; size: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: native }),
        Animated.timing(pulse, { toValue: 0, duration: 550, useNativeDriver: native }),
      ]),
    );
    // Wait for the last token to land first.
    const id = setTimeout(() => loop.start(), 450);
    return () => {
      clearTimeout(id);
      loop.stop();
    };
  }, [pulse]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.abs,
        styles.winRing,
        {
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: Math.max(3, size * 0.09),
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
        },
      ]}
    />
  );
}

function Board({
  game,
  width,
  height,
  canPlay,
  onDrop,
  prompt,
}: {
  game: P4State;
  width: number;
  height: number;
  canPlay: boolean;
  onDrop: (col: number) => void;
  prompt: string;
}) {
  const [aim, setAim] = useState(3);
  const pad = 8;
  const promptH = 34;
  // One extra row of room above the board, where the next token waits.
  const cell = Math.floor(
    Math.min(64, (width - 2 * pad - 4) / P4_COLS, (height - 2 * pad - promptH) / (P4_ROWS + 1)),
  );
  const hole = Math.round(cell * 0.8);
  const inset = (cell - hole) / 2;
  const boardW = P4_COLS * cell + 2 * pad;
  const boardH = P4_ROWS * cell + 2 * pad;
  const top = cell;
  const finished = p4Finished(game);
  // Cell position inside the whole area (headroom included); row 0 is at the bottom.
  const cx = (col: number) => pad + col * cell + inset;
  const cy = (row: number) => top + pad + (P4_ROWS - 1 - row) * cell + inset;
  const winning = new Set((game.winLine ?? []).map(([c, r]) => `${c}-${r}`));

  const tokens: { col: number; row: number; who: P4Player }[] = [];
  game.board.forEach((column, col) =>
    column.forEach((who, row) => {
      if (who !== null) tokens.push({ col, row, who });
    }),
  );
  const aimCol = canPlay && p4DropRow(game.board, aim) >= 0 ? aim : -1;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: boardW, height: top + boardH }}>
        {/* The token about to be played, above the aimed column. */}
        {!finished && (
          <View
            style={[
              styles.abs,
              { left: cx(aimCol >= 0 ? aimCol : 3), top: inset, opacity: canPlay ? 1 : 0.5 },
            ]}
          >
            <Token player={game.current} size={hole} />
          </View>
        )}
        {/* Back of the board: what shows through the empty holes. */}
        <LinearGradient
          colors={['#0b1d4a', '#06112e']}
          style={[styles.abs, { left: pad, top: top + pad, width: P4_COLS * cell, height: P4_ROWS * cell }]}
        />
        {tokens.map(({ col, row, who }) => {
          const fresh = game.lastMove?.col === col && game.lastMove?.row === row;
          return (
            <Falling
              key={`${game.round}-${col}-${row}`}
              player={who}
              size={hole}
              x={cx(col)}
              y={cy(row)}
              from={fresh ? -(cy(row) - inset) : 0}
            />
          );
        })}
        {/* The blue front of the board, with a round hole in every cell. */}
        <View
          pointerEvents="none"
          style={[styles.abs, styles.face, { left: 0, top, width: boardW, height: boardH, padding: pad }]}
        >
          {Array.from({ length: P4_ROWS }, (_, r) => (
            <View key={r} style={styles.faceRow}>
              {Array.from({ length: P4_COLS }, (_, c) => (
                <View key={c} style={[styles.faceCell, { width: cell, height: cell }]}>
                  <View
                    style={{
                      width: hole,
                      height: hole,
                      borderRadius: hole / 2,
                      boxShadow: `0 0 0 ${cell}px ${BOARD_BLUE}, inset 0 ${hole * 0.08}px ${hole * 0.12}px rgba(0,0,0,0.55)`,
                    }}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
        <View
          pointerEvents="none"
          style={[styles.abs, styles.faceShine, { top, width: boardW, height: boardH }]}
        />
        {/* The last token played gets a small dot, so everyone sees where the robot went. */}
        {game.lastMove && !finished && (
          <View
            pointerEvents="none"
            style={[
              styles.abs,
              styles.lastDot,
              { left: cx(game.lastMove.col) + hole / 2 - 4, top: cy(game.lastMove.row) + hole / 2 - 4 },
            ]}
          />
        )}
        {tokens
          .filter(({ col, row }) => winning.has(`${col}-${row}`))
          .map(({ col, row }) => (
            <WinRing key={`w${col}-${row}`} x={cx(col)} y={cy(row)} size={hole} />
          ))}
        {/* One tall touch zone per column, headroom included. */}
        {Array.from({ length: P4_COLS }, (_, c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={t('Colonne {n}', { n: c + 1 })}
            disabled={!canPlay || p4DropRow(game.board, c) < 0}
            onPressIn={() => setAim(c)}
            onHoverIn={() => setAim(c)}
            onPress={() => onDrop(c)}
            style={({ pressed }) => [
              styles.abs,
              { left: pad + c * cell, top: 0, width: cell, height: top + boardH },
              pressed && styles.columnPressed,
            ]}
          />
        ))}
      </View>
      <Text style={[styles.prompt, finished && styles.promptDone]} numberOfLines={1}>
        {prompt}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Results

function MatchResults({
  game,
  settings,
  onReplay,
  onSettings,
  onHome,
  homeLabel,
}: {
  game: P4State;
  settings: Settings;
  /** Absent online: a new match starts from a new table. */
  onReplay?: () => void;
  onSettings?: () => void;
  onHome: () => void;
  homeLabel?: string;
}) {
  const [a, b] = game.scores;
  const winner: P4Player | null = a > b ? 0 : b > a ? 1 : null;
  const played = a + b + game.draws;
  const headline =
    winner === null
      ? t('Égalité parfaite !')
      : settings.vsBot && winner === 1
        ? t('{name} remporte le match', { name: settings.names[1] })
        : t('{name} remporte le match !', { name: settings.names[winner] });
  const side = (p: P4Player) => (
    <View style={[styles.finalSide, winner === p && styles.finalWinner]}>
      <AvatarBadge avatar={settings.avatars[p]} size={52} />
      <Text style={[styles.finalName, winner === p && styles.finalNameWin]} numberOfLines={1}>
        {settings.names[p]}
      </Text>
      <View style={styles.finalScoreRow}>
        <Token player={p} size={22} />
        <Text style={[styles.finalScore, { color: TOKEN_COLORS[p].fill }]}>{game.scores[p]}</Text>
      </View>
    </View>
  );
  return (
    <ScrollView contentContainerStyle={styles.results}>
      <Appear>
        <Text style={styles.trophy}>
          {winner === null ? '🤝' : settings.vsBot && winner === 1 ? '🤖' : '🏆'}
        </Text>
        <Text style={styles.winner}>{headline}</Text>
        <Text style={styles.resultsSub}>
          {tn(played, '{n} manche jouée', '{n} manches jouées')}
          {game.draws > 0 ? ` · ${tn(game.draws, '{n} nulle', '{n} nulles')}` : ''}
          {settings.vsBot
            ? ` · ${t('robot {level}', { level: t(P4_LEVEL_LABELS[settings.level]).toLowerCase() })}`
            : ''}
        </Text>
      </Appear>
      <View style={styles.finalRow}>
        {side(0)}
        <Text style={styles.finalDash}>–</Text>
        {side(1)}
      </View>
      <View style={styles.spacer} />
      {onReplay && <Button label={t('Rejouer')} onPress={onReplay} />}
      {onSettings && <Button label={t('Changer les réglages')} variant="secondary" onPress={onSettings} />}
      <Button label={homeLabel ?? t('Retour aux jeux')} variant="secondary" onPress={onHome} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Online

/** A match at an online table: seat 0 plays red, seat 1 yellow; everyone sees the same board. */
export function Puissance4OnlineBoard({
  view,
  mySeat,
  seats,
  deadline,
  now,
  betweenRounds,
  over,
  busy,
  error,
  onMove,
  onLeave,
}: OnlineBoardProps<P4OnlineState>) {
  const game = view.game;
  const finished = p4Finished(game);
  const myTurn = !finished && game.current === mySeat;
  const seated = mySeat === 0 || mySeat === 1;
  const settings: Settings = {
    names: [seats[0]?.name ?? t('Rouge'), seats[1]?.name ?? t('Jaune')],
    avatars: [seats[0]?.avatar ?? defaultAvatar(0), seats[1]?.avatar ?? ROBOT_AVATAR],
    vsBot: false,
    level: 'moyen',
  };
  const sub = (p: P4Player) =>
    seats[p]?.bot
      ? t('Robot')
      : p === mySeat
        ? t('Toi · {color}', { color: TOKEN_NAMES[p] })
        : TOKEN_NAMES[p];
  const current = seats[game.current];

  // Sounds follow what happens at the table, whoever played.
  const last = useRef(game);
  useEffect(() => {
    const before = last.current;
    last.current = game;
    if (game === before) return;
    if (game.moves > before.moves || game.round !== before.round) sounds.card();
    if (finished && !p4Finished(before)) {
      const id = setTimeout(() => {
        if (game.draw) sounds.chips();
        else if (game.winner === mySeat || !seated) sounds.win();
        else sounds.fold();
      }, 350);
      return () => clearTimeout(id);
    }
    if (myTurn && before.current !== game.current) sounds.myTurn();
  }, [game]);
  useFeat('puissance4', finished && seated && game.winner === mySeat);

  if (over)
    return (
      <MatchResults game={game} settings={settings} onHome={onLeave} homeLabel={t('Quitter la table')} />
    );

  const prompt = finished
    ? game.draw
      ? t('🤝 Grille pleine : match nul !')
      : game.winner === mySeat
        ? t('🏆 Tu gagnes la manche !')
        : t('🏆 {name} gagne la manche !', { name: settings.names[game.winner!] })
    : myTurn
      ? t('À toi de jouer !')
      : current?.bot
        ? t('🤖 {name} réfléchit…', { name: settings.names[game.current] })
        : t('{name} joue…', { name: settings.names[game.current] });
  const waitSeconds = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;

  return (
    <GameLayout
      top={
        <>
          <TopBar onBack={onLeave} backLabel={t('← Quitter')}>
            <Text style={styles.round}>{t('Manche {n}/{total}', { n: game.round, total: view.rounds })}</Text>
          </TopBar>
          <Scoreboard game={game} settings={settings} subs={[sub(0), sub(1)]} />
          {deadline && !finished && current && !current.bot && (
            <TurnTimer deadline={deadline} now={now} name={myTurn ? t('Toi') : current.name} seconds={60} />
          )}
        </>
      }
      table={({ width, height }) => (
        <Board
          game={game}
          width={width}
          height={height}
          canPlay={myTurn && !busy}
          onDrop={(col) => onMove({ type: 'drop', col })}
          prompt={prompt}
        />
      )}
      bottom={
        <View style={styles.onlineBottom}>
          {error && <Text style={styles.onlineError}>{error}</Text>}
          {betweenRounds ? (
            seated ? (
              <Button
                label={
                  waitSeconds !== null
                    ? t('Manche suivante ({n} s)', { n: waitSeconds })
                    : t('Manche suivante')
                }
                disabled={busy}
                onPress={() => onMove({ type: 'next' })}
              />
            ) : (
              <Text style={styles.help}>{t('La manche suivante va commencer…')}</Text>
            )
          ) : (
            <Text style={styles.help}>
              {myTurn
                ? t('Touche une colonne pour y faire tomber ton jeton.')
                : seated
                  ? t('Attends ton tour : tu joues les {color}.', {
                      color: TOKEN_NAMES[mySeat as P4Player].toLowerCase(),
                    })
                  : t('Tu regardes la partie.')}
            </Text>
          )}
        </View>
      }
    />
  );
}

/** Options of an online table: the number of rounds of the match. */
export function Puissance4OnlineOptions({ value, onChange }: OnlineOptionsProps) {
  const rounds = typeof value.rounds === 'number' ? value.rounds : P4_ONLINE_DEFAULT_ROUNDS;
  return (
    <View style={styles.onlineOptions}>
      <Text style={styles.section}>{t('Nombre de manches')}</Text>
      <View style={styles.pills}>
        {P4_ONLINE_ROUND_CHOICES.map((n) => (
          <Pill
            key={n}
            label={String(n)}
            active={n === rounds}
            onPress={() => onChange({ ...value, rounds: n })}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  flex: { flex: 1 },

  // Setup
  setup: { padding: 20, paddingTop: 40, paddingBottom: 30 },
  titleTokens: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 8 },
  title: { color: colors.gold, fontSize: 34, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.muted, textAlign: 'center', marginBottom: 4 },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  nameInput: { minWidth: 0 },
  botRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  botName: { color: colors.text, fontSize: 16 },
  botTag: { color: colors.gold, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  hint: { color: colors.muted, marginTop: 8, fontSize: 13 },
  error: { color: colors.gold, marginTop: 8 },
  spacer: { height: 20 },

  // Game
  round: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  scoreboard: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 8 },
  scoreCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    minWidth: 0,
  },
  scoreCellRight: { flexDirection: 'row-reverse' },
  scoreActive: { borderColor: colors.gold, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  scoreToken: { position: 'absolute', right: -5, bottom: -4 },
  scoreText: { flex: 1, minWidth: 0 },
  scoreTextRight: { alignItems: 'flex-end' },
  scoreName: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  scoreNameActive: { color: colors.gold, fontWeight: '800' },
  scoreSub: { color: colors.muted, fontSize: 10, fontWeight: '600', opacity: 0.8 },
  scoreValue: { fontSize: 24, fontWeight: '900', minWidth: 18, textAlign: 'center' },
  scoreMiddle: { alignItems: 'center', minWidth: 26 },
  scoreVs: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  scoreDraws: { color: colors.muted, fontSize: 9, fontWeight: '700' },

  face: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#5d93ff',
    boxShadow: `0 10px 26px rgba(0,0,0,0.55), 0 4px 0 ${BOARD_BLUE_DARK}`,
  },
  faceRow: { flexDirection: 'row' },
  faceCell: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  faceShine: {
    left: 0,
    borderRadius: 16,
    boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.45), inset 0 -4px 8px rgba(0,0,0,0.3)',
  },
  lastDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
    boxShadow: '0 0 4px rgba(0,0,0,0.5)',
  },
  winRing: { borderColor: '#ffffff', boxShadow: '0 0 12px 3px rgba(255,255,255,0.75)' },
  columnPressed: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10 },
  prompt: {
    marginTop: 10,
    height: 24,
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  promptDone: { color: colors.gold, fontSize: 18 },
  bottomBox: { height: 58, justifyContent: 'center' },
  buttons: { flexDirection: 'row', gap: 8 },
  help: { color: colors.muted, textAlign: 'center', fontSize: 13 },
  onlineOptions: { marginBottom: 12 },
  onlineBottom: { minHeight: 58, justifyContent: 'center' },
  onlineError: { color: colors.gold, textAlign: 'center', fontSize: 13, marginBottom: 4 },

  // Results
  results: { padding: 16, paddingTop: 48, paddingBottom: 30 },
  trophy: { fontSize: 52, textAlign: 'center' },
  winner: { color: colors.gold, fontSize: 26, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  resultsSub: { color: colors.muted, textAlign: 'center', marginTop: 6, fontSize: 14 },
  finalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24 },
  finalSide: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    minWidth: 0,
  },
  finalWinner: { borderColor: colors.gold, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  finalName: { color: colors.text, fontSize: 16, fontWeight: '700', maxWidth: '100%' },
  finalNameWin: { color: colors.gold, fontWeight: '900' },
  finalScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  finalScore: { fontSize: 36, fontWeight: '900' },
  finalDash: { color: colors.muted, fontSize: 28, fontWeight: '900' },
});
