import { getRecipes as getRecipesService, getRecipesByTitle } from "./services";
import { Repo } from "@/app/model/model";

export const ITEMS_PER_PAGE = 10;

export async function fetchRecipes(
  offset: number,
  limit: number,
  searchTerm?: string
): Promise<{ recipes: Repo[]; hasMore: boolean }> {
  if (searchTerm) {
    return await getRecipesByTitle(searchTerm, offset, limit);
  } else {
    return await getRecipesService(offset, limit);
  }
}

export function calculateNextOffset(currentOffset: number): number {
  return currentOffset + ITEMS_PER_PAGE;
}
