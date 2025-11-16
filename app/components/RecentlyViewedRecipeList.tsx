"use client";

import { useState, useOptimistic, useTransition, useEffect, useRef, useCallback } from "react";
import RecipeCard from "./RecipeCard";
import { Repo } from "@/app/model/model";
import { getRecentlyViewedRecipes } from "@/lib/services";
import { calculateNextOffset, ITEMS_PER_PAGE } from "@/lib/constants";
import { toggleLikeAction, addCommentAction } from "@/app/recipes/actions";
import { FolderDialog } from './FolderDialog';

interface RecentlyViewedRecipeListProps {
  initialRecipes: Repo[];
  initialOffset: number;
  initialHasMore: boolean;
}

export function RecentlyViewedRecipeList({
  initialRecipes,
  initialOffset,
  initialHasMore,
}: RecentlyViewedRecipeListProps) {
  const [recipes, setRecipes] = useState<Repo[]>(initialRecipes);
  const [, startTransition] = useTransition();
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
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const loadMoreRecipes = useCallback(async () => {
    setLoading(true);
    const nextOffset = calculateNextOffset(offset);
    const { recipes: newRecipes, hasMore: newHasMore } = await getRecentlyViewedRecipes(
      nextOffset,
      ITEMS_PER_PAGE
    );
    setRecipes((prevRecipes) => [...prevRecipes, ...newRecipes]);
    setOffset(nextOffset);
    setHasMore(newHasMore);
    setLoading(false);
  }, [offset]);

  // Intersection Observer で一番下に到達したら自動的に「もっと見る」を実行
  useEffect(() => {
    const observerElement = loadMoreRef.current;
    if (!observerElement || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMoreRecipes();
        }
      },
      {
        root: null,
        rootMargin: '100px', // 100px手前で発火（スムーズな読み込みのため）
        threshold: 0.1,
      }
    );

    observer.observe(observerElement);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading, loadMoreRecipes]);

  const handleRankChange = (recipeId: number, newRank: number) => {
    startTransition(async () => {
      setOptimisticRecipes({
        recipeId: recipeId,
        newRank: newRank,
      });

      await toggleLikeAction(recipeId, newRank);

      const newRecipes = recipes.map((r) =>
        r.id_n === recipeId ? { ...r, rank: newRank } : r
      );
      setRecipes(newRecipes);
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

  return (
    <div>
      {optimisticRecipes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>最近見たレシピがありません。</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-4">
            {optimisticRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id_n}
                recipe={recipe}
                onRankChange={handleRankChange}
                onCommentSubmit={handleCommentSubmit}
                onFolderClick={() => handleFolderClick(recipe)}
              />
            ))}
          </div>
          {hasMore && (
            <>
              <div className="flex justify-center mt-8">
                <button
                  onClick={loadMoreRecipes}
                  disabled={loading}
                  className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? "読み込み中..." : "もっと見る"}
                </button>
              </div>
              {/* Intersection Observer用の監視要素 */}
              <div ref={loadMoreRef} className="h-1 w-full" />
            </>
          )}
        </>
      )}
      <FolderDialog
        isOpen={showFolderDialog}
        onOpenChange={setShowFolderDialog}
        recipe={selectedRecipe}
      />
    </div>
  );
}

