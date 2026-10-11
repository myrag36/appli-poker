// Pieces of the tables open to strangers: the private/public choice, the "Tables ouvertes" list,
// the rating change after a game, and blocking a player.
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  type QuickGameId,
  defaultAvatar,
  eloDeltaLabel,
} from "@appli-poker/engine";
import { AvatarBadge } from "./AvatarPicker";
import { Pill } from "./LevelPicker";
import { ONLINE_UI } from "../online-games";
import {
  type OpenTable,
  blockPlayer,
  loadBlocked,
  unblockPlayer,
  useOpenTables,
  useRatingChange,
} from "../online/rapide";
import { tMessage } from "../online/messages";
import { colors } from "../theme";
import { t, tn } from "../i18n";

/** Name and emoji of a game that can be played with strangers. */
export function quickGameLook(game: QuickGameId): {
  title: string;
  emoji: string;
} {
  if (game === "poker") return { title: "Poker", emoji: "♥️" };
  const ui = ONLINE_UI[game];
  return { title: t(ui.title), emoji: ui.emoji };
}

/** Private (friends with the code, the default) or public (listed in "Tables ouvertes"). */
export function VisibilityPicker({
  value,
  onChange,
}: {
  value: "private" | "public";
  onChange: (v: "private" | "public") => void;
}) {
  return (
    <View style={styles.visibility}>
      <View style={styles.pills}>
        <Pill
          label={t("🔒 Privée")}
          active={value === "private"}
          onPress={() => onChange("private")}
        />
        <Pill
          label={t("🌍 Publique")}
          active={value === "public"}
          onPress={() => onChange("public")}
        />
      </View>
      <Text style={styles.hint}>
        {value === "public"
          ? t(
              "Visible dans « Tables ouvertes » : n’importe qui peut s’asseoir. La partie compte pour la cote.",
            )
          : t("Seuls ceux qui ont le code peuvent venir.")}
      </Text>
    </View>
  );
}

/**
 * Public tables waiting for players (of one game, or of all games), joined with one tap. Only
 * the creator's pseudo, avatar and level are shown.
 */
export function OpenTablesList({
  game,
  onJoin,
  hideWhenEmpty,
  limit = 30,
  title,
}: {
  game?: QuickGameId;
  onJoin: (table: OpenTable) => void;
  hideWhenEmpty?: boolean;
  limit?: number;
  /** A heading drawn above the list (only when there is something to show with hideWhenEmpty). */
  title?: string;
}) {
  const { tables, failed } = useOpenTables(game);
  if (!tables) {
    if (hideWhenEmpty) return null;
    return failed ? (
      <Text style={styles.empty}>{t("Pas de connexion au serveur")}</Text>
    ) : (
      <ActivityIndicator color={colors.gold} style={styles.loading} />
    );
  }
  if (tables.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <Text style={styles.empty}>
        {t(
          "Aucune table ouverte pour l’instant. Crée une table « Publique » ou lance une partie rapide !",
        )}
      </Text>
    );
  }
  return (
    <View style={styles.tables}>
      {title && <Text style={styles.listTitle}>{title}</Text>}
      {tables.slice(0, limit).map((table) => {
        const look = quickGameLook(table.game);
        return (
          <Pressable
            key={table.code}
            accessibilityRole="button"
            accessibilityLabel={t("Rejoindre la table de {name} : {game}", {
              name: table.host.name,
              game: look.title,
            })}
            onPress={() => onJoin(table)}
            style={({ pressed }) => [styles.table, pressed && styles.pressed]}
          >
            <AvatarBadge
              avatar={{
                emoji: table.host.avatar ?? defaultAvatar(0).emoji,
                color: table.host.avatar_color ?? defaultAvatar(0).color,
                level: table.host.level,
              }}
              size={40}
            />
            <View style={styles.tableBody}>
              <Text style={styles.tableGame} numberOfLines={1}>
                {look.emoji} {look.title}
              </Text>
              <Text style={styles.tableHost} numberOfLines={1}>
                {t("Table de {name}", { name: table.host.name })} ·{" "}
                {t("{n}/{max} joueurs", { n: table.players, max: table.max })}
              </Text>
            </View>
            <View style={styles.join}>
              <Text style={styles.joinText}>{t("Rejoindre")}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Cote Uno : 1024 (+24)" once a rated table ends. */
export function RatingResult({
  roomId,
  game,
}: {
  roomId: string;
  game: QuickGameId;
}) {
  const change = useRatingChange(roomId, true);
  if (!change) return null;
  const up = change.delta >= 0;
  return (
    <View style={[styles.rating, up ? styles.ratingUp : styles.ratingDown]}>
      <Text style={styles.ratingText} numberOfLines={1}>
        {t("Cote {game} : {rating}", {
          game: quickGameLook(game).title,
          rating: change.rating_after ?? "—",
        })}{" "}
        <Text style={up ? styles.deltaUp : styles.deltaDown}>
          ({eloDeltaLabel(change.delta)})
        </Text>
      </Text>
    </View>
  );
}

/** Someone at a table with strangers, as the block list shows them. */
export interface StrangerSeat {
  user_id: string;
  name: string;
  avatar: string | null;
  avatar_color: string | null;
}

/**
 * "🚫 Bloquer…": opens the list of the other people at the table. A blocked player is never
 * seated with me again by a quick game, and our public tables are hidden from each other.
 */
export function BlockButton({
  players,
  compact,
}: {
  players: StrangerSeat[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (players.length === 0) return null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        hitSlop={6}
        style={({ pressed }) => [
          styles.blockButton,
          compact && styles.blockCompact,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.blockButtonText}>{t("🚫 Bloquer…")}</Text>
      </Pressable>
      {open && <BlockSheet players={players} onClose={() => setOpen(false)} />}
    </>
  );
}

function BlockSheet({
  players,
  onClose,
}: {
  players: StrangerSeat[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBlocked().then(
      (list) => setBlocked(new Set(list.map((b) => b.blocked_id))),
      () => {},
    );
  }, []);

  async function toggle(p: StrangerSeat) {
    setBusy(p.user_id);
    setError(null);
    try {
      if (blocked.has(p.user_id)) {
        await unblockPlayer(p.user_id);
        setBlocked((b) => new Set([...b].filter((id) => id !== p.user_id)));
      } else {
        await blockPlayer({
          userId: p.user_id,
          name: p.name,
          avatar: p.avatar,
          avatarColor: p.avatar_color,
        });
        setBlocked((b) => new Set([...b, p.user_id]));
      }
    } catch (e) {
      setError(tMessage((e as Error).message));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel={t("Fermer")}
        />
        <View style={[styles.sheet, { marginBottom: insets.bottom }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{t("🚫 Bloquer un joueur")}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Fermer")}
              onPress={onClose}
              hitSlop={10}
              style={styles.close}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.hint}>
              {t(
                "Tu ne seras plus jamais placé avec un joueur bloqué, et vos tables publiques se cachent l’une à l’autre. Il n’est pas prévenu. Tu peux le débloquer depuis ton profil.",
              )}
            </Text>
            {players.map((p, i) => {
              const isBlocked = blocked.has(p.user_id);
              return (
                <View key={p.user_id} style={styles.player}>
                  <AvatarBadge
                    avatar={{
                      emoji: p.avatar ?? defaultAvatar(i).emoji,
                      color: p.avatar_color ?? defaultAvatar(i).color,
                    }}
                    size={34}
                  />
                  <Text style={styles.playerName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      isBlocked
                        ? t("Débloquer {name}", { name: p.name })
                        : t("Bloquer {name}", { name: p.name })
                    }
                    disabled={busy !== null}
                    onPress={() => toggle(p)}
                    style={({ pressed }) => [
                      styles.toggle,
                      isBlocked && styles.toggleOn,
                      busy === p.user_id && styles.toggleBusy,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.toggleText}>
                      {isBlocked ? t("Bloqué ✓") : t("Bloquer")}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
            {error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** The players I blocked, with a button to unblock each one (on the profile). */
export function BlockedList() {
  const [list, setList] = useState<Awaited<
    ReturnType<typeof loadBlocked>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadBlocked().then(setList, () => setList([]));
  }, []);
  if (!list)
    return <ActivityIndicator color={colors.gold} style={styles.loading} />;
  if (list.length === 0) {
    return (
      <Text style={styles.empty}>
        {t(
          "Personne. Après une partie avec des inconnus, « 🚫 Bloquer… » évite de rejouer avec quelqu’un.",
        )}
      </Text>
    );
  }
  return (
    <View style={styles.tables}>
      {list.map((b, i) => (
        <View key={b.blocked_id} style={styles.player}>
          <AvatarBadge
            avatar={{
              emoji: b.avatar ?? defaultAvatar(i).emoji,
              color: b.avatar_color ?? defaultAvatar(i).color,
            }}
            size={34}
          />
          <Text style={styles.playerName} numberOfLines={1}>
            {b.name ?? t("Joueur")}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Débloquer {name}", {
              name: b.name ?? t("Joueur"),
            })}
            onPress={async () => {
              setError(null);
              try {
                await unblockPlayer(b.blocked_id);
                setList((l) =>
                  (l ?? []).filter((x) => x.blocked_id !== b.blocked_id),
                );
              } catch (e) {
                setError(tMessage((e as Error).message));
              }
            }}
            style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
          >
            <Text style={styles.toggleText}>{t("Débloquer")}</Text>
          </Pressable>
        </View>
      ))}
      {error && <Text style={styles.error}>{error}</Text>}
      <Text style={styles.hint}>
        {tn(list.length, "{n} joueur bloqué.", "{n} joueurs bloqués.")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  visibility: { gap: 6, marginVertical: 4 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  empty: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    paddingVertical: 10,
  },
  loading: { marginVertical: 12 },
  tables: { gap: 8 },
  listTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 2,
  },
  table: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tableBody: { flex: 1, minWidth: 0 },
  tableGame: { color: colors.text, fontSize: 15, fontWeight: "700" },
  tableHost: { color: colors.muted, fontSize: 12, marginTop: 2 },
  join: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: colors.gold,
  },
  joinText: { color: colors.onGold, fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.75 },
  rating: {
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: colors.glass,
  },
  ratingUp: { borderColor: "#90be6d" },
  ratingDown: { borderColor: colors.glassBorder },
  ratingText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  deltaUp: { color: "#90be6d", fontWeight: "800" },
  deltaDown: { color: "#f4a261", fontWeight: "800" },
  blockButton: {
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  blockCompact: { paddingVertical: 4, paddingHorizontal: 10 },
  blockButtonText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "90%",
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingTop: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  closeText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  body: { padding: 16, gap: 12 },
  player: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 2,
  },
  playerName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "700" },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  toggleOn: { backgroundColor: colors.danger },
  toggleBusy: { opacity: 0.5 },
  toggleText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  error: { color: colors.gold, textAlign: "center" },
});
