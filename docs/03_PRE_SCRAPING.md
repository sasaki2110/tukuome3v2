# つくおめ側 事前スクレイピング開発ドキュメント

## 1. 概要

本ドキュメントは、つくおめ側における主材料の事前スクレイピング機能の実装詳細を記載します。

### 1.1 目的

レシピ追加時に毎回スクレイピングするのではなく、主材料を事前にDBに保存しておくことで、以下のメリットを実現します：

- レシピ追加時の処理速度向上（材料情報の再取得が不要）
- 材料情報の永続化（スクレイピング元の情報が変更されても保持）
- 材料情報を活用した検索・フィルタリング機能の拡張可能性

### 1.2 対象範囲

- **対象**: つくおめ（管理アプリ）のみ
- **対象外**: レノちゃん（新アプリ）では材料情報は不要のため、本機能は実装しません

### 1.3 参考資料

- `02_SOLUTION_DESIGN.md` 4.4節「主材料の事前スクレイピング設計」
- `01_REQUIREMENTS.md` 5.6節「スクレイピング機能」

---

## 2. 現状の確認

### 2.1 現在の実装状況

#### 2.1.1 スクレイピング機能
- **実装済み**: `lib/scraper.ts` の `extractRecipeInfo()` 関数で材料情報を取得
- **取得方法**: `li.justified-quantity-and-name` から材料リストを抽出
- **データ形式**: `string[]` 配列として取得

#### 2.1.2 データベーススキーマ
- **現状**: `repo`テーブルに材料情報を格納するカラムが存在しない
- **現在のカラム**: `userid`, `id_n`, `image`, `title`, `rank`, `reposu_n`, `comment`, `tag`, `ismain`, `issub`

#### 2.1.3 レシピ追加・更新処理
- **実装済み**: `lib/db.ts` の `insertRecipe()`, `updateRecipe()` 関数
- **現状**: 材料情報は取得しているが、DBには保存していない
- **用途**: LLM連携でのタグ自動生成にのみ使用

### 2.2 課題

1. 材料情報がDBに保存されていないため、レシピ追加時に毎回スクレイピングが必要
2. 既存レシピの材料情報が失われている
3. 材料情報を活用した検索・フィルタリング機能が実装できない

---

## 3. 実装内容

### 3.1 データベーススキーマ変更

#### 3.1.1 カラム追加

`repo`テーブルに材料情報を格納するカラムを追加します。

**方式1: JSON形式（推奨）**
```sql
ALTER TABLE repo ADD COLUMN ingredients JSONB;
```

**方式2: TEXT形式（代替案）**
```sql
ALTER TABLE repo ADD COLUMN ingredients_text TEXT;
```

**推奨**: JSON形式（方式1）を推奨します。理由：
- 構造化データとして扱いやすい
- PostgreSQLのJSONB型はインデックス対応
- 将来的な拡張性が高い

#### 3.1.2 データ形式

**JSON形式の場合**:
```json
[
  "鶏もも肉 1枚",
  "玉ねぎ 1個",
  "にんにく 1片",
  "しょうゆ 大さじ2",
  "みりん 大さじ1"
]
```

**TEXT形式の場合**:
```
鶏もも肉 1枚,玉ねぎ 1個,にんにく 1片,しょうゆ 大さじ2,みりん 大さじ1
```

#### 3.1.3 インデックス（オプション）

材料情報を検索対象とする場合は、以下のインデックスを検討：

```sql
-- JSONB型の場合、GINインデックスで全文検索が可能
CREATE INDEX idx_repo_ingredients ON repo USING GIN (ingredients);
```

**注意**: 現時点では材料情報の検索機能は実装しないため、インデックスは後から追加可能です。

---

### 3.2 型定義の更新

#### 3.2.1 `app/model/model.tsx` の更新

`RawRepo` 型と `Repo` 型に材料情報を追加：

```typescript
// レシピ型（DBから取得した生データ）
export type RawRepo = {
    userid: string,
    id_n: number,
    image: string,
    title: string,
    rank: number,
    reposu_n: number,
    comment: string,
    tag: string,
    ismain: number,
    issub: number,
    foldered?: boolean,
    ingredients?: string[] | null, // 追加: JSONB型からパースした配列
}

// レシピ型（アプリケーションで使う型）
export type Repo = {
    userid: string,
    id_n: number,
    image: string,
    title: string,
    rank: number,
    reposu_n: number,
    comment: string,
    tags: string[],
    ismain: number,
    issub: number,
    foldered?: boolean,
    author?: string,
    ingredients?: string[], // 追加
}
```

---

### 3.3 レシピ追加時の材料情報保存

#### 3.3.1 `lib/db.ts` の `insertRecipe()` 関数の更新

材料情報をパラメータに追加し、DBに保存：

```typescript
export async function insertRecipe(
  userId: string,
  recipeData: {
    id_n: number;
    image: string;
    title: string;
    tsukurepo: string;
    tags: string[];
    isMain: number;
    isSub: number;
    ingredients?: string[]; // 追加
  }
): Promise<void> {
  const reposu_n = parseInt(recipeData.tsukurepo, 10) || 0;
  const tagString = recipeData.tags.join(' ');
  
  // 材料情報をJSON形式に変換（nullの場合はNULL）
  const ingredientsJson = recipeData.ingredients && recipeData.ingredients.length > 0
    ? JSON.stringify(recipeData.ingredients)
    : null;

  await sql`
    INSERT INTO repo (
      userid,
      id_n,
      image,
      title,
      rank,
      reposu_n,
      comment,
      tag,
      ismain,
      issub,
      ingredients  -- 追加
    ) VALUES (
      ${userId},
      ${recipeData.id_n},
      ${recipeData.image},
      ${recipeData.title},
      0,
      ${reposu_n},
      '',
      ${tagString},
      ${recipeData.isMain},
      ${recipeData.isSub},
      ${ingredientsJson}::jsonb  -- 追加（JSONB型にキャスト）
    );
  `;
}
```

#### 3.3.2 `lib/services.ts` の `addRecipe()` 関数の更新

材料情報をパラメータに追加：

```typescript
export async function addRecipe(
  recipeData: {
    id_n: number;
    image: string;
    title: string;
    tsukurepo: string;
    tags: string[];
    isMain: number;
    isSub: number;
    ingredients?: string[]; // 追加
  }
): Promise<void> {
  const userId = await getUserIdFromSession();
  await insertRecipe(userId, {
    id_n: recipeData.id_n,
    image: recipeData.image,
    title: recipeData.title,
    tsukurepo: recipeData.tsukurepo,
    tags: recipeData.tags,
    isMain: recipeData.isMain,
    isSub: recipeData.isSub,
    ingredients: recipeData.ingredients, // 追加
  });
}
```

#### 3.3.3 `app/recipes/new/actions.ts` の更新

レシピ追加時に材料情報を渡す：

```typescript
// getRecipeDetailsFromUrl() の戻り値は既に ingredients を含んでいるため変更不要
// ただし、型定義に ingredients が含まれていることを確認
```

#### 3.3.4 `app/components/RecipeForm.tsx` の更新

レシピ追加時に材料情報を渡す：

```typescript
await addRecipe({
  id_n: parseInt(recipeNumber, 10),
  image: scrapedInfo.image,
  title: `${scrapedInfo.title}${scrapedInfo.author ? ' by ' + scrapedInfo.author : ''}`,
  tsukurepo: scrapedInfo.tsukurepo,
  isMain: isMainChecked ? 1 : 0,
  isSub: isSubChecked ? 1 : 0,
  tags: allSelectedTags.map(tag => tag.name),
  ingredients: scrapedInfo.ingredients || [], // 追加
});
```

---

### 3.4 レシピ更新時の材料情報保存

#### 3.4.1 `lib/db.ts` の `updateRecipe()` 関数の更新

材料情報をパラメータに追加し、DBを更新：

```typescript
export async function updateRecipe(
  userId: string,
  recipeData: {
    id_n: number;
    image: string;
    title: string;
    tsukurepo: string;
    tags: string[];
    isMain: number;
    isSub: number;
    ingredients?: string[]; // 追加
  }
): Promise<void> {
  const reposu_n = parseInt(recipeData.tsukurepo, 10) || 0;
  const tagString = recipeData.tags.join(' ');
  
  // 材料情報をJSON形式に変換（nullの場合はNULL）
  const ingredientsJson = recipeData.ingredients && recipeData.ingredients.length > 0
    ? JSON.stringify(recipeData.ingredients)
    : null;

  await sql`
    UPDATE repo SET
      image = ${recipeData.image},
      title = ${recipeData.title},
      reposu_n = ${reposu_n},
      tag = ${tagString},
      ismain = ${recipeData.isMain},
      issub = ${recipeData.isSub},
      ingredients = ${ingredientsJson}::jsonb  -- 追加
    WHERE userid = ${userId} AND id_n = ${recipeData.id_n};
  `;
}
```

#### 3.4.2 `lib/services.ts` の `updateRecipe()` 関数の更新

材料情報をパラメータに追加：

```typescript
export async function updateRecipe(
  recipeData: {
    id_n: number;
    image: string;
    title: string;
    tsukurepo: string;
    tags: string[];
    isMain: number;
    isSub: number;
    ingredients?: string[]; // 追加
  }
): Promise<void> {
  const userId = await getUserIdFromSession();
  await updateRecipeInDb(userId, {
    id_n: recipeData.id_n,
    image: recipeData.image,
    title: recipeData.title,
    tsukurepo: recipeData.tsukurepo,
    tags: recipeData.tags,
    isMain: recipeData.isMain,
    isSub: recipeData.isSub,
    ingredients: recipeData.ingredients, // 追加
  });
}
```

#### 3.4.3 `app/components/RecipeForm.tsx` の更新

レシピ更新時に材料情報を渡す：

```typescript
// 編集モード時の更新処理
await updateRecipe({
  id_n: parseInt(recipeNumber, 10),
  image: scrapedInfo.image,
  title: `${scrapedInfo.title}${scrapedInfo.author ? ' by ' + scrapedInfo.author : ''}`,
  tsukurepo: scrapedInfo.tsukurepo,
  isMain: isMainChecked ? 1 : 0,
  isSub: isSubChecked ? 1 : 0,
  tags: allSelectedTags.map(tag => tag.name),
  ingredients: scrapedInfo.ingredients || [], // 追加
});
```

#### 3.4.4 レシピ変更時のスクレイピング制御フラグ

**設計方針**:
- **レシピ追加時**: スクレイピングは必須（材料情報を取得するため）
- **レシピ変更時**: スクレイピングは原則不要（既にDBに材料情報があるため、高速化）
- **ただし**: レシピ変更時でもスクレイピングを再実行したい場合がある（つくれぽ数の更新、最新情報の取得など）

**実装方法**:

フラグ制御（ハードコーディング）で、レシピ変更時のスクレイピング有無を制御します。

1. **定数の定義**

`app/components/RecipeForm.tsx` または `lib/config.ts` に定数を定義：

```typescript
// レシピ変更時のスクレイピング制御フラグ
// true: レシピ変更時にスクレイピングを実行する
// false: レシピ変更時にスクレイピングを実行しない（DBから材料情報を取得）
const ENABLE_SCRAPING_ON_UPDATE = false; // デフォルトは false（高速化のため）
```

2. **レシピ変更時の処理の修正**

`app/components/RecipeForm.tsx` の編集モード時の初期読み込み処理を修正：

```typescript
// 編集モード時の初期読み込み
useEffect(() => {
  if (isEditMode && recipeId) {
    // 既存レシピ情報を取得
    getRecipeById(parseInt(recipeId, 10)).then(result => {
      if (result.recipes.length > 0) {
        const recipe = result.recipes[0];
        setRecipeNumber(recipe.id_n.toString());
        
        // フラグに応じてスクレイピングを実行するか決定
        if (ENABLE_SCRAPING_ON_UPDATE) {
          // スクレイピングを実行して最新情報を取得
          reScrapeRecipe(recipe.id_n.toString()).then(scrapedInfo => {
            if (scrapedInfo) {
              setRecipeDetails({
                scrapedInfo: scrapedInfo,
                llmOutput: {
                  isMain: recipe.ismain === 1,
                  isSub: recipe.issub === 1,
                  tags: recipe.tags || [],
                },
              });
            }
          });
        } else {
          // DBから取得した材料情報を使用（スクレイピング不要）
          setRecipeDetails({
            scrapedInfo: {
              title: recipe.title.replace(/ by .*$/, ''), // " by 作者名" を除去
              image: recipe.image,
              tsukurepo: recipe.reposu_n.toString(),
              author: recipe.author || '',
              recipeid: recipe.id_n.toString(),
              ingredients: recipe.ingredients || [], // DBから取得した材料情報を使用
            },
            llmOutput: {
              isMain: recipe.ismain === 1,
              isSub: recipe.issub === 1,
              tags: recipe.tags || [],
            },
          });
        }
      }
    });
  }
}, [isEditMode, recipeId]);
```

3. **レシピ更新時の処理の修正**

`handleUpdateRecipe()` 関数を修正：

```typescript
const handleUpdateRecipe = () => {
  if (!recipeDetails) {
    alert('更新するレシピ情報がありません。');
    return;
  }

  startUpdatingTransition(async () => {
    try {
      // フラグに応じて材料情報の取得元を決定
      let ingredients: string[] = [];
      
      if (ENABLE_SCRAPING_ON_UPDATE && scrapedInfo) {
        // スクレイピングで取得した材料情報を使用
        ingredients = scrapedInfo.ingredients || [];
      } else if (recipeDetails.scrapedInfo) {
        // DBから取得した材料情報を使用（スクレイピング未実行の場合）
        ingredients = recipeDetails.scrapedInfo.ingredients || [];
      }

      await updateRecipe({
        id_n: parseInt(recipeNumber, 10),
        image: scrapedInfo?.image || recipeDetails.scrapedInfo?.image || '',
        title: scrapedInfo 
          ? `${scrapedInfo.title}${scrapedInfo.author ? ' by ' + scrapedInfo.author : ''}`
          : recipeDetails.scrapedInfo?.title || '',
        tsukurepo: scrapedInfo?.tsukurepo || recipeDetails.scrapedInfo?.tsukurepo || '0',
        isMain: isMainChecked ? 1 : 0,
        isSub: isSubChecked ? 1 : 0,
        tags: allSelectedTags.map(tag => tag.name),
        ingredients: ingredients, // 材料情報を渡す
      });
      
      // リダイレクト処理...
    } catch (error) {
      console.error('Failed to update recipe:', error);
      alert('レシピの更新に失敗しました。');
    }
  });
};
```

4. **再スクレイピングボタンの保持**

「再読み込み」ボタン（`handleReloadRecipe()`）はそのまま保持し、必要に応じて手動でスクレイピングを実行できるようにします。

**メリット**:
- デフォルトでスクレイピングを無効化することで、レシピ変更時の処理速度が向上
- フラグを `true` に変更するだけで、必要に応じてスクレイピングを有効化可能
- 手動の「再読み込み」ボタンで、必要時のみスクレイピングを実行可能

**注意事項**:
- フラグを `false` に設定した場合、つくれぽ数などの最新情報は取得されません
- 材料情報がDBに存在しない場合（古いレシピなど）、空配列が使用されます
- 必要に応じて、材料情報が空の場合のみスクレイピングを実行する条件分岐を追加することも可能

---

### 3.5 レシピ取得時の材料情報読み込み

#### 3.5.1 `lib/db.ts` のクエリ関数の更新

材料情報を取得し、JSONB型から配列にパース：

```typescript
function processRepoRows(rows: RawRepo[]): Repo[] {
  return rows.map(row => ({
    ...row,
    tags: row.tag ? row.tag.split(' ') : [],
    // 材料情報をJSONB型から配列にパース
    ingredients: row.ingredients 
      ? (typeof row.ingredients === 'string' 
          ? JSON.parse(row.ingredients) 
          : row.ingredients)
      : undefined,
  }));
}
```

**注意**: `@vercel/postgres` の `sql` タグは JSONB型を自動的にパースする可能性があるため、実際の動作を確認してから実装を調整してください。

#### 3.5.2 SQLクエリの更新

すべてのレシピ取得クエリで `ingredients` カラムを取得：

```typescript
// 例: getRepos() 関数
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
// * で取得するため、ingredients カラムも自動的に含まれる
```

---

### 3.6 既存レシピへの材料情報追加（バッチ処理）

#### 3.6.1 バッチ処理スクリプトの作成

`scripts/batchUpdateIngredients.ts` を作成：

```typescript
import { sql } from '@vercel/postgres';
import { scrapeUrl } from '@/lib/scraper';

/**
 * 既存レシピの材料情報を一括更新するバッチ処理（全ユーザー対象）
 * @param limit 処理するレシピの最大件数（デフォルト: 100）
 * @param offset スキップするレシピの件数（デフォルト: 0）
 */
async function batchUpdateIngredients(
  limit: number = 100,
  offset: number = 0
): Promise<void> {
  // 材料情報が未設定のレシピを取得（全ユーザー対象）
  const { rows } = await sql`
    SELECT userid, id_n, title
    FROM repo
    WHERE ingredients IS NULL OR ingredients = '[]'::jsonb
    ORDER BY id_n
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  console.log(`処理対象: ${rows.length} 件`);

  for (const row of rows) {
    const recipeId = row.id_n;
    const userId = row.userid;
    console.log(`処理中: ${recipeId} - ${row.title} (user: ${userId})`);

    try {
      // スクレイピングで材料情報を取得
      const url = `https://cookpad.com/jp/recipes/${recipeId}`;
      const scrapeResult = await scrapeUrl(url);
      
      if (scrapeResult && scrapeResult.recipeInfo.ingredients) {
        const ingredientsJson = JSON.stringify(scrapeResult.recipeInfo.ingredients);
        
        // 材料情報を更新（全ユーザー対象）
        await sql`
          UPDATE repo
          SET ingredients = ${ingredientsJson}::jsonb
          WHERE userid = ${userId} AND id_n = ${recipeId}
        `;
        
        console.log(`  ✓ 更新完了: ${scrapeResult.recipeInfo.ingredients.length} 件の材料`);
      } else {
        console.log(`  ✗ 材料情報が取得できませんでした`);
      }

      // レート制限対策: 1秒待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ✗ エラー: ${error}`);
      // エラーが発生しても処理を続行
    }
  }

  console.log('バッチ処理完了');
}

// 実行例
async function main() {
  const limit = parseInt(process.env.LIMIT || '100', 10);
  const offset = parseInt(process.env.OFFSET || '0', 10);

  await batchUpdateIngredients(limit, offset);
}

if (require.main === module) {
  main().catch(console.error);
}
```

#### 3.6.2 実行方法

```bash
# 環境変数を設定して実行（全ユーザー対象）
LIMIT=100 OFFSET=0 npm run tsx scripts/batchUpdateIngredients.ts

# または、package.jsonにスクリプトを追加
npm run batch-update-ingredients
```

---

### 3.7 定期的な材料情報更新（バッチ処理）

#### 3.7.1 更新スクリプトの作成

`scripts/batchRefreshIngredients.ts` を作成：

```typescript
import { sql } from '@vercel/postgres';
import { scrapeUrl } from '@/lib/scraper';

/**
 * 既存レシピの材料情報とつくれぽ数を定期的に更新するバッチ処理（全ユーザー対象）
 * @param limit 処理するレシピの最大件数（デフォルト: 100）
 * @param offset スキップするレシピの件数（デフォルト: 0）
 */
async function batchRefreshIngredients(
  limit: number = 100,
  offset: number = 0
): Promise<void> {
  // 材料情報が未設定または空のレシピを取得（全ユーザー対象）
  const { rows } = await sql`
    SELECT userid, id_n, title, reposu_n
    FROM repo
    WHERE ingredients IS NULL OR ingredients = '[]'::jsonb
    ORDER BY id_n
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  console.log(`処理対象: ${rows.length} 件`);

  for (const row of rows) {
    const recipeId = row.id_n;
    const userId = row.userid;
    console.log(`処理中: ${recipeId} - ${row.title} (user: ${userId})`);

    try {
      // スクレイピングで最新情報を取得
      const url = `https://cookpad.com/jp/recipes/${recipeId}`;
      const scrapeResult = await scrapeUrl(url);
      
      if (scrapeResult && scrapeResult.recipeInfo) {
        const { ingredients, tsukurepo } = scrapeResult.recipeInfo;
        const ingredientsJson = ingredients && ingredients.length > 0
          ? JSON.stringify(ingredients)
          : null;
        
        // 材料情報とつくれぽ数を更新（全ユーザー対象）
        await sql`
          UPDATE repo
          SET 
            ingredients = COALESCE(${ingredientsJson}::jsonb, ingredients),
            reposu_n = ${parseInt(tsukurepo, 10) || row.reposu_n}
          WHERE userid = ${userId} AND id_n = ${recipeId}
        `;
        
        console.log(`  ✓ 更新完了: 材料 ${ingredients?.length || 0} 件, つくれぽ数 ${tsukurepo}`);
      } else {
        console.log(`  ✗ 情報が取得できませんでした`);
      }

      // レート制限対策: 1秒待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ✗ エラー: ${error}`);
      // エラーが発生しても処理を続行
    }
  }

  console.log('バッチ処理完了');
}

// 実行例
async function main() {
  const limit = parseInt(process.env.LIMIT || '100', 10);
  const offset = parseInt(process.env.OFFSET || '0', 10);

  await batchRefreshIngredients(limit, offset);
}

if (require.main === module) {
  main().catch(console.error);
}
```

#### 3.7.2 定期実行の設定

cron等で定期実行する場合：

```bash
# 毎日午前3時に実行（例、全ユーザー対象）
0 3 * * * cd /path/to/tukuome3v2 && LIMIT=100 OFFSET=0 npm run batch-refresh-ingredients
```

---

## 4. 実装手順

### 4.1 フェーズ1: データベーススキーマ変更

1. **マイグレーションスクリプトの作成**
   - `scripts/migrations/add_ingredients_column.sql` を作成
   - `ALTER TABLE repo ADD COLUMN ingredients JSONB;` を実行

2. **実行**
   ```bash
   # Vercel Postgresのダッシュボードから実行、または
   psql $POSTGRES_URL -f scripts/migrations/add_ingredients_column.sql
   ```

3. **確認**
   - `repo`テーブルに `ingredients` カラムが追加されていることを確認

### 4.2 フェーズ2: 型定義の更新

1. **`app/model/model.tsx` の更新**
   - `RawRepo` 型に `ingredients?: string[] | null` を追加
   - `Repo` 型に `ingredients?: string[]` を追加

2. **型チェック**
   ```bash
   npm run type-check
   ```

### 4.3 フェーズ3: データベース操作関数の更新

1. **`lib/db.ts` の更新**
   - `insertRecipe()` 関数に材料情報の保存処理を追加
   - `updateRecipe()` 関数に材料情報の更新処理を追加
   - `processRepoRows()` 関数に材料情報のパース処理を追加

2. **`lib/services.ts` の更新**
   - `addRecipe()` 関数に材料情報パラメータを追加
   - `updateRecipe()` 関数に材料情報パラメータを追加

### 4.4 フェーズ4: UIコンポーネントの更新

1. **`app/components/RecipeForm.tsx` の更新**
   - レシピ追加時に材料情報を渡す
   - レシピ更新時に材料情報を渡す
   - レシピ変更時のスクレイピング制御フラグを実装
     - `ENABLE_SCRAPING_ON_UPDATE` 定数を定義（デフォルト: `false`）
     - 編集モード時の初期読み込み処理でフラグをチェック
     - フラグが `false` の場合はDBから材料情報を取得
     - フラグが `true` の場合はスクレイピングを実行

2. **動作確認**
   - レシピ追加時に材料情報が保存されることを確認
   - レシピ更新時に材料情報が更新されることを確認
   - レシピ変更時にスクレイピングが実行されないことを確認（フラグが `false` の場合）
   - フラグを `true` に変更して、レシピ変更時にスクレイピングが実行されることを確認

### 4.5 フェーズ5: 既存レシピへの材料情報追加

1. **バッチ処理スクリプトの作成**
   - `scripts/batchUpdateIngredients.ts` を作成

2. **テスト実行**
   ```bash
   LIMIT=10 OFFSET=0 npm run tsx scripts/batchUpdateIngredients.ts
   ```

3. **本番実行**
   - 小規模から開始し、段階的に処理件数を増やす

### 4.6 フェーズ6: 定期更新スクリプトの作成

1. **バッチ処理スクリプトの作成**
   - `scripts/batchRefreshIngredients.ts` を作成

2. **定期実行の設定**
   - cron等で定期実行を設定（オプション）

---

## 5. テスト計画

### 5.1 単体テスト

1. **データベース操作関数のテスト**
   - `insertRecipe()` で材料情報が正しく保存されること
   - `updateRecipe()` で材料情報が正しく更新されること
   - `processRepoRows()` で材料情報が正しくパースされること

2. **スクレイピング関数のテスト**
   - 材料情報が正しく取得されること（既存テストを確認）

### 5.2 統合テスト

1. **レシピ追加フローのテスト**
   - レシピ追加時に材料情報が保存されること
   - 材料情報が空の場合でもエラーが発生しないこと

2. **レシピ更新フローのテスト**
   - レシピ更新時に材料情報が更新されること
   - 材料情報を更新しない場合でも既存データが保持されること
   - フラグが `false` の場合、レシピ変更時にスクレイピングが実行されないこと
   - フラグが `false` の場合、DBから材料情報が正しく取得されること
   - フラグが `true` の場合、レシピ変更時にスクレイピングが実行されること

3. **バッチ処理のテスト**
   - 既存レシピへの材料情報追加が正常に動作すること
   - エラーハンドリングが適切に動作すること

### 5.3 動作確認項目

- [ ] レシピ追加時に材料情報がDBに保存される
- [ ] レシピ更新時に材料情報がDBに更新される
- [ ] レシピ取得時に材料情報が正しく読み込まれる
- [ ] 既存レシピへの材料情報追加が正常に動作する
- [ ] 材料情報が空の場合でもエラーが発生しない
- [ ] バッチ処理が正常に動作する
- [ ] レシピ変更時のスクレイピング制御フラグが正常に動作する（`false` の場合）
- [ ] レシピ変更時のスクレイピング制御フラグが正常に動作する（`true` の場合）

---

## 6. 注意事項

### 6.1 データベースマイグレーション

- **既存データへの影響**: `ingredients` カラムは NULL を許可するため、既存データへの影響はありません
- **ロールバック**: 必要に応じて `ALTER TABLE repo DROP COLUMN ingredients;` でロールバック可能

### 6.2 パフォーマンス

- **JSONB型のサイズ**: 材料情報が大量にある場合、JSONB型のサイズが大きくなる可能性があります
- **インデックス**: 現時点では材料情報の検索機能は実装しないため、インデックスは不要です

### 6.3 エラーハンドリング

- **スクレイピング失敗**: 材料情報の取得に失敗した場合、`ingredients` を NULL または空配列として保存
- **JSONパースエラー**: JSONB型への変換に失敗した場合、エラーログを出力して処理を続行

### 6.4 レート制限

- **スクレイピング**: クックパッドへのアクセス頻度を考慮し、バッチ処理では1秒待機を推奨
- **バッチ処理**: 大量のレシピを処理する場合は、段階的に処理件数を増やす

### 6.5 データ整合性

- **NULL値の扱い**: 材料情報が未設定の場合は NULL を許可
- **空配列の扱い**: 材料情報が空の場合は `[]` を保存（NULL と区別）

---

## 7. 今後の拡張可能性

### 7.1 材料情報を活用した検索機能

- 材料名での検索機能
- 材料の組み合わせでの検索機能
- 材料の除外条件での検索機能

### 7.2 材料情報の可視化

- レシピ詳細ページに材料情報を表示
- 材料情報の編集機能

### 7.3 材料情報の分析

- よく使われる材料の統計
- 材料の組み合わせパターンの分析

---

## 8. 更新履歴

- 2024-XX-XX: 初版作成

