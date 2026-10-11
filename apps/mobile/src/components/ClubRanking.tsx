// The club's week: its challenge against another club, the ranking of its members, and the
// top clubs of the week (which the owner and admins can challenge).
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  type ClubChallengeRow,
  type ClubRole,
  challengeRefusal,
  clubCan,
  rankLeaderboard,
} from '@appli-poker/engine';
import { AvatarBadge } from './AvatarPicker';
import { ClubBadge } from './ClubBadge';
import { memberAvatar } from './ClubChat';
import {
  type ClubChallenge,
  type ClubMember,
  type ClubState,
  type TopClub,
  answerChallenge,
  cancelChallenge,
  challengeClub,
} from '../online/clubs';
import { tMessage } from '../online/messages';
import { timeLeft, useNow } from '../screens/ClassementPanel';
import { sounds } from '../feedback';
import { lang, t, tn } from '../i18n';
import { colors, gradients } from '../theme';

const MEDALS = ['🥇', '🥈', '🥉'];

/** "1er", "2e" in French, "1st", "2nd" in English. */
export function placeLabel(place: number): string {
  if (lang !== 'en') return place === 1 ? '1er' : `${place}e`;
  const tens = place % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][place % 10] ?? 'th');
  return `${place}${suffix}`;
}

/** A challenge between my club and another one: who leads, or who won. */
export function ChallengeCard({
  challenge,
  club,
  role,
  week,
  endsAt,
  onChanged,
}: {
  challenge: ClubChallenge;
  club: { name: string; emoji: string; color: string };
  role: ClubRole;
  week: string;
  endsAt: number;
  onChanged: () => void;
}) {
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const other = challenge.other ?? { name: t('Club disparu'), emoji: '❔', color: '#555555' };
  const admin = clubCan(role, 'challenge');
  const current = challenge.week === week;

  async function act(job: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await job();
      sounds.win();
      onChanged();
    } catch (e) {
      setError(tMessage((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  if (challenge.status === 'pending') {
    const incoming = !challenge.mine;
    return (
      <View style={[styles.duel, incoming && styles.duelIncoming]}>
        <View style={styles.duelTop}>
          <ClubBadge emoji={other.emoji} color={other.color} size={34} />
          <View style={styles.flex}>
            <Text style={styles.duelTitle} numberOfLines={2}>
              {incoming
                ? t('« {club} » défie ton club !', { club: other.name })
                : t('Défi envoyé à « {club} »', { club: other.name })}
            </Text>
            <Text style={styles.duelText}>
              {incoming
                ? admin
                  ? t('Accepte : le club qui marque le plus de points cette semaine gagne.')
                  : t('Le créateur ou un admin du club doit répondre.')
                : t('En attente de leur réponse…')}
            </Text>
          </View>
        </View>
        {admin && (
          <View style={styles.duelButtons}>
            {incoming ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => act(() => answerChallenge(challenge.id, false))}
                  style={styles.secondary}
                >
                  <Text style={styles.secondaryText}>{t('Refuser')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => act(() => answerChallenge(challenge.id, true))}
                  style={styles.primary}
                >
                  <LinearGradient colors={gradients.gold} style={styles.primaryInner}>
                    {busy ? (
                      <ActivityIndicator color={colors.onGold} />
                    ) : (
                      <Text style={styles.primaryText}>{t('⚔️ Relever le défi')}</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => act(() => cancelChallenge(challenge.id))}
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>{t('Annuler le défi')}</Text>
              </Pressable>
            )}
          </View>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  }

  if (challenge.status !== 'accepted') {
    return (
      <View style={styles.duel}>
        <Text style={styles.duelText}>
          {challenge.status === 'declined'
            ? challenge.mine
              ? t('« {club} » a refusé le défi.', { club: other.name })
              : t('Défi de « {club} » refusé.', { club: other.name })
            : t('Défi avec « {club} » annulé.', { club: other.name })}
        </Text>
      </View>
    );
  }

  // Scores from my side: the server gives them from the challenging club's side.
  const r = challenge.result;
  const flip = (pair: [number, number] | undefined): [number, number] =>
    !pair ? [0, 0] : challenge.mine ? pair : [pair[1], pair[0]];
  const duel = flip(r?.duel);
  const total = flip(r?.total);
  const winner = r?.winner === null || r?.winner === undefined ? null : (r.winner === 0) === challenge.mine;
  const met = duel[0] + duel[1] > 0;
  const shown = met ? duel : total;
  const share = shown[0] + shown[1] > 0 ? shown[0] / (shown[0] + shown[1]) : 0.5;
  const verdict = current
    ? r?.winner === null || r?.winner === undefined
      ? t('Égalité pour l’instant')
      : winner
        ? t('Ton club mène !')
        : t('Ton club est mené')
    : r?.winner === null || r?.winner === undefined
      ? t('Match nul')
      : winner
        ? t('Victoire de ton club ! 🏆')
        : t('Défaite… revanche la semaine prochaine ?');

  return (
    <LinearGradient colors={['#4a1d1d', '#1f1030']} style={[styles.duel, styles.duelLive]}>
      <View style={styles.duelHead}>
        <Text style={styles.duelLabel}>
          {current ? t('⚔️ Défi de la semaine') : t('⚔️ Défi de la semaine dernière')}
        </Text>
        {current && (
          <Text style={styles.duelTime}>{t('Fin dans {time}', { time: timeLeft(endsAt - now) })}</Text>
        )}
      </View>
      <View style={styles.versus}>
        <View style={styles.side}>
          <ClubBadge emoji={club.emoji} color={club.color} size={40} />
          <Text style={styles.sideName} numberOfLines={1}>
            {club.name}
          </Text>
        </View>
        <Text style={styles.score}>
          {shown[0]} <Text style={styles.scoreSep}>–</Text> {shown[1]}
        </Text>
        <View style={styles.side}>
          <ClubBadge emoji={other.emoji} color={other.color} size={40} />
          <Text style={styles.sideName} numberOfLines={1}>
            {other.name}
          </Text>
        </View>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barMine, { flex: Math.max(0.04, share), backgroundColor: club.color }]} />
        <View style={[styles.barOther, { flex: Math.max(0.04, 1 - share), backgroundColor: other.color }]} />
      </View>
      <Text style={[styles.verdict, winner === true && styles.verdictWin]}>{verdict}</Text>
      <Text style={styles.duelRule}>
        {met
          ? t('Points des parties jouées l’un contre l’autre (semaine : {a} – {b})', {
              a: total[0],
              b: total[1],
            })
          : t('Pas encore de partie entre vos membres : les points de la semaine comptent.')}
      </Text>
    </LinearGradient>
  );
}

/** The members of my club, best of the week first. */
export function MemberRanking({ members }: { members: ClubMember[] }) {
  const lines = rankLeaderboard(members, 'week');
  const index = new Map(members.map((m, i) => [m.user_id, i]));
  return (
    <View style={styles.list}>
      {lines.map((l) => (
        <View key={l.player.user_id} style={[styles.row, l.player.me && styles.rowMe]}>
          <Text style={styles.place}>{l.played > 0 ? (MEDALS[l.place - 1] ?? `${l.place}`) : '–'}</Text>
          <AvatarBadge
            avatar={memberAvatar(l.player as ClubMember, index.get(l.player.user_id) ?? 0)}
            size={34}
          />
          <View style={styles.flex}>
            <Text style={styles.rowName} numberOfLines={1}>
              {l.player.me ? t('{name} (toi)', { name: l.player.name }) : l.player.name}
            </Text>
            <Text style={styles.rowSub}>
              {tn(l.played, '{n} partie', '{n} parties')} · {tn(l.won, '{n} victoire', '{n} victoires')}
            </Text>
          </View>
          <Text style={styles.points}>{tn(l.points, '{n} pt', '{n} pts')}</Text>
        </View>
      ))}
    </View>
  );
}

/** The best clubs of the week; the owner and admins can challenge them from here. */
export function TopClubs({
  top,
  myClub,
  role,
  week,
  challenges,
  onChanged,
}: {
  top: TopClub[];
  myClub: string | null;
  role: ClubRole | null;
  week: string;
  challenges: ClubChallenge[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rows: ClubChallengeRow[] = challenges.map((c) => ({
    id: c.id,
    week: c.week,
    from_club: c.from_club,
    to_club: c.to_club,
    status: c.status,
  }));

  async function challenge(id: string) {
    setBusy(id);
    setError(null);
    try {
      await challengeClub(id);
      sounds.win();
      onChanged();
    } catch (e) {
      setError(tMessage((e as Error).message));
    } finally {
      setBusy(null);
    }
  }

  if (top.length === 0) {
    return <Text style={styles.empty}>{t('Aucun club pour l’instant : crée le premier !')}</Text>;
  }
  return (
    <View style={styles.list}>
      {error && <Text style={styles.error}>{error}</Text>}
      {top.map((c) => {
        const mine = c.club_id === myClub;
        const canChallenge =
          !!myClub &&
          !!role &&
          !mine &&
          clubCan(role, 'challenge') &&
          !challengeRefusal(myClub, c.club_id, week, rows);
        return (
          <View key={c.club_id} style={[styles.row, mine && styles.rowMe]}>
            <Text style={styles.place}>{c.points > 0 ? (MEDALS[c.place - 1] ?? `${c.place}`) : '–'}</Text>
            <ClubBadge emoji={c.club.emoji} color={c.club.color} size={32} />
            <View style={styles.flex}>
              <Text style={styles.rowName} numberOfLines={1}>
                {c.club.name}
              </Text>
              <Text style={styles.rowSub}>{tn(c.members, '{n} membre', '{n} membres')}</Text>
            </View>
            {canChallenge && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Défier {club}', { club: c.club.name })}
                disabled={busy !== null}
                onPress={() => challenge(c.club_id)}
                style={styles.challenge}
              >
                {busy === c.club_id ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : (
                  <Text style={styles.challengeText}>{t('⚔️ Défier')}</Text>
                )}
              </Pressable>
            )}
            <Text style={styles.points}>{tn(c.points, '{n} pt', '{n} pts')}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Last week's chest for my club's place, until it is taken. */
export function ClubChestBanner({
  chest,
  onClaim,
}: {
  chest: NonNullable<ClubState['chest']>;
  onClaim: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={async () => {
        setBusy(true);
        setError(null);
        try {
          await onClaim();
        } catch (e) {
          setError(tMessage((e as Error).message));
        } finally {
          setBusy(false);
        }
      }}
      style={[styles.chest, busy && { opacity: 0.6 }]}
    >
      <LinearGradient colors={['#6b4b00', '#3a2800']} style={styles.chestInner}>
        <Text style={styles.chestIcon}>{chest.kind === 'grand' ? '🏆' : '🎖️'}</Text>
        <View style={styles.flex}>
          <Text style={styles.chestTitle}>
            {t('Ton club a fini {place} la semaine dernière !', { place: placeLabel(chest.place) })}
          </Text>
          <Text style={styles.chestText}>
            {chest.kind === 'grand'
              ? t('Touche pour prendre ton grand coffre.')
              : t('Touche pour prendre ton coffre.')}
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
        {busy && <ActivityIndicator color={colors.gold} />}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  duel: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 10,
  },
  duelIncoming: { borderColor: '#ff6b6b', backgroundColor: 'rgba(230,57,70,0.14)' },
  duelLive: { borderColor: '#ff6b6b', overflow: 'hidden' },
  duelTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  duelTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  duelText: { color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  duelButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  duelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  duelLabel: {
    color: '#ffb3b3',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  duelTime: { color: colors.gold, fontSize: 12, fontWeight: '800' },
  versus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  side: { flex: 1, alignItems: 'center', gap: 6, minWidth: 0 },
  sideName: { color: colors.text, fontSize: 13, fontWeight: '800', maxWidth: '100%' },
  score: { color: '#fff', fontSize: 30, fontWeight: '900' },
  scoreSep: { color: colors.muted },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 },
  barMine: { borderRadius: 4 },
  barOther: { borderRadius: 4, opacity: 0.85 },
  verdict: { color: colors.text, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  verdictWin: { color: colors.gold },
  duelRule: { color: '#e6c9c9', fontSize: 12, textAlign: 'center', lineHeight: 17 },
  primary: { borderRadius: 12, overflow: 'hidden' },
  primaryInner: { paddingHorizontal: 14, paddingVertical: 9, alignItems: 'center' },
  primaryText: { color: colors.onGold, fontSize: 14, fontWeight: '900' },
  secondary: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  rowMe: { borderColor: colors.gold, backgroundColor: 'rgba(255,193,7,0.1)' },
  place: { color: colors.text, fontSize: 17, fontWeight: '900', width: 28, textAlign: 'center' },
  rowName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  rowSub: { color: colors.muted, fontSize: 12 },
  points: { color: colors.gold, fontSize: 16, fontWeight: '900', minWidth: 48, textAlign: 'right' },
  challenge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ff6b6b',
    backgroundColor: 'rgba(230,57,70,0.15)',
  },
  challengeText: { color: '#ffd0d0', fontSize: 12.5, fontWeight: '900' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  error: { color: '#ff8a80', textAlign: 'center', fontSize: 13 },
  chest: { borderRadius: 14, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.gold },
  chestInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  chestIcon: { fontSize: 36 },
  chestTitle: { color: colors.gold, fontSize: 15, fontWeight: '900' },
  chestText: { color: '#f3e3b5', fontSize: 13 },
});
