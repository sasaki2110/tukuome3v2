import * as cheerio from 'cheerio';

// @ts-ignore
function domToSerializable(element: cheerio.Element): any {
  if (element.type === 'text') {
    const textContent = element.data?.trim();
    if (!textContent) return null;
    return { type: 'text', content: textContent };
  }

  if (element.type === 'tag') {
    const children = element.children
      // @ts-ignore
      .map((child: cheerio.Element) => domToSerializable(child))
      .filter(child => child !== null);

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
}

function extractRecipeInfo(dom: any): RecipeInfo {
  let title = '';
  let tsukurepo = '';
  let image = '';
  let author = '';

  const findText = (node: any): string => {
    if (!node) return '';
    if (node.type === 'text') return node.content || '';
    if (node.children) {
      return node.children.map(findText).join('');
    }
    return '';
  };

  const traverse = (node: any) => {
    if (!node) return;

    if (node.type === 'tag') {
      // 1. タイトル
      if (node.attributes?.id === 'header--recipe-title') {
        const firstDiv = node.children?.find((child: any) => child.tag === 'div');
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
        const img = node.children?.find((child: any) => child.tag === 'img');
        if (img?.attributes?.src) {
          image = img.attributes.src;
        }
      }
      
      // 4. 作者
      if (!author && node.tag === 'img' && node.attributes?.src?.startsWith('https://img-global-jp.cpcdn.com/users/')) {
          if(node.attributes?.title){
              author = node.attributes.title;
          }
      }
    }

    if (node.children) {
      node.children.forEach(traverse);
    }
  };

  traverse(dom);

  return { title, tsukurepo, image, author };
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
