import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Backdrop } from './Backdrop';
import { PlayingCard } from './PlayingCard';
import { t as tr } from '../i18n';
import { THEMES, type Theme, type ThemeId, canChangeTheme, colors, setTheme, themeId } from '../theme';

/** A small picture of the theme: its scenery with a table in the middle. */
function ThemePreview({ id, width, height }: { id: ThemeId; width: number; height: number }) {
  const t: Theme = THEMES[id];
  const tableW = width * 0.78;
  const tableH = height * 0.42;
  return (
    <View style={{ width, height, overflow: 'hidden', backgroundColor: t.colors.background }}>
      <Backdrop theme={t} width={width} height={height} />
      <View
        style={[
          styles.previewRail,
          {
            width: tableW,
            height: tableH,
            left: (width - tableW) / 2,
            top: height * 0.5 - tableH / 2,
            borderRadius: tableH / 2,
            borderColor: t.colors.railBorder,
          },
        ]}
      >
        <LinearGradient colors={t.gradients.wood} style={StyleSheet.absoluteFill} />
        <View style={[styles.previewFelt, { borderRadius: tableH / 2, borderColor: t.colors.feltBorder }]}>
          <LinearGradient colors={t.gradients.felt} style={StyleSheet.absoluteFill} />
          {t.feltMark && <Text style={[styles.previewMark, { fontSize: tableH * 0.5 }]}>{t.feltMark}</Text>}
          {width >= 80 && (
            <View style={styles.previewCards}>
              {['Ah', 'Ks', 'Qd'].map((c) => (
                <PlayingCard key={c} card={c} width={Math.round(width * 0.11)} />
              ))}
            </View>
          )}
        </View>
      </View>
      {width >= 80 && (
        <View
          style={[
            styles.previewChip,
            { backgroundColor: t.colors.gold, left: width / 2 - 5, top: height * 0.5 + tableH / 2 + 6 },
          ]}
        />
      )}
    </View>
  );
}

/** Button showing the current theme, which opens a gallery of all themes with a preview of each. */
export function ThemeChooser() {
  const [open, setOpen] = useState(false);
  const { width: screenW } = useWindowDimensions();
  if (!canChangeTheme) return null;

  const current = THEMES[themeId];
  const sheetW = Math.min(screenW - 24, 480);
  // Sheet border (2), side padding (32) and the gap between the two columns (12).
  const cardW = Math.floor((sheetW - 2 - 32 - 12) / 2);
  const previewH = Math.round(cardW * 1.15);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr("Choisir l'ambiance")}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <View style={styles.buttonThumb}>
          <ThemePreview id={themeId} width={44} height={44} />
        </View>
        <View style={styles.buttonBody}>
          <Text style={styles.buttonLabel}>{tr('Ambiance')}</Text>
          <Text style={styles.buttonName}>{tr(current.name)}</Text>
        </View>
        <Text style={styles.buttonAction}>{tr('Changer ›')}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { width: sheetW }]} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={styles.title}>{tr('Choisis ton ambiance')}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tr('Fermer')}
                onPress={() => setOpen(false)}
                hitSlop={10}
                style={styles.close}
              >
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.grid}>
              {(Object.keys(THEMES) as ThemeId[]).map((id) => {
                const t = THEMES[id];
                const active = id === themeId;
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={tr('Ambiance {name}', { name: tr(t.name) })}
                    onPress={() => (active ? setOpen(false) : setTheme(id))}
                    style={({ pressed }) => [
                      styles.card,
                      { width: cardW, borderColor: active ? t.colors.gold : 'rgba(255,255,255,0.12)' },
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemePreview id={id} width={cardW - 4} height={previewH} />
                    <View style={[styles.cardBody, { backgroundColor: t.colors.background }]}>
                      <Text style={[styles.cardName, { color: t.colors.gold }]}>
                        {tr(t.name)}
                        {active ? '  ✓' : ''}
                      </Text>
                      <Text style={[styles.cardTagline, { color: t.colors.muted }]} numberOfLines={2}>
                        {tr(t.tagline)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  buttonThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  buttonBody: { flex: 1 },
  buttonLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  buttonName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  buttonAction: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  sheet: {
    maxHeight: '92%',
    borderRadius: 20,
    backgroundColor: '#15171c',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  title: { color: '#f8f9fa', fontSize: 20, fontWeight: '900' },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  closeText: { color: '#f8f9fa', fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  card: { borderRadius: 14, borderWidth: 2, overflow: 'hidden' },
  cardBody: { paddingHorizontal: 10, paddingVertical: 8, gap: 2, minHeight: 58 },
  cardName: { fontSize: 15, fontWeight: '800' },
  cardTagline: { fontSize: 11, lineHeight: 14 },
  previewRail: { position: 'absolute', borderWidth: 1, padding: 4, overflow: 'hidden' },
  previewFelt: {
    flex: 1,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewMark: { position: 'absolute', opacity: 0.12, color: '#ffffff' },
  previewCards: { flexDirection: 'row', gap: 2 },
  previewChip: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    borderStyle: 'dashed',
  },
});
