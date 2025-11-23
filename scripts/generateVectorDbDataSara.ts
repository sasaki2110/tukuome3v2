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

import { Tag, Repo, RawRepo } from '@/app/model/model';
import { sql } from '@vercel/postgres';

// 固定のユーザーID
const USER_ID = 'sara';

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
    ingredients: row.ingredients ?? undefined, // nullをundefinedに変換
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

// ベクトルDB用の新フォーマットの型定義
interface VectorDbRecipe {
  id: string;
  title: string;
  category: 'main' | 'sub' | 'soup' | 'other';
  category_detail: string;
  ingredients: string[];
  main_ingredients: string[];
  url: string;
}

async function generateVectorDbData() {
  const limit = 100;
  let offset = 0;
  let hasMore = true;
  const allRepos: Repo[] = []; // 全てのレシピを格納する配列

  console.log('レシピを取得中...');
 
  while (hasMore) {
    const { repos, hasMore: newHasMore } = await getRepos(USER_ID, limit, offset, 'all', 'all', 'desc', '');
    allRepos.push(...repos);
    hasMore = newHasMore;
    offset += limit;
    console.log(`${allRepos.length}件取得済み...`);
  }

  console.log('選択可能な主材料タグを取得中...');
  const selectableMainIngredientTags = await getSelectableTags('素材別%');
  console.log('選択可能な主材料タグ:', selectableMainIngredientTags);

  console.log('選択可能なカテゴリタグを取得中...');
  const selectableCategoryTags = await getSelectableTags('料理%');
  console.log('選択可能なカテゴリタグ:', selectableCategoryTags);

  const vectorDbData: VectorDbRecipe[] = [];

  for (const repo of allRepos) {
    // タグが未設定の場合はスキップ
    if (!repo.tags || repo.tags.length === 0) {
      console.log(`レシピ ${repo.id_n} はタグがないためスキップします。`);
      continue;
    }

    // 材料情報が存在しない場合はスキップ
    if (!repo.ingredients || repo.ingredients.length === 0) {
      console.log(`レシピ ${repo.id_n} は材料情報がないためスキップします。`);
      continue;
    }

    console.log(`レシピ ${repo.id_n}: ${repo.title} を処理中`);

    // 主材料の抽出
    const mainIngredients = repo.tags
      .filter(tag => tag.startsWith('素材別') && selectableMainIngredientTags.includes(tag))
      .map(tag => tag.replace(/^素材別/, '')); // "素材別"プレフィックスを削除

    // カテゴリ詳細の抽出 (最初の1つのみ)
    const categories = repo.tags
      .filter(tag => tag.startsWith('料理') && selectableCategoryTags.includes(tag))
      .map(tag => tag.replace(/^料理/, '')); // "料理"プレフィックスを削除
    const categoryDetail = categories.length > 0 ? categories[0] : '';

    // カテゴリ分類の決定
    let category: 'main' | 'sub' | 'soup' | 'other';
    // category_detailが「汁もの」で始まる場合はsoup
    if (categoryDetail.startsWith('汁もの')) {
      category = 'soup';
    } else if (repo.ismain === 1) {
      category = 'main';
    } else if (repo.issub === 1) {
      category = 'sub';
    } else {
      category = 'other';
    }

    // URLの生成
    const url = `https://cookpad.com/jp/recipes/${repo.id_n}`;

    // タイトルから「by 作者名」を除去
    const rawTitle = repo.title || '';
    const title = rawTitle.includes(' by ') 
      ? rawTitle.split(' by ')[0].trim() 
      : rawTitle.trim();

    // ベクトルDB用の新フォーマットに変換
    const vectorDbRecipe: VectorDbRecipe = {
      id: String(repo.id_n),
      title: title,
      category: category,
      category_detail: categoryDetail,
      ingredients: repo.ingredients, // 調味料除外はベクトルDB作成時に行う
      main_ingredients: mainIngredients.length > 0 ? mainIngredients : [''], // 空の場合は空文字列の配列
      url: url
    };

    vectorDbData.push(vectorDbRecipe);
    console.log(`  ベクトルDBデータ追加済み: ${vectorDbData.length}件`);
  }

  const outputPath = path.join(process.cwd(), 'public', 'me2gemini', 'vector_data_sara.json');

  // public/me2gemini ディレクトリが存在しない場合は作成
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // JSON配列形式で出力（見やすく整形）
  const content = JSON.stringify(vectorDbData, null, 2) + '\n';
  fs.writeFileSync(outputPath, content, 'utf8');

  console.log(`${vectorDbData.length}件のベクトルDBデータを${outputPath}に生成しました。`);
}

generateVectorDbData().catch(console.error);

