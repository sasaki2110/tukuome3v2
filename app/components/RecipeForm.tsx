'use client';

import { useState, useTransition } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import TagSelectionGroup from './TagSelectionGroup';
import { Tag } from '@/app/model/model';
import { getRecipeDetailsFromUrl, RecipeDetails } from '@/app/recipes/new/actions';
import { addRecipe, getRecipeById, deleteRecipe, updateRecipe } from '@/lib/services'; // Import addRecipe, getRecipeById, deleteRecipe, updateRecipe
import Image from 'next/image';
import { useRouter } from 'next/navigation'; // Import useRouter

interface RecipeFormProps {
  recipeId?: string; // Optional for new recipe mode
  isEditMode?: boolean; // Optional, defaults to false for new recipe mode
}

export default function RecipeForm({ recipeId, isEditMode = false }: RecipeFormProps) {
  const router = useRouter();
  const [recipeNumber, setRecipeNumber] = useState('');
  const [recipeDetails, setRecipeDetails] = useState<RecipeDetails | null>(null);
  const [selectedMainTags, setSelectedMainTags] = useState<Tag[]>([]);
  const [selectedCategoryTags, setSelectedCategoryTags] = useState<Tag[]>([]);
  const [recipeType, setRecipeType] = useState<'main_dish' | 'side_dish' | 'other'>('other');
  const [isPending, startTransition] = useTransition();
  const [isAdding, startAddingTransition] = useTransition();
  const [initialLoad, setInitialLoad] = useState(true); // To prevent re-fetching on every render

  useEffect(() => {
    if (isEditMode && recipeId && initialLoad) {
      const fetchAndSetRecipe = async () => {
        try {
          const { recipes } = await getRecipeById(parseInt(recipeId, 10));
          if (recipes.length > 0) {
            const recipe = recipes[0];
            setRecipeNumber(recipe.id_n.toString()); // Set recipe number from DB
            // Manually construct RecipeDetails from DB data for initial display
            setRecipeDetails({
              scrapedInfo: {
                title: recipe.title,
                image: recipe.image,
                tsukurepo: recipe.tsukurepo.toString(), // Assuming tsukurepo is number in DB
                author: recipe.author || '', // Assuming author might be missing in old data
              },
              llmOutput: {
                recipe_type: recipe.recipe_type,
                main_ingredients: recipe.tags.filter(tag => tag.startsWith('素材別')),
                categories: recipe.tags.filter(tag => tag.startsWith('料理')),
              },
            });
            setRecipeType(recipe.recipe_type);
            setSelectedMainTags(recipe.tags.filter(tag => tag.startsWith('素材別')).map(name => ({ id: 0, name, dispname: name.replace(/^(素材別|料理)/, '') }))); // Dummy ID for now
            setSelectedCategoryTags(recipe.tags.filter(tag => tag.startsWith('料理')).map(name => ({ id: 0, name, dispname: name.replace(/^(素材別|料理)/, '') }))); // Dummy ID for now
          } else {
            alert('指定されたレシピが見つかりませんでした。');
            // Optionally redirect or clear form
          }
        } catch (error) {
          console.error('Failed to fetch recipe for edit:', error);
          alert('レシピの読み込みに失敗しました。');
        } finally {
          setInitialLoad(false);
        }
      };
      fetchAndSetRecipe();
    } else if (!isEditMode) {
      // For new recipe mode, ensure initialLoad is false after first render
      setInitialLoad(false);
    }
  }, [isEditMode, recipeId, initialLoad]); // Add initialLoad to dependencies

  const handleFetchRecipe = () => {
    startTransition(async () => {
      const details = await getRecipeDetailsFromUrl(recipeNumber);
      setRecipeDetails(details);
      if (details?.llmOutput.recipe_type) {
        setRecipeType(details.llmOutput.recipe_type);
      }
      if (!details) {
        alert('指定のレシピが存在しないようです。レシピ番号を確認してください。');
      }
    });
  };

  const handleSubmitRecipe = () => {
    if (!recipeDetails || !scrapedInfo) {
      alert('レシピ情報を取得してください。');
      return;
    }

    startAddingTransition(async () => {
      // 既存チェック
      const existingRecipe = await getRecipeById(parseInt(recipeNumber, 10));
      if (existingRecipe.recipes.length > 0) {
        alert('指定のレシピ番号は既に登録されています。');
        return; // 処理を中断
      }

      // 確認ダイアログ
      if (!confirm('レシピを登録します。よろしいですか？')) {
        return; // キャンセルされた場合は処理を中断
      }

      try {
        await addRecipe({
          id_n: parseInt(recipeNumber, 10),
          image: scrapedInfo.image,
          title: `${scrapedInfo.title}${scrapedInfo.author ? ' by ' + scrapedInfo.author : ''}`,
          tsukurepo: scrapedInfo.tsukurepo,
          recipe_type: recipeType,
          tags: allSelectedTags.map(tag => tag.name), // Use tag.name for DB
        });
        alert('レシピが追加されました！');
        router.push(`/recipes?title=${recipeNumber}`); // Redirect to recipe list with search query
      } catch (error) {
        console.error('Failed to add recipe:', error);
        alert('レシピの追加に失敗しました。');
      }
    });
  };

  const handleDeleteRecipe = () => {
    if (!recipeDetails || !recipeNumber) {
      alert('削除するレシピ情報がありません。');
      return;
    }

    if (!confirm('このレシピを削除します。よろしいですか？')) {
      return;
    }

    startAddingTransition(async () => { // Re-using isAdding state for delete
      try {
        await deleteRecipe(parseInt(recipeNumber, 10));
        alert('レシピが削除されました。');
        router.push('/recipes'); // 削除後はレシピ一覧にリダイレクト
      } catch (error) {
        console.error('Failed to delete recipe:', error);
        alert('レシピの削除に失敗しました。');
      }
    });
  };

  const handleUpdateRecipe = () => {
    if (!recipeDetails || !scrapedInfo) {
      alert('更新するレシピ情報がありません。');
      return;
    }

    if (!confirm('このレシピを更新します。よろしいですか？')) {
      return;
    }

    startAddingTransition(async () => { // Re-using isAdding state for update
      try {
        await updateRecipe({
          id_n: parseInt(recipeNumber, 10),
          image: scrapedInfo.image,
          title: `${scrapedInfo.title}${scrapedInfo.author ? ' by ' + scrapedInfo.author : ''}`,
          tsukurepo: scrapedInfo.tsukurepo,
          recipe_type: recipeType,
          tags: allSelectedTags.map(tag => tag.name),
        });
        alert('レシピが更新されました！');
        router.push(`/recipes?title=${recipeNumber}`); // 更新後はそのレシピを表示
      } catch (error) {
        console.error('Failed to update recipe:', error);
        alert('レシピの更新に失敗しました。');
      }
    });
  };

  const allSelectedTags = [...selectedMainTags, ...selectedCategoryTags];
  const scrapedInfo = recipeDetails?.scrapedInfo;

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4">
        {/* Left Column */}
        <div className="md:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold">レシピ情報</h2>
          <div className="flex items-center space-x-2">
            <Input
              placeholder="レシピ番号"
              className="max-w-xs"
              value={recipeNumber}
              onChange={(e) => setRecipeNumber(e.target.value)}
              disabled={isEditMode} // Disable input in edit mode
            />
            {!isEditMode && ( // Only show fetch button in new mode
              <Button onClick={handleFetchRecipe} disabled={isPending}>
                {isPending ? '取得中...' : '取得'}
              </Button>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium">タイトル</label>
            <p className="p-2 border rounded-md bg-gray-100 min-h-[2.5rem]">
              {scrapedInfo?.title} {scrapedInfo?.author ? ' by ' + scrapedInfo.author : ''}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium">画像</label>
            <div className="p-2 border rounded-md bg-gray-100 h-40 relative">
              {scrapedInfo?.image && (
                <Image src={scrapedInfo.image} alt={scrapedInfo.title} layout="fill" objectFit="cover" />
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">つくれぽ数</label>
            <p className="p-2 border rounded-md bg-gray-100">
              {scrapedInfo?.tsukurepo}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium">種類</label>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="main-dish"
                  checked={recipeType === 'main_dish'}
                  onCheckedChange={(checked) => setRecipeType(checked ? 'main_dish' : 'other')}
                />
                <label htmlFor="main-dish">主菜</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="side-dish"
                  checked={recipeType === 'side_dish'}
                  onCheckedChange={(checked) => setRecipeType(checked ? 'side_dish' : 'other')}
                />
                <label htmlFor="side-dish">副菜</label>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">選択中のタグ</label>
            <div className="p-2 border rounded-md bg-gray-100 min-h-[4rem] flex flex-wrap gap-2">
              {allSelectedTags.map(tag => (
                <span key={tag.id} className="bg-gray-200 text-gray-800 px-2 py-1 rounded-full text-sm">
                  {tag.name} {/* Changed from tag.dispname to tag.name */}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Center Column */}
        <div className="md:col-span-1">
          <h2 className="text-lg font-semibold">主材料</h2>
          <div className="p-2 border rounded-md h-full">
            <TagSelectionGroup
              componentKey={`main-${recipeNumber}`} // Renamed from key
              pattern="素材別%"
              onSelectionChange={setSelectedMainTags}
              suggestedTagNames={recipeDetails?.llmOutput.main_ingredients}
            />
          </div>
        </div>

        {/* Right Column */}
        <div className="md:col-span-1">
          <h2 className="text-lg font-semibold">カテゴリ</h2>
          <div className="p-2 border rounded-md h-full">
            <TagSelectionGroup
              componentKey={`cat-${recipeNumber}`} // Renamed from key
              pattern="料理%"
              onSelectionChange={setSelectedCategoryTags}
              suggestedTagNames={recipeDetails?.llmOutput.categories}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4 mt-4">
        <Button variant="outline" onClick={() => router.push('/recipes')}>閉じる</Button>
        {isEditMode && (
          <>
            <Button variant="destructive" onClick={handleDeleteRecipe} disabled={isAdding}>
              {isAdding ? '削除中...' : 'レシピを削除'}
            </Button>
            <Button onClick={handleUpdateRecipe} disabled={isAdding || !recipeDetails}>
              {isAdding ? '更新中...' : 'レシピを更新'}
            </Button>
          </>
        )}
        {!isEditMode && (
          <Button onClick={handleSubmitRecipe} disabled={isAdding || !recipeDetails}>
            {isAdding ? '追加中...' : 'レシピを追加'}
          </Button>
        )}
      </div>
    </div>
  );
}
