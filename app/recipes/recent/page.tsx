import { getRecentlyViewedRecipes } from "@/lib/services";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { RecentlyViewedRecipeList } from "../../components/RecentlyViewedRecipeList";

const RecentlyViewedRecipesPage = async () => {
  const { recipes: initialRecipes, hasMore: initialHasMore } = await getRecentlyViewedRecipes(
    0,
    ITEMS_PER_PAGE
  );

  return (
    <div className="p-4 pt-[100px]">
      <h1 className="text-2xl font-bold mb-6">最近見たレシピ</h1>
      <RecentlyViewedRecipeList
        initialRecipes={initialRecipes}
        initialOffset={0}
        initialHasMore={initialHasMore}
      />
    </div>
  );
};

export default RecentlyViewedRecipesPage;

