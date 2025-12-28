import { getFilteredRecipes, getTagByName, getTagNameByHierarchy, getDispTags } from "@/lib/services";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { RecipeListWithLoadMore } from "../components/RecipeListWithLoadMore";
import RecipeFilterControls from "../components/RecipeFilterControls";
import Breadcrumb from "../components/Breadcrumb";
import { DispTag } from "@/app/model/model";

interface RecipesPageProps {
  searchParams: Promise<{
    title?: string | string[] | null;
    mode?: string | string[] | null;
    tag?: string | string[] | null;
    folder?: string | string[] | null;
    rank?: string | string[] | null;
    sort?: string | string[] | null;
    tagmode?: string | string[] | null; // 追加
  }>;
}

const RecipesPage = async ({ searchParams }: RecipesPageProps) => {
  const resolvedSearchParams = await searchParams;
  const searchTerm = Array.isArray(resolvedSearchParams?.title) ? resolvedSearchParams.title[0] : resolvedSearchParams?.title || '';
  
  const isIdSearch = /^[0-9]+$/.test(searchTerm);

  const searchMode = isIdSearch ? 'all' : (Array.isArray(resolvedSearchParams?.mode) ? resolvedSearchParams.mode[0] : resolvedSearchParams?.mode || 'all');
  const searchTag = isIdSearch ? '' : (Array.isArray(resolvedSearchParams?.tag) ? resolvedSearchParams.tag[0] : resolvedSearchParams?.tag || '');
  const folderName = isIdSearch ? '' : (Array.isArray(resolvedSearchParams?.folder) ? resolvedSearchParams.folder[0] : resolvedSearchParams?.folder || '');
  const searchRank = isIdSearch ? 'all' : (Array.isArray(resolvedSearchParams?.rank) ? resolvedSearchParams.rank[0] : resolvedSearchParams?.rank || 'all');
  const searchSort = isIdSearch ? 'desc' : (Array.isArray(resolvedSearchParams?.sort) ? resolvedSearchParams.sort[0] : resolvedSearchParams?.sort || 'desc');
  const tagMode = isIdSearch ? '' : (Array.isArray(resolvedSearchParams?.tagmode) ? resolvedSearchParams.tagmode[0] : resolvedSearchParams?.tagmode || ''); // tagModeを追加

  const { recipes: initialRecipes, hasMore: initialHasMore } = await getFilteredRecipes(
    0,
    ITEMS_PER_PAGE,
    searchTerm,
    searchMode,
    searchTag,
    folderName,
    searchRank,
    searchSort,
    tagMode // tagModeを渡す
  );

  // パンくずリスト用のタグ情報を取得（タグが指定されている場合のみ）
  const pathTags: DispTag[] = [];
  
  if (searchTag) {
    const tagInfo = await getTagByName(searchTag);
    if (tagInfo) {
      const path: string[] = [];
      
      // レベル0（大タグ）のnameを取得
      if (tagInfo.l) {
        const lName = await getTagNameByHierarchy(0, tagInfo.l);
        if (lName) {
          path.push(lName);
        }
      }
      
      // レベル1（中タグ）のnameを取得
      if (tagInfo.level >= 1 && tagInfo.m) {
        const mName = await getTagNameByHierarchy(1, tagInfo.l, tagInfo.m);
        if (mName) {
          path.push(mName);
        }
      }
      
      // レベル2（小タグ）のnameを取得
      if (tagInfo.level >= 2 && tagInfo.s) {
        const sName = await getTagNameByHierarchy(2, tagInfo.l, tagInfo.m, tagInfo.s);
        if (sName) {
          path.push(sName);
        }
      }
      
      // レベル3（極小タグ）のnameを取得
      if (tagInfo.level >= 3 && tagInfo.ss) {
        const ssName = await getTagNameByHierarchy(3, tagInfo.l, tagInfo.m, tagInfo.s, tagInfo.ss);
        if (ssName) {
          path.push(ssName);
        }
      }
      
      // クリックしたタグ自体をパスに追加（既にパスに含まれている場合は追加しない）
      if (path.length === 0 || path[path.length - 1] !== searchTag) {
        path.push(searchTag);
      }
      
      // 各階層のタグ情報を取得
      for (let i = 0; i < path.length; i++) {
        const level = i;
        const parentTagName = i > 0 ? path[i - 1] : "";
        const levelTags = await getDispTags(level, parentTagName);
        const tag = levelTags.find((t) => t.name === path[i]);
        if (tag) {
          pathTags.push(tag);
        }
      }
    }
  }

  return (
    <>
      <RecipeFilterControls />
      <div className="p-4 pt-[100px]">
        {/* パンくずリスト（タグが指定されている場合のみ表示） */}
        {pathTags.length > 0 && (
          <Breadcrumb pathTags={pathTags} />
        )}
        <RecipeListWithLoadMore
          key={`${searchTerm}-${searchMode}-${searchTag}-${searchRank}-${searchSort}-${tagMode}`} // keyにtagModeを追加
          initialRecipes={initialRecipes}
          initialOffset={0}
          initialHasMore={initialHasMore}
          searchTerm={searchTerm}
          searchMode={searchMode}
          searchTag={searchTag}
          folderName={folderName}
          searchRank={searchRank}
          searchSort={searchSort}
          tagMode={tagMode} // tagModeを渡す
        />
      </div>
    </>
  );
};

export default RecipesPage;