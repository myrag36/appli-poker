import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
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
  type ChessLevel,
  type ChessMove,
  type ChessOnlineState,
  type ChessPlayer,
  type ChessPromo,
  type ChessResult,
  type ChessState,
  CHESS_LEVEL_LABELS,
  chessBotMove,
  chessKingSquare,
  chessLegalMoves,
  chessNewGame,
  chessPlay,
  chessResign,
  chessSquareIndex,
  chessSquareName,
  defaultAvatar,
} from '@appli-poker/engine';
import { AvatarBadge, AvatarPicker, type SeatAvatar } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { GameLayout } from '../components/GameLayout';
import { Pill } from '../components/LevelPicker';
import { Appear } from '../components/Motion';
import { OnlineButton } from '../components/OnlineButton';
import { type GameRules, RuleExample, RulesButton } from '../components/Rules';
import { TopBar } from '../components/TopBar';
import { TurnTimer } from '../components/TurnTimer';
import type { OnlineBoardProps } from '../online-games/types';
import { sounds } from '../feedback';
import { reportFeat, reportLocalGame, useFeat } from '../online/progress';
import { deviceRng } from '../rng';
import { colors, gradients } from '../theme';
import { COLUMN_MAX_WIDTH, useDesktop } from '../layout';
import { t, tn } from '../i18n';

const native = Platform.OS !== 'web';

/** How long the robot seems to think before its move is searched, in ms. */
const BOT_DELAY = 450;

// ---------------------------------------------------------------------------
// Colors and pieces

/** Mixes two '#rrggbb' colors: 0 gives the first, 1 the second. */
function mix(a: string, b: string, k: number): string {
  const parse = (c: string) => {
    const m = /^#([0-9a-f]{6})$/i.exec(c);
    const n = m ? parseInt(m[1], 16) : 0x777777;
    return [n >> 16, (n >> 8) & 255, n & 255];
  };
  const x = parse(a);
  const y = parse(b);
  return `#${x
    .map((v, i) => Math.round(v + (y[i] - v) * k))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

/** The board takes the colors of the theme: dark squares from the felt, light squares warm ivory. */
const LIGHT = mix('#efe4cc', colors.gold, 0.08);
const DARK = mix(colors.felt, '#d8d2b8', 0.38);
const FRAME = gradients.wood;
const LAST = 'rgba(255, 214, 64, 0.42)';
const SELECTED = 'rgba(255, 196, 0, 0.62)';
const DOT = 'rgba(20, 16, 10, 0.28)';

const FILLED: Record<string, string> = {
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  // The text form, never the emoji.
  p: '♟︎',
};
const OUTLINED: Record<string, string> = {
  k: '♔',
  q: '♕',
  r: '♖',
  b: '♗',
  n: '♘',
  p: '♙',
};
const PIECE_FONT =
  Platform.OS === 'web'
    ? '"DejaVu Sans", "Segoe UI Symbol", "Apple Symbols", "Noto Sans Symbols 2", "Arial Unicode MS", serif'
    : undefined;

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const isWhite = (piece: string) => piece !== '.' && piece === piece.toUpperCase();

/**
 * A chess piece drawn from the font's glyphs: the solid shape filled, the outline drawn over it.
 * `onDark`: a black piece on a dark panel gets a light halo so it stays readable.
 */
export function ChessPiece({ piece, size, onDark }: { piece: string; size: number; onDark?: boolean }) {
  const white = isWhite(piece);
  const kind = piece.toLowerCase();
  const font = { fontSize: Math.round(size * 0.86), lineHeight: size, width: size, height: size };
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Text
        style={[styles.glyph, font, white ? styles.whiteFill : onDark ? styles.blackHalo : styles.blackFill]}
      >
        {FILLED[kind]}
      </Text>
      <Text style={[styles.glyph, font, white ? styles.whiteLine : styles.blackLine]}>{OUTLINED[kind]}</Text>
    </View>
  );
}

/** Figurine notation: the piece letters of a move drawn as small pieces (♘f3, exd5, O-O). */
const figurine = (san: string) => san.replace(/[KQRBN]/g, (c) => OUTLINED[c.toLowerCase()]);

// ---------------------------------------------------------------------------
// Settings

type SideChoice = 'blancs' | 'noirs' | 'hasard';

interface Settings {
  /** Against the robot: [the player, the robot]; at two: [white, black]. */
  names: [string, string];
  avatars: [Avatar, Avatar];
  vsBot: boolean;
  level: ChessLevel;
  /** The color the player takes against the robot. */
  side: SideChoice;
}

const ROBOT_NAME = 'Robby';
const ROBOT_AVATAR: Avatar = { emoji: '🤖', color: defaultAvatar(1).color };

const LEVEL_HINTS: Record<ChessLevel, string> = {
  facile: t('Il connaît les règles, mais il joue souvent un peu n’importe quoi.'),
  moyen: t('Il voit les prises et les menaces simples. Une bonne partie pour progresser.'),
  difficile: t('Il calcule plusieurs coups à l’avance et ne pardonne pas grand-chose.'),
};

export function EchecsScreen({ onBack, onOnline }: { onBack: () => void; onOnline?: () => void }) {
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
    />
  );
}

// ---------------------------------------------------------------------------
// Rules

/**
 * A small board for the rules, drawn from rows of text (rank 8 first): '.' empty, piece letters
 * as on the board, '*' a square the piece may go to, 'x' a piece it may take.
 */
const MiniChess = ({ rows, label }: { rows: string[]; label?: string }) => {
  const cell = 22;
  return (
    <RuleExample label={label}>
      <View style={{ borderRadius: 4, overflow: 'hidden', borderWidth: 2, borderColor: '#5a3219' }}>
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {row.split('').map((ch, c) => (
              <View
                key={c}
                style={{
                  width: cell,
                  height: cell,
                  backgroundColor: (r + c) % 2 === 0 ? LIGHT : DARK,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {ch === '*' ? (
                  <View style={[styles.dot, { width: 7, height: 7, borderRadius: 4 }]} />
                ) : ch !== '.' ? (
                  <ChessPiece piece={ch} size={cell} />
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </View>
    </RuleExample>
  );
};

export const ECHECS_RULES: GameRules = {
  game: 'echecs',
  title: t('Échecs'),
  goal: t('Mets le roi adverse échec et mat : attaqué, sans aucun moyen d’y échapper.'),
  steps: [
    {
      icon: '♟️',
      title: t('Les pions'),
      text: t(
        'Un pion avance tout droit d’une case, ou de deux à son premier coup. Il prend en diagonale, une case devant lui.',
      ),
      visual: <MiniChess rows={['.*.', 'p*n', '.P.']} label={t('Avancer ou prendre')} />,
    },
    {
      icon: '♞',
      title: t('Les pièces'),
      text: t(
        'La tour va en ligne droite, le fou en diagonale, la dame dans les deux sens, le roi d’une seule case. Le cavalier saute en « L » par-dessus les autres.',
      ),
      visual: <MiniChess rows={['.*.*.', '*...*', '..N..', '*...*', '.*.*.']} label={t('Le cavalier')} />,
    },
    {
      icon: '⚠️',
      title: t('Échec et mat'),
      text: t(
        'Un roi attaqué est « en échec » : il faut le sauver tout de suite. Si c’est impossible, c’est échec et mat et la partie est perdue.',
      ),
      visual: <MiniChess rows={['......kR', '.....ppp']} label={t('Mat du couloir')} />,
    },
    {
      icon: '🏰',
      title: t('Le roque'),
      text: t(
        'Le roi va de deux cases vers une tour, qui passe de l’autre côté. Seulement si aucun des deux n’a bougé, sans pièce entre eux, et sans que le roi soit en échec ou traverse une case attaquée.',
      ),
      visual: <MiniChess rows={['....K..R']} label={t('Avant')} />,
    },
    {
      icon: '✨',
      title: t('Promotion et prise en passant'),
      text: t(
        'Un pion qui atteint la dernière rangée devient la pièce de ton choix, souvent une dame. Un pion qui avance de deux cases à côté d’un pion adverse peut être pris « en passant », au coup suivant seulement.',
      ),
    },
    {
      icon: '🤝',
      title: t('Partie nulle'),
      text: t(
        'Pat (plus aucun coup permis sans être en échec), même position trois fois, 50 coups sans prise ni coup de pion, ou plus assez de pièces pour mater.',
      ),
    },
  ],
  tip: t('Sors tes cavaliers et tes fous tôt, et roque vite pour mettre ton roi à l’abri.'),
};

/** The picture of the game's card on the home screen: a corner of a board with a few pieces. */
export function EchecsArt({ cell = 40 }: { cell?: number }) {
  const rows = ['.q.k', 'p.N.', '.B.P'];
  return (
    <View style={[styles.art, { transform: [{ rotate: '-5deg' }] }]} pointerEvents="none">
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.split('').map((ch, c) => (
            <View
              key={c}
              style={{
                width: cell,
                height: cell,
                backgroundColor: (r + c) % 2 === 0 ? LIGHT : DARK,
              }}
            >
              {ch !== '.' && <ChessPiece piece={ch} size={cell} />}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Setup

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
  const [level, setLevel] = useState<ChessLevel>(initial?.level ?? 'moyen');
  const [side, setSide] = useState<SideChoice>(initial?.side ?? 'blancs');
  const [names, setNames] = useState<[string, string]>(
    initial ? [initial.names[0], initial.vsBot ? '' : initial.names[1]] : ['', ''],
  );
  const [avatars, setAvatars] = useState<[Avatar, Avatar]>(
    initial && !initial.vsBot ? initial.avatars : [initial?.avatars[0] ?? defaultAvatar(0), defaultAvatar(1)],
  );
  const [picking, setPicking] = useState<0 | 1 | null>(null);
  const desktop = useDesktop();

  const cleaned: [string, string] = [
    names[0].trim() || t('Joueur {n}', { n: 1 }),
    vsBot ? ROBOT_NAME : names[1].trim() || t('Joueur {n}', { n: 2 }),
  ];
  const duplicate = cleaned[0] === cleaned[1];

  const playerRow = (i: 0 | 1) => (
    <View key={i}>
      <View style={styles.row}>
        {!vsBot && <ChessPiece piece={i === 0 ? 'K' : 'k'} size={30} onDark />}
        {vsBot && i === 1 ? (
          <>
            <AvatarBadge avatar={ROBOT_AVATAR} size={40} />
            <View style={[styles.input, styles.flex, styles.botRow]}>
              <Text style={styles.botName}>{ROBOT_NAME}</Text>
              <Text style={styles.botTag}>
                {t('Robot · {level}', { level: t(CHESS_LEVEL_LABELS[level]) })}
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

  return (
    <ScrollView
      contentContainerStyle={[styles.setup, desktop && styles.column]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.titlePieces}>
        {['N', 'k', 'Q'].map((p, i) => (
          <View key={p} style={{ transform: [{ translateY: i === 1 ? -6 : 0 }] }}>
            <ChessPiece piece={p} size={44} onDark />
          </View>
        ))}
      </View>
      <Text style={styles.title}>{t('Échecs')}</Text>
      <Text style={styles.subtitle}>{t('64 cases, 32 pièces, un seul roi à mater')}</Text>
      {onOnline && <OnlineButton onPress={onOnline} />}
      <RulesButton rules={ECHECS_RULES} />

      <Text style={styles.section}>{t('Adversaire')}</Text>
      <View style={styles.pills}>
        <Pill label={t('🤖 Contre le robot')} active={vsBot} onPress={() => setVsBot(true)} />
        <Pill label={t('👥 À deux sur ce téléphone')} active={!vsBot} onPress={() => setVsBot(false)} />
      </View>
      {vsBot && (
        <>
          <Text style={styles.section}>{t('Niveau du robot')}</Text>
          <View style={styles.pills}>
            {(['facile', 'moyen', 'difficile'] as ChessLevel[]).map((l) => (
              <Pill
                key={l}
                label={t(CHESS_LEVEL_LABELS[l])}
                active={level === l}
                onPress={() => setLevel(l)}
              />
            ))}
          </View>
          <Text style={styles.hint}>{LEVEL_HINTS[level]}</Text>
          <Text style={styles.section}>{t('Tes pièces')}</Text>
          <View style={styles.pills}>
            <Pill label={t('♔ Blancs')} active={side === 'blancs'} onPress={() => setSide('blancs')} />
            <Pill label={t('♚ Noirs')} active={side === 'noirs'} onPress={() => setSide('noirs')} />
            <Pill label={t('🎲 Au hasard')} active={side === 'hasard'} onPress={() => setSide('hasard')} />
          </View>
        </>
      )}

      <Text style={styles.section}>{t('Joueurs')}</Text>
      {playerRow(0)}
      {playerRow(1)}
      <Text style={styles.hint}>
        {vsBot
          ? t('Les blancs commencent. Tu peux annuler ton dernier coup si tu te trompes.')
          : t('On se passe le téléphone à chaque coup. Le joueur 1 a les blancs et commence.')}
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
            side,
          })
        }
      />
      <Button label={t('Retour')} variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// The board

/** Where a square is drawn, in cells from the top left, for the side at the bottom. */
function place(square: number, flipped: boolean) {
  const f = square & 7;
  const r = square >> 3;
  return { col: flipped ? 7 - f : f, row: flipped ? r : 7 - r };
}

/** The piece that just moved, sliding from its old square. */
function Moving({
  piece,
  size,
  dx,
  dy,
  x,
  y,
}: {
  piece: string;
  size: number;
  dx: number;
  dy: number;
  x: number;
  y: number;
}) {
  const slide = useRef(new Animated.Value(dx || dy ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(slide, {
      toValue: 0,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: native,
    }).start();
  }, [slide]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.abs,
        {
          left: x,
          top: y,
          zIndex: 2,
          transform: [
            { translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
            { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
          ],
        },
      ]}
    >
      <ChessPiece piece={piece} size={size} />
    </Animated.View>
  );
}

function Board({
  game,
  size,
  flipped,
  canMove,
  onMove,
  overlay,
}: {
  game: ChessState;
  /** Width of the whole board, frame included. */
  size: number;
  /** Black at the bottom. */
  flipped: boolean;
  canMove: boolean;
  onMove: (m: ChessMove) => void;
  /** Drawn over the board (the result at the end). */
  overlay?: ReactNode;
}) {
  const desktop = useDesktop();
  const frame = Math.max(5, Math.round(size * 0.018));
  const cell = Math.floor((size - 2 * frame) / 8);
  const inner = cell * 8;
  const legal = useMemo(() => (canMove ? chessLegalMoves(game) : []), [game, canMove]);
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  useEffect(() => {
    setSelected(null);
    setPromo(null);
  }, [game, canMove]);

  // Only a move made while this board is shown slides; a position loaded later just appears.
  const seen = useRef(game.moves.length);
  const animate = game.moves.length === seen.current + 1;
  useEffect(() => {
    seen.current = game.moves.length;
  }, [game.moves.length]);

  const targets = selected ? legal.filter((m) => m.from === selected) : [];
  const xy = (sq: number) => {
    const p = place(sq, flipped);
    return { x: p.col * cell, y: p.row * cell };
  };
  const last = game.lastMove
    ? { from: chessSquareIndex(game.lastMove.from), to: chessSquareIndex(game.lastMove.to) }
    : null;
  const checked = game.check ? chessSquareIndex(chessKingSquare(game, game.turn)) : -1;

  function tap(sq: number) {
    if (!canMove || promo) return;
    const name = chessSquareName(sq);
    if (selected) {
      const moves = legal.filter((m) => m.from === selected && m.to === name);
      if (moves.length > 1) {
        setPromo({ from: selected, to: name });
        return;
      }
      if (moves.length === 1) {
        setSelected(null);
        onMove(moves[0]);
        return;
      }
    }
    const piece = game.board[sq];
    const mine = piece !== '.' && (isWhite(piece) ? 0 : 1) === game.turn;
    if (mine && name !== selected) setSelected(name);
    else {
      if (selected && !mine && name !== selected) sounds.invalid();
      setSelected(null);
    }
  }

  const squares: ReactNode[] = [];
  const marks: ReactNode[] = [];
  const pieces: ReactNode[] = [];
  const coords: ReactNode[] = [];
  let glow: ReactNode = null;
  for (let sq = 0; sq < 64; sq++) {
    const { x, y } = xy(sq);
    const light = ((sq & 7) + (sq >> 3)) % 2 === 1;
    const name = chessSquareName(sq);
    const lit = last && (sq === last.from || sq === last.to);
    squares.push(
      <Pressable
        key={sq}
        accessibilityRole="button"
        accessibilityLabel={name}
        onPress={() => tap(sq)}
        style={[
          styles.abs,
          { left: x, top: y, width: cell, height: cell, backgroundColor: light ? LIGHT : DARK },
          desktop && canMove && styles.pointer,
        ]}
      >
        {lit && <View style={[StyleSheet.absoluteFill, { backgroundColor: LAST }]} />}
        {name === selected && <View style={[StyleSheet.absoluteFill, { backgroundColor: SELECTED }]} />}
      </Pressable>,
    );
    const { col, row } = place(sq, flipped);
    const ink = light ? DARK : LIGHT;
    const fontSize = Math.max(8, Math.round(cell * 0.2));
    if (col === 0)
      coords.push(
        <Text
          key={`r${sq}`}
          pointerEvents="none"
          style={[styles.abs, styles.coord, { left: x + 2, top: y + 1, color: ink, fontSize }]}
        >
          {(sq >> 3) + 1}
        </Text>,
      );
    if (row === 7)
      coords.push(
        <Text
          key={`f${sq}`}
          pointerEvents="none"
          style={[
            styles.abs,
            styles.coord,
            { left: x + cell - fontSize * 0.75 - 2, top: y + cell - fontSize * 1.3, color: ink, fontSize },
          ]}
        >
          {'abcdefgh'[sq & 7]}
        </Text>,
      );
    if (sq === checked)
      glow = (
        <View
          key={`c${sq}`}
          pointerEvents="none"
          style={[
            styles.abs,
            styles.check,
            { left: x + cell * 0.06, top: y + cell * 0.06, width: cell * 0.88, height: cell * 0.88 },
          ]}
        />
      );
    const piece = game.board[sq];
    if (piece === '.') continue;
    if (animate && last && sq === last.to) {
      const from = xy(last.from);
      pieces.push(
        <Moving
          key={`m${game.moves.length}`}
          piece={piece}
          size={cell}
          x={x}
          y={y}
          dx={from.x - x}
          dy={from.y - y}
        />,
      );
    } else
      pieces.push(
        <View key={`p${sq}${piece}`} pointerEvents="none" style={[styles.abs, { left: x, top: y }]}>
          <ChessPiece piece={piece} size={cell} />
        </View>,
      );
  }
  for (const m of targets) {
    if (m.promo && m.promo !== 'q') continue;
    const sq = chessSquareIndex(m.to);
    const { x, y } = xy(sq);
    const capture =
      game.board[sq] !== '.' ||
      (game.board[chessSquareIndex(m.from)].toLowerCase() === 'p' && m.from[0] !== m.to[0]);
    marks.push(
      capture ? (
        <View
          key={`t${sq}`}
          pointerEvents="none"
          style={[
            styles.abs,
            styles.ring,
            {
              left: x + cell * 0.04,
              top: y + cell * 0.04,
              width: cell * 0.92,
              height: cell * 0.92,
              borderWidth: Math.max(3, cell * 0.08),
            },
          ]}
        />
      ) : (
        <View
          key={`t${sq}`}
          pointerEvents="none"
          style={[
            styles.abs,
            styles.dot,
            { left: x + cell * 0.34, top: y + cell * 0.34, width: cell * 0.32, height: cell * 0.32 },
          ]}
        />
      ),
    );
  }

  const mover = game.turn === 0;
  return (
    <View style={[styles.frame, { padding: frame, borderRadius: frame * 1.6 }]}>
      <LinearGradient colors={FRAME} style={[StyleSheet.absoluteFill, { borderRadius: frame * 1.6 }]} />
      <View style={{ width: inner, height: inner }}>
        {squares}
        {/* The check glow sits under the pieces; move dots go over them. */}
        {glow}
        {pieces}
        {marks}
        {coords}
        {promo && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Annuler')}
            onPress={() => setPromo(null)}
            style={[StyleSheet.absoluteFill, styles.promoBack]}
          >
            <View style={styles.promoPanel}>
              <Text style={styles.promoTitle}>{t('Ton pion devient…')}</Text>
              <View style={styles.promoRow}>
                {(['q', 'r', 'b', 'n'] as ChessPromo[]).map((p) => (
                  <Pressable
                    key={p}
                    accessibilityRole="button"
                    accessibilityLabel={PROMO_NAMES[p]}
                    onPress={() => {
                      const m = { from: promo.from, to: promo.to, promo: p };
                      setPromo(null);
                      setSelected(null);
                      onMove(m);
                    }}
                    style={({ pressed }) => [
                      styles.promoChoice,
                      { width: Math.min(cell * 1.15, 74), height: Math.min(cell * 1.15, 74) },
                      pressed && styles.promoPressed,
                    ]}
                  >
                    <ChessPiece piece={mover ? p.toUpperCase() : p} size={Math.min(cell * 1.05, 68)} />
                  </Pressable>
                ))}
              </View>
            </View>
          </Pressable>
        )}
        {overlay}
      </View>
    </View>
  );
}

const PROMO_NAMES: Record<ChessPromo, string> = {
  q: t('Dame'),
  r: t('Tour'),
  b: t('Fou'),
  n: t('Cavalier'),
};

// ---------------------------------------------------------------------------
// Around the board

/** Pieces a player took from the other, the most valuable first, and their material lead. */
function takenBy(game: ChessState, player: ChessPlayer): { pieces: string[]; lead: number } {
  const pieces = game.captured
    .split('')
    .filter((p) => (player === 0 ? !isWhite(p) : isWhite(p)))
    .sort((a, b) => VALUES[b.toLowerCase()] - VALUES[a.toLowerCase()]);
  let material = 0;
  for (const p of game.board) if (p !== '.') material += (isWhite(p) ? 1 : -1) * VALUES[p.toLowerCase()];
  const lead = player === 0 ? material : -material;
  return { pieces, lead: Math.max(0, lead) };
}

interface Side {
  name: string;
  avatar: Avatar | SeatAvatar;
  sub: string;
}

function Captures({ game, player, size }: { game: ChessState; player: ChessPlayer; size: number }) {
  const { pieces, lead } = takenBy(game, player);
  return (
    <View style={styles.captures}>
      {pieces.map((p, i) => (
        <View key={i} style={{ marginRight: -size * 0.38 }}>
          <ChessPiece piece={p} size={size} onDark />
        </View>
      ))}
      {lead > 0 && <Text style={[styles.lead, { marginLeft: size * 0.5 }]}>+{lead}</Text>}
    </View>
  );
}

/** A player above or under the board on a phone: avatar, name, color and the pieces taken. */
function PlayerBar({
  side,
  player,
  game,
  active,
}: {
  side: Side;
  player: ChessPlayer;
  game: ChessState;
  active: boolean;
}) {
  return (
    <View style={[styles.bar, active && styles.barActive]}>
      <View>
        <AvatarBadge avatar={side.avatar} size={32} />
        <View style={styles.barKing}>
          <ChessPiece piece={player === 0 ? 'K' : 'k'} size={18} onDark />
        </View>
      </View>
      <View style={styles.barText}>
        <Text style={[styles.barName, active && styles.barNameActive]} numberOfLines={1}>
          {side.name}
        </Text>
        <Text style={styles.barSub} numberOfLines={1}>
          {side.sub}
        </Text>
      </View>
      <Captures game={game} player={player} size={20} />
    </View>
  );
}

/** Every move of the game in numbered pairs, scrolled to the last one. */
function MoveList({ moves, horizontal }: { moves: string[]; horizontal?: boolean }) {
  const scroll = useRef<ScrollView>(null);
  const pairs: { n: number; white: string; black?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2)
    pairs.push({ n: i / 2 + 1, white: moves[i], black: moves[i + 1] });
  const lastIndex = moves.length - 1;
  if (horizontal)
    return (
      <ScrollView
        ref={scroll}
        testID="coups"
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.strip}
        contentContainerStyle={styles.stripContent}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {moves.length === 0 ? (
          <Text style={styles.stripEmpty}>{t('Les coups joués s’affichent ici.')}</Text>
        ) : (
          pairs.map((p) => (
            <Text key={p.n} style={styles.stripMove}>
              <Text style={styles.moveNumber}>{p.n}. </Text>
              <Text style={2 * p.n - 2 === lastIndex ? styles.moveLast : undefined}>{figurine(p.white)}</Text>
              {p.black ? (
                <Text style={2 * p.n - 1 === lastIndex ? styles.moveLast : undefined}>
                  {' '}
                  {figurine(p.black)}
                </Text>
              ) : null}
            </Text>
          ))
        )}
      </ScrollView>
    );
  return (
    <ScrollView
      ref={scroll}
      testID="coups"
      style={styles.moveList}
      contentContainerStyle={styles.moveListContent}
      onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
    >
      {moves.length === 0 && <Text style={styles.stripEmpty}>{t('Les coups joués s’affichent ici.')}</Text>}
      {pairs.map((p) => (
        <View key={p.n} style={[styles.moveRow, p.n % 2 === 0 && styles.moveRowAlt]}>
          <Text style={styles.moveNumberCol}>{p.n}.</Text>
          <Text style={[styles.moveCell, 2 * p.n - 2 === lastIndex && styles.moveLast]}>
            {figurine(p.white)}
          </Text>
          <Text style={[styles.moveCell, 2 * p.n - 1 === lastIndex && styles.moveLast]}>
            {p.black ? figurine(p.black) : ''}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

/** A player's card beside the board, on a computer. */
function SideCard({
  side,
  player,
  game,
  active,
}: {
  side: Side;
  player: ChessPlayer;
  game: ChessState;
  active: boolean;
}) {
  return (
    <View style={[styles.sideCard, active && styles.barActive]}>
      <View>
        <AvatarBadge avatar={side.avatar} size={46} />
        <View style={styles.sideKing}>
          <ChessPiece piece={player === 0 ? 'K' : 'k'} size={24} onDark />
        </View>
      </View>
      <View style={styles.barText}>
        <Text style={[styles.sideName, active && styles.barNameActive]} numberOfLines={1}>
          {side.name}
        </Text>
        <Text style={styles.barSub} numberOfLines={1}>
          {side.sub}
        </Text>
        <Captures game={game} player={player} size={22} />
      </View>
    </View>
  );
}

/**
 * The board and everything around it. Phone: the opponent above, me below, the moves in a strip.
 * Computer: a big board, with the players and the list of moves in a panel beside it.
 */
function Table({
  game,
  sides,
  bottomPlayer,
  width,
  height,
  canMove,
  onMove,
  overlay,
}: {
  game: ChessState;
  sides: [Side, Side];
  /** The player whose pieces are at the bottom. */
  bottomPlayer: ChessPlayer;
  width: number;
  height: number;
  canMove: boolean;
  onMove: (m: ChessMove) => void;
  overlay?: ReactNode;
}) {
  const desktop = useDesktop();
  const topPlayer: ChessPlayer = bottomPlayer === 0 ? 1 : 0;
  const active = (p: ChessPlayer) => !game.result && game.turn === p;
  const flipped = bottomPlayer === 1;
  if (desktop) {
    const panel = 300;
    const gap = 28;
    const size = Math.floor(Math.min(height, width - panel - gap, 760));
    return (
      <View style={[styles.desktopRow, { gap }]}>
        <Board
          game={game}
          size={size}
          flipped={flipped}
          canMove={canMove}
          onMove={onMove}
          overlay={overlay}
        />
        <View style={[styles.panel, { width: panel, height: size }]}>
          <SideCard side={sides[topPlayer]} player={topPlayer} game={game} active={active(topPlayer)} />
          <View style={styles.panelMoves}>
            <Text style={styles.panelTitle}>{t('Coups joués')}</Text>
            <MoveList moves={game.moves} />
          </View>
          <SideCard
            side={sides[bottomPlayer]}
            player={bottomPlayer}
            game={game}
            active={active(bottomPlayer)}
          />
        </View>
      </View>
    );
  }
  const bars = 2 * 46 + 30 + 12;
  const size = Math.floor(Math.min(width, height - bars, 560));
  return (
    <View style={[styles.phoneColumn, { width: size }]}>
      <PlayerBar side={sides[topPlayer]} player={topPlayer} game={game} active={active(topPlayer)} />
      <Board game={game} size={size} flipped={flipped} canMove={canMove} onMove={onMove} overlay={overlay} />
      <PlayerBar side={sides[bottomPlayer]} player={bottomPlayer} game={game} active={active(bottomPlayer)} />
      <MoveList moves={game.moves} horizontal />
    </View>
  );
}

const DRAW_TEXT: Record<Exclude<ChessResult['reason'], 'mat' | 'abandon'>, string> = {
  pat: t('Pat : plus aucun coup possible sans être en échec.'),
  repetition: t('La même position est revenue trois fois.'),
  cinquante: t('50 coups sans prise ni coup de pion.'),
  materiel: t('Plus assez de pièces pour mater.'),
};

/** The end of the game, shown over the final position. */
function ResultCard({
  result,
  names,
  me,
  moves,
}: {
  result: ChessResult;
  names: [string, string];
  /** The player whose point of view is told (null: two people on one phone, or a spectator). */
  me: ChessPlayer | null;
  moves: number;
}) {
  const winner = result.winner;
  const loser = winner === null ? null : winner === 0 ? 1 : 0;
  let icon = '🤝';
  let title = t('Partie nulle');
  let text = '';
  if (winner !== null && loser !== null) {
    const iWon = me !== null && winner === me;
    const iLost = me !== null && loser === me;
    icon = iLost ? '😔' : '🏆';
    if (result.reason === 'mat') {
      title = iWon ? t('Échec et mat, tu gagnes !') : t('Échec et mat !');
      text = iWon ? '' : t('{name} gagne la partie.', { name: names[winner] });
    } else {
      title = iWon ? t('Tu gagnes !') : t('{name} gagne !', { name: names[winner] });
      text = iLost ? t('Tu as abandonné.') : t('{name} a abandonné.', { name: names[loser] });
    }
  } else text = DRAW_TEXT[result.reason as keyof typeof DRAW_TEXT];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.resultBack]}>
      <Appear>
        <View style={styles.resultCard}>
          <Text style={styles.resultIcon}>{icon}</Text>
          <Text style={styles.resultTitle}>{title}</Text>
          {text ? <Text style={styles.resultText}>{text}</Text> : null}
          <Text style={styles.resultMoves}>
            {tn(Math.ceil(moves / 2), '{n} coup joué', '{n} coups joués')}
          </Text>
        </View>
      </Appear>
    </View>
  );
}

/** Sounds of a move: pieces clacking, a capture, a check. */
function moveSound(before: ChessState, after: ChessState) {
  if (after.captured.length > before.captured.length) sounds.chips();
  else sounds.drop();
  if (after.check && !after.result) setTimeout(() => sounds.reaction(), 120);
}

// ---------------------------------------------------------------------------
// Game

function Match({
  settings,
  onQuit,
  onReplay,
}: {
  settings: Settings;
  onQuit: () => void;
  onReplay: () => void;
}) {
  const [human] = useState<ChessPlayer>(() =>
    settings.side === 'noirs' ? 1 : settings.side === 'hasard' ? (deviceRng(2) as ChessPlayer) : 0,
  );
  const [history, setHistory] = useState<ChessState[]>(() => [chessNewGame()]);
  const [resigning, setResigning] = useState(false);
  const game = history[history.length - 1];
  const desktop = useDesktop();
  const { vsBot } = settings;
  const robot: ChessPlayer = human === 0 ? 1 : 0;
  const botTurn = vsBot && !game.result && game.turn === robot;
  // Names and avatars by color.
  const byColor = (p: ChessPlayer) => (vsBot ? (p === human ? 0 : 1) : p);
  const names: [string, string] = [settings.names[byColor(0)], settings.names[byColor(1)]];
  const sides: [Side, Side] = ([0, 1] as ChessPlayer[]).map((p) => ({
    name: names[p],
    avatar: settings.avatars[byColor(p)],
    sub:
      vsBot && p === robot
        ? t('Robot {level} · {color}', {
            level: t(CHESS_LEVEL_LABELS[settings.level]),
            color: p === 0 ? t('blancs') : t('noirs'),
          })
        : p === 0
          ? t('Blancs')
          : t('Noirs'),
  })) as [Side, Side];

  function play(m: ChessMove) {
    const next = chessPlay(game, m);
    setHistory((h) => [...h, next]);
    setResigning(false);
    moveSound(game, next);
  }

  // The robot moves after a short pause, once the player's piece has landed.
  useEffect(() => {
    if (!botTurn) return;
    const id = setTimeout(() => {
      const m = chessBotMove(game, settings.level, deviceRng);
      const next = chessPlay(game, m);
      setHistory((h) => (h[h.length - 1] === game ? [...h, next] : h));
      moveSound(game, next);
    }, BOT_DELAY);
    return () => clearTimeout(id);
  }, [game, botTurn]);

  // The end of the game: experience, the badge, a sound.
  const reported = useRef(false);
  useEffect(() => {
    if (!game.result || reported.current) return;
    reported.current = true;
    const { winner, reason } = game.result;
    const humanWon = winner !== null && (!vsBot || winner === human);
    reportLocalGame('echecs', humanWon);
    if (humanWon && vsBot && reason === 'mat') reportFeat('echecs');
    const id = setTimeout(() => {
      if (winner === null) sounds.chips();
      else if (humanWon) sounds.win();
      else sounds.lose();
    }, 300);
    return () => clearTimeout(id);
  }, [game.result]);

  // Undo against the robot: back to the last position where it was the player's turn.
  let undoTo = -1;
  if (vsBot)
    for (let i = history.length - 2; i >= 0; i--)
      if (history[i].turn === human && !history[i].result) {
        undoTo = i;
        break;
      }
  function undo() {
    if (undoTo < 0) return;
    reported.current = false;
    setHistory((h) => h.slice(0, undoTo + 1));
    setResigning(false);
  }

  function resign() {
    if (!resigning) {
      setResigning(true);
      return;
    }
    setResigning(false);
    setHistory((h) => [...h, chessResign(game, vsBot ? human : game.turn)]);
  }

  const finished = game.result !== null;
  const prompt = finished
    ? ''
    : botTurn
      ? t('🤖 {name} réfléchit…', { name: names[game.turn] })
      : game.check
        ? vsBot
          ? t('⚠️ Échec ! Protège ton roi.')
          : t('⚠️ {name}, ton roi est en échec !', { name: names[game.turn] })
        : vsBot
          ? t('À toi de jouer !')
          : t('À toi, {name} ({color}) !', {
              name: names[game.turn],
              color: game.turn === 0 ? t('blancs') : t('noirs'),
            });

  return (
    <GameLayout
      top={
        <TopBar onBack={onQuit} backLabel={t('← Quitter')}>
          <Text style={styles.round}>
            {finished ? t('Partie finie') : t('Coup {n}', { n: game.fullmove })}
          </Text>
        </TopBar>
      }
      table={({ width, height }) => (
        <Table
          game={game}
          sides={sides}
          bottomPlayer={vsBot ? human : 0}
          width={width}
          height={height}
          canMove={!botTurn && !finished}
          onMove={play}
          overlay={
            game.result && (
              <ResultCard
                result={game.result}
                names={names}
                me={vsBot ? human : null}
                moves={game.moves.length}
              />
            )
          }
        />
      )}
      bottom={
        <View style={[styles.bottomBox, desktop && styles.bottomDesktop]}>
          {finished ? (
            <View style={styles.buttons}>
              <View style={styles.flex}>
                <Button label={t('Rejouer')} onPress={onReplay} />
              </View>
              {vsBot && undoTo >= 0 && (
                <View style={styles.flex}>
                  <Button label={t('↶ Annuler')} variant="secondary" onPress={undo} />
                </View>
              )}
              <View style={styles.flex}>
                <Button label={t('Réglages')} variant="secondary" onPress={onQuit} />
              </View>
            </View>
          ) : (
            <>
              <Text style={[styles.prompt, game.check && styles.promptCheck]} numberOfLines={1}>
                {prompt}
              </Text>
              <View style={styles.buttons}>
                {vsBot && (
                  <View style={styles.flex}>
                    <Button
                      label={t('↶ Annuler')}
                      variant="secondary"
                      compact
                      disabled={undoTo < 0}
                      onPress={undo}
                    />
                  </View>
                )}
                <View style={styles.flex}>
                  <Button
                    label={resigning ? t('Confirmer l’abandon ?') : t('🏳️ Abandonner')}
                    variant={resigning ? 'danger' : 'secondary'}
                    compact
                    disabled={botTurn}
                    onPress={resign}
                  />
                </View>
              </View>
            </>
          )}
        </View>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Online

/** A game at an online table: seat 0 plays white, seat 1 black; each sees their pieces at the bottom. */
export function EchecsOnlineBoard({
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
}: OnlineBoardProps<ChessOnlineState>) {
  const game = view.game;
  const desktop = useDesktop();
  const seated = mySeat === 0 || mySeat === 1;
  const me: ChessPlayer = mySeat === 1 ? 1 : 0;
  const finished = game.result !== null;
  const myTurn = seated && !finished && game.turn === me;
  const [resigning, setResigning] = useState(false);
  const names: [string, string] = [seats[0]?.name ?? t('Blancs'), seats[1]?.name ?? t('Noirs')];
  const sides: [Side, Side] = ([0, 1] as ChessPlayer[]).map((p) => ({
    name: names[p],
    avatar: seats[p]?.avatar ?? (p === 0 ? defaultAvatar(0) : ROBOT_AVATAR),
    sub: seats[p]?.bot
      ? t('Robot · {color}', { color: p === 0 ? t('blancs') : t('noirs') })
      : seated && p === me
        ? t('Toi · {color}', { color: p === 0 ? t('blancs') : t('noirs') })
        : p === 0
          ? t('Blancs')
          : t('Noirs'),
  })) as [Side, Side];
  const current = seats[game.turn];

  // Sounds follow what happens at the table, whoever played.
  const last = useRef(game);
  useEffect(() => {
    const before = last.current;
    last.current = game;
    setResigning(false);
    if (game === before) return;
    if (game.moves.length > before.moves.length) moveSound(before, game);
    if (game.result && !before.result) {
      const id = setTimeout(() => {
        if (game.result!.winner === null) sounds.chips();
        else if (game.result!.winner === me || !seated) sounds.win();
        else sounds.lose();
      }, 350);
      return () => clearTimeout(id);
    }
    if (myTurn && before.turn !== game.turn) sounds.myTurn();
  }, [game]);
  useFeat('echecs', finished && seated && game.result?.winner === me && game.result.reason === 'mat');

  const prompt = finished
    ? ''
    : myTurn
      ? game.check
        ? t('⚠️ Échec ! Protège ton roi.')
        : t('À toi de jouer !')
      : current?.bot
        ? t('🤖 {name} réfléchit…', { name: names[game.turn] })
        : t('{name} joue…', { name: names[game.turn] });

  return (
    <GameLayout
      top={
        <>
          <TopBar onBack={onLeave} backLabel={t('← Quitter')}>
            <Text style={styles.round}>
              {finished ? t('Partie finie') : t('Coup {n}', { n: game.fullmove })}
            </Text>
          </TopBar>
          {deadline && !finished && current && !current.bot && (
            <TurnTimer deadline={deadline} now={now} name={myTurn ? t('Toi') : current.name} seconds={60} />
          )}
        </>
      }
      table={({ width, height }) => (
        <Table
          game={game}
          sides={sides}
          bottomPlayer={me}
          width={width}
          height={height}
          canMove={myTurn && !busy}
          onMove={(m) => onMove({ type: 'move', ...m })}
          overlay={
            game.result && (
              <ResultCard
                result={game.result}
                names={names}
                me={seated ? me : null}
                moves={game.moves.length}
              />
            )
          }
        />
      )}
      bottom={
        <View style={[styles.bottomBox, desktop && styles.bottomDesktop]}>
          {error && <Text style={styles.onlineError}>{error}</Text>}
          {over || finished ? (
            <Text style={styles.help}>{t('La partie est finie.')}</Text>
          ) : (
            <>
              <Text style={[styles.prompt, myTurn && game.check && styles.promptCheck]} numberOfLines={1}>
                {prompt}
              </Text>
              {seated ? (
                <View style={styles.buttons}>
                  <View style={styles.flex}>
                    <Button
                      label={resigning ? t('Confirmer l’abandon ?') : t('🏳️ Abandonner')}
                      variant={resigning ? 'danger' : 'secondary'}
                      compact
                      disabled={!myTurn || busy}
                      onPress={() => {
                        if (!resigning) setResigning(true);
                        else {
                          setResigning(false);
                          onMove({ type: 'resign' });
                        }
                      }}
                    />
                  </View>
                </View>
              ) : (
                <Text style={styles.help}>{t('Tu regardes la partie.')}</Text>
              )}
            </>
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  flex: { flex: 1 },
  pointer: { cursor: 'pointer' },

  glyph: {
    position: 'absolute',
    left: 0,
    top: 0,
    textAlign: 'center',
    includeFontPadding: false,
    fontFamily: PIECE_FONT,
  },
  whiteFill: { color: '#fffaf0', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 2 },
  whiteLine: { color: '#231a12' },
  blackFill: { color: '#1d1916', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 2 },
  blackHalo: { color: '#1d1916', textShadowColor: 'rgba(255,244,220,0.85)', textShadowRadius: 4 },
  blackLine: { color: '#000000' },

  // Setup
  setup: { padding: 20, paddingTop: 40, paddingBottom: 30 },
  column: { width: '100%', maxWidth: COLUMN_MAX_WIDTH, alignSelf: 'center' },
  titlePieces: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginBottom: 6 },
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

  // Board
  frame: { overflow: 'hidden', boxShadow: '0 10px 28px rgba(0,0,0,0.55)' },
  coord: { fontWeight: '800', opacity: 0.85 },
  dot: { borderRadius: 999, backgroundColor: DOT },
  ring: { borderRadius: 999, borderColor: DOT },
  check: {
    borderRadius: 999,
    backgroundColor: 'rgba(235, 40, 30, 0.55)',
    boxShadow: '0 0 12px 6px rgba(235, 40, 30, 0.55)',
  },
  promoBack: {
    zIndex: 5,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoPanel: {
    backgroundColor: colors.background,
    borderColor: colors.gold,
    borderWidth: 2,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
  },
  promoTitle: { color: colors.text, fontWeight: '800', fontSize: 16 },
  promoRow: { flexDirection: 'row', gap: 8 },
  promoChoice: {
    borderRadius: 12,
    backgroundColor: LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoPressed: { backgroundColor: colors.gold },
  resultBack: {
    zIndex: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  resultCard: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 18,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.gold,
    maxWidth: 300,
    boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
  },
  resultIcon: { fontSize: 40 },
  resultTitle: { color: colors.gold, fontSize: 21, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  resultText: { color: colors.text, fontSize: 14, textAlign: 'center', marginTop: 4 },
  resultMoves: { color: colors.muted, fontSize: 12, marginTop: 6, fontWeight: '700' },

  // Around the board
  round: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  phoneColumn: { alignItems: 'stretch', gap: 3 },
  bar: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  barActive: { borderColor: colors.gold, borderWidth: 2 },
  barKing: { position: 'absolute', right: -6, bottom: -5 },
  barText: { flex: 1, minWidth: 0 },
  barName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  barNameActive: { color: colors.gold, fontWeight: '900' },
  barSub: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  captures: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, overflow: 'hidden' },
  lead: { color: colors.muted, fontWeight: '800', fontSize: 13 },
  strip: { height: 30, flexGrow: 0 },
  stripContent: { alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  stripEmpty: { color: colors.muted, fontSize: 12, fontStyle: 'italic' },
  stripMove: { color: colors.text, fontSize: 14, fontFamily: PIECE_FONT },
  moveNumber: { color: colors.muted, fontWeight: '700' },
  moveLast: { color: colors.gold, fontWeight: '900' },
  desktopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  panel: { gap: 10 },
  panelMoves: {
    flex: 1,
    minHeight: 0,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingTop: 10,
  },
  panelTitle: { color: colors.gold, fontWeight: '800', fontSize: 14, paddingHorizontal: 14, marginBottom: 6 },
  moveList: { flex: 1 },
  moveListContent: { paddingHorizontal: 8, paddingBottom: 8 },
  moveRow: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 6, borderRadius: 6 },
  moveRowAlt: { backgroundColor: 'rgba(255,255,255,0.05)' },
  moveNumberCol: { width: 36, color: colors.muted, fontWeight: '700', fontSize: 15 },
  moveCell: { flex: 1, color: colors.text, fontSize: 16, fontFamily: PIECE_FONT },
  sideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  sideKing: { position: 'absolute', right: -8, bottom: -6 },
  sideName: { color: colors.text, fontSize: 17, fontWeight: '800' },
  bottomBox: { minHeight: 76, justifyContent: 'center', gap: 6 },
  bottomDesktop: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  buttons: { flexDirection: 'row', gap: 8 },
  prompt: { color: colors.text, fontWeight: '800', fontSize: 15, textAlign: 'center' },
  promptCheck: { color: '#ff7b6b' },
  help: { color: colors.muted, textAlign: 'center', fontSize: 13 },
  onlineError: { color: colors.gold, textAlign: 'center', fontSize: 13 },

  // Home card
  art: {
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#5a3219',
    boxShadow: '0 8px 18px rgba(0,0,0,0.5)',
  },
});
