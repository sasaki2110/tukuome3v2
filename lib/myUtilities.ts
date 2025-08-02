import { getRecipes as getRecipesService, getRecipesByTitle } from "./services";

export const searchModes = [
  { mode: 'all', label: 'すべて' },
  { mode: 'main_dish', label: '主菜' },
  { mode: 'sub_dish', label: '副菜' },
  { mode: 'others', label: 'その他' },
]
import { Repo } from "@/app/model/model";

export const ITEMS_PER_PAGE = 10;

export async function fetchRecipes(
  offset: number,
  limit: number,
  searchTerm?: string,
  searchMode?: string
): Promise<{ recipes: Repo[]; hasMore: boolean }> {
  const mode = searchMode || 'all';
  if (searchTerm) {
    return await getRecipesByTitle(searchTerm, offset, limit, mode);
  } else {
    return await getRecipesService(offset, limit, mode);
  }
}

export function calculateNextOffset(currentOffset: number): number {
  return currentOffset + ITEMS_PER_PAGE;
}
