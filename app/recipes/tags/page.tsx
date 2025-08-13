import { getDispTags } from '@/lib/services';
import { TagsList } from '@/app/components/TagsList';

export default async function TagsPage() {
  const initialTags = await getDispTags(0, '');

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">タグから探す</h1>
      <TagsList initialTags={initialTags} />
    </div>
  );
}