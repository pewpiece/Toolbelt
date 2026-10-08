import { useRouter } from 'expo-router';
import { FlatList, View } from 'react-native';

import { Button, EmptyState, ErrorState } from '@/features/common/ui';
import { useQuery } from '@/features/common/useQuery';
import { ItemCard } from '@/features/items/ItemCard';
import { useCopy } from '@/store/copy';
import { getRepos } from '@/store/repos';

export default function Home() {
  const router = useRouter();
  const requestCopy = useCopy((s) => s.requestCopy);
  const { data, error, reload } = useQuery(() => getRepos().items.list());
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={data ?? []}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={
          <EmptyState
            title="Nothing here yet"
            hint="Add your first snippet or command."
            action={<Button label="Add item" onPress={() => router.push('/item/edit')} />}
          />
        }
        renderItem={({ item }) => (
          <ItemCard item={item} onOpen={(i) => router.push({ pathname: '/item/[id]', params: { id: String(i.id) } })} onCopy={requestCopy} />
        )}
      />
    </View>
  );
}
