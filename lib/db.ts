
import { sql } from '@vercel/postgres';
import { Repo, Auther, DispTag, Tag, RawRepo, MasterTag } from '@/app/model/model';

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

function getUntaggedWhereClause(tagMode: string): string {
  switch (tagMode) {
    case 'untaged':
      return 'AND (length(tag) = 0 OR tag IS NULL)';
    default:
      return '';
  }
}

function processRepoRows(rows: RawRepo[]): Repo[] {
  return rows.map(row => {
    // 材料情報をJSONB型から配列にパースし、nullをundefinedに変換
    let ingredients: string[] | undefined = undefined;
    if (row.ingredients) {
      ingredients = typeof row.ingredients === 'string' 
        ? JSON.parse(row.ingredients) 
        : row.ingredients;
    }
    
    return {
      ...row,
      tags: row.tag ? row.tag.split(' ') : [],
      ingredients,
    };
  });
}

/**
 * 指定されたオフセットから指定された件数のレシピを取得します。
 * @param limit 取得するレシピの最大件数
 * @param offset スキップするレシピの件数
 * @returns Repo型の配列と、まだ取得できるレシピがあるかを示すhasMoreフラグ
 */
export async function getRepos(userId: string, limit: number, offset: number, mode: string, rank: string, sort: string, tagMode?: string): Promise<{ repos: Repo[], hasMore: boolean }> {
  const modeWhereClause = getModeWhereClause(mode);
  const rankWhereClause = getRankWhereClause(rank);
  const untaggedWhereClause = getUntaggedWhereClause(tagMode || ''); // 追加
  const query = `
    SELECT
      *,
      EXISTS (
        SELECT 1
        FROM folder
        WHERE userid = $1 AND ' ' || idofrepos || ' ' LIKE '%' || repo.id_n || '%'
      ) as foldered
    FROM repo
    WHERE userid = $1 ${modeWhereClause} ${rankWhereClause} ${untaggedWhereClause} 
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
export async function getReposByTitle(userId: string, searchTerm: string, limit: number, offset: number, mode: string, rank: string, sort: string, tagMode?: string ): Promise<{ repos: Repo[], hasMore: boolean }> {
  const str = "%" + searchTerm + "%";
  const modeWhereClause = getModeWhereClause(mode);
  const rankWhereClause = getRankWhereClause(rank);
  const untaggedWhereClause = getUntaggedWhereClause(tagMode || ''); // 追加
  const query = `
    SELECT
      *,
      EXISTS (
        SELECT 1
        FROM folder
        WHERE userid = $1 AND ' ' || idofrepos || ' ' LIKE '%' || repo.id_n || '%'
      ) as foldered
    FROM repo
    WHERE userid = $1 AND title LIKE $2 ${modeWhereClause} ${rankWhereClause} ${untaggedWhereClause} 
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
export async function getReposByTag(userId: string, tagName: string, limit: number, offset: number, mode: string, rank: string, sort: string, tagMode?: string): Promise<{ repos: Repo[], hasMore: boolean }> {
  const modeWhereClause = getModeWhereClause(mode);
  const rankWhereClause = getRankWhereClause(rank);
  const untaggedWhereClause = getUntaggedWhereClause(tagMode || ''); // 追加
  const query = `
    SELECT
      *,
      EXISTS (
        SELECT 1
        FROM folder
        WHERE userid = $1 AND ' ' || idofrepos || ' ' LIKE '%' || repo.id_n || '%'
      ) as foldered
    FROM repo
    WHERE userid = $1 AND $2 = ANY(string_to_array(tag, ' ')) ${modeWhereClause} ${rankWhereClause} ${untaggedWhereClause} 
    ORDER BY reposu_n ${sort}, id_n DESC
    LIMIT $3 OFFSET $4;
  `;
  const { rows } = await sql.query(query, [userId, tagName, limit, offset]);

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
export async function getReposByFolder(userId: string, folderName: string, limit: number, offset: number, mode: string, rank: string, sort: string, tagMode?: string): Promise<{ repos: Repo[], hasMore: boolean }> {
  const modeWhereClause = getModeWhereClause(mode);
  const rankWhereClause = getRankWhereClause(rank);
  const untaggedWhereClause = getUntaggedWhereClause(tagMode || ''); // 追加
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
      ${modeWhereClause} ${rankWhereClause} ${untaggedWhereClause} 
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

  // levelに応じてchild_tag_countの条件を決定
  let childTagCondition: string;
  if (level === 0) {
    childTagCondition = `tag.l = t.l`;
  } else if (level === 1) {
    childTagCondition = `tag.l || tag.m = t.l || t.m`;
  } else if (level === 2) {
    childTagCondition = `tag.l || tag.m || tag.s = t.l || t.m || t.s`;
  } else {
    // level 3の場合は子タグがないので、この条件は使われないが念のため
    childTagCondition = `tag.l || tag.m || tag.s || tag.ss = t.l || t.m || t.s || t.ss`;
  }

  // Base query for tags
  query = `
    SELECT
        t.id,
        t.dispname,
        t.name,
        t.l,
        t.m,
        t.s,
        t.ss,
        (SELECT image FROM repo WHERE userid = $1 AND tag LIKE '%' || t.name || '%' ORDER BY reposu_n DESC, id_n DESC LIMIT 1) AS imageuri,
        (SELECT COUNT(*) FROM tag WHERE userid = $1 AND level = t.level + 1 AND ${childTagCondition}) AS child_tag_count,
        (SELECT COUNT(*) FROM repo WHERE userid = $1 AND repo.tag IS NOT NULL AND repo.tag != '' AND t.name = ANY(string_to_array(repo.tag, ' '))) AS recipe_count
    FROM
        tag t
    WHERE
        t.userid = $1 AND t.level = $2
  `;

  if (value === "") {
    query += ` ORDER BY t.id;`;
    params = [userId, level];
  } else {
    // levelに応じて条件を変更
    if (level === 1) {
      query += ` AND t.l = $3 ORDER BY t.id;`;
    } else if (level === 2) {
      query += ` AND t.l || t.m = $3 ORDER BY t.id;`;
    } else if (level === 3) {
      query += ` AND t.l || t.m || t.s = $3 ORDER BY t.id;`;
    } else {
      // level 0の場合はここには来ないが、念のため
      query += ` AND t.l = $3 ORDER BY t.id;`;
    }
    params = [userId, level, value];
  }

  // デバッグ用: 実際に発行されるSQL文とパラメータを出力
  /*
  console.log('=== getDispTagsOptimized SQL ===');
  console.log('Query:', query);
  console.log('Params:', params);
  console.log('Value:', value);
  console.log('Level:', level);
  console.log('==============================');
  */
 
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
export async function getTagsByNamePattern(userId: string, pattern: string): Promise<Tag[]> {
  const { rows } = await sql<Tag>`
    SELECT id, name, dispname, level
    FROM tag
    WHERE userid = ${userId} AND name LIKE ${pattern}
    ORDER BY level, id;
  `;
  return rows;
}

/**
 * タグ名からタグ情報を取得します。
 * @param userId ユーザーID
 * @param tagName タグ名
 * @returns タグ情報（存在しない場合はnull）
 */
export async function getTagByName(userId: string, tagName: string): Promise<{ l: string; m: string; s: string; ss: string; level: number } | null> {
  const { rows } = await sql`
    SELECT l, m, s, ss, level
    FROM tag
    WHERE userid = ${userId} AND name = ${tagName}
    LIMIT 1
  `;
  
  if (rows.length === 0) {
    return null;
  }
  
  return {
    l: rows[0].l || "",
    m: rows[0].m || "",
    s: rows[0].s || "",
    ss: rows[0].ss || "",
    level: rows[0].level || 0,
  };
}

/**
 * 階層値からタグのnameを取得します。
 * @param userId ユーザーID
 * @param level タグのレベル
 * @param l 大タグの値
 * @param m 中タグの値（level >= 1の場合）
 * @param s 小タグの値（level >= 2の場合）
 * @param ss 極小タグの値（level >= 3の場合）
 * @returns タグのname（存在しない場合はnull）
 */
export async function getTagNameByHierarchy(
  userId: string,
  level: number,
  l: string,
  m: string = "",
  s: string = "",
  ss: string = ""
): Promise<string | null> {
  let query: string;
  let params: (string | number)[];

  if (level === 0) {
    query = `SELECT name FROM tag WHERE userid = $1 AND level = 0 AND l = $2 LIMIT 1`;
    params = [userId, l];
  } else if (level === 1) {
    query = `SELECT name FROM tag WHERE userid = $1 AND level = 1 AND l = $2 AND m = $3 LIMIT 1`;
    params = [userId, l, m];
  } else if (level === 2) {
    query = `SELECT name FROM tag WHERE userid = $1 AND level = 2 AND l = $2 AND m = $3 AND s = $4 LIMIT 1`;
    params = [userId, l, m, s];
  } else {
    query = `SELECT name FROM tag WHERE userid = $1 AND level = 3 AND l = $2 AND m = $3 AND s = $4 AND ss = $5 LIMIT 1`;
    params = [userId, l, m, s, ss];
  }

  const { rows } = await sql.query(query, params);
  return rows.length > 0 ? rows[0].name : null;
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
    ingredients?: string[]; // 追加: 材料情報
  }
): Promise<void> {
  const reposu_n = parseInt(recipeData.tsukurepo, 10) || 0;
  const tagString = recipeData.tags.join(' '); // Join tags into a single string
  
  // 材料情報をJSON形式に変換（nullの場合はNULL）
  const ingredientsJson = recipeData.ingredients && recipeData.ingredients.length > 0
    ? JSON.stringify(recipeData.ingredients)
    : null;

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
      issub,
      ingredients
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
      ${recipeData.isSub},
      ${ingredientsJson}::jsonb
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
    ingredients?: string[]; // 追加: 材料情報
  }
): Promise<void> {
  const reposu_n = parseInt(recipeData.tsukurepo, 10) || 0;
  const tagString = recipeData.tags.join(' ');
  
  // 材料情報をJSON形式に変換（nullの場合はNULL）
  const ingredientsJson = recipeData.ingredients && recipeData.ingredients.length > 0
    ? JSON.stringify(recipeData.ingredients)
    : null;

  await sql`
    UPDATE repo SET
      image = ${recipeData.image},
      title = ${recipeData.title},
      reposu_n = ${reposu_n},
      tag = ${tagString},
      ismain = ${recipeData.isMain},
      issub = ${recipeData.isSub},
      ingredients = ${ingredientsJson}::jsonb
    WHERE userid = ${userId} AND id_n = ${recipeData.id_n};
  `;
}

/**
 * 指定されたユーザーのすべてのタグを削除します。
 * @param userId ユーザーID
 */
export async function deleteAllTags(userId: string): Promise<void> {
  await sql`DELETE FROM tag WHERE userid = ${userId};`;
}

/**
 * 新しいタグの配列を挿入します。
 * @param userId ユーザーID
 * @param tags 挿入するタグの配列
 */
export async function insertTags(userId: string, tags: { id: number; level: number; dispname: string; name: string; l: string; m: string; s: string; ss: string }[]): Promise<void> {
  if (tags.length === 0) return;
  
  // バルクINSERTで高速化（パラメータ化クエリで安全に）
  const placeholders: string[] = [];
  const params: (string | number)[] = [];
  
  tags.forEach((tag, index) => {
    const baseIndex = index * 9;
    placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9})`);
    params.push(userId, tag.id, tag.level, tag.dispname, tag.name, tag.l, tag.m, tag.s, tag.ss);
  });
  
  const query = `
    INSERT INTO tag (userid, id, level, dispname, name, l, m, s, ss) 
    VALUES ${placeholders.join(', ')}
  `;
  
  await sql.query(query, params);
}

/**
 * 指定されたユーザーの指定された世代のマスタータグを取得します。
 * @param userId ユーザーID
 * @param gen 世代 (0: 前世代, 1: 現世代)
 * @returns MasterTag型の配列
 */
export async function getMasterTags(userId: string, gen: number): Promise<MasterTag[]> {
  const { rows } = await sql<MasterTag>`
    SELECT gen, id, l, m, s, ss
    FROM mastertag
    WHERE userid = ${userId} AND gen = ${gen}
    ORDER BY gen ASC, id ASC;
  `;
  return rows;
}

/**
 * 指定されたユーザーのマスタータグテーブルを更新します。
 * @param userId ユーザーID
 * @param newMasterTags 新しい現世代 (gen=1) のMasterTagデータの配列
 */
export async function updateMasterTags(userId: string, newMasterTags: MasterTag[]): Promise<void> {
  // 1. gen=1 のレコードを削除
  await sql`DELETE FROM mastertag WHERE userid = ${userId} AND gen = 1;`;

  // 2. 新しい gen=1 のレコードをバルクINSERTで高速化
  if (newMasterTags.length === 0) return;
  
  const placeholders: string[] = [];
  const params: (string | number)[] = [];
  
  newMasterTags.forEach((tag, index) => {
    const baseIndex = index * 7;
    placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7})`);
    params.push(userId, tag.gen, tag.id, tag.l, tag.m, tag.s, tag.ss);
  });
  
  const query = `
    INSERT INTO mastertag (userid, gen, id, l, m, s, ss) 
    VALUES ${placeholders.join(', ')}
  `;
  
  await sql.query(query, params);
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

// 最近見たレシピ関連のDB操作

/**
 * レシピの閲覧履歴を記録します。
 * 1ユーザー・1レシピは1回だけ記録され、同じレシピを見た場合はviewed_atのみ更新されます。
 * 1ユーザーの最大履歴保持数は50件で、それを超えた場合は古い履歴を削除します。
 * @param userId ユーザーID
 * @param recipeId レシピID
 */
export async function recordRecipeView(userId: string, recipeId: number): Promise<void> {
  // 1. UPSERT: 既存のレコードがあればviewed_atを更新、なければ新規挿入
  await sql`
    INSERT INTO recently_viewed (userid, recipe_id, viewed_at)
    VALUES (${userId}, ${recipeId}, CURRENT_TIMESTAMP)
    ON CONFLICT (userid, recipe_id)
    DO UPDATE SET viewed_at = CURRENT_TIMESTAMP;
  `;

  // 2. 50件を超えている場合、古い履歴を削除（最新50件を保持）
  // ウィンドウ関数を使用して効率的に削除
  await sql`
    DELETE FROM recently_viewed
    WHERE userid = ${userId}
      AND (userid, recipe_id) IN (
        SELECT userid, recipe_id
        FROM (
          SELECT 
            userid, 
            recipe_id,
            ROW_NUMBER() OVER (PARTITION BY userid ORDER BY viewed_at DESC) as rn
          FROM recently_viewed
          WHERE userid = ${userId}
        ) ranked
        WHERE rn > 50
      );
  `;
}

/**
 * ユーザーが最近閲覧したレシピの詳細情報を取得します（repoテーブルとJOIN）。
 * @param userId ユーザーID
 * @param limit 取得件数
 * @param offset スキップする件数
 * @returns Repo型の配列とhasMoreフラグ
 */
export async function getRecentlyViewedRecipesWithDetails(
  userId: string,
  limit: number,
  offset: number
): Promise<{ repos: Repo[], hasMore: boolean }> {
  const query = `
    SELECT
      r.*,
      EXISTS (
        SELECT 1
        FROM folder
        WHERE userid = $1 AND ' ' || idofrepos || ' ' LIKE '%' || r.id_n || '%'
      ) as foldered
    FROM recently_viewed rv
    INNER JOIN repo r ON r.userid = rv.userid AND r.id_n = rv.recipe_id
    WHERE rv.userid = $1
    ORDER BY rv.viewed_at DESC
    LIMIT $2 OFFSET $3;
  `;
  const { rows } = await sql.query(query, [userId, limit, offset]);

  const hasMore = rows.length === limit;

  return { repos: processRepoRows(rows as RawRepo[]), hasMore };
}
