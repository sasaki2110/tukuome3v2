import { sql } from '@vercel/postgres';
import { Repo, Auther, DispTag } from '@/app/model/model';

function getModeWhereClause(mode: string): string {
  switch (mode) {
    case 'main_dish':
      return 'AND isMain = 1';
    case 'sub_dish':
      return 'AND isSub = 1';
    case 'others':
      return 'AND (isMain = 0 AND isSub = 0)';
    default:
      return '';
  }
}

/**
 * 指定されたオフセットから指定された件数のレシピを取得します。
 * @param limit 取得するレシピの最大件数
 * @param offset スキップするレシピの件数
 * @returns Repo型の配列と、まだ取得できるレシピがあるかを示すhasMoreフラグ
 */
export async function getRepos(userId: string, limit: number, offset: number, mode: string): Promise<{ repos: Repo[], hasMore: boolean }> {
  const modeWhereClause = getModeWhereClause(mode);
  const query = `
    SELECT * FROM repo
    WHERE userid = $1 ${modeWhereClause}
    ORDER BY reposu_n DESC, id_n DESC
    LIMIT $2 OFFSET $3;
  `;
  const { rows } = await sql.query(query, [userId, limit, offset]);

  const hasMore = rows.length === limit;

  return { repos: rows as Repo[], hasMore };
}

/**
 * 指定されたタイトルでレシピを検索し、指定されたオフセットから指定された件数のレシピを取得します。
 * @param userId ユーザーID
 * @param searchTerm 検索するタイトル文字列
 * @param limit 取得するレシピの最大件数
 * @param offset スキップするレシピの件数
 * @returns Repo型の配列と、まだ取得できるレシピがあるかを示すhasMoreフラグ
 */
export async function getReposByTitle(userId: string, searchTerm: string, limit: number, offset: number, mode: string): Promise<{ repos: Repo[], hasMore: boolean }> {
  const str = "%" + searchTerm + "%";
  const modeWhereClause = getModeWhereClause(mode);
  const query = `
    SELECT * FROM repo
    WHERE userid = $1 AND title LIKE $2 ${modeWhereClause}
    ORDER BY reposu_n DESC, id_n DESC
    LIMIT $3 OFFSET $4;
  `;
  const { rows } = await sql.query(query, [userId, str, limit, offset]);

  const hasMore = rows.length === limit;

  return { repos: rows as Repo[], hasMore };
}

/**
 * 指定されたタグでレシピを検索し、指定されたオフセットから指定された件数のレシピを取得します。
 * @param userId ユーザーID
 * @param tagName 検索するタグ文字列
 * @param limit 取得するレシピの最大件数
 * @param offset スキップするレシピの件数
 * @param mode 絞り込みモード
 * @returns Repo型の配列と、まだ取得できるレシピがあるかを示すhasMoreフラグ
 */
export async function getReposByTag(userId: string, tagName: string, limit: number, offset: number, mode: string): Promise<{ repos: Repo[], hasMore: boolean }> {
  const str = "%" + tagName + "%";
  const modeWhereClause = getModeWhereClause(mode);
  const query = `
    SELECT * FROM repo
    WHERE userid = $1 AND tag LIKE $2 ${modeWhereClause}
    ORDER BY reposu_n DESC, id_n DESC
    LIMIT $3 OFFSET $4;
  `;
  const { rows } = await sql.query(query, [userId, str, limit, offset]);

  const hasMore = rows.length === limit;

  return { repos: rows as Repo[], hasMore };
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

export async function updateComment(userId: string, recipeId: number, comment: string): Promise<void> {
  await sql`
    UPDATE repo SET comment = ${comment} WHERE userid = ${userId} AND id_n = ${recipeId};
  `;
}

/**
 * 指定されたユーザーIDの作者一覧を取得します。
 * @param userId ユーザーID
 * @param limit 取得する件数
 * @param offset スキップする件数
 * @returns Auther型の配列と、まだ取得できるデータがあるかを示すhasMoreフラグ
 */
export async function getAuthers(userId: string, limit: number, offset: number): Promise<{ authers: Auther[], hasMore: boolean }> {
  const { rows: authers } = await sql<Auther>`
    select bbb.auther as name, bbb.recipesu as recipesu, bbb.image as image
    from (
      SELECT
        substring(substring(org.title from 'by .*'), 3, length(substring(org.title from 'by .*'))) as auther,
        count(org.*) as recipesu,
        max(org.image) as image
      from repo org
      where userid = ${userId}
      group by auther
    ) as bbb
    order by recipesu desc, auther
    limit ${limit} offset ${offset};
  `;

  const hasMore = authers.length === limit;

  return { authers, hasMore };
}



/**
 * 指定されたレベルと親タグのnameに基づいて表示用タグを最適化されたクエリで取得します。
 * @param userId ユーザーID
 * @param level 取得するタグのレベル
 * @param value 親タグのname (最上位の場合は空文字列)
 * @returns DispTag型の配列
 */
export async function getDispTagsOptimized(userId: string, level: number, value: string): Promise<DispTag[]> {
  let query: string;
  let params: (string | number)[];

  // Base query for tags
  query = `
    SELECT
        t.id,
        t.dispname,
        t.name,
        (SELECT image FROM repo WHERE userid = $1 AND tag LIKE '%' || t.name || '%' ORDER BY reposu_n DESC, id_n DESC LIMIT 1) AS imageuri,
        (SELECT COUNT(*) FROM tag WHERE level = t.level + 1 AND name LIKE t.name || '%') AS child_tag_count,
        (SELECT COUNT(*) FROM repo WHERE userid = $1 AND tag LIKE '%' || t.name || '%') AS recipe_count
    FROM
        tag t
    WHERE
        t.level = $2
  `;

  if (value === "") {
    query += ` ORDER BY t.id;`;
    params = [userId, level];
  } else {
    query += ` AND t.name LIKE $3 || '%' ORDER BY t.id;`;
    params = [userId, level, value];
  }

  const { rows } = await sql.query(query, params);

  const dispTags: DispTag[] = rows.map(row => {
    const childTagCount = parseInt(row.child_tag_count, 10);
    const recipeCount = parseInt(row.recipe_count, 10);
    const imageUri = row.imageuri;

    let hassChildren: string;
    if (childTagCount > 0) {
      hassChildren = "▼";
    } else {
      hassChildren = `${recipeCount} 件`;
    }

    return {
      id: row.id,
      dispname: row.dispname,
      name: row.name,
      imageuri: imageUri || "",
      hasimageuri: imageUri ? "1" : "0",
      hasschildren: hassChildren,
    };
  });

  return dispTags;
}