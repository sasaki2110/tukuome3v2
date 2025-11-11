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

  // タグ検索画面で「素材別」を「食材」に置き換える
  const getDisplayName = (dispname: string) => {
    return dispname === '素材別' ? '食材' : dispname;
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
            .filter((tag) => {
              // 子タグがある場合は表示
              if (tag.hasschildren === "▼") {
                return true;
              }
              // レシピ件数を抽出（"X 件"形式から数値を取得）
              const match = tag.hasschildren.match(/^(\d+)\s*件$/);
              if (match) {
                const recipeCount = parseInt(match[1], 10);
                return recipeCount > 0;
              }
              return false;
            })
            .map((tag) => {
              // 表示用に「素材別」を「食材」に置き換えたタグを作成
              const displayTag = {
                ...tag,
                dispname: getDisplayName(tag.dispname),
              };
              return (
                <TagCard key={tag.id} tag={displayTag} onClick={handleTagClick} />
              );
            })}

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
