import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameError } from '../poker/logic.ts';
import { ONLINE_GAMES, QUICK_GAMES, QUICK_GAME_IDS } from '../_shared/engine/index.ts';
import {
  QUEUE_FILL_AFTER_MS,
  QUEUE_JOIN_LIMIT,
  QUEUE_JOIN_WINDOW_MS,
  QUEUE_MATCHED_KEEP_MS,
  QUEUE_STALE_MS,
  OPEN_TABLE_MS,
  type QueueRow,
  blockRow,
  blockedAtTable,
  checkBlock,
  expiryCutoffs,
  freeName,
  checkQueueJoin,
  cleanVisibility,
  fillGroup,
  isExpired,
  isRated,
  isWaiting,
  newQueueRow,
  openTables,
  pairQueue,
  queueStatus,
  quickGameRoom,
  quickPokerRoom,
  ratingChanges,
  ratingWindow,
  uniqueNames,
} from './rapide.ts';
import { startGame } from './logic.ts';

const NOW = Date.parse('2026-10-13T12:00:00Z');
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const uid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

function row(id: string, over: Partial<QueueRow> = {}): QueueRow {
  return {
    user_id: id,
    game: 'uno',
    size: 2,
    variant: '',
    ranked: false,
    rating: 1000,
    level: 5,
    name: id,
    avatar: '🦊',
    avatar_color: '#e76f51',
    status: 'waiting',
    joined_at: iso(1_000),
    last_seen: iso(500),
    room_id: null,
    room_code: null,
    joins: 1,
    joins_since: iso(1_000),
    ...over,
  };
}

test('the rating window starts narrow, widens every 10 seconds, and opens after a minute', () => {
  assert.equal(ratingWindow(0), 100);
  assert.equal(ratingWindow(9_999), 100);
  assert.equal(ratingWindow(10_000), 200);
  assert.equal(ratingWindow(45_000), 500);
  assert.equal(ratingWindow(60_000), Infinity);
});

test('two players waiting for the same game are seated together, longest wait first', () => {
  const tables = pairQueue(
    [row('b', { joined_at: iso(2_000) }), row('a', { joined_at: iso(5_000) })],
    [],
    NOW,
  );
  assert.deepEqual(tables, [['a', 'b']]);
});

test('a table is only made once it is full', () => {
  const rows = [row('a', { size: 3 }), row('b', { size: 3 })];
  assert.deepEqual(pairQueue(rows, [], NOW), []);
  assert.deepEqual(
    pairQueue([...rows, row('c', { size: 3 })], [], NOW).map((t) => t.sort()),
    [['a', 'b', 'c']],
  );
});

test('another game, table size or variant is another queue', () => {
  assert.deepEqual(pairQueue([row('a'), row('b', { game: 'huit' })], [], NOW), []);
  assert.deepEqual(pairQueue([row('a'), row('b', { size: 3 })], [], NOW), []);
  assert.deepEqual(
    pairQueue(
      [row('a', { game: 'poker', variant: 'holdem' }), row('b', { game: 'poker', variant: 'omaha' })],
      [],
      NOW,
    ),
    [],
  );
});

test('the closest rating is chosen first', () => {
  const rows = [
    row('me', { rating: 1200, joined_at: iso(9_000) }),
    row('far', { rating: 1290, joined_at: iso(8_000) }),
    row('close', { rating: 1180, joined_at: iso(1_000) }),
  ];
  assert.deepEqual(pairQueue(rows, [], NOW), [['me', 'close']]);
});

test('between equal ratings, the closest level wins', () => {
  const rows = [
    row('me', { level: 20, joined_at: iso(9_000) }),
    row('low', { level: 2, joined_at: iso(8_000) }),
    row('near', { level: 18, joined_at: iso(1_000) }),
  ];
  assert.deepEqual(pairQueue(rows, [], NOW), [['me', 'near']]);
});

test('ratings far apart wait until the window has widened enough', () => {
  const pair = (waited: number) => [
    row('a', { rating: 1000, joined_at: iso(waited) }),
    row('b', { rating: 1350, joined_at: iso(1_000) }),
  ];
  assert.deepEqual(pairQueue(pair(5_000), [], NOW), []);
  assert.deepEqual(pairQueue(pair(29_000), [], NOW), []);
  // After 30 s the one who waited accepts 400 points of difference.
  assert.deepEqual(pairQueue(pair(30_000), [], NOW), [['a', 'b']]);
  const extreme = [row('a', { rating: 2400, joined_at: iso(61_000) }), row('b', { rating: 400 })];
  assert.deepEqual(pairQueue(extreme, [], NOW), [['a', 'b']]);
});

test('every member of a bigger table must suit all the others', () => {
  const rows = [
    row('a', { size: 3, rating: 1000, joined_at: iso(9_000) }),
    row('b', { size: 3, rating: 1090, joined_at: iso(8_000) }),
    row('c', { size: 3, rating: 910, joined_at: iso(7_000) }),
  ];
  // b and c are 180 apart: too far while everyone waited under 10 s.
  assert.deepEqual(pairQueue(rows, [], NOW), []);
  const later = rows.map((r) => ({ ...r, joined_at: iso(12_000) }));
  assert.equal(pairQueue(later, [], NOW).length, 1);
});

test('blocked players are never seated together, whoever blocked whom', () => {
  const rows = [row('a', { joined_at: iso(5_000) }), row('b')];
  assert.deepEqual(pairQueue(rows, [{ user_id: 'a', blocked_id: 'b' }], NOW), []);
  assert.deepEqual(pairQueue(rows, [{ user_id: 'b', blocked_id: 'a' }], NOW), []);
  const three = [...rows, row('c', { joined_at: iso(3_000) })];
  assert.deepEqual(pairQueue(three, [{ user_id: 'a', blocked_id: 'b' }], NOW), [['a', 'c']]);
});

test('ghosts (not heard from), people who left and people already seated are skipped', () => {
  const rows = [
    row('a'),
    row('ghost', { last_seen: iso(QUEUE_STALE_MS + 1) }),
    row('gone', { status: 'left' }),
    row('seated', { status: 'matched', room_id: 'r' }),
  ];
  assert.deepEqual(pairQueue(rows, [], NOW), []);
  assert.ok(isWaiting(rows[0], NOW));
  assert.ok(!isWaiting(rows[1], NOW));
  assert.ok(isWaiting(row('slow', { last_seen: iso(QUEUE_STALE_MS - 1) }), NOW));
});

test('many players make several tables, nobody twice', () => {
  const rows = Array.from({ length: 9 }, (_, i) =>
    row(`p${i}`, { joined_at: iso(10_000 - i), rating: 1000 + i * 10 }),
  );
  const tables = pairQueue(rows, [], NOW);
  assert.equal(tables.length, 4);
  const seated = tables.flat();
  assert.equal(new Set(seated).size, 8);
  assert.equal(pairQueue(rows, [], NOW, 2).length, 2);
});

test('expired rows: ghosts at once, seated players after a while, left rows after the rate window', () => {
  assert.ok(isExpired(row('g', { last_seen: iso(QUEUE_STALE_MS + 1) }), NOW));
  assert.ok(!isExpired(row('w'), NOW));
  assert.ok(!isExpired(row('m', { status: 'matched', last_seen: iso(60_000) }), NOW));
  assert.ok(isExpired(row('m', { status: 'matched', last_seen: iso(QUEUE_MATCHED_KEEP_MS + 1) }), NOW));
  assert.ok(!isExpired(row('l', { status: 'left', joins_since: iso(60_000) }), NOW));
  assert.ok(isExpired(row('l', { status: 'left', joins_since: iso(QUEUE_JOIN_WINDOW_MS + 1) }), NOW));
});

test('the waiting screen sees the players found, the time waited, and robots after 30 s', () => {
  const me = row('me', { size: 4, joined_at: iso(12_000) });
  const others = [
    row('x', { size: 4 }),
    row('y', { size: 4, game: 'huit' }),
    row('z', { size: 4, rating: 1500 }),
  ];
  const s = queueStatus(me, [me, ...others], [], NOW);
  assert.equal(s.status, 'waiting');
  assert.equal(s.found, 1);
  assert.equal(s.waited, 12_000);
  assert.equal(s.canFill, false);
  const later = queueStatus({ ...me, joined_at: iso(QUEUE_FILL_AFTER_MS) }, [me, ...others], [], NOW);
  assert.equal(later.canFill, true);
  assert.equal(queueStatus(null, [], [], NOW).status, 'none');
  assert.equal(queueStatus(row('me', { status: 'left' }), [], [], NOW).status, 'none');
  assert.equal(queueStatus(row('me', { last_seen: iso(QUEUE_STALE_MS + 5) }), [], [], NOW).status, 'none');
});

test('the waiting screen learns its table once it is ready, not before', () => {
  const seating = row('me', { status: 'matched', room_id: 'r1', size: 3 });
  assert.equal(queueStatus(seating, [], [], NOW).status, 'waiting');
  assert.equal(queueStatus(seating, [], [], NOW).found, 2);
  const ready = queueStatus({ ...seating, room_code: 'ABC123' }, [], [], NOW);
  assert.deepEqual([ready.status, ready.roomId, ready.code, ready.game], ['matched', 'r1', 'ABC123', 'uno']);
});

test('starting with robots takes me and the players found, only after waiting', () => {
  const me = row('me', { size: 4, joined_at: iso(QUEUE_FILL_AFTER_MS) });
  const rows = [
    me,
    row('x', { size: 4, joined_at: iso(4_000) }),
    row('blk', { size: 4 }),
    row('far', { size: 4, rating: 2000 }),
  ];
  assert.deepEqual(fillGroup(me, rows, [{ user_id: 'blk', blocked_id: 'me' }], NOW), ['me', 'x']);
  assert.throws(() => fillGroup({ ...me, joined_at: iso(3_000) }, rows, [], NOW), GameError);
  assert.throws(() => fillGroup({ ...me, status: 'left' }, rows, [], NOW), /ne cherches plus/);
  // Alone: robots everywhere else.
  assert.deepEqual(fillGroup(me, [me], [], NOW), ['me']);
});

test('searches are limited: 2 s apart, 30 every 10 minutes', () => {
  assert.deepEqual(checkQueueJoin(null, NOW), { joins: 1, joins_since: iso(0) });
  assert.throws(() => checkQueueJoin(row('a', { joined_at: iso(1_000) }), NOW), /Doucement/);
  const prev = row('a', { joined_at: iso(5_000), joins: 4, joins_since: iso(60_000) });
  assert.deepEqual(checkQueueJoin(prev, NOW), { joins: 5, joins_since: iso(60_000) });
  assert.throws(() => checkQueueJoin({ ...prev, joins: QUEUE_JOIN_LIMIT }, NOW), /Trop de recherches/);
  // A new window starts after 10 minutes.
  assert.deepEqual(
    checkQueueJoin({ ...prev, joins: QUEUE_JOIN_LIMIT, joins_since: iso(QUEUE_JOIN_WINDOW_MS + 1) }, NOW),
    {
      joins: 1,
      joins_since: iso(0),
    },
  );
});

test('a new search is checked: known game, allowed size and variant, level from experience', () => {
  const look = { name: 'Léa', avatar: '🦄', avatar_color: '#8e7dbe' };
  const r = newQueueRow('me', { game: 'poker', size: 6, variant: 'omaha' }, look, 1040, 2000, null, NOW);
  assert.deepEqual([r.game, r.size, r.variant, r.rating, r.status], ['poker', 6, 'omaha', 1040, 'waiting']);
  assert.ok(r.level > 1);
  const odd = newQueueRow('me', { game: 'echecs', size: 5, variant: 'x' }, look, 1000, 0, null, NOW);
  assert.deepEqual([odd.size, odd.variant, odd.level], [2, '', 1]);
  assert.throws(() => newQueueRow('me', { game: 'loto' }, look, 1000, 0, null, NOW), /Jeu inconnu/);
});

test('names at a quick table are made different', () => {
  assert.deepEqual(uniqueNames(['Léa', 'léa', 'Tom', 'Léa']), ['Léa', 'léa 2', 'Tom', 'Léa 3']);
  assert.deepEqual(uniqueNames(['Abcdefghijklmnop', 'Abcdefghijklmnop']), [
    'Abcdefghijklmnop',
    'Abcdefghijklm 2',
  ]);
});

test('every online game can start a quick table, robots filling what the game needs', () => {
  for (const game of Object.keys(ONLINE_GAMES) as (keyof typeof ONLINE_GAMES)[]) {
    for (const size of QUICK_GAMES[game].sizes) {
      const group = Array.from({ length: size }, (_, i) => row(uid(i + 1), { game, size, name: 'Joueur' }));
      const { room, players } = quickGameRoom('room-1', 'ABC123', group);
      assert.equal(room.visibility, 'quick');
      assert.equal(room.host_id, uid(1));
      assert.deepEqual(
        players.map((p) => p.seat),
        group.map((_, i) => i),
      );
      assert.equal(new Set(players.map((p) => p.name.toLowerCase())).size, size);
      const started = startGame(
        { ...room, status: 'lobby', version: 0 },
        players,
        uid(1),
        () => crypto.randomUUID(),
        (n) => Math.floor(Math.random() * n),
        NOW,
      );
      assert.ok(started.snapshot.public.seats.length >= size, `${game} ${size}`);
      // Only this table's people get a private view.
      for (const p of players) assert.ok(p.user_id in started.snapshot.privates);
    }
  }
});

test('a quick poker table is a sit-and-go with the asked variant', () => {
  const group = [
    row(uid(1), { game: 'poker', variant: 'omaha', size: 2 }),
    row(uid(2), { game: 'poker', variant: 'omaha', size: 2 }),
  ];
  const { room, players } = quickPokerRoom('p1', 'XYZ789', group);
  assert.equal(room.variant, 'omaha');
  assert.ok(room.level_minutes);
  assert.equal(room.visibility, 'quick');
  assert.deepEqual(
    players.map((p) => p.stack),
    [room.starting_stack, room.starting_stack],
  );
});

test('every quick game id is either poker or an online game', () => {
  for (const g of QUICK_GAME_IDS) assert.ok(g === 'poker' || g in ONLINE_GAMES);
});

test('tables are private unless their creator chose public; only stranger tables are rated', () => {
  assert.equal(cleanVisibility(undefined), 'private');
  assert.equal(cleanVisibility('quick'), 'private');
  assert.equal(cleanVisibility('public'), 'public');
  assert.ok(isRated('public'));
  assert.ok(isRated('quick'));
  assert.ok(!isRated('private'));
  assert.ok(!isRated(null));
});

test('rating changes: people only, at least two, ratings read or 1000 to start', () => {
  assert.deepEqual(ratingChanges([{ userId: 'a', place: 1 }], []), []);
  const changes = ratingChanges(
    [
      { userId: 'a', place: 1 },
      { userId: 'b', place: 2 },
    ],
    [{ user_id: 'b', rating: 1000, games: 40 }],
  );
  assert.deepEqual(changes, [
    { user_id: 'a', delta: 24, won: true },
    { user_id: 'b', delta: -16, won: false },
  ]);
  // Everyone shares the first place: a draw, nobody "won" more than the others.
  const draw = ratingChanges(
    [
      { userId: 'a', place: 1 },
      { userId: 'b', place: 1 },
    ],
    [],
  );
  assert.deepEqual(
    draw.map((c) => [c.delta, c.won]),
    [
      [0, true],
      [0, true],
    ],
  );
});

test('blocks: checked ids, never myself, a limit', () => {
  const me = uid(1);
  assert.equal(checkBlock(me, uid(2).toUpperCase(), 0), uid(2));
  assert.throws(() => checkBlock(me, me, 0), /toi-même/);
  assert.throws(() => checkBlock(me, 'robot-1', 0), /inconnu/);
  assert.throws(() => checkBlock(me, uid(2), 500), /trop/);
  const seated = [
    { user_id: uid(2), is_bot: false },
    { user_id: uid(3), is_bot: true },
  ];
  assert.ok(blockedAtTable(me, seated, [{ user_id: uid(2), blocked_id: me }]));
  assert.ok(!blockedAtTable(me, seated, [{ user_id: me, blocked_id: uid(9) }]));
});

test('open tables: waiting public tables of others, not full, not blocked, recent first', () => {
  const me = uid(1);
  const rooms = [
    { id: 'r1', code: 'AAA111', game: 'uno' as const, host_id: uid(2), created_at: iso(60_000) },
    { id: 'r2', code: 'BBB222', game: 'echecs' as const, host_id: uid(3), created_at: iso(30_000) },
    { id: 'r3', code: 'CCC333', game: 'yams' as const, host_id: uid(4), created_at: iso(10_000) },
    { id: 'r4', code: 'DDD444', game: 'uno' as const, host_id: uid(5), created_at: iso(OPEN_TABLE_MS + 1) },
    { id: 'r5', code: 'EEE555', game: 'poker' as const, host_id: uid(6), created_at: iso(5_000) },
    { id: 'r6', code: 'FFF666', game: 'uno' as const, host_id: me, created_at: iso(5_000) },
  ];
  const p = (room_id: string, user_id: string, is_bot = false) => ({
    room_id,
    user_id,
    name: user_id.slice(-2),
    avatar: '🐼',
    avatar_color: '#4ea8de',
    is_bot,
  });
  const seated = [
    p('r1', uid(2)),
    p('r1', 'bot-1', true),
    p('r2', uid(3)),
    p('r2', uid(7)), // full: chess is for two
    p('r3', uid(4)),
    p('r4', uid(5)),
    p('r5', uid(6)),
    p('r5', uid(8)),
    p('r6', me),
  ];
  const list = openTables(rooms, seated, { [uid(2)]: 12 }, [{ user_id: uid(8), blocked_id: me }], me, NOW);
  assert.deepEqual(
    list.map((t) => t.code),
    ['CCC333', 'AAA111'],
  );
  assert.deepEqual(list[1], {
    code: 'AAA111',
    game: 'uno',
    players: 2,
    max: ONLINE_GAMES.uno.maxPlayers,
    host: { name: '02', avatar: '🐼', avatar_color: '#4ea8de', level: 12 },
    created_at: iso(60_000),
  });
  assert.equal(list[0].host.level, 1);
});

test('the database deletes exactly the expired rows', () => {
  const rows = [
    row('w1', { last_seen: iso(QUEUE_STALE_MS + 1) }),
    row('w2', { last_seen: iso(QUEUE_STALE_MS - 1) }),
    row('m1', { status: 'matched', last_seen: iso(QUEUE_MATCHED_KEEP_MS + 1) }),
    row('m2', { status: 'matched', last_seen: iso(QUEUE_MATCHED_KEEP_MS - 1) }),
    row('l1', { status: 'left', joins_since: iso(QUEUE_JOIN_WINDOW_MS + 1) }),
    row('l2', { status: 'left', joins_since: iso(QUEUE_JOIN_WINDOW_MS - 1) }),
  ];
  const cuts = expiryCutoffs(NOW);
  for (const r of rows) {
    const deleted = cuts.some((c) => c.status === r.status && (r as any)[c.column] < c.before);
    assert.equal(deleted, isExpired(r, NOW), r.user_id);
  }
});

test('a block keeps what the blocker saw, cleaned', () => {
  const me = uid(1);
  assert.deepEqual(
    blockRow(me, { userId: uid(2), name: '  Zoé  ', avatar: '🐱', avatarColor: '#e9c46a' }, 3),
    {
      user_id: me,
      blocked_id: uid(2),
      name: 'Zoé',
      avatar: '🐱',
      avatar_color: '#e9c46a',
    },
  );
  assert.deepEqual(blockRow(me, { userId: uid(2), name: 7, avatar: 'x'.repeat(40), avatarColor: 'red' }, 0), {
    user_id: me,
    blocked_id: uid(2),
    name: null,
    avatar: null,
    avatar_color: null,
  });
});

test('a stranger with a name already taken at a public table gets a number', () => {
  assert.equal(freeName(['Léa', 'Tom'], 'léa'), 'léa 2');
  assert.equal(freeName(['Léa', 'Léa 2'], 'Léa'), 'Léa 3');
  assert.equal(freeName([], 'Tom'), 'Tom');
});
