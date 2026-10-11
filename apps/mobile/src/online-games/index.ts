import { type ComponentType, lazy } from 'react';
import type { OnlineGameId } from '@appli-poker/engine';
import { t } from '../i18n';
import type { OnlineGameUi } from './types';

/*
 * Each game's board lives in its screen file, loaded only when that game is opened: the code
 * of the other games is not downloaded for nothing (see App.tsx).
 */
const screens = {
  BatailleScreen: () => import('../screens/BatailleScreen'),
  BeloteScreen: () => import('../screens/BeloteScreen'),
  BlackjackScreen: () => import('../screens/BlackjackScreen'),
  DamesScreen: () => import('../screens/DamesScreen'),
  EchecsScreen: () => import('../screens/EchecsScreen'),
  PerudoScreen: () => import('../screens/PerudoScreen'),
  PresidentScreen: () => import('../screens/PresidentScreen'),
  Puissance4Screen: () => import('../screens/Puissance4Screen'),
  RamiScreen: () => import('../screens/RamiScreen'),
  TarotScreen: () => import('../screens/TarotScreen'),
  UnoScreen: () => import('../screens/UnoScreen'),
  YamsScreen: () => import('../screens/YamsScreen'),
};
type Screens = typeof screens;

/** A component of a game's screen file, loaded the first time it is drawn. */
function part<F extends keyof Screens>(
  file: F,
  pick: (m: Awaited<ReturnType<Screens[F]>>) => ComponentType<any>,
): ComponentType<any> {
  return lazy(() => screens[file]().then((m) => ({ default: pick(m as Awaited<ReturnType<Screens[F]>>) })));
}

/** How each game looks at an online table. */
export const ONLINE_UI: Record<OnlineGameId, OnlineGameUi> = {
  blackjack: {
    title: 'Blackjack',
    emoji: '🃏',
    players: '1 à 7 joueurs contre la banque',
    Board: part('BlackjackScreen', (m) => m.BlackjackOnlineBoard),
    load: screens.BlackjackScreen,
    Options: part('BlackjackScreen', (m) => m.BlackjackOnlineOptions),
    defaultOptions: { stack: 1000, rounds: 10 },
  },
  president: {
    title: 'Président',
    emoji: '👑',
    players: '3 à 8 joueurs, les robots complètent jusqu’à 4',
    Board: part('PresidentScreen', (m) => m.PresidentOnlineBoard),
    load: screens.PresidentScreen,
    Options: part('PresidentScreen', (m) => m.PresidentOnlineOptions),
    defaultOptions: { rounds: 5 },
  },
  yams: {
    title: 'Yams',
    emoji: '🎲',
    players: '1 à 6 joueurs',
    Board: part('YamsScreen', (m) => m.YamsOnlineBoard),
    load: screens.YamsScreen,
    defaultOptions: {},
  },
  belote: {
    title: 'Belote',
    emoji: '♠️',
    players: '1 à 4 joueurs, en deux équipes, les robots complètent',
    Board: part('BeloteScreen', (m) => m.BeloteOnlineBoard),
    load: screens.BeloteScreen,
    Options: part('BeloteScreen', (m) => m.BeloteOnlineOptions),
    defaultOptions: { target: 1000 },
  },
  puissance4: {
    title: t('Puissance 4'),
    emoji: '🔴',
    players: t('2 joueurs, un robot prend la place libre'),
    Board: part('Puissance4Screen', (m) => m.Puissance4OnlineBoard),
    load: screens.Puissance4Screen,
    Options: part('Puissance4Screen', (m) => m.Puissance4OnlineOptions),
    defaultOptions: { rounds: 3 },
  },
  bataille: {
    title: t('Bataille navale'),
    emoji: '⚓',
    players: t('2 joueurs, un robot prend la place libre'),
    Board: part('BatailleScreen', (m) => m.BatailleOnlineBoard),
    load: screens.BatailleScreen,
    defaultOptions: {},
  },
  echecs: {
    title: t('Échecs'),
    emoji: '♟️',
    players: t('2 joueurs, un robot prend la place libre'),
    Board: part('EchecsScreen', (m) => m.EchecsOnlineBoard),
    load: screens.EchecsScreen,
    defaultOptions: {},
  },
  rami: {
    title: 'Rami',
    emoji: '🃏',
    players: t('2 à 6 joueurs, un robot complète si tu es seul'),
    Board: part('RamiScreen', (m) => m.RamiOnlineBoard),
    load: screens.RamiScreen,
    Options: part('RamiScreen', (m) => m.RamiOnlineOptions),
    defaultOptions: { target: 300 },
  },
  tarot: {
    title: t('Tarot'),
    emoji: '🃏',
    players: t('1 à 4 joueurs, un preneur contre les autres, les robots complètent'),
    Board: part('TarotScreen', (m) => m.TarotOnlineBoard),
    load: screens.TarotScreen,
    Options: part('TarotScreen', (m) => m.TarotOnlineOptions),
    defaultOptions: { deals: 4 },
  },
  uno: {
    title: 'Uno',
    emoji: '🎨',
    players: t('2 à 6 joueurs, un robot complète si tu es seul'),
    Board: part('UnoScreen', (m) => m.UnoOnlineBoard),
    load: screens.UnoScreen,
    Options: part('UnoScreen', (m) => m.UnoOnlineOptions),
    defaultOptions: { target: 200 },
  },
  huit: {
    title: t('8 américain'),
    emoji: '🎱',
    players: t('2 à 6 joueurs, un robot complète si tu es seul'),
    Board: part('UnoScreen', (m) => m.HuitOnlineBoard),
    load: screens.UnoScreen,
    Options: part('UnoScreen', (m) => m.HuitOnlineOptions),
    defaultOptions: { target: 100 },
  },
  perudo: {
    title: 'Perudo',
    emoji: '🎲',
    players: t('2 à 6 joueurs, un robot complète si tu es seul'),
    Board: part('PerudoScreen', (m) => m.PerudoOnlineBoard),
    load: screens.PerudoScreen,
    Options: part('PerudoScreen', (m) => m.PerudoOnlineOptions),
    defaultOptions: { calza: true },
  },
  dames: {
    title: t('Dames'),
    emoji: '⚪',
    players: t('2 joueurs, un robot prend la place libre'),
    Board: part('DamesScreen', (m) => m.DamesOnlineBoard),
    load: screens.DamesScreen,
    defaultOptions: {},
  },
};
