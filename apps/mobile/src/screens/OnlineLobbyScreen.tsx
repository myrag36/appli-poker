import { useEffect, useState } from 'react';
import { type Avatar, type Variant, cleanAvatar, defaultAvatar } from '@appli-poker/engine';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AvatarBadge, AvatarPicker } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { LevelPicker } from '../components/LevelPicker';
import { VariantPicker } from '../components/VariantPicker';
import { callServer, loadAvatar, saveAvatar, saveLastRoom } from '../online/supabase';
import { colors } from '../theme';
import { t } from '../i18n';
import { tMessage } from '../online/messages';
import { useDesktop } from '../layout';

interface Props {
  initialName: string;
  /** Code of a table to join (from an invitation or a notification). */
  initialCode?: string;
  onEnter: (roomId: string, name: string) => void;
  onBack: () => void;
}

/** Create a private table or join one with the code a friend shared. */
export function OnlineLobbyScreen({ initialName, initialCode, onEnter, onBack }: Props) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode ?? '');
  const [stack, setStack] = useState('1000');
  const [bigBlind, setBigBlind] = useState('20');
  const [levelMinutes, setLevelMinutes] = useState<number | null>(null);
  const [variant, setVariant] = useState<Variant>('holdem');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<Avatar>(() => defaultAvatar(Math.floor(Math.random() * 8)));
  const [pickingAvatar, setPickingAvatar] = useState(false);

  useEffect(() => {
    loadAvatar().then((a) => a && setAvatar(cleanAvatar(a, a)));
  }, []);

  function changeAvatar(a: Avatar) {
    setAvatar(a);
    saveAvatar(a);
  }

  const trimmed = name.trim();
  const desktop = useDesktop();

  async function run(request: () => Promise<{ roomId: string }>) {
    setBusy(true);
    setError(null);
    try {
      const { roomId } = await request();
      await saveLastRoom({ roomId, name: trimmed });
      onEnter(roomId, trimmed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const join = (
    <>
      <Text style={styles.label}>{t('Ton prénom et ton avatar')}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Changer d'avatar")}
          onPress={() => setPickingAvatar(!pickingAvatar)}
        >
          <AvatarBadge avatar={avatar} size={48} />
          <Text style={styles.edit}>✎</Text>
        </Pressable>
        <TextInput
          style={[styles.input, styles.flex]}
          value={name}
          onChangeText={setName}
          maxLength={16}
          placeholder="Simon"
          placeholderTextColor={colors.muted}
        />
      </View>
      {pickingAvatar && <AvatarPicker value={avatar} onChange={changeAvatar} />}

      <Text style={styles.section}>{t('Rejoindre une table')}</Text>
      <TextInput
        style={[styles.input, styles.code]}
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
        maxLength={6}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder={t('CODE')}
        placeholderTextColor={colors.muted}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            label={t('Rejoindre')}
            disabled={busy || !trimmed || code.trim().length !== 6}
            onPress={() => run(() => callServer({ type: 'join', name: trimmed, code, avatar }))}
          />
        </View>
        <View style={styles.flex}>
          <Button
            label={t('👀 Regarder')}
            variant="secondary"
            disabled={busy || !trimmed || code.trim().length !== 6}
            onPress={() => run(() => callServer({ type: 'watch', name: trimmed, code }))}
          />
        </View>
      </View>
      <Text style={styles.hint}>
        {t('Regarder : tu suis la partie sans jouer, et tu peux la rejoindre ensuite.')}
      </Text>
    </>
  );

  const create = (
    <>
      <Text style={[styles.section, desktop && styles.sectionFirst]}>{t('Ou créer une table')}</Text>
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
      <VariantPicker value={variant} onChange={setVariant} />
      <LevelPicker value={levelMinutes} onChange={setLevelMinutes} />
      <Button
        label={t('Créer la table')}
        variant="secondary"
        disabled={busy || !trimmed}
        onPress={() =>
          run(() =>
            callServer({
              type: 'create',
              name: trimmed,
              stack: parseInt(stack, 10),
              bigBlind: parseInt(bigBlind, 10),
              levelMinutes,
              avatar,
              variant,
            }),
          )
        }
      />
    </>
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.container, desktop && styles.containerDesktop]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{t('Jouer en ligne')}</Text>
      {desktop ? (
        // On a computer: join on the left, create on the right, each in its own panel.
        <View style={styles.columns}>
          <View style={styles.panel}>{join}</View>
          <View style={styles.panel}>{create}</View>
        </View>
      ) : (
        <>
          {join}
          {create}
        </>
      )}

      {error && <Text style={styles.error}>{tMessage(error)}</Text>}

      <View style={styles.spacer} />
      <View style={desktop && styles.backDesktop}>
        <Button label={t('Retour')} variant="secondary" onPress={onBack} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60 },
  containerDesktop: { width: '100%', maxWidth: 1000, alignSelf: 'center', paddingHorizontal: 32 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 24, marginTop: 8 },
  panel: {
    flex: 1,
    padding: 20,
    borderRadius: 18,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  sectionFirst: { marginTop: 0 },
  backDesktop: { width: 260, alignSelf: 'center' },
  title: { color: colors.gold, fontSize: 30, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 8 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 6 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  edit: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    color: colors.onGold,
    backgroundColor: colors.gold,
    borderRadius: 9,
    width: 18,
    height: 18,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 18,
    overflow: 'hidden',
  },
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
  code: { fontSize: 24, letterSpacing: 6, textAlign: 'center', fontWeight: '700' },
  error: { color: colors.gold, marginTop: 12, textAlign: 'center' },
  spacer: { height: 24 },
});
