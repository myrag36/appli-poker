import type { OnlineGameId } from '@appli-poker/engine';
import { BeloteOnlineBoard } from '../screens/BeloteScreen';
import { BlackjackOnlineBoard } from '../screens/BlackjackScreen';
import { PresidentOnlineBoard, PresidentOnlineOptions } from '../screens/PresidentScreen';
import { YamsOnlineBoard } from '../screens/YamsScreen';
import type { OnlineGameUi } from './types';

/** How each game looks at an online table. */
export const ONLINE_UI: Record<OnlineGameId, OnlineGameUi> = {
  blackjack: {
    title: 'Blackjack',
    emoji: '🃏',
    players: '1 à 6 joueurs contre la banque',
    Board: BlackjackOnlineBoard,
    defaultOptions: {},
  },
  president: {
    title: 'Président',
    emoji: '👑',
    players: '3 à 8 joueurs, les robots complètent jusqu’à 4',
    Board: PresidentOnlineBoard,
    Options: PresidentOnlineOptions,
    defaultOptions: { rounds: 5 },
  },
  yams: {
    title: 'Yams',
    emoji: '🎲',
    players: '1 à 6 joueurs',
    Board: YamsOnlineBoard,
    defaultOptions: {},
  },
  belote: {
    title: 'Belote',
    emoji: '♠️',
    players: '4 joueurs en deux équipes, les robots complètent',
    Board: BeloteOnlineBoard,
    defaultOptions: {},
  },
};
