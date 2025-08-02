import { getFilteredRecipes } from "@/lib/services";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { RecipeListWithLoadMore } from "../components/RecipeListWithLoadMore";
import SearchInput from "../components/SearchInput";

import { searchRecipes } from "./actions";

interface RecipesPageProps {
  searchParams: Promise<{
    title?: string | string[] | null;
    mode?: string | string[] | null;
    tag?: string | string[] | null;
  }>;
}

const RecipesPage = async ({ searchParams }: RecipesPageProps) => {
  const resolvedSearchParams = await searchParams;
  const searchTerm = Array.isArray(resolvedSearchParams?.title) ? resolvedSearchParams.title[0] : resolvedSearchParams?.title || '';
  const searchMode = Array.isArray(resolvedSearchParams?.mode) ? resolvedSearchParams.mode[0] : resolvedSearchParams?.mode || 'all';
  const searchTag = Array.isArray(resolvedSearchParams?.tag) ? resolvedSearchParams.tag[0] : resolvedSearchParams?.tag || '';

  const { recipes: initialRecipes, hasMore: initialHasMore } = await getFilteredRecipes(
    0,
    ITEMS_PER_PAGE,
    searchTerm,
    searchMode,
    searchTag
  );

  return (
    <>
      <SearchInput onSearch={searchRecipes} />
      <div className="container mx-auto p-4">
        <RecipeListWithLoadMore
          key={`${searchTerm}-${searchMode}-${searchTag}`}
          initialRecipes={initialRecipes}
          initialOffset={0}
          initialHasMore={initialHasMore}
          searchTerm={searchTerm}
          searchMode={searchMode}
          searchTag={searchTag}
        />
      </div>
    </>
  );
};

export default RecipesPage;