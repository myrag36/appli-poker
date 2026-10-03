import { Platform } from 'react-native';

type Stops = readonly [string, string, ...string[]];

export interface Theme {
  name: string;
  /** Color shown on the theme picker. */
  swatch: string;
  colors: {
    background: string;
    felt: string;
    rail: string;
    text: string;
    muted: string;
    /** Accent for highlights, amounts and the main buttons. */
    gold: string;
    /** Text drawn on top of the accent color. */
    onGold: string;
    onGoldMuted: string;
    goldBorder: string;
    danger: string;
    card: string;
    red: string;
    black: string;
    /** Translucent panels that let the background show through. */
    glass: string;
    glassBorder: string;
    railBorder: string;
    feltBorder: string;
    /** Soft light in the middle of the felt and at the top of the screen. */
    glow: string;
  };
  /** Top-to-bottom color stops for LinearGradient. */
  gradients: {
    background: Stops;
    gold: Stops;
    danger: Stops;
    glass: Stops;
    wood: Stops;
    felt: Stops;
  };
}

const shared = {
  text: '#f8f9fa',
  danger: '#dc3545',
  card: '#fffdf8',
  red: '#c1121f',
  black: '#111111',
};
const glass: Stops = ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.02)'];
const danger: Stops = ['#f26a6a', '#d63343', '#a51d2c'];
const goldButton: Stops = ['#ffe082', '#ffc107', '#e09b00'];

export const THEMES = {
  casino: {
    name: 'Casino',
    swatch: '#13693f',
    colors: {
      ...shared,
      background: '#0b1f17',
      felt: '#0f5132',
      rail: '#4a2c17',
      muted: '#a3cfbb',
      gold: '#ffc107',
      onGold: '#212529',
      onGoldMuted: '#3d3a2a',
      goldBorder: '#ffe9a8',
      glass: 'rgba(6, 28, 19, 0.78)',
      glassBorder: 'rgba(255, 213, 120, 0.16)',
      railBorder: '#a0703f',
      feltBorder: '#2a1608',
      glow: 'rgba(120, 230, 160, 0.10)',
    },
    gradients: {
      background: ['#14432f', '#0a2419', '#04100b'],
      gold: goldButton,
      danger,
      glass,
      wood: ['#8a5530', '#5a3219', '#3a1f0e'],
      felt: ['#22925c', '#13693f', '#0c4a2c'],
    },
  },
  nuit: {
    name: 'Nuit néon',
    swatch: '#3a0ca3',
    colors: {
      ...shared,
      background: '#0b0a1f',
      felt: '#1b1f5c',
      rail: '#15151f',
      muted: '#b8b5e8',
      gold: '#4cc9f0',
      onGold: '#06121f',
      onGoldMuted: '#14324a',
      goldBorder: '#a5e8fb',
      glass: 'rgba(14, 12, 40, 0.8)',
      glassBorder: 'rgba(76, 201, 240, 0.25)',
      railBorder: '#f72585',
      feltBorder: '#05040f',
      glow: 'rgba(181, 23, 158, 0.16)',
    },
    gradients: {
      background: ['#2a1060', '#120b33', '#05040f'],
      gold: ['#a5e8fb', '#4cc9f0', '#2b8fd6'],
      danger: ['#ff6fb5', '#f72585', '#b5179e'],
      glass,
      wood: ['#3a3a52', '#1f1f2e', '#0d0d14'],
      felt: ['#3f37c9', '#2b2a8a', '#16154f'],
    },
  },
  vegas: {
    name: 'Las Vegas',
    swatch: '#a4161a',
    colors: {
      ...shared,
      background: '#1a0606',
      felt: '#7a0f13',
      rail: '#141414',
      muted: '#e9b8b0',
      gold: '#ffd166',
      onGold: '#2a1800',
      onGoldMuted: '#4a3510',
      goldBorder: '#ffe8a8',
      glass: 'rgba(30, 6, 8, 0.8)',
      glassBorder: 'rgba(255, 209, 102, 0.22)',
      railBorder: '#c9a227',
      feltBorder: '#000000',
      glow: 'rgba(255, 120, 100, 0.12)',
    },
    gradients: {
      background: ['#4a0d10', '#220608', '#0a0202'],
      gold: ['#fff0b3', '#ffd166', '#d9a21b'],
      danger,
      glass,
      wood: ['#3a3a3a', '#1c1c1c', '#050505'],
      felt: ['#c1121f', '#8d0f16', '#5a080d'],
    },
  },
  lounge: {
    name: 'Lounge',
    swatch: '#355c7d',
    colors: {
      ...shared,
      background: '#14171c',
      felt: '#2f4858',
      rail: '#5c3a21',
      muted: '#c9c1b6',
      gold: '#e9a85b',
      onGold: '#231505',
      onGoldMuted: '#4d3418',
      goldBorder: '#f6d3a6',
      glass: 'rgba(22, 25, 31, 0.8)',
      glassBorder: 'rgba(233, 168, 91, 0.22)',
      railBorder: '#b5835a',
      feltBorder: '#1a120b',
      glow: 'rgba(160, 200, 230, 0.10)',
    },
    gradients: {
      background: ['#2b3440', '#181c22', '#0b0d10'],
      gold: ['#f6d3a6', '#e9a85b', '#c27a2c'],
      danger,
      glass,
      wood: ['#a0683c', '#6e4325', '#3d2412'],
      felt: ['#46708a', '#2f4f63', '#1d3341'],
    },
  },
} satisfies Record<string, Theme>;

export type ThemeId = keyof typeof THEMES;
const THEME_KEY = 'appli-poker:theme';

/**
 * The theme is read once at startup, before any style is built: styles are created
 * when their modules load, so switching theme saves the choice and reloads the app.
 */
function savedTheme(): ThemeId {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const id = localStorage.getItem(THEME_KEY);
      if (id && id in THEMES) return id as ThemeId;
    }
  } catch {
    // Storage can be blocked; fall back to the default theme.
  }
  return 'casino';
}

export const themeId: ThemeId = savedTheme();
const theme: Theme = THEMES[themeId];

/** Whether the theme can be changed here (the choice is kept in the browser). */
export const canChangeTheme = Platform.OS === 'web';

export function setTheme(id: ThemeId) {
  try {
    localStorage.setItem(THEME_KEY, id);
    window.location.reload();
  } catch {
    // Nothing to do if storage is blocked.
  }
}

export const colors = theme.colors;
export const gradients = theme.gradients;

/** One color per seat, used for avatars. */
export const seatColors = [
  '#e76f51',
  '#2a9d8f',
  '#e9c46a',
  '#8e7dbe',
  '#f4a261',
  '#4ea8de',
  '#d17a9e',
  '#90be6d',
];

export const shadow = { boxShadow: '0 3px 8px rgba(0, 0, 0, 0.35)' } as const;
