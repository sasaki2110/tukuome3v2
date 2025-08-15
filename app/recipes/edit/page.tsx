import RecipeForm from "@/app/components/RecipeForm";

type SearchParams = {
  id?: string;
  [key: string]: string | string[] | undefined;
}

export default async function RecipeEditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const recipeId = resolvedSearchParams.id;

  if (!recipeId) {
    return <div>レシピIDが指定されていません。</div>;
  }

  return <RecipeForm recipeId={recipeId} isEditMode={true} searchParams={resolvedSearchParams} />;
}
