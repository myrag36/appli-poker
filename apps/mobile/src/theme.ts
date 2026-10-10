import { Platform } from 'react-native';

type Stops = readonly [string, string, ...string[]];

/** The scenery drawn behind every screen, which is what makes each theme feel different. */
export type Decor =
  | 'suits'
  | 'synthwave'
  | 'curtain'
  | 'lounge'
  | 'space'
  | 'sakura'
  | 'saloon'
  | 'pirates'
  | 'chateau'
  | 'beach'
  | 'chalet'
  | 'cyberpunk';

export interface Theme {
  name: string;
  /** One line shown under the name in the theme chooser. */
  tagline: string;
  decor: Decor;
  /** Faint emblem printed in the middle of the felt, if any. */
  feltMark?: string;
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
    tagline: 'Le classique, tapis vert et bois verni',
    decor: 'suits',
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
    tagline: 'Rétro années 80, grille et soleil couchant',
    decor: 'synthwave',
    feltMark: '♠',
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
    tagline: 'Rideaux rouges et ampoules dorées',
    decor: 'curtain',
    feltMark: '♦',
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
    tagline: 'Club feutré, boiseries et lampes chaudes',
    decor: 'lounge',
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
  espace: {
    name: 'Espace',
    tagline: 'Une partie entre les étoiles',
    decor: 'space',
    feltMark: '🪐',
    swatch: '#240046',
    colors: {
      ...shared,
      background: '#03010a',
      felt: '#240046',
      rail: '#1a1a2e',
      muted: '#c8b6ff',
      gold: '#c77dff',
      onGold: '#10002b',
      onGoldMuted: '#3c096c',
      goldBorder: '#e0aaff',
      glass: 'rgba(10, 4, 26, 0.8)',
      glassBorder: 'rgba(199, 125, 255, 0.25)',
      railBorder: '#9d4edd',
      feltBorder: '#000000',
      glow: 'rgba(157, 78, 221, 0.14)',
    },
    gradients: {
      background: ['#10002b', '#05010f', '#000000'],
      gold: ['#e0aaff', '#c77dff', '#7b2cbf'],
      danger,
      glass,
      wood: ['#3c3c5a', '#1a1a2e', '#08080f'],
      felt: ['#3c096c', '#240046', '#10002b'],
    },
  },
  zen: {
    name: 'Jardin zen',
    tagline: 'Cerisiers en fleurs et soleil levant',
    decor: 'sakura',
    feltMark: '🌸',
    swatch: '#e5989b',
    colors: {
      ...shared,
      background: '#1d1520',
      felt: '#2d3a3a',
      rail: '#3d2b1f',
      muted: '#f2d0d4',
      gold: '#ffb4c2',
      onGold: '#3a0d18',
      onGoldMuted: '#6b2a3a',
      goldBorder: '#ffe0e6',
      glass: 'rgba(32, 20, 30, 0.8)',
      glassBorder: 'rgba(255, 180, 194, 0.25)',
      railBorder: '#c9a27e',
      feltBorder: '#120c08',
      glow: 'rgba(255, 180, 194, 0.12)',
    },
    gradients: {
      background: ['#4a2c40', '#24162a', '#0e0a12'],
      gold: ['#ffe0e6', '#ffb4c2', '#e5989b'],
      danger,
      glass,
      wood: ['#7a5a3a', '#4e3824', '#2a1e13'],
      felt: ['#3f5250', '#2d3a3a', '#1b2424'],
    },
  },
  saloon: {
    name: 'Saloon',
    tagline: 'Far West, planches et cactus',
    decor: 'saloon',
    feltMark: '🤠',
    swatch: '#bc6c25',
    colors: {
      ...shared,
      background: '#2a1708',
      felt: '#606c38',
      rail: '#5c3a1a',
      muted: '#f1dca7',
      gold: '#f4a259',
      onGold: '#2b1300',
      onGoldMuted: '#5a3410',
      goldBorder: '#fbd1a2',
      glass: 'rgba(40, 22, 8, 0.82)',
      glassBorder: 'rgba(244, 162, 89, 0.25)',
      railBorder: '#dda15e',
      feltBorder: '#1f1206',
      glow: 'rgba(255, 200, 120, 0.12)',
    },
    gradients: {
      background: ['#8a5a2b', '#5c3a1a', '#2a1708'],
      gold: ['#fbd1a2', '#f4a259', '#bc6c25'],
      danger,
      glass,
      wood: ['#a0703f', '#6f4a24', '#3d2810'],
      felt: ['#7a8a45', '#606c38', '#3f4a22'],
    },
  },
  pirates: {
    name: 'Pirates',
    tagline: 'Pont du navire au clair de lune, trésor à bord',
    decor: 'pirates',
    feltMark: '⚓',
    swatch: '#1b6b62',
    colors: {
      ...shared,
      background: '#06142a',
      felt: '#1b5c55',
      rail: '#3e2410',
      muted: '#bcd9d2',
      gold: '#f2c14e',
      onGold: '#2a1a00',
      onGoldMuted: '#5a4010',
      goldBorder: '#ffe6a3',
      glass: 'rgba(5, 18, 34, 0.82)',
      glassBorder: 'rgba(242, 193, 78, 0.24)',
      railBorder: '#b8863f',
      feltBorder: '#120b04',
      glow: 'rgba(150, 220, 210, 0.12)',
    },
    gradients: {
      background: ['#13284a', '#0a1830', '#040a16'],
      gold: ['#ffe6a3', '#f2c14e', '#c08a1e'],
      danger,
      glass,
      wood: ['#8a5a32', '#5e3a1a', '#2e1a0a'],
      felt: ['#2a7d72', '#1b5c55', '#0f3a35'],
    },
  },
  chateau: {
    name: 'Château',
    tagline: 'Grande salle, torches et vitraux',
    decor: 'chateau',
    feltMark: '⚜',
    swatch: '#6b1d3a',
    colors: {
      ...shared,
      background: '#120d0f',
      felt: '#5c1a33',
      rail: '#3a2a20',
      muted: '#ddc9b8',
      gold: '#e8b84a',
      onGold: '#251600',
      onGoldMuted: '#55380c',
      goldBorder: '#f8dd9a',
      glass: 'rgba(22, 15, 17, 0.84)',
      glassBorder: 'rgba(232, 184, 74, 0.24)',
      railBorder: '#c79a3c',
      feltBorder: '#140608',
      glow: 'rgba(255, 170, 90, 0.12)',
    },
    gradients: {
      background: ['#3a3236', '#1d181a', '#0a0808'],
      gold: ['#f8dd9a', '#e8b84a', '#b07f1c'],
      danger,
      glass,
      wood: ['#6e5038', '#4a3424', '#251912'],
      felt: ['#7d2648', '#5c1a33', '#36101f'],
    },
  },
  plage: {
    name: 'Plage tropicale',
    tagline: 'Paillote au coucher du soleil, palmiers et guirlandes',
    decor: 'beach',
    feltMark: '🌴',
    swatch: '#ff7b54',
    colors: {
      ...shared,
      background: '#1c1030',
      felt: '#137a8c',
      rail: '#8a6236',
      muted: '#ffe0c8',
      gold: '#ffb347',
      onGold: '#2e1500',
      onGoldMuted: '#6a3a0a',
      goldBorder: '#ffe0a8',
      glass: 'rgba(32, 16, 42, 0.8)',
      glassBorder: 'rgba(255, 179, 71, 0.28)',
      railBorder: '#e8c48a',
      feltBorder: '#2a1a08',
      glow: 'rgba(255, 170, 120, 0.14)',
    },
    gradients: {
      background: ['#ff9a5a', '#a8406a', '#2a1440'],
      gold: ['#ffe0a8', '#ffb347', '#e67e22'],
      danger,
      glass,
      wood: ['#c8995a', '#8a6236', '#55391b'],
      felt: ['#1fa0b4', '#137a8c', '#0a4f5c'],
    },
  },
  chalet: {
    name: 'Chalet',
    tagline: 'Feu de cheminée et neige derrière la fenêtre',
    decor: 'chalet',
    feltMark: '❄',
    swatch: '#9a3b2e',
    colors: {
      ...shared,
      background: '#1a0f0a',
      felt: '#7a2e22',
      rail: '#4a2e1a',
      muted: '#ead7c3',
      gold: '#f7c873',
      onGold: '#2a1600',
      onGoldMuted: '#5c3a0e',
      goldBorder: '#fde4b4',
      glass: 'rgba(30, 17, 11, 0.84)',
      glassBorder: 'rgba(247, 200, 115, 0.24)',
      railBorder: '#c49060',
      feltBorder: '#1a0905',
      glow: 'rgba(255, 160, 80, 0.14)',
    },
    gradients: {
      background: ['#4a2c1a', '#26160c', '#0e0805'],
      gold: ['#fde4b4', '#f7c873', '#d6922e'],
      danger,
      glass,
      wood: ['#9a6a40', '#6a4426', '#3a2412'],
      felt: ['#9a3b2e', '#7a2e22', '#4e1b13'],
    },
  },
  cyberpunk: {
    name: 'Cyberpunk',
    tagline: 'Pluie, hologrammes et mégapole au néon',
    decor: 'cyberpunk',
    feltMark: '⚡',
    swatch: '#f5e663',
    colors: {
      ...shared,
      background: '#05070d',
      felt: '#10262c',
      rail: '#14161c',
      muted: '#a9c4d0',
      gold: '#f5e663',
      onGold: '#14130a',
      onGoldMuted: '#3a3712',
      goldBorder: '#fbf3b0',
      glass: 'rgba(6, 10, 18, 0.84)',
      glassBorder: 'rgba(0, 240, 255, 0.28)',
      railBorder: '#00e5ff',
      feltBorder: '#000000',
      glow: 'rgba(0, 229, 255, 0.12)',
    },
    gradients: {
      background: ['#1a0d2e', '#0a0b18', '#020306'],
      gold: ['#fbf3b0', '#f5e663', '#c9b81c'],
      danger: ['#ff6fa8', '#ff2a6d', '#b0124a'],
      glass,
      wood: ['#2c3038', '#16181e', '#07080b'],
      felt: ['#18404a', '#10262c', '#071417'],
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
export const theme: Theme = THEMES[themeId];

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
