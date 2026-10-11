// The club tab of the friends screen. Without a club: create one, join with a code or an
// invitation, and the top clubs of the week. In a club: its badge, members (online or not, with
// their role), the lounge, the club's ranking and challenges, and the settings.
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CLUB_COLORS,
  CLUB_DESCRIPTION_MAX,
  CLUB_EMOJIS,
  CLUB_MAX_MEMBERS,
  CLUB_NAME_MAX,
  type ClubAction,
  type ClubRole,
  clubCan,
} from '@appli-poker/engine';
import { ClubBadge } from '../components/ClubBadge';
import { ClubChat, memberAvatar } from '../components/ClubChat';
import {
  ChallengeCard,
  ClubChestBanner,
  MemberRanking,
  TopClubs,
  placeLabel,
} from '../components/ClubRanking';
import { PresenceAvatar, friendAvatar } from '../components/Messagerie';
import {
  type ClubInfo,
  type ClubMember,
  type ClubMessage,
  type ClubState,
  claimClubChest,
  createClub,
  declineClubInvite,
  deleteClub,
  editClub,
  inviteToClub,
  joinClub,
  kickMember,
  leaveClub,
  loadClubMessages,
  loadClubState,
  newClubCode,
  previewClub,
  setMemberRole,
  transferClub,
  useClubLive,
} from '../online/clubs';
import { type FriendRow, refreshProgress } from '../online/progress';
import { useOnline } from '../online/messagerie';
import { ensureSignedIn } from '../online/supabase';
import { tMessage } from '../online/messages';
import { sounds } from '../feedback';
import { t, tn } from '../i18n';
import { colors, gradients } from '../theme';

interface Props {
  desktop: boolean;
  /** My friends, to invite them into the club. */
  friends: FriendRow[] | null;
  /** Opens a table from an invitation in the lounge. */
  onJoin?: (game: string, code: string) => void;
  /** A club code from a link (?club=CODE): offers to join it. */
  initialCode?: string | null;
}

/** The link that opens the app on "join this club". */
function clubLink(code: string): string {
  const base =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://myrag36.github.io/appli-poker/';
  return `${base}?club=${code}`;
}

function shareClub(name: string, code: string) {
  Share.share({
    message: t('Rejoins mon club « {name} » dans La Tablée : {link} (code {code})', {
      name,
      link: clubLink(code),
      code,
    }),
  }).catch(() => {});
}

export function ClubPanel({ desktop, friends, onJoin, initialCode }: Props) {
  const [state, setState] = useState<ClubState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [messages, setMessages] = useState<ClubMessage[] | null>(null);
  const [more, setMore] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(initialCode ?? null);

  const reload = useCallback(async () => {
    try {
      setState(await loadClubState());
      setError(null);
    } catch (e) {
      setError(tMessage((e as Error).message));
    }
  }, []);

  useEffect(() => {
    ensureSignedIn()
      .then(setMe)
      .catch(() => {});
    reload();
  }, [reload]);

  const clubId = state?.club?.id ?? null;
  useEffect(() => {
    setMessages(null);
    if (!clubId) return;
    loadClubMessages(clubId)
      .then((rows) => {
        setMessages(rows);
        setMore(rows.length >= 60);
      })
      .catch(() => setMessages([]));
  }, [clubId]);

  const add = useCallback((m: ClubMessage) => {
    setMessages((list) => {
      if (!list || list.some((x) => x.id === m.id)) return list;
      return [...list, m].sort((a, b) => a.id - b.id);
    });
  }, []);
  const onLive = useCallback(
    (m: ClubMessage) => {
      add(m);
      if (m.sender_id !== me && m.kind !== 'event') sounds.reaction();
    },
    [add, me],
  );
  useClubLive(clubId, onLive, reload);

  async function older() {
    const first = messages?.[0];
    if (!clubId || !first) return;
    const rows = await loadClubMessages(clubId, first.id).catch(() => []);
    setMore(rows.length >= 60);
    setMessages((list) => [...rows, ...(list ?? [])]);
  }

  async function claim() {
    await claimClubChest();
    sounds.win();
    await refreshProgress();
    await reload();
  }

  if (!state) {
    return error ? (
      <View style={styles.errorBox}>
        <Text style={styles.error}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={reload} style={styles.retry}>
          <Text style={styles.retryText}>{t('Réessayer')}</Text>
        </Pressable>
      </View>
    ) : (
      <ActivityIndicator color={colors.gold} style={{ marginTop: 30 }} />
    );
  }

  const chest = state.chest && !state.chest.claimed ? state.chest : null;
  return (
    <View style={styles.page}>
      {linkCode && (
        <JoinPrompt
          code={linkCode}
          inClub={!!state.club}
          onDone={async (joined) => {
            setLinkCode(null);
            if (joined) await reload();
          }}
        />
      )}
      {chest && (
        <View style={{ marginBottom: 12 }}>
          <ClubChestBanner chest={chest} onClaim={claim} />
        </View>
      )}
      {state.club && state.role ? (
        <Lounge
          state={state as LoungeState}
          me={me}
          desktop={desktop}
          friends={friends}
          messages={messages}
          more={more}
          onOlder={older}
          onSent={add}
          onJoin={onJoin}
          onChanged={reload}
        />
      ) : (
        <NoClub state={state} desktop={desktop} onChanged={reload} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Joining from a link.

function JoinPrompt({
  code,
  inClub,
  onDone,
}: {
  code: string;
  inClub: boolean;
  onDone: (joined: boolean) => void;
}) {
  const [club, setClub] = useState<{ club: ClubInfo; members: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    previewClub(code)
      .then(setClub)
      .catch((e) => setError(tMessage((e as Error).message)));
  }, [code]);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      await joinClub({ code });
      sounds.win();
      onDone(true);
    } catch (e) {
      setError(tMessage((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.prompt}>
      {club ? (
        <View style={styles.promptTop}>
          <ClubBadge emoji={club.club.emoji} color={club.club.color} size={44} />
          <View style={styles.flex}>
            <Text style={styles.promptTitle} numberOfLines={1}>
              {t('Rejoindre « {name} » ?', { name: club.club.name })}
            </Text>
            <Text style={styles.muted}>
              {tn(club.members, '{n} membre', '{n} membres')}
              {club.club.description ? ` · ${club.club.description}` : ''}
            </Text>
          </View>
        </View>
      ) : (
        !error && <ActivityIndicator color={colors.gold} />
      )}
      {inClub && club && (
        <Text style={styles.muted}>{t('Quitte d’abord ton club pour rejoindre celui-ci.')}</Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.buttons}>
        <Pressable accessibilityRole="button" onPress={() => onDone(false)} style={styles.secondary}>
          <Text style={styles.secondaryText}>{t('Plus tard')}</Text>
        </Pressable>
        {club && !inClub && <GoldButton label={t('Rejoindre le club')} busy={busy} onPress={join} />}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Without a club.

function NoClub({
  state,
  desktop,
  onChanged,
}: {
  state: ClubState;
  desktop: boolean;
  onChanged: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, job: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await job();
      sounds.win();
      onChanged();
    } catch (e) {
      setError(tMessage((e as Error).message));
      sounds.invalid();
    } finally {
      setBusy(null);
    }
  }

  const invites = state.invites ?? [];
  const hero = (
    <LinearGradient colors={['#1d3b6b', '#141a3a']} style={styles.hero}>
      <Text style={styles.heroIcon}>🛡️</Text>
      <View style={styles.flex}>
        <Text style={styles.heroTitle}>{t('Les clubs')}</Text>
        <Text style={styles.heroText}>
          {t(
            'Jusqu’à 30 amis, un salon pour discuter, un classement du club et des défis contre les autres clubs.',
          )}
        </Text>
      </View>
    </LinearGradient>
  );

  const invitations = invites.length > 0 && (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('Invitations')}</Text>
      {invites.map((inv) => (
        <View key={inv.club.id} style={styles.invite}>
          <ClubBadge emoji={inv.club.emoji} color={inv.club.color} size={38} />
          <View style={styles.flex}>
            <Text style={styles.rowName} numberOfLines={1}>
              {inv.club.name}
            </Text>
            <Text style={styles.muted} numberOfLines={1}>
              {t('{name} t’invite', { name: inv.from_name })} · {tn(inv.members, '{n} membre', '{n} membres')}
            </Text>
          </View>
          <GoldButton
            label={t('Rejoindre')}
            small
            busy={busy === inv.club.id}
            onPress={() => run(inv.club.id, () => joinClub({ clubId: inv.club.id }))}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Ignorer l’invitation')}
            hitSlop={8}
            onPress={() => run(`x${inv.club.id}`, () => declineClubInvite(inv.club.id))}
          >
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );

  const ready = code.replace(/[^A-Za-z0-9]/g, '').length === 6;
  const join = (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('Rejoindre avec un code')}</Text>
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, styles.codeInput, !code && styles.codeEmpty]}
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase())}
          placeholder={t('Code du club')}
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          maxLength={8}
          onSubmitEditing={() => ready && run('code', () => joinClub({ code }))}
        />
        <GoldButton
          label={t('Rejoindre')}
          busy={busy === 'code'}
          disabled={!ready}
          onPress={() => run('code', () => joinClub({ code }))}
        />
      </View>
    </View>
  );

  const create = (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('Créer mon club')}</Text>
      <ClubForm
        submit={t('Créer le club')}
        busy={busy === 'create'}
        onSubmit={(look) => run('create', () => createClub(look))}
      />
    </View>
  );

  const top = (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('🏆 Top clubs de la semaine')}</Text>
      <TopClubs
        top={state.top}
        myClub={null}
        role={null}
        week={state.week}
        challenges={[]}
        onChanged={onChanged}
      />
      <LastWeek state={state} />
    </View>
  );

  return (
    <>
      {hero}
      {error && <Text style={[styles.error, { marginTop: 10 }]}>{error}</Text>}
      {desktop ? (
        <View style={styles.columns}>
          <View style={styles.leftCol}>
            {invitations}
            {join}
            {create}
          </View>
          <View style={styles.rightCol}>{top}</View>
        </View>
      ) : (
        <>
          {invitations}
          {join}
          {create}
          {top}
        </>
      )}
    </>
  );
}

/** Last week's podium of clubs, in one line. */
function LastWeek({ state }: { state: ClubState }) {
  if (state.lastTop.length === 0) return null;
  return (
    <Text style={styles.lastWeek}>
      {t('Semaine dernière : {podium}', {
        podium: state.lastTop
          .filter((r) => r.club)
          .map((r) => `${['🥇', '🥈', '🥉'][r.place - 1] ?? r.place} ${r.club!.emoji} ${r.club!.name}`)
          .join('  ·  '),
      })}
    </Text>
  );
}

/** Name, badge, color and description of a club, to create it or change it. */
function ClubForm({
  initial,
  submit,
  busy,
  bare,
  onSubmit,
}: {
  /** Inside another panel: no card of its own. */
  bare?: boolean;
  initial?: { name: string; emoji: string; color: string; description: string };
  submit: string;
  busy: boolean;
  onSubmit: (look: { name: string; emoji: string; color: string; description: string }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? CLUB_EMOJIS[0]);
  const [color, setColor] = useState(initial?.color ?? CLUB_COLORS[5]);
  const [description, setDescription] = useState(initial?.description ?? '');
  const ok = name.trim().length >= 3;
  return (
    <View style={[styles.form, bare && styles.formBare]}>
      <View style={styles.formTop}>
        <ClubBadge emoji={emoji} color={color} size={52} />
        <TextInput
          style={[styles.input, styles.flex]}
          value={name}
          onChangeText={setName}
          placeholder={t('Nom du club')}
          placeholderTextColor={colors.muted}
          maxLength={CLUB_NAME_MAX}
          accessibilityLabel={t('Nom du club')}
        />
      </View>
      <View style={styles.emojis} accessibilityRole="radiogroup" accessibilityLabel={t('Emblème')}>
        {CLUB_EMOJIS.map((e) => (
          <Pressable
            key={e}
            accessibilityRole="radio"
            accessibilityState={{ checked: e === emoji }}
            onPress={() => setEmoji(e)}
            style={[styles.emojiChoice, e === emoji && styles.emojiChoiceOn]}
          >
            <Text style={styles.emojiText}>{e}</Text>
          </Pressable>
        ))}
      </View>
      <View
        style={styles.colorsRow}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('Couleur{club}', { club: '' })}
      >
        {CLUB_COLORS.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="radio"
            accessibilityLabel={c}
            accessibilityState={{ checked: c === color }}
            onPress={() => setColor(c)}
            style={[styles.colorChoice, { backgroundColor: c }, c === color && styles.colorChoiceOn]}
          />
        ))}
      </View>
      <TextInput
        style={[styles.input, styles.description]}
        value={description}
        onChangeText={setDescription}
        placeholder={t('Une phrase pour présenter le club (facultatif)')}
        placeholderTextColor={colors.muted}
        maxLength={CLUB_DESCRIPTION_MAX}
        multiline
      />
      <GoldButton
        label={submit}
        busy={busy}
        disabled={!ok}
        onPress={() => onSubmit({ name: name.trim(), emoji, color, description: description.trim() })}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// In a club.

type LoungeState = ClubState & {
  club: NonNullable<ClubState['club']>;
  role: ClubRole;
};

type LoungeTab = 'salon' | 'membres' | 'classement';

function Lounge({
  state,
  me,
  desktop,
  friends,
  messages,
  more,
  onOlder,
  onSent,
  onJoin,
  onChanged,
}: {
  state: LoungeState;
  me: string | null;
  desktop: boolean;
  friends: FriendRow[] | null;
  messages: ClubMessage[] | null;
  more: boolean;
  onOlder: () => void;
  onSent: (m: ClubMessage) => void;
  onJoin?: (game: string, code: string) => void;
  onChanged: () => void;
}) {
  const { height } = useWindowDimensions();
  const [tab, setTab] = useState<LoungeTab>('salon');
  const [settings, setSettings] = useState(false);
  const club = state.club;
  const members = state.members ?? [];
  const challenges = state.challenges ?? [];
  const incoming = challenges.filter((c) => c.status === 'pending' && !c.mine && c.week === state.week);
  const chatHeight = desktop
    ? Math.max(460, Math.min(640, height - 340))
    : Math.max(380, Math.min(620, height - 250));

  const header = (
    <LinearGradient colors={[`${club.color}cc`, 'rgba(10,14,30,0.9)']} style={styles.clubHeader}>
      <ClubBadge emoji={club.emoji} color={club.color} size={desktop ? 64 : 54} />
      <View style={styles.flex}>
        <Text style={styles.clubName} numberOfLines={1}>
          {club.name}
        </Text>
        {!!club.description && (
          <Text style={styles.clubDescription} numberOfLines={2}>
            {club.description}
          </Text>
        )}
        <View style={styles.clubStats}>
          <Text style={styles.clubStat}>
            {t('👥 {n}/{max}', { n: members.length, max: CLUB_MAX_MEMBERS })}
          </Text>
          <Text style={styles.clubStat}>{tn(club.points, '⭐ {n} pt', '⭐ {n} pts')}</Text>
          {club.place !== null && (
            <Text style={styles.clubStat}>
              {t('🏆 {place} sur {n}', { place: placeLabel(club.place), n: club.clubs })}
            </Text>
          )}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Réglages du club')}
        accessibilityState={{ expanded: settings }}
        onPress={() => setSettings((s) => !s)}
        style={[styles.gear, settings && styles.gearOn]}
      >
        <Text style={styles.gearText}>⚙️</Text>
      </Pressable>
    </LinearGradient>
  );

  const chat = (
    <ClubChat
      me={me}
      members={members}
      messages={messages}
      more={more}
      height={chatHeight}
      desktop={desktop}
      onOlder={onOlder}
      onSent={onSent}
      onJoin={onJoin}
    />
  );
  const membersPanel = <MembersPanel state={state} me={me} friends={friends} onChanged={onChanged} />;
  const week = <WeekPanel state={state} onChanged={onChanged} />;
  const tabs: LoungeTab[] = desktop ? ['salon', 'classement'] : ['salon', 'membres', 'classement'];
  const shownTab = desktop && tab === 'membres' ? 'salon' : tab;
  const tabBar = (
    <View style={styles.tabs} accessibilityRole="tablist">
      {tabs.map((id) => (
        <Pressable
          key={id}
          accessibilityRole="tab"
          accessibilityState={{ selected: shownTab === id }}
          onPress={() => setTab(id)}
          style={[styles.tab, shownTab === id && styles.tabOn]}
        >
          <Text style={[styles.tabText, shownTab === id && styles.tabTextOn]} numberOfLines={1}>
            {id === 'salon' ? t('💬 Salon') : id === 'membres' ? t('👥 Membres') : t('🏆 Semaine')}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <>
      {header}
      {settings && <SettingsPanel state={state} onChanged={onChanged} onClose={() => setSettings(false)} />}
      {incoming.map((c) => (
        <View key={c.id} style={{ marginTop: 10 }}>
          <ChallengeCard
            challenge={c}
            club={club}
            role={state.role}
            week={state.week}
            endsAt={state.endsAt}
            onChanged={onChanged}
          />
        </View>
      ))}
      {desktop ? (
        <View style={styles.columns}>
          <View style={styles.leftCol}>{membersPanel}</View>
          <View style={styles.rightCol}>
            {tabBar}
            <View style={{ marginTop: 12 }}>{shownTab === 'salon' ? chat : week}</View>
          </View>
        </View>
      ) : (
        <>
          {tabBar}
          <View style={{ marginTop: 12 }}>
            {shownTab === 'salon' ? chat : shownTab === 'membres' ? membersPanel : week}
          </View>
        </>
      )}
    </>
  );
}

const ROLE_LABELS: Record<ClubRole, string> = { owner: '👑 Créateur', admin: '⭐ Admin', member: '' };

function MembersPanel({
  state,
  me,
  friends,
  onChanged,
}: {
  state: LoungeState;
  me: string | null;
  friends: FriendRow[] | null;
  onChanged: () => void;
}) {
  const online = useOnline();
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const members = [...(state.members ?? [])].sort(
    (a, b) =>
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      Number(online.has(b.user_id)) - Number(online.has(a.user_id)) ||
      a.name.localeCompare(b.name),
  );
  const ids = new Set(members.map((m) => m.user_id));
  const outside = (friends ?? []).filter((f) => !f.me && !ids.has(f.user_id));
  const invited = new Set(state.invited ?? []);
  const onlineCount = members.filter((m) => online.has(m.user_id) || m.user_id === me).length;

  async function run(key: string, job: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await job();
      setOpen(null);
      setConfirm(null);
      onChanged();
    } catch (e) {
      setError(tMessage((e as Error).message));
    } finally {
      setBusy(null);
    }
  }

  const actions = (target: ClubMember): { id: ClubAction; label: string; danger?: boolean }[] => {
    const list: { id: ClubAction; label: string; danger?: boolean }[] = [];
    if (target.me) return list;
    if (clubCan(state.role, 'promote', target.role))
      list.push({ id: 'promote', label: t('⭐ Nommer admin') });
    if (clubCan(state.role, 'demote', target.role)) list.push({ id: 'demote', label: t('Retirer admin') });
    if (clubCan(state.role, 'transfer', target.role))
      list.push({ id: 'transfer', label: t('👑 Confier le club') });
    if (clubCan(state.role, 'kick', target.role))
      list.push({ id: 'kick', label: t('Exclure'), danger: true });
    return list;
  };

  function act(target: ClubMember, action: ClubAction) {
    const key = `${target.user_id}:${action}`;
    if ((action === 'kick' || action === 'transfer') && confirm !== key) {
      setConfirm(key);
      return;
    }
    run(key, () =>
      action === 'promote'
        ? setMemberRole(target.user_id, 'admin')
        : action === 'demote'
          ? setMemberRole(target.user_id, 'member')
          : action === 'transfer'
            ? transferClub(target.user_id)
            : kickMember(target.user_id),
    );
  }

  async function invite(friend: FriendRow) {
    setBusy(`i${friend.user_id}`);
    setError(null);
    try {
      await inviteToClub(friend.user_id);
      setSent((s) => ({ ...s, [friend.user_id]: true }));
      sounds.win();
    } catch (e) {
      setError(tMessage((e as Error).message));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.membersPanel}>
      <View style={styles.codeCard}>
        <View style={styles.flex}>
          <Text style={styles.codeLabel}>{t('Code du club')}</Text>
          <Text selectable style={styles.code}>
            {state.club.code}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => shareClub(state.club.name, state.club.code)}
          style={styles.shareButton}
        >
          <Text style={styles.shareText}>{t('📤 Partager')}</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: inviting }}
        onPress={() => setInviting((v) => !v)}
        style={styles.inviteToggle}
      >
        <Text style={styles.inviteToggleText}>{t('👋 Inviter des amis dans le club')}</Text>
        <Text style={styles.muted}>{inviting ? '▴' : '▾'}</Text>
      </Pressable>
      {inviting && (
        <View style={styles.inviteList}>
          {friends === null && <ActivityIndicator color={colors.gold} />}
          {friends !== null && outside.length === 0 && (
            <Text style={styles.mutedCenter}>
              {t('Tous tes amis sont déjà dans le club, ou ajoute-en avec leur code ami.')}
            </Text>
          )}
          {outside.map((f, i) => {
            const done = sent[f.user_id] || invited.has(f.user_id);
            return (
              <View key={f.user_id} style={styles.inviteRow}>
                <PresenceAvatar avatar={friendAvatar(f, i)} size={32} online={online.has(f.user_id)} />
                <Text style={[styles.rowName, styles.flex]} numberOfLines={1}>
                  {f.name}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('Inviter {name}', { name: f.name })}
                  disabled={done || busy !== null}
                  onPress={() => invite(f)}
                  style={[styles.smallButton, done && styles.smallButtonDone]}
                >
                  {busy === `i${f.user_id}` ? (
                    <ActivityIndicator size="small" color={colors.gold} />
                  ) : (
                    <Text style={styles.smallButtonText}>{done ? t('Invité ✓') : t('Inviter')}</Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.membersHead}>
        <Text style={styles.sectionTitle}>{t('Membres ({n})', { n: members.length })}</Text>
        <Text style={styles.onlineCount}>{tn(onlineCount, '● {n} en ligne', '● {n} en ligne')}</Text>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.list}>
        {members.map((m, i) => {
          const list = actions(m);
          const isOpen = open === m.user_id;
          const points = weekPoints(m);
          return (
            <View key={m.user_id} style={[styles.member, m.me && styles.memberMe]}>
              <View style={styles.memberTop}>
                <PresenceAvatar
                  avatar={memberAvatar(m, i)}
                  size={40}
                  online={m.me || online.has(m.user_id)}
                />
                <View style={styles.flex}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {m.me ? t('{name} (toi)', { name: m.name }) : m.name}
                  </Text>
                  <View style={styles.memberTags}>
                    {m.role !== 'member' && (
                      <Text style={[styles.role, m.role === 'owner' && styles.roleOwner]}>
                        {t(ROLE_LABELS[m.role])}
                      </Text>
                    )}
                    <Text style={styles.muted}>
                      {tn(points, '{n} pt cette semaine', '{n} pts cette semaine')}
                    </Text>
                  </View>
                </View>
                {list.length > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('Gérer {name}', { name: m.name })}
                    accessibilityState={{ expanded: isOpen }}
                    hitSlop={8}
                    onPress={() => {
                      setConfirm(null);
                      setOpen(isOpen ? null : m.user_id);
                    }}
                    style={styles.more}
                  >
                    <Text style={styles.moreText}>⋯</Text>
                  </Pressable>
                )}
              </View>
              {isOpen && (
                <View style={styles.memberActions}>
                  {list.map((a) => {
                    const key = `${m.user_id}:${a.id}`;
                    return (
                      <Pressable
                        key={a.id}
                        accessibilityRole="button"
                        disabled={busy !== null}
                        onPress={() => act(m, a.id)}
                        style={[
                          styles.action,
                          a.danger && styles.actionDanger,
                          confirm === key && styles.actionConfirm,
                        ]}
                      >
                        {busy === key ? (
                          <ActivityIndicator size="small" color={colors.gold} />
                        ) : (
                          <Text style={[styles.actionText, a.danger && styles.actionTextDanger]}>
                            {confirm === key ? t('Confirmer ?') : a.label}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const ROLE_ORDER: Record<ClubRole, number> = { owner: 0, admin: 1, member: 2 };

function weekPoints(m: ClubMember): number {
  let points = 0;
  for (const g of Object.values(m.week ?? {})) points += g.won * 3 + (g.played - g.won);
  return points;
}

/** The club's week: its challenges, its members' ranking and the top clubs. */
function WeekPanel({ state, onChanged }: { state: LoungeState; onChanged: () => void }) {
  const challenges = state.challenges ?? [];
  const live = challenges.find((c) => c.status === 'accepted' && c.week === state.week);
  const past = challenges.find((c) => c.status === 'accepted' && c.week === state.lastWeek);
  const outgoing = challenges.filter((c) => c.status === 'pending' && c.mine && c.week === state.week);
  const answered = challenges.filter(
    (c) => c.week === state.week && (c.status === 'declined' || c.status === 'cancelled') && c.mine,
  );
  const admin = clubCan(state.role, 'challenge');
  return (
    <View style={styles.weekPanel}>
      {live ? (
        <ChallengeCard
          challenge={live}
          club={state.club}
          role={state.role}
          week={state.week}
          endsAt={state.endsAt}
          onChanged={onChanged}
        />
      ) : (
        <View style={styles.noDuel}>
          <Text style={styles.noDuelIcon}>⚔️</Text>
          <Text style={styles.noDuelText}>
            {admin
              ? t('Pas de défi cette semaine : choisis un club dans le classement ci-dessous et défie-le !')
              : t('Pas de défi cette semaine. Le créateur et les admins peuvent défier un autre club.')}
          </Text>
        </View>
      )}
      {outgoing.map((c) => (
        <ChallengeCard
          key={c.id}
          challenge={c}
          club={state.club}
          role={state.role}
          week={state.week}
          endsAt={state.endsAt}
          onChanged={onChanged}
        />
      ))}
      {answered.slice(0, 2).map((c) => (
        <ChallengeCard
          key={c.id}
          challenge={c}
          club={state.club}
          role={state.role}
          week={state.week}
          endsAt={state.endsAt}
          onChanged={onChanged}
        />
      ))}
      {past && (
        <ChallengeCard
          challenge={past}
          club={state.club}
          role={state.role}
          week={state.week}
          endsAt={state.endsAt}
          onChanged={onChanged}
        />
      )}

      <Text style={styles.sectionTitle}>{t('Classement du club')}</Text>
      <Text style={styles.hint}>
        {t(
          'Les points de chaque membre dans le classement de la semaine (3 la victoire, 1 la partie) font ceux du club.',
        )}
      </Text>
      <MemberRanking members={state.members ?? []} />

      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>{t('🏆 Top clubs de la semaine')}</Text>
      <Text style={styles.hint}>{t('Le podium gagne un coffre pour chacun de ses membres.')}</Text>
      <TopClubs
        top={state.top}
        myClub={state.club.id}
        role={state.role}
        week={state.week}
        challenges={challenges}
        onChanged={onChanged}
      />
      <LastWeek state={state} />
    </View>
  );
}

function SettingsPanel({
  state,
  onChanged,
  onClose,
}: {
  state: LoungeState;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'leave' | 'delete' | null>(null);
  const club = state.club;
  const alone = (state.members ?? []).length <= 1;
  const canEdit = clubCan(state.role, 'edit');

  async function run(key: string, job: () => Promise<unknown>, done?: string) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await job();
      if (done) setMessage(done);
      onChanged();
    } catch (e) {
      setError(tMessage((e as Error).message));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.settings}>
      <View style={styles.settingsHead}>
        <Text style={styles.sectionTitle}>{t('⚙️ Réglages du club')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Fermer')} hitSlop={8} onPress={onClose}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>
      {canEdit && (
        <>
          <ClubForm
            initial={club}
            bare
            submit={t('Enregistrer')}
            busy={busy === 'edit'}
            onSubmit={(look) => run('edit', () => editClub(look), t('Club mis à jour !'))}
          />
          <View style={styles.settingsRow}>
            <Text style={[styles.muted, styles.flex]}>
              {t('Un nouveau code empêche l’ancien lien de servir.')}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy !== null}
              onPress={() => run('code', newClubCode, t('Nouveau code prêt'))}
              style={styles.secondary}
            >
              {busy === 'code' ? (
                <ActivityIndicator size="small" color={colors.gold} />
              ) : (
                <Text style={styles.secondaryText}>{t('🔄 Nouveau code')}</Text>
              )}
            </Pressable>
          </View>
        </>
      )}
      {message && <Text style={styles.message}>{message}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.dangerZone}>
        {state.role === 'owner' && !alone ? (
          <Text style={styles.muted}>
            {t('Pour quitter le club, confie-le d’abord à un membre (bouton ⋯ dans la liste).')}
          </Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={busy !== null}
            onPress={() => (confirm === 'leave' ? run('leave', leaveClub) : setConfirm('leave'))}
            style={[styles.dangerButton, confirm === 'leave' && styles.dangerButtonOn]}
          >
            <Text style={styles.dangerText}>
              {confirm === 'leave'
                ? alone
                  ? t('Confirmer : le club sera fermé')
                  : t('Confirmer : quitter le club')
                : t('🚪 Quitter le club')}
            </Text>
          </Pressable>
        )}
        {state.role === 'owner' && !alone && (
          <Pressable
            accessibilityRole="button"
            disabled={busy !== null}
            onPress={() => (confirm === 'delete' ? run('delete', deleteClub) : setConfirm('delete'))}
            style={[styles.dangerButton, confirm === 'delete' && styles.dangerButtonOn]}
          >
            <Text style={styles.dangerText}>
              {confirm === 'delete'
                ? t('Confirmer : supprimer le club pour tous')
                : t('🗑️ Supprimer le club')}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function GoldButton({
  label,
  onPress,
  busy,
  disabled,
  small,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy || disabled}
      style={[styles.gold, (busy || disabled) && styles.disabled]}
    >
      <LinearGradient colors={gradients.gold} style={[styles.goldInner, small && styles.goldSmall]}>
        {busy ? <ActivityIndicator color={colors.onGold} /> : <Text style={styles.goldText}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { marginTop: 12, gap: 0 },
  flex: { flex: 1, minWidth: 0 },
  muted: { color: colors.muted, fontSize: 12.5 },
  mutedCenter: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: -4 },
  errorBox: { alignItems: 'center', marginTop: 24, gap: 10 },
  error: { color: '#ff8a80', textAlign: 'center', fontSize: 13 },
  message: { color: colors.gold, textAlign: 'center', fontWeight: '800' },
  retry: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.glass },
  retryText: { color: colors.text, fontWeight: '800' },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 28, marginTop: 4 },
  leftCol: { width: 400 },
  rightCol: { flex: 1, minWidth: 0, marginTop: 12 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#4ea8de',
  },
  heroIcon: { fontSize: 42 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  heroText: { color: '#a9d2ff', fontSize: 13, lineHeight: 18, marginTop: 3 },
  section: { marginTop: 18, gap: 10 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,193,7,0.1)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  close: { color: colors.muted, fontSize: 16, fontWeight: '800', paddingHorizontal: 4 },
  addRow: { flexDirection: 'row', gap: 8 },
  input: {
    minWidth: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    fontWeight: '700',
  },
  codeInput: { flex: 1, fontSize: 18, fontWeight: '800', letterSpacing: 3 },
  codeEmpty: { letterSpacing: 0, fontSize: 16, fontWeight: '600' },
  form: {
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  formBare: { padding: 0, borderWidth: 0, backgroundColor: 'transparent' },
  formTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emojis: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  emojiChoice: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  emojiChoiceOn: { borderColor: colors.gold, backgroundColor: 'rgba(255,193,7,0.18)' },
  emojiText: { fontSize: 19 },
  colorsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorChoice: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  colorChoiceOn: { borderColor: '#fff', transform: [{ scale: 1.15 }] },
  description: { minHeight: 60, fontSize: 14, fontWeight: '500', textAlignVertical: 'top' },
  gold: { borderRadius: 12, overflow: 'hidden' },
  goldInner: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldSmall: { paddingHorizontal: 12, paddingVertical: 8 },
  goldText: { color: colors.onGold, fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  lastWeek: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  prompt: {
    marginBottom: 12,
    padding: 14,
    gap: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,193,7,0.1)',
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  promptTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  promptTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  secondary: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    marginTop: 4,
  },
  clubName: { color: '#fff', fontSize: 22, fontWeight: '900' },
  clubDescription: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2, lineHeight: 18 },
  clubStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  clubStat: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  gear: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignSelf: 'flex-start',
  },
  gearOn: { backgroundColor: 'rgba(255,193,7,0.3)' },
  gearText: { fontSize: 20 },
  tabs: {
    flexDirection: 'row',
    marginTop: 12,
    padding: 4,
    gap: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabOn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  tabText: { color: colors.muted, fontSize: 14, fontWeight: '800' },
  tabTextOn: { color: colors.text, fontWeight: '900' },
  membersPanel: { gap: 10 },
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#14264a',
    borderWidth: 1,
    borderColor: '#4ea8de',
  },
  codeLabel: {
    color: '#a9d2ff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  code: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 5 },
  shareButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  shareText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  inviteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  inviteToggleText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '800' },
  inviteList: { gap: 8, paddingHorizontal: 4 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallButton: {
    minWidth: 70,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  smallButtonDone: { borderColor: colors.glassBorder, opacity: 0.7 },
  smallButtonText: { color: colors.gold, fontWeight: '900', fontSize: 13 },
  membersHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  onlineCount: { color: '#3ddc84', fontSize: 13, fontWeight: '800' },
  list: { gap: 8 },
  member: {
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 8,
  },
  memberMe: { borderColor: colors.goldBorder },
  memberTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberTags: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' },
  rowName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  role: {
    color: '#cfe3ff',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(78,168,222,0.25)',
  },
  roleOwner: { color: colors.onGold, backgroundColor: colors.gold },
  more: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  moreText: { color: colors.text, fontSize: 18, fontWeight: '900', lineHeight: 20 },
  memberActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 50 },
  action: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  actionDanger: { borderColor: '#ff8a80' },
  actionConfirm: { backgroundColor: 'rgba(230,57,70,0.3)' },
  actionText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  actionTextDanger: { color: '#ff8a80' },
  weekPanel: { gap: 12 },
  noDuel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#ff6b6b',
    backgroundColor: 'rgba(230,57,70,0.08)',
  },
  noDuelIcon: { fontSize: 28 },
  noDuelText: { flex: 1, color: colors.text, fontSize: 13.5, lineHeight: 19 },
  settings: {
    marginTop: 10,
    padding: 14,
    gap: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  settingsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dangerZone: { gap: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.glassBorder },
  dangerButton: {
    marginTop: 6,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff8a80',
  },
  dangerButtonOn: { backgroundColor: 'rgba(230,57,70,0.3)' },
  dangerText: { color: '#ff8a80', fontSize: 14, fontWeight: '900' },
});
