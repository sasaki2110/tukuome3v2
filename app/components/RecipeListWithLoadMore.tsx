"use client";

import { useState, useOptimistic, useTransition } from "react";
import RecipeCard from "./RecipeCard";
import { Repo } from "@/app/model/model";
import { getFilteredRecipes } from "@/lib/services";
import { calculateNextOffset, ITEMS_PER_PAGE } from "@/lib/constants";
import { toggleLikeAction, addCommentAction } from "@/app/recipes/actions";
import { FolderDialog } from './FolderDialog'; // FolderDialogをインポート

interface RecipeListWithLoadMoreProps {
  initialRecipes: Repo[];
  initialOffset: number;
  initialHasMore: boolean;
  searchTerm?: string;
  searchMode?: string;
  searchTag?: string;
  folderName?: string;
}

export function RecipeListWithLoadMore({
  initialRecipes,
  initialOffset,
  initialHasMore,
  searchTerm,
  searchMode,
  searchTag,
  folderName,
}: RecipeListWithLoadMoreProps) {
  const [recipes, setRecipes] = useState<Repo[]>(initialRecipes);
  const [isPending, startTransition] = useTransition();
  const [likingRecipeId, setLikingRecipeId] = useState<number | null>(null);
  const [optimisticRecipes, setOptimisticRecipes] = useOptimistic(
    recipes,
    (state, { recipeId, newRank, newComment }: { recipeId: number; newRank?: number; newComment?: string }) => {
      return state.map((recipe) =>
        recipe.id_n === recipeId
          ? { ...recipe, ...(newRank !== undefined && { rank: newRank }), ...(newComment !== undefined && { comment: newComment }) }
          : recipe
      );
    }
  );
  const [offset, setOffset] = useState<number>(initialOffset);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [loading, setLoading] = useState<boolean>(false);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Repo | null>(null);

  const handleLikeClick = (recipe: Repo) => {
    setLikingRecipeId(recipe.id_n);
    startTransition(async () => {
      const newRank = recipe.rank === 1 ? 0 : 1;

      setOptimisticRecipes({
        recipeId: recipe.id_n,
        newRank: newRank,
      });

      await toggleLikeAction(recipe.id_n, newRank);

      const newRecipes = recipes.map((r) =>
        r.id_n === recipe.id_n ? { ...r, rank: newRank } : r
      );
      setRecipes(newRecipes);
      setLikingRecipeId(null);
    });
  };

  const handleCommentSubmit = (recipeId: number, comment: string) => {
    startTransition(async () => {
      setOptimisticRecipes({
        recipeId: recipeId,
        newComment: comment,
      });

      await addCommentAction(recipeId, comment);

      const newRecipes = recipes.map((r) =>
        r.id_n === recipeId ? { ...r, comment: comment } : r
      );
      setRecipes(newRecipes);
    });
  };

  const handleFolderClick = (recipe: Repo) => {
    setSelectedRecipe(recipe);
    setShowFolderDialog(true);
  };

  const loadMoreRecipes = async () => {
    setLoading(true);
    const nextOffset = calculateNextOffset(offset);
    const { recipes: newRecipes, hasMore: newHasMore } = await getFilteredRecipes(
      nextOffset,
      ITEMS_PER_PAGE,
      searchTerm,
      searchMode,
      searchTag,
      folderName
    );
    setRecipes((prevRecipes) => [...prevRecipes, ...newRecipes]);
    setOffset(nextOffset);
    setHasMore(newHasMore);
    setLoading(false);
  };

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {optimisticRecipes.map((recipe) => (
          <RecipeCard
            key={recipe.id_n}
            recipe={recipe}
            onLikeClick={() => handleLikeClick(recipe)}
            isLiking={isPending && likingRecipeId === recipe.id_n}
            onCommentSubmit={handleCommentSubmit}
            onFolderClick={() => handleFolderClick(recipe)}
          />
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
      <FolderDialog
        isOpen={showFolderDialog}
        onOpenChange={setShowFolderDialog}
        recipe={selectedRecipe}
      />
    </div>
  );
}