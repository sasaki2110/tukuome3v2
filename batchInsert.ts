import fs from 'fs';
import path from 'path';
import { scrapeUrl, RecipeInfo } from './lib/scraper';
import { insertRecipe } from './lib/db'; // 暫定処置としてコメントアウト
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const linksFilePath = path.join(__dirname, 'public', 'me2gemini', 'links.csv');
const outputFilePath = path.join(__dirname, 'public', 'me2gemini', 'checkLinks.csv');

async function main() {
  // 出力ファイルのヘッダーを書き込み
  const outputHeader = 'recipeid\ttitle\ttsukurepo\timage\n';
  fs.writeFileSync(outputFilePath, outputHeader);

  // CSVファイルを読み込み
  const fileContent = fs.readFileSync(linksFilePath, 'utf-8');
  const urls = fileContent.split('\n').slice(1).filter(url => url.trim() !== ''); // ヘッダーをスキップし、空行を除去

  for (const url of urls) {
    try {
      console.log(`Processing: ${url}`);
      const { recipeInfo } = await scrapeUrl(url);

      // つくれぽ数を数値に変換
      const tsukurepoCount = parseInt(recipeInfo.tsukurepo.replace(/,/g, ''), 10) || 0;

      // つくれぽ数が500未満の場合はスキップ
      if (tsukurepoCount < 500) {
        console.log(`  -> Skipped (tsukurepo: ${tsukurepoCount})`);
        continue;
      }

      const recipeData = {
        id_n: parseInt(recipeInfo.recipeid, 10),
        image: recipeInfo.image,
        title: `${recipeInfo.title} by ${recipeInfo.author}`,
        tsukurepo: recipeInfo.tsukurepo,
        tags: [],
        isMain: 0,
        isSub: 0,
      };

      // 暫定処置：コンソールとファイルに出力
      const outputLine = `${recipeData.id_n}\t${recipeData.title}\t${recipeData.tsukurepo}\t${recipeData.image}\n`;
      console.log(`  -> Success: ${outputLine.trim()}`);
      fs.appendFileSync(outputFilePath, outputLine);

      // 本来の処理：DBにインサート
      try {
        await insertRecipe('sahamaru', recipeData);
        console.log(`  -> Inserted recipe: ${recipeData.title}`);
      } catch (dbError) {
        if (dbError instanceof Error && dbError.message.includes('UNIQUE constraint failed')) {
          console.log(`  -> Skipped (already exists): ${recipeData.title}`);
        } else {
          throw dbError; // その他のDBエラーは再スロー
        }
      }

    } catch (error) {
      console.error(`  -> Error processing ${url}:`, error);
      // エラーが発生しても処理を続行
    }
  }

  console.log('\nBatch processing finished.');
  console.log(`Check the output file at: ${outputFilePath}`);
}

main();
