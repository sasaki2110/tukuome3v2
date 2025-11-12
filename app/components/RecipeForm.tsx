'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';

// レシピ変更時のスクレイピング制御フラグ
// true: レシピ変更時にスクレイピングを実行する
// false: レシピ変更時にスクレイピングを実行しない（DBから材料情報を取得）
const ENABLE_SCRAPING_ON_UPDATE = false; // デフォルトは false（高速化のため）

// グローバルな実行制御フラグ
const recipeFormFlags = new Map<string, boolean>();
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
  initialRecipeNumber?: string;
}

export default function RecipeForm({ recipeId, isEditMode = false, searchParams, initialRecipeNumber }: RecipeFormProps) {
  const router = useRouter();
  const [recipeNumber, setRecipeNumber] = useState(initialRecipeNumber || '');
  const [recipeDetails, setRecipeDetails] = useState<RecipeDetails | null>(null);
  const [selectedMainTags, setSelectedMainTags] = useState<Tag[]>([]);
  const [selectedCategoryTags, setSelectedCategoryTags] = useState<Tag[]>([]);
  const [allSelectableMainTags, setAllSelectableMainTags] = useState<Tag[]>([]);
  const [allSelectableCategoryTags, setAllSelectableCategoryTags] = useState<Tag[]>([]);

  const [isPending, startTransition] = useTransition();
  const [isAdding, startAddingTransition] = useTransition();
  const [isUpdating, startUpdatingTransition] = useTransition();
  const [isDeleting, startDeletingTransition] = useTransition();
  const [isReloading, startReloadingTransition] = useTransition();
  const [initialLoad, setInitialLoad] = useState(true);

  const [isMainChecked, setIsMainChecked] = useState(false);
  const [isSubChecked, setIsSubChecked] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // グローバルな実行制御フラグ
  const executionKey = `recipe-form-${recipeId}`;

  const mainPatterns = useMemo(() => ["素材別%"], []);
  const categoryPatterns = useMemo(() => ["料理%", "お菓子%", "パン%"], []);

  useEffect(() => {
    // Validate and set selected tags when all necessary data is available
    if ((allSelectableMainTags.length > 0 || allSelectableCategoryTags.length > 0) && recipeDetails?.llmOutput?.tags) {
      const allAvailableSelectableTags = [...allSelectableMainTags, ...allSelectableCategoryTags];
      const tagsToProcess = recipeDetails.llmOutput.tags;

      const validTags = allAvailableSelectableTags.filter(tag => tagsToProcess.includes(tag.name));

      const mainPatternRegex = new RegExp(`^(${mainPatterns.map(p => p.replace('%', '')).join('|')})`);
      const categoryPatternRegex = new RegExp(`^(${categoryPatterns.map(p => p.replace('%', '')).join('|')})`);

      setSelectedMainTags(validTags.filter(tag => mainPatternRegex.test(tag.name)));
      setSelectedCategoryTags(validTags.filter(tag => categoryPatternRegex.test(tag.name)));
    }
  }, [allSelectableMainTags, allSelectableCategoryTags, recipeDetails?.llmOutput?.tags, mainPatterns, categoryPatterns]);

  useEffect(() => {
    if (isEditMode && recipeId && initialLoad && !hasInitialized) {
      // グローバルフラグで重複実行を防ぐ
      if (recipeFormFlags.get(executionKey)) {
        return;
      }
      
      recipeFormFlags.set(executionKey, true); // グローバルフラグを設定
      setHasInitialized(true); // 重複実行を防ぐ
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

          // 2. タグの有無をチェック
          if (recipe.tags && recipe.tags.length > 0) {
            // タグがある場合：既存のデータを表示
            // フラグに応じてスクレイピングを実行するか決定
            if (ENABLE_SCRAPING_ON_UPDATE) {
              // スクレイピングを実行して最新情報を取得
              const scrapedInfoForIngredients = await reScrapeRecipe(recipe.id_n.toString());
              
              setRecipeDetails({
                scrapedInfo: {
                  title: recipe.title.replace(/ by .*$/, ''), // " by 作者名" を除去
                  image: recipe.image,
                  tsukurepo: recipe.reposu_n?.toString() || '0',
                  author: recipe.author || '',
                  recipeid: recipe.id_n.toString(),
                  ingredients: scrapedInfoForIngredients?.ingredients || [],
                },
                llmOutput: {
                  isMain: recipe.ismain === 1,
                  isSub: recipe.issub === 1,
                  tags: recipe.tags,
                },
              });
            } else {
              // DBから取得した材料情報を使用（スクレイピング不要）
              setRecipeDetails({
                scrapedInfo: {
                  title: recipe.title.replace(/ by .*$/, ''), // " by 作者名" を除去
                  image: recipe.image,
                  tsukurepo: recipe.reposu_n?.toString() || '0',
                  author: recipe.author || '',
                  recipeid: recipe.id_n.toString(),
                  ingredients: recipe.ingredients || [], // DBから取得した材料情報を使用
                },
                llmOutput: {
                  isMain: recipe.ismain === 1,
                  isSub: recipe.issub === 1,
                  tags: recipe.tags,
                },
              });
            }
            setIsMainChecked(recipe.ismain === 1);
            setIsSubChecked(recipe.issub === 1);

          } else {
            // タグがない場合：LLMで推論
            const details = await getRecipeDetailsFromUrl(recipe.id_n.toString());
            
            setRecipeDetails(details);
            if (details?.llmOutput) {
              const { isMain, isSub, tags } = details.llmOutput;
              setIsMainChecked(isMain);
              setIsSubChecked(isSub);

              // SuggestionのためにllmOutputを更新する
              setRecipeDetails(prevDetails => {
                if (!prevDetails) return null;
                return {
                  ...prevDetails,
                  llmOutput: {
                    ...prevDetails.llmOutput,
                    tags: tags, // Ensure tags are passed for processing
                  }
                }
              });
            }
          }
        } catch (error) {
          console.error('Failed to fetch recipe for edit:', error);
          alert('レシピの読み込みに失敗しました。');
        } finally {
          setInitialLoad(false);
          // 処理完了後にフラグをクリア
          recipeFormFlags.delete(executionKey);
        }
      };
      fetchAndSetRecipe();
    } else if (!isEditMode) {
      setInitialLoad(false);
    }
  }, [isEditMode, recipeId, initialLoad, hasInitialized, executionKey]);

  // コンポーネントのアンマウント時にフラグをクリア（バックアップ）
  useEffect(() => {
    return () => {
      if (executionKey) {
        // 少し遅延してクリア（処理中の可能性を考慮）
        setTimeout(() => {
          recipeFormFlags.delete(executionKey);
        }, 1000);
      }
    };
  }, [executionKey]);

  const handleFetchRecipe = () => {
    startTransition(async () => {
      const details = await getRecipeDetailsFromUrl(recipeNumber);
      setRecipeDetails(details);
      if (details?.llmOutput) {
        const { isMain, isSub, tags } = details.llmOutput;
        setIsMainChecked(isMain);
        setIsSubChecked(isSub);
        // SuggestionのためにllmOutputを更新する
        setRecipeDetails(prevDetails => {
          if (!prevDetails) return null;
          return {
            ...prevDetails,
            llmOutput: {
              ...prevDetails.llmOutput,
              tags: tags, // Ensure tags are passed for processing
            }
          }
        });
      }
      if (!details) {
        alert('指定のレシピが存在しないようです。レシピ番号を確認してください。');
      }
    });
  };

  const handleReloadRecipe = () => {
    startReloadingTransition(async () => {
      try {
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
          alert('レシピ情報の再読み込みに失敗しました。レシピが存在しないか、アクセスできません。');
        }
      } catch (error) {
        console.error('Failed to reload recipe:', error);
        alert('レシピ情報の再読み込みに失敗しました。レシピが存在しないか、アクセスできません。');
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

      /*+
      if (!confirm('レシピを登録します。よろしいですか？')) {
        return;
      }
      */

      try {
        await addRecipe({
          id_n: parseInt(recipeNumber, 10),
          image: scrapedInfo.image,
          title: `${scrapedInfo.title}${scrapedInfo.author ? ' by ' + scrapedInfo.author : ''}`,
          tsukurepo: scrapedInfo.tsukurepo,
          isMain: isMainChecked ? 1 : 0,
          isSub: isSubChecked ? 1 : 0,
          tags: allSelectedTags.map(tag => tag.name),
          ingredients: scrapedInfo.ingredients || [], // 追加: 材料情報
        });
        /*
        alert('レシピが追加されました！');
        */
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

    startDeletingTransition(async () => {
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

    startUpdatingTransition(async () => {
      try {
        await updateRecipe({
          id_n: parseInt(recipeNumber, 10),
          image: scrapedInfo.image,
          title: `${scrapedInfo.title}${scrapedInfo.author ? ' by ' + scrapedInfo.author : ''}`,
          tsukurepo: scrapedInfo.tsukurepo,
          isMain: isMainChecked ? 1 : 0,
          isSub: isSubChecked ? 1 : 0,
          tags: allSelectedTags.map(tag => tag.name),
          ingredients: scrapedInfo.ingredients || [], // 追加: 材料情報
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

  const handleRemoveTag = (tagName: string) => {
    setSelectedMainTags(prevTags => prevTags.filter(tag => tag.name !== tagName));
    setSelectedCategoryTags(prevTags => prevTags.filter(tag => tag.name !== tagName));
  };

  const allSelectedTags = useMemo(() => {
    const combinedSelected = [...selectedMainTags, ...selectedCategoryTags];
    // The sort order should be based on the comprehensive list of selectable tags
    const allSelectableTags = [...allSelectableMainTags, ...allSelectableCategoryTags];
    const sortOrder = new Map(allSelectableTags.map((tag, index) => [tag.name, index]));

    combinedSelected.sort((a, b) => {
        const orderA = sortOrder.get(a.name) ?? Infinity;
        const orderB = sortOrder.get(b.name) ?? Infinity;
        return orderA - orderB;
    });

    return combinedSelected;
  }, [selectedMainTags, selectedCategoryTags, allSelectableMainTags, allSelectableCategoryTags]);

  const scrapedInfo = recipeDetails?.scrapedInfo;

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pb-4">
        {/* 1st Column */}
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
            <div className="p-2 border rounded-md bg-gray-100 h-30 w-30 relative">
              {scrapedInfo?.image && (
                <a href={`https://cookpad.com/jp/recipes/${recipeNumber}`} target="_blank" rel="noopener noreferrer">
                  <Image src={scrapedInfo.image} alt={scrapedInfo.title || ''} layout="fill" objectFit="cover" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* 2nd Column */}
        <div className="md:col-span-1 space-y-4 pt-9">
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
                <span
                  key={tag.name}
                  className="bg-gray-200 text-gray-800 px-2 py-1 rounded-full text-sm cursor-pointer hover:bg-gray-300"
                  onClick={() => handleRemoveTag(tag.name)}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
          <div className="flex justify-center space-x-4 mt-4">
            {!isEditMode && (
              <Button onClick={handleSubmitRecipe} disabled={isAdding || !recipeDetails}>
                {isAdding ? '追加中...' : 'レシピを追加'}
              </Button>
            )}
            {isEditMode && (
              <>
                <Button onClick={handleUpdateRecipe} disabled={isAdding || isUpdating || isDeleting || !recipeDetails}>
                  {isUpdating ? '更新中...' : 'レシピを更新'}
                </Button>
              </>
            )}
            {isEditMode && (
              <>
                <Button variant="destructive" onClick={handleDeleteRecipe} disabled={isAdding || isUpdating || isDeleting}>
                  {isDeleting ? '削除中...' : 'レシピを削除'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Ingredients Column */}
        <div className="md:col-span-1">
          <h2 className="text-lg font-semibold">材料</h2>
          <div className="p-2 border rounded-md h-85 overflow-y-auto max-h-85">
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
          <div className="p-2 border rounded-md h-85">
            <TagSelectionGroup
              key={`main-${recipeNumber}-${hasInitialized}`}
              componentKey={`main-${recipeNumber}`}
              patterns={mainPatterns}
              selectedTags={selectedMainTags}
              onSelectionChange={setSelectedMainTags}
              onTagsFetched={setAllSelectableMainTags}
            />
          </div>
        </div>

        {/* Category Column */}
        <div className="md:col-span-1">
          <h2 className="text-lg font-semibold">カテゴリ</h2>
          <div className="p-2 border rounded-md h-85">
            <TagSelectionGroup
              key={`cat-${recipeNumber}-${hasInitialized}`}
              componentKey={`cat-${recipeNumber}`}
              patterns={categoryPatterns}
              selectedTags={selectedCategoryTags}
              onSelectionChange={setSelectedCategoryTags}
              onTagsFetched={setAllSelectableCategoryTags}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={() => router.back()}>閉じる</Button>
      </div>
    </div>
  );
}
