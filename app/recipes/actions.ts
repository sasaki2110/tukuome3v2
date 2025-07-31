'use server';

import { redirect } from 'next/navigation';
import { setLike } from '@/lib/services';

export const searchRecipes = async (searchTerm: string) => {
  const params = new URLSearchParams();
  if (searchTerm) {
    params.set('title', searchTerm);
  }
  redirect(`/recipes?${params.toString()}`);
};

export const toggleLikeAction = async (recipeId: number, newRank: number) => {
  await setLike(recipeId, newRank);
};