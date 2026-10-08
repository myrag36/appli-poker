import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { OnlineGameId } from '@appli-poker/engine';
import { type SavedRoom, ensureSignedIn, loadLastRoom, loadName } from './src/online/supabase';
import { GameScreen } from './src/screens/GameScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { type GameId, GamesScreen } from './src/screens/GamesScreen';
import { BlackjackScreen } from './src/screens/BlackjackScreen';
import { PresidentScreen } from './src/screens/PresidentScreen';
import { YamsScreen } from './src/screens/YamsScreen';
import { BeloteScreen } from './src/screens/BeloteScreen';
import { Puissance4Screen } from './src/screens/Puissance4Screen';
import { RamiScreen } from './src/screens/RamiScreen';
import { HuitScreen, UnoScreen } from './src/screens/UnoScreen';
import { Backdrop } from './src/components/Backdrop';
import { OnlineLobbyScreen } from './src/screens/OnlineLobbyScreen';
import { OnlineRoomScreen } from './src/screens/OnlineRoomScreen';
import { OnlineGameScreen, type TournamentTable } from './src/screens/OnlineGameScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ShopScreen } from './src/screens/ShopScreen';
import { FriendsScreen } from './src/screens/FriendsScreen';
import { TournamentScreen } from './src/screens/TournamentScreen';
import { ProgressToast } from './src/components/ProgressToast';
import { type GameSettings, SetupScreen } from './src/screens/SetupScreen';
import { colors } from './src/theme';

/** Games that can also be played online, each player on their own phone. */

type Screen =
  | { name: 'games' }
  | { name: 'game'; game: Exclude<GameId, 'poker'> }
  | { name: 'game-online'; game: OnlineGameId; tournament?: TournamentTable }
  | { name: 'home' }
  | { name: 'local-setup' }
  | { name: 'local-game'; settings: GameSettings }
  | { name: 'online-lobby' }
  | { name: 'online-room'; roomId: string; userId: string }
  | { name: 'stats' }
  | { name: 'profile' }
  | { name: 'shop'; from: 'games' | 'profile' }
  | { name: 'friends' }
  | { name: 'tournaments'; id?: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'games' });
  const [lastRoom, setLastRoom] = useState<SavedRoom | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);

  useEffect(() => {
    if (screen.name === 'home' || screen.name === 'games') loadLastRoom().then(setLastRoom);
    loadName().then((n) => setSavedName(n || null));
  }, [screen.name]);

  async function openRoom(roomId: string) {
    try {
      const userId = await ensureSignedIn();
      setScreen({ name: 'online-room', roomId, userId });
    } catch (e) {
      Alert.alert('Connexion impossible', (e as Error).message);
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
            onFriends={() => setScreen({ name: 'friends' })}
            onTournaments={() => setScreen({ name: 'tournaments' })}
          />
        )}
        {screen.name === 'profile' && (
          <ProfileScreen onBack={games} onShop={() => setScreen({ name: 'shop', from: 'profile' })} />
        )}
        {screen.name === 'friends' && <FriendsScreen onBack={games} />}
        {screen.name === 'tournaments' && (
          <TournamentScreen
            initialId={screen.id}
            initialName={savedName ?? lastRoom?.name ?? ''}
            onBack={games}
            onPlay={(game, tournament) => setScreen({ name: 'game-online', game, tournament })}
          />
        )}
        {screen.name === 'shop' && (
          <ShopScreen onBack={screen.from === 'profile' ? () => setScreen({ name: 'profile' }) : games} />
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
        {screen.name === 'game' && screen.game === 'puissance4' && <Puissance4Screen onBack={games} />}
        {screen.name === 'game' && screen.game === 'rami' && <RamiScreen onBack={games} />}
        {screen.name === 'game' && screen.game === 'uno' && <UnoScreen onBack={games} />}
        {screen.name === 'game' && screen.game === 'huit' && <HuitScreen onBack={games} />}
        {screen.name === 'game-online' && (
          <OnlineGameScreen
            key={screen.game}
            game={screen.game}
            initialName={savedName ?? lastRoom?.name ?? ''}
            tournament={screen.tournament}
            onBack={() =>
              setScreen(
                screen.tournament
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
            onEnter={openRoom}
            onBack={home}
          />
        )}
        {screen.name === 'online-room' && (
          <OnlineRoomScreen roomId={screen.roomId} userId={screen.userId} onLeave={home} />
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
