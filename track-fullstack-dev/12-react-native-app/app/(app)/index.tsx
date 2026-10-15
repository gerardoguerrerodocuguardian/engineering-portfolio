import { useRouter } from 'expo-router';
import { CampaignListScreen } from '@/features/campaigns/CampaignListScreen';
import { routes } from '@/navigation/routes';

export default function CampaignsRoute() {
  const router = useRouter();
  return <CampaignListScreen onOpen={(id) => router.push(routes.campaign(id))} />;
}
