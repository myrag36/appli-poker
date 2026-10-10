import { useEffect, useMemo, useRef, useState } from 'react';
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
  type DamesLevel,
  type DamesMove,
  type DamesOnlineState,
  type DamesPlayer,
  type DamesState,
  DAMES_LEVEL_LABELS,
  damesBotMove,
  damesCount,
  damesFinished,
  damesLegalMoves,
  damesNewGame,
  damesOwner,
  damesPlay,
  damesRowCol,
  defaultAvatar,
} from '@appli-poker/engine';
import { AvatarBadge, AvatarPicker } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { GameLayout } from '../components/GameLayout';
import { Pill } from '../components/LevelPicker';
import { Appear, reducedMotion } from '../components/Motion';
import { OnlineButton } from '../components/OnlineButton';
import { type GameRules, RuleExample, RulesButton } from '../components/Rules';
import { TopBar } from '../components/TopBar';
import { TurnTimer } from '../components/TurnTimer';
import type { OnlineBoardProps } from '../online-games/types';
import { sounds } from '../feedback';
import { reportLocalGame } from '../online/progress';
import { deviceRng } from '../rng';
import { colors, gradients } from '../theme';
import { COLUMN_MAX_WIDTH, useDesktop } from '../layout';
import { t, tn } from '../i18n';

const native = Platform.OS !== 'web';

/** How long the robot seems to think before moving, in ms (on top of the last move's animation). */
const BOT_DELAY = 550;
/** How long a piece takes for each square it lands on, in ms. */
const STEP_MS = 190;
/** Pause between the last move and the results screen. */
const END_DELAY = 1700;

type Piece = 'w' | 'W' | 'b' | 'B';

const PLAYER_NAMES: Record<DamesPlayer, string> = { 0: t('Blancs'), 1: t('Noirs') };

const LEVEL_HINTS: Record<DamesLevel, string> = {
  facile: t('Il joue au hasard parmi les coups permis.'),
  moyen: t('Il prend ce qu’il peut et évite de laisser ses pions en prise.'),
  difficile: t('Il calcule plusieurs coups à l’avance et prépare ses rafles. Bonne chance !'),
};

// ---------------------------------------------------------------------------
// Colors: ivory and ebony pieces on a board made of the theme's wood.

/** Mixes two #rrggbb colors: k = 0 gives a, k = 1 gives b. */
function mix(a: string, b: string, k: number): string {
  const hex = /^#[0-9a-f]{6}$/i;
  if (!hex.test(a) || !hex.test(b)) return hex.test(a) ? a : b;
  const ch = (c: string, i: number) => parseInt(c.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `#${[0, 1, 2]
    .map((i) =>
      Math.round(ch(a, i) * (1 - k) + ch(b, i) * k)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

const LIGHT_SQUARE = mix('#f2ddb6', gradients.wood[0], 0.16);
const DARK_SQUARE = mix('#7d4b28', gradients.wood[1], 0.4);
const DARK_SQUARE_EDGE = mix(DARK_SQUARE, '#000000', 0.35);
const FRAME = gradients.wood;

const PIECE_COLORS = {
  white: { top: '#fbf5e6', side: '#c9b48c', ring: 'rgba(140,105,60,0.32)', edge: 'rgba(120,95,60,0.55)' },
  black: { top: '#3b302a', side: '#120d0b', ring: 'rgba(255,235,210,0.14)', edge: 'rgba(0,0,0,0.7)' },
};
const CROWN = '#e8b923';
/** What a square holds, for screen readers. */
const PIECE_NAMES: Record<string, string> = {
  w: t('pion blanc'),
  b: t('pion noir'),
  W: t('dame blanche'),
  B: t('dame noire'),
};

/** A draughts piece seen slightly from the side: a thick disc, two for a king, with a crown. */
export function DamesPiece({ piece, size, dim }: { piece: Piece; size: number; dim?: boolean }) {
  const white = piece === 'w' || piece === 'W';
  const king = piece === 'W' || piece === 'B';
  const c = white ? PIECE_COLORS.white : PIECE_COLORS.black;
  const d = size * 0.84;
  const thick = Math.max(2, Math.round(size * 0.075));
  const layers = king ? 2 : 1;
  const top = (size - d) / 2 - (thick * layers) / 2;
  const disc = (i: number) => (
    <View
      key={i}
      style={[
        styles.abs,
        {
          left: (size - d) / 2,
          top: top + thick * (layers - i),
          width: d,
          height: d + thick,
          borderRadius: d / 2,
          backgroundColor: c.side,
        },
        i === 0 && { boxShadow: `0 ${size * 0.05}px ${size * 0.12}px rgba(0,0,0,0.5)` },
      ]}
    >
      <View
        style={{
          width: d,
          height: d,
          borderRadius: d / 2,
          backgroundColor: c.top,
          borderWidth: 1,
          borderColor: c.edge,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `inset 0 ${d * 0.06}px ${d * 0.1}px rgba(255,255,255,${white ? 0.6 : 0.16}), inset 0 -${d * 0.05}px ${d * 0.1}px rgba(0,0,0,0.25)`,
        }}
      >
        <View
          style={{
            width: d * 0.64,
            height: d * 0.64,
            borderRadius: d,
            borderWidth: Math.max(1, d * 0.045),
            borderColor: c.ring,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {king && i === layers - 1 && (
            <Text style={[styles.crown, { fontSize: d * 0.42, lineHeight: d * 0.5 }]}>♛</Text>
          )}
        </View>
      </View>
    </View>
  );
  return (
    <View style={{ width: size, height: size, opacity: dim ? 0.45 : 1 }} pointerEvents="none">
      {Array.from({ length: layers }, (_, i) => disc(i))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Rules

/** A corner of the board for the rules: '.' empty, w/b men, W/B kings, '*' landing, 'x' taken. */
const Corner = ({ rows, label }: { rows: string[]; label?: string }) => {
  const cell = 19;
  return (
    <RuleExample label={label}>
      <View style={{ padding: 3, borderRadius: 5, backgroundColor: FRAME[1] }}>
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {row.split('').map((ch, c) => (
              <View
                key={c}
                style={{
                  width: cell,
                  height: cell,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: (r + c) % 2 ? DARK_SQUARE : LIGHT_SQUARE,
                }}
              >
                {'wWbB'.includes(ch) && <DamesPiece piece={ch as Piece} size={cell} />}
                {ch === 'x' && (
                  <>
                    <DamesPiece piece="b" size={cell} dim />
                    <Text style={[styles.abs, styles.ruleCross]}>✕</Text>
                  </>
                )}
                {ch === '*' && <View style={styles.ruleDot} />}
              </View>
            ))}
          </View>
        ))}
      </View>
    </RuleExample>
  );
};

export const DAMES_RULES: GameRules = {
  game: 'dames',
  title: t('Dames'),
  goal: t('Prends toutes les pièces de ton adversaire, ou bloque-les pour qu’il ne puisse plus jouer.'),
  steps: [
    {
      icon: '⚪',
      title: t('Le damier'),
      text: t(
        'On joue sur les 50 cases foncées d’un damier de 10 × 10. Chacun a 20 pions ; les blancs commencent, puis on joue chacun son tour.',
      ),
    },
    {
      icon: '↗️',
      title: t('Avancer'),
      text: t('Un pion avance d’une case en diagonale, toujours vers l’avant. Touche un pion puis sa case.'),
      visual: <Corner rows={['.....', '.*.*.', '..w..']} label={t('Deux cases possibles')} />,
    },
    {
      icon: '⚔️',
      title: t('Prendre, c’est obligatoire'),
      text: t(
        'Saute par-dessus une pièce adverse voisine pour atterrir juste derrière : elle est prise. Un pion prend aussi en arrière. Si tu peux prendre, tu dois prendre.',
      ),
      visual: (
        <>
          <Corner rows={['...*.', '..b..', '.w...']} label={t('En avant')} />
          <Corner rows={['.w...', '..b..', '...*.']} label={t('En arrière')} />
        </>
      ),
    },
    {
      icon: '🔗',
      title: t('Les rafles'),
      text: t(
        'Après un saut, si une autre prise est possible, on continue : c’est une rafle. Il faut jouer la rafle qui prend le plus de pièces. Les pièces prises ne sont enlevées qu’à la fin.',
      ),
      visual: (
        <Corner rows={['.....*', '....x.', '.....', '..x...', '.w....']} label={t('Deux pièces d’un coup')} />
      ),
    },
    {
      icon: '👑',
      title: t('Aller à dame'),
      text: t(
        'Un pion qui finit son coup sur la dernière rangée devient une dame. S’il ne fait qu’y passer au milieu d’une rafle, il reste un pion.',
      ),
    },
    {
      icon: '🦅',
      title: t('La dame vole'),
      text: t(
        'La dame glisse d’autant de cases qu’elle veut en diagonale. Elle prend de loin une pièce isolée et atterrit sur n’importe quelle case libre derrière.',
      ),
      visual: (
        <Corner rows={['.....*', '....*.', '...b..', '......', '.W....']} label={t('Prise à distance')} />
      ),
    },
    {
      icon: '🤝',
      title: t('Fin de partie'),
      text: t(
        'Perd celui qui n’a plus de pièce ou ne peut plus bouger. Partie nulle si la même position revient 3 fois, après 25 coups de chaque côté où seules les dames bougent sans prise, ou si une dame seule résiste trop longtemps.',
      ),
    },
  ],
  tip: t('Garde ta dernière rangée le plus longtemps possible : elle empêche l’adversaire d’aller à dame.'),
};

/** The picture of the game's card on the home screen: a tilted corner of the board. */
export function DamesArt({ cell = 30 }: { cell?: number }) {
  const rows = ['.b.b.b', 'b...B.', '.w.b..', 'w.w...'];
  return (
    <View
      pointerEvents="none"
      style={[styles.artBoard, { padding: cell * 0.22, transform: [{ rotate: '-6deg' }] }]}
    >
      <LinearGradient colors={FRAME} style={[StyleSheet.absoluteFill, { borderRadius: 8 }]} />
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.split('').map((ch, c) => (
            <View
              key={c}
              style={{
                width: cell,
                height: cell,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: (r + c) % 2 ? DARK_SQUARE : LIGHT_SQUARE,
              }}
            >
              {ch !== '.' && <DamesPiece piece={ch as Piece} size={cell} />}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen

interface Settings {
  names: [string, string];
  avatars: [Avatar, Avatar];
  /** One player is a robot. */
  vsBot: boolean;
  level: DamesLevel;
  /** Against the robot: the color the person plays (the board is turned for Black). */
  human: DamesPlayer;
}

export function DamesScreen({ onBack, onOnline }: { onBack: () => void; onOnline?: () => void }) {
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

const ROBOT_NAME = 'Robby';
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
  const [level, setLevel] = useState<DamesLevel>(initial?.level ?? 'moyen');
  const [human, setHuman] = useState<DamesPlayer>(initial?.human ?? 0);
  const [names, setNames] = useState<[string, string]>(() => {
    if (!initial) return ['', ''];
    if (!initial.vsBot) return initial.names;
    return [initial.names[initial.human], ''];
  });
  const [avatars, setAvatars] = useState<[Avatar, Avatar]>(() => {
    if (!initial) return [defaultAvatar(0), defaultAvatar(1)];
    if (!initial.vsBot) return initial.avatars;
    return [initial.avatars[initial.human], defaultAvatar(1)];
  });
  const [picking, setPicking] = useState<0 | 1 | null>(null);
  const desktop = useDesktop();

  const cleaned: [string, string] = [
    names[0].trim() || t('Joueur {n}', { n: 1 }),
    vsBot ? ROBOT_NAME : names[1].trim() || t('Joueur {n}', { n: 2 }),
  ];
  const duplicate = cleaned[0] === cleaned[1];

  const playerRow = (i: 0 | 1) => {
    // Against the robot, row 0 is the person (whatever color) and row 1 the robot.
    const color: DamesPlayer = vsBot ? (i === 0 ? human : human === 0 ? 1 : 0) : i;
    return (
      <View key={i}>
        <View style={styles.row}>
          <DamesPiece piece={color === 0 ? 'w' : 'b'} size={30} />
          {vsBot && i === 1 ? (
            <>
              <AvatarBadge avatar={ROBOT_AVATAR} size={40} />
              <View style={[styles.input, styles.flex, styles.botRow]}>
                <Text style={styles.botName}>{ROBOT_NAME}</Text>
                <Text style={styles.botTag}>
                  {t('Robot · {level}', { level: t(DAMES_LEVEL_LABELS[level]) })}
                </Text>
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
  };

  function start() {
    if (!vsBot) {
      onStart({ names: cleaned, avatars, vsBot, level, human: 0 });
      return;
    }
    // Settings are stored by color: White first.
    const me = { name: cleaned[0], avatar: avatars[0] };
    const bot = { name: ROBOT_NAME, avatar: ROBOT_AVATAR };
    const [white, black] = human === 0 ? [me, bot] : [bot, me];
    onStart({
      names: [white.name, black.name],
      avatars: [white.avatar, black.avatar],
      vsBot,
      level,
      human,
    });
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.setup, desktop && styles.column]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.titlePieces}>
        {(['w', 'B', 'b'] as Piece[]).map((p, i) => (
          <View key={i} style={{ transform: [{ translateY: i === 1 ? -6 : 0 }] }}>
            <DamesPiece piece={p} size={38} />
          </View>
        ))}
      </View>
      <Text style={styles.title}>{t('Dames')}</Text>
      <Text style={styles.subtitle}>{t('Damier de 10 × 10, règles internationales')}</Text>
      {onOnline && <OnlineButton onPress={onOnline} />}
      <RulesButton rules={DAMES_RULES} />

      <Text style={styles.section}>{t('Adversaire')}</Text>
      <View style={styles.pills}>
        <Pill label={t('🤖 Contre le robot')} active={vsBot} onPress={() => setVsBot(true)} />
        <Pill label={t('👥 À deux sur ce téléphone')} active={!vsBot} onPress={() => setVsBot(false)} />
      </View>
      {vsBot && (
        <>
          <Text style={styles.section}>{t('Niveau du robot')}</Text>
          <View style={styles.pills}>
            {(['facile', 'moyen', 'difficile'] as DamesLevel[]).map((l) => (
              <Pill
                key={l}
                label={t(DAMES_LEVEL_LABELS[l])}
                active={level === l}
                onPress={() => setLevel(l)}
              />
            ))}
          </View>
          <Text style={styles.hint}>{LEVEL_HINTS[level]}</Text>
          <Text style={styles.section}>{t('Ta couleur')}</Text>
          <View style={styles.pills}>
            <Pill label={t('⚪ Blancs, je commence')} active={human === 0} onPress={() => setHuman(0)} />
            <Pill label={t('⚫ Noirs')} active={human === 1} onPress={() => setHuman(1)} />
          </View>
        </>
      )}

      <Text style={styles.section}>{t('Joueurs')}</Text>
      {playerRow(0)}
      {playerRow(1)}
      <Text style={styles.hint}>
        {vsBot
          ? t('Ton camp est toujours en bas du damier.')
          : t('On se passe le téléphone à chaque coup. Les blancs commencent.')}
      </Text>
      {duplicate && <Text style={styles.error}>{t('Les deux joueurs ont le même nom.')}</Text>}

      <View style={styles.spacer} />
      <Button label={t('Lancer la partie')} disabled={duplicate} onPress={start} />
      <Button label={t('Retour')} variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Game

/** How long the last move's animation lasts, in ms. */
const moveTime = (game: DamesState) => (game.lastMove ? game.lastMove.path.length * STEP_MS : 0);

/** The sound of a move that was just played. */
function moveSound(game: DamesState) {
  const m = game.lastMove;
  if (!m) return;
  if (m.captures.length > 0) {
    sounds.drop();
    // One more click per extra piece taken in a rafle.
    for (let i = 1; i < Math.min(m.captures.length, 4); i++) setTimeout(() => sounds.chips(), i * STEP_MS);
  } else sounds.chips();
  if (game.promoted) setTimeout(() => sounds.flip(), m.path.length * STEP_MS);
}

/** Pieces of the other color a player has taken. */
const taken = (board: string, p: DamesPlayer) => {
  const { men, kings } = damesCount(board, p === 0 ? 1 : 0);
  return 20 - men - kings;
};

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
  const [game, setGame] = useState<DamesState>(() => damesNewGame());
  const [over, setOver] = useState(false);
  const desktop = useDesktop();
  const finished = damesFinished(game);
  const isBot = (p: DamesPlayer) => settings.vsBot && p !== settings.human;
  const botTurn = !finished && isBot(game.current);
  const name = (p: DamesPlayer) => settings.names[p];

  function play(move: DamesMove) {
    if (botTurn || finished) return;
    const next = damesPlay(game, move);
    setGame(next);
    moveSound(next);
  }

  // The robot moves after a short pause, once the previous move has been seen.
  useEffect(() => {
    if (!botTurn) return;
    const id = setTimeout(
      () => {
        const m = damesBotMove(game, settings.level, deviceRng);
        const next = damesPlay(game, m);
        setGame((g) => (g === game ? next : g));
        moveSound(next);
      },
      BOT_DELAY + moveTime(game),
    );
    return () => clearTimeout(id);
  }, [game, botTurn]);

  // The end of the game: experience, a sound, then the results.
  useEffect(() => {
    if (!finished) return;
    const humanWon = game.winner !== null && !isBot(game.winner);
    reportLocalGame('dames', humanWon);
    const wait = moveTime(game);
    const sound = setTimeout(() => {
      if (game.draw) sounds.chips();
      else if (humanWon) sounds.win();
      else sounds.lose();
    }, wait + 200);
    const id = setTimeout(() => setOver(true), wait + END_DELAY);
    return () => {
      clearTimeout(sound);
      clearTimeout(id);
    };
  }, [finished]);

  if (over)
    return (
      <Results
        game={game}
        settings={settings}
        onReplay={onReplay}
        onSettings={onQuit}
        onHome={onHome}
        robot={settings.vsBot ? (settings.human === 0 ? 1 : 0) : null}
      />
    );

  const prompt = finished
    ? endLine(game, settings.names, settings.vsBot ? settings.human : null)
    : botTurn
      ? t('🤖 {name} réfléchit…', { name: name(game.current) })
      : settings.vsBot
        ? t('À toi de jouer !')
        : t('À toi, {name} ({color}) !', { name: name(game.current), color: PLAYER_NAMES[game.current] });

  return (
    <GameLayout
      top={
        <>
          <TopBar onBack={onQuit} backLabel={t('← Quitter')}>
            <Text style={styles.round}>{t('Coup {n}', { n: Math.floor(game.plies / 2) + 1 })}</Text>
          </TopBar>
          {!desktop && <Scoreboard game={game} settings={settings} />}
        </>
      }
      table={({ width, height }) => (
        <BoardArea
          desktop={desktop}
          game={game}
          settings={settings}
          width={width}
          height={height}
          flipped={settings.vsBot && settings.human === 1}
          canPlay={!botTurn && !finished}
          onMove={play}
          prompt={prompt}
        />
      )}
      bottom={
        <View style={[styles.bottomBox, desktop && styles.bottomDesktop]}>
          <Text style={styles.help}>
            {finished
              ? t('Fin de la partie')
              : botTurn
                ? t('{name} joue…', { name: name(game.current) })
                : t('Touche une de tes pièces, puis la case où l’envoyer.')}
          </Text>
        </View>
      }
    />
  );
}

/** One line telling how the game ended. `me`: the color of the person playing against the robot. */
function endLine(game: DamesState, names: [string, string], me: DamesPlayer | null): string {
  if (game.draw)
    return game.end === 'repetition'
      ? t('🤝 Même position trois fois : nulle')
      : game.end === 'kings25'
        ? t('🤝 25 coups de dames sans prise : nulle')
        : t('🤝 Finale sans issue : nulle');
  const w = game.winner!;
  if (me !== null) return w === me ? t('🏆 Tu as gagné !') : t('🤖 {name} gagne', { name: names[w] });
  return t('🏆 {name} gagne !', { name: names[w] });
}

/** Explains the end in a full sentence, for the results. */
function endReason(game: DamesState, names: [string, string]): string {
  switch (game.end) {
    case 'pieces':
      return t('{name} a pris toutes les pièces adverses.', { name: names[game.winner!] });
    case 'blocked':
      return t('{name} a bloqué toutes les pièces adverses.', { name: names[game.winner!] });
    case 'repetition':
      return t('La même position est revenue trois fois.');
    case 'kings25':
      return t('25 coups de chaque côté sans prise, avec seulement des dames qui bougent.');
    case 'endgame':
      return t('La dame seule a tenu assez longtemps : la finale est nulle.');
    default:
      return '';
  }
}

/** A player's line above the board on a phone: avatar, name, color and the pieces taken. */
function Scoreboard({
  game,
  settings,
  subs,
}: {
  game: DamesState;
  settings: Settings;
  subs?: [string, string];
}) {
  const finished = damesFinished(game);
  const cell = (p: DamesPlayer) => {
    const active = finished ? game.winner === p : game.current === p;
    return (
      <View style={[styles.scoreCell, active && styles.scoreActive, p === 1 && styles.scoreCellRight]}>
        <View>
          <AvatarBadge avatar={settings.avatars[p]} size={30} />
          <View style={styles.scorePiece}>
            <DamesPiece piece={p === 0 ? 'w' : 'b'} size={16} />
          </View>
        </View>
        <View style={[styles.scoreText, p === 1 && styles.scoreTextRight]}>
          <Text style={[styles.scoreName, active && styles.scoreNameActive]} numberOfLines={1}>
            {settings.names[p]}
          </Text>
          <Text style={styles.scoreSub} numberOfLines={1}>
            {subs ? subs[p] : settings.vsBot && p !== settings.human ? t('Robot') : PLAYER_NAMES[p]}
          </Text>
        </View>
        <View style={styles.scoreTaken}>
          <Text style={styles.scoreValue}>{taken(game.board, p)}</Text>
          <Text style={styles.scoreTakenLabel}>{t('prises')}</Text>
        </View>
      </View>
    );
  };
  return (
    <View style={styles.scoreboard}>
      {cell(0)}
      {cell(1)}
    </View>
  );
}

/** Width of each player's card beside the board, on a computer. */
const SIDE_W = 220;

/** The board; on a computer it is big and centered, with each player's card on its side. */
function BoardArea({
  desktop,
  settings,
  subs,
  width,
  height,
  ...board
}: Omit<Parameters<typeof Board>[0], 'size'> & {
  desktop: boolean;
  settings: Settings;
  subs?: [string, string];
  width: number;
  height: number;
}) {
  const promptH = desktop ? 44 : 34;
  if (!desktop) return <Board {...board} size={Math.min(width, height - promptH, 560)} />;
  const gap = 28;
  // The person (or White) on the left; the board turned for Black keeps Black on the left.
  const [left, right]: DamesPlayer[] = board.flipped ? [1, 0] : [0, 1];
  return (
    <View style={[styles.desktopRow, { gap }]}>
      <SidePlayer game={board.game} settings={settings} subs={subs} player={left} />
      <Board {...board} size={Math.min(width - 2 * (SIDE_W + gap), height - promptH, 720)} large />
      <SidePlayer game={board.game} settings={settings} subs={subs} player={right} />
    </View>
  );
}

/** A player's card beside the board: avatar, color and the pieces taken, shown as a pile. */
function SidePlayer({
  game,
  settings,
  subs,
  player: p,
}: {
  game: DamesState;
  settings: Settings;
  subs?: [string, string];
  player: DamesPlayer;
}) {
  const finished = damesFinished(game);
  const active = finished ? game.winner === p : game.current === p;
  const n = taken(game.board, p);
  const left = damesCount(game.board, p);
  return (
    <View style={[styles.side, active && styles.scoreActive]}>
      <View>
        <AvatarBadge avatar={settings.avatars[p]} size={64} />
        <View style={styles.sidePiece}>
          <DamesPiece piece={p === 0 ? 'w' : 'b'} size={28} />
        </View>
      </View>
      <Text style={[styles.sideName, active && styles.scoreNameActive]} numberOfLines={1}>
        {settings.names[p]}
      </Text>
      <Text style={styles.sideSub} numberOfLines={1}>
        {subs
          ? subs[p]
          : settings.vsBot && p !== settings.human
            ? t('Robot {level}', { level: t(DAMES_LEVEL_LABELS[settings.level]) })
            : PLAYER_NAMES[p]}
      </Text>
      <Text style={styles.sideScore}>{n}</Text>
      <Text style={styles.sideScoreLabel}>{tn(n, 'pièce prise', 'pièces prises')}</Text>
      <View style={styles.pile}>
        {Array.from({ length: n }, (_, i) => (
          <View key={i} style={{ marginLeft: i % 10 === 0 ? 0 : -8 }}>
            <DamesPiece piece={p === 0 ? 'b' : 'w'} size={18} />
          </View>
        ))}
      </View>
      <Text style={styles.sideLeft}>
        {tn(left.men, '{n} pion', '{n} pions')}
        {left.kings > 0 ? ` · ${tn(left.kings, '{n} dame', '{n} dames')}` : ''}
      </Text>
    </View>
  );
}

const samePath = (a: DamesMove, b: DamesMove) =>
  a.from === b.from && a.path.length === b.path.length && a.path.every((s, i) => s === b.path[i]);

/** A straight line between two points, for the path of a rafle. */
function Segment({
  x1,
  y1,
  x2,
  y2,
  thickness,
  color,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  color: string;
}) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  return (
    <View
      pointerEvents="none"
      style={[
        styles.abs,
        {
          left: (x1 + x2) / 2 - len / 2,
          top: (y1 + y2) / 2 - thickness / 2,
          width: len,
          height: thickness,
          borderRadius: thickness / 2,
          backgroundColor: color,
          transform: [{ rotate: `${angle}rad` }],
        },
      ]}
    />
  );
}

/** The piece that just moved, sliding along its path from its starting square. */
function Moving({
  piece,
  size,
  points,
  animate,
}: {
  piece: Piece;
  size: number;
  /** Top-left corners of the cells it goes through, the last one where it ends. */
  points: { x: number; y: number }[];
  animate: boolean;
}) {
  const n = points.length - 1;
  const progress = useRef(new Animated.Value(animate ? 0 : n)).current;
  useEffect(() => {
    if (!animate) return;
    Animated.timing(progress, {
      toValue: n,
      duration: n * STEP_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: native,
    }).start();
  }, [progress]);
  const end = points[n];
  const input = points.map((_, i) => i);
  const translateX =
    n > 0 ? progress.interpolate({ inputRange: input, outputRange: points.map((p) => p.x - end.x) }) : 0;
  const translateY =
    n > 0 ? progress.interpolate({ inputRange: input, outputRange: points.map((p) => p.y - end.y) }) : 0;
  // A little hop over each piece taken.
  const lift =
    n > 0
      ? progress.interpolate({
          inputRange: points.flatMap((_, i) => (i < n ? [i, i + 0.5] : [i])),
          outputRange: points.flatMap((_, i) => (i < n ? [1, 1.18] : [1])),
        })
      : 1;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.abs,
        { left: end.x, top: end.y, zIndex: 5, transform: [{ translateX }, { translateY }, { scale: lift }] },
      ]}
    >
      <DamesPiece piece={piece} size={size} />
    </Animated.View>
  );
}

/** A piece taken in the last move, fading away once the moving piece has gone past. */
function Taken({
  piece,
  size,
  x,
  y,
  delay,
}: {
  piece: Piece;
  size: number;
  x: number;
  y: number;
  delay: number;
}) {
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 0,
      duration: 260,
      delay,
      useNativeDriver: native,
    }).start();
  }, [fade]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.abs,
        {
          left: x,
          top: y,
          opacity: fade,
          transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
        },
      ]}
    >
      <DamesPiece piece={piece} size={size} />
    </Animated.View>
  );
}

/** A gold ring that pulses on the pieces that must take. */
function MustRing({ x, y, size }: { x: number; y: number; size: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: native }),
        Animated.timing(pulse, { toValue: 0, duration: 600, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.abs,
        styles.mustRing,
        {
          left: x + size * 0.04,
          top: y + size * 0.04,
          width: size * 0.92,
          height: size * 0.92,
          borderRadius: size,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
        },
      ]}
    />
  );
}

function Board({
  game,
  size,
  flipped,
  canPlay,
  onMove,
  prompt,
  large,
}: {
  game: DamesState;
  /** Width (and height) of the whole board, frame included. */
  size: number;
  /** Black at the bottom. */
  flipped: boolean;
  canPlay: boolean;
  onMove: (move: DamesMove) => void;
  prompt: string;
  /** On a computer: square numbers and a bigger prompt. */
  large?: boolean;
}) {
  const frame = Math.max(6, Math.round(size * 0.035));
  const cell = Math.floor((size - 2 * frame) / 10);
  const boardSize = cell * 10 + 2 * frame;
  const legal = useMemo(() => (canPlay ? damesLegalMoves(game) : []), [game, canPlay]);
  const capturing = legal.length > 0 && legal[0].captures.length > 0;
  const movable = useMemo(() => new Set(legal.map((m) => m.from)), [legal]);
  const firstSelection = () =>
    capturing && movable.size === 1 ? { from: legal[0].from, steps: [] as number[] } : null;
  const [sel, setSel] = useState<{ from: number; steps: number[] } | null>(firstSelection);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    setSel(firstSelection());
    setMessage(null);
  }, [legal]);

  // The position before the last move, to animate it and show what it took.
  const history = useRef<{ plies: number; board: string }[]>([]);
  const h = history.current;
  if (h[h.length - 1]?.plies !== game.plies)
    history.current = [...h.slice(-1), { plies: game.plies, board: game.board }];
  const before =
    history.current.length === 2 && history.current[0].plies === game.plies - 1
      ? history.current[0].board
      : null;

  const pos = (sq: number) => {
    const { row, col } = damesRowCol(sq);
    const r = flipped ? 9 - row : row;
    const c = flipped ? 9 - col : col;
    return { x: frame + c * cell, y: frame + r * cell };
  };
  const center = (sq: number) => {
    const p = pos(sq);
    return { x: p.x + cell / 2, y: p.y + cell / 2 };
  };

  const candidates = sel
    ? legal.filter((m) => m.from === sel.from && sel.steps.every((s, i) => m.path[i] === s))
    : [];
  const nextSteps = new Set(candidates.map((m) => m.path[sel!.steps.length]).filter((x) => x !== undefined));
  const finals = new Set(candidates.map((m) => m.path[m.path.length - 1]));
  // Pieces already jumped over by the chosen steps (the same for every candidate left).
  const jumped = new Set(candidates[0]?.captures.slice(0, sel?.steps.length ?? 0) ?? []);
  // A single sequence left: show it whole.
  const preview = candidates.length === 1 ? candidates[0] : null;

  function press(sq: number) {
    if (!canPlay) return;
    if (sel) {
      const byFinal = candidates.filter((m) => m.path[m.path.length - 1] === sq);
      if (byFinal.length > 0 && byFinal.every((m) => samePath(m, byFinal[0]))) {
        onMove(byFinal[0]);
        return;
      }
      if (nextSteps.has(sq)) {
        const rest = candidates.filter((m) => m.path[sel.steps.length] === sq);
        if (rest.length === 1) {
          onMove(rest[0]);
          return;
        }
        setSel({ from: sel.from, steps: [...sel.steps, sq] });
        setMessage(t('Plusieurs rafles passent par là : touche la case suivante.'));
        sounds.card();
        return;
      }
    }
    const owner = damesOwner(game.board[sq]);
    if (owner === game.current) {
      if (movable.has(sq)) {
        setSel(
          sel?.from === sq && sel.steps.length === 0 && !(capturing && movable.size === 1)
            ? null
            : { from: sq, steps: [] },
        );
        setMessage(null);
        sounds.card();
      } else {
        sounds.invalid();
        setSel(null);
        const n = legal[0]?.captures.length ?? 0;
        setMessage(
          capturing
            ? n > 1
              ? t('Prise obligatoire : une autre pièce peut prendre {n} pièces.', { n })
              : t('Prise obligatoire : une autre pièce doit prendre.')
            : t('Cette pièce ne peut pas bouger.'),
        );
      }
      return;
    }
    if (sel) {
      if (sel.steps.length > 0) {
        sounds.invalid();
        return;
      }
      setSel(null);
      setMessage(null);
    }
  }

  const last = game.lastMove;
  const mover = last ? (game.board[last.path[last.path.length - 1]] as Piece) : null;
  const fresh = !!last && before !== null && !reducedMotion();
  const squares = Array.from({ length: 50 }, (_, sq) => sq);
  const lastSquares = new Set(last ? [last.from, ...last.path] : []);

  const n = legal[0]?.captures.length ?? 0;
  const line =
    message ??
    (canPlay && capturing
      ? n > 1
        ? t('⚔️ Prise obligatoire : rafle de {n} pièces !', { n })
        : t('⚔️ Prise obligatoire !')
      : prompt);

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[styles.frame, { width: boardSize, height: boardSize, borderRadius: frame }]}>
        <LinearGradient
          colors={FRAME}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: frame }]}
        />
        {/* Wood grain on the frame. */}
        {Array.from({ length: 7 }, (_, i) => (
          <View
            key={i}
            pointerEvents="none"
            style={[styles.abs, styles.grain, { top: (boardSize * (i + 0.5)) / 7, width: boardSize }]}
          />
        ))}
        <View
          style={[
            styles.abs,
            styles.inner,
            { left: frame, top: frame, width: cell * 10, height: cell * 10, backgroundColor: LIGHT_SQUARE },
          ]}
        />
        {squares.map((sq) => {
          const { x, y } = pos(sq);
          return (
            <View
              key={`d${sq}`}
              pointerEvents="none"
              style={[styles.abs, styles.dark, { left: x, top: y, width: cell, height: cell }]}
            >
              {lastSquares.has(sq) && <View style={[StyleSheet.absoluteFill, styles.lastSquare]} />}
              {sel?.from === sq && <View style={[StyleSheet.absoluteFill, styles.selSquare]} />}
              {large && <Text style={styles.number}>{sq + 1}</Text>}
            </View>
          );
        })}
        {/* The path of the last capture, so everyone sees the rafle. */}
        {last &&
          last.captures.length > 0 &&
          [last.from, ...last.path].slice(1).map((sq, i, path) => {
            const a = center(i === 0 ? last.from : path[i - 1]);
            const b = center(sq);
            return (
              <Segment
                key={`l${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                thickness={Math.max(2, cell * 0.08)}
                color="rgba(255,236,170,0.55)"
              />
            );
          })}
        {squares.map((sq) => {
          const piece = game.board[sq];
          if (piece === '.') return null;
          if (last && sq === last.path[last.path.length - 1]) return null;
          const { x, y } = pos(sq);
          return (
            <View key={`p${sq}`} pointerEvents="none" style={[styles.abs, { left: x, top: y }]}>
              <DamesPiece piece={piece as Piece} size={cell} dim={jumped.has(sq)} />
            </View>
          );
        })}
        {fresh &&
          last!.captures.map((sq, i) => {
            const { x, y } = pos(sq);
            return (
              <Taken
                key={`t${game.plies}-${sq}`}
                piece={(before![sq] as Piece) ?? 'b'}
                size={cell}
                x={x}
                y={y}
                delay={(i + 0.6) * STEP_MS}
              />
            );
          })}
        {last && mover && (
          <Moving
            key={`m${game.plies}`}
            piece={mover}
            size={cell}
            animate={fresh}
            points={[last.from, ...last.path].map(pos)}
          />
        )}
        {/* The pieces that must take. */}
        {canPlay &&
          capturing &&
          !sel &&
          [...movable].map((sq) => {
            const { x, y } = pos(sq);
            return <MustRing key={`r${sq}`} x={x} y={y} size={cell} />;
          })}
        {/* The selected piece's way: the chosen steps, then where it can go. */}
        {sel &&
          (preview ? [preview.from, ...preview.path] : [sel.from, ...sel.steps])
            .slice(1)
            .map((sq, i, path) => {
              const a = center(i === 0 ? sel.from : path[i - 1]);
              const b = center(sq);
              return (
                <Segment
                  key={`s${i}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  thickness={Math.max(3, cell * 0.1)}
                  color={colors.gold}
                />
              );
            })}
        {sel &&
          (preview ? preview.captures : [...jumped]).map((sq) => {
            const { x, y } = pos(sq);
            return (
              <Text
                key={`x${sq}`}
                pointerEvents="none"
                style={[
                  styles.abs,
                  styles.cross,
                  { left: x, top: y, width: cell, lineHeight: cell, fontSize: cell * 0.55 },
                ]}
              >
                ✕
              </Text>
            );
          })}
        {sel &&
          squares
            .filter((sq) => nextSteps.has(sq) || finals.has(sq))
            .map((sq) => {
              const { x, y } = pos(sq);
              const final = finals.has(sq);
              const step = preview ? preview.path.indexOf(sq) + 1 : 0;
              return (
                <View
                  key={`g${sq}`}
                  pointerEvents="none"
                  style={[styles.abs, styles.target, { left: x, top: y, width: cell, height: cell }]}
                >
                  <View
                    style={[
                      final ? styles.targetDot : styles.targetRing,
                      {
                        width: cell * (final ? 0.42 : 0.6),
                        height: cell * (final ? 0.42 : 0.6),
                        borderRadius: cell,
                      },
                    ]}
                  >
                    {preview && preview.path.length > 1 && step > 0 && (
                      <Text style={[styles.stepNumber, { fontSize: cell * 0.24 }]}>{step}</Text>
                    )}
                  </View>
                </View>
              );
            })}
        {/* One touch zone per dark square. */}
        {squares.map((sq) => {
          const { x, y } = pos(sq);
          return (
            <Pressable
              key={`z${sq}`}
              accessibilityRole="button"
              accessibilityLabel={
                PIECE_NAMES[game.board[sq]]
                  ? t('Case {n}, {piece}', { n: sq + 1, piece: PIECE_NAMES[game.board[sq]] })
                  : t('Case {n}', { n: sq + 1 })
              }
              disabled={!canPlay}
              onPress={() => press(sq)}
              style={[
                styles.abs,
                { left: x, top: y, width: cell, height: cell, zIndex: 10 },
                large && styles.pointer,
              ]}
            />
          );
        })}
      </View>
      <Text
        style={[styles.prompt, large && styles.promptLarge, damesFinished(game) && styles.promptDone]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {line}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Results

function Results({
  game,
  settings,
  robot,
  onReplay,
  onSettings,
  onHome,
  homeLabel,
  me,
}: {
  game: DamesState;
  settings: Settings;
  /** The robot's color against the robot, else null. */
  robot: DamesPlayer | null;
  /** Absent online: a new game starts from a new table. */
  onReplay?: () => void;
  onSettings?: () => void;
  onHome: () => void;
  homeLabel?: string;
  /** Online: my seat, for "you won". */
  me?: number;
}) {
  const desktop = useDesktop();
  const w = game.winner;
  const headline =
    w === null
      ? t('Partie nulle')
      : w === me || (robot !== null && w !== robot)
        ? t('Tu as gagné !')
        : t('{name} remporte la partie', { name: settings.names[w] });
  const side = (p: DamesPlayer) => {
    const left = damesCount(game.board, p);
    return (
      <View style={[styles.finalSide, w === p && styles.finalWinner]}>
        <AvatarBadge avatar={settings.avatars[p]} size={52} />
        <Text style={[styles.finalName, w === p && styles.finalNameWin]} numberOfLines={1}>
          {settings.names[p]}
        </Text>
        <View style={styles.finalScoreRow}>
          <DamesPiece piece={p === 0 ? 'w' : 'b'} size={26} />
          <Text style={styles.finalScore}>{taken(game.board, p)}</Text>
        </View>
        <Text style={styles.finalSub}>{tn(taken(game.board, p), 'pièce prise', 'pièces prises')}</Text>
        <Text style={styles.finalSub}>
          {tn(left.men, '{n} pion', '{n} pions')}
          {left.kings > 0 ? ` · ${tn(left.kings, '{n} dame', '{n} dames')}` : ''}
        </Text>
      </View>
    );
  };
  return (
    <ScrollView contentContainerStyle={[styles.results, desktop && styles.column]}>
      <Appear>
        <Text style={styles.trophy}>{w === null ? '🤝' : robot !== null && w === robot ? '🤖' : '🏆'}</Text>
        <Text style={styles.winner}>{headline}</Text>
        <Text style={styles.resultsSub}>{endReason(game, settings.names)}</Text>
        <Text style={styles.resultsSub}>
          {tn(game.plies, '{n} coup joué', '{n} coups joués')}
          {robot !== null
            ? ` · ${t('robot {level}', { level: t(DAMES_LEVEL_LABELS[settings.level]).toLowerCase() })}`
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

/** A game at an online table: seat 0 plays White, seat 1 Black; Black sees the board turned. */
export function DamesOnlineBoard({
  view,
  mySeat,
  seats,
  deadline,
  now,
  over,
  busy,
  error,
  onMove,
  onLeave,
}: OnlineBoardProps<DamesOnlineState>) {
  const game = view.game;
  const desktop = useDesktop();
  const finished = damesFinished(game);
  const myTurn = !finished && game.current === mySeat;
  const seated = mySeat === 0 || mySeat === 1;
  const settings: Settings = {
    names: [seats[0]?.name ?? PLAYER_NAMES[0], seats[1]?.name ?? PLAYER_NAMES[1]],
    avatars: [seats[0]?.avatar ?? defaultAvatar(0), seats[1]?.avatar ?? ROBOT_AVATAR],
    vsBot: false,
    level: 'moyen',
    human: 0,
  };
  const sub = (p: DamesPlayer) =>
    seats[p]?.bot
      ? t('Robot')
      : p === mySeat
        ? t('Toi · {color}', { color: PLAYER_NAMES[p] })
        : PLAYER_NAMES[p];
  const current = seats[game.current];
  const [showResults, setShowResults] = useState(over);

  // Sounds follow what happens at the table, whoever played.
  const last = useRef(game);
  useEffect(() => {
    const before = last.current;
    last.current = game;
    if (game === before || game.plies === before.plies) return;
    moveSound(game);
    const wait = moveTime(game);
    if (finished && !damesFinished(before)) {
      const id = setTimeout(() => {
        if (game.draw) sounds.chips();
        else if (game.winner === mySeat || !seated) sounds.win();
        else sounds.lose();
      }, wait + 200);
      return () => clearTimeout(id);
    }
    if (myTurn) {
      const id = setTimeout(() => sounds.myTurn(), wait);
      return () => clearTimeout(id);
    }
  }, [game]);
  useEffect(() => {
    if (!over) return;
    const id = setTimeout(() => setShowResults(true), moveTime(game) + END_DELAY);
    return () => clearTimeout(id);
  }, [over]);

  if (over && showResults)
    return (
      <Results
        game={game}
        settings={settings}
        robot={null}
        me={mySeat}
        onHome={onLeave}
        homeLabel={t('Quitter la table')}
      />
    );

  const prompt = finished
    ? game.draw
      ? endLine(game, settings.names, null)
      : game.winner === mySeat
        ? t('🏆 Tu as gagné !')
        : t('🏆 {name} gagne !', { name: settings.names[game.winner!] })
    : myTurn
      ? t('À toi de jouer !')
      : current?.bot
        ? t('🤖 {name} réfléchit…', { name: settings.names[game.current] })
        : t('{name} joue…', { name: settings.names[game.current] });

  return (
    <GameLayout
      top={
        <>
          <TopBar onBack={onLeave} backLabel={t('← Quitter')}>
            <Text style={styles.round}>{t('Coup {n}', { n: Math.floor(game.plies / 2) + 1 })}</Text>
          </TopBar>
          {!desktop && <Scoreboard game={game} settings={settings} subs={[sub(0), sub(1)]} />}
          {deadline && !finished && current && !current.bot && (
            <TurnTimer deadline={deadline} now={now} name={myTurn ? t('Toi') : current.name} seconds={60} />
          )}
        </>
      }
      table={({ width, height }) => (
        <BoardArea
          desktop={desktop}
          game={game}
          settings={settings}
          subs={[sub(0), sub(1)]}
          width={width}
          height={height}
          flipped={mySeat === 1}
          canPlay={myTurn && !busy}
          onMove={(m) => onMove({ type: 'move', from: m.from, path: m.path })}
          prompt={prompt}
        />
      )}
      bottom={
        <View style={[styles.onlineBottom, desktop && styles.bottomDesktop]}>
          {error && <Text style={styles.onlineError}>{error}</Text>}
          <Text style={styles.help}>
            {finished
              ? t('Fin de la partie')
              : myTurn
                ? t('Touche une de tes pièces, puis la case où l’envoyer.')
                : seated
                  ? t('Attends ton tour : tu joues les {color}.', {
                      color: PLAYER_NAMES[mySeat as DamesPlayer].toLowerCase(),
                    })
                  : t('Tu regardes la partie.')}
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  flex: { flex: 1 },
  crown: {
    color: CROWN,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 2,
  },

  // Rules and home card
  ruleCross: { color: '#ff4d3d', fontSize: 15, fontWeight: '900' },
  ruleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
    boxShadow: '0 0 4px rgba(0,0,0,0.5)',
  },
  artBoard: { borderRadius: 8, overflow: 'hidden', boxShadow: '0 10px 22px rgba(0,0,0,0.55)' },

  // Setup
  setup: { padding: 20, paddingTop: 40, paddingBottom: 30 },
  /** On a computer, forms and results stay a readable column in the middle of the window. */
  column: { width: '100%', maxWidth: COLUMN_MAX_WIDTH, alignSelf: 'center' },
  titlePieces: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 8 },
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
  scorePiece: { position: 'absolute', right: -6, bottom: -5 },
  scoreText: { flex: 1, minWidth: 0 },
  scoreTextRight: { alignItems: 'flex-end' },
  scoreName: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  scoreNameActive: { color: colors.gold, fontWeight: '800' },
  scoreSub: { color: colors.muted, fontSize: 10, fontWeight: '600', opacity: 0.8 },
  scoreTaken: { alignItems: 'center', minWidth: 30 },
  scoreValue: { color: colors.text, fontSize: 20, fontWeight: '900', lineHeight: 22 },
  scoreTakenLabel: { color: colors.muted, fontSize: 9, fontWeight: '700' },

  frame: { overflow: 'hidden', boxShadow: '0 12px 28px rgba(0,0,0,0.55), 0 3px 0 rgba(0,0,0,0.35)' },
  grain: { left: 0, height: 1, backgroundColor: 'rgba(0,0,0,0.12)' },
  inner: { boxShadow: '0 0 0 2px rgba(0,0,0,0.35), inset 0 0 12px rgba(0,0,0,0.25)' },
  dark: {
    backgroundColor: DARK_SQUARE,
    boxShadow: `inset 0 0 6px ${DARK_SQUARE_EDGE}`,
  },
  lastSquare: { backgroundColor: 'rgba(255,214,90,0.28)' },
  selSquare: { backgroundColor: 'rgba(255,214,90,0.45)' },
  number: {
    position: 'absolute',
    left: 3,
    top: 1,
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,240,220,0.35)',
  },
  mustRing: { borderWidth: 3, borderColor: colors.gold, boxShadow: `0 0 10px ${colors.gold}` },
  target: { alignItems: 'center', justifyContent: 'center', zIndex: 6 },
  targetDot: {
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 8px rgba(0,0,0,0.5)',
    opacity: 0.92,
  },
  targetRing: {
    borderWidth: 3,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  stepNumber: { color: colors.onGold, fontWeight: '900' },
  cross: {
    color: '#ff4d3d',
    textAlign: 'center',
    fontWeight: '900',
    zIndex: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  pointer: { cursor: 'pointer' },
  prompt: {
    marginTop: 8,
    height: 24,
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
    maxWidth: '100%',
  },
  promptLarge: { fontSize: 20, height: 30, marginTop: 12 },
  promptDone: { color: colors.gold },
  bottomBox: { minHeight: 40, justifyContent: 'center' },
  bottomDesktop: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  desktopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  side: {
    width: SIDE_W,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 22,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  sidePiece: { position: 'absolute', right: -10, bottom: -6 },
  sideName: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 8, maxWidth: '100%' },
  sideSub: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  sideScore: { color: colors.text, fontSize: 52, fontWeight: '900', lineHeight: 60, marginTop: 6 },
  sideScoreLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  pile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 120,
    rowGap: 4,
    marginTop: 8,
    minHeight: 18,
  },
  sideLeft: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 6 },
  help: { color: colors.muted, textAlign: 'center', fontSize: 13 },
  onlineBottom: { minHeight: 40, justifyContent: 'center' },
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
  finalScore: { color: colors.text, fontSize: 32, fontWeight: '900' },
  finalSub: { color: colors.muted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  finalDash: { color: colors.muted, fontSize: 28, fontWeight: '900' },
});
