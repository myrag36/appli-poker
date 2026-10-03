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
import { Table } from '../components/Table';
import { TopBar } from '../components/TopBar';
import { TurnTimer } from '../components/TurnTimer';
import { callServer } from '../online/supabase';
import { useRoom } from '../online/useRoom';
import { colors } from '../theme';

interface Props {
  roomId: string;
  userId: string;
  onLeave: () => void;
}

export function OnlineRoomScreen({ roomId, userId, onLeave }: Props) {
  const { room, players, myCards, error: syncError, refresh } = useRoom(roomId, userId);
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
        {syncError ? <Text style={styles.error}>{syncError}</Text> : <ActivityIndicator color={colors.gold} />}
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
          {isHost ? (
            <Button
              label={players.length < 2 ? 'En attente d\'un autre joueur…' : 'Lancer la partie'}
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
        <TopBar onBack={onLeave}>
          <Pressable accessibilityRole="button" onPress={invite} hitSlop={8} style={styles.codePill}>
            <Text style={styles.codePillText}>
              Table <Text style={styles.codePillCode}>{room.code}</Text> · Inviter
            </Text>
          </Pressable>
        </TopBar>
      }
      table={({ width, height }) => <Table hand={hand} meId={userId} maxWidth={width} maxHeight={height} />}
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
                  {myCards.map((c) => (
                    <PlayingCard key={c} card={c} width={42} />
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
                <PanelText>🏆 {withChips[0]?.name} gagne la partie !</PanelText>
              ) : isHost ? (
                <Button compact label="Main suivante" disabled={busy} onPress={() => send({ type: 'deal', roomId })} />
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
    backgroundColor: colors.feltDark,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  codePillText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  codePillCode: { color: colors.gold, fontWeight: '800', letterSpacing: 2 },
  waitPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.feltDark,
    minHeight: 79,
  },
  waitText: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center' },
  note: { color: colors.muted, textAlign: 'center', fontSize: 12 },
  error: { color: colors.gold, textAlign: 'center' },
  spacer: { height: 16 },
});
