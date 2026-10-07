import { Text } from 'react-native';
import { TopBar } from '../components/TopBar';
import { colors } from '../theme';

/** Tournaments between friends: several online games in a row, points added up. */
export function TournamentScreen({ onBack }: { onBack: () => void }) {
  return (
    <TopBar onBack={onBack} backLabel="← Jeux">
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>Tournois</Text>
    </TopBar>
  );
}
