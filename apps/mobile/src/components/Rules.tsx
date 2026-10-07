import { type ReactNode, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type DecorId, GameDecor } from './GameDecor';
import { colors, gradients, shadow } from '../theme';

/** One step of a game's rules: an icon, a short title, the explanation and an optional picture. */
export interface RuleStep {
  icon: string;
  title: string;
  text: string;
  /** Cards, dice or anything that shows the rule rather than telling it. */
  visual?: ReactNode;
}

export interface GameRules {
  game: DecorId;
  title: string;
  /** The goal of the game in one sentence, under the title. */
  goal: string;
  steps: RuleStep[];
  /** A last friendly tip, shown in gold at the bottom. */
  tip?: string;
}

/** "Règles du jeu" button that opens the illustrated rules of a game. */
export function RulesButton({ rules }: { rules: GameRules }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Règles : ${rules.title}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonIcon}>📖</Text>
        <Text style={styles.buttonText}>Règles du jeu</Text>
      </Pressable>
      <RulesSheet rules={rules} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function RulesSheet({
  rules,
  open,
  onClose,
}: {
  rules: GameRules;
  open: boolean;
  onClose: () => void;
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const sheetW = Math.min(screenW - 20, 520);
  const headerH = 170;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer les règles">
        <Pressable
          style={[styles.sheet, shadow, { width: sheetW, maxHeight: screenH - 40 }]}
          // Taps inside the sheet must not close it.
          onPress={() => {}}
        >
          <View style={[styles.header, { height: headerH }]}>
            <View style={styles.headerArt}>
              <GameDecor id={rules.game} width={sheetW} height={headerH} />
            </View>
            {/* Darkens the picture under the text so the title always reads well. */}
            <LinearGradient
              colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.85)']}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.headerKicker}>Règles du jeu</Text>
            <Text style={styles.headerTitle}>{rules.title}</Text>
            <Text style={styles.headerGoal}>{rules.goal}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              onPress={onClose}
              hitSlop={10}
              style={styles.close}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            {rules.steps.map((step, i) => (
              <View key={step.title} style={styles.step}>
                <View style={styles.stepSide}>
                  <LinearGradient colors={gradients.gold} style={styles.stepIcon}>
                    <Text style={styles.stepIconText}>{step.icon}</Text>
                  </LinearGradient>
                  {i < rules.steps.length - 1 && <View style={styles.stepLine} />}
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.stepNumber}>Étape {i + 1}</Text>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepText}>{step.text}</Text>
                  {step.visual && <View style={styles.visual}>{step.visual}</View>}
                </View>
              </View>
            ))}
            {rules.tip && (
              <View style={styles.tip}>
                <Text style={styles.tipText}>💡 {rules.tip}</Text>
              </View>
            )}
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.done}>
              <LinearGradient colors={gradients.gold} style={styles.doneInner}>
                <Text style={styles.doneText}>C’est compris !</Text>
              </LinearGradient>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** A small labelled row for a visual: a caption next to cards or dice. */
export function RuleExample({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <View style={styles.example}>
      <View style={styles.exampleItems}>{children}</View>
      {label && <Text style={styles.exampleLabel}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: colors.glass,
  },
  pressed: { opacity: 0.8 },
  buttonIcon: { fontSize: 18 },
  buttonText: { color: colors.gold, fontSize: 16, fontWeight: '800' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  headerArt: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.7 },
  header: { justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 14 },
  headerKicker: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 8,
  },
  headerGoal: { color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 19, marginTop: 2 },
  close: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  body: { padding: 18, paddingBottom: 22 },
  step: { flexDirection: 'row', gap: 14 },
  stepSide: { alignItems: 'center', width: 40 },
  stepIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stepIconText: { fontSize: 19 },
  stepLine: { flex: 1, width: 2, marginVertical: 4, backgroundColor: colors.glassBorder },
  stepBody: { flex: 1, paddingBottom: 18 },
  stepNumber: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  stepTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 1 },
  stepText: { color: colors.text, opacity: 0.85, fontSize: 14, lineHeight: 20, marginTop: 3 },
  visual: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 8,
  },
  example: { alignItems: 'center', gap: 4 },
  exampleItems: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
  exampleLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  tip: {
    marginTop: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.glass,
  },
  tipText: { color: colors.gold, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  done: { marginTop: 18, borderRadius: 14, overflow: 'hidden' },
  doneInner: { paddingVertical: 13, alignItems: 'center' },
  doneText: { color: colors.onGold, fontSize: 16, fontWeight: '800' },
});
