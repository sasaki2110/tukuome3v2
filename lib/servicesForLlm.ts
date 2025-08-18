'use server';

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
  const ingredientText = ingredients.join(' ');
  const recipeBodyText = `(title)${title} (ingredientText)${ingredientText}`;

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

  const llmApiEndpoint = process.env.GEMMA_API_ENDPOINT || 'http://nvicuda:8000/generate';

  try {
    const response = await fetch(llmApiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("APIエラー:", errorData.error);
      throw new Error(`API error: ${errorData.error}`);
    }

    const data = await response.json();
    
    // data.responseがJSON文字列で返ってくる場合を考慮
    const rawLlmResponse: LlmResponse = typeof data.response === 'string' 
      ? JSON.parse(data.response) 
      : data.response;

    const parsedOutput = parseLlmResponse(rawLlmResponse);
    return parsedOutput;

  } catch (error) {
    console.error("LLM呼び出し中にエラーが発生しました:", error);
    // エラー発生時はデフォルトの値を返す
    const errorResponse: LlmResponse = {
      "レシピ分類": "その他",
      "主材料": [""],
      "カテゴリ": ""
    };
    return parseLlmResponse(errorResponse);
  }
}