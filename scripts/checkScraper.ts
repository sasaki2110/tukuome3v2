import { scrapeUrl } from '../lib/scraper';

const main = async () => {
  const url = process.argv[2];

  if (!url) {
    console.error('Usage: npx tsx checkScraper.ts <URL>');
    process.exit(1);
  }

  console.log(`Scraping URL: ${url}`);

  try {
    const { recipeInfo } = await scrapeUrl(url);

    console.log('\n--- Recipe Info ---');
    console.log(`Title: ${recipeInfo.title}`);
    console.log(`Author: ${recipeInfo.author}`);
    console.log(`Tsukurepo: ${recipeInfo.tsukurepo}`);
    console.log(`Recipe ID: ${recipeInfo.recipeid}`);
    console.log('-------------------\n');

    console.log('--- Ingredients ---');
    if (recipeInfo.ingredients && recipeInfo.ingredients.length > 0) {
      recipeInfo.ingredients.forEach((ingredient, index) => {
        console.log(`${index + 1}: ${ingredient}`);
      });
    } else {
      console.log('No ingredients found.');
    }
    console.log('-------------------');

  } catch (error) {
    console.error('\nAn error occurred during scraping:', error);
    process.exit(1);
  }
};

main();
