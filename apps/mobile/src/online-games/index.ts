import type { OnlineGameId } from '@appli-poker/engine';
import { BeloteOnlineBoard, BeloteOnlineOptions } from '../screens/BeloteScreen';
import { BlackjackOnlineBoard, BlackjackOnlineOptions } from '../screens/BlackjackScreen';
import { PresidentOnlineBoard, PresidentOnlineOptions } from '../screens/PresidentScreen';
import { Puissance4OnlineBoard, Puissance4OnlineOptions } from '../screens/Puissance4Screen';
import { RamiOnlineBoard, RamiOnlineOptions } from '../screens/RamiScreen';
import { YamsOnlineBoard } from '../screens/YamsScreen';
import { TarotOnlineBoard, TarotOnlineOptions } from '../screens/TarotScreen';
import { PerudoOnlineBoard, PerudoOnlineOptions } from '../screens/PerudoScreen';
import { HuitOnlineBoard, HuitOnlineOptions, UnoOnlineBoard, UnoOnlineOptions } from '../screens/UnoScreen';
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
  puissance4: {
    title: t('Puissance 4'),
    emoji: '🔴',
    players: t('2 joueurs, un robot prend la place libre'),
    Board: Puissance4OnlineBoard,
    Options: Puissance4OnlineOptions,
    defaultOptions: { rounds: 3 },
  },
  rami: {
    title: 'Rami',
    emoji: '🃏',
    players: t('2 à 6 joueurs, un robot complète si tu es seul'),
    Board: RamiOnlineBoard,
    Options: RamiOnlineOptions,
    defaultOptions: { target: 300 },
  },
  tarot: {
    title: t('Tarot'),
    emoji: '🃏',
    players: t('1 à 4 joueurs, un preneur contre les autres, les robots complètent'),
    Board: TarotOnlineBoard,
    Options: TarotOnlineOptions,
    defaultOptions: { deals: 4 },
  },
  uno: {
    title: 'Uno',
    emoji: '🎨',
    players: t('2 à 6 joueurs, un robot complète si tu es seul'),
    Board: UnoOnlineBoard,
    Options: UnoOnlineOptions,
    defaultOptions: { target: 200 },
  },
  huit: {
    title: t('8 américain'),
    emoji: '🎱',
    players: t('2 à 6 joueurs, un robot complète si tu es seul'),
    Board: HuitOnlineBoard,
    Options: HuitOnlineOptions,
    defaultOptions: { target: 100 },
  },
  perudo: {
    title: 'Perudo',
    emoji: '🎲',
    players: t('2 à 6 joueurs, un robot complète si tu es seul'),
    Board: PerudoOnlineBoard,
    Options: PerudoOnlineOptions,
    defaultOptions: { calza: true },
  },
};
