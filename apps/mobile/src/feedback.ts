import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Vibration } from 'react-native';
import type { HandView } from '@appli-poker/engine';

/**
 * Short sound effects, synthesized with the Web Audio API so no sound files are needed.
 * They play in the web version; on a native build only vibrations are used.
 */
type Note = { freq: number; at: number; length: number; type?: OscillatorType; volume?: number };

let audio: AudioContext | null = null;
let muted = false;
const listeners = new Set<(m: boolean) => void>();
const MUTE_KEY = 'appli-poker:muted';

AsyncStorage.getItem(MUTE_KEY)
  .then((v) => setMuted(v === '1'))
  .catch(() => {});

function context(): AudioContext | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audio ??= new Ctor();
  return audio;
}

// Browsers only allow sound after the user has touched the page once.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const unlock = () => {
    context()
      ?.resume()
      .catch(() => {});
    document.removeEventListener('pointerdown', unlock);
  };
  document.addEventListener('pointerdown', unlock);
}

function play(notes: Note[]) {
  const ctx = context();
  if (muted || !ctx || ctx.state !== 'running') return;
  const start = ctx.currentTime;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = n.type ?? 'sine';
    osc.frequency.value = n.freq;
    const t = start + n.at;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(n.volume ?? 0.18, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + n.length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + n.length + 0.02);
  }
}

function vibrate(pattern: number | number[]) {
  if (muted) return;
  if (Platform.OS === 'web') {
    // Not every browser can vibrate (iPhones cannot).
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  } else {
    Vibration.vibrate(pattern);
  }
}

export const sounds = {
  myTurn() {
    play([
      { freq: 880, at: 0, length: 0.18 },
      { freq: 1320, at: 0.12, length: 0.3 },
    ]);
    vibrate([0, 120, 80, 120]);
  },
  card() {
    play([{ freq: 2400, at: 0, length: 0.05, type: 'triangle', volume: 0.08 }]);
  },
  chips() {
    play([
      { freq: 3200, at: 0, length: 0.04, type: 'square', volume: 0.04 },
      { freq: 2600, at: 0.05, length: 0.05, type: 'square', volume: 0.04 },
    ]);
  },
  fold() {
    play([{ freq: 300, at: 0, length: 0.12, type: 'triangle', volume: 0.08 }]);
  },
  win() {
    play(
      [523, 659, 784, 1047].map((freq, i) => ({
        freq,
        at: i * 0.11,
        length: 0.35,
        type: 'triangle' as const,
      })),
    );
    vibrate(200);
  },
  reaction() {
    play([{ freq: 1500, at: 0, length: 0.08, volume: 0.06 }]);
  },
};

export function setMuted(value: boolean) {
  muted = value;
  AsyncStorage.setItem(MUTE_KEY, value ? '1' : '0').catch(() => {});
  listeners.forEach((l) => l(value));
}

export function useMuted(): [boolean, (m: boolean) => void] {
  const [value, setValue] = useState(muted);
  useEffect(() => {
    listeners.add(setValue);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return [value, setMuted];
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
    if (hand.board.length > before.board.length) sounds.card();
    const paid = hand.players.some((p, i) => p.totalBet > (before.players[i]?.totalBet ?? 0));
    const folded = hand.players.some((p, i) => p.folded && !before.players[i]?.folded);
    if (paid) sounds.chips();
    else if (folded) sounds.fold();
    if (hand.street === 'finished' && before.street !== 'finished') {
      const winners = hand.pots.flatMap((p) => p.winners);
      if (!meId || winners.includes(meId)) sounds.win();
    }
    const actor = hand.toAct >= 0 ? hand.players[hand.toAct].id : null;
    const beforeActor = before.toAct >= 0 ? before.players[before.toAct].id : null;
    if (meId && actor === meId && beforeActor !== meId) sounds.myTurn();
  }, [hand, meId]);
}
