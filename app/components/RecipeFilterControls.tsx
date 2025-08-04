'use client';

import { useState } from 'react';
import SearchInput from "./SearchInput";
import SearchModeMenu from "./SearchModeMenu";
import RankFilterMenu from "./RankFilterMenu";
import { searchRecipes } from "@/app/recipes/actions";
import { ChevronDown, ChevronUp } from 'lucide-react';

interface RecipeFilterControlsProps {
  searchTerm: string;
  searchMode: string;
  searchRank: string;
}

export default function RecipeFilterControls({
  searchTerm,
  searchMode,
  searchRank,
}: RecipeFilterControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed top-[70px] left-0 right-0 z-10 bg-white shadow-md p-4">
      <div className="flex justify-end md:hidden">
        <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 rounded-md bg-gray-100">
          {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
        </button>
      </div>
      <div className={`flex-col md:flex-row items-center justify-between gap-2 ${isExpanded ? 'flex' : 'hidden md:flex'}`}>
        <div className="w-full md:w-1/3">
          <SearchInput />
        </div>
        <div className="w-full md:w-1/3 border border-gray-300 rounded-md p-2">
          <SearchModeMenu currentMode={searchMode} />
        </div>
        <div className="w-full md:w-1/3 border border-gray-300 rounded-md p-2">
          <RankFilterMenu currentRank={searchRank} />
        </div>
      </div>
    </div>
  );
}