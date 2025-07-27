"use client";

import { useState } from "react";
import RecipeCard from "./RecipeCard"; // Corrected import
import { Repo } from "@/app/model/model";
import { fetchRecipes, calculateNextOffset, ITEMS_PER_PAGE } from "@/lib/utils"; // New imports

interface RecipeListWithLoadMoreProps {
  initialRecipes: Repo[];
  initialOffset: number;
  initialHasMore: boolean;
  searchTerm?: string;
}

export function RecipeListWithLoadMore({
  initialRecipes,
  initialOffset,
  initialHasMore,
  searchTerm,
}: RecipeListWithLoadMoreProps) {
  const [recipes, setRecipes] = useState<Repo[]>(initialRecipes);
  const [offset, setOffset] = useState<number>(initialOffset);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [loading, setLoading] = useState<boolean>(false);

  const loadMoreRecipes = async () => {
    setLoading(true);
    const nextOffset = calculateNextOffset(offset); // Use common utility
    const { recipes: newRecipes, hasMore: newHasMore } = await fetchRecipes(
      nextOffset,
      ITEMS_PER_PAGE,
      searchTerm
    );
    setRecipes((prevRecipes) => [...prevRecipes, ...newRecipes]);
    setOffset(nextOffset);
    setHasMore(newHasMore);
    setLoading(false);
  };

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id_n} recipe={recipe} />
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center mt-8">
          <button
            onClick={loadMoreRecipes}
            disabled={loading}
            className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "読み込み中..." : "もっと見る"}
          </button>
        </div>
      )}
    </div>
  );
}
