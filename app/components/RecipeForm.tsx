'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import TagSelectionGroup from './TagSelectionGroup';
import { Tag } from '@/app/model/model';
import { getRecipeDetailsFromUrl, RecipeDetails } from '@/app/recipes/new/actions';
import { reScrapeRecipe } from '@/app/recipes/edit/actions';
import { addRecipe, getRecipeById, deleteRecipe, updateRecipe } from '@/lib/services';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface RecipeFormProps {
  recipeId?: string;
  isEditMode?: boolean;
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default function RecipeForm({ recipeId, isEditMode = false, searchParams }: RecipeFormProps) {
  const router = useRouter();
  const [recipeNumber, setRecipeNumber] = useState('');
  const [recipeDetails, setRecipeDetails] = useState<RecipeDetails | null>(null);
  const [selectedMainTags, setSelectedMainTags] = useState<Tag[]>([]);
  const [selectedCategoryTags, setSelectedCategoryTags] = useState<Tag[]>([]);

  const [isPending, startTransition] = useTransition();
  const [isAdding, startAddingTransition] = useTransition();
  const [isReloading, startReloadingTransition] = useTransition();
  const [initialLoad, setInitialLoad] = useState(true);

  const [isMainChecked, setIsMainChecked] = useState(false);
  const [isSubChecked, setIsSubChecked] = useState(false);

  const mainPatterns = useMemo(() => ["素材別%"], []);
  const categoryPatterns = useMemo(() => ["料理%", "お菓子%", "パン%"], []);

  useEffect(() => {
    if (isEditMode && recipeId && initialLoad) {
      const fetchAndSetRecipe = async () => {
        try {
          // 1. DBから基本情報を取得
          const { recipes } = await getRecipeById(parseInt(recipeId, 10));
          if (recipes.length === 0) {
            alert('指定されたレシピが見つかりませんでした。');
            setInitialLoad(false);
            return;
          }
          const recipe = recipes[0];
          setRecipeNumber(recipe.id_n.toString());

          // 2. スクレイピングで材料情報をバックグラウンド取得
          const scrapedInfoForIngredients = await reScrapeRecipe(recipe.id_n.toString());

          // 3. DB情報とスクレイピング情報をマージ
          let derivedRecipeType: 'main_dish' | 'side_dish' | 'other' = 'other';
          if (recipe.ismain === 1) derivedRecipeType = 'main_dish';
          else if (recipe.issub === 1) derivedRecipeType = 'side_dish';

          setRecipeDetails({
            scrapedInfo: {
              title: recipe.title,
              image: recipe.image,
              tsukurepo: recipe.reposu_n?.toString() || '0',
              author: recipe.author || '',
              recipeid: recipe.id_n.toString(),
              ingredients: scrapedInfoForIngredients?.ingredients || [], // スクレイピング結果を反映
            },
            llmOutput: {
              recipe_type: derivedRecipeType,
              main_ingredients: recipe.tags?.filter(tag => tag.startsWith('素材別')) || [],
              categories: recipe.tags?.filter(tag => /^(料理|お菓子|パン)/.test(tag)) || [],
            },
          });

          setIsMainChecked(recipe.ismain === 1);
          setIsSubChecked(recipe.issub === 1);
          setSelectedMainTags(recipe.tags?.filter(tag => tag.startsWith('素材別')).map(name => ({ id: 0, name, dispname: name.replace(/^(素材別|料理|お菓子|パン)/, ''), level: 0 })) || []);
          setSelectedCategoryTags(recipe.tags?.filter(tag => /^(料理|お菓子|パン)/.test(tag)).map(name => ({ id: 0, name, dispname: name.replace(/^(素材別|料理|お菓子|パン)/, ''), level: 0 })) || []);

        } catch (error) {
          console.error('Failed to fetch recipe for edit:', error);
          alert('レシピの読み込みに失敗しました。');
        } finally {
          setInitialLoad(false);
        }
      };
      fetchAndSetRecipe();
    } else if (!isEditMode) {
      setInitialLoad(false);
    }
  }, [isEditMode, recipeId, initialLoad]);

  const handleFetchRecipe = () => {
    startTransition(async () => {
      const details = await getRecipeDetailsFromUrl(recipeNumber);
      setRecipeDetails(details);
      if (details?.llmOutput.recipe_type) {
        const llmRecipeType = details.llmOutput.recipe_type;
        setIsMainChecked(llmRecipeType === 'main_dish');
        setIsSubChecked(llmRecipeType === 'side_dish');
      }
      if (!details) {
        alert('指定のレシピが存在しないようです。レシピ番号を確認してください。');
      }
    });
  };

  const handleReloadRecipe = () => {
    startReloadingTransition(async () => {
      const scrapedInfo = await reScrapeRecipe(recipeNumber);
      if (scrapedInfo) {
        setRecipeDetails(prevDetails => {
          if (prevDetails) {
            return { ...prevDetails, scrapedInfo };
          }
          return null;
        });
        alert('レシピ情報を再読み込みしました。');
      } else {
        alert('レシピ情報の再読み込みに失敗しました。');
      }
    });
  };

  const handleSubmitRecipe = () => {
    if (!recipeDetails || !scrapedInfo) {
      alert('レシピ情報を取得してください。');
      return;
    }

    startAddingTransition(async () => {
      const existingRecipe = await getRecipeById(parseInt(recipeNumber, 10));
      if (existingRecipe.recipes.length > 0) {
        alert('指定のレシピ番号は既に登録されています。');
        return;
      }

      if (!confirm('レシピを登録します。よろしいですか？')) {
        return;
      }

      try {
        await addRecipe({
          id_n: parseInt(recipeNumber, 10),
          image: scrapedInfo.image,
          title: `${scrapedInfo.title}${scrapedInfo.author ? ' by ' + scrapedInfo.author : ''}`,
          tsukurepo: scrapedInfo.tsukurepo,
          isMain: isMainChecked ? 1 : 0,
          isSub: isSubChecked ? 1 : 0,
          tags: allSelectedTags.map(tag => tag.name),
        });
        alert('レシピが追加されました！');
        router.push(`/recipes?title=${recipeNumber}`);
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

    startAddingTransition(async () => {
      try {
        await deleteRecipe(parseInt(recipeNumber, 10));
        alert('レシピが削除されました。');
        if (isEditMode && searchParams) {
          let finalParams;
          if (searchParams.value && typeof searchParams.value === 'string') {
            try {
              finalParams = new URLSearchParams(JSON.parse(searchParams.value));
            } catch (e) {
              console.error("Failed to parse searchParams.value:", e);
              const sanitizedParams: Record<string, string> = {};
              for (const [key, value] of Object.entries(searchParams)) {
                if (value !== undefined) {
                  sanitizedParams[key] = String(value);
                }
              }
              finalParams = new URLSearchParams(sanitizedParams);
            }
          } else {
            const sanitizedParams: Record<string, string> = {};
            for (const [key, value] of Object.entries(searchParams)) {
              if (value !== undefined) {
                sanitizedParams[key] = String(value);
              }
            }
            finalParams = new URLSearchParams(sanitizedParams);
          }
          ['id', 'status', 'value', 'reason', '_debugInfo'].forEach(p => finalParams.delete(p));
          router.push(`/recipes?${finalParams.toString()}`);
        } else {
          router.push('/recipes');
        }
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

    startAddingTransition(async () => {
      try {
        await updateRecipe({
          id_n: parseInt(recipeNumber, 10),
          image: scrapedInfo.image,
          title: `${scrapedInfo.title}${scrapedInfo.author ? ' by ' + scrapedInfo.author : ''}`,
          tsukurepo: scrapedInfo.tsukurepo,
          isMain: isMainChecked ? 1 : 0,
          isSub: isSubChecked ? 1 : 0,
          tags: allSelectedTags.map(tag => tag.name),
        });
        if (isEditMode && searchParams) {
          let finalParams;
          if (searchParams.value && typeof searchParams.value === 'string') {
            try {
              finalParams = new URLSearchParams(JSON.parse(searchParams.value));
            } catch (e) {
              console.error("Failed to parse searchParams.value:", e);
              const sanitizedParams: Record<string, string> = {};
              for (const [key, value] of Object.entries(searchParams)) {
                if (value !== undefined) {
                  sanitizedParams[key] = String(value);
                }
              }
              finalParams = new URLSearchParams(sanitizedParams);
            }
          } else {
            const sanitizedParams: Record<string, string> = {};
            for (const [key, value] of Object.entries(searchParams)) {
              if (value !== undefined) {
                sanitizedParams[key] = String(value);
              }
            }
            finalParams = new URLSearchParams(sanitizedParams);
          }
          ['id', 'status', 'value', 'reason', '_debugInfo'].forEach(p => finalParams.delete(p));
          router.push(`/recipes?${finalParams.toString()}`);
        } else {
          router.push(`/recipes?title=${recipeNumber}`);
        }
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-4">
        {/* Left Column */}
        <div className="md:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold">レシピ情報</h2>
          <div className="flex items-center space-x-2">
            <Input
              placeholder="レシピ番号"
              className="max-w-xs"
              value={recipeNumber}
              onChange={(e) => setRecipeNumber(e.target.value)}
              disabled={isEditMode}
            />
            {!isEditMode && (
              <Button onClick={handleFetchRecipe} disabled={isPending}>
                {isPending ? '取得中...' : '取得'}
              </Button>
            )}
            {isEditMode && (
              <Button onClick={handleReloadRecipe} disabled={isReloading}>
                {isReloading ? '再読込中...' : '再読み込み'}
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
            <div className="p-2 border rounded-md bg-gray-100 h-50 w-50 relative">
              {scrapedInfo?.image && (
                <Image src={scrapedInfo.image} alt={scrapedInfo.title || ''} layout="fill" objectFit="cover" />
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
                  checked={isMainChecked}
                  onCheckedChange={(checked) => setIsMainChecked(checked === true)}
                />
                <label htmlFor="main-dish">主菜</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="side-dish"
                  checked={isSubChecked}
                  onCheckedChange={(checked) => setIsSubChecked(checked === true)}
                />
                <label htmlFor="side-dish">副菜</label>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">選択中のタグ</label>
            <div className="p-2 border rounded-md bg-gray-100 min-h-[4rem] flex flex-wrap gap-2">
              {allSelectedTags.map(tag => (
                <span key={tag.name} className="bg-gray-200 text-gray-800 px-2 py-1 rounded-full text-sm">
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Ingredients Column */}
        <div className="md:col-span-1">
          <h2 className="text-lg font-semibold">材料</h2>
          <div className="p-2 border rounded-md h-full overflow-y-auto">
            {initialLoad ? (
              <p className="text-sm text-gray-500">材料を読み込み中...</p>
            ) : (
              scrapedInfo?.ingredients && scrapedInfo.ingredients.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {scrapedInfo.ingredients.map((ingredient, index) => (
                    <li key={index} className="break-words">{ingredient}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">材料情報はありません。</p>
              )
            )}
          </div>
        </div>

        {/* Main Ingredients Column */}
        <div className="md:col-span-1">
          <h2 className="text-lg font-semibold">主材料</h2>
          <div className="p-2 border rounded-md h-full">
            <TagSelectionGroup
              componentKey={`main-${recipeNumber}`}
              patterns={mainPatterns}
              onSelectionChange={setSelectedMainTags}
              suggestedTagNames={recipeDetails?.llmOutput.main_ingredients}
            />
          </div>
        </div>

        {/* Category Column */}
        <div className="md:col-span-1">
          <h2 className="text-lg font-semibold">カテゴリ</h2>
          <div className="p-2 border rounded-md h-full">
            <TagSelectionGroup
              componentKey={`cat-${recipeNumber}`}
              patterns={categoryPatterns}
              onSelectionChange={setSelectedCategoryTags}
              suggestedTagNames={recipeDetails?.llmOutput.categories}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4 mt-4">
        <Button variant="outline" onClick={() => router.back()}>閉じる</Button>
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
