'use server';

import { scrapeUrl, RecipeInfo } from '@/lib/scraper';

export async function reScrapeRecipe(recipeNumber: string): Promise<RecipeInfo | null> {
  if (!recipeNumber || !/^[0-9]+$/.test(recipeNumber)) {
    console.error("Invalid recipe number");
    return null;
  }

  const url = `https://cookpad.com/jp/recipes/${recipeNumber}`;

  try {
    const scrapeResult = await scrapeUrl(url);
    if (!scrapeResult) {
      return null;
    }
    return scrapeResult.recipeInfo;
  } catch (error) {
    console.error(`Failed to re-scrape recipe ${recipeNumber}:`, error);
    return null;
  }
}