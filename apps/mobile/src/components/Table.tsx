import { StyleSheet, Text, View } from 'react-native';
import type { HandView } from '@appli-poker/engine';
import { ChipStack, DealerButton } from './Chip';
import { PlayingCard } from './PlayingCard';
import { colors, seatColors, shadow } from '../theme';

const STREET_NAMES: Record<string, string> = {
  preflop: 'Avant le flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  finished: 'Fin de la main',
};

const SEAT_WIDTH = 84;

interface Props {
  hand: HandView;
  meId?: string;
  /** Space the table may fill; it keeps its oval shape inside it. */
  maxWidth: number;
  maxHeight: number;
}

/**
 * Oval table seen from above, with players seated around it. `meId` sits at the bottom;
 * hole cards are shown only once revealed at showdown.
 */
export function Table({ hand, meId, maxWidth, maxHeight }: Props) {
  let w = Math.min(maxWidth, 440);
  let h = Math.min(Math.round(w * 1.45), maxHeight);
  // On short screens, narrow the table too so it stays an oval rather than a circle.
  if (h < w * 1.05) w = Math.round(h / 1.05);
  const cx = w / 2;
  const cy = h / 2;
  // Seats sit on an ellipse slightly inside the rail.
  const rx = w / 2 - SEAT_WIDTH / 2 + 4;
  // Leave room under the bottom seat for its name plate and hand name.
  const ry = h / 2 - 50;

  const n = hand.players.length;
  const meIndex = Math.max(0, hand.players.findIndex((p) => p.id === meId));
  const pot = hand.players.reduce((s, p) => s + p.totalBet, 0);
  const cardWidth = Math.max(26, Math.min(46, Math.floor((w * 0.62) / 5) - 4, Math.floor(h / 13)));

  return (
    <View style={[styles.wrap, { width: w, height: h }]}>
      <View style={[styles.rail, shadow, { borderRadius: w / 2 }]}>
        <View style={[styles.felt, { borderRadius: w / 2 }]}>
          <View style={[styles.feltGlow, { borderRadius: w / 2 }]} />
        </View>
      </View>

      <View style={[styles.center, { top: cy - (cardWidth * 1.4) / 2, width: w }]}>
        <View style={styles.board}>
          {[0, 1, 2, 3, 4].map((i) => (
            <PlayingCard key={i} card={hand.board[i]} width={cardWidth} />
          ))}
        </View>
        {pot > 0 && (
          <View style={styles.pot}>
            <ChipStack amount={pot} large />
          </View>
        )}
        <Text style={styles.street}>{STREET_NAMES[hand.street]}</Text>
      </View>

      {hand.players.map((p, i) => {
        // Seat 0 relative to me is at the bottom; the others follow clockwise.
        const angle = Math.PI / 2 + (((i - meIndex + n) % n) * 2 * Math.PI) / n;
        const x = cx + rx * Math.cos(angle);
        const y = cy + ry * Math.sin(angle);
        // Bets sit a fixed distance from the seat, towards the middle of the table.
        const t = Math.min(0.45, Math.min(75, h * 0.17) / Math.hypot(cx - x, cy - y));
        const bx = x + (cx - x) * t;
        const by = y + (cy - y) * t;
        const shown = hand.showdown[p.id];
        const active = i === hand.toAct;
        const color = seatColors[i % seatColors.length];
        const won = hand.pots.some((pot) => pot.winners.includes(p.id));

        return (
          <View key={p.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
            {p.bet > 0 && (
              <View style={[styles.bet, { left: bx - 30, top: by - 10 }]}>
                <ChipStack amount={p.bet} />
              </View>
            )}
            <View style={[styles.seat, { left: x - SEAT_WIDTH / 2, top: y - 30 }, p.folded && styles.folded]}>
              {shown && p.hole.length > 0 && (
                <View style={styles.shownCards}>
                  {p.hole.map((c) => (
                    <PlayingCard key={c} card={c} width={28} />
                  ))}
                </View>
              )}
              <View
                style={[
                  styles.avatar,
                  shadow,
                  { backgroundColor: color },
                  active && styles.avatarActive,
                  won && styles.avatarWon,
                ]}
              >
                <Text style={styles.initial}>{p.name.slice(0, 1).toUpperCase()}</Text>
                {i === hand.dealer && (
                  <View style={styles.dealer}>
                    <DealerButton />
                  </View>
                )}
              </View>
              <View style={[styles.plate, active && styles.plateActive]}>
                <Text style={styles.name} numberOfLines={1}>
                  {p.id === meId ? 'Toi' : p.name}
                </Text>
                <Text style={styles.stack}>
                  {p.folded ? 'Couché' : p.allIn ? 'Tapis !' : `${p.stack}`}
                </Text>
              </View>
              {shown && <Text style={[styles.handName, won && styles.handNameWon]}>{shown.name}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
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
    borderWidth: 3,
    borderColor: colors.railLight,
    padding: 10,
  },
  felt: {
    flex: 1,
    backgroundColor: colors.felt,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feltGlow: {
    width: '70%',
    height: '60%',
    backgroundColor: colors.feltLight,
    opacity: 0.35,
  },
  center: { position: 'absolute', left: 0, alignItems: 'center' },
  street: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  board: { flexDirection: 'row' },
  pot: { marginTop: 10 },
  bet: { position: 'absolute', width: 60, alignItems: 'center' },
  seat: { position: 'absolute', width: SEAT_WIDTH, alignItems: 'center' },
  folded: { opacity: 0.4 },
  shownCards: { flexDirection: 'row', position: 'absolute', top: -30, zIndex: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  avatarActive: { borderColor: colors.gold, borderWidth: 3, boxShadow: '0 0 14px rgba(255, 193, 7, 0.9)' },
  avatarWon: { borderColor: colors.gold, borderWidth: 3 },
  initial: { color: '#fff', fontWeight: '900', fontSize: 18 },
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
  plateActive: { borderColor: colors.gold },
  name: { color: colors.text, fontWeight: '700', fontSize: 12 },
  stack: { color: colors.gold, fontWeight: '700', fontSize: 12 },
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
  handNameWon: { color: colors.gold },
});
