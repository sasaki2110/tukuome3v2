'use server';

import { getRepos, getReposByTitle, getReposByTag, getRepoById, updateLikeStatus, updateComment, getAuthers, getDispTagsOptimized, getReposByFolder, getTagsByNamePattern, insertRecipe, deleteRecipe as deleteRecipeDb, updateRecipe as updateRecipeDb, deleteAllTags, insertTags, getMasterTags, updateMasterTags } from './db';
import { Repo, Auther, DispTag, Tag, MasterTag } from '@/app/model/model';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

// セッションからユーザーIDを取得し、セッションがない場合はリダイレクトする共通関数
async function getUserIdFromSession(): Promise<string> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.name) {
    redirect('/login');
  }

  return session.user.name;
}



/**
 * 指定されたオフセットから指定された件数のレシピを取得します。
 * @param offset スキップするレシピの件数
 * @param limit 取得するレシピの最大件数
 * @returns Repo型の配列と、まだ取得できるレシピがあるかを示すhasMoreフラグ
 */
export async function getRecipes(offset: number, limit: number, mode: string, rank: string, sort: string): Promise<{ recipes: Repo[], hasMore: boolean }> { // sortを追加
  const userId = await getUserIdFromSession();

  const { repos, hasMore } = await getRepos(userId, limit, offset, mode, rank, sort); // sortを追加
  return { recipes: repos, hasMore };
}

/**
 * 指定されたタイトルでレシピを検索し、指定されたオフセットから指定された件数のレシピを取得します。
 * @param searchTerm 検索するタイトル文字列
 * @param offset スキップするレシピの件数
 * @param limit 取得するレシピの最大件数
 * @returns Repo型の配列と、まだ取得できるレシピがあるかを示すhasMoreフラグ
 */
export async function getRecipesByTitle(searchTerm: string, offset: number, limit: number, mode: string, rank: string, sort: string): Promise<{ recipes: Repo[], hasMore: boolean }> { // sortを追加
  const userId = await getUserIdFromSession();

  const { repos, hasMore } = await getReposByTitle(userId, searchTerm, limit, offset, mode, rank, sort); // sortを追加
  return { recipes: repos, hasMore };
}

/**
 * 指定されたタグでレシピを検索し、指定されたオフセットから指定された件数のレシピを取得します。
 * @param tagName 検索するタグ文字列
 * @param offset スキップするレシピの件数
 * @param limit 取得するレシピの最大件数
 * @param mode 絞り込みモード
 * @returns Repo型の配列と、まだ取得できるレシピがあるかを示すhasMoreフラグ
 */
export async function getRecipesByTag(tagName: string, offset: number, limit: number, mode: string, rank: string, sort: string): Promise<{ recipes: Repo[], hasMore: boolean }> { // sortを追加
  const userId = await getUserIdFromSession();

  const { repos, hasMore } = await getReposByTag(userId, tagName, limit, offset, mode, rank, sort); // sortを追加
  return { recipes: repos, hasMore };
}

/**
 * 指定されたフォルダーに含まれるレシピを取得します。
 * @param folderName フォルダー名
 * @param offset スキップするレシピの件数
 * @param limit 取得するレシピの最大件数
 * @param mode 絞り込みモード
 * @param rank いいねランク
 * @param sort ソート順 ('asc' または 'desc') // 追加
 * @returns Repo型の配列と、まだ取得できるレシピがあるかを示すhasMoreフラグ
 */
export async function getRecipesByFolder(folderName: string, offset: number, limit: number, mode: string, rank: string, sort: string): Promise<{ recipes: Repo[], hasMore: boolean }> { // sortを追加
  const userId = await getUserIdFromSession();

  const { repos, hasMore } = await getReposByFolder(userId, folderName, limit, offset, mode, rank, sort); // sortを追加
  return { recipes: repos, hasMore };
}

/**
 * 指定されたIDでレシピを検索します。
 * @param recipeId 検索するレシピID
 * @returns Repo型の配列と、hasMoreフラグ
 */
export async function getRecipeById(recipeId: number): Promise<{ recipes: Repo[], hasMore: boolean }> {
  const userId = await getUserIdFromSession();

  const { repos, hasMore } = await getRepoById(userId, recipeId);
  return { recipes: repos, hasMore };
}

export async function getFilteredRecipes(
  offset: number,
  limit: number,
  searchTerm?: string,
  searchMode?: string,
  searchTag?: string,
  folderName?: string,
  searchRank?: string,
  searchSort?: string // 追加
): Promise<{ recipes: Repo[]; hasMore: boolean }> {
  const mode = searchMode || 'all';
  const rank = searchRank || 'all';
  const sort = searchSort || 'desc'; // 追加: デフォルトは降順

  if (searchTerm && /^[0-9]+$/.test(searchTerm)) {
    return await getRecipeById(parseInt(searchTerm, 10));
  } else if (folderName) {
    return await getRecipesByFolder(folderName, offset, limit, mode, rank, sort); // sortを渡す
  } else if (searchTag) {
    return await getRecipesByTag(searchTag, offset, limit, mode, rank, sort); // sortを渡す
  } else if (searchTerm) {
    return await getRecipesByTitle(searchTerm, offset, limit, mode, rank, sort); // sortを渡す
  } else {
    return await getRecipes(offset, limit, mode, rank, sort); // sortを渡す
  }
}



/**
 * レシピのいいね状態を更新します。
 * @param recipeId レシピID
 * @param newRank 新しいランクの値
 */
export async function setLike(recipeId: number, newRank: number): Promise<void> {
  const userId = await getUserIdFromSession();

  await updateLikeStatus(userId, recipeId, newRank);

  // レシピ一覧ページのキャッシュをクリア
  // revalidatePath('/recipes'); // Optimistic UIに任せるためコメントアウト
}

export async function addComment(recipeId: number, comment: string): Promise<void> {
  const userId = await getUserIdFromSession();

  await updateComment(userId, recipeId, comment);
}

/**
 * 作者一覧を取得します。
 * @param offset スキップする件数
 * @param limit 取得する件数
 * @returns Auther型の配列と、まだ取得できるデータがあるかを示すhasMoreフラグ
 */
export async function fetchAuthers(offset: number, limit: number): Promise<{ authers: Auther[], hasMore: boolean }> {
  const userId = await getUserIdFromSession();
  const { authers, hasMore } = await getAuthers(userId, limit, offset);
  return { authers, hasMore };
}

/**
 * 指定されたパターンでタグを検索します。
 * @param pattern 検索パターン (例: '素材別%')
 * @returns Tag型の配列
 */
export async function getTagsByName(pattern: string): Promise<Tag[]> {
  // userId is not needed for getTagsByNamePattern as the tag table is shared
  return await getTagsByNamePattern(pattern);
}

/**
 * 指定されたレベルと親タグのnameに基づいて表示用タグを取得します。
 * @param level 取得するタグのレベル
 * @param value 親タグのname (最上位の場合は空文字列)
 * @returns DispTag型の配列
 */
export async function getDispTags(level: number, value: string): Promise<DispTag[]> {
  const userId = await getUserIdFromSession();
  return await getDispTagsOptimized(userId, level, value);
}

/**
 * レシピをデータベースに追加します。
 * @param recipeData 追加するレシピデータ
 */
export async function addRecipe(
  recipeData: {
    id_n: number;
    image: string;
    title: string;
    tsukurepo: string;
    tags: string[];
    isMain: number;
    isSub: number;
  }
): Promise<void> {
  const userId = await getUserIdFromSession();
  await insertRecipe(userId, {
    id_n: recipeData.id_n,
    image: recipeData.image,
    title: recipeData.title,
    tsukurepo: recipeData.tsukurepo,
    tags: recipeData.tags,
    isMain: recipeData.isMain,
    isSub: recipeData.isSub,
  });
}

/**
 * レシピをデータベースから削除します。
 * @param id_n レシピID
 */
export async function deleteRecipe(id_n: number): Promise<void> {
  const userId = await getUserIdFromSession();
  await deleteRecipeDb(userId, id_n);
}

/**
 * レシピをデータベースで更新します。
 * @param recipeData 更新するレシピデータ
 */
export async function updateRecipe(
  recipeData: {
    id_n: number;
    image: string;
    title: string;
    tsukurepo: string;
    tags: string[];
    isMain: number;
    isSub: number;
  }
): Promise<void> {
  const userId = await getUserIdFromSession();
  await updateRecipeDb(userId, {
    id_n: recipeData.id_n,
    image: recipeData.image,
    title: recipeData.title,
    tsukurepo: recipeData.tsukurepo,
    tags: recipeData.tags,
    isMain: recipeData.isMain,
    isSub: recipeData.isSub,
  });
}

/**
 * DBからマスタータグを取得し、タブ区切り文字列に変換して返します。
 * @param gen 世代 (0: 前世代, 1: 現世代)
 * @returns タブ区切り文字列
 */
export async function loadMasterTagsFromDb(gen: number): Promise<string> {
  const masterTags = await getMasterTags(gen);
  
  // MasterTag[] をタブ区切り文字列に変換
  const lines = masterTags.map(tag => {
    // l, m, s, ss の順にタブで結合
    // null や undefined の場合は空文字列にする
    return `${tag.l || ''}	${tag.m || ''}	${tag.s || ''}	${tag.ss || ''}`;
  });

   // ヘッダー行とデータ行を結合して返す
   const result = `l\tm\ts\tss\n${lines.join('\n')}`; // ここでヘッダーとデータ行を結合
   console.log("Formatted masterTags for display:", result); // デバッグ用ログ
   return result;
}

// フォルダー関連のサーバーアクション

import { getFolders, addFolder, deleteFolder, addRecipeToFolder, removeRecipeFromFolder, getFoldersWithImages } from './db';
import { Folder } from '@/app/model/model';

export async function fetchFolders(recipeId: string | null): Promise<(Folder & { isInFolder: boolean })[]> {
  const userId = await getUserIdFromSession();
  return await getFolders(userId, recipeId);
}

export async function fetchFoldersWithImages(): Promise<(Folder & { images: string[] })[]> {
  const userId = await getUserIdFromSession();
  return await getFoldersWithImages(userId);
}

export async function createFolder(folderName: string): Promise<void> {
  const userId = await getUserIdFromSession();
  await addFolder(userId, folderName);
}

export async function removeFolder(folderName: string): Promise<void> {
  const userId = await getUserIdFromSession();
  await deleteFolder(userId, folderName);
}

export async function addRecipeToFolderAction(folderName: string, recipeId: string): Promise<void> {
  const userId = await getUserIdFromSession();
  await addRecipeToFolder(userId, folderName, recipeId);
}

export async function removeRecipeFromFolderAction(folderName: string, recipeId: string): Promise<void> {
  const userId = await getUserIdFromSession();
  await removeRecipeFromFolder(userId, folderName, recipeId);
}

/**
 * タグ情報をDBで更新します。
 * @param tags 更新するタグのデータ
 */
export async function updateTags(tags: { id: number; level: number; dispName: string; name: string }[]): Promise<void> {
  // この操作は特定のユーザーに紐づかないため、セッションチェックは不要
  await deleteAllTags();
  await insertTags(tags.map(t => ({ id: t.id, level: t.level, dispname: t.dispName, name: t.name })));
}

/**
 * タグメンテナンス画面から受け取ったテキストを元に、MasterTagテーブルとtagテーブルを更新します。
 * @param masterTagText タグメンテナンス画面のテキストエリアの内容（タブ区切り文字列）
 */
export async function updateMasterTagsInDb(masterTagText: string): Promise<void> {
  const lines = masterTagText.trim().split('\n');
  const newMasterTags: MasterTag[] = [];
  let idCounter = 1;

  // ヘッダー行をスキップ
  const dataLines = lines.slice(1);

  for (const line of dataLines) {
    const columns = line.split('\t').map(c => c.trim());
    
    // 空行はスキップ
    if (columns.every(c => c === '')) continue;

    const l = columns[0] || '';
    const m = columns[1] || '';
    const s = columns[2] || '';
    const ss = columns[3] || '';

    newMasterTags.push({
      gen: 1, // 現世代
      id: idCounter++, // 1からの連番
      l, m, s, ss
    });
  }

  // MasterTagテーブルの更新
  await updateMasterTags(newMasterTags);

  // MasterTagのデータ（gen=1）を元に、tagテーブルを更新
  const tagsForTagTable: { id: number; level: number; dispname: string; name: string }[] = [];
  let tagTableIdCounter = 1; // tagテーブル用の独立したIDカウンター
  const existingTagNames = new Set<string>(); // 重複チェック用

  for (const mt of newMasterTags) {
    const path: string[] = [];

    if (mt.l) {
      path.push(mt.l);
      const name = path.join('');
      if (!existingTagNames.has(name)) {
        tagsForTagTable.push({ id: tagTableIdCounter++, level: 0, dispname: mt.l, name });
        existingTagNames.add(name);
      }
    }

    if (mt.m) {
      path.push(mt.m);
      const name = path.join('');
      if (!existingTagNames.has(name)) {
        tagsForTagTable.push({ id: tagTableIdCounter++, level: 1, dispname: mt.m, name });
        existingTagNames.add(name);
      }
    }

    if (mt.s) {
      path.push(mt.s);
      const name = path.join('');
      if (!existingTagNames.has(name)) {
        tagsForTagTable.push({ id: tagTableIdCounter++, level: 2, dispname: mt.s, name });
        existingTagNames.add(name);
      }
    }

    if (mt.ss) {
      path.push(mt.ss);
      const name = path.join('');
      if (!existingTagNames.has(name)) {
        tagsForTagTable.push({ id: tagTableIdCounter++, level: 3, dispname: mt.ss, name });
        existingTagNames.add(name);
      }
    }
  }

  // tagテーブルの更新
  await deleteAllTags();
  await insertTags(tagsForTagTable);
}