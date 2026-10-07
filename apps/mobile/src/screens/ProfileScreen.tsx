import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  type Avatar,
  DEFAULT_EQUIPPED,
  type Equipped,
  MAX_LEVEL,
  PROGRESS_GAMES,
  type ProgressGame,
  REWARDS,
  REWARD_KIND_NAMES,
  type Reward,
  XP_DAILY,
  XP_PLAY,
  XP_WIN,
  cleanAvatar,
  defaultAvatar,
  levelProgress,
  nextReward,
} from '@appli-poker/engine';
import { AvatarBadge, AvatarPicker } from '../components/AvatarPicker';
import { Banner } from '../components/Banner';
import { CardBackPreview } from '../components/cardBacks';
import { TitleBadge } from '../components/TitleBadge';
import { TopBar } from '../components/TopBar';
import { equipReward, useMyProgress } from '../online/progress';
import { loadAvatar, loadName, saveAvatar, saveName } from '../online/supabase';
import { colors, gradients } from '../theme';

const GAME_NAMES: Record<ProgressGame, string> = {
  poker: '🃏 Poker',
  blackjack: '🂡 Blackjack',
  president: '👑 Président',
  yams: '🎲 Yams',
  belote: '♠️ Belote',
};

type Tab = keyof Equipped | 'avatar';
const TABS: Tab[] = ['frame', 'title', 'avatar', 'cardBack', 'banner'];

/** My level, my rewards to wear, my name and avatar, and my games. */
export function ProfileScreen({ onBack }: { onBack: () => void }) {
  const progress = useMyProgress();
  const { width: screenW } = useWindowDimensions();
  const width = Math.min(screenW, 520);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<Avatar>(defaultAvatar(0));
  const [tab, setTab] = useState<Tab>('frame');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadName().then((n) => n && setName(n));
    loadAvatar().then(
      (a) =>
        a &&
        setAvatar(
          cleanAvatar(
            a,
            a,
            REWARDS.map((r) => r.id),
          ),
        ),
    );
  }, []);

  const xp = progress?.xp ?? 0;
  const { level, into, needed, ratio } = levelProgress(xp);
  const equipped = progress?.equipped ?? DEFAULT_EQUIPPED;
  const coming = nextReward(level);
  const me: Avatar = { ...avatar, frame: equipped.frame, level };

  async function wear(slot: keyof Equipped, reward: Reward) {
    if (reward.level > level) return;
    setError(null);
    try {
      await equipReward(slot, reward.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function changeAvatar(a: Avatar) {
    setAvatar(a);
    saveAvatar({ emoji: a.emoji, color: a.color });
  }

  const items = REWARDS.filter((r) => r.kind === tab);
  return (
    <ScrollView contentContainerStyle={[styles.container, { width }]} keyboardShouldPersistTaps="handled">
      <TopBar onBack={onBack} backLabel="← Jeux">
        <Text style={styles.topTitle}>Mon profil</Text>
      </TopBar>

      <View style={styles.bannerBox}>
        <Banner id={equipped.banner} width={width - 32} height={236}>
          <View style={styles.bannerContent}>
            <AvatarBadge avatar={me} size={84} />
            <Text style={styles.name} numberOfLines={1}>
              {name.trim() || 'Joueur'}
            </Text>
            <View style={styles.titleRow}>
              <TitleBadge id={equipped.title} />
            </View>
          </View>
        </Banner>
      </View>

      <View style={styles.card}>
        <View style={styles.levelRow}>
          <Text style={styles.level}>Niveau {level}</Text>
          <Text style={styles.xp}>
            {level >= MAX_LEVEL ? `${xp} XP · niveau max !` : `${into} / ${needed} XP`}
          </Text>
        </View>
        <View style={styles.track}>
          <LinearGradient
            colors={gradients.gold}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fill, { width: `${Math.max(3, ratio * 100)}%` }]}
          />
        </View>
        {coming && (
          <Text style={styles.next}>
            {`Prochaine récompense au niveau ${coming.level} : ${REWARD_KIND_NAMES[coming.kind].replace(/s$/, '').toLowerCase()} «\u00a0${coming.kind === 'avatar' ? coming.id : coming.name}\u00a0»`}
          </Text>
        )}
        <Text style={styles.how}>
          Chaque partie finie : +{XP_PLAY} XP, +{XP_WIN} si tu gagnes, +{XP_DAILY} pour la première du jour.
        </Text>
        {!progress && <Text style={styles.offline}>Connexion au serveur… ton niveau s’affichera ici.</Text>}
      </View>

      <Text style={styles.section}>Mes récompenses</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t}
            accessibilityRole="button"
            accessibilityState={{ selected: t === tab }}
            onPress={() => setTab(t)}
            style={[styles.tab, t === tab && styles.tabActive]}
          >
            <Text style={[styles.tabText, t === tab && styles.tabTextActive]}>{REWARD_KIND_NAMES[t]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {tab === 'avatar' ? (
        <View style={styles.card}>
          <Text style={styles.label}>Ton prénom</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(t) => {
              setName(t);
              saveName(t.trim());
            }}
            maxLength={16}
            placeholder="Ton prénom"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.label}>Ton avatar</Text>
          <AvatarPicker value={avatar} onChange={changeAvatar} level={level} />
        </View>
      ) : (
        <View style={styles.grid}>
          {items.map((reward) => {
            const locked = reward.level > level;
            const worn = equipped[tab] === reward.id;
            return (
              <Pressable
                key={reward.id}
                accessibilityRole="button"
                accessibilityLabel={`${reward.name}${locked ? `, niveau ${reward.level}` : ''}`}
                accessibilityState={{ selected: worn, disabled: locked }}
                onPress={() => wear(tab, reward)}
                style={[styles.tile, worn && styles.tileWorn, locked && styles.tileLocked]}
              >
                <View style={styles.tilePreview}>
                  <RewardPreview reward={reward} avatar={avatar} />
                </View>
                <Text style={styles.tileName} numberOfLines={1}>
                  {reward.name}
                </Text>
                <Text style={[styles.tileState, worn && styles.tileStateWorn]}>
                  {locked ? `🔒 Niveau ${reward.level}` : worn ? '✓ Porté' : 'Choisir'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.section}>Mes parties</Text>
      <View style={styles.card}>
        {PROGRESS_GAMES.map((g) => {
          const c = progress?.games[g];
          return (
            <View key={g} style={styles.statRow}>
              <Text style={styles.statGame}>{GAME_NAMES[g]}</Text>
              <Text style={styles.statValue}>
                {c?.played ?? 0} partie{(c?.played ?? 0) > 1 ? 's' : ''} · {c?.won ?? 0} gagnée
                {(c?.won ?? 0) > 1 ? 's' : ''}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function RewardPreview({ reward, avatar }: { reward: Reward; avatar: Avatar }) {
  switch (reward.kind) {
    case 'frame':
      return <AvatarBadge avatar={{ ...avatar, frame: reward.id }} size={52} />;
    case 'title':
      return <TitleBadge id={reward.id} small />;
    case 'cardBack':
      return <CardBackPreview id={reward.id} width={40} />;
    case 'banner':
      return <Banner id={reward.id} width={96} height={52} />;
    default:
      return <Text style={styles.emoji}>{reward.id}</Text>;
  }
}

const styles = StyleSheet.create({
  container: { alignSelf: 'center', padding: 16, paddingTop: 12, paddingBottom: 40 },
  topTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  bannerBox: { marginTop: 8, borderRadius: 18, overflow: 'hidden' },
  bannerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  titleRow: { alignSelf: 'center' },
  name: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 6,
  },
  card: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 8,
  },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  level: { color: colors.gold, fontSize: 22, fontWeight: '900' },
  xp: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  track: { height: 12, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.4)', overflow: 'hidden' },
  fill: { height: 12, borderRadius: 6 },
  next: { color: colors.text, fontSize: 14 },
  how: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  offline: { color: colors.muted, fontSize: 13, fontStyle: 'italic' },
  section: { color: colors.text, fontSize: 19, fontWeight: '800', marginTop: 22 },
  tabs: { gap: 8, paddingVertical: 10 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tabActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  tabText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  tabTextActive: { color: colors.onGold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '31%',
    flexGrow: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    gap: 4,
  },
  tileWorn: { borderColor: colors.gold, backgroundColor: 'rgba(255,193,7,0.12)' },
  tileLocked: { opacity: 0.45 },
  tilePreview: { height: 64, alignItems: 'center', justifyContent: 'center' },
  tileName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  tileState: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  tileStateWorn: { color: colors.gold },
  emoji: { fontSize: 34 },
  label: { color: colors.muted, fontSize: 13 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statGame: { color: colors.text, fontSize: 15, fontWeight: '700' },
  statValue: { color: colors.muted, fontSize: 14 },
  error: { color: colors.gold, marginTop: 10, textAlign: 'center' },
});
