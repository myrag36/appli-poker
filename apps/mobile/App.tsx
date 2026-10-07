import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { type SavedRoom, ensureSignedIn, loadLastRoom } from './src/online/supabase';
import { GameScreen } from './src/screens/GameScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { type GameId, GamesScreen } from './src/screens/GamesScreen';
import { BlackjackScreen } from './src/screens/BlackjackScreen';
import { PresidentScreen } from './src/screens/PresidentScreen';
import { YamsScreen } from './src/screens/YamsScreen';
import { BeloteScreen } from './src/screens/BeloteScreen';
import { Backdrop } from './src/components/Backdrop';
import { OnlineLobbyScreen } from './src/screens/OnlineLobbyScreen';
import { OnlineRoomScreen } from './src/screens/OnlineRoomScreen';
import { OnlineGameScreen } from './src/screens/OnlineGameScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { type GameSettings, SetupScreen } from './src/screens/SetupScreen';
import { colors } from './src/theme';

type Screen =
  | { name: 'games' }
  | { name: 'game'; game: Exclude<GameId, 'poker'> }
  | { name: 'game-online'; game: Exclude<GameId, 'poker'> }
  | { name: 'home' }
  | { name: 'local-setup' }
  | { name: 'local-game'; settings: GameSettings }
  | { name: 'online-lobby' }
  | { name: 'online-room'; roomId: string; userId: string }
  | { name: 'stats' };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'games' });
  const [lastRoom, setLastRoom] = useState<SavedRoom | null>(null);

  useEffect(() => {
    if (screen.name === 'home' || screen.name === 'games') loadLastRoom().then(setLastRoom);
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
  const online = (game: Exclude<GameId, 'poker'>) => () => setScreen({ name: 'game-online', game });

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <Backdrop />
        {screen.name === 'games' && (
          <GamesScreen
            canResume={lastRoom !== null}
            onPlay={(game) => setScreen(game === 'poker' ? { name: 'home' } : { name: 'game', game })}
            onResume={() => lastRoom && openRoom(lastRoom.roomId)}
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
        {screen.name === 'game-online' && (
          <OnlineGameScreen
            key={screen.game}
            game={screen.game}
            initialName={lastRoom?.name ?? ''}
            onBack={() => setScreen({ name: 'game', game: screen.game })}
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
          <OnlineLobbyScreen initialName={lastRoom?.name ?? ''} onEnter={openRoom} onBack={home} />
        )}
        {screen.name === 'online-room' && (
          <OnlineRoomScreen roomId={screen.roomId} userId={screen.userId} onLeave={home} />
        )}
        {screen.name === 'stats' && <StatsScreen onBack={home} />}
        <StatusBar style="light" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
