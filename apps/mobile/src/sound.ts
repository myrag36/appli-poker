import { useEffect, useState } from 'react';
import { Platform, Vibration } from 'react-native';

/**
 * Sound effects and vibrations for every game, all optional.
 *
 * The sounds are synthesized with the Web Audio API: no sound files to download or license.
 * They only play in the web version, once the player has touched the page (browsers block
 * sound before that), and never when "Sons" is off in the profile.
 *
 * Any screen can call `play('deal')`, `play('dice')`… and `buzz('turn')`: both are safe to
 * call anywhere, at any time, as often as wanted (a burst of the same sound plays once).
 */
export type SoundName =
  /** A card slid from the deck, or played on the table. */
  | 'deal'
  /** A card turned face up. */
  | 'flip'
  /** One chip clinking. */
  | 'chip'
  /** A small pile of chips pushed forward. */
  | 'bet'
  /** Dice rattling, then landing. */
  | 'dice'
  /** A button pressed, barely audible. */
  | 'tap'
  /** It is your turn. */
  | 'turn'
  /** You won: a short fanfare. */
  | 'win'
  /** You lost: a falling sigh. */
  | 'lose'
  /** A soft thud: folding, passing, drawing. */
  | 'fold'
  /** A reaction or a message from another player. */
  | 'pop'
  /** That move is not allowed. */
  | 'invalid'
  /** A token dropped into a slot. */
  | 'drop';

export type HapticName = 'turn' | 'win' | 'invalid';

const SOUND_KEY = 'appli-poker-sons';
const VIBRATION_KEY = 'appli-poker-vibrations';
/** Where the speaker button saved its choice before the profile settings existed. */
const OLD_MUTE_KEY = 'appli-poker:muted';

const web = Platform.OS === 'web' && typeof window !== 'undefined';

function read(key: string): string | null {
  if (!web) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    // Private mode: settings last until the page is closed.
    return null;
  }
}

function write(key: string, value: boolean) {
  if (!web) return;
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // Not saved, still applied for now.
  }
}

const settings = {
  sound: (read(SOUND_KEY) ?? (read(OLD_MUTE_KEY) === '1' ? '0' : '1')) === '1',
  vibration: read(VIBRATION_KEY) !== '0',
};
type Setting = keyof typeof settings;
const listeners = new Set<() => void>();

function set(which: Setting, value: boolean) {
  settings[which] = value;
  write(which === 'sound' ? SOUND_KEY : VIBRATION_KEY, value);
  if (which === 'sound' && !value) audio?.suspend().catch(() => {});
  listeners.forEach((l) => l());
}

export const isSoundOn = () => settings.sound;
export const isVibrationOn = () => settings.vibration;
export const setSoundOn = (on: boolean) => set('sound', on);
export const setVibrationOn = (on: boolean) => set('vibration', on);

function useSetting(which: Setting): [boolean, (on: boolean) => void] {
  const [value, setValue] = useState(settings[which]);
  useEffect(() => {
    const update = () => setValue(settings[which]);
    listeners.add(update);
    update();
    return () => {
      listeners.delete(update);
    };
  }, [which]);
  return [value, (on: boolean) => set(which, on)];
}

/** The "Sons" setting, kept in sync wherever it is shown. */
export const useSoundOn = () => useSetting('sound');
/** The "Vibrations" setting, kept in sync wherever it is shown. */
export const useVibrationOn = () => useSetting('vibration');

// ---------------------------------------------------------------------------------------------
// Audio

let audio: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
/** Set by the first touch, click or key press: before it, browsers keep pages silent. */
let gesture = false;

function context(): AudioContext | null {
  if (!web || !gesture || !settings.sound) return null;
  if (!audio) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      audio = new Ctor();
    } catch {
      return null;
    }
    master = audio.createGain();
    // Everything stays soft: the loudest sound peaks well below full volume.
    master.gain.value = 0.55;
    master.connect(audio.destination);
  }
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  return audio;
}

if (web && typeof document !== 'undefined') {
  const unlock = () => {
    gesture = true;
    const ctx = context();
    if (ctx && ctx.state === 'running') {
      for (const e of EVENTS) document.removeEventListener(e, unlock, true);
    }
  };
  const EVENTS = ['pointerdown', 'touchend', 'keydown', 'click'] as const;
  for (const e of EVENTS) document.addEventListener(e, unlock, true);
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise) return noise;
  const length = Math.floor(ctx.sampleRate * 0.5);
  noise = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

type Tone = {
  freq: number;
  at?: number;
  length: number;
  type?: OscillatorType;
  volume?: number;
  /** Frequency reached at the end, for slides. */
  to?: number;
};
type Hiss = {
  at?: number;
  length: number;
  volume?: number;
  /** Centre of the band of noise kept, in Hz. */
  band: number;
  q?: number;
};

function tone(ctx: AudioContext, start: number, n: Tone) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t = start + (n.at ?? 0);
  osc.type = n.type ?? 'sine';
  osc.frequency.setValueAtTime(n.freq, t);
  if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, t + n.length);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(n.volume ?? 0.15, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + n.length);
  osc.connect(gain).connect(master!);
  osc.start(t);
  osc.stop(t + n.length + 0.03);
}

function hiss(ctx: AudioContext, start: number, n: Hiss) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = n.band;
  filter.Q.value = n.q ?? 1;
  const gain = ctx.createGain();
  const t = start + (n.at ?? 0);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(n.volume ?? 0.2, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + n.length);
  src.connect(filter).connect(gain).connect(master!);
  // Start somewhere in the noise so two hisses never sound exactly alike.
  src.start(t, Math.random() * 0.3, n.length + 0.02);
}

const clink = (at: number, pitch = 1): Tone[] => [
  { freq: 4200 * pitch, at, length: 0.07, type: 'triangle', volume: 0.05 },
  { freq: 5900 * pitch, at: at + 0.004, length: 0.05, volume: 0.03 },
];

/** Each sound, as tones and bursts of noise, starting at `t`. */
const RECIPES: Record<SoundName, (ctx: AudioContext, t: number) => void> = {
  deal: (ctx, t) => hiss(ctx, t, { length: 0.07, band: 2600, q: 0.7, volume: 0.16 }),
  flip: (ctx, t) => {
    hiss(ctx, t, { length: 0.05, band: 3400, q: 0.9, volume: 0.14 });
    tone(ctx, t, { freq: 1700, at: 0.03, length: 0.03, type: 'triangle', volume: 0.03 });
  },
  chip: (ctx, t) => {
    hiss(ctx, t, { length: 0.03, band: 5000, q: 2, volume: 0.08 });
    clink(0).forEach((n) => tone(ctx, t, n));
  },
  bet: (ctx, t) => {
    [0, 0.055, 0.1].forEach((at, i) => {
      hiss(ctx, t, { at, length: 0.03, band: 4800, q: 2, volume: 0.07 });
      clink(at, 1 - i * 0.06).forEach((n) => tone(ctx, t, n));
    });
  },
  dice: (ctx, t) => {
    // A rattle in the hand, then a few bounces on the felt, quieter each time.
    let at = 0;
    for (let i = 0; i < 7; i++) {
      hiss(ctx, t, {
        at,
        length: 0.035,
        band: 1600 + Math.random() * 1200,
        q: 3,
        volume: 0.2 * (1 - i / 9),
      });
      tone(ctx, t, { freq: 700 + Math.random() * 300, at, length: 0.03, type: 'triangle', volume: 0.03 });
      at += 0.04 + Math.random() * 0.045;
    }
  },
  tap: (ctx, t) => tone(ctx, t, { freq: 1250, length: 0.03, volume: 0.025 }),
  turn: (ctx, t) => {
    tone(ctx, t, { freq: 880, length: 0.18, volume: 0.09 });
    tone(ctx, t, { freq: 1320, at: 0.11, length: 0.32, volume: 0.08 });
  },
  win: (ctx, t) => {
    [523.25, 659.25, 783.99].forEach((freq, i) =>
      tone(ctx, t, { freq, at: i * 0.1, length: 0.22, type: 'triangle', volume: 0.1 }),
    );
    // Final chord, held a little longer.
    [1046.5, 1318.5, 1568].forEach((freq) =>
      tone(ctx, t, { freq, at: 0.3, length: 0.7, type: 'triangle', volume: 0.06 }),
    );
  },
  lose: (ctx, t) => {
    [392, 329.63, 261.63].forEach((freq, i) =>
      tone(ctx, t, { freq, at: i * 0.16, length: 0.3, type: 'triangle', volume: 0.08 }),
    );
    tone(ctx, t, { freq: 261.63, to: 220, at: 0.48, length: 0.5, type: 'sine', volume: 0.06 });
  },
  fold: (ctx, t) => {
    tone(ctx, t, { freq: 240, to: 150, length: 0.14, type: 'triangle', volume: 0.08 });
    hiss(ctx, t, { length: 0.08, band: 900, q: 0.8, volume: 0.06 });
  },
  pop: (ctx, t) => tone(ctx, t, { freq: 900, to: 1600, length: 0.09, volume: 0.06 }),
  invalid: (ctx, t) => {
    tone(ctx, t, { freq: 180, length: 0.09, type: 'square', volume: 0.025 });
    tone(ctx, t, { freq: 150, at: 0.1, length: 0.12, type: 'square', volume: 0.025 });
  },
  drop: (ctx, t) => {
    tone(ctx, t, { freq: 520, to: 260, length: 0.09, type: 'triangle', volume: 0.1 });
    hiss(ctx, t, { length: 0.05, band: 1200, q: 1.5, volume: 0.12 });
  },
};

/** The shortest gap between two plays of the same sound: a burst of identical calls plays once. */
const GAP_MS: Partial<Record<SoundName, number>> = {
  deal: 30,
  chip: 60,
  dice: 250,
  win: 800,
  lose: 800,
  turn: 500,
};
const lastPlayed: Partial<Record<SoundName, number>> = {};

/** Plays one sound effect. Does nothing when sounds are off, before the first touch, or off the web. */
export function play(name: SoundName, options?: { delay?: number }) {
  const delay = options?.delay ?? 0;
  if (delay > 0) {
    setTimeout(() => play(name), delay);
    return;
  }
  const ctx = context();
  if (!ctx || ctx.state === 'closed') return;
  const now = Date.now();
  if (now - (lastPlayed[name] ?? 0) < (GAP_MS[name] ?? 30)) return;
  lastPlayed[name] = now;
  try {
    RECIPES[name](ctx, ctx.currentTime + 0.005);
  } catch {
    // An old browser without one of the nodes: stay silent.
  }
  // Lets anything interested (tests, a future visualizer) know a sound was played.
  if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('appli-poker-son', { detail: name }));
  }
}

// ---------------------------------------------------------------------------------------------
// Vibrations

const PATTERNS: Record<HapticName, number | number[]> = {
  turn: [0, 60, 60, 60],
  win: [0, 90, 60, 90, 60, 160],
  invalid: [0, 40, 40, 40, 40, 40],
};

/** Vibrates the phone briefly. Does nothing when vibrations are off or the phone cannot (iPhones). */
export function buzz(name: HapticName) {
  if (!settings.vibration) return;
  if (Platform.OS === 'web') {
    if (!gesture || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    try {
      navigator.vibrate(PATTERNS[name]);
    } catch {
      // Some browsers refuse without saying why.
    }
  } else {
    Vibration.vibrate(PATTERNS[name]);
  }
}
