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
  searchParams?: {
  title?: string | string[];
  // 他のクエリパラメータがあればここに追加
 };
}

const RecipesPage = async ({ searchParams }: RecipesPageProps) => {
  const searchTerm = Array.isArray(searchParams?.title) ? searchParams?.title[0] : searchParams?.title || '';

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
