import dotenv from 'dotenv';
import { sql } from '@vercel/postgres';
import { Client } from 'pg';

// .env.localから環境変数を読み込む
dotenv.config({ path: '.env.local' });

/**
 * レノちゃん用データ連携（直接DBアクセス）
 * - 全ユーザーのデータを連携
 * - つくれぽ数500以上のみ対象
 * - つくおめ側のDBからデータを取得
 * - レノちゃん側のDBに直接INSERT（既存レコードはスキップ）
 */
async function syncToLenochan(): Promise<void> {
  // つくおめ側のDB接続URLを確認
  const tukuomePostgresUrl = process.env.POSTGRES_URL;
  if (!tukuomePostgresUrl) {
    throw new Error('POSTGRES_URL が環境変数に設定されていません。.env.local に追加してください。');
  }

  // レノちゃん側のDB接続URLを確認
  const lenochanPostgresUrl = process.env.LENOCHAN_POSTGRES_URL;
  if (!lenochanPostgresUrl) {
    throw new Error('LENOCHAN_POSTGRES_URL が環境変数に設定されていません。.env.local に追加してください。');
  }

  console.log('データ連携を開始します...');
  console.log('対象: 全ユーザー（つくれぽ数500以上）');
  console.log('つくおめ側DB接続: 確認済み');
  console.log('レノちゃん側DB接続: 確認済み');

  // レノちゃん側のDBクライアントを作成（pgライブラリを使用）
  const lenochanDb = new Client({
    connectionString: lenochanPostgresUrl,
  });
  await lenochanDb.connect();

  try {
    // 1. レシピデータの取得（つくおめ側）
    console.log('\n[1/2] つくおめ側からレシピデータを取得中...');
    const { rows: recipes } = await sql`
      SELECT DISTINCT ON (id_n) *
      FROM repo
      WHERE reposu_n >= 500
      ORDER BY id_n
    `;

    console.log(`取得したレシピ数: ${recipes.length} 件`);

    // 2. レノちゃん側にレシピデータを投入
    console.log('\n[2/2] レノちゃん側にレシピデータを投入中...');
    let recipeSuccessCount = 0;
    let recipeSkippedCount = 0;
    let recipeErrorCount = 0;

    for (const r of recipes) {
      try {
        const result = await lenochanDb.query(
          `INSERT INTO reno_recipes (
            recipe_id, title, image_url, tsukurepo_count, 
            is_main_dish, is_sub_dish, tag
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (recipe_id) DO NOTHING`,
          [
            r.id_n || 0,
            r.title || '',
            r.image || null,
            r.reposu_n || 0,
            r.ismain === 1,
            r.issub === 1,
            '', // tagは未設定
          ]
        );
        if (result.rowCount && result.rowCount > 0) {
          recipeSuccessCount++;
        } else {
          recipeSkippedCount++;
        }
      } catch (error) {
        console.error(`レシピID ${r.id_n} の投入に失敗:`, error);
        recipeErrorCount++;
      }
    }

    console.log(`✓ レシピ投入完了: 成功 ${recipeSuccessCount} 件, スキップ ${recipeSkippedCount} 件, 失敗 ${recipeErrorCount} 件`);

    console.log('\n========================================');
    console.log('データ連携が完了しました！');
    console.log(`レシピ: ${recipeSuccessCount} 件投入 (スキップ: ${recipeSkippedCount} 件, 失敗: ${recipeErrorCount} 件)`);
    console.log('========================================');
  } catch (error) {
    console.error('エラーが発生しました:', error);
    throw error;
  } finally {
    // 接続を閉じる
    await lenochanDb.end();
  }
}

// 実行
async function main() {
  try {
    await syncToLenochan();
  } catch (error) {
    console.error('処理中にエラーが発生しました:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { syncToLenochan };

