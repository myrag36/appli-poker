import { StyleSheet, Text, View } from 'react-native';
import type { HandView } from '@appli-poker/engine';
import { PlayingCard } from './PlayingCard';
import { colors } from '../theme';

const STREET_NAMES: Record<string, string> = {
  preflop: 'Avant le flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  finished: 'Fin de la main',
};

/** Board, pot and every player's chips. Shows hole cards only once they are revealed at showdown. */
export function Table({ hand, meId }: { hand: HandView; meId?: string }) {
  const pot = hand.players.reduce((s, p) => s + p.totalBet, 0);
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.street}>{STREET_NAMES[hand.street]}</Text>
        <Text style={styles.pot}>Pot : {pot}</Text>
      </View>

      <View style={styles.board}>
        {[0, 1, 2, 3, 4].map((i) => (
          <PlayingCard key={i} card={hand.board[i]} />
        ))}
      </View>

      <View style={styles.players}>
        {hand.players.map((p, i) => {
          const shown = hand.showdown[p.id];
          return (
            <View
              key={p.id}
              style={[styles.player, i === hand.toAct && styles.playerActive, p.folded && styles.playerFolded]}
            >
              <View style={styles.flex}>
                <Text style={styles.playerName}>
                  {p.name}
                  {p.id === meId ? ' (toi)' : ''}
                  {i === hand.dealer ? '  Ⓓ' : ''}
                </Text>
                <Text style={styles.playerInfo}>
                  {p.stack} jetons
                  {p.bet > 0 ? ` · mise ${p.bet}` : ''}
                  {p.folded ? ' · couché' : p.allIn ? ' · tapis' : ''}
                </Text>
                {shown && <Text style={styles.handName}>{shown.name}</Text>}
              </View>
              {shown && p.hole.length > 0 && (
                <View style={styles.row}>
                  {p.hole.map((c) => (
                    <PlayingCard key={c} card={c} small />
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  street: { color: colors.muted, fontSize: 16, fontWeight: '600' },
  pot: { color: colors.gold, fontSize: 18, fontWeight: '800' },
  board: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: colors.feltDark,
    borderRadius: 60,
    borderWidth: 6,
    borderColor: colors.rail,
  },
  players: { marginTop: 16, gap: 6 },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.feltDark,
  },
  playerActive: { borderWidth: 2, borderColor: colors.gold },
  playerFolded: { opacity: 0.45 },
  playerName: { color: colors.text, fontWeight: '700', fontSize: 16 },
  playerInfo: { color: colors.muted, fontSize: 13 },
  handName: { color: colors.gold, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  flex: { flex: 1 },
});
