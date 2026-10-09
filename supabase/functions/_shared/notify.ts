// What the notifications say and who gets them, without any database or network access so it
// can be tested on its own. Sending lives in push.ts.
import { GameError } from '../poker/logic.ts';
import { fromBase64Url } from './webpush.ts';

export type NoticeLang = 'fr' | 'en';

/** A notification as the service worker shows it. */
export interface Notice {
  kind: 'invite' | 'turn';
  title: string;
  body: string;
  /** Notifications with the same tag replace each other on the phone. */
  tag: string;
  /** Page to open on a tap, relative to the site. */
  url: string;
}

export interface CleanSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  lang: NoticeLang;
}

/**
 * Push services of the browsers that support Web Push. The server only ever posts to these, so a
 * player cannot make it call any other address.
 */
export const PUSH_HOSTS = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'push.services.mozilla.com',
  'notify.windows.com',
  'push.apple.com',
];

/** A player keeps at most this many devices with notifications. */
export const MAX_SUBSCRIPTIONS = 10;

export function cleanLang(raw: unknown): NoticeLang {
  return raw === 'en' ? 'en' : 'fr';
}

/** Checks a browser subscription before keeping it. */
export function cleanSubscription(raw: unknown, lang: unknown): CleanSubscription {
  const sub = (raw ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = typeof sub.endpoint === 'string' ? sub.endpoint : '';
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new GameError('Abonnement aux notifications invalide');
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== 'https:' ||
    url.port !== '' ||
    url.username !== '' ||
    endpoint.length > 1024 ||
    !PUSH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  ) {
    throw new GameError('Abonnement aux notifications invalide');
  }
  const p256dh = typeof sub.keys?.p256dh === 'string' ? sub.keys.p256dh : '';
  const auth = typeof sub.keys?.auth === 'string' ? sub.keys.auth : '';
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(p256dh) || !/^[A-Za-z0-9_-]+={0,2}$/.test(auth)) {
    throw new GameError('Abonnement aux notifications invalide');
  }
  const key = fromBase64Url(p256dh.replace(/=+$/, ''));
  const secret = fromBase64Url(auth.replace(/=+$/, ''));
  if (key.length !== 65 || key[0] !== 4 || secret.length !== 16) {
    throw new GameError('Abonnement aux notifications invalide');
  }
  return {
    endpoint,
    p256dh: p256dh.replace(/=+$/, ''),
    auth: auth.replace(/=+$/, ''),
    lang: cleanLang(lang),
  };
}

/** A push service answering this means the browser dropped the subscription: forget it. */
export function subscriptionGone(status: number): boolean {
  return status === 404 || status === 410;
}

const GAME_NAMES: Record<string, { fr: string; en: string }> = {
  poker: { fr: 'Poker', en: 'Poker' },
  blackjack: { fr: 'Blackjack', en: 'Blackjack' },
  president: { fr: 'Président', en: 'President' },
  yams: { fr: 'Yams', en: 'Yahtzee' },
  belote: { fr: 'Belote', en: 'Belote' },
  puissance4: { fr: 'Puissance 4', en: 'Connect 4' },
  uno: { fr: 'Uno', en: 'Uno' },
  huit: { fr: '8 américain', en: 'Crazy Eights' },
  rami: { fr: 'Rami', en: 'Rummy' },
  tarot: { fr: 'Tarot', en: 'Tarot' },
  perudo: { fr: 'Perudo', en: 'Liar’s Dice' },
};

export function gameName(game: string, lang: NoticeLang): string {
  return GAME_NAMES[game]?.[lang] ?? game.charAt(0).toUpperCase() + game.slice(1);
}

/** The page that joins (or gets back to) a table. */
export function tableUrl(game: string, code: string): string {
  return `./?jeu=${encodeURIComponent(game)}&table=${encodeURIComponent(code)}`;
}

/** A friend invites me to their table. */
export function inviteNotice(lang: NoticeLang, from: string, game: string, code: string): Notice {
  const name = gameName(game, lang);
  return {
    kind: 'invite',
    title: lang === 'en' ? `${from} invites you to play` : `${from} t’invite à jouer`,
    body:
      lang === 'en'
        ? `Join their ${name} table (code ${code}).`
        : `Rejoins sa table de ${name} (code ${code}).`,
    tag: `invite-${code}`,
    url: tableUrl(game, code),
  };
}

/** It is my turn at an online table. */
export function turnNotice(lang: NoticeLang, game: string, code: string): Notice {
  const name = gameName(game, lang);
  return {
    kind: 'turn',
    title: lang === 'en' ? 'Your turn!' : 'À toi de jouer !',
    body:
      lang === 'en'
        ? `Your friends are waiting for you at the ${name} table.`
        : `Tes amis t’attendent à la table de ${name}.`,
    tag: `turn-${code}`,
    url: tableUrl(game, code),
  };
}

/** What is sent to the browser: small, since push services cap messages at about 4 KB. */
export function noticePayload(notice: Notice): string {
  return JSON.stringify({
    kind: notice.kind,
    title: notice.title.slice(0, 80),
    body: notice.body.slice(0, 200),
    tag: notice.tag,
    url: notice.url,
  });
}

/** People who must now play and did not have to before: those to tell it is their turn. */
export function newTurns(before: string[], after: string[], bots: string[] = []): string[] {
  return [...new Set(after)].filter((id) => !before.includes(id) && !bots.includes(id));
}

/** Who must act in a poker hand, if anyone. */
export function pokerToAct(
  hand: { street: string; toAct: number; players: { id: string }[] } | null,
): string[] {
  if (!hand || hand.street === 'finished' || hand.toAct < 0) return [];
  const id = hand.players[hand.toAct]?.id;
  return id ? [id] : [];
}

/** Invites from one player to one friend for one table: at most one a minute. */
export const INVITE_COOLDOWN_MS = 60_000;

export function canInviteAgain(lastSent: string | null | undefined, now: number): boolean {
  if (!lastSent) return true;
  return now - new Date(lastSent).getTime() >= INVITE_COOLDOWN_MS;
}
