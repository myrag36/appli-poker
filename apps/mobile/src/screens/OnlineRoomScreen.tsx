import { useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import type { Action } from '@appli-poker/engine';
import { ActionPanel } from '../components/ActionPanel';
import { Button } from '../components/Button';
import { HandSummary } from '../components/HandSummary';
import { Panel, PanelText } from '../components/Panel';
import { PlayingCard } from '../components/PlayingCard';
import { Table } from '../components/Table';
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

  const codeBanner = (
    <View style={styles.codeBox}>
      <Text style={styles.codeLabel}>Code de la table</Text>
      <Text style={styles.code}>{room.code}</Text>
      <Button
        label="Inviter des amis"
        variant="secondary"
        onPress={() =>
          Share.share({ message: `Viens jouer au poker avec moi ! Code de la table : ${room.code}` })
        }
      />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {!hand ? (
        <>
          {codeBanner}
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
        </>
      ) : (
        <>
          <Table hand={hand} meId={userId} />

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
            <Panel title={actor ? `Au tour de ${actor.name}` : undefined}>
              {inHand && myCards.length > 0 && (
                <View style={styles.cards}>
                  {myCards.map((c) => (
                    <PlayingCard key={c} card={c} />
                  ))}
                </View>
              )}
              {!inHand && <PanelText>Tu joueras à la prochaine main.</PanelText>}
            </Panel>
          )}

          {hand.street === 'finished' && (
            <HandSummary hand={hand}>
              {withChips.length < 2 ? (
                <PanelText>🏆 {withChips[0]?.name} gagne la partie !</PanelText>
              ) : isHost ? (
                <Button label="Main suivante" disabled={busy} onPress={() => send({ type: 'deal', roomId })} />
              ) : (
                <PanelText>En attente que {host?.name ?? 'le créateur'} distribue…</PanelText>
              )}
              {error && <Text style={styles.error}>{error}</Text>}
            </HandSummary>
          )}

          {waiting.length > 0 && (
            <Panel>
              <PanelText>
                Rejoindront à la prochaine main : {waiting.map((p) => p.name).join(', ')}
              </PanelText>
            </Panel>
          )}

          {codeBanner}
        </>
      )}

      {syncError && <Text style={styles.error}>{syncError}</Text>}
      <View style={styles.spacer} />
      <Button label="Retour à l'accueil" variant="secondary" onPress={onLeave} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 56 },
  loading: { flex: 1, justifyContent: 'center', padding: 24 },
  codeBox: { alignItems: 'stretch', marginTop: 16, gap: 4 },
  codeLabel: { color: colors.muted, textAlign: 'center' },
  code: { color: colors.gold, fontSize: 40, fontWeight: '800', letterSpacing: 8, textAlign: 'center' },
  cards: { flexDirection: 'row', justifyContent: 'center', marginVertical: 6 },
  error: { color: colors.gold, textAlign: 'center', marginTop: 8 },
  spacer: { height: 16 },
});
