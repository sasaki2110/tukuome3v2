import { getFilteredRecipes } from "@/lib/services";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { RecipeListWithLoadMore } from "../components/RecipeListWithLoadMore";
import RecipeFilterControls from "../components/RecipeFilterControls";

interface RecipesPageProps {
  searchParams: Promise<{
    title?: string | string[] | null;
    mode?: string | string[] | null;
    tag?: string | string[] | null;
    folder?: string | string[] | null;
    rank?: string | string[] | null;
  }>;
}

const RecipesPage = async ({ searchParams }: RecipesPageProps) => {
  const resolvedSearchParams = await searchParams;
  const searchTerm = Array.isArray(resolvedSearchParams?.title) ? resolvedSearchParams.title[0] : resolvedSearchParams?.title || '';
  
  const isIdSearch = /^[0-9]+$/.test(searchTerm);

  const searchMode = isIdSearch ? 'all' : (Array.isArray(resolvedSearchParams?.mode) ? resolvedSearchParams.mode[0] : resolvedSearchParams?.mode || 'all');
  const searchTag = isIdSearch ? '' : (Array.isArray(resolvedSearchParams?.tag) ? resolvedSearchParams.tag[0] : resolvedSearchParams?.tag || '');
  const folderName = isIdSearch ? '' : (Array.isArray(resolvedSearchParams?.folder) ? resolvedSearchParams.folder[0] : resolvedSearchParams?.folder || '');
  const searchRank = isIdSearch ? 'all' : (Array.isArray(resolvedSearchParams?.rank) ? resolvedSearchParams.rank[0] : resolvedSearchParams?.rank || 'all');

  const { recipes: initialRecipes, hasMore: initialHasMore } = await getFilteredRecipes(
    0,
    ITEMS_PER_PAGE,
    searchTerm,
    searchMode,
    searchTag,
    folderName,
    searchRank
  );

  return (
    <>
      <RecipeFilterControls />
      <div className="container mx-auto p-4 pt-[100px]">
        <RecipeListWithLoadMore
          key={`${searchTerm}-${searchMode}-${searchTag}-${searchRank}`}
          initialRecipes={initialRecipes}
          initialOffset={0}
          initialHasMore={initialHasMore}
          searchTerm={searchTerm}
          searchMode={searchMode}
          searchTag={searchTag}
          folderName={folderName}
          searchRank={searchRank}
        />
      </div>
    </>
  );
};

export default RecipesPage;