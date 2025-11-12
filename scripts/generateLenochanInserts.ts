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

/**
 * SQLインジェクション対策: 文字列をエスケープ
 * @param value エスケープする文字列
 * @returns エスケープされた文字列（NULLの場合は'NULL'を返す）
 */
function escapeSQL(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  // シングルクォートをエスケープ（' -> ''）
  const escaped = value.replace(/'/g, "''");
  return `'${escaped}'`;
}

/**
 * レノちゃん用データ連携SQLファイルを生成
 * - sysopユーザーのデータのみを連携
 * - reno_recipesテーブル用のINSERT文を生成
 * - reno_tag_masterテーブル用のINSERT文を生成
 * - 1INSERT文1行形式で出力
 */
async function generateInsertStatements(): Promise<void> {
  const userId = 'sysop';
  const outputPath = path.resolve(process.cwd(), 'lenochan_inserts.sql');

  console.log('データ連携SQLファイル生成を開始します...');
  console.log(`対象ユーザー: ${userId}`);

  try {
    // 1. レシピデータの抽出とINSERT文生成（毎回全件移行）
    console.log('レシピデータを取得中...');
    const { rows: recipes } = await sql`
      SELECT DISTINCT ON (id_n) *
      FROM repo
      WHERE userid = ${userId}
      ORDER BY id_n
    `;

    console.log(`取得したレシピ数: ${recipes.length} 件`);

    const recipeInserts = recipes.map((r: any) => {
      const recipeId = r.id_n || 0;
      const title = escapeSQL(r.title || '');
      const imageUrl = escapeSQL(r.image || '');
      const tsukurepoCount = r.reposu_n || 0;
      const isMainDish = r.ismain === 1 ? 'TRUE' : 'FALSE';
      const isSubDish = r.issub === 1 ? 'TRUE' : 'FALSE';
      const tag = escapeSQL(r.tag || '');

      return `INSERT INTO reno_recipes (recipe_id, title, image_url, tsukurepo_count, is_main_dish, is_sub_dish, tag) VALUES (${recipeId}, ${title}, ${imageUrl}, ${tsukurepoCount}, ${isMainDish}, ${isSubDish}, ${tag}) ON CONFLICT (recipe_id) DO UPDATE SET title = EXCLUDED.title, image_url = EXCLUDED.image_url, tsukurepo_count = EXCLUDED.tsukurepo_count, is_main_dish = EXCLUDED.is_main_dish, is_sub_dish = EXCLUDED.is_sub_dish, tag = EXCLUDED.tag;`;
    });

    // 2. タグマスタの抽出とINSERT文生成（tagテーブルから）
    console.log('タグマスタデータを取得中...');
    const { rows: tags } = await sql`
      SELECT *
      FROM tag
      WHERE userid = ${userId}
      ORDER BY id
    `;

    console.log(`取得したタグ数: ${tags.length} 件`);

    const tagInserts = tags.map((t: any) => {
      const tagId = t.id || 0;
      const level = t.level !== null && t.level !== undefined ? t.level : 'NULL';
      const dispname = escapeSQL(t.dispname || '');
      const name = escapeSQL(t.name || '');
      const l = escapeSQL(t.l || '');
      const m = escapeSQL(t.m || '');
      const s = escapeSQL(t.s || '');
      const ss = escapeSQL(t.ss || '');

      return `INSERT INTO reno_tag_master (tag_id, level, dispname, name, l, m, s, ss) VALUES (${tagId}, ${level}, ${dispname}, ${name}, ${l}, ${m}, ${s}, ${ss}) ON CONFLICT (tag_id) DO UPDATE SET level = EXCLUDED.level, dispname = EXCLUDED.dispname, name = EXCLUDED.name, l = EXCLUDED.l, m = EXCLUDED.m, s = EXCLUDED.s, ss = EXCLUDED.ss;`;
    });

    // 3. SQLファイルに出力（1INSERT文1行形式）
    const sqlContent = [
      '-- レノちゃん用データ連携SQL',
      `-- 生成日時: ${new Date().toISOString()}`,
      `-- 対象ユーザー: ${userId}`,
      `-- レシピ数: ${recipes.length} 件`,
      `-- タグ数: ${tags.length} 件`,
      '',
      '-- ========================================',
      '-- reno_recipes テーブル',
      '-- ========================================',
      '',
      ...recipeInserts,
      '',
      '-- ========================================',
      '-- reno_tag_master テーブル',
      '-- ========================================',
      '',
      ...tagInserts
    ].join('\n');

    fs.writeFileSync(outputPath, sqlContent, 'utf8');

    console.log(`\n✓ SQLファイルを生成しました: ${outputPath}`);
    console.log(`  レシピINSERT文: ${recipeInserts.length} 行`);
    console.log(`  タグINSERT文: ${tagInserts.length} 行`);
    console.log(`  合計: ${recipeInserts.length + tagInserts.length} 行`);
  } catch (error) {
    console.error('エラーが発生しました:', error);
    throw error;
  }
}

// 実行
async function main() {
  try {
    await generateInsertStatements();
    console.log('\n処理が完了しました。');
  } catch (error) {
    console.error('処理中にエラーが発生しました:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { generateInsertStatements };

