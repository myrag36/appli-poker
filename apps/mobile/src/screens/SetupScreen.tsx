import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { type Avatar, type Variant, botName, defaultAvatar } from '@appli-poker/engine';
import { AvatarBadge, AvatarPicker } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { LevelPicker } from '../components/LevelPicker';
import { VariantPicker } from '../components/VariantPicker';
import { useDesktop } from '../layout';
import { colors } from '../theme';
import { t } from '../i18n';

export interface GameSettings {
  names: string[];
  stack: number;
  bigBlind: number;
  /** Tournament level length in minutes, or null for fixed blinds. */
  levelMinutes: number | null;
  /** One avatar per player, in the same order as `names`. */
  avatars: Avatar[];
  /** Which players the phone plays itself, in the same order as `names`. */
  bots: boolean[];
  /** Texas Hold'em or Omaha. */
  variant: Variant;
}

const MAX_PLAYERS = 8;

interface Props {
  onStart: (settings: GameSettings) => void;
  onBack: () => void;
}

export function SetupScreen({ onStart, onBack }: Props) {
  const [names, setNames] = useState(['', '']);
  const [avatars, setAvatars] = useState<Avatar[]>([defaultAvatar(0), defaultAvatar(1)]);
  const [bots, setBots] = useState([false, false]);
  /** Index of the player whose avatar is being picked. */
  const [picking, setPicking] = useState<number | null>(null);
  const [stack, setStack] = useState('1000');
  const [bigBlind, setBigBlind] = useState('20');
  const [levelMinutes, setLevelMinutes] = useState<number | null>(null);
  const [variant, setVariant] = useState<Variant>('holdem');
  const desktop = useDesktop();

  const cleaned = names.map((n, i) => n.trim() || t('Joueur {n}', { n: i + 1 }));
  const stackValue = parseInt(stack, 10);
  const bbValue = parseInt(bigBlind, 10);
  const valid =
    bbValue >= 2 &&
    bbValue % 2 === 0 &&
    stackValue >= bbValue &&
    new Set(cleaned).size === cleaned.length &&
    bots.includes(false);

  function addPlayer(bot: boolean) {
    setNames([...names, bot ? botName(cleaned) : '']);
    setAvatars([
      ...avatars,
      bot ? { emoji: '🤖', color: defaultAvatar(names.length).color } : defaultAvatar(names.length),
    ]);
    setBots([...bots, bot]);
  }

  const playersSection = (
    <>
      <Text style={styles.section}>{t('Joueurs')}</Text>
      {names.map((name, i) => (
        <View key={i}>
          <View style={styles.row}>
            {bots[i] ? (
              <>
                <AvatarBadge avatar={avatars[i]} size={40} />
                <View style={[styles.input, styles.flex, styles.botRow]}>
                  <Text style={styles.botName}>{name}</Text>
                  <Text style={styles.botTag}>{t('Robot')}</Text>
                </View>
              </>
            ) : (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("Changer l'avatar du joueur {n}", { n: i + 1 })}
                  onPress={() => setPicking(picking === i ? null : i)}
                >
                  <AvatarBadge avatar={avatars[i]} size={40} />
                </Pressable>
                <TextInput
                  style={[styles.input, styles.flex]}
                  placeholder={t('Joueur {n}', { n: i + 1 })}
                  placeholderTextColor={colors.muted}
                  value={name}
                  maxLength={16}
                  onChangeText={(v) => setNames(names.map((n, j) => (j === i ? v : n)))}
                />
              </>
            )}
            {names.length > 2 && (
              // Buttons stretch to fill their row; this keeps every ✕ the same size.
              <View style={styles.remove}>
                <Button
                  label="✕"
                  variant="secondary"
                  onPress={() => {
                    setNames(names.filter((_, j) => j !== i));
                    setAvatars(avatars.filter((_, j) => j !== i));
                    setBots(bots.filter((_, j) => j !== i));
                    setPicking(null);
                  }}
                />
              </View>
            )}
          </View>
          {picking === i && (
            <AvatarPicker
              value={avatars[i]}
              onChange={(a) => setAvatars(avatars.map((x, j) => (j === i ? a : x)))}
            />
          )}
        </View>
      ))}
      {names.length < MAX_PLAYERS && (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button label={t('+ Joueur')} variant="secondary" onPress={() => addPlayer(false)} />
          </View>
          <View style={styles.flex}>
            <Button label={t('+ Robot 🤖')} variant="secondary" onPress={() => addPlayer(true)} />
          </View>
        </View>
      )}
      <Text style={styles.hint}>
        {t('Les robots jouent tout seuls. Seul contre des robots, tu n’as pas besoin de cacher tes cartes.')}
      </Text>
    </>
  );
  const settingsSection = (
    <>
      <Text style={styles.section}>{t('Réglages')}</Text>
      <VariantPicker value={variant} onChange={setVariant} />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>{t('Jetons de départ')}</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={stack} onChangeText={setStack} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>{t('Grosse blinde')}</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={bigBlind}
            onChangeText={setBigBlind}
          />
        </View>
      </View>
      <Text style={styles.hint}>
        {t("Petite blinde : {sb}. La partie se joue sur un seul téléphone qu'on se passe à tour de rôle.", {
          sb: bbValue >= 2 ? bbValue / 2 : '?',
        })}
      </Text>
      <LevelPicker value={levelMinutes} onChange={setLevelMinutes} />
      {new Set(cleaned).size !== cleaned.length && (
        <Text style={styles.error}>{t('Deux joueurs ont le même nom.')}</Text>
      )}
      {!bots.includes(false) && <Text style={styles.error}>{t('Il faut au moins un joueur humain.')}</Text>}
    </>
  );
  const start = (
    <Button
      label={t('Lancer la partie')}
      disabled={!valid}
      onPress={() =>
        onStart({
          names: cleaned,
          stack: stackValue,
          bigBlind: bbValue,
          levelMinutes,
          avatars,
          bots,
          variant,
        })
      }
    />
  );
  const back = <Button label={t('Retour')} variant="secondary" onPress={onBack} />;

  if (desktop) {
    // On a computer: one card, the players on the left and the settings on the right.
    return (
      <ScrollView contentContainerStyle={styles.containerWide} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, styles.titleWide]}>{t('Sur ce téléphone')}</Text>
        <View style={styles.card}>
          <View style={styles.columns}>
            <View style={styles.column}>{playersSection}</View>
            <View style={styles.divider} />
            <View style={styles.column}>{settingsSection}</View>
          </View>
          <View style={styles.footer}>
            <View>{back}</View>
            <View style={styles.startWide}>{start}</View>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t('Sur ce téléphone')}</Text>
      {playersSection}
      {settingsSection}
      <View style={styles.spacer} />
      {start}
      {back}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60 },
  title: { color: colors.gold, fontSize: 30, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  label: { color: colors.muted, marginBottom: 4 },
  input: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginVertical: 4,
  },
  hint: { color: colors.muted, marginTop: 8, fontSize: 13 },
  remove: { width: 60 },
  botRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  botName: { color: colors.text, fontSize: 16 },
  botTag: { color: colors.gold, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  error: { color: colors.gold, marginTop: 8 },
  spacer: { height: 24 },
  containerWide: { paddingHorizontal: 32, paddingTop: 48, paddingBottom: 40 },
  titleWide: { fontSize: 34, marginBottom: 20 },
  card: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    padding: 28,
    paddingTop: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
  },
  columns: { flexDirection: 'row', gap: 28 },
  column: { flex: 1, minWidth: 0 },
  divider: { width: 1, marginTop: 24, backgroundColor: colors.glassBorder },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  startWide: { minWidth: 260 },
});
