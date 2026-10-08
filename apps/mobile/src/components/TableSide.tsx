// Computer layout pieces shared by the card tables (Belote, Tarot, Président, Rami):
// a landscape table with a score panel beside it, compact centered buttons and a two-column setup card.
import { Children, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useDesktop } from '../layout';
import { colors } from '../theme';

/** Width of the score panel beside the table on a computer. */
export const SIDE_W = 248;
const GAP = 18;

/** True when a Pressable is under the mouse (react-native-web passes it, the types do not say so). */
export const isHovered = (state: object) => !!(state as { hovered?: boolean }).hovered;

/**
 * The table drawn in the space GameLayout gives, with the score panel on its right.
 * `table` receives the room left for the table itself.
 */
export function TableWithSide({
  width,
  height,
  side,
  table,
  maxAspect,
}: {
  width: number;
  height: number;
  side: ReactNode;
  /** Widest the table may be for its height, so that it and the panel stay together in the middle. */
  maxAspect?: number;
  table: (size: { width: number; height: number }) => ReactNode;
}) {
  const room = Math.max(0, width - SIDE_W - GAP);
  const tableW = maxAspect ? Math.min(room, Math.round(height * maxAspect)) : room;
  return (
    <View style={[styles.row, { width, height }]}>
      <View style={[styles.tableBox, { width: tableW, height }]}>{table({ width: tableW, height })}</View>
      <View style={[styles.side, { maxHeight: height }]}>
        <ScrollView contentContainerStyle={styles.sideContent}>{side}</ScrollView>
      </View>
    </View>
  );
}

/** One block of the score panel, with a small title. */
export function SideSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      {children}
    </View>
  );
}

/** A line of the score panel: a label on the left, a value on the right. */
export function SideLine({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel} numberOfLines={1}>
        {label}
      </Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={[styles.lineValue, strong && styles.lineValueStrong]}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

/** Buttons side by side; on a computer they keep a natural width and stay centered. */
export function ActionRow({ children, gap = 6 }: { children: ReactNode; gap?: number }) {
  const desktop = useDesktop();
  if (!desktop) return <View style={[styles.actionsPhone, { gap }]}>{children}</View>;
  return (
    <View style={styles.actionsDesktop}>
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={styles.actionDesktop}>
          {child}
        </View>
      ))}
    </View>
  );
}

/**
 * A game's setup screen. On a phone, `intro` and `children` follow each other in one scrolling column
 * (as before); on a computer they sit in two columns of a centered card.
 */
export function SetupFrame({
  hero,
  intro,
  children,
  phoneStyle,
}: {
  /** A picture above the title, only on a computer where there is room for it. */
  hero?: ReactNode;
  intro: ReactNode;
  children: ReactNode;
  /** The phone column's style. */
  phoneStyle: StyleProp<ViewStyle>;
}) {
  const desktop = useDesktop();
  if (!desktop)
    return (
      <ScrollView contentContainerStyle={phoneStyle} keyboardShouldPersistTaps="handled">
        {intro}
        {children}
      </ScrollView>
    );
  return (
    <ScrollView contentContainerStyle={styles.setupPage} keyboardShouldPersistTaps="handled">
      <View style={styles.setupCard}>
        <View style={styles.setupIntro}>
          {hero && <View style={styles.setupHero}>{hero}</View>}
          {intro}
        </View>
        <View style={styles.setupDivider} />
        <View style={styles.setupForm}>{children}</View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GAP },
  tableBox: { alignItems: 'center', justifyContent: 'center' },
  side: {
    width: SIDE_W,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
    overflow: 'hidden',
  },
  sideContent: { padding: 16, gap: 16 },
  section: { gap: 6 },
  sectionTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  lineLabel: { color: colors.muted, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  lineValue: { color: colors.text, fontSize: 14, fontWeight: '800' },
  lineValueStrong: { color: colors.gold, fontSize: 16, fontWeight: '900' },
  actionsPhone: { flexDirection: 'row' },
  actionsDesktop: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  actionDesktop: { minWidth: 150 },
  setupPage: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  setupCard: {
    width: '100%',
    maxWidth: 980,
    flexDirection: 'row',
    gap: 36,
    padding: 36,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
  },
  setupIntro: { flex: 1, justifyContent: 'center' },
  setupHero: { flexDirection: 'row', justifyContent: 'center', marginBottom: 18 },
  setupDivider: { width: 1, backgroundColor: colors.glassBorder },
  setupForm: { flex: 1.15 },
});
