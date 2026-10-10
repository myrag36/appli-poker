import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { type OnlineGameId, cleanAvatar, defaultAvatar, isOnlineGame } from '@appli-poker/engine';
import {
  type SavedRoom,
  callServer,
  ensureSignedIn,
  loadAvatar,
  loadLastRoom,
  loadName,
  saveLastRoom,
} from './src/online/supabase';
import { syncPush } from './src/notifications';
import { GameScreen } from './src/screens/GameScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { type GameId, GamesScreen } from './src/screens/GamesScreen';
import { BlackjackScreen } from './src/screens/BlackjackScreen';
import { PresidentScreen } from './src/screens/PresidentScreen';
import { YamsScreen } from './src/screens/YamsScreen';
import { BeloteScreen } from './src/screens/BeloteScreen';
import { Puissance4Screen } from './src/screens/Puissance4Screen';
import { BatailleScreen } from './src/screens/BatailleScreen';
import { EchecsScreen } from './src/screens/EchecsScreen';
import { RamiScreen } from './src/screens/RamiScreen';
import { HuitScreen, UnoScreen } from './src/screens/UnoScreen';
import { TarotScreen } from './src/screens/TarotScreen';
import { PerudoScreen } from './src/screens/PerudoScreen';
import { DamesScreen } from './src/screens/DamesScreen';
import { Backdrop } from './src/components/Backdrop';
import { OnlineLobbyScreen } from './src/screens/OnlineLobbyScreen';
import { OnlineRoomScreen } from './src/screens/OnlineRoomScreen';
import { OnlineGameScreen, type TournamentTable } from './src/screens/OnlineGameScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ShopScreen } from './src/screens/ShopScreen';
import { CustomizeScreen } from './src/screens/CustomizeScreen';
import { FriendsScreen } from './src/screens/FriendsScreen';
import { TournamentScreen } from './src/screens/TournamentScreen';
import { ProgressToast } from './src/components/ProgressToast';
import { type GameSettings, SetupScreen } from './src/screens/SetupScreen';
import { colors } from './src/theme';
import { t } from './src/i18n';

/** Games that can also be played online, each player on their own phone. */

type Screen =
  | { name: 'games' }
  | { name: 'game'; game: Exclude<GameId, 'poker'> }
  | {
      name: 'game-online';
      game: OnlineGameId;
      tournament?: TournamentTable;
      joinCode?: string;
      /** A match of the Friday tournament. */
      weekly?: boolean;
    }
  | { name: 'home' }
  | { name: 'local-setup' }
  | { name: 'local-game'; settings: GameSettings }
  | { name: 'online-lobby'; code?: string }
  | { name: 'online-room'; roomId: string; userId: string }
  | { name: 'stats' }
  | { name: 'profile' }
  | { name: 'shop'; from: 'games' | 'profile' | 'customize' }
  | { name: 'customize'; from: 'games' | 'profile' | 'shop' }
  | { name: 'friends'; friend?: string }
  | { name: 'tournaments'; id?: string; weekly?: boolean };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'games' });
  const [lastRoom, setLastRoom] = useState<SavedRoom | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);

  useEffect(() => {
    if (screen.name === 'home' || screen.name === 'games') loadLastRoom().then(setLastRoom);
    loadName().then((n) => setSavedName(n || null));
  }, [screen.name]);

  // A tap on a notification opens the app on ?jeu=belote&table=ABC123, or tells the open app.
  useEffect(() => {
    syncPush();
    if (typeof window === 'undefined' || !window.location?.search) return;
    const params = new URLSearchParams(window.location.search);
    const game = params.get('jeu');
    const code = params.get('table');
    const friend = params.get('ami');
    const weekly = params.get('tournoi') === 'vendredi';
    if ((game && code) || weekly) {
      window.history.replaceState(null, '', window.location.pathname);
      if (weekly) openWeekly(game, code);
      else joinFromLink(game!, code!);
    } else if (friend) {
      window.history.replaceState(null, '', window.location.pathname);
      openChat(friend);
    }
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'open-table') joinFromLink(String(e.data.game), String(e.data.code));
      if (e.data?.type === 'open-chat') openChat(String(e.data.friend));
      if (e.data?.type === 'open-weekly') openWeekly(e.data.game ?? null, e.data.code ?? null);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  /** The Friday tournament from a notification: my match's table, or its page. */
  function openWeekly(game: string | null, code: string | null) {
    if (game && code && isOnlineGame(game)) {
      setScreen({ name: 'game-online', game, joinCode: code.trim().toUpperCase().slice(0, 8), weekly: true });
    } else setScreen({ name: 'tournaments', weekly: true });
  }

  /** Goes to a table from an invitation or a notification, sitting down at once when possible. */
  async function joinFromLink(game: string, rawCode: string) {
    const code = rawCode.trim().toUpperCase().slice(0, 8);
    if (isOnlineGame(game)) {
      setScreen({ name: 'game-online', game, joinCode: code });
      return;
    }
    if (game !== 'poker') return;
    const [name, avatar] = await Promise.all([loadName(), loadAvatar()]);
    const who = (name ?? (await loadLastRoom())?.name ?? '').trim();
    if (!who) {
      setScreen({ name: 'online-lobby', code });
      return;
    }
    try {
      const { roomId } = await callServer<{ roomId: string }>({
        type: 'join',
        name: who,
        code,
        avatar: cleanAvatar(avatar ?? defaultAvatar(0), defaultAvatar(0)),
      });
      await saveLastRoom({ roomId, name: who });
      await openRoom(roomId);
    } catch {
      setScreen({ name: 'online-lobby', code });
    }
  }

  /** Opens my conversation with a friend, from a message notification. */
  function openChat(friend: string) {
    if (/^[0-9a-f-]{36}$/i.test(friend)) setScreen({ name: 'friends', friend: friend.toLowerCase() });
  }

  async function openRoom(roomId: string) {
    try {
      const userId = await ensureSignedIn();
      setScreen({ name: 'online-room', roomId, userId });
    } catch (e) {
      Alert.alert(t('Connexion impossible'), (e as Error).message);
    }
  }

  const home = () => setScreen({ name: 'home' });
  const games = () => setScreen({ name: 'games' });
  const online = (game: OnlineGameId) => () => setScreen({ name: 'game-online', game });

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <Backdrop />
        {screen.name === 'games' && (
          <GamesScreen
            canResume={lastRoom !== null}
            onPlay={(game) => setScreen(game === 'poker' ? { name: 'home' } : { name: 'game', game })}
            onResume={() => lastRoom && openRoom(lastRoom.roomId)}
            onProfile={() => setScreen({ name: 'profile' })}
            onShop={() => setScreen({ name: 'shop', from: 'games' })}
            onCustomize={() => setScreen({ name: 'customize', from: 'games' })}
            onFriends={() => setScreen({ name: 'friends' })}
            onTournaments={() => setScreen({ name: 'tournaments' })}
          />
        )}
        {screen.name === 'profile' && (
          <ProfileScreen
            onBack={games}
            onShop={() => setScreen({ name: 'shop', from: 'profile' })}
            onCustomize={() => setScreen({ name: 'customize', from: 'profile' })}
          />
        )}
        {screen.name === 'friends' && (
          <FriendsScreen
            // A notification for another friend opens their conversation afresh.
            key={screen.friend ?? 'amis'}
            onBack={games}
            onJoin={joinFromLink}
            initialFriend={screen.friend}
          />
        )}
        {screen.name === 'tournaments' && (
          <TournamentScreen
            initialId={screen.id}
            initialName={savedName ?? lastRoom?.name ?? ''}
            onBack={games}
            onPlay={(game, tournament) => setScreen({ name: 'game-online', game, tournament })}
            initialWeekly={screen.weekly}
            onPlayWeekly={(game, code) =>
              setScreen({ name: 'game-online', game, joinCode: code, weekly: true })
            }
          />
        )}
        {screen.name === 'shop' && (
          <ShopScreen
            onBack={
              screen.from === 'profile'
                ? () => setScreen({ name: 'profile' })
                : screen.from === 'customize'
                  ? () => setScreen({ name: 'customize', from: 'games' })
                  : games
            }
            onCustomize={() => setScreen({ name: 'customize', from: 'shop' })}
          />
        )}
        {screen.name === 'customize' && (
          <CustomizeScreen
            onBack={
              screen.from === 'profile'
                ? () => setScreen({ name: 'profile' })
                : screen.from === 'shop'
                  ? () => setScreen({ name: 'shop', from: 'games' })
                  : games
            }
            onShop={() => setScreen({ name: 'shop', from: 'customize' })}
          />
        )}
        {screen.name === 'game' && screen.game === 'blackjack' && (
          <BlackjackScreen onBack={games} onOnline={online('blackjack')} />
        )}
        {screen.name === 'game' && screen.game === 'president' && (
          <PresidentScreen onBack={games} onOnline={online('president')} />
        )}
        {screen.name === 'game' && screen.game === 'yams' && (
          <YamsScreen onBack={games} onOnline={online('yams')} />
        )}
        {screen.name === 'game' && screen.game === 'belote' && (
          <BeloteScreen onBack={games} onOnline={online('belote')} />
        )}
        {screen.name === 'game' && screen.game === 'puissance4' && (
          <Puissance4Screen onBack={games} onOnline={online('puissance4')} />
        )}
        {screen.name === 'game' && screen.game === 'bataille' && (
          <BatailleScreen onBack={games} onOnline={online('bataille')} />
        )}
        {screen.name === 'game' && screen.game === 'echecs' && (
          <EchecsScreen onBack={games} onOnline={online('echecs')} />
        )}
        {screen.name === 'game' && screen.game === 'rami' && (
          <RamiScreen onBack={games} onOnline={online('rami')} />
        )}
        {screen.name === 'game' && screen.game === 'tarot' && (
          <TarotScreen onBack={games} onOnline={online('tarot')} />
        )}
        {screen.name === 'game' && screen.game === 'uno' && (
          <UnoScreen onBack={games} onOnline={online('uno')} />
        )}
        {screen.name === 'game' && screen.game === 'huit' && (
          <HuitScreen onBack={games} onOnline={online('huit')} />
        )}
        {screen.name === 'game' && screen.game === 'perudo' && (
          <PerudoScreen onBack={games} onOnline={online('perudo')} />
        )}
        {screen.name === 'game' && screen.game === 'dames' && (
          <DamesScreen onBack={games} onOnline={online('dames')} />
        )}
        {screen.name === 'game-online' && (
          <OnlineGameScreen
            key={`${screen.game}-${screen.joinCode ?? ''}`}
            game={screen.game}
            initialName={savedName ?? lastRoom?.name ?? ''}
            tournament={screen.tournament}
            joinCode={screen.joinCode}
            weekly={screen.weekly}
            onBack={() =>
              setScreen(
                screen.weekly
                  ? { name: 'tournaments', weekly: true }
                  : screen.tournament
                    ? { name: 'tournaments', id: screen.tournament.id }
                    : { name: 'game', game: screen.game },
              )
            }
          />
        )}
        {screen.name === 'home' && (
          <HomeScreen
            onBack={games}
            canResume={lastRoom !== null}
            playerName={lastRoom?.name}
            onOnline={() => setScreen({ name: 'online-lobby' })}
            onResume={() => lastRoom && openRoom(lastRoom.roomId)}
            onLocal={() => setScreen({ name: 'local-setup' })}
            onStats={() => setScreen({ name: 'stats' })}
          />
        )}
        {screen.name === 'local-setup' && (
          <SetupScreen onStart={(settings) => setScreen({ name: 'local-game', settings })} onBack={home} />
        )}
        {screen.name === 'local-game' && <GameScreen settings={screen.settings} onQuit={home} />}
        {screen.name === 'online-lobby' && (
          <OnlineLobbyScreen
            initialName={savedName ?? lastRoom?.name ?? ''}
            initialCode={screen.code}
            onEnter={openRoom}
            onBack={home}
          />
        )}
        {screen.name === 'online-room' && (
          <OnlineRoomScreen
            // A rematch moves everyone to a new table: start that one afresh.
            key={screen.roomId}
            roomId={screen.roomId}
            userId={screen.userId}
            onLeave={home}
            onSwitch={openRoom}
          />
        )}
        {screen.name === 'stats' && <StatsScreen onBack={home} />}
        <ProgressToast />
        <StatusBar style="light" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
