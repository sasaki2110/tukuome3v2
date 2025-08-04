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
      const params = new URLSearchParams(searchParams);
      if (searchTerm) {
        params.set('title', searchTerm);
      } else {
        params.delete('title');
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
