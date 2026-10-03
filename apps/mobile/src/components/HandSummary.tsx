import type { ReactNode } from 'react';
import type { HandView } from '@appli-poker/engine';
import { Panel, PanelText } from './Panel';

/** Who won the hand that just finished, with one line per pot. */
export function HandSummary({ hand, children }: { hand: HandView; children?: ReactNode }) {
  const ids = new Set(hand.pots.flatMap((p) => p.winners));
  const winners = hand.players.filter((p) => ids.has(p.id));
  return (
    <Panel
      title={`${winners.map((w) => w.name).join(' et ')} ${winners.length > 1 ? 'remportent' : 'remporte'} le pot`}
    >
      {hand.log.slice(-hand.pots.length).map((line, i) => (
        <PanelText key={i}>{line}</PanelText>
      ))}
      {children}
    </Panel>
  );
}
