import { StyleSheet, Text } from 'react-native';
import type { Avatar, Reward } from '@appli-poker/engine';
import { AvatarBadge } from './AvatarPicker';
import { Banner } from './Banner';
import { CardBackPreview } from './cardBacks';
import { TitleBadge } from './TitleBadge';

/** A small picture of a cosmetic item, worn by the player's own avatar when it is a border. */
export function RewardPreview({ reward, avatar, big }: { reward: Reward; avatar: Avatar; big?: boolean }) {
  const k = big ? 1.8 : 1;
  switch (reward.kind) {
    case 'frame':
      return <AvatarBadge avatar={{ ...avatar, frame: reward.id }} size={52 * k} />;
    case 'title':
      return <TitleBadge id={reward.id} small={!big} />;
    case 'cardBack':
      return <CardBackPreview id={reward.id} width={40 * k} />;
    case 'banner':
      return <Banner id={reward.id} width={96 * k} height={52 * k} />;
    default:
      return <Text style={[styles.emoji, { fontSize: 34 * k }]}>{reward.id}</Text>;
  }
}

const styles = StyleSheet.create({
  emoji: { fontSize: 34 },
});
