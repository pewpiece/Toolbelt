import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { EmptyState } from '@/features/common/ui';
import { ItemForm } from '@/features/items/ItemForm';
import type { ItemInput } from '@/data/types';
import { useLibrary } from '@/store/library';
import { getRepos } from '@/store/repos';
import { useToast } from '@/store/toast';

/** Add (no `id` param) or edit (`id` param) an item. */
export default function EditItem() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const bump = useLibrary((s) => s.bump);
  const editingId = id ? Number(id) : null;
  const existing = editingId !== null ? getRepos().items.get(editingId) : null;

  if (editingId !== null && !existing) {
    return <EmptyState title="Item not found" hint="It may have been deleted." />;
  }

  function save(input: ItemInput) {
    const repo = getRepos().items;
    const saved = existing ? repo.update(existing.id, input) : repo.create(input);
    bump();
    useToast.getState().show(existing ? 'Saved' : 'Added');
    if (existing) router.back();
    else router.replace({ pathname: '/item/[id]', params: { id: String(saved.id) } });
  }

  return (
    <>
      <Stack.Screen options={{ title: existing ? 'Edit item' : 'New item' }} />
      <ItemForm
        initial={existing}
        onSubmit={save}
        submitLabel={existing ? 'Save changes' : 'Add item'}
      />
    </>
  );
}
