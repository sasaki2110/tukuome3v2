'use client';

import { useState, KeyboardEvent } from 'react';
import { useSearchParams } from 'next/navigation';

type SearchInputProps = {
  onSearch: (searchTerm: string, mode: string | null) => void;
};

const SearchInput = ({ onSearch }: SearchInputProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const searchParams = useSearchParams();

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      const mode = searchParams.get('mode');
      onSearch(searchTerm, mode);
    }
  };

  return (
    <div className="fixed top-[70px] left-0 right-0 z-10 bg-white p-4 shadow-md">
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
