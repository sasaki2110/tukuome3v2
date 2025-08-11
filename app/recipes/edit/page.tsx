import RecipeForm from "@/app/components/RecipeForm";

export default async function RecipeEditPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const resolvedSearchParams = await searchParams;
  const recipeId = resolvedSearchParams.id;

  if (!recipeId) {
    return <div>レシピIDが指定されていません。</div>;
  }

  return <RecipeForm recipeId={recipeId} isEditMode={true} />;
}
