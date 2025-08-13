'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TagCard } from './TagCard';
import { Skeleton } from '@/components/ui/skeleton';
import { getDispTags } from '@/lib/services';
import { DispTag } from '@/app/model/model';

type TagsListProps = {
  initialTags: DispTag[];
};

export function TagsList({ initialTags }: TagsListProps) {
  const router = useRouter();
  const [tags, setTags] = useState<DispTag[]>(initialTags);
  const [path, setPath] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (path.length > 0) {
      const fetchTags = async () => {
        setIsLoading(true);
        const currentLevel = path.length;
        const currentValue = path[path.length - 1];
        const newTags = await getDispTags(currentLevel, currentValue);
        setTags(newTags);
        setIsLoading(false);
      };
      fetchTags();
    } else {
      setTags(initialTags);
    }
  }, [path, initialTags]);

  const handleTagClick = (tag: DispTag) => {
    if (tag.hasschildren === '▼') {
      setPath(prevPath => [...prevPath, tag.name]);
    } else {
      router.push(`/recipes?tag=${tag.name}`);
    }
  };

  const handleGoBack = () => {
    setPath(prevPath => prevPath.slice(0, -1));
  };

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 p-2">
      {isLoading ? (
        [...Array(12)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))
      ) : (
        <>
          {tags
            .filter((tag) => tag.hasimageuri === "1")
            .map((tag) => (
            <TagCard key={tag.id} tag={tag} onClick={handleTagClick} />
          ))}

          {path.length > 0 && (
            <TagCard key="back-button" tag={{
              id: -1, // ユニークな固定値
              dispname: '↩️ 前に戻る',
              name: 'back',
              imageuri: '',
              hasimageuri: '0', // 画像なし
              hasschildren: '', // 件数表示なし
            }} onClick={() => handleGoBack()} />
          )}
        </>
      )}
    </div>
  );
}
