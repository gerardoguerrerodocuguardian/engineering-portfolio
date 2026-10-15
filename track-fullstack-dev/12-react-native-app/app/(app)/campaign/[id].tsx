import { useLocalSearchParams } from 'expo-router';
import { CampaignDetailScreen } from '@/features/campaigns/CampaignDetailScreen';

export default function CampaignRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CampaignDetailScreen id={id} />;
}
