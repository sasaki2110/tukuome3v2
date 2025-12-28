import { getDispTags, getTagByName, getTagNameByHierarchy } from '@/lib/services';
import { TagsList } from '@/app/components/TagsList';

interface TagsPageProps {
  searchParams: Promise<{
    tag?: string | string[] | null;
  }>;
}

export default async function TagsPage({ searchParams }: TagsPageProps) {
  const resolvedSearchParams = await searchParams;
  
  // URLパラメータからタグ名を取得
  const tagParam = Array.isArray(resolvedSearchParams?.tag)
    ? resolvedSearchParams.tag[0]
    : resolvedSearchParams?.tag || null;

  let initialTags;
  let initialPath: string[] = [];

  if (tagParam) {
    // タグ名から階層情報を取得
    const tagInfo = await getTagByName(tagParam);
    
    if (tagInfo) {
      // 階層情報から親タグのnameを取得してパスを構築
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
      if (path.length === 0 || path[path.length - 1] !== tagParam) {
        path.push(tagParam);
      }
      
      initialPath = path;
      
      // クリックしたタグの次の階層を表示
      const nextLevel = tagInfo.level + 1;
      const parentTagName = tagParam;
      initialTags = await getDispTags(nextLevel, parentTagName);
    } else {
      // タグ情報が取得できない場合、0階層目から探す
      const level0Tags = await getDispTags(0, "");
      const selectedTag = level0Tags.find(
        (tag) => tag.name === tagParam || tag.dispname === tagParam
      );

      if (selectedTag) {
        // タグが見つかった場合、そのタグをパスに追加して1階層目を表示
        initialPath = [selectedTag.name];
        initialTags = await getDispTags(1, selectedTag.name);
      } else {
        // タグが見つからない場合は0階層目を表示
        initialTags = level0Tags;
      }
    }
  } else {
    // タグ名が指定されていない場合は0階層目を表示
    initialTags = await getDispTags(0, "");
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">タグから探す</h1>
      <TagsList initialTags={initialTags} initialPath={initialPath} />
    </div>
  );
}