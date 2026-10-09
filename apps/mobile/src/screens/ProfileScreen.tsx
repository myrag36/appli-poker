import { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
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
  isUnlocked,
  defaultAvatar,
  levelProgress,
  nextReward,
} from '@appli-poker/engine';
import { AvatarBadge, AvatarPicker } from '../components/AvatarPicker';
import { Banner } from '../components/Banner';
import { AchievementList, StreakCard } from '../components/Achievements';
import { RewardPreview } from '../components/RewardPreview';
import { NotificationSettings } from '../components/Notifications';
import { TitleBadge } from '../components/TitleBadge';
import { TopBar } from '../components/TopBar';
import { Tutorial } from '../components/Tutorial';
import { equipReward, syncMe, useMyProgress } from '../online/progress';
import { loadAvatar, loadName, saveAvatar, saveName } from '../online/supabase';
import { colors, gradients } from '../theme';
import { LANGS, lang, setLang, t, tn } from '../i18n';
import { useDesktop } from '../layout';

const GAME_NAMES: Record<ProgressGame, string> = {
  poker: '🃏 Poker',
  blackjack: '🂡 Blackjack',
  president: t('👑 Président'),
  yams: '🎲 Yams',
  belote: '♠️ Belote',
  puissance4: t('🔴 Puissance 4'),
  rami: '🃏 Rami',
  uno: '🌈 Uno',
  huit: t('🎱 8 américain'),
  tarot: '🌙 Tarot',
  perudo: '🗣️ Perudo',
};

/** One reward of a kind ("Bordures" gives "Bordure"), in the app's language. */
function kindName(kind: Reward['kind']) {
  return t(REWARD_KIND_NAMES[kind].replace(/s$/, ''));
}

type Tab = keyof Equipped | 'avatar';
const TABS: Tab[] = ['frame', 'title', 'avatar', 'cardBack', 'banner'];

/** My level, my rewards to wear, my name and avatar, and my games. */
export function ProfileScreen({ onBack, onShop }: { onBack: () => void; onShop: () => void }) {
  const progress = useMyProgress();
  const { width: screenW } = useWindowDimensions();
  const desktop = useDesktop();
  // On a computer: two columns, my identity and games on the left, my rewards and achievements on the right.
  const width = desktop ? Math.min(screenW - 64, DESK_WIDTH) : Math.min(screenW, 520);
  const bannerWidth = desktop ? DESK_LEFT : width - 32;
  const rightWidth = width - DESK_LEFT - DESK_GAP;
  const tileColumns = rightWidth >= 560 ? 4 : 3;
  const tileWidth = Math.floor((rightWidth - 10 * (tileColumns - 1)) / tileColumns);
  const [name, setName] = useState('');
  const [tutorial, setTutorial] = useState(false);
  const [avatar, setAvatar] = useState<Avatar>(defaultAvatar(0));
  const [tab, setTab] = useState<Tab>('frame');
  const [error, setError] = useState<string | null>(null);

  // Friends see my new name and avatar once I leave the profile.
  useEffect(
    () => () => {
      syncMe();
    },
    [],
  );

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
  const owned = progress?.owned ?? [];
  const coming = nextReward(level);
  const me: Avatar = { ...avatar, frame: equipped.frame, level };

  async function wear(slot: keyof Equipped, reward: Reward) {
    if (!isUnlocked(reward.kind, reward.id, level, owned)) return;
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

  // Level rewards, and shop items only once bought.
  const items = REWARDS.filter(
    (r) => r.kind === tab && (r.price === undefined || isUnlocked(r.kind, r.id, level, owned)),
  );
  const identity = (
    <>
      <View style={styles.bannerBox}>
        <Banner id={equipped.banner} width={bannerWidth} height={236}>
          <View style={styles.bannerContent}>
            <AvatarBadge avatar={me} size={84} />
            <Text style={styles.name} numberOfLines={1}>
              {name.trim() || t('Joueur')}
            </Text>
            <View style={styles.titleRow}>
              <TitleBadge id={equipped.title} />
            </View>
          </View>
        </Banner>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('{coins} pièces, aller à la boutique', { coins: progress?.coins ?? 0 })}
        onPress={onShop}
        style={({ pressed }) => [styles.wallet, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.walletCoins}>🪙 {progress?.coins ?? 0}</Text>
        <Text style={styles.walletGo}>{t('Quêtes et boutique ›')}</Text>
      </Pressable>

      <View style={styles.card}>
        <View style={styles.levelRow}>
          <Text style={styles.level}>{t('Niveau {n}', { n: level })}</Text>
          <Text style={styles.xp}>
            {level >= MAX_LEVEL ? t('{xp} XP · niveau max !', { xp }) : `${into} / ${needed} XP`}
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
            {t('Prochaine récompense au niveau {n} : {kind} «\u00a0{name}\u00a0»', {
              n: coming.level,
              kind: kindName(coming.kind).toLowerCase(),
              name: coming.kind === 'avatar' ? coming.id : t(coming.name),
            })}
          </Text>
        )}
        <Text style={styles.how}>
          {t('Chaque partie finie : +{play} XP, +{win} si tu gagnes, +{daily} pour la première du jour.', {
            play: XP_PLAY,
            win: XP_WIN,
            daily: XP_DAILY,
          })}
        </Text>
        {!progress && (
          <Text style={styles.offline}>{t('Connexion au serveur… ton niveau s’affichera ici.')}</Text>
        )}
      </View>

      <StreakCard progress={progress} />
    </>
  );

  const rewards = (
    <>
      <Text style={[styles.section, desktop && styles.sectionFirst]}>{t('Mes récompenses')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityState={{ selected: k === tab }}
            onPress={() => setTab(k)}
            style={[styles.tab, k === tab && styles.tabActive]}
          >
            <Text style={[styles.tabText, k === tab && styles.tabTextActive]}>{t(REWARD_KIND_NAMES[k])}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {tab === 'avatar' ? (
        <View style={styles.card}>
          <Text style={styles.label}>{t('Ton prénom')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(text) => {
              setName(text);
              saveName(text.trim());
            }}
            maxLength={16}
            placeholder={t('Ton prénom')}
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.label}>{t('Ton avatar')}</Text>
          <AvatarPicker value={avatar} onChange={changeAvatar} level={level} owned={owned} />
        </View>
      ) : (
        <View style={styles.grid}>
          {items.map((reward) => {
            const locked = !isUnlocked(reward.kind, reward.id, level, owned);
            const worn = equipped[tab] === reward.id;
            return (
              <Pressable
                key={reward.id}
                accessibilityRole="button"
                accessibilityLabel={
                  locked ? t('{name}, niveau {n}', { name: t(reward.name), n: reward.level }) : t(reward.name)
                }
                accessibilityState={{ selected: worn, disabled: locked }}
                onPress={() => wear(tab, reward)}
                style={[
                  styles.tile,
                  desktop && { width: tileWidth, flexGrow: 0 },
                  worn && styles.tileWorn,
                  locked && styles.tileLocked,
                ]}
              >
                <View style={styles.tilePreview}>
                  <RewardPreview reward={reward} avatar={avatar} />
                </View>
                <Text style={styles.tileName} numberOfLines={1}>
                  {t(reward.name)}
                </Text>
                <Text style={[styles.tileState, worn && styles.tileStateWorn]}>
                  {locked ? t('🔒 Niveau {n}', { n: reward.level }) : worn ? t('✓ Porté') : t('Choisir')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <Pressable accessibilityRole="button" onPress={onShop} hitSlop={8}>
        <Text style={styles.more}>{t('Encore plus de choix à la boutique ›')}</Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
    </>
  );

  const achievements = (
    <>
      <Text style={styles.section}>{t('Succès')}</Text>
      <AchievementList progress={progress} />
    </>
  );

  const games = (
    <>
      <Text style={styles.section}>{t('Mes parties')}</Text>
      <View style={styles.card}>
        {PROGRESS_GAMES.map((g) => {
          const c = progress?.games[g];
          return (
            <View key={g} style={styles.statRow}>
              <Text style={styles.statGame}>{GAME_NAMES[g]}</Text>
              <Text style={styles.statValue}>
                {tn(c?.played ?? 0, '{n} partie', '{n} parties')} ·{' '}
                {tn(c?.won ?? 0, '{n} gagnée', '{n} gagnées')}
              </Text>
            </View>
          );
        })}
      </View>
    </>
  );

  const settings = (
    <>
      {Platform.OS === 'web' && (
        <>
          <Text style={styles.section}>{t('Notifications')}</Text>
          <NotificationSettings />
          <Text style={styles.section}>{t('Langue')}</Text>
          <View style={styles.langs}>
            {LANGS.map((l) => (
              <Pressable
                key={l.id}
                accessibilityRole="button"
                accessibilityState={{ selected: l.id === lang }}
                accessibilityLabel={l.name}
                onPress={() => setLang(l.id)}
                style={({ pressed }) => [
                  styles.lang,
                  l.id === lang && styles.langActive,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={styles.langFlag}>{l.flag}</Text>
                <Text style={[styles.langName, l.id === lang && styles.langNameActive]}>{l.name}</Text>
                {l.id === lang && <Text style={styles.langCheck}>✓</Text>}
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => setTutorial(true)}
        style={({ pressed }) => [styles.tutorial, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.tutorialText}>{t('📖 Revoir le tutoriel')}</Text>
      </Pressable>
    </>
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.container, desktop && styles.containerDesktop, { width }]}
      keyboardShouldPersistTaps="handled"
    >
      <TopBar onBack={onBack} backLabel={t('← Jeux')}>
        <Text style={styles.topTitle}>{t('Mon profil')}</Text>
      </TopBar>
      {desktop ? (
        <View style={styles.columns}>
          <View style={{ width: DESK_LEFT }}>
            {identity}
            {games}
            {settings}
          </View>
          <View style={styles.right}>
            {rewards}
            {achievements}
          </View>
        </View>
      ) : (
        <>
          {identity}
          {rewards}
          {achievements}
          {games}
          {settings}
        </>
      )}
      <Tutorial visible={tutorial} onClose={() => setTutorial(false)} />
    </ScrollView>
  );
}

/** Desktop page width, and its left column. */
const DESK_WIDTH = 1120;
const DESK_LEFT = 420;
const DESK_GAP = 32;

const styles = StyleSheet.create({
  container: { alignSelf: 'center', padding: 16, paddingTop: 12, paddingBottom: 40 },
  containerDesktop: { paddingHorizontal: 0, paddingTop: 24, paddingBottom: 56 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: DESK_GAP, marginTop: 8 },
  right: { flex: 1, minWidth: 0 },
  sectionFirst: { marginTop: 8 },
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
  wallet: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,193,7,0.12)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  walletCoins: { color: colors.gold, fontSize: 20, fontWeight: '900' },
  walletGo: { color: colors.text, fontSize: 15, fontWeight: '800' },
  more: { color: colors.gold, fontSize: 14, fontWeight: '800', textAlign: 'center', marginTop: 12 },
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
  langs: { flexDirection: 'row', gap: 10, marginTop: 10 },
  lang: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
  },
  langActive: { borderColor: colors.gold, backgroundColor: 'rgba(255,193,7,0.12)' },
  langFlag: { fontSize: 22 },
  langName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  langNameActive: { color: colors.gold },
  langCheck: { color: colors.gold, fontSize: 16, fontWeight: '900' },
  tutorial: {
    marginTop: 22,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  tutorialText: { color: colors.gold, fontSize: 16, fontWeight: '800' },
});
