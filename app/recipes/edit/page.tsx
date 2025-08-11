import RecipeForm from "@/app/components/RecipeForm";

// Next.jsのPageコンポーネントは、URLパラメータをpropsとして受け取ります
// params: 動的ルーティングのパラメータ (例: /recipes/edit/[id] の [id])
// searchParams: クエリパラメータ (例: /recipes/edit?id=123 の id)
export default function RecipeEditPage({ searchParams }: { searchParams: { id?: string } }) {
  const recipeId = searchParams.id; // クエリパラメータからレシピIDを取得

  // レシピIDが存在しない場合はエラー表示やリダイレクトなど適切な処理を行う
  if (!recipeId) {
    return <div>レシピIDが指定されていません。</div>;
  }

  return <RecipeForm recipeId={recipeId} isEditMode={true} />;
}