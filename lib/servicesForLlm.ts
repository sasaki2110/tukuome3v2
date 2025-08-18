
'use server';

import { getTagsByName } from '@/lib/services';
import { Tag } from '@/app/model/model';

// scripts/generateGemmaData.tsから移植
interface TagNode extends Tag {
  children: TagNode[];
  isSelectable: boolean;
}

// scripts/generateGemmaData.tsから移植
const buildTagTree = (tags: Tag[]): TagNode[] => {
  const nodes: Record<string, TagNode> = {};
  const rootNodes: TagNode[] = [];

  tags.forEach(tag => {
    nodes[tag.name] = { ...tag, children: [], isSelectable: true };
  });

  tags.forEach(tag => {
    const currentNode = nodes[tag.name];
    const potentialParentName = tag.name.substring(0, tag.name.length - tag.dispname.length);

    if (potentialParentName && nodes[potentialParentName]) {
      const parentNode = nodes[potentialParentName];
      parentNode.children.push(currentNode);
      parentNode.isSelectable = false;
    } else {
      rootNodes.push(currentNode);
    }
  });

  const finalRootNodes = rootNodes.filter(node => 
    !Object.values(nodes).some(otherNode => otherNode.children.includes(node))
  );

  Object.values(nodes).forEach(node => {
    node.children.sort((a, b) => a.id - b.id);
  });

  return finalRootNodes.sort((a, b) => a.id - b.id);
};

// scripts/generateGemmaData.tsから移植・改造
async function getSelectableTags(pattern: string): Promise<string[]> {
  const tags = await getTagsByName(pattern);
  const tagTree = buildTagTree(tags);

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
  traverseAndCollect(tagTree);
  return selectableNames;
}

// LLMからの期待される回答の型
interface LlmResponse {
  "レシピ分類": "主菜" | "副菜" | "その他";
  "主材料": string[];
  "カテゴリ": string;
}

// アプリケーションで利用する形式の型
export interface ParsedLlmOutput {
  isMain: boolean;
  isSub: boolean;
  tags: string[];
}

/**
 * LLMへのプロンプトを生成する
 */
async function generatePromptForGemma(title: string, ingredients: string[]): Promise<string> {
  const selectableMainIngredientTags = await getSelectableTags('素材別%');
  const selectableCategoryTags = await getSelectableTags('料理%');

  const ingredientText = ingredients.join(' ');
  const recipeBodyText = `(title)${title} (ingredientText)${ingredientText}`;

  const mainIngredientsForPrompt = selectableMainIngredientTags.map(tag => tag.replace(/^素材別/, '')).join(', ');
  const categoriesForPrompt = selectableCategoryTags.map(tag => tag.replace(/^料理/, '')).join(', ');

  const prompt = `以下のレシピの分類を行ってください。

[レシピ本文]
${recipeBodyText}
[回答]
`;
  return prompt;
}

/**
 * LLMからの応答を解析し、アプリケーションで使える形式に変換する
 */
function parseLlmResponse(response: LlmResponse): ParsedLlmOutput {
  const { "レシピ分類": recipeClassification, "主材料": mainIngredients, "カテゴリ": category } = response;

  const isMain = recipeClassification === '主菜';
  const isSub = recipeClassification === '副菜';

  const mainIngredientTags = mainIngredients.map(name => `素材別${name}`);
  const categoryTag = category ? [`料理${category}`] : [];
  
  const tags = [...mainIngredientTags, ...categoryTag];

  return { isMain, isSub, tags };
}


/**
 * レシピ情報からLLMに問い合わせ、タグ情報を取得する
 */
export async function getTagsFromLlm(title: string, ingredients: string[]): Promise<ParsedLlmOutput> {
  const prompt = await generatePromptForGemma(title, ingredients);

  // TODO: ここで実際にGemma 2Bモデルを呼び出す
  // const llmApiEndpoint = process.env.GEMMA_API_ENDPOINT;
  // const response = await fetch(llmApiEndpoint, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  -  //   body: JSON.stringify({ prompt })
  // });
  // const rawLlmResponse: LlmResponse = await response.json();
  
  // --- ダミーレスポンス ---
  console.warn("LLM call is currently disabled. Returning dummy data.");
  const dummyResponse: LlmResponse = {
    //"レシピ分類": "主菜",
    //"主材料": ["お肉豚肉薄切り肉", "野菜玉ねぎ"],
    //"カテゴリ": "おかず中華料理青椒肉絲"
    "レシピ分類": "その他",
    "主材料": [""],
    "カテゴリ": ""
  };
  // --- ダミーレスポンスここまで ---

  const parsedOutput = parseLlmResponse(dummyResponse);
  
  return parsedOutput;
}
