import * as fs from 'fs';
import * as path from 'path';

// .env.localから環境変数を読み込む
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length === 2) {
      let value = parts[1].trim();
      // Remove surrounding quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[parts[0].trim()] = value;
    }
  });
}

import { scrapeUrl, RecipeInfo } from '@/lib/scraper';
import { Tag, Repo, RawRepo } from '@/app/model/model';
import { sql } from '@vercel/postgres';

// 固定のユーザーID
const USER_ID = 'tonkati';

// --- lib/db.ts からコピーした関数 --- //

function getModeWhereClause(mode: string): string {
  switch (mode) {
    case 'main_dish':
      return 'AND isMain = 1';
    case 'sub_dish':
      return 'AND isSub = 1';
    case 'others':
      return 'AND (isMain = 0 AND isSub = 0)';
    default:
      return '';
  }
}

function getRankWhereClause(rank: string): string {
  switch (rank) {
    case '1':
      return 'AND rank = 1';
    case '2':
      return 'AND rank = 2';
    case 'all':
    default:
      return '';
  }
}

function getUntaggedWhereClause(tagMode: string): string {
  switch (tagMode) {
    case 'untaged':
      return 'AND (length(tag) = 0 OR tag IS NULL)';
    default:
      return '';
  }
}

function processRepoRows(rows: RawRepo[]): Repo[] {
  return rows.map(row => ({
    ...row,
    tags: row.tag ? row.tag.split(' ') : [],
  }));
}

async function getRepos(userId: string, limit: number, offset: number, mode: string, rank: string, sort: string, tagMode?: string): Promise<{ repos: Repo[], hasMore: boolean }> {
  const modeWhereClause = getModeWhereClause(mode);
  const rankWhereClause = getRankWhereClause(rank);
  const untaggedWhereClause = getUntaggedWhereClause(tagMode || '');
  const query = `
    SELECT
      *,
      EXISTS (
        SELECT 1
        FROM folder
        WHERE userid = $1 AND ' ' || idofrepos || ' ' LIKE '%' || repo.id_n || '%'
      ) as foldered
    FROM repo
    WHERE userid = $1 ${modeWhereClause} ${rankWhereClause} ${untaggedWhereClause}
    ORDER BY reposu_n ${sort}, id_n DESC
    LIMIT $2 OFFSET $3;
  `;
  const { rows } = await sql.query(query, [userId, limit, offset]);

  const hasMore = rows.length === limit;

  return { repos: processRepoRows(rows as RawRepo[]), hasMore };
}

async function getTagsByNamePattern(userId: string, pattern: string): Promise<Tag[]> {
  const { rows } = await sql<Tag>`
    SELECT id, name, dispname, level
    FROM tag
    WHERE userid = ${userId} AND name LIKE ${pattern}
    ORDER BY level, id;
  `;
  return rows;
}

// --- lib/db.ts からコピーした関数 ここまで --- //

// TagNodeインターフェースを定義（TagSelectionGroupから再利用のためにコピー）
interface TagNode extends Tag {
  children: TagNode[];
  isSelectable: boolean; // リーフノード（子を持たないノード）の場合はtrue
}

// 階層的なタグツリーを構築するヘルパー関数（TagSelectionGroupから再利用のためにコピー）
const buildTagTree = (tags: Tag[], pattern: string): TagNode[] => {
  const nodes: Record<string, TagNode> = {};
  const rootNodes: TagNode[] = [];
  const patternBase = pattern.replace(/%/g, ''); // 例: "素材別" または "料理"

  // 最初のパス: すべてのノードを作成し、完全な名前でマップ
  tags.forEach(tag => {
    nodes[tag.name] = { ...tag, children: [], isSelectable: true };
  });

  // 2番目のパス: 階層を構築
  tags.forEach(tag => {
    const currentNode = nodes[tag.name];

    // 現在のタグのdispnameを完全な名前から削除して、潜在的な親の名前を決定
    // dispnameが名前の最後の部分であると仮定
    const potentialParentName = tag.name.substring(0, tag.name.length - tag.dispname.length);

    // 潜在的な親が存在し、ノードマップにある場合
    if (potentialParentName && nodes[potentialParentName]) {
      const parentNode = nodes[potentialParentName];
      parentNode.children.push(currentNode);
      parentNode.isSelectable = false; // 子を持つノードはそれ自体が選択可能ではない
    } else {
      // 親が見つからない場合、それは潜在的なルートノード
      // patternBaseで始まり、他のノードの子ではない場合にのみrootNodesに追加
      // (このフィルタリングは3番目のパスで行われる)
      rootNodes.push(currentNode);
    }
  });

  // 3番目のパス: 他のノードの子であるノードをフィルタリングし、パターンに一致することを確認
  const finalRootNodes = rootNodes.filter(node => {
    // ノードが他のノードの子ではなく、かつパターンに一致する場合、真のルートノード
    const isChildOfAnotherNode = Object.values(nodes).some(otherNode =>
      otherNode.children.includes(node)
    );
    return !isChildOfAnotherNode && node.name.startsWith(patternBase);
  });

  // 一貫した表示のために子をソート
  Object.values(nodes).forEach(node => {
    node.children.sort((a, b) => a.id - b.id);
  });

  // 最終的なルートノードをソート
  return finalRootNodes.sort((a, b) => a.id - b.id);
};

// パターンに基づいて選択可能なすべてのタグ名を取得する新しい関数
async function getSelectableTags(pattern: string): Promise<string[]> {
  // getTagsByNamePattern を直接呼び出す
  const tags = await getTagsByNamePattern(USER_ID, pattern);
  const patternBase = pattern.replace(/%/g, '');
  const tagTree = buildTagTree(tags, patternBase);

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

async function generateGemmaTrainingData() {
  const limit = 10; // 最初の10件でテスト
  const offset = 0;

  console.log('レシピを取得中...');
  const { repos } = await getRepos(USER_ID, limit, offset, 'all', 'all', 'desc', '');

  console.log('選択可能な主材料タグを取得中...');
  const selectableMainIngredientTags = await getSelectableTags('素材別%');
  console.log('選択可能な主材料タグ:', selectableMainIngredientTags);

  console.log('選択可能なカテゴリタグを取得中...');
  const selectableCategoryTags = await getSelectableTags('料理%');
  console.log('選択可能なカテゴリタグ:', selectableCategoryTags);

  const trainingData: { text: string; label: string }[] = [];

  for (const repo of repos) {
    // タグが未設定の場合はスキップ
    if (!repo.tags || repo.tags.length === 0) {
      console.log(`レシピ ${repo.id_n} はタグがないためスキップします。`);
      continue;
    }

    console.log(`レシピ ${repo.id_n}: ${repo.title} を処理中`);

    // レシピ本文のスクレイピング
    let recipeBodyText = '';
    try {
      const scrapeResult = await scrapeUrl(`https://cookpad.com/jp/recipes/${repo.id_n}`);
      const title = scrapeResult.recipeInfo.title;
      const ingredients = scrapeResult.recipeInfo.ingredients?.join(' ') || '';
      recipeBodyText = `(title)${title} (ingredientText)${ingredients}
`;
    } catch (error) {
      console.error(`レシピ ${repo.id_n} のスクレイピングに失敗しました:`, error);
      continue; // スクレイピング失敗時はスキップ
    }

    // レシピ分類の決定
    let recipeClassification: string;
    if (repo.ismain === 1) {
      recipeClassification = '主菜';
    } else if (repo.issub === 1) {
      recipeClassification = '副菜';
    } else {
      recipeClassification = 'その他';
    }

    // 主材料の抽出
    const mainIngredients = repo.tags
      .filter(tag => tag.startsWith('素材別') && selectableMainIngredientTags.includes(tag))
      .map(tag => tag.replace(/^素材別/, '')); // "素材別"プレフィックスを削除

    // カテゴリの抽出 (最初の1つのみ)
    const categories = repo.tags
      .filter(tag => tag.startsWith('料理') && selectableCategoryTags.includes(tag))
      .map(tag => tag.replace(/^料理/, '')); // "料理"プレフィックスを削除
    const category = categories.length > 0 ? categories[0] : '';

    // label JSONの構築
    const labelObject = {
      "レシピ分類": recipeClassification,
      "主材料": mainIngredients,
      "カテゴリ": category,
    };
    const labelString = JSON.stringify(labelObject);

    // text文字列の構築
    const textString = `以下のレシピの分類を行ってください。

n[選択肢]
n- レシピ分類：主菜, 副菜, その他
n- 主材料：${selectableMainIngredientTags.map(tag => tag.replace(/^素材別/, '')).join(', ')}
n- カテゴリ：${selectableCategoryTags.map(tag => tag.replace(/^料理/, '')).join(', ')}

[レシピ本文]
${recipeBodyText}
[回答]
${labelString}`;

    trainingData.push({ text: textString, label: labelString });

    if (trainingData.length >= limit) {
      break;
    }
  }

  const outputPath = path.join(process.cwd(), 'public', 'me2gemini', 'learn.json');

  // public/me2gemini ディレクトリが存在しない場合は作成
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileStream = fs.createWriteStream(outputPath);
  trainingData.forEach(data => {
    fileStream.write(JSON.stringify(data) + '\n');
  });
  fileStream.end();

  console.log(`${trainingData.length}件の学習データを${outputPath}に生成しました。`);
}

generateGemmaTrainingData().catch(console.error);
