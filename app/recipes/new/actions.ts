'use server';

import { scrapeUrl, RecipeInfo } from '@/lib/scraper';
import { getTagsByName } from '@/lib/services'; // getTagsByNameをインポート
import { Tag } from '@/app/model/model'; // Tagをインポート
import { getTagsFromLlm, ParsedLlmOutput } from '@/lib/servicesForLlm';

// 再帰的なTagNodeインターフェースを定義（TagSelectionGroupから再利用）
interface TagNode extends Tag {
  children: TagNode[];
  isSelectable: boolean; // 子ノードを持たないリーフノードの場合はtrue
}

// 階層的なタグツリーを構築するヘルパー関数（TagSelectionGroupから再利用）
const buildTagTree = (tags: Tag[], pattern: string): TagNode[] => {
  const nodes: Record<string, TagNode> = {};
  const rootNodes: TagNode[] = [];
  const patternBase = pattern.replace(/%/g, ''); // 例: "素材別" or "料理"

  // 第1パス: 全てのノードを作成し、完全な名前でマッピングする
  tags.forEach(tag => {
    nodes[tag.name] = { ...tag, children: [], isSelectable: true };
  });

  // 第2パス: 階層を構築する
  tags.forEach(tag => {
    const currentNode = nodes[tag.name];

    // 現在のタグのdispnameを完全な名前から削除して、親の可能性のある名前を決定する
    // dispnameが名前の最後の部分であることを前提とする
    const potentialParentName = tag.name.substring(0, tag.name.length - tag.dispname.length);

    // 親の可能性のあるノードが存在し、それがノードマップにあれば
    if (potentialParentName && nodes[potentialParentName]) {
      const parentNode = nodes[potentialParentName];
      parentNode.children.push(currentNode);
      parentNode.isSelectable = false; // 子を持つノードは選択不可
    } else {
      // 親が見つからない場合は、ルートノードの可能性がある
      // 第3パスでフィルタリングされる
      rootNodes.push(currentNode);
    }
  });

  // 第3パス: 他のノードの子であるノードを除外し、パターンに一致することを確認する
  const finalRootNodes = rootNodes.filter(node => {
    // 他のノードの子ではなく、かつパターンに一致する場合に真のルートノードとなる
    const isChildOfAnotherNode = Object.values(nodes).some(otherNode =>
      otherNode.children.includes(node)
    );
    return !isChildOfAnotherNode && node.name.startsWith(patternBase);
  });

  // 表示の一貫性のために子をソートする
  Object.values(nodes).forEach(node => {
    node.children.sort((a, b) => a.id - b.id);
  });

  // 最終的なルートノードをソートする
  return finalRootNodes.sort((a, b) => a.id - b.id);
};

// 選択可能な全てのタグ名を取得する新しい関数
export async function getAllSelectableTagNames(): Promise<string[]> {
  const mainIngredientTags = await getTagsByName("素材別%");
  const categoryTags = await getTagsByName("料理%");

  const allTags = [...mainIngredientTags, ...categoryTags];

  // 結合されたツリーを構築し、選択可能なノードを抽出する
  const combinedTree = buildTagTree(allTags, ""); // 全てのルートを取得するために空のパターンを使用

  const selectableNames: string[] = [];
  const traverseAndCollect = (nodes: TagNode[]) => {
    nodes.forEach(node => {
      if (node.isSelectable) {
        selectableNames.push(node.name);
      } else {
        traverseAndCollect(node.children);
      }
    });
  };
  traverseAndCollect(combinedTree);

  return selectableNames;
}

export interface RecipeDetails {
  scrapedInfo: RecipeInfo;
  llmOutput: ParsedLlmOutput;
}

export async function getRecipeDetailsFromUrl(recipeNumber: string): Promise<RecipeDetails | null> {
  if (!recipeNumber || !/^[0-9]+$/.test(recipeNumber)) {
    console.error("無効なレシピ番号です");
    return null;
  }

  const url = `https://cookpad.com/jp/recipes/${recipeNumber}`;

  try {
    const scrapeResult = await scrapeUrl(url);
    
    if (!scrapeResult) {
      return null;
    }

    const { recipeInfo } = scrapeResult;

    // 新しいLLMサービスを呼び出して構造化データを取得する
    const llmOutput = await getTagsFromLlm(recipeInfo.title, recipeInfo.ingredients || []);

    return {
      scrapedInfo: recipeInfo,
      llmOutput: llmOutput,
    };
  } catch (error) {
    console.error(`レシピ ${recipeNumber} の処理に失敗しました:`, error);
    return null;
  }
}