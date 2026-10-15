import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { Banner, ErrorView, LoadingView } from '@/components/StateViews';
import { useTheme } from '@/theme/theme';
import { CampaignRow } from './CampaignRow';
import { useCampaignList } from './hooks';

export function CampaignListScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const theme = useTheme();
  const list = useCampaignList();

  if (list.isLoading) return <LoadingView label="Loading campaigns" />;
  if (list.error) return <ErrorView message="Could not load campaigns." onRetry={() => void list.refresh()} />;

  return (
    <FlatList
      testID="campaign-list"
      data={list.campaigns}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => <CampaignRow campaign={item} onPress={onOpen} />}
      refreshing={list.isRefreshing}
      onRefresh={() => void list.refresh()}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <View>
          {list.isShowingStale ? <Banner message="Offline or unreachable. Showing saved data." /> : null}
          <Text style={{ color: theme.textMuted, marginHorizontal: 16, marginTop: 12 }} accessibilityRole="header">
            {list.campaigns.length} of {list.total} campaigns
          </Text>
        </View>
      }
      ListFooterComponent={list.isFetchingMore ? <ActivityIndicator accessibilityLabel="Loading more" style={{ margin: 16 }} /> : null}
    />
  );
}
