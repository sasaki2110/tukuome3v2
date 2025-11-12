import * as fs from 'fs';
import * as path from 'path';

// .env.localから環境変数を読み込む
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length === 2) {
      let value = parts[1].trim();
      // Remove surrounding quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[parts[0].trim()] = value;
    }
  });
}

import { sql } from '@vercel/postgres';
import { scrapeUrl } from '@/lib/scraper';

/**
 * 既存レシピの材料情報とつくれぽ数を追加・更新するバッチ処理（全ユーザー対象）
 * - 材料情報が未設定のレシピに材料情報を追加
 * - 既存の材料情報とつくれぽ数を最新情報に更新
 * @param limit 処理するレシピの最大件数（デフォルト: 100）
 * @param offset スキップするレシピの件数（デフォルト: 0）
 */
async function batchRefreshIngredients(
  limit: number = 100,
  offset: number = 0
): Promise<void> {
  // 材料情報が未設定または空のレシピを取得（全ユーザー対象、重複排除）
  const { rows } = await sql`
    SELECT distinct id_n, title
    FROM repo
    WHERE ingredients IS NULL OR ingredients = '[]'::jsonb
    ORDER BY id_n
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  console.log(`処理対象: ${rows.length} 件`);

  for (const row of rows) {
    const recipeId = row.id_n;
    console.log(`処理中: ${recipeId} - ${row.title}`);

    try {
      // スクレイピングで最新情報を取得
      const url = `https://cookpad.com/jp/recipes/${recipeId}`;
      const scrapeResult = await scrapeUrl(url);
      
      if (scrapeResult && scrapeResult.recipeInfo) {
        const { ingredients, tsukurepo } = scrapeResult.recipeInfo;
        const ingredientsJson = ingredients && ingredients.length > 0
          ? JSON.stringify(ingredients)
          : null;
        
        // つくれぽ数をパース（エラー時は0）
        const reposu_n = parseInt(tsukurepo.replace(/,/g, ''), 10) || 0;
        
        // 材料情報とつくれぽ数を更新（全ユーザー対象、同じid_nのレシピを一括更新）
        await sql`
          UPDATE repo
          SET 
            ingredients = COALESCE(${ingredientsJson}::jsonb, ingredients),
            reposu_n = ${reposu_n}
          WHERE id_n = ${recipeId}
        `;
        
        console.log(`  ✓ 更新完了: 材料 ${ingredients?.length || 0} 件, つくれぽ数 ${tsukurepo} (${reposu_n})`);
      } else {
        console.log(`  ✗ 情報が取得できませんでした`);
      }

      // レート制限対策: 1秒待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ✗ エラー: ${error}`);
      // エラーが発生しても処理を続行
    }
  }

  console.log('バッチ処理完了');
}

// 実行例
async function main() {
  const limit = parseInt(process.env.LIMIT || '100', 10);
  const offset = parseInt(process.env.OFFSET || '0', 10);

  await batchRefreshIngredients(limit, offset);
}

if (require.main === module) {
  main().catch(console.error);
}

