import { sql } from '@vercel/postgres';
import { Repo } from '@/app/model/model'; // Repo型をインポート

/**
 * 指定されたオフセットから指定された件数のレシピを取得します。
 * @param limit 取得するレシピの最大件数
 * @param offset スキップするレシピの件数
 * @returns Repo型の配列と、まだ取得できるレシピがあるかを示すhasMoreフラグ
 */
export async function getRepos(userId: string, limit: number, offset: number): Promise<{ repos: Repo[], hasMore: boolean }> {
  // reposu_n (つくれぽ数) の降順でソートし、LIMITとOFFSETを適用
  const { rows } = await sql<Repo>`
    SELECT * FROM repo
    WHERE userid = ${userId}
    ORDER BY reposu_n DESC, id_n DESC
    LIMIT ${limit} OFFSET ${offset};
  `;

  // 取得した行数がリミットと同じであれば、まだデータがある可能性がある
  const hasMore = rows.length === limit;

  return { repos: rows, hasMore };
}

/**
 * 指定されたタイトルでレシピを検索し、指定されたオフセットから指定された件数のレシピを取得します。
 * @param userId ユーザーID
 * @param searchTerm 検索するタイトル文字列
 * @param limit 取得するレシピの最大件数
 * @param offset スキップするレシピの件数
 * @returns Repo型の配列と、まだ取得できるレシピがあるかを示すhasMoreフラグ
 */
export async function getReposByTitle(userId: string, searchTerm: string, limit: number, offset: number): Promise<{ repos: Repo[], hasMore: boolean }> {
  const str = "%" + searchTerm + "%"
  const { rows } = await sql<Repo>`
    SELECT * FROM repo
    WHERE userid = ${userId} AND title LIKE ${str}
    ORDER BY reposu_n DESC, id_n DESC
    LIMIT ${limit} OFFSET ${offset};
  `;

  const hasMore = rows.length === limit;

  return { repos: rows, hasMore };
}

/**
 * 指定されたレシピの現在のいいね状態（rank）を取得します。
 * @param userId ユーザーID
 * @param recipeId レシピID
 * @returns 現在のrankの値（0または1）、レシピが見つからない場合はnull
 */
export async function getLikeStatus(userId: string, recipeId: number): Promise<number | null> {
  const { rows } = await sql<{ rank: number }>`
    SELECT rank FROM repo WHERE userid = ${userId} AND id_n = ${recipeId};
  `;
  return rows.length > 0 ? rows[0].rank : null;
}

/**
 * 指定されたレシピのいいね状態（rank）を更新します。
 * @param userId ユーザーID
 * @param recipeId レシピID
 * @param newStatus 新しいrankの値（0または1）
 */
export async function updateLikeStatus(userId: string, recipeId: number, newStatus: number): Promise<void> {
  await sql`
    UPDATE repo SET rank = ${newStatus} WHERE userid = ${userId} AND id_n = ${recipeId};
  `;
}
