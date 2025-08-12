import { sql } from '@vercel/postgres';
import { Repo, Auther, DispTag, Tag, RawRepo } from '@/app/model/model';

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

function getRankWhereClause(rank: string): string {
  switch (rank) {
    case '1':
      return 'AND rank = 1';
    case '2':
      return 'AND rank = 2';
    case 'all':
    default:
      return '';
  }
}

function processRepoRows(rows: RawRepo[]): Repo[] {
  return rows.map(row => ({
    ...row,
    tags: row.tag ? row.tag.split(' ') : [],
  }));
}

/**
 * 指定されたオフセットから指定された件数のレシピを取得します。
 * @param limit 取得するレシピの最大件数
 * @param offset スキップするレシピの件数
 * @returns Repo型の配列と、まだ取得できるレシピがあるかを示すhasMoreフラグ
 */
export async function getRepos(userId: string, limit: number, offset: number, mode: string, rank: string, sort: string): Promise<{ repos: Repo[], hasMore: boolean }> {
  const modeWhereClause = getModeWhereClause(mode);
  const rankWhereClause = getRankWhereClause(rank);
  const query = `
    SELECT
      *,
      EXISTS (
        SELECT 1
        FROM folder
        WHERE userid = $1 AND ' ' || idofrepos || ' ' LIKE '%' || repo.id_n || '%'
      ) as foldered
    FROM repo
    WHERE userid = $1 ${modeWhereClause} ${rankWhereClause}
    ORDER BY reposu_n ${sort}, id_n DESC
    LIMIT $2 OFFSET $3;
  `;
  const { rows } = await sql.query(query, [userId, limit, offset]);

  const hasMore = rows.length === limit;

  return { repos: processRepoRows(rows as RawRepo[]), hasMore };
}

/**
 * 指定されたタイトルでレシピを検索し、指定されたオフセットから指定された件数のレシピを取得します。
 * @param userId ユーザーID
 * @param searchTerm 検索するタイトル文字列
 * @param limit 取得するレシピの最大件数
 * @param offset スキップするレシピの件数
 * @returns Repo型の配列と、まだ取得できるレシピがあるかを示すhasMoreフラグ
 */
export async function getReposByTitle(userId: string, searchTerm: string, limit: number, offset: number, mode: string, rank: string, sort: string): Promise<{ repos: Repo[], hasMore: boolean }> {
  const str = "%" + searchTerm + "%";
  const modeWhereClause = getModeWhereClause(mode);
  const rankWhereClause = getRankWhereClause(rank);
  const query = `
    SELECT
      *,
      EXISTS (
        SELECT 1
        FROM folder
        WHERE userid = $1 AND ' ' || idofrepos || ' ' LIKE '%' || repo.id_n || '%'
      ) as foldered
    FROM repo
    WHERE userid = $1 AND title LIKE $2 ${modeWhereClause} ${rankWhereClause}
    ORDER BY reposu_n ${sort}, id_n DESC
    LIMIT $3 OFFSET $4;
  `;
  const { rows } = await sql.query(query, [userId, str, limit, offset]);

  const hasMore = rows.length === limit;

  return { repos: processRepoRows(rows as RawRepo[]), hasMore };
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
export async function getReposByTag(userId: string, tagName: string, limit: number, offset: number, mode: string, rank: string, sort: string): Promise<{ repos: Repo[], hasMore: boolean }> {
  const str = "%" + tagName + "%";
  const modeWhereClause = getModeWhereClause(mode);
  const rankWhereClause = getRankWhereClause(rank);
  const query = `
    SELECT
      *,
      EXISTS (
        SELECT 1
        FROM folder
        WHERE userid = $1 AND ' ' || idofrepos || ' ' LIKE '%' || repo.id_n || '%'
      ) as foldered
    FROM repo
    WHERE userid = $1 AND tag LIKE $2 ${modeWhereClause} ${rankWhereClause}
    ORDER BY reposu_n ${sort}, id_n DESC
    LIMIT $3 OFFSET $4;
  `;
  const { rows } = await sql.query(query, [userId, str, limit, offset]);

  const hasMore = rows.length === limit;

  return { repos: processRepoRows(rows as RawRepo[]), hasMore };
}

/**
 * 指定されたフォルダーに含まれるレシピを取得します。
 * @param userId ユーザーID
 * @param folderName フォルダー名
 * @param limit 取得するレシピの最大件数
 * @param offset スキップするレシピの件数
 * @param mode 絞り込みモード
 * @returns Repo型の配列と、まだ取得できるレシピがあるかを示すhasMoreフラグ
 */
export async function getReposByFolder(userId: string, folderName: string, limit: number, offset: number, mode: string, rank: string, sort: string): Promise<{ repos: Repo[], hasMore: boolean }> {
  const modeWhereClause = getModeWhereClause(mode);
  const rankWhereClause = getRankWhereClause(rank);
  const query = `
    SELECT
      r.*,
      EXISTS (
        SELECT 1
        FROM folder
        WHERE userid = $1 AND ' ' || idofrepos || ' ' LIKE '%' || r.id_n || '%'
      ) as foldered
    FROM repo r
    JOIN folder f ON r.userid = f.userid
    WHERE r.userid = $1
      AND f.foldername = $2
      AND r.id_n::text = ANY(string_to_array(f.idofrepos, ' '))
      ${modeWhereClause} ${rankWhereClause}
    ORDER BY r.reposu_n ${sort}, r.id_n DESC
    LIMIT $3 OFFSET $4;
  `;
  const { rows } = await sql.query(query, [userId, folderName, limit, offset]);

  const hasMore = rows.length === limit;

  return { repos: processRepoRows(rows as RawRepo[]), hasMore };
}

/**
 * 指定されたIDでレシピを検索します。
 * @param userId ユーザーID
 * @param recipeId 検索するレシピID
 * @returns Repo型の配列と、hasMoreフラグ
 */
export async function getRepoById(userId: string, recipeId: number): Promise<{ repos: Repo[], hasMore: boolean }> {
  const query = `
    SELECT
      *,
      EXISTS (
        SELECT 1
        FROM folder
        WHERE userid = $1 AND ' ' || idofrepos || ' ' LIKE '%' || repo.id_n || '%'
      ) as foldered
    FROM repo
    WHERE userid = $1 AND id_n = $2;
  `;
  const { rows } = await sql.query(query, [userId, recipeId]);

  return { repos: processRepoRows(rows as RawRepo[]), hasMore: false };
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

/**
 * 指定されたパターンでタグを検索します。
 * @param pattern 検索パターン
 * @returns Tag型の配列
 */
export async function getTagsByNamePattern(pattern: string): Promise<Tag[]> {
  const { rows } = await sql<Tag>`
    SELECT id, name, dispname, level
    FROM tag
    WHERE name LIKE ${pattern}
    ORDER BY level, id;
  `;
  return rows;
}

/**
 * レシピをデータベースに挿入します。
 * @param userId ユーザーID
 * @param recipeData 挿入するレシピデータ
 */
export async function insertRecipe(
  userId: string,
  recipeData: {
    id_n: number;
    image: string;
    title: string;
    tsukurepo: string; // Will be converted to reposu_n
    tags: string[]; // Combined tags
    isMain: number;
    isSub: number;
  }
): Promise<void> {
  const reposu_n = parseInt(recipeData.tsukurepo, 10) || 0;
  const tagString = recipeData.tags.join(' '); // Join tags into a single string

  await sql`
    INSERT INTO repo (
      userid,
      id_n,
      image,
      title,
      rank,
      reposu_n,
      comment,
      tag,
      ismain,
      issub
    ) VALUES (
      ${userId},
      ${recipeData.id_n},
      ${recipeData.image},
      ${recipeData.title},
      0, -- Default rank to 0
      ${reposu_n},
      '', -- Default comment to empty string
      ${tagString},
      ${recipeData.isMain},
      ${recipeData.isSub}
    );
  `;
}

/**
 * レシピをデータベースから削除します。
 * @param userId ユーザーID
 * @param id_n レシピID
 */
export async function deleteRecipe(userId: string, id_n: number): Promise<void> {
  await sql`
    DELETE FROM repo WHERE userid = ${userId} AND id_n = ${id_n};
  `;
}

/**
 * レシピをデータベースで更新します。
 * @param userId ユーザーID
 * @param recipeData 更新するレシピデータ
 */
export async function updateRecipe(
  userId: string,
  recipeData: {
    id_n: number;
    image: string;
    title: string;
    tsukurepo: string; // Will be converted to reposu_n
    tags: string[]; // Combined tags
    isMain: number;
    isSub: number;
  }
): Promise<void> {
  const reposu_n = parseInt(recipeData.tsukurepo, 10) || 0;
  const tagString = recipeData.tags.join(' ');

  await sql`
    UPDATE repo SET
      image = ${recipeData.image},
      title = ${recipeData.title},
      reposu_n = ${reposu_n},
      tag = ${tagString},
      ismain = ${recipeData.isMain},
      issub = ${recipeData.isSub}
    WHERE userid = ${userId} AND id_n = ${recipeData.id_n};
  `;
}

// フォルダー関連のDB操作

import { Folder } from '@/app/model/model';

export async function getFolders(userId: string, recipeId: string | null): Promise<(Folder & { isInFolder: boolean })[]> {
  let query: string;
  let params: (string | null)[];

  if (recipeId !== null) {
    query = `
      SELECT
        *,
        $2 = ANY(string_to_array(idofrepos, ' ')) as "isInFolder"
      FROM folder
      WHERE userid = $1
      ORDER BY foldername ASC;
    `;
    params = [userId, recipeId];
  } else {
    query = `
      SELECT
        *,
        FALSE as "isInFolder"
      FROM folder
      WHERE userid = $1
      ORDER BY foldername ASC;
    `;
    params = [userId];
  }

  const { rows } = await sql.query(query, params);
  return rows as (Folder & { isInFolder: boolean })[];
}

export async function addFolder(userId: string, folderName: string): Promise<void> {
  await sql`
    INSERT INTO folder (userid, foldername, idofrepos) VALUES (${userId}, ${folderName}, '');
  `;
}

export async function deleteFolder(userId: string, folderName: string): Promise<void> {
  await sql`
    DELETE FROM folder WHERE userid = ${userId} AND foldername = ${folderName};
  `;
}

export async function addRecipeToFolder(userId: string, folderName: string, recipeId: string): Promise<void> {
  await sql`
    UPDATE folder
    SET idofrepos = idofrepos || ' ' || ${recipeId}
    WHERE userid = ${userId} AND foldername = ${folderName};
  `;
}

export async function removeRecipeFromFolder(userId: string, folderName: string, recipeId: string): Promise<void> {
  await sql`
    UPDATE folder
    SET idofrepos = trim(replace(' ' || idofrepos || ' ', ' ' || ${recipeId} || ' ', ' '))
    WHERE userid = ${userId} AND foldername = ${folderName};
  `;
}

export async function isRecipeInFolder(userId: string, folderName: string, recipeId: string): Promise<boolean> {
  const { rows } = await sql<{
    exists: boolean;
  }>`
    SELECT EXISTS (
      SELECT 1
      FROM folder
      WHERE userid = ${userId} AND foldername = ${folderName} AND ' ' || idofrepos || ' ' LIKE '% ' || ${recipeId} || ' %'
    ) as exists;
  `;
  return rows[0].exists;
}

export async function getFoldersWithImages(userId: string): Promise<(Folder & { images: string[] })[]> {
  const { rows } = await sql`
    SELECT
      f.foldername,
      f.idofrepos,
      ARRAY(
        SELECT r.image
        FROM repo r
        WHERE r.userid = f.userid AND r.id_n::text = ANY(string_to_array(f.idofrepos, ' '))
        LIMIT 4
      ) as images
    FROM folder f
    WHERE f.userid = ${userId}
    ORDER BY f.foldername ASC;
  `;
  return rows as (Folder & { images: string[] })[];
}