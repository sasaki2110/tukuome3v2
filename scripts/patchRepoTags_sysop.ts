import dotenv from 'dotenv';
import { sql } from '@vercel/postgres';

// .env.localから環境変数を読み込む
dotenv.config({ path: '.env.local' });

/**
 * repoテーブルのtagカラムを更新するパッチスクリプト
 * - userid = 'sysop' のデータのみを対象
 * - 指定されたタグを「その他野菜」配下のタグに置き換え
 */
async function patchRepoTags(): Promise<void> {
  const userId = 'sysop';

  // 置き換え対象のタグマッピング
  const tagReplacements: Record<string, string> = {
    '素材別野菜白菜': '素材別野菜その他野菜白菜',
    '素材別野菜ほうれんそう': '素材別野菜その他野菜ほうれんそう',
    '素材別野菜小松菜': '素材別野菜その他野菜小松菜',
    '素材別野菜ごぼう': '素材別野菜その他野菜ごぼう',
    '素材別野菜かぼちゃ': '素材別野菜その他野菜かぼちゃ',
    '素材別野菜にら': '素材別野菜その他野菜にら',
    '素材別野菜アボカド': '素材別野菜その他野菜アボカド',
    '素材別野菜ブロッコリー': '素材別野菜その他野菜ブロッコリー',
    '素材別野菜アスパラガス': '素材別野菜その他野菜アスパラガス',
    '素材別野菜にんにくの芽': '素材別野菜その他野菜にんにくの芽',
    '素材別野菜豆苗': '素材別野菜その他野菜豆苗',
    '素材別野菜かいわれ大根': '素材別野菜その他野菜かいわれ大根',
    '素材別野菜わけぎ': '素材別野菜その他野菜わけぎ',
  };

  console.log('========================================');
  console.log('repoテーブルのtagカラムを更新します');
  console.log(`対象ユーザー: ${userId}`);
  console.log(`置き換え対象タグ数: ${Object.keys(tagReplacements).length} 個`);
  console.log('========================================\n');

  try {
    // 1. 更新対象のレシピを取得
    console.log('[1/3] 更新対象のレシピを取得中...');
    const { rows: repos } = await sql`
      SELECT userid, id_n, tag
      FROM repo
      WHERE userid = ${userId}
        AND tag IS NOT NULL
        AND tag != ''
    `;

    console.log(`取得したレシピ数: ${repos.length} 件\n`);

    // 2. 各レシピのtagカラムを更新
    console.log('[2/3] tagカラムを更新中...');
    let updateCount = 0;
    let skipCount = 0;

    for (const repo of repos) {
      const oldTag = repo.tag as string;
      
      // スペースで分割してタグ配列に変換
      const tags = oldTag.split(' ').filter(tag => tag.trim() !== '');
      
      // 各タグを置き換え
      const newTags = tags.map(tag => {
        return tagReplacements[tag] || tag;
      });
      
      // 置き換えがあったかチェック
      const hasReplacement = tags.some((tag, index) => tag !== newTags[index]);
      
      // 変更があった場合のみ更新
      if (hasReplacement) {
        const newTag = newTags.join(' ');
        
        try {
          await sql`
            UPDATE repo
            SET tag = ${newTag}
            WHERE userid = ${userId}
              AND id_n = ${repo.id_n}
          `;
          updateCount++;
          
          if (updateCount <= 5) {
            console.log(`  ✓ レシピID ${repo.id_n}: 更新`);
            console.log(`    旧: ${oldTag}`);
            console.log(`    新: ${newTag}\n`);
          }
        } catch (error) {
          console.error(`  ✗ レシピID ${repo.id_n} の更新に失敗:`, error);
        }
      } else {
        skipCount++;
      }
    }

    console.log(`\n[3/3] 更新完了`);
    console.log(`  更新したレシピ数: ${updateCount} 件`);
    console.log(`  スキップしたレシピ数: ${skipCount} 件`);

    // 3. 置き換え後のタグの使用状況を確認
    console.log('\n[確認] 置き換え後のタグの使用状況:');
    for (const [oldTagName, newTagName] of Object.entries(tagReplacements)) {
      const { rows: oldCount } = await sql`
        SELECT COUNT(*) as count
        FROM repo
        WHERE userid = ${userId}
          AND tag LIKE ${'%' + oldTagName + '%'}
      `;
      
      const { rows: newCount } = await sql`
        SELECT COUNT(*) as count
        FROM repo
        WHERE userid = ${userId}
          AND tag LIKE ${'%' + newTagName + '%'}
      `;

      const oldCountNum = parseInt(oldCount[0].count as string, 10);
      const newCountNum = parseInt(newCount[0].count as string, 10);

      console.log(`  ${oldTagName}:`);
      console.log(`    旧タグ使用数: ${oldCountNum} 件`);
      console.log(`    新タグ使用数: ${newCountNum} 件`);
    }

    console.log('\n========================================');
    console.log('パッチ処理が完了しました！');
    console.log('========================================');
  } catch (error) {
    console.error('エラーが発生しました:', error);
    throw error;
  }
}

// 実行
async function main() {
  try {
    await patchRepoTags();
  } catch (error) {
    console.error('処理中にエラーが発生しました:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { patchRepoTags };

