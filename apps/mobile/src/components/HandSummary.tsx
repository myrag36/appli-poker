import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { HandView } from '@appli-poker/engine';
import { Panel, PanelText } from './Panel';
import { useDesktop } from '../layout';
import { t } from '../i18n';
import { tMessage } from '../online/messages';

/** Who won the hand that just finished, with one line per pot. */
export function HandSummary({ hand, children }: { hand: HandView; children?: ReactNode }) {
  const desktop = useDesktop();
  const ids = new Set(hand.pots.flatMap((p) => p.winners));
  const winners = hand.players.filter((p) => ids.has(p.id));
  return (
    <Panel
      compact
      title={
        winners.length > 1
          ? t('{names} remportent le pot', { names: winners.map((w) => w.name).join(t(' et ')) })
          : t('{name} remporte le pot', { name: winners[0]?.name ?? '' })
      }
    >
      {hand.log.slice(-hand.pots.length).map((line, i) => (
        <PanelText key={i}>{tMessage(line)}</PanelText>
      ))}
      {/* On a computer the buttons keep a natural width instead of spanning the whole bar. */}
      {desktop ? <View style={styles.actions}>{children}</View> : children}
    </Panel>
  );
}

const styles = StyleSheet.create({
  actions: { alignSelf: 'center', minWidth: 280, maxWidth: '100%', gap: 6 },
});
