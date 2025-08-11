'use server';

import { scrapeUrl, RecipeInfo } from '@/lib/scraper';
import { z } from 'zod';
import { getTagsByName } from '@/lib/services'; // Import getTagsByName
import { Tag } from '@/app/model/model'; // Import Tag

// Define a recursive TagNode interface (copied from TagSelectionGroup for reuse)
interface TagNode extends Tag {
  children: TagNode[];
  isSelectable: boolean; // True if it's a leaf node (no children)
}

// Helper function to build the hierarchical tag tree (copied from TagSelectionGroup for reuse)
const buildTagTree = (tags: Tag[], pattern: string): TagNode[] => {
  const nodes: Record<string, TagNode> = {};
  const rootNodes: TagNode[] = [];
  const patternBase = pattern.replace(/%/g, ''); // e.g., "素材別" or "料理"

  // First pass: Create all nodes and map them by their full name
  tags.forEach(tag => {
    nodes[tag.name] = { ...tag, children: [], isSelectable: true };
  });

  // Second pass: Build the hierarchy
  tags.forEach(tag => {
    const currentNode = nodes[tag.name];

    // Determine potential parent name by removing the current tag's dispname from its full name
    // This assumes dispname is the last part of the name
    const potentialParentName = tag.name.substring(0, tag.name.length - tag.dispname.length);

    // If a potential parent exists and is in our nodes map
    if (potentialParentName && nodes[potentialParentName]) {
      const parentNode = nodes[potentialParentName];
      parentNode.children.push(currentNode);
      parentNode.isSelectable = false; // A node with children is not selectable itself
    } else {
      // If no parent found, it's a potential root node.
      // Only add to rootNodes if it starts with the patternBase and is not a child of another node
      // (This filtering will be done in the third pass)
      rootNodes.push(currentNode);
    }
  });

  // Third pass: Filter out nodes that are children of other nodes, and ensure they match the pattern
  const finalRootNodes = rootNodes.filter(node => {
    // A node is a true root if it's not a child of any other node AND it matches the pattern
    const isChildOfAnotherNode = Object.values(nodes).some(otherNode =>
      otherNode.children.includes(node)
    );
    return !isChildOfAnotherNode && node.name.startsWith(patternBase);
  });

  // Sort children for consistent display
  Object.values(nodes).forEach(node => {
    node.children.sort((a, b) => a.id - b.id);
  });

  // Sort final root nodes
  return finalRootNodes.sort((a, b) => a.id - b.id);
};

// New function to get all selectable tag names
export async function getAllSelectableTagNames(): Promise<string[]> {
  const mainIngredientTags = await getTagsByName("素材別%");
  const categoryTags = await getTagsByName("料理%");

  const allTags = [...mainIngredientTags, ...categoryTags];

  // Build a combined tree and extract selectable nodes
  const combinedTree = buildTagTree(allTags, ""); // Use empty pattern to get all roots

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

interface SerializableText {
  type: 'text';
  content: string;
}

interface SerializableElement {
  type: 'tag';
  tag: string;
  attributes?: { [key: string]: string };
  children?: (SerializableElement | SerializableText)[];
}

type SerializableNode = SerializableElement | SerializableText | null;

// Helper function to convert the custom DOM object to a flat text string
function domToText(node: SerializableNode): string {
  if (!node) return '';
  if (node.type === 'text') return node.content || '';
  if (node.type === 'tag' && node.children) {
    return node.children.map(domToText).join(' ');
  }
  return '';
}

// Zod schema for the LLM output, based on the user-provided sample
const createLLMSchema = (mainIngredientTags: string[], categoryTags: string[]) => {
    // Ensure tags are not empty, otherwise Zod throws an error.
    const safeMainIngredientTags = mainIngredientTags.length > 0 ? mainIngredientTags : ["dummy_ingredient"];
    const safeCategoryTags = categoryTags.length > 0 ? categoryTags : ["dummy_category"];

    return z.object({
        recipe_type: z.enum(["main_dish", "side_dish", "other"]),
        main_ingredients: z.array(z.enum(safeMainIngredientTags as [string, ...string[]])),
        categories: z.array(z.enum(safeCategoryTags as [string, ...string[]])),
    });
};


type LLMOutput = z.infer<ReturnType<typeof createLLMSchema>>;

// Actual LLM call using Gemini API
async function callLLM(
    textContent: string,
    mainIngredientTags: string[],
    categoryTags: string[]
): Promise<LLMOutput> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }

  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent";
//  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  const headers = {
    "Content-Type": "application/json",
  };

  // Dynamically create LLMSchema based on provided tags
  const currentLLMSchema = createLLMSchema(mainIngredientTags, categoryTags);

  const prompt = `
    以下のレシピのテキストから、レシピの種類、主材料、カテゴリをJSON形式で抽出してください。
    レシピの種類は「main_dish」（例: カレー、ハンバーグ）、「side_dish」（例: サラダ、和え物）、「other」（例: 焼きそば、パスタ、丼物など、一品で完結する料理）のいずれかです。
    主材料とカテゴリは、提供されたタグのリストから厳密に選択し、その完全な名前（例: "素材別お肉牛肉"）でリストしてください。最も具体的なタグのみをリストしてください。親タグや抽象的なタグ（例: "料理"、"素材別"）は含めないでください。
    
    利用可能な主材料タグ:
    ${JSON.stringify(mainIngredientTags, null, 2)}

    利用可能なカテゴリタグ:
    ${JSON.stringify(categoryTags, null, 2)}

    JSONスキーマは以下の通りです。

    
    ${JSON.stringify(currentLLMSchema.shape, null, 2)}
    

    レシピテキスト:
    ${textContent}
  `;

  const body = JSON.stringify({
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  

  try {
    const response = await fetch(`${endpoint}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: headers,
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error: ${response.status} - ${errorText}`);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Gemini API Raw Response:", data);

    // Assuming the response structure is data.candidates[0].content.parts[0].text
    const llmResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!llmResponseText) {
      throw new Error("Invalid response format from Gemini API: missing text content.");
    }

    // Parse the JSON string returned by the LLM
    const parsedOutput = JSON.parse(llmResponseText);

    // Validate with Zod schema
    const validatedOutput = currentLLMSchema.parse(parsedOutput);
    console.log("Gemini LLM Validated Output:", validatedOutput);

    return validatedOutput;

  } catch (error) {
    console.error("Error calling Gemini LLM:", error);
    // Fallback to dummy data or re-throw based on desired error handling
    return {
      recipe_type: "other",
      main_ingredients: [],
      categories: [],
    };
    // throw error; // Uncomment to re-throw and propagate error
  }
}

export interface RecipeDetails {
  scrapedInfo: RecipeInfo;
  llmOutput: LLMOutput;
}

export async function getRecipeDetailsFromUrl(recipeNumber: string): Promise<RecipeDetails | null> {
  if (!recipeNumber || !/^[0-9]+$/.test(recipeNumber)) {
    console.error("Invalid recipe number");
    return null;
  }

  const url = `https://cookpad.com/jp/recipes/${recipeNumber}`;

  try {
    const scrapeResult = await scrapeUrl(url);
    if (!scrapeResult) {
      return null;
    }

    const { dom, recipeInfo } = scrapeResult;

    // Convert the DOM to text for the LLM
    const textContent = domToText(dom);

    // Get all selectable main ingredient tags and category tags
    const mainIngredientTags = await getTagsByName("素材別%");
    const categoryTags = await getTagsByName("料理%");

    const mainIngredientTagNames = mainIngredientTags.map(tag => tag.name);
    const categoryTagNames = categoryTags.map(tag => tag.name);

    

    // Call the LLM to get structured data
    const llmOutput = await callLLM(textContent, mainIngredientTagNames, categoryTagNames);

    return {
      scrapedInfo: recipeInfo,
      llmOutput: llmOutput,
    };
  } catch (error) {
    console.error(`Failed to process recipe ${recipeNumber}:`, error);
    return null;
  }
}