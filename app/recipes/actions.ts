'use server';

import { redirect } from 'next/navigation';

export const searchRecipes = async (searchTerm: string) => {
  const params = new URLSearchParams();
  if (searchTerm) {
    params.set('title', searchTerm);
  }
  redirect(`/recipes?${params.toString()}`);
};