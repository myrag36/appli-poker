import { type ReactNode, useEffect, useRef, useState } from 'react';
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
  type BnBoard,
  type BnLevel,
  type BnOnlineView,
  type BnPlayer,
  type BnShip,
  type BnShot,
  type BnState,
  BN_FLEET,
  BN_LEVEL_LABELS,
  BN_SHIP_NAMES,
  BN_SIZE,
  bnAfloat,
  bnBotShot,
  bnCanPlace,
  bnIsSunk,
  bnNewGame,
  bnOther,
  bnPlace,
  bnPublicBoard,
  bnRandomFleet,
  bnShipCells,
  bnShoot,
  bnShotAt,
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
import { colors } from '../theme';
import { COLUMN_MAX_WIDTH, useDesktop } from '../layout';
import { t, tn } from '../i18n';

const native = Platform.OS !== 'web';

/** How long the robot seems to aim before firing, in ms. */
const BOT_DELAY = 1100;
/** How long a shot's result stays in view before the phone switches to the other grid, in ms. */
const SWITCH_DELAY = 750;
/** Pause between the last shot and the results screen, so the sinking can be seen. */
const END_DELAY = 1800;

const LETTERS = 'ABCDEFGHIJ';
/** "B7": the column letter and the row number of a cell. */
const coord = (x: number, y: number) => `${LETTERS[x]}${y + 1}`;

const WATER: [string, string] = ['#0f5c99', '#08345e'];
const SHIP = '#9fb0c2';
const SHIP_BORDER = '#e3ebf3';
const SUNK = '#6d1d1d';
const SUNK_BORDER = '#ff6b5b';
const HIT = '#ff5a36';
const MISS = 'rgba(220,240,255,0.8)';
const GOOD = 'rgba(122,226,140,0.55)';
const BAD = 'rgba(255,90,80,0.5)';

const LEVEL_HINTS: Record<BnLevel, string> = {
  facile: t('Il tire un peu au hasard et oublie parfois tes navires touchés.'),
  moyen: t('Il quadrille la mer et achève les navires qu’il touche.'),
  difficile: t('Il calcule où ta flotte peut encore se cacher. Bonne chance !'),
};

interface Settings {
  name: string;
  avatar: Avatar;
  level: BnLevel;
}

const ROBOT_NAME = 'Robby';
const ROBOT_AVATAR: Avatar = { emoji: '🤖', color: defaultAvatar(1).color };

export function BatailleScreen({ onBack, onOnline }: { onBack: () => void; onOnline?: () => void }) {
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
// Rules

/** A strip of sea cells for the rules: '.' water, 's' ship, 'o' miss, 'x' hit, 'c' sunk. */
const Strip = ({ cells, label }: { cells: string; label?: string }) => (
  <RuleExample label={label}>
    <View style={{ flexDirection: 'row', gap: 2, padding: 3, borderRadius: 6, backgroundColor: WATER[1] }}>
      {cells.split('').map((c, i) => (
        <View
          key={i}
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c === 's' || c === 'x' ? SHIP : c === 'c' ? SUNK : WATER[0],
            borderWidth: c === 'c' ? 1.5 : 0,
            borderColor: SUNK_BORDER,
          }}
        >
          {c === 'o' && <View style={[styles.missDot, { width: 6, height: 6, borderRadius: 3 }]} />}
          {(c === 'x' || c === 'c') && (
            <View style={[styles.hitDot, { width: 10, height: 10, borderRadius: 5 }]} />
          )}
        </View>
      ))}
    </View>
  </RuleExample>
);

export const BATAILLE_RULES: GameRules = {
  game: 'bataille',
  title: t('Bataille navale'),
  goal: t('Coule les 5 navires de ton adversaire avant qu’il ne coule les tiens.'),
  steps: [
    {
      icon: '🚢',
      title: t('Place ta flotte'),
      text: t(
        'Chacun cache 5 navires sur sa grille de 10 × 10 : porte-avions (5 cases), croiseur (4), contre-torpilleur (3), sous-marin (3) et torpilleur (2). À l’horizontale ou à la verticale, sans chevauchement.',
      ),
      visual: <Strip cells="sssss.ss.." label={t('Un porte-avions et un torpilleur')} />,
    },
    {
      icon: '🎯',
      title: t('Tire chacun ton tour'),
      text: t(
        'Touche une case de la grille adverse. « À l’eau » si elle est vide, « Touché » si un navire s’y trouve.',
      ),
      visual: (
        <>
          <Strip cells="..o.." label={t('À l’eau')} />
          <Strip cells=".sxs." label={t('Touché')} />
        </>
      ),
    },
    {
      icon: '🔥',
      title: t('Coulé !'),
      text: t('Quand toutes les cases d’un navire sont touchées, il coule et apparaît en rouge.'),
      visual: <Strip cells=".ccc." label={t('Coulé')} />,
    },
    {
      icon: '🏆',
      title: t('Victoire'),
      text: t('Le premier qui coule toute la flotte adverse gagne la partie.'),
    },
  ],
  tip: t('Après un touché, tire autour : le navire continue en ligne droite.'),
};

/** The picture of the game's card on the home screen: a patch of sea with a ship under fire. */
export function BatailleArt({ cell = 30 }: { cell?: number }) {
  const ships: BnShip[] = [
    { x: 1, y: 1, size: 4, horizontal: true },
    { x: 5, y: 2, size: 2, horizontal: false },
  ];
  const shots: BnShot[] = [
    { x: 2, y: 1, hit: true },
    { x: 3, y: 1, hit: true },
    { x: 0, y: 3, hit: false },
    { x: 3, y: 3, hit: false },
    { x: 5, y: 0, hit: false },
    { x: 5, y: 2, hit: true },
    { x: 5, y: 3, hit: true, sunk: 2 },
  ];
  const w = 6;
  const h = 4;
  return (
    <View
      style={[styles.sea, { width: w * cell, height: h * cell, transform: [{ rotate: '-4deg' }] }]}
      pointerEvents="none"
    >
      <LinearGradient colors={WATER} style={StyleSheet.absoluteFill} />
      {Array.from({ length: w - 1 }, (_, i) => (
        <View key={`v${i}`} style={[styles.abs, styles.lineV, { left: (i + 1) * cell, height: h * cell }]} />
      ))}
      {Array.from({ length: h - 1 }, (_, i) => (
        <View key={`h${i}`} style={[styles.abs, styles.lineH, { top: (i + 1) * cell, width: w * cell }]} />
      ))}
      {ships.map((s, i) => (
        <View
          key={i}
          style={[
            styles.abs,
            styles.ship,
            i === 1 && styles.shipSunk,
            {
              left: s.x * cell + 3,
              top: s.y * cell + 3,
              width: (s.horizontal ? s.size : 1) * cell - 6,
              height: (s.horizontal ? 1 : s.size) * cell - 6,
              borderRadius: cell * 0.42,
            },
          ]}
        />
      ))}
      {shots.map((s) => (
        <Mark key={`${s.x}-${s.y}`} shot={s} cell={cell} fresh={false} />
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
  const [level, setLevel] = useState<BnLevel>(initial?.level ?? 'moyen');
  const [name, setName] = useState(initial?.name ?? '');
  const [avatar, setAvatar] = useState<Avatar>(initial?.avatar ?? defaultAvatar(0));
  const [picking, setPicking] = useState(false);
  const desktop = useDesktop();
  const cleaned = name.trim() || t('Joueur {n}', { n: 1 });

  return (
    <ScrollView
      contentContainerStyle={[styles.setup, desktop && styles.column]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.titleIcon}>⚓</Text>
      <Text style={styles.title}>{t('Bataille navale')}</Text>
      <Text style={styles.subtitle}>{t('Une grille de 10 × 10, 5 navires à couler')}</Text>
      {onOnline && <OnlineButton onPress={onOnline} />}
      <RulesButton rules={BATAILLE_RULES} />

      <Text style={styles.section}>{t('Niveau du robot')}</Text>
      <View style={styles.pills}>
        {(['facile', 'moyen', 'difficile'] as BnLevel[]).map((l) => (
          <Pill key={l} label={t(BN_LEVEL_LABELS[l])} active={level === l} onPress={() => setLevel(l)} />
        ))}
      </View>
      <Text style={styles.hint}>{LEVEL_HINTS[level]}</Text>

      <Text style={styles.section}>{t('Joueurs')}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Changer l'avatar du joueur {n}", { n: 1 })}
          onPress={() => setPicking(!picking)}
        >
          <AvatarBadge avatar={avatar} size={40} />
        </Pressable>
        <TextInput
          style={[styles.input, styles.flex, styles.nameInput]}
          placeholder={t('Joueur {n}', { n: 1 })}
          placeholderTextColor={colors.muted}
          value={name}
          maxLength={14}
          onChangeText={setName}
        />
      </View>
      {picking && <AvatarPicker value={avatar} onChange={setAvatar} />}
      <View style={styles.row}>
        <AvatarBadge avatar={ROBOT_AVATAR} size={40} />
        <View style={[styles.input, styles.flex, styles.botRow]}>
          <Text style={styles.botName}>{ROBOT_NAME}</Text>
          <Text style={styles.botTag}>{t('Robot · {level}', { level: t(BN_LEVEL_LABELS[level]) })}</Text>
        </View>
      </View>
      <Text style={styles.hint}>
        {t('Tu places ta flotte, puis vous tirez chacun votre tour. Tu tires le premier.')}
      </Text>

      <View style={styles.spacer} />
      <Button label={t('Lancer la partie')} onPress={() => onStart({ name: cleaned, avatar, level })} />
      <Button label={t('Retour')} variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// The grid

/** A shot that just landed: a ring that spreads over the water. */
function Splash({ x, y, cell, hit }: { x: number; y: number; cell: number; hit: boolean }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, {
      toValue: 1,
      duration: 750,
      easing: Easing.out(Easing.quad),
      useNativeDriver: native,
    }).start();
  }, [a]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.abs,
        {
          left: x * cell,
          top: y * cell,
          width: cell,
          height: cell,
          borderRadius: cell / 2,
          borderWidth: 3,
          borderColor: hit ? HIT : '#bfe6ff',
          opacity: a.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2.4] }) }],
        },
      ]}
    />
  );
}

/** The mark of a shot: a white dot in the water, a red burst on a ship. Pops in when fresh. */
function Mark({ shot, cell, fresh }: { shot: BnShot; cell: number; fresh: boolean }) {
  const pop = useRef(new Animated.Value(fresh ? 0 : 1)).current;
  useEffect(() => {
    if (fresh)
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: native }).start();
  }, [pop]);
  const size = shot.hit ? cell * 0.56 : cell * 0.26;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.abs,
        shot.hit ? styles.hitDot : styles.missDot,
        {
          left: shot.x * cell + (cell - size) / 2,
          top: shot.y * cell + (cell - size) / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          transform: [{ scale: pop }],
        },
      ]}
    />
  );
}

interface GridProps {
  cell: number;
  /** Ships to draw: my whole fleet, or only the sunk ships of the other one. */
  ships: BnShip[];
  shots: BnShot[];
  /** The last shot fired at this grid, animated. */
  last?: BnShot | null;
  /** A tap on a cell (placing or firing), with the spoken label of each cell. */
  onCell?: (x: number, y: number) => void;
  cellLabel?: (x: number, y: number) => string;
  /** Cells that may not be tapped (already shot). */
  blocked?: (x: number, y: number) => boolean;
  /** A ship being placed, under the pointer, green when it fits. */
  ghost?: { ship: BnShip; ok: boolean } | null;
  onHover?: (x: number, y: number) => void;
  /** Gold frame: this is the grid to fire at. */
  active?: boolean;
  /** Ship being moved during the placement, drawn in gold. */
  selected?: BnShip | null;
}

function Grid({
  cell,
  ships,
  shots,
  last,
  onCell,
  cellLabel,
  blocked,
  ghost,
  onHover,
  active,
  selected,
}: GridProps) {
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const size = BN_SIZE * cell;
  const font = Math.max(9, Math.min(14, cell * 0.42));
  const lastKey = last ? `${last.x}-${last.y}-${shots.length}` : '';
  const shipBox = (s: BnShip, inset: number) => ({
    left: s.x * cell + inset,
    top: s.y * cell + inset,
    width: (s.horizontal ? s.size : 1) * cell - 2 * inset,
    height: (s.horizontal ? 1 : s.size) * cell - 2 * inset,
    borderRadius: cell * 0.42,
  });
  const canAim = (x: number, y: number) => !!onCell && !(blocked && blocked(x, y));

  return (
    <View style={{ width: size + cell, height: size + cell }}>
      {/* Column letters and row numbers. */}
      {Array.from({ length: BN_SIZE }, (_, i) => (
        <View
          key={`l${i}`}
          style={[styles.abs, styles.label, { left: cell + i * cell, top: 0, width: cell, height: cell }]}
        >
          <Text style={[styles.labelText, { fontSize: font }]}>{LETTERS[i]}</Text>
        </View>
      ))}
      {Array.from({ length: BN_SIZE }, (_, i) => (
        <View
          key={`n${i}`}
          style={[styles.abs, styles.label, { left: 0, top: cell + i * cell, width: cell, height: cell }]}
        >
          <Text style={[styles.labelText, { fontSize: font }]}>{i + 1}</Text>
        </View>
      ))}
      <View
        style={[
          styles.abs,
          styles.sea,
          active && styles.seaActive,
          { left: cell, top: cell, width: size, height: size },
        ]}
      >
        <LinearGradient colors={WATER} style={StyleSheet.absoluteFill} />
        {/* Grid lines. */}
        {Array.from({ length: BN_SIZE - 1 }, (_, i) => (
          <View key={`v${i}`} style={[styles.abs, styles.lineV, { left: (i + 1) * cell, height: size }]} />
        ))}
        {Array.from({ length: BN_SIZE - 1 }, (_, i) => (
          <View key={`h${i}`} style={[styles.abs, styles.lineH, { top: (i + 1) * cell, width: size }]} />
        ))}
        {hover && canAim(hover.x, hover.y) && !ghost && (
          <View
            pointerEvents="none"
            style={[
              styles.abs,
              styles.aim,
              { left: hover.x * cell, top: hover.y * cell, width: cell, height: cell },
            ]}
          />
        )}
        {ships.map((s, i) => {
          const sunk = bnIsSunk({ shots }, s);
          return (
            <View
              key={`s${i}-${s.x}-${s.y}`}
              pointerEvents="none"
              style={[
                styles.abs,
                styles.ship,
                sunk && styles.shipSunk,
                selected === s && styles.shipSelected,
                shipBox(s, Math.max(2, cell * 0.08)),
              ]}
            />
          );
        })}
        {ghost &&
          bnShipCells(ghost.ship)
            .filter(([x, y]) => x < BN_SIZE && y < BN_SIZE)
            .map(([x, y]) => (
              <View
                key={`g${x}-${y}`}
                pointerEvents="none"
                style={[
                  styles.abs,
                  { left: x * cell, top: y * cell, width: cell, height: cell },
                  { backgroundColor: ghost.ok ? GOOD : BAD },
                ]}
              />
            ))}
        {shots.map((s) => (
          <Mark
            key={`m${s.x}-${s.y}`}
            shot={s}
            cell={cell}
            fresh={!!last && last.x === s.x && last.y === s.y}
          />
        ))}
        {last && <Splash key={lastKey} x={last.x} y={last.y} cell={cell} hit={last.hit} />}
        {/* Touch layer: one zone per cell. */}
        {onCell &&
          Array.from({ length: BN_SIZE * BN_SIZE }, (_, i) => {
            const x = i % BN_SIZE;
            const y = Math.floor(i / BN_SIZE);
            const ok = canAim(x, y);
            return (
              <Pressable
                key={`c${i}`}
                accessibilityRole="button"
                accessibilityLabel={cellLabel?.(x, y)}
                disabled={!ok}
                onHoverIn={() => {
                  setHover({ x, y });
                  onHover?.(x, y);
                }}
                onPress={() => onCell(x, y)}
                style={[
                  styles.abs,
                  ok && styles.pointer,
                  { left: x * cell, top: y * cell, width: cell, height: cell },
                ]}
              />
            );
          })}
      </View>
    </View>
  );
}

/** The fleet of a grid: a little bar per ship, crossed out once sunk. */
function FleetStatus({ shots, compact }: { shots: BnShot[]; compact?: boolean }) {
  const afloat = bnAfloat({ shots });
  const left = [...afloat];
  const sq = compact ? 7 : 10;
  return (
    <View style={[styles.fleet, compact && styles.fleetCompact]}>
      {BN_FLEET.map((size, i) => {
        const k = left.indexOf(size);
        const sunk = k < 0;
        if (!sunk) left.splice(k, 1);
        return (
          <View key={i} style={[styles.fleetShip, sunk && styles.fleetSunk]}>
            {Array.from({ length: size }, (_, j) => (
              <View
                key={j}
                style={[
                  styles.fleetCell,
                  { width: sq, height: sq },
                  sunk && { backgroundColor: SUNK_BORDER },
                ]}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Placement

/** The grid and the ships to place on it: tap a ship, then a cell; tap a placed ship to move it. */
function Placement({
  top,
  busy,
  onReady,
}: {
  top: ReactNode;
  busy?: boolean;
  onReady: (ships: BnShip[]) => void;
}) {
  const desktop = useDesktop();
  const [ships, setShips] = useState<(BnShip | null)[]>(() => BN_FLEET.map(() => null));
  const [selected, setSelected] = useState<number | null>(0);
  const [horizontal, setHorizontal] = useState(true);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const placed = ships.filter((s): s is BnShip => s !== null);
  const ready = placed.length === BN_FLEET.length;

  /** The selected ship at a cell, pushed back inside the grid when it would stick out. */
  function candidate(x: number, y: number, i: number): BnShip {
    const size = BN_FLEET[i];
    return horizontal
      ? { x: Math.min(x, BN_SIZE - size), y, size, horizontal }
      : { x, y: Math.min(y, BN_SIZE - size), size, horizontal };
  }
  const others = (i: number) => ships.filter((s, k): s is BnShip => s !== null && k !== i);
  const shipAt = (x: number, y: number) =>
    ships.findIndex((s) => s !== null && bnShipCells(s).some(([cx, cy]) => cx === x && cy === y));

  function tap(x: number, y: number) {
    const at = shipAt(x, y);
    if (at >= 0 && (selected === null || ships[selected] === null || at !== selected)) {
      // Pick the ship up again, to move or turn it.
      const s = ships[at]!;
      setShips(ships.map((v, k) => (k === at ? null : v)));
      setSelected(at);
      setHorizontal(s.horizontal);
      sounds.card();
      return;
    }
    if (selected === null) return;
    const ship = candidate(x, y, selected);
    if (!bnCanPlace(others(selected), ship)) {
      sounds.fold();
      return;
    }
    const next = ships.map((v, k) => (k === selected ? ship : v));
    setShips(next);
    const free = next.findIndex((s) => s === null);
    setSelected(free >= 0 ? free : null);
    sounds.chips();
  }

  function shuffle() {
    setShips(bnRandomFleet(deviceRng));
    setSelected(null);
    sounds.chips();
  }

  function clear() {
    setShips(BN_FLEET.map(() => null));
    setSelected(0);
  }

  const ghost =
    hover && selected !== null && ships[selected] === null
      ? (() => {
          const ship = candidate(hover.x, hover.y, selected);
          return { ship, ok: bnCanPlace(others(selected), ship) };
        })()
      : null;

  const dock = (
    <View style={[styles.dock, desktop && styles.dockDesktop]}>
      {BN_FLEET.map((size, i) => {
        const done = ships[i] !== null;
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={t(BN_SHIP_NAMES[i])}
            onPress={() => {
              if (done) {
                setShips(ships.map((v, k) => (k === i ? null : v)));
                setHorizontal(ships[i]!.horizontal);
              }
              setSelected(i);
            }}
            style={[styles.dockShip, selected === i && styles.dockSelected, done && styles.dockDone]}
          >
            <Text style={styles.dockName} numberOfLines={1}>
              {done ? '✓ ' : ''}
              {t(BN_SHIP_NAMES[i])}
            </Text>
            <View style={styles.dockCells}>
              {Array.from({ length: size }, (_, j) => (
                <View key={j} style={[styles.dockCell, selected === i && styles.dockCellSelected]} />
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  const tools = (
    <View style={styles.tools}>
      <View style={styles.flex}>
        <Button label={t('🎲 Au hasard')} variant="secondary" compact onPress={shuffle} />
      </View>
      <View style={styles.flex}>
        <Button
          label={horizontal ? t('↻ Pivoter (—)') : t('↻ Pivoter (|)')}
          variant="secondary"
          compact
          onPress={() => setHorizontal(!horizontal)}
        />
      </View>
      <View style={styles.flex}>
        <Button label={t('Effacer')} variant="secondary" compact onPress={clear} />
      </View>
    </View>
  );

  const help = ready
    ? t('Ta flotte est prête. Touche un navire pour le déplacer.')
    : selected !== null
      ? t('Touche la grille pour poser ton {ship}.', { ship: t(BN_SHIP_NAMES[selected]).toLowerCase() })
      : t('Choisis un navire à placer.');

  return (
    <GameLayout
      top={top}
      table={({ width, height }) => {
        if (desktop) {
          const cell = Math.floor(Math.min(46, (width - 380) / (BN_SIZE + 1), (height - 10) / (BN_SIZE + 1)));
          return (
            <View style={styles.placeDesktop}>
              <Grid
                cell={cell}
                ships={placed}
                shots={[]}
                onCell={tap}
                onHover={(x, y) => setHover({ x, y })}
                cellLabel={(x, y) => t('Poser en {c}', { c: coord(x, y) })}
                ghost={ghost}
              />
              <View style={styles.placeSide}>
                <Text style={styles.placeTitle}>{t('Place ta flotte')}</Text>
                <Text style={[styles.help, styles.helpLeft]}>{help}</Text>
                {dock}
                {tools}
              </View>
            </View>
          );
        }
        const cell = Math.floor(Math.min(36, (width - 4) / (BN_SIZE + 1), (height - 4) / (BN_SIZE + 1)));
        return (
          <Grid
            cell={cell}
            ships={placed}
            shots={[]}
            onCell={tap}
            onHover={(x, y) => setHover({ x, y })}
            cellLabel={(x, y) => t('Poser en {c}', { c: coord(x, y) })}
            ghost={ghost}
          />
        );
      }}
      bottom={
        <View style={styles.placeBottom}>
          {!desktop && (
            <>
              <Text style={styles.help} numberOfLines={1}>
                {help}
              </Text>
              {dock}
              {tools}
            </>
          )}
          <Button
            label={
              ready
                ? t('Prêt, au combat !')
                : tn(BN_FLEET.length - placed.length, 'Place encore {n} navire', 'Place encore {n} navires')
            }
            disabled={!ready || busy}
            onPress={() => onReady(placed.slice().sort((a, b) => b.size - a.size))}
          />
        </View>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// The battle

interface Side {
  name: string;
  avatar: SeatAvatar;
  sub: string;
}

/** What was just announced: the result of the last shot, from my point of view. */
function news(
  game: BnState,
  me: BnPlayer,
  sides: [Side, Side],
): { text: string; tone: 'hit' | 'miss' | 'sunk' } | null {
  const s = game.lastShot;
  if (!s) return null;
  const c = coord(s.x, s.y);
  if (s.by === me) {
    if (s.sunk)
      return { text: t('🔥 Coulé ! Un navire de {n} cases par le fond.', { n: s.sunk }), tone: 'sunk' };
    if (s.hit) return { text: t('💥 Touché en {c} !', { c }), tone: 'hit' };
    return { text: t('🌊 À l’eau en {c}.', { c }), tone: 'miss' };
  }
  const name = sides[s.by].name;
  if (s.sunk)
    return { text: t('🔥 {name} coule ton navire de {n} cases !', { name, n: s.sunk }), tone: 'sunk' };
  if (s.hit) return { text: t('💥 {name} te touche en {c} !', { name, c }), tone: 'hit' };
  return { text: t('🌊 {name} tire en {c} : à l’eau.', { name, c }), tone: 'miss' };
}

function SideCard({
  side,
  board,
  active,
  desktop,
}: {
  side: Side;
  board: BnBoard | null;
  active: boolean;
  desktop?: boolean;
}) {
  const afloat = board ? bnAfloat(board).length : BN_FLEET.length;
  return (
    <View style={[styles.sideCard, active && styles.sideActive, desktop && styles.sideCardDesktop]}>
      <AvatarBadge avatar={side.avatar} size={desktop ? 40 : 30} />
      <View style={styles.flexText}>
        <Text style={[styles.sideName, active && styles.sideNameActive]} numberOfLines={1}>
          {side.name}
        </Text>
        <Text style={styles.sideSub} numberOfLines={1}>
          {desktop ? `${side.sub} · ` : ''}
          {tn(afloat, '{n} navire à flot', '{n} navires à flot')}
        </Text>
      </View>
    </View>
  );
}

function Battle({
  game,
  me,
  sides,
  canShoot,
  onShoot,
  prompt,
  width,
  height,
}: {
  /** The game as this player may see it: the other fleet only shows its sunk ships. */
  game: BnState;
  me: BnPlayer;
  sides: [Side, Side];
  canShoot: boolean;
  onShoot: (x: number, y: number) => void;
  prompt: string;
  width: number;
  height: number;
}) {
  const desktop = useDesktop();
  const other = bnOther(me);
  const mine = game.boards[me];
  const theirs = game.boards[other];
  const theirsPublic = theirs ? bnPublicBoard(theirs) : null;
  const done = game.phase === 'fini';
  // On a phone the big grid follows the game: theirs when I fire, mine when they do.
  const wanted: 'mine' | 'theirs' = game.current === me || done ? 'theirs' : 'mine';
  const [focus, setFocus] = useState<'mine' | 'theirs'>(wanted);
  useEffect(() => {
    const id = setTimeout(() => setFocus(wanted), game.lastShot ? SWITCH_DELAY : 0);
    return () => clearTimeout(id);
  }, [wanted, game.fired[0] + game.fired[1]]);

  const lastOn = (p: BnPlayer) => (game.lastShot && game.lastShot.by !== p ? game.lastShot : null);
  const said = news(game, me, sides);
  const banner = (
    <View style={styles.newsBox}>
      {said ? (
        <Appear key={game.fired[0] + game.fired[1]} from={-10}>
          <Text
            style={[
              styles.news,
              said.tone === 'hit' && styles.newsHit,
              said.tone === 'sunk' && styles.newsSunk,
            ]}
            numberOfLines={2}
          >
            {said.text}
          </Text>
        </Appear>
      ) : (
        <Text style={styles.news}>{t('⚓ Que la bataille commence !')}</Text>
      )}
    </View>
  );
  const shootLabel = (x: number, y: number) => t('Tirer en {c}', { c: coord(x, y) });
  const blocked = (x: number, y: number) => !canShoot || !theirs || !!bnShotAt(theirs, x, y);

  const myGrid = (cell: number) => (
    <Grid cell={cell} ships={mine?.ships ?? []} shots={mine?.shots ?? []} last={lastOn(me)} />
  );
  const theirGrid = (cell: number) => (
    <Grid
      cell={cell}
      ships={theirsPublic?.ships ?? []}
      shots={theirsPublic?.shots ?? []}
      last={lastOn(other)}
      onCell={onShoot}
      cellLabel={shootLabel}
      blocked={blocked}
      active={canShoot}
    />
  );

  if (desktop) {
    const cell = Math.floor(Math.min(44, (width - 80) / 2 / (BN_SIZE + 1), (height - 170) / (BN_SIZE + 1)));
    return (
      <View style={styles.battleDesktop}>
        {banner}
        <View style={styles.boardsRow}>
          <View style={styles.boardCol}>
            <SideCard side={sides[me]} board={mine} active={!done && game.current === me} desktop />
            {myGrid(cell)}
            <FleetStatus shots={mine?.shots ?? []} />
          </View>
          <View style={styles.boardCol}>
            <SideCard side={sides[other]} board={theirs} active={!done && game.current === other} desktop />
            {theirGrid(cell)}
            <FleetStatus shots={theirs?.shots ?? []} />
          </View>
        </View>
        <Text style={[styles.prompt, styles.promptLarge]} numberOfLines={1}>
          {prompt}
        </Text>
      </View>
    );
  }

  // Phone: one big grid, the other small beside the fleets; a tap on the small one swaps them.
  const small = Math.floor(Math.min(15, (width - 150) / (BN_SIZE + 1)));
  const big = Math.floor(
    Math.min(36, (width - 4) / (BN_SIZE + 1), (height - 70 - small * (BN_SIZE + 1)) / (BN_SIZE + 1)),
  );
  const bigMine = focus === 'mine';
  return (
    <View style={styles.battlePhone}>
      {banner}
      <Text style={styles.gridTitle}>
        {bigMine ? t('🚢 Ta flotte') : t('🎯 Flotte de {name}', { name: sides[other].name })}
      </Text>
      {bigMine ? myGrid(big) : theirGrid(big)}
      <View style={styles.miniRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={bigMine ? t('Voir la grille adverse') : t('Voir ma flotte')}
          onPress={() => setFocus(bigMine ? 'theirs' : 'mine')}
          style={styles.mini}
        >
          <View pointerEvents="none">
            {bigMine ? (
              <Grid cell={small} ships={theirsPublic?.ships ?? []} shots={theirsPublic?.shots ?? []} />
            ) : (
              <Grid cell={small} ships={mine?.ships ?? []} shots={mine?.shots ?? []} />
            )}
          </View>
        </Pressable>
        <View style={styles.miniInfo}>
          <Text style={styles.miniLabel}>{t('Ta flotte')}</Text>
          <FleetStatus shots={mine?.shots ?? []} compact />
          <Text style={styles.miniLabel}>{t('Flotte de {name}', { name: sides[other].name })}</Text>
          <FleetStatus shots={theirs?.shots ?? []} compact />
          <Text style={styles.miniHint}>
            {bigMine ? t('↔ Touche pour viser') : t('↔ Touche pour voir ta flotte')}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Local game against the robot

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
  // The robot hides its fleet straight away.
  const [game, setGame] = useState<BnState>(() => bnPlace(bnNewGame(0), 1, bnRandomFleet(deviceRng)));
  const [over, setOver] = useState(false);
  const desktop = useDesktop();
  const done = game.phase === 'fini';
  const botTurn = game.phase === 'tir' && game.current === 1;
  const sides: [Side, Side] = [
    { name: settings.name, avatar: settings.avatar, sub: t('Toi') },
    {
      name: ROBOT_NAME,
      avatar: ROBOT_AVATAR,
      sub: t('Robot {level}', { level: t(BN_LEVEL_LABELS[settings.level]) }),
    },
  ];

  function shoot(x: number, y: number) {
    if (game.phase !== 'tir' || game.current !== 0 || bnShotAt(game.boards[1]!, x, y)) return;
    const next = bnShoot(game, x, y);
    setGame(next);
    shotSound(next);
  }

  // The robot fires after a pause, from what it can see of my grid.
  useEffect(() => {
    if (!botTurn) return;
    const id = setTimeout(() => {
      const { x, y } = bnBotShot(game.boards[0]!, settings.level, deviceRng);
      const next = bnShoot(game, x, y);
      setGame((g) => (g === game ? next : g));
      shotSound(next);
    }, BOT_DELAY + SWITCH_DELAY);
    return () => clearTimeout(id);
  }, [game, botTurn]);

  // The end of the game counts for experience, then the results show up.
  const reported = useRef(false);
  useEffect(() => {
    if (!done || reported.current) return;
    reported.current = true;
    const won = game.winner === 0;
    reportLocalGame('bataille', won);
    if (won) reportFeat('bataille');
    const sound = setTimeout(() => (won ? sounds.win() : sounds.lose()), 500);
    const id = setTimeout(() => setOver(true), END_DELAY);
    return () => {
      clearTimeout(sound);
      clearTimeout(id);
    };
  }, [done]);

  const top = (
    <TopBar onBack={onQuit} backLabel={t('← Quitter')}>
      <Text style={styles.round}>{game.phase === 'placement' ? t('Placement') : t('Bataille navale')}</Text>
    </TopBar>
  );

  if (game.phase === 'placement')
    return (
      <Placement
        top={top}
        onReady={(ships) => {
          setGame(bnPlace(game, 0, ships));
          sounds.myTurn();
        }}
      />
    );

  if (over)
    return (
      <Results
        game={game}
        me={0}
        sides={sides}
        onReplay={onReplay}
        onSettings={onQuit}
        onHome={onHome}
        level={settings.level}
      />
    );

  const prompt = done
    ? game.winner === 0
      ? t('🏆 Tu as coulé toute la flotte !')
      : t('{name} a coulé toute ta flotte…', { name: ROBOT_NAME })
    : botTurn
      ? t('🤖 {name} vise…', { name: ROBOT_NAME })
      : t('À toi de tirer !');

  return (
    <GameLayout
      top={
        <>
          {top}
          {!desktop && (
            <View style={styles.sidesRow}>
              <SideCard side={sides[0]} board={game.boards[0]} active={!done && !botTurn} />
              <SideCard side={sides[1]} board={game.boards[1]} active={!done && botTurn} />
            </View>
          )}
        </>
      }
      table={({ width, height }) => (
        <Battle
          game={game}
          me={0}
          sides={sides}
          canShoot={!botTurn && !done}
          onShoot={shoot}
          prompt={prompt}
          width={width}
          height={height}
        />
      )}
      bottom={
        <View style={[styles.bottomBox, desktop && styles.bottomDesktop]}>
          {!desktop && (
            <Text style={[styles.prompt, done && styles.promptDone]} numberOfLines={1}>
              {prompt}
            </Text>
          )}
          <Text style={styles.help}>
            {botTurn ? t('Le robot prépare son tir…') : t('Touche une case de la grille adverse pour tirer.')}
          </Text>
        </View>
      }
    />
  );
}

/** A sound for the result of a shot. */
function shotSound(game: BnState) {
  const s = game.lastShot;
  if (!s) return;
  if (s.sunk) sounds.chips();
  else if (s.hit) sounds.card();
  else sounds.fold();
}

// ---------------------------------------------------------------------------
// Results

function Results({
  game,
  me,
  sides,
  onReplay,
  onSettings,
  onHome,
  homeLabel,
  level,
}: {
  game: BnState;
  me: BnPlayer;
  sides: [Side, Side];
  onReplay?: () => void;
  onSettings?: () => void;
  onHome: () => void;
  homeLabel?: string;
  level?: BnLevel;
}) {
  const desktop = useDesktop();
  const other = bnOther(me);
  const won = game.winner === me;
  const fired = game.fired[me];
  const hits = game.boards[other]?.shots.filter((s) => s.hit).length ?? 0;
  const accuracy = fired > 0 ? Math.round((hits / fired) * 100) : 0;
  const headline = won
    ? t('Victoire ! Tu as coulé toute la flotte.')
    : t('{name} remporte la bataille', { name: sides[game.winner ?? other].name });
  const cell = desktop ? 26 : 15;
  const final = (p: BnPlayer) => (
    <View style={[styles.finalSide, game.winner === p && styles.finalWinner]}>
      <View style={styles.row}>
        <AvatarBadge avatar={sides[p].avatar} size={32} />
        <Text style={[styles.finalName, game.winner === p && styles.finalNameWin]} numberOfLines={1}>
          {sides[p].name}
        </Text>
      </View>
      <Grid cell={cell} ships={game.boards[p]?.ships ?? []} shots={game.boards[p]?.shots ?? []} />
      <Text style={styles.sideSub}>
        {tn(bnAfloat(game.boards[p] ?? { shots: [] }).length, '{n} navire à flot', '{n} navires à flot')}
      </Text>
    </View>
  );
  return (
    <ScrollView contentContainerStyle={[styles.results, desktop && styles.resultsDesktop]}>
      <Appear>
        <Text style={styles.trophy}>
          {won ? '🏆' : game.winner !== null && sides[game.winner].avatar.emoji === '🤖' ? '🤖' : '⚓'}
        </Text>
        <Text style={styles.winner}>{headline}</Text>
        <Text style={styles.resultsSub}>
          {tn(fired, '{n} tir', '{n} tirs')} · {t('{n} % de précision', { n: accuracy })}
          {level ? ` · ${t('robot {level}', { level: t(BN_LEVEL_LABELS[level]).toLowerCase() })}` : ''}
        </Text>
      </Appear>
      <View style={styles.finalRow}>
        {final(me)}
        {final(other)}
      </View>
      <View style={[styles.resultButtons, desktop && styles.column]}>
        {onReplay && <Button label={t('Rejouer')} onPress={onReplay} />}
        {onSettings && <Button label={t('Changer les réglages')} variant="secondary" onPress={onSettings} />}
        <Button label={homeLabel ?? t('Retour aux jeux')} variant="secondary" onPress={onHome} />
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Online

/** A game at an online table: both place their fleet at once, then seat 0 fires first. */
export function BatailleOnlineBoard({
  view,
  mySeat,
  seats,
  actors,
  deadline,
  now,
  over,
  busy,
  error,
  onMove,
  onLeave,
}: OnlineBoardProps<BnOnlineView>) {
  const game = view.game;
  const desktop = useDesktop();
  const seated = mySeat === 0 || mySeat === 1;
  const me: BnPlayer = mySeat === 1 ? 1 : 0;
  const other = bnOther(me);
  const done = game.phase === 'fini';
  const myTurn = seated && game.phase === 'tir' && game.current === me;
  const side = (p: BnPlayer): Side => ({
    name: seats[p]?.name ?? t('Joueur {n}', { n: p + 1 }),
    avatar: seats[p]?.avatar ?? (p === 0 ? defaultAvatar(0) : ROBOT_AVATAR),
    sub: seats[p]?.bot ? t('Robot') : seated && p === me ? t('Toi') : t('Joueur'),
  });
  const sides: [Side, Side] = [side(0), side(1)];

  // Sounds follow what happens at the table, whoever fired.
  const last = useRef(game);
  useEffect(() => {
    const before = last.current;
    last.current = game;
    if (game === before) return;
    if (game.fired[0] + game.fired[1] > before.fired[0] + before.fired[1]) shotSound(game);
    if (done && before.phase !== 'fini') {
      const id = setTimeout(() => (game.winner === me || !seated ? sounds.win() : sounds.fold()), 500);
      return () => clearTimeout(id);
    }
    if (myTurn && (before.current !== game.current || before.phase !== 'tir')) sounds.myTurn();
  }, [game]);
  useFeat('bataille', done && seated && game.winner === me);

  // The results come a little after the last shot, so the sinking can be seen.
  const [showResults, setShowResults] = useState(over);
  useEffect(() => {
    if (!over) return;
    const id = setTimeout(() => setShowResults(true), END_DELAY);
    return () => clearTimeout(id);
  }, [over]);

  const waited = seats.filter((s) => actors.includes(s.id) && !s.bot);
  const mine = waited.some((s) => seats.indexOf(s) === mySeat);
  const top = (
    <>
      <TopBar onBack={onLeave} backLabel={t('← Quitter')}>
        <Text style={styles.round}>{game.phase === 'placement' ? t('Placement') : t('Bataille navale')}</Text>
      </TopBar>
      {deadline && !done && waited.length > 0 && (
        <TurnTimer deadline={deadline} now={now} name={mine ? t('Toi') : waited[0].name} seconds={60} />
      )}
      {error && <Text style={styles.onlineError}>{error}</Text>}
    </>
  );

  if (over && showResults)
    return <Results game={game} me={me} sides={sides} onHome={onLeave} homeLabel={t('Quitter la table')} />;

  if (game.phase === 'placement' && seated && !view.placed[me])
    return <Placement top={top} busy={busy} onReady={(ships) => onMove({ type: 'place', ships })} />;

  if (game.phase === 'placement') {
    const waitingFor = sides.filter((_, p) => !view.placed[p]).map((s) => s.name);
    return (
      <GameLayout
        top={top}
        table={({ width, height }) => {
          const cell = Math.floor(
            Math.min(desktop ? 40 : 34, (width - 4) / (BN_SIZE + 1), (height - 4) / (BN_SIZE + 1)),
          );
          const board = game.boards[me];
          return <Grid cell={cell} ships={seated ? (board?.ships ?? []) : []} shots={[]} />;
        }}
        bottom={
          <View style={[styles.bottomBox, desktop && styles.bottomDesktop]}>
            <Text style={styles.prompt}>
              {t('⏳ En attente de la flotte de {name}…', { name: waitingFor.join(', ') })}
            </Text>
            <Text style={styles.help}>
              {seated ? t('Ta flotte est prête.') : t('Tu regardes la partie.')}
            </Text>
          </View>
        }
      />
    );
  }

  const prompt = done
    ? game.winner === me && seated
      ? t('🏆 Tu as coulé toute la flotte !')
      : t('🏆 {name} gagne la bataille !', { name: sides[game.winner ?? 0].name })
    : myTurn
      ? t('À toi de tirer !')
      : seats[game.current]?.bot
        ? t('🤖 {name} vise…', { name: sides[game.current].name })
        : t('{name} vise…', { name: sides[game.current].name });

  return (
    <GameLayout
      top={
        <>
          {top}
          {!desktop && (
            <View style={styles.sidesRow}>
              <SideCard side={sides[me]} board={game.boards[me]} active={!done && game.current === me} />
              <SideCard
                side={sides[other]}
                board={game.boards[other]}
                active={!done && game.current === other}
              />
            </View>
          )}
        </>
      }
      table={({ width, height }) => (
        <Battle
          game={game}
          me={me}
          sides={sides}
          canShoot={myTurn && !busy}
          onShoot={(x, y) => onMove({ type: 'shoot', x, y })}
          prompt={prompt}
          width={width}
          height={height}
        />
      )}
      bottom={
        <View style={[styles.bottomBox, desktop && styles.bottomDesktop]}>
          {!desktop && (
            <Text style={[styles.prompt, done && styles.promptDone]} numberOfLines={1}>
              {prompt}
            </Text>
          )}
          <Text style={styles.help}>
            {!seated
              ? t('Tu regardes la partie.')
              : myTurn
                ? t('Touche une case de la grille adverse pour tirer.')
                : t('Attends ton tour.')}
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  flex: { flex: 1 },
  flexText: { flex: 1, minWidth: 0 },
  pointer: { cursor: 'pointer' },

  // Setup
  setup: { padding: 20, paddingTop: 40, paddingBottom: 30 },
  column: { width: '100%', maxWidth: COLUMN_MAX_WIDTH, alignSelf: 'center' },
  titleIcon: { fontSize: 46, textAlign: 'center' },
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
  spacer: { height: 20 },

  // Grid
  label: { alignItems: 'center', justifyContent: 'center' },
  labelText: { color: colors.muted, fontWeight: '800' },
  sea: {
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(160,210,255,0.45)',
    boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
  },
  seaActive: { borderColor: colors.gold, borderWidth: 2, boxShadow: '0 0 16px rgba(232,199,102,0.45)' },
  lineV: { top: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  lineH: { left: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  aim: { backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 2, borderColor: colors.gold },
  ship: {
    backgroundColor: SHIP,
    borderWidth: 1.5,
    borderColor: SHIP_BORDER,
    boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.45), 0 2px 4px rgba(0,0,0,0.4)',
  },
  shipSunk: { backgroundColor: SUNK, borderColor: SUNK_BORDER, borderWidth: 2 },
  shipSelected: { borderColor: colors.gold },
  hitDot: {
    backgroundColor: HIT,
    borderWidth: 2,
    borderColor: '#ffd36b',
    boxShadow: '0 0 8px rgba(255,120,60,0.9)',
  },
  missDot: { backgroundColor: MISS },

  // Fleet
  fleet: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 },
  fleetCompact: { gap: 4, marginTop: 2, justifyContent: 'flex-start' },
  fleetShip: { flexDirection: 'row', gap: 1 },
  fleetSunk: { opacity: 0.55 },
  fleetCell: { borderRadius: 2, backgroundColor: SHIP },

  // Placement
  placeDesktop: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  placeSide: { width: 320, gap: 10 },
  placeTitle: { color: colors.gold, fontSize: 24, fontWeight: '800' },
  placeBottom: { gap: 6 },
  dock: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  dockDesktop: { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch' },
  helpLeft: { textAlign: 'left' },
  dockShip: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 3,
  },
  dockSelected: { borderColor: colors.gold, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.12)' },
  dockDone: { opacity: 0.5 },
  dockName: { color: colors.text, fontSize: 11, fontWeight: '700' },
  dockCells: { flexDirection: 'row', gap: 2 },
  dockCell: { width: 10, height: 10, borderRadius: 2, backgroundColor: SHIP },
  dockCellSelected: { backgroundColor: colors.gold },
  tools: { flexDirection: 'row', gap: 6 },

  // Battle
  sidesRow: { flexDirection: 'row', gap: 6, marginTop: 2, marginBottom: 4 },
  sideCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    minWidth: 0,
  },
  sideCardDesktop: {
    flex: 0,
    alignSelf: 'stretch',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  sideActive: { borderColor: colors.gold, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  sideName: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  sideNameActive: { color: colors.gold, fontWeight: '800' },
  sideSub: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  battleDesktop: { alignItems: 'center', gap: 10 },
  boardsRow: { flexDirection: 'row', gap: 40, alignItems: 'flex-start' },
  boardCol: { alignItems: 'center' },
  battlePhone: { alignItems: 'center', gap: 2 },
  gridTitle: { color: colors.text, fontWeight: '800', fontSize: 14, alignSelf: 'flex-start', marginTop: 2 },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, alignSelf: 'stretch' },
  mini: { borderRadius: 8, padding: 2, backgroundColor: 'rgba(255,255,255,0.05)' },
  miniInfo: { flex: 1, gap: 2, minWidth: 0 },
  miniLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', marginTop: 4 },
  miniHint: { color: colors.gold, fontSize: 11, fontWeight: '700', marginTop: 6 },
  newsBox: { minHeight: 26, justifyContent: 'center' },
  news: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  newsHit: { color: '#ffb36b' },
  newsSunk: { color: '#ff7a6b', fontSize: 17 },
  prompt: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  promptLarge: { fontSize: 20, marginTop: 4 },
  promptDone: { color: colors.gold, fontSize: 18 },
  round: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  bottomBox: { minHeight: 46, justifyContent: 'center', gap: 2 },
  bottomDesktop: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  help: { color: colors.muted, textAlign: 'center', fontSize: 13 },
  onlineError: { color: colors.gold, textAlign: 'center', fontSize: 13, marginBottom: 4 },

  // Results
  results: { padding: 16, paddingTop: 40, paddingBottom: 30, alignItems: 'center' },
  resultsDesktop: { paddingTop: 48 },
  trophy: { fontSize: 52, textAlign: 'center' },
  winner: { color: colors.gold, fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  resultsSub: { color: colors.muted, textAlign: 'center', marginTop: 6, fontSize: 14 },
  finalRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 20 },
  finalSide: {
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  finalWinner: { borderColor: colors.gold, borderWidth: 2 },
  finalName: { color: colors.text, fontSize: 15, fontWeight: '700', maxWidth: 140 },
  finalNameWin: { color: colors.gold, fontWeight: '900' },
  resultButtons: { alignSelf: 'stretch', marginTop: 20 },
});
