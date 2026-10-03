import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { GameScreen } from './src/screens/GameScreen';
import { type GameSettings, SetupScreen } from './src/screens/SetupScreen';
import { colors } from './src/theme';

export default function App() {
  const [settings, setSettings] = useState<GameSettings | null>(null);

  return (
    <View style={styles.container}>
      {settings ? (
        <GameScreen settings={settings} onQuit={() => setSettings(null)} />
      ) : (
        <SetupScreen onStart={setSettings} />
      )}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.felt },
});
