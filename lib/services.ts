'use server';

import { getRepos, getReposByTitle, getReposByTag, updateLikeStatus, updateComment, getAuthers, getDispTagsOptimized, getReposByFolder } from './db';
import { Repo, Auther, DispTag } from '@/app/model/model';
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
export async function getRecipes(offset: number, limit: number, mode: string, rank: string): Promise<{ recipes: Repo[], hasMore: boolean }> {
  const userId = await getUserIdFromSession();

  const { repos, hasMore } = await getRepos(userId, limit, offset, mode, rank);
  return { recipes: repos, hasMore };
}

/**
 * 指定されたタイトルでレシピを検索し、指定されたオフセットから指定された件数のレシピを取得します。
 * @param searchTerm 検索するタイトル文字列
 * @param offset スキップするレシピの件数
 * @param limit 取得するレシピの最大件数
 * @returns Repo型の配列と、まだ取得できるレシピがあるかを示すhasMoreフラグ
 */
export async function getRecipesByTitle(searchTerm: string, offset: number, limit: number, mode: string, rank: string): Promise<{ recipes: Repo[], hasMore: boolean }> {
  const userId = await getUserIdFromSession();

  const { repos, hasMore } = await getReposByTitle(userId, searchTerm, limit, offset, mode, rank);
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
export async function getRecipesByTag(tagName: string, offset: number, limit: number, mode: string, rank: string): Promise<{ recipes: Repo[], hasMore: boolean }> {
  const userId = await getUserIdFromSession();

  const { repos, hasMore } = await getReposByTag(userId, tagName, limit, offset, mode, rank);
  return { recipes: repos, hasMore };
}

/**
 * 指定されたフォルダーに含まれるレシピを取得します。
 * @param folderName フォルダー名
 * @param offset スキップするレシピの件数
 * @param limit 取得するレシピの最大件数
 * @param mode 絞り込みモード
 * @returns Repo型の配列と、まだ取得できるレシピがあるかを示すhasMoreフラグ
 */
export async function getRecipesByFolder(folderName: string, offset: number, limit: number, mode: string, rank: string): Promise<{ recipes: Repo[], hasMore: boolean }> {
  const userId = await getUserIdFromSession();

  const { repos, hasMore } = await getReposByFolder(userId, folderName, limit, offset, mode, rank);
  return { recipes: repos, hasMore };
}

export async function getFilteredRecipes(
  offset: number,
  limit: number,
  searchTerm?: string,
  searchMode?: string,
  searchTag?: string,
  folderName?: string,
  searchRank?: string
): Promise<{ recipes: Repo[]; hasMore: boolean }> {
  const mode = searchMode || 'all';
  const rank = searchRank || 'all';

  if (folderName) {
    return await getRecipesByFolder(folderName, offset, limit, mode, rank);
  } else if (searchTag) {
    return await getRecipesByTag(searchTag, offset, limit, mode, rank);
  } else if (searchTerm) {
    return await getRecipesByTitle(searchTerm, offset, limit, mode, rank);
  } else {
    return await getRecipes(offset, limit, mode, rank);
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
 * 指定されたレベルと親タグのnameに基づいて表示用タグを取得します。
 * @param level 取得するタグのレベル
 * @param value 親タグのname (最上位の場合は空文字列)
 * @returns DispTag型の配列
 */
export async function getDispTags(level: number, value: string): Promise<DispTag[]> {
  const userId = await getUserIdFromSession();
  return await getDispTagsOptimized(userId, level, value);
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

