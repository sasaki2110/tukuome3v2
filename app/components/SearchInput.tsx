'use client';

import { useState, KeyboardEvent } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';

const SearchInput = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      const params = new URLSearchParams(); // 新しいURLSearchParamsを作成
      if (searchTerm) {
        if (/^[0-9]+$/.test(searchTerm)) {
          // 数字のみの場合はtitleだけを設定
          params.set('title', searchTerm);
        } else {
          // それ以外の場合は既存のパラメータを維持しつつtitleを設定
          const existingParams = new URLSearchParams(searchParams);
          existingParams.forEach((value, key) => {
            params.set(key, value);
          });
          params.set('title', searchTerm);
          params.delete('tag'); // tagは削除
        }
      } else {
        // 検索語が空の場合はtitleを削除
        const existingParams = new URLSearchParams(searchParams);
        existingParams.delete('title');
        existingParams.forEach((value, key) => {
          params.set(key, value);
        });
      }
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  return (
    <div className="bg-white p-4 shadow-md">
      <label htmlFor="search-title" className="sr-only">探す</label>
      <input
        type="text"
        id="search-title"
        placeholder="探したいレシピタイトルを入力"
        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
};

export default SearchInput;
