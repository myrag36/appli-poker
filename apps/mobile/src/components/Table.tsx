import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Avatar, HandView } from '@appli-poker/engine';
import { BlindsInfo } from './BlindsInfo';
import { ChipStack, DealerButton } from './Chip';
import { Appear, FloatUp, FlyTo } from './Motion';
import { PlayingCard } from './PlayingCard';
import { stripes } from './decors/classic-kit';
import { colors, gradients, seatColors, shadow, theme } from '../theme';
import { t } from '../i18n';
import { tMessage } from '../online/messages';
import { play } from '../sound';

const RAIL_SHEEN = ['rgba(255, 240, 220, 0.16)', 'rgba(255, 240, 220, 0)', 'rgba(0, 0, 0, 0.18)'] as const;

/** Faint horizontal threads across the felt, one every 3 points. */
function weave(height: number) {
  const { colors: c, locations } = stripes(3, height, 'rgba(0, 0, 0, 0.06)', 0.5);
  return { colors: c, locations };
}

const STREET_NAMES: Record<string, string> = {
  preflop: t('Avant le flop'),
  flop: t('Flop'),
  turn: t('Turn'),
  river: t('River'),
  finished: t('Fin de la main'),
};

const SEAT_WIDTH = 84;
const WIDE_SEAT_WIDTH = 112;
const BUBBLE_WIDTH = 150;

interface Props {
  hand: HandView;
  meId?: string;
  /** Space the table may fill; it keeps its oval shape inside it. */
  maxWidth: number;
  maxHeight: number;
  /** Emoji each player sent last; `key` changes with every new reaction so it animates again. */
  reactions?: Record<string, { emoji: string; key: number }>;
  /** In a tournament, when the blinds go up next (epoch ms). */
  nextLevelAt?: number | null;
  /** Each player's avatar by id; players without one show their initial. */
  avatars?: Record<string, Avatar>;
  /** Chat message each player just sent, shown in a bubble by their seat. */
  bubbles?: Record<string, { text: string; key: number }>;
  /** On a computer: a wide oval seen from above, with bigger seats and cards. */
  wide?: boolean;
}

/**
 * Oval table seen from above, with players seated around it. `meId` sits at the bottom;
 * hole cards are shown only once revealed at showdown.
 */
export function Table({
  hand,
  meId,
  maxWidth,
  maxHeight,
  reactions,
  nextLevelAt,
  avatars,
  bubbles,
  wide,
}: Props) {
  const seatWidth = wide ? WIDE_SEAT_WIDTH : SEAT_WIDTH;
  const collecting = useCollectedBets(hand);
  let w: number;
  let h: number;
  if (wide) {
    // Lying across the screen like a real table, about twice as wide as it is deep.
    h = Math.min(maxHeight, 640);
    w = Math.min(maxWidth, Math.round(h * 1.95), 1100);
    if (h > w / 1.45) h = Math.round(w / 1.45);
  } else {
    w = Math.min(maxWidth, 440);
    h = Math.min(Math.round(w * 1.45), maxHeight);
    // On short screens, narrow the table too so it stays an oval rather than a circle.
    if (h < w * 1.05) w = Math.round(h / 1.05);
  }
  const cx = w / 2;
  const cy = h / 2;
  // Seats sit on an ellipse slightly inside the rail.
  const rx = w / 2 - seatWidth / 2 + (wide ? 0 : 4);
  // Leave room under the bottom seat for its name plate and hand name.
  const ry = h / 2 - (wide ? 66 : 50);

  const n = hand.players.length;
  const meIndex = Math.max(
    0,
    hand.players.findIndex((p) => p.id === meId),
  );
  const pot = hand.players.reduce((s, p) => s + p.totalBet, 0);
  // Seat 0 relative to me is at the bottom; the others follow clockwise.
  const seatAt = (i: number) => {
    const angle = Math.PI / 2 + (((i - meIndex + n) % n) * 2 * Math.PI) / n;
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  };
  const cardWidth = wide
    ? Math.max(40, Math.min(66, Math.floor(h / 8.5)))
    : Math.max(26, Math.min(46, Math.floor((w * 0.62) / 5) - 4, Math.floor(h / 13)));
  // The middle of the table (board, pot, blinds) sits a little above centre when the table lies wide.
  const centerTop = cy - (cardWidth * 1.4) / 2 - (wide ? 24 : 0);
  // Where each player's bet lies: a fixed distance from the seat, towards the middle of the table.
  const betAt = (i: number) => {
    const { x, y } = seatAt(i);
    const along = Math.min(0.45, Math.min(wide ? 110 : 75, h * 0.17) / Math.hypot(cx - x, cy - y));
    return { x: x + (cx - x) * along, y: y + (cy - y) * along };
  };
  const potTop = centerTop + Math.round(cardWidth * 1.4) + 10;

  return (
    <View style={[styles.wrap, { width: w, height: h }]}>
      <View style={[styles.rail, wide && styles.railWide, { borderRadius: w / 2 }]}>
        <LinearGradient colors={gradients.wood} style={StyleSheet.absoluteFill} />
        {/* Varnish: a sheen on the upper half of the rail and a thin inlay line. */}
        <LinearGradient colors={RAIL_SHEEN} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        <View style={[styles.railInlay, { borderRadius: w / 2 }]} />
        <View style={[styles.felt, { borderRadius: w / 2 }]}>
          <LinearGradient colors={gradients.felt} style={StyleSheet.absoluteFill} />
          {/* Fine weave of the cloth, then a darker edge all around. */}
          <LinearGradient {...weave(h)} style={StyleSheet.absoluteFill} />
          <View style={[styles.feltVignette, { borderRadius: w / 2 }]} />
          <View style={[styles.feltGlow, { borderRadius: w / 2 }]} />
          <View style={[styles.feltLine, wide && styles.feltLineWide, { borderRadius: w / 2 }]} />
          {theme.feltMark && (
            <Text style={[styles.feltMark, { fontSize: Math.round(Math.min(w, h * 1.2) * 0.32) }]}>
              {theme.feltMark}
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.center, { top: centerTop, width: w }]}>
        <View style={[styles.board, wide && styles.boardWide]}>
          {[0, 1, 2, 3, 4].map((i) =>
            hand.board[i] ? (
              // The flop's three cards land one after the other.
              <Appear key={hand.board[i]} delay={i < 3 ? i * 160 : 0}>
                <PlayingCard card={hand.board[i]} width={cardWidth} />
              </Appear>
            ) : (
              <PlayingCard key={`slot${i}`} width={cardWidth} />
            ),
          )}
        </View>
        {pot > 0 && (
          <View style={styles.pot}>
            <ChipStack amount={pot} large />
          </View>
        )}
        <Text style={[styles.street, wide && styles.streetWide]}>{STREET_NAMES[hand.street]}</Text>
        <BlindsInfo smallBlind={hand.smallBlind} bigBlind={hand.bigBlind} nextLevelAt={nextLevelAt} />
      </View>

      {hand.players.map((p, i) => {
        const { x, y } = seatAt(i);
        const won = hand.pots.some((pot) => pot.winners.includes(p.id));
        return (
          won && (
            // The pot slides over to each winner.
            <FlyTo
              key={`win-${hand.log.length}-${p.id}`}
              from={{ x: cx - 30, y: cy + 20 }}
              to={{ x: x - 30, y: y - 10 }}
              delay={400}
            >
              <View style={styles.flyingChips}>
                <ChipStack
                  amount={hand.pots
                    .filter((pot) => pot.winners.includes(p.id))
                    .reduce((s, pot) => s + Math.floor(pot.amount / pot.winners.length), 0)}
                  large
                />
              </View>
            </FlyTo>
          )
        );
      })}

      {collecting?.bets.map((b) => {
        const i = hand.players.findIndex((p) => p.id === b.id);
        if (i < 0) return null;
        const at = betAt(i);
        return (
          // At the end of a betting round, the bets slide into the pot.
          <FlyTo
            key={`${collecting.key}-${b.id}`}
            from={{ x: at.x - 30, y: at.y - 10 }}
            to={{ x: cx - 30, y: potTop }}
            duration={520}
          >
            <View style={styles.flyingChips}>
              <ChipStack amount={b.amount} />
            </View>
          </FlyTo>
        );
      })}

      {hand.players.map((p, i) => {
        const { x, y } = seatAt(i);
        const { x: bx, y: by } = betAt(i);
        const shown = hand.showdown[p.id];
        const active = i === hand.toAct;
        const avatar = avatars?.[p.id];
        const color = avatar?.color ?? seatColors[i % seatColors.length];
        const won = hand.pots.some((pot) => pot.winners.includes(p.id));

        return (
          <View key={p.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
            {p.bet > 0 && (
              <Appear key={`${p.id}-${p.bet}`} from={0} style={[styles.bet, { left: bx - 30, top: by - 10 }]}>
                <ChipStack amount={p.bet} />
              </Appear>
            )}
            <View
              style={[
                styles.seat,
                { width: seatWidth, left: x - seatWidth / 2, top: y - (wide ? 38 : 30) },
                p.folded && styles.folded,
              ]}
            >
              {shown && p.hole.length > 0 && (
                <View style={[styles.shownCards, wide && styles.shownCardsWide]}>
                  {p.hole.map((c) => (
                    <PlayingCard key={c} card={c} width={(p.hole.length > 2 ? 20 : 28) * (wide ? 1.35 : 1)} />
                  ))}
                </View>
              )}
              <View
                style={[
                  styles.avatar,
                  wide && styles.avatarWide,
                  shadow,
                  { backgroundColor: color },
                  active && styles.avatarActive,
                  won && styles.avatarWon,
                ]}
              >
                {avatar ? (
                  <Text style={[styles.emoji, wide && styles.emojiWide]}>{avatar.emoji}</Text>
                ) : (
                  <Text style={[styles.initial, wide && styles.initialWide]}>
                    {p.name.slice(0, 1).toUpperCase()}
                  </Text>
                )}
                {i === hand.dealer && (
                  <View style={styles.dealer}>
                    <DealerButton />
                  </View>
                )}
              </View>
              <View style={[styles.plate, wide && styles.plateWide, active && styles.plateActive]}>
                <Text style={[styles.name, wide && styles.nameWide]} numberOfLines={1}>
                  {p.id === meId ? t('Toi') : p.name}
                </Text>
                <Text style={[styles.stack, wide && styles.nameWide]}>
                  {p.folded ? t('Couché') : p.allIn ? t('Tapis !') : `${p.stack}`}
                </Text>
              </View>
              {shown && (
                <Text style={[styles.handName, wide && styles.handNameWide, won && styles.handNameWon]}>
                  {t(shown.name)}
                </Text>
              )}
              {!shown && hand.street !== 'finished' && p.lastAction && !p.folded && (
                <Appear key={p.lastAction} from={-6}>
                  <Text
                    style={[
                      styles.lastAction,
                      wide && styles.lastActionWide,
                      p.allIn && styles.lastActionAllIn,
                    ]}
                    numberOfLines={1}
                  >
                    {tMessage(p.lastAction)}
                  </Text>
                </Appear>
              )}
              {reactions?.[p.id] && (
                <FloatUp key={reactions[p.id].key} style={styles.reaction}>
                  <Text style={styles.reactionText}>{reactions[p.id].emoji}</Text>
                </FloatUp>
              )}
            </View>
            {bubbles?.[p.id] && (
              // Above the seats in the bottom half, below those at the top, so it stays on the table.
              <Appear
                key={bubbles[p.id].key}
                from={y < cy ? -8 : 8}
                style={[
                  styles.bubble,
                  {
                    left: Math.max(2, Math.min(w - BUBBLE_WIDTH - 2, x - BUBBLE_WIDTH / 2)),
                    ...(y < cy ? { top: y + (wide ? 58 : 46) } : { bottom: h - y + (wide ? 42 : 34) }),
                  },
                ]}
              >
                <Text style={styles.bubbleText} numberOfLines={3}>
                  {bubbles[p.id].text}
                </Text>
              </Appear>
            )}
          </View>
        );
      })}
    </View>
  );
}

/**
 * The bets that were just swept into the pot, when a betting round ends: shown sliding to the
 * middle for a moment, with the clink of the chips.
 */
function useCollectedBets(hand: HandView) {
  const last = useRef<{ street: string; board: number; bets: Record<string, number> } | null>(null);
  const [collecting, setCollecting] = useState<{
    key: string;
    bets: { id: string; amount: number }[];
  } | null>(null);
  useEffect(() => {
    const before = last.current;
    last.current = {
      street: hand.street,
      board: hand.board.length,
      bets: Object.fromEntries(hand.players.map((p) => [p.id, p.bet])),
    };
    // Only the same hand moving to its next street; a new deal starts clean.
    if (!before || before.street === hand.street || hand.board.length < before.board) return;
    const bets = hand.players
      .filter((p) => (before.bets[p.id] ?? 0) > 0 && p.bet === 0)
      .map((p) => ({ id: p.id, amount: before.bets[p.id] }));
    if (bets.length === 0) return;
    setCollecting({ key: `${hand.street}-${hand.log.length}`, bets });
    play('bet');
  }, [hand]);
  useEffect(() => {
    if (!collecting) return;
    const id = setTimeout(() => setCollecting(null), 600);
    return () => clearTimeout(id);
  }, [collecting]);
  return collecting;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center' },
  rail: {
    position: 'absolute',
    top: 18,
    bottom: 18,
    left: 26,
    right: 26,
    backgroundColor: colors.rail,
    borderWidth: 2,
    borderColor: colors.railBorder,
    padding: 11,
    overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(0,0,0,0.6), inset 0 2px 3px rgba(255,220,170,0.35)',
  },
  felt: {
    flex: 1,
    backgroundColor: colors.felt,
    borderWidth: 2,
    borderColor: colors.feltBorder,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 6px 18px rgba(0,0,0,0.55)',
  },
  railInlay: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    right: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 230, 190, 0.16)',
  },
  feltVignette: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    boxShadow: 'inset 0 0 50px 6px rgba(0, 0, 0, 0.4)',
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
    borderWidth: 1.5,
    borderColor: 'rgba(255, 213, 120, 0.22)',
  },
  railWide: { top: 22, bottom: 22, left: 30, right: 30, padding: 14 },
  feltLineWide: { top: 22, bottom: 22, left: 26, right: 26 },
  feltMark: { position: 'absolute', opacity: 0.1, color: '#ffffff' },
  center: { position: 'absolute', left: 0, alignItems: 'center' },
  street: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  streetWide: { fontSize: 13, marginTop: 8 },
  board: { flexDirection: 'row' },
  boardWide: { gap: 4 },
  pot: { marginTop: 10 },
  bet: { position: 'absolute', width: 60, alignItems: 'center' },
  seat: { position: 'absolute', width: SEAT_WIDTH, alignItems: 'center' },
  folded: { opacity: 0.4 },
  shownCards: { flexDirection: 'row', position: 'absolute', top: -30, zIndex: 2 },
  shownCardsWide: { top: -40, gap: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  avatarWide: { width: 58, height: 58, borderRadius: 29, borderWidth: 2.5 },
  avatarActive: { borderColor: colors.gold, borderWidth: 3, boxShadow: '0 0 14px rgba(255, 193, 7, 0.9)' },
  avatarWon: { borderColor: colors.gold, borderWidth: 3 },
  emoji: { fontSize: 24 },
  initial: { color: '#fff', fontWeight: '900', fontSize: 18 },
  emojiWide: { fontSize: 32 },
  initialWide: { fontSize: 24 },
  dealer: { position: 'absolute', right: -10, top: -4 },
  plate: {
    marginTop: -6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignItems: 'center',
    minWidth: 64,
    maxWidth: SEAT_WIDTH,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  plateWide: {
    minWidth: 84,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    maxWidth: WIDE_SEAT_WIDTH,
  },
  plateActive: { borderColor: colors.gold },
  name: { color: colors.text, fontWeight: '700', fontSize: 12 },
  stack: { color: colors.gold, fontWeight: '700', fontSize: 12 },
  nameWide: { fontSize: 14 },
  handName: {
    marginTop: 2,
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    borderRadius: 6,
    overflow: 'hidden',
  },
  handNameWide: { fontSize: 13, paddingHorizontal: 8, paddingVertical: 1 },
  handNameWon: { color: colors.gold },
  lastAction: {
    marginTop: 2,
    color: '#212529',
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: 'rgba(255, 224, 130, 0.92)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
    maxWidth: SEAT_WIDTH,
  },
  lastActionWide: { fontSize: 12, paddingHorizontal: 8, maxWidth: WIDE_SEAT_WIDTH },
  lastActionAllIn: { backgroundColor: colors.danger, color: '#fff' },
  reaction: { position: 'absolute', top: -34, zIndex: 5 },
  bubble: {
    position: 'absolute',
    width: BUBBLE_WIDTH,
    alignItems: 'center',
    zIndex: 6,
  },
  bubbleText: {
    backgroundColor: '#fffdf8',
    color: '#1b1b1b',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
    textAlign: 'center',
    boxShadow: '0 4px 10px rgba(0,0,0,0.45)',
  },
  reactionText: { fontSize: 34 },
  flyingChips: { width: 60, alignItems: 'center' },
});
