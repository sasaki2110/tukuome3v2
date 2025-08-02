import { getRecipes, getRecipesByTitle } from "@/lib/services";
import { RecipeListWithLoadMore } from "../components/RecipeListWithLoadMore";
import { ITEMS_PER_PAGE } from "@/lib/myUtilities";
import SearchInput from "../components/SearchInput";

import { searchRecipes } from "./actions";
/*
interface RecipesPageProps {
  searchParams?: any;
}
*/  

interface RecipesPageProps {
  searchParams?: Promise<{
    title?: string | string[] | null;
    mode?: string | string[] | null;
  }>;
}

const RecipesPage = async ({ searchParams }: RecipesPageProps) => {
  const resolvedSearchParams = await searchParams;
  const searchTerm = Array.isArray(resolvedSearchParams?.title) ? resolvedSearchParams?.title[0] : resolvedSearchParams?.title || '';
  const searchMode = Array.isArray(resolvedSearchParams?.mode) ? resolvedSearchParams?.mode[0] : resolvedSearchParams?.mode || 'all';

  let initialRecipes;
  let initialHasMore;

  if (searchTerm) {
    ({ recipes: initialRecipes, hasMore: initialHasMore } = await getRecipesByTitle(
      searchTerm,
      0,
      ITEMS_PER_PAGE,
      searchMode
    ));
  } else {
    ({ recipes: initialRecipes, hasMore: initialHasMore } = await getRecipes(
      0,
      ITEMS_PER_PAGE,
      searchMode
    ));
  }

  return (
    <>
      <SearchInput onSearch={searchRecipes} />
      <div className="container mx-auto p-4">
        <RecipeListWithLoadMore
          key={`${searchTerm}-${searchMode}`}
          initialRecipes={initialRecipes}
          initialOffset={0}
          initialHasMore={initialHasMore}
          searchTerm={searchTerm}
          searchMode={searchMode}
        />
      </div>
    </>
  );
};

export default RecipesPage;
