'use client';

import { useRouter } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { DispTag } from '@/app/model/model';

type BreadcrumbProps = {
  pathTags: DispTag[]; // パンくずリスト用のタグ情報
  onBreadcrumbClick?: (index: number) => void; // パンくずクリック時のハンドラー（オプション）
};

export default function Breadcrumb({ pathTags, onBreadcrumbClick }: BreadcrumbProps) {
  const router = useRouter();

  // タグ検索画面で「素材別」を「食材」に置き換える
  const getDisplayName = (dispname: string) => {
    return dispname === '素材別' ? '食材' : dispname;
  };

  // ホームをクリックしたときの処理
  const handleHomeClick = () => {
    router.push('/recipes/tags');
  };

  // パンくずの各タグをクリックしたときの処理
  const handleTagClick = (index: number) => {
    if (onBreadcrumbClick) {
      onBreadcrumbClick(index);
    } else {
      // デフォルトの動作：クリックした階層のタグ検索画面に遷移
      const clickedTag = pathTags[index];
      if (clickedTag) {
        router.push(`/recipes/tags?tag=${encodeURIComponent(clickedTag.name)}`);
      }
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 p-3 text-lg text-gray-600 dark:text-gray-400">
      {pathTags.length > 0 ? (
        <>
          <button
            onClick={handleHomeClick}
            className="flex items-center gap-2 hover:text-gray-900 dark:hover:text-gray-100 transition-colors whitespace-nowrap"
          >
            <Home size={20} />
            <span>ホーム</span>
          </button>
          {pathTags.map((tag, index) => {
            const isLast = index === pathTags.length - 1;
            return (
              <div key={index} className="flex items-center gap-3 whitespace-nowrap">
                <ChevronRight size={20} className="text-gray-400 flex-shrink-0" />
                {isLast ? (
                  <span className="text-gray-900 dark:text-gray-100">
                    {getDisplayName(tag.dispname)}
                  </span>
                ) : (
                  <button
                    onClick={() => handleTagClick(index)}
                    className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  >
                    {getDisplayName(tag.dispname)}
                  </button>
                )}
              </div>
            );
          })}
        </>
      ) : (
        <button
          onClick={handleHomeClick}
          className="flex items-center gap-2 hover:text-gray-900 dark:hover:text-gray-100 transition-colors whitespace-nowrap"
        >
          <Home size={20} />
          <span>ホーム</span>
        </button>
      )}
    </div>
  );
}

