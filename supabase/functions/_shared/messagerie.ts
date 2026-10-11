// Messages between friends: what may be sent, how often, and when the friend gets a
// notification. No database or network access, so it can be tested on its own.
import { GameError } from '../poker/logic.ts';

/** Longest message, in characters (the database checks it too). */
export const MESSAGE_MAX = 500;

/** At most this many messages in MESSAGE_BURST_MS, and MESSAGE_HOURLY in an hour (as the database). */
export const MESSAGE_BURST = 5;
export const MESSAGE_BURST_MS = 10_000;
export const MESSAGE_HOURLY = 150;

/** A friend gets one notification for a run of unread messages, then another after this long. */
export const MESSAGE_NOTIFY_GAP_MS = 120_000;

/**
 * A message as it is kept: trimmed, without control characters (other than line breaks), at
 * most two blank lines in a row, and at most MESSAGE_MAX characters.
 */
export function cleanMessage(raw: unknown): string {
  if (typeof raw !== 'string') throw new GameError('Message vide');
  const text = raw
    .replace(/\r\n?/g, '\n')
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) throw new GameError('Message vide');
  // Counted in characters as the database does, never cutting an emoji in two.
  const chars = Array.from(text);
  return chars.length > MESSAGE_MAX ? chars.slice(0, MESSAGE_MAX).join('').trimEnd() : text;
}

/** Whether one more message may go out, given when my messages of the last hour were sent. */
export function canSendMessage(recent: (string | number)[], now: number): boolean {
  const times = recent.map((at) => (typeof at === 'number' ? at : new Date(at).getTime()));
  const lastHour = times.filter((at) => now - at < 3_600_000);
  if (lastHour.length >= MESSAGE_HOURLY) return false;
  return lastHour.filter((at) => now - at < MESSAGE_BURST_MS).length < MESSAGE_BURST;
}

/**
 * Whether my friend gets a notification for this message, given the one I sent them just
 * before: not while they have not read a recent one (they were already told).
 */
export function shouldNotifyMessage(
  previous: { created_at: string; read_at: string | null } | null | undefined,
  now: number,
): boolean {
  if (!previous || previous.read_at) return true;
  return now - new Date(previous.created_at).getTime() >= MESSAGE_NOTIFY_GAP_MS;
}

/** An id of a player, as Supabase makes them. */
export function cleanUserId(raw: unknown): string {
  const id = String(raw ?? '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new GameError('Joueur inconnu');
  }
  return id.toLowerCase();
}
