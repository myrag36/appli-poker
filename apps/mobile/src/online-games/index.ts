import type { OnlineGameId } from '@appli-poker/engine';
import { BeloteOnlineBoard, BeloteOnlineOptions } from '../screens/BeloteScreen';
import { BlackjackOnlineBoard, BlackjackOnlineOptions } from '../screens/BlackjackScreen';
import { PresidentOnlineBoard, PresidentOnlineOptions } from '../screens/PresidentScreen';
import { YamsOnlineBoard } from '../screens/YamsScreen';
import { TarotOnlineBoard, TarotOnlineOptions } from '../screens/TarotScreen';
import { t } from '../i18n';
import type { OnlineGameUi } from './types';

/** How each game looks at an online table. */
export const ONLINE_UI: Record<OnlineGameId, OnlineGameUi> = {
  blackjack: {
    title: 'Blackjack',
    emoji: '🃏',
    players: '1 à 7 joueurs contre la banque',
    Board: BlackjackOnlineBoard,
    Options: BlackjackOnlineOptions,
    defaultOptions: { stack: 1000 },
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
    players: '1 à 4 joueurs, en deux équipes, les robots complètent',
    Board: BeloteOnlineBoard,
    Options: BeloteOnlineOptions,
    defaultOptions: { target: 1000 },
  },
  tarot: {
    title: t('Tarot'),
    emoji: '🃏',
    players: t('1 à 4 joueurs, un preneur contre les autres, les robots complètent'),
    Board: TarotOnlineBoard,
    Options: TarotOnlineOptions,
    defaultOptions: { deals: 4 },
  },
};
