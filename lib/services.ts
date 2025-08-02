'use server';

import { getRepos, getReposByTitle, updateLikeStatus, updateComment, getAuthers } from './db';
import { Repo, Auther } from '@/app/model/model';
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
export async function getRecipes(offset: number, limit: number, mode: string): Promise<{ recipes: Repo[], hasMore: boolean }> {
  const userId = await getUserIdFromSession();

  const { repos, hasMore } = await getRepos(userId, limit, offset, mode);
  return { recipes: repos, hasMore };
}

/**
 * 指定されたタイトルでレシピを検索し、指定されたオフセットから指定された件数のレシピを取得します。
 * @param searchTerm 検索するタイトル文字列
 * @param offset スキップするレシピの件数
 * @param limit 取得するレシピの最大件数
 * @returns Repo型の配列と、まだ取得できるレシピがあるかを示すhasMoreフラグ
 */
export async function getRecipesByTitle(searchTerm: string, offset: number, limit: number, mode: string): Promise<{ recipes: Repo[], hasMore: boolean }> {
  const userId = await getUserIdFromSession();

  const { repos, hasMore } = await getReposByTitle(userId, searchTerm, limit, offset, mode);
  return { recipes: repos, hasMore };
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