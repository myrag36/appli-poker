import { useEffect, useRef } from 'react';
import type { HandView } from '@appli-poker/engine';
import { buzz, play, setSoundOn, useSoundOn } from './sound';

/**
 * What each game event sounds (and feels) like. The sounds themselves live in `sound.ts`,
 * which new games can also call directly: `play('dice')`, `buzz('turn')`.
 */
export const sounds = {
  myTurn() {
    play('turn');
    buzz('turn');
  },
  /** A card dealt or played. */
  card() {
    play('deal');
  },
  /** A card turned over. */
  flip() {
    play('flip');
  },
  chips() {
    play('chip');
  },
  bet() {
    play('bet');
  },
  fold() {
    play('fold');
  },
  dice() {
    play('dice');
  },
  drop() {
    play('drop');
  },
  win() {
    play('win');
    buzz('win');
  },
  lose() {
    play('lose');
  },
  /** A move the game refused. */
  invalid() {
    play('invalid');
    buzz('invalid');
  },
  reaction() {
    play('pop');
  },
};

/** The speaker button: on and off is the same "Sons" setting as in the profile. */
export function setMuted(value: boolean) {
  setSoundOn(!value);
}

export function useMuted(): [boolean, (m: boolean) => void] {
  const [on] = useSoundOn();
  return [!on, setMuted];
}

/**
 * Plays a sound for each thing that changed since the last state of the hand:
 * new cards, bets, folds, my turn, and winning.
 */
export function useHandSounds(hand: HandView | null, meId: string | null) {
  const prev = useRef<HandView | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = hand;
    if (!hand || !before) return;
    // A new hand was dealt.
    if (
      hand.board.length < before.board.length ||
      (before.street === 'finished' && hand.street !== 'finished')
    ) {
      sounds.card();
      if (meId && hand.toAct >= 0 && hand.players[hand.toAct].id === meId) sounds.myTurn();
      return;
    }
    if (hand.board.length > before.board.length) sounds.flip();
    const paid = hand.players.some((p, i) => p.totalBet > (before.players[i]?.totalBet ?? 0));
    const folded = hand.players.some((p, i) => p.folded && !before.players[i]?.folded);
    const raised = hand.players.some(
      (p, i) => p.bet > (before.players[i]?.bet ?? 0) && p.bet > before.currentBet,
    );
    if (raised) sounds.bet();
    else if (paid) sounds.chips();
    else if (folded) sounds.fold();
    if (hand.street === 'finished' && before.street !== 'finished') {
      const winners = hand.pots.flatMap((p) => p.winners);
      const me = hand.players.find((p) => p.id === meId);
      if (!meId || winners.includes(meId)) sounds.win();
      // Losing a showdown hurts; folding earlier was already heard.
      else if (me && !me.folded) sounds.lose();
    }
    const actor = hand.toAct >= 0 ? hand.players[hand.toAct].id : null;
    const beforeActor = before.toAct >= 0 ? before.players[before.toAct].id : null;
    if (meId && actor === meId && beforeActor !== meId) sounds.myTurn();
  }, [hand, meId]);
}
