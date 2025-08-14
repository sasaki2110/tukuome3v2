'use client';

import { useState } from 'react';
import SearchInput from "./SearchInput";
import SearchModeMenu from "./SearchModeMenu";
import RankFilterMenu from "./RankFilterMenu";
import SortMenu from "./SortMenu"; // 追加
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function RecipeFilterControls() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed top-[70px] left-0 right-0 z-40 bg-white shadow-md p-4">
      <div className="flex justify-end lg:hidden">
        <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 rounded-md bg-gray-100">
          {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
        </button>
      </div>
      <div className={`flex-col lg:flex-row items-center justify-between gap-2 ${isExpanded ? 'flex' : 'hidden lg:flex'}`}>
        <div className="w-full md:w-full lg:w-1/4">
          <SearchInput />
        </div>
        <div className="w-full md:w-full lg:w-1/4 border border-gray-300 rounded-md p-2">
          <SearchModeMenu />
        </div>
        <div className="w-full md:w-full lg:w-1/4 border border-gray-300 rounded-md p-2">
          <RankFilterMenu />
        </div>
        <div className="w-full md:w-full lg:w-1/4 border border-gray-300 rounded-md p-2">
          <SortMenu />
        </div>
      </div>
    </div>
  );
}