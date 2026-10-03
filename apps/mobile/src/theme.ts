export const colors = {
  background: '#0b1f17',
  felt: '#0f5132',
  feltLight: '#18794e',
  feltDark: '#0a3622',
  rail: '#4a2c17',
  railLight: '#6b4226',
  panel: 'rgba(5, 25, 17, 0.85)',
  text: '#f8f9fa',
  muted: '#a3cfbb',
  gold: '#ffc107',
  goldDark: '#c99700',
  danger: '#dc3545',
  card: '#fffdf8',
  red: '#c1121f',
  black: '#111111',
  /** Translucent panels that let the background show through. */
  glass: 'rgba(6, 28, 19, 0.78)',
  glassBorder: 'rgba(255, 213, 120, 0.16)',
};

/** Top-to-bottom color stops for LinearGradient. */
export const gradients = {
  background: ['#14432f', '#0a2419', '#04100b'],
  gold: ['#ffe082', '#ffc107', '#e09b00'],
  danger: ['#f26a6a', '#d63343', '#a51d2c'],
  glass: ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.02)'],
  wood: ['#8a5530', '#5a3219', '#3a1f0e'],
  felt: ['#22925c', '#13693f', '#0c4a2c'],
} as const;

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
