import * as cheerio from 'cheerio';

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

function domToSerializable(element: cheerio.Element): SerializableNode {
  if (element.type === 'text') {
    const textContent = element.data?.trim();
    if (!textContent) return null;
    return { type: 'text', content: textContent };
  }

  if (element.type === 'tag') {
    const children = element.children
      .map((child: cheerio.Element) => domToSerializable(child))
      .filter(child => child !== null) as (SerializableElement | SerializableText)[];

    const attributes = element.attribs;
    const hasAttributes = Object.keys(attributes).length > 0;

    return {
      type: 'tag',
      tag: element.tagName,
      attributes: hasAttributes ? attributes : undefined,
      children: children.length > 0 ? children : undefined,
    };
  }

  return null;
}

export interface RecipeInfo {
  title: string;
  tsukurepo: string;
  image: string;
  author: string;
  recipeid: string;
  ingredients?: string[];
}

function extractRecipeInfo(dom: SerializableNode): RecipeInfo {
  let title = '';
  let tsukurepo = '';
  let image = '';
  let author = '';
  let recipeid = '';
  const ingredients: string[] = []; // 材料リストを格納する配列

  const findText = (node: SerializableNode): string => {
    if (!node) return '';
    if (node.type === 'text') return node.content || '';
    if (node.type ==='tag' && node.children) {
      return node.children.map(findText).join('');
    }
    return '';
  };

  const traverse = (node: SerializableNode) => {
    if (!node) return;

    if (node.type === 'tag') {
      // 1. タイトル
      if (node.attributes?.id === 'header--recipe-title') {
        const firstDiv = node.children?.find((child) => (child as SerializableElement).tag === 'div');
        if (firstDiv) {
          title = findText(firstDiv);
        }
      }

      // 2. つくれぽ数
      if (node.attributes?.['data-cooksnapped-count-cooksnaps-count-value']) {
        tsukurepo = node.attributes['data-cooksnapped-count-cooksnaps-count-value'];
      }

      // 3. イメージ
      if (node.tag === 'picture' && !image) {
        const img = node.children?.find((child) => (child as SerializableElement).tag === 'img');
        if (img && (img as SerializableElement).attributes?.src) {
          image = (img as SerializableElement).attributes!.src!;
        }
      }
      
      // 4. 作者
      if (!author && node.tag === 'img' && node.attributes?.src?.startsWith('https://img-global-jp.cpcdn.com/users/')) {
          if(node.attributes?.title){
              author = node.attributes.title;
          }
      }

      // 5. レシピID
      if (node.tag === 'button' && node.attributes?.['data-clipboard-target'] === 'button' && node.attributes?.['data-action'] === 'clipboard#copy') {
        const text = findText(node);
        if (text.includes('レシピID:')) {
          recipeid = text.replace('レシピID:', '').trim();
        }
      }

      // 6. 材料
      if (node.tag === 'li' && node.attributes?.class?.includes('justified-quantity-and-name')) {
        const ingredientText = findText(node).replace(/\s+/g, ' ').trim();
        if (ingredientText) {
          ingredients.push(ingredientText);
        }
      }
    }

    if (node.type === 'tag' && node.children) {
      node.children.forEach(traverse);
    }
  };

  traverse(dom);

  return { title, tsukurepo, image, author, recipeid, ingredients };
}

export async function scrapeUrl(url: string) {
  // URLからHTMLを取得
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.statusText}`);
  }
  const html = await response.text();

  // CheerioでHTMLをロード
  const $ = cheerio.load(html);
  const rootElement = $('body').get(0);

  if (!rootElement) {
    throw new Error('Could not find body element');
  }

  // DOMをシリアライズ可能なオブジェクトに変換
  const dom = domToSerializable(rootElement);
  
  // 情報を抽出
  const recipeInfo = extractRecipeInfo(dom);

  return { dom, recipeInfo };
}