import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Action } from '@appli-poker/engine';
import { ActionPanel } from '../components/ActionPanel';
import { Button } from '../components/Button';
import { GameLayout } from '../components/GameLayout';
import { HandSummary } from '../components/HandSummary';
import { Panel, PanelText } from '../components/Panel';
import { PlayingCard } from '../components/PlayingCard';
import { Ranking } from '../components/Ranking';
import { Table } from '../components/Table';
import { TopBar } from '../components/TopBar';
import { TurnTimer } from '../components/TurnTimer';
import { callServer } from '../online/supabase';
import { REACTIONS, useRoom } from '../online/useRoom';
import { sounds, useHandSounds } from '../feedback';
import { Appear } from '../components/Motion';
import { colors } from '../theme';

interface Props {
  roomId: string;
  userId: string;
  onLeave: () => void;
}

export function OnlineRoomScreen({ roomId, userId, onLeave }: Props) {
  const {
    room,
    players,
    myCards,
    error: syncError,
    refresh,
    reactions,
    sendReaction,
  } = useRoom(roomId, userId);
  const [trayOpen, setTrayOpen] = useState(false);
  useHandSounds(room?.public_state ?? null, userId);
  const lastReaction = Object.values(reactions).reduce((m, r) => Math.max(m, r.key), 0);
  useEffect(() => {
    if (lastReaction) sounds.reaction();
  }, [lastReaction]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastTimeoutRequest = useRef(0);
  const insets = useSafeAreaInsets();

  const deadline = room?.public_state?.deadline ?? null;

  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [deadline]);

  // When time runs out, any phone at the table asks the server to play for the absent player.
  // The server checks the time itself, so an early or duplicate request is simply refused.
  useEffect(() => {
    const t = Date.now();
    if (!deadline || t < deadline || t - lastTimeoutRequest.current < 3000) return;
    lastTimeoutRequest.current = t;
    callServer({ type: 'timeout', roomId })
      .then(refresh)
      .catch(() => {});
  }, [deadline, now, roomId, refresh]);

  async function send(request: Parameters<typeof callServer>[0]) {
    setBusy(true);
    setError(null);
    try {
      await callServer(request);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!room) {
    return (
      <View style={styles.loading}>
        {syncError ? (
          <Text style={styles.error}>{syncError}</Text>
        ) : (
          <ActivityIndicator color={colors.gold} />
        )}
        <View style={styles.spacer} />
        <Button label="Retour" variant="secondary" onPress={onLeave} />
      </View>
    );
  }

  const isHost = room.host_id === userId;
  const host = players.find((p) => p.user_id === room.host_id);
  const hand = room.public_state;
  const actor = hand && hand.toAct >= 0 ? hand.players[hand.toAct] : null;
  const myTurn = actor?.id === userId;
  const inHand = hand?.players.some((p) => p.id === userId) ?? false;
  const withChips = players.filter((p) => p.stack > 0);
  const waiting = hand ? players.filter((p) => !hand.players.some((h) => h.id === p.user_id)) : [];

  const invite = () =>
    Share.share({ message: `Viens jouer au poker avec moi ! Code de la table : ${room.code}` });

  if (!hand) {
    return (
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}>
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Code de la table</Text>
          <Text style={styles.code}>{room.code}</Text>
          <Button label="Inviter des amis" variant="secondary" onPress={invite} />
        </View>
        <Panel title={`Joueurs (${players.length}/8)`}>
          {players.map((p) => (
            <PanelText key={p.user_id}>
              {p.name}
              {p.user_id === room.host_id ? ' 👑' : ''}
              {p.user_id === userId ? ' (toi)' : ''}
            </PanelText>
          ))}
          {room.level_minutes && (
            <PanelText>
              🏆 Tournoi : les blindes augmentent toutes les {room.level_minutes} minutes.
            </PanelText>
          )}
          {isHost ? (
            <Button
              label={players.length < 2 ? "En attente d'un autre joueur…" : 'Lancer la partie'}
              disabled={busy || players.length < 2}
              onPress={() => send({ type: 'deal', roomId })}
            />
          ) : (
            <PanelText>En attente que {host?.name ?? 'le créateur'} lance la partie…</PanelText>
          )}
        </Panel>
        {syncError && <Text style={styles.error}>{syncError}</Text>}
        <View style={styles.spacer} />
        <Button label="Retour à l'accueil" variant="secondary" onPress={onLeave} />
      </ScrollView>
    );
  }

  return (
    <GameLayout
      top={
        <View style={styles.topWrap}>
          <TopBar onBack={onLeave}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Réagir"
              onPress={() => setTrayOpen(!trayOpen)}
              hitSlop={8}
              style={[styles.reactButton, trayOpen && styles.reactButtonOpen]}
            >
              <Text style={styles.reactButtonText}>😀</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={invite} hitSlop={8} style={styles.codePill}>
              <Text style={styles.codePillText}>
                <Text style={styles.codePillCode}>{room.code}</Text> · Inviter
              </Text>
            </Pressable>
          </TopBar>
          {trayOpen && (
            <Appear from={-10} style={styles.tray}>
              {REACTIONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  accessibilityRole="button"
                  onPress={() => {
                    sendReaction(emoji);
                    setTrayOpen(false);
                  }}
                  style={({ pressed }) => [styles.trayItem, pressed && styles.trayItemPressed]}
                >
                  <Text style={styles.trayEmoji}>{emoji}</Text>
                </Pressable>
              ))}
            </Appear>
          )}
        </View>
      }
      table={({ width, height }) => (
        <Table
          hand={hand}
          meId={userId}
          maxWidth={width}
          maxHeight={height}
          reactions={reactions}
          nextLevelAt={hand.tournament?.nextLevelAt}
        />
      )}
      bottom={
        <>
          {actor && hand.deadline && (
            <TurnTimer deadline={hand.deadline} now={now} name={myTurn ? 'Toi' : actor.name} />
          )}

          {myTurn && hand.street !== 'finished' && (
            <ActionPanel
              key={room.version}
              hand={hand}
              playerId={userId}
              title="À toi de jouer"
              hole={myCards}
              error={error}
              busy={busy}
              onAction={(action: Action) => send({ type: 'act', roomId, action })}
            />
          )}

          {!myTurn && hand.street !== 'finished' && (
            <View style={styles.waitPanel}>
              {inHand && myCards.length > 0 && (
                <View style={styles.cards}>
                  {myCards.map((c, i) => (
                    <Appear key={c} delay={i * 140}>
                      <PlayingCard card={c} width={42} />
                    </Appear>
                  ))}
                </View>
              )}
              <Text style={styles.waitText}>
                {!inHand ? 'Tu joueras à la prochaine main.' : actor ? `Au tour de ${actor.name}` : ''}
              </Text>
            </View>
          )}

          {hand.street === 'finished' && (
            <HandSummary hand={hand}>
              {withChips.length < 2 ? (
                <>
                  <PanelText>🏆 {withChips[0]?.name} gagne la partie !</PanelText>
                  <Ranking
                    entries={players
                      .filter((p) => p.stack > 0 || p.place !== null)
                      .map((p) => ({ name: p.name, place: p.stack > 0 ? 1 : (p.place ?? players.length) }))}
                  />
                </>
              ) : isHost ? (
                <Button
                  compact
                  label="Main suivante"
                  disabled={busy}
                  onPress={() => send({ type: 'deal', roomId })}
                />
              ) : (
                <PanelText>En attente que {host?.name ?? 'le créateur'} distribue…</PanelText>
              )}
              {error && <Text style={styles.error}>{error}</Text>}
            </HandSummary>
          )}

          {waiting.length > 0 && (
            <Text style={styles.note} numberOfLines={1}>
              Rejoindront à la prochaine main : {waiting.map((p) => p.name).join(', ')}
            </Text>
          )}
          {syncError && <Text style={styles.error}>{syncError}</Text>}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 56 },
  loading: { flex: 1, justifyContent: 'center', padding: 24 },
  codeBox: { alignItems: 'stretch', marginTop: 16, gap: 4 },
  codeLabel: { color: colors.muted, textAlign: 'center' },
  code: { color: colors.gold, fontSize: 40, fontWeight: '800', letterSpacing: 8, textAlign: 'center' },
  cards: { flexDirection: 'row', gap: 2 },
  codePill: {
    backgroundColor: colors.glass,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  topWrap: { zIndex: 10 },
  reactButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  reactButtonOpen: { borderColor: colors.gold },
  reactButtonText: { fontSize: 17 },
  tray: {
    position: 'absolute',
    top: 40,
    right: 0,
    flexDirection: 'row',
    gap: 4,
    padding: 6,
    borderRadius: 24,
    backgroundColor: 'rgba(6, 28, 19, 0.95)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
    zIndex: 20,
  },
  trayItem: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  trayItemPressed: { backgroundColor: 'rgba(255,255,255,0.12)' },
  trayEmoji: { fontSize: 26 },
  codePillText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  codePillCode: { color: colors.gold, fontWeight: '800', letterSpacing: 2 },
  waitPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    minHeight: 79,
  },
  waitText: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center' },
  note: { color: colors.muted, textAlign: 'center', fontSize: 12 },
  error: { color: colors.gold, textAlign: 'center' },
  spacer: { height: 16 },
});
