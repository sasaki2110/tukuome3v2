import { getRecipes, getRecipesByTitle } from "@/lib/services";
import { RecipeListWithLoadMore } from "../components/RecipeListWithLoadMore";
import { ITEMS_PER_PAGE } from "@/lib/utils";
import SearchInput from "../components/SearchInput";

import { searchRecipes } from "./actions";
/*
interface RecipesPageProps {
  searchParams?: any;
}
*/  

interface RecipesPageProps {
  // searchParamsの型をPromise<...>でラップ NODE 15からの仕様に合わせて
  searchParams?: Promise<{
    title?: string | string[] | null;
    // 他のクエリパラメータがあればここに追加
  }>;
}

const RecipesPage = async ({ searchParams }: RecipesPageProps) => {
  // searchParamsがPromiseであることを考慮して、awaitで解決 NODE 15からの仕様に合わせて
  const resolvedSearchParams = await searchParams;
  let searchTerm = Array.isArray(resolvedSearchParams?.title) ? resolvedSearchParams?.title[0] : resolvedSearchParams?.title || '';

  let initialRecipes;
  let initialHasMore;

  if (searchTerm) {
    ({ recipes: initialRecipes, hasMore: initialHasMore } = await getRecipesByTitle(
      searchTerm,
      0,
      ITEMS_PER_PAGE
    ));
  } else {
    ({ recipes: initialRecipes, hasMore: initialHasMore } = await getRecipes(
      0,
      ITEMS_PER_PAGE
    ));
  }

  return (
    <>
      <SearchInput onSearch={searchRecipes} />
      <div className="container mx-auto p-4">
        <RecipeListWithLoadMore
          key={searchTerm}
          initialRecipes={initialRecipes}
          initialOffset={0}
          initialHasMore={initialHasMore}
          searchTerm={searchTerm}
        />
      </div>
    </>
  );
};

export default RecipesPage;
