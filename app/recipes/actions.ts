'use server';

import { redirect } from 'next/navigation';
import { setLike, addComment } from '@/lib/services';

export const searchRecipes = async (searchTerm: string, mode: string | null, rank: string | null) => {
  const params = new URLSearchParams();
  if (searchTerm) {
    params.set('title', searchTerm);
  }
  if (mode) {
    params.set('mode', mode);
  }
  if (rank) {
    params.set('rank', rank);
  }
  // redirect(`/recipes?${params.toString()}`); // クライアントサイドでrouter.pushを使用するため削除
};

export const toggleLikeAction = async (recipeId: number, newRank: number) => {
  await setLike(recipeId, newRank);
};

export const addCommentAction = async (recipeId: number, comment: string) => {
  await addComment(recipeId, comment);
};