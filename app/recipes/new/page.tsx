import RecipeForm from "@/app/components/RecipeForm";

interface RecipeNewPageProps {
  searchParams: Promise<{
    recipeNumber?: string;
  }>;
}

export default async function RecipeNewPage({ searchParams }: RecipeNewPageProps) {
  const resolvedSearchParams = await searchParams;
  return <RecipeForm isEditMode={false} initialRecipeNumber={resolvedSearchParams.recipeNumber} />;
}
