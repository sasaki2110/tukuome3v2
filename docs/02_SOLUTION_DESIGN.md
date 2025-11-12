# 設計ジレンマ解決策ドキュメント

## 1. 概要

本ドキュメントは、現行アプリケーション（つくおめ）の設計変更と新アプリケーション分離に関する設計ジレンマを解決するための提案書です。

---

## 2. 現状の課題と要望

### 2.1 設計者（開発者）の要望

1. **主材料の事前スクレイピング**: レシピ追加時に毎回スクレイピングするのではなく、主材料を事前にDBに保存しておきたい
2. **認証方式の変更**: メール認証＋Google認証に変更し、メールベリファイも実装したい（usersテーブルは別アプリで利用中）
3. **データ分離の最適化**: ユーザー別データは `rank`、`comment`、`folder` だけにして、他は全ユーザー共通にしたい
4. **モダンなNext.js実装**: 新アプリ（レノちゃん）は現行よりモダンなNext.jsの思想に沿った実装にしたい
   - App Routerの活用
   - Server Components / Client Componentsの適切な使い分け
   - Server Actionsの積極的な活用
   - 型安全性の向上
   - パフォーマンス最適化

### 2.2 管理者（オーナー利用者）の要望

1. **管理機能の保持**: 管理機能は現アプリ（つくおめ）に残したい
2. **ユーザー機能の分離**: ユーザー機能のみを新しいアプリとして構築したい
3. **データ連携**: つくおめでのメンテナンス結果を新アプリへ連携する必要がある

---

## 3. 解決策の全体像

### 3.1 アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────┐
│                    つくおめ（管理アプリ）                      │
│  - レシピのスクレイピング・登録                               │
│  - タグマスタのメンテナンス（現行設計）                        │
│  - レシピ情報の管理（repoテーブル、材料情報埋め込み）           │
│  - 管理者認証（現行通り：ハードコーディング）                  │
│  - データ連携スクリプト（INSERT文生成）                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ データ連携スクリプト
                       │ （INSERT文を生成）
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  レノちゃん（ユーザーアプリ）                    │
│  - レシピの閲覧・検索                                         │
│  - いいね（rank）機能                                         │
│  - コメント（comment）機能                                    │
│  - フォルダー（folder）機能                                   │
│  - ユーザー認証（メール+Google、メールベリファイ）            │
│  - 別PostgreSQLデータベース                                   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 データベース設計の分離

**注意**: この設計変更は**レノちゃん（新アプリ）のみ**で実施します。つくおめは現行通りのデータベース設計を維持します。

#### 3.2.1 共通データベース（全ユーザー共通） - レノちゃんのみ

**テーブル構成:**

**注意**: レノちゃん側のすべてのテーブルには`reno_`接頭子を付けます。

1. **reno_recipes** (レシピマスタ)
   - 全ユーザー共通のレシピ情報
   - 主キー: `recipe_id` (INTEGER)
   - レノちゃんで管理（つくおめからデータ連携）

2. **reno_tag_master** (タグマスタ)
   - 全ユーザー共通のタグマスタ
   - 主キー: `tag_id` (INTEGER)
   - レノちゃんで管理（つくおめからデータ連携）
   - つくおめの現行タグマスタ設計を継続使用

**注意**: 材料情報（ingredients）はレノちゃん側では不要です。材料情報はつくおめ側（管理機能）でのみ使用されます。

#### 3.2.2 ユーザー別データベース（レノちゃん）

**テーブル構成:**

1. **reno_user_recipe_preferences** (ユーザー別レシピ設定)
   - 主キー: `(user_id, recipe_id)`
   - カラム:
     - `user_id` (UUID, FK → reno_users)
     - `recipe_id` (INTEGER, FK → reno_recipes)
     - `rank` (INTEGER): 評価状態（0: いいねなし, 1: 好き, 2: まあまあ, 9: 好きじゃない）
     - `comment` (TEXT): ユーザーコメント

2. **reno_user_folders** (ユーザーフォルダー)
   - つくおめの現行フォルダー設計を継続使用
   - 主キー: `folder_id` (UUID)
   - カラム:
     - `user_id` (UUID, FK → reno_users)
     - `folder_id` (UUID)
     - `folder_name` (VARCHAR(255))
     - `id_of_recipes` (VARCHAR(2000)): フォルダーに含まれるレシピID（スペース区切り文字列）

3. **reno_users** (ユーザー)
   - レノちゃん専用のユーザーテーブル
   - カラム:
     - `user_id` (UUID, PK)
     - `email` (VARCHAR(255), UNIQUE)
     - `email_verified` (BOOLEAN)
     - `name` (VARCHAR(255))
     - `google_id` (VARCHAR(255), UNIQUE, NULLABLE)

#### 3.2.3 つくおめ（現行設計の維持）

つくおめは現行通りのデータベース設計を維持します：
- 既存の `repo` テーブルを継続使用
- 既存のタグマスタ設計を継続使用
- 既存のフォルダー設計を継続使用

---

## 4. 詳細設計

### 4.1 データベーススキーマ詳細

**注意**: 以下のスキーマは**レノちゃん（新アプリ）専用**です。つくおめは現行通りのデータベース設計を維持します。

#### 4.1.1 共通データベース（レノちゃん専用）

##### reno_recipes テーブル
```sql
CREATE TABLE reno_recipes (
    recipe_id INTEGER PRIMARY KEY,
    title VARCHAR(2000) NOT NULL,
    image_url VARCHAR(2000),
    tsukurepo_count INTEGER DEFAULT 0,
    is_main_dish BOOLEAN DEFAULT FALSE,
    is_sub_dish BOOLEAN DEFAULT FALSE,
    tag VARCHAR(2000) -- タグ（スペース区切り文字列、つくおめの現行設計に準拠）
);

CREATE INDEX idx_reno_recipes_tsukurepo ON reno_recipes(tsukurepo_count DESC);
```

**注意**: `recipe_id`はクックパッドのレシピID（`repo.id_n`）をそのまま使用します。`cookpad_recipe_id`カラムは不要のため削除しました。

**注意**: `recipe_ingredients`テーブルはレノちゃん側では不要です。材料情報はつくおめ側（管理機能）でのみ使用されます。

##### reno_tag_master テーブル
```sql
CREATE TABLE reno_tag_master (
    tag_id INTEGER PRIMARY KEY,
    level INTEGER,
    dispname VARCHAR(2000),
    name VARCHAR(2000),
    l VARCHAR(255) DEFAULT '',
    m VARCHAR(255) DEFAULT '',
    s VARCHAR(255) DEFAULT '',
    ss VARCHAR(255) DEFAULT ''
);

CREATE INDEX idx_reno_tag_master_level ON reno_tag_master(level);
CREATE INDEX idx_reno_tag_master_name ON reno_tag_master(name);
```

**注意**: つくおめの現行タグテーブル（`tag`テーブル）の設計を継続使用しますが、レノちゃん側では`userid`を削除して全ユーザー共通のマスタとして管理します。

**注意**: レシピとタグの関連は、`reno_recipes.tag`カラムにスペース区切りで格納します（つくおめの現行設計に準拠）。`reno_recipe_tags`テーブルは使用しません。

#### 4.1.2 ユーザー別データベース（レノちゃん専用）

##### reno_user_recipe_preferences テーブル
```sql
CREATE TABLE reno_user_recipe_preferences (
    user_id UUID NOT NULL,
    recipe_id INTEGER NOT NULL,
    rank INTEGER DEFAULT 0 CHECK (rank IN (0, 1, 2, 9)),
    comment TEXT,
    PRIMARY KEY (user_id, recipe_id),
    FOREIGN KEY (user_id) REFERENCES reno_users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_id) REFERENCES reno_recipes(recipe_id) ON DELETE CASCADE
);

CREATE INDEX idx_reno_user_recipe_prefs_user ON reno_user_recipe_preferences(user_id);
CREATE INDEX idx_reno_user_recipe_prefs_recipe ON reno_user_recipe_preferences(recipe_id);
CREATE INDEX idx_reno_user_recipe_prefs_rank ON reno_user_recipe_preferences(user_id, rank);
```

##### reno_user_folders テーブル
```sql
CREATE TABLE reno_user_folders (
    user_id UUID NOT NULL,
    folder_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_name VARCHAR(255) NOT NULL,
    id_of_recipes VARCHAR(2000),
    FOREIGN KEY (user_id) REFERENCES reno_users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_reno_user_folders_user ON reno_user_folders(user_id);
CREATE UNIQUE INDEX idx_reno_user_folders_user_name ON reno_user_folders(user_id, folder_name);
```

**注意**: つくおめの現行フォルダー設計を継続使用します。詳細なスキーマはつくおめの現行設計に準拠します。

##### reno_users テーブル（レノちゃん専用）

```sql
CREATE TABLE reno_users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    name VARCHAR(255),
    google_id VARCHAR(255) UNIQUE,
    image_url VARCHAR(2000)
);

CREATE INDEX idx_reno_users_email ON reno_users(email);
CREATE INDEX idx_reno_users_google_id ON reno_users(google_id);
```

**NextAuth.jsでのテーブル名カスタマイズ方法**:

Prismaアダプターを使用する場合、`schema.prisma`で`@@map`属性を使用してテーブル名を指定できます：

```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  emailVerified Boolean?  @map("email_verified")
  name          String?
  googleId      String?   @unique @map("google_id")
  image         String?   @map("image_url")

  @@map("reno_users") // データベース上のテーブル名を "reno_users" にマッピング
}
```

これにより、既存の`users`テーブルと競合することなく、NextAuth.jsを使用できます。

---

### 4.2 認証設計

**注意**: この設計変更は**レノちゃん（新アプリ）のみ**で実施します。つくおめは現行通りの認証方式（ハードコーディング）を維持します。

#### 4.2.1 つくおめ（管理アプリ）の認証

- **認証方式**: 現行通り（ハードコーディング）
- **変更なし**: 既存の認証方式を継続使用

#### 4.2.2 レノちゃん（新アプリ）の認証

- **認証方式**: NextAuth.js (Email Provider + Google Provider)
- **対象ユーザー**: 一般ユーザー
- **メールベリファイ**: 必須実装
- **usersテーブル**: レノちゃん専用のユーザーテーブル`reno_users`を作成
  - NextAuth.jsのPrismaアダプターで`@@map("reno_users")`属性を使用してテーブル名を指定

#### 4.2.3 認証フロー

```
1. ユーザーがログインページにアクセス
2. メール認証またはGoogle認証を選択
3. メール認証の場合:
   a. メールアドレスを入力
   b. メール認証リンクを送信
   c. メール内のリンクをクリック
   d. メールベリファイ完了
   e. ログイン完了
4. Google認証の場合:
   a. Google認証画面にリダイレクト
   b. Googleアカウントで認証
   c. 初回ログイン時はユーザー情報をDBに保存
   d. ログイン完了
```

---

### 4.3 データ連携設計

#### 4.3.1 データベース分離の方針

**方針**: レノちゃんとつくおめは**完全に別PostgreSQL**に分けます。

- **つくおめ**: 既存のPostgreSQLデータベースを継続使用
- **レノちゃん**: 新規のPostgreSQLデータベースを作成

#### 4.3.2 データ連携方式

**連携方式**: リアルタイム連携は諦め、**つくおめ側でスクリプトを作成してレノちゃんへのINSERT文を生成**します。

**実装方法**:

1. **つくおめ側スクリプトの作成**
   - つくおめのデータベースから必要なデータを抽出
   - レノちゃんのデータベース用のINSERT文を生成
   - 生成されたSQLファイルを出力

2. **データ連携のタイミング**
   - 手動実行: 管理者が必要に応じてスクリプトを実行
   - 定期実行: cron等で定期的に実行（オプション）

3. **連携対象データ**
   - `reno_recipes` テーブル: レシピ基本情報（`tag`カラムを含む）
   - `reno_tag_master` テーブル: タグマスタ（つくおめの`tag`テーブルから連携）

**注意**: 材料情報（ingredients）はレノちゃん側では不要のため、データ連携の対象外です。

4. **データマッピング詳細**

**repo → reno_recipes のマッピング:**
- `repo.id_n` → `reno_recipes.recipe_id` (主キー、クックパッドのレシピIDをそのまま使用)
- `repo.title` → `reno_recipes.title` (そのまま、作者名も含む)
- `repo.image` → `reno_recipes.image_url`
- `repo.reposu_n` → `reno_recipes.tsukurepo_count`
- `repo.ismain` → `reno_recipes.is_main_dish` (1 → TRUE, 0/9 → FALSE)
- `repo.issub` → `reno_recipes.is_sub_dish` (1 → TRUE, 0 → FALSE)
- `repo.tag` → `reno_recipes.tag` (そのまま)

**tag → reno_tag_master のマッピング:**
- `tag.id` → `reno_tag_master.tag_id` (主キー)
- `tag.level` → `reno_tag_master.level`
- `tag.dispname` → `reno_tag_master.dispname`
- `tag.name` → `reno_tag_master.name`
- `tag.l` → `reno_tag_master.l`
- `tag.m` → `reno_tag_master.m`
- `tag.s` → `reno_tag_master.s`
- `tag.ss` → `reno_tag_master.ss`
- **注意**: `tag.userid`は削除（全ユーザー共通マスタとして統合）

5. **ユーザーIDの扱い**
- つくおめの`repo`テーブルは`userid`が主キーの一部ですが、レノちゃん側では全ユーザー共通データとして扱います
- 連携時は**'sysop'ユーザーのデータのみを連携**します
- 重複する`recipe_id`（`repo.id_n`）がある場合は、全件移行時にUPSERT形式で上書きします

6. **スクリプト実装詳細**

**スクリプトの機能:**
- つくおめのデータベースからデータを抽出（毎回全件移行、'sysop'ユーザーのみ）
- レノちゃん用のINSERT文を生成（UPSERT形式: ON CONFLICT DO UPDATE）
- SQLファイルとして出力（1INSERT文1行形式）
- 重複チェック（`recipe_id`の主キー制約を利用）

**実装例:**

```typescript
// つくおめ側: データ連携スクリプト
async function generateInsertStatements() {
  const userId = 'sysop';
  
  // 1. レシピデータの抽出とINSERT文生成（毎回全件移行）
  const recipes = await db.query(
    'SELECT DISTINCT ON (id_n) * FROM repo WHERE userid = $1 ORDER BY id_n',
    [userId]
  );
  
  const recipeInserts = recipes.map(r => {
    return `INSERT INTO reno_recipes (recipe_id, title, image_url, tsukurepo_count, is_main_dish, is_sub_dish, tag) VALUES (${r.id_n}, ${escapeSQL(r.title || '')}, ${escapeSQL(r.image || '')}, ${r.reposu_n || 0}, ${r.ismain === 1}, ${r.issub === 1}, ${escapeSQL(r.tag || '')}) ON CONFLICT (recipe_id) DO UPDATE SET title = EXCLUDED.title, image_url = EXCLUDED.image_url, tsukurepo_count = EXCLUDED.tsukurepo_count, is_main_dish = EXCLUDED.is_main_dish, is_sub_dish = EXCLUDED.is_sub_dish, tag = EXCLUDED.tag;`;
  });
  
  // 2. タグマスタの抽出とINSERT文生成（tagテーブルから）
  const tags = await db.query(
    'SELECT * FROM tag WHERE userid = $1 ORDER BY id',
    [userId]
  );
  
  const tagInserts = tags.map(t =>
    `INSERT INTO reno_tag_master (tag_id, level, dispname, name, l, m, s, ss) VALUES (${t.id}, ${t.level !== null ? t.level : 'NULL'}, ${escapeSQL(t.dispname || '')}, ${escapeSQL(t.name || '')}, ${escapeSQL(t.l || '')}, ${escapeSQL(t.m || '')}, ${escapeSQL(t.s || '')}, ${escapeSQL(t.ss || '')}) ON CONFLICT (tag_id) DO UPDATE SET level = EXCLUDED.level, dispname = EXCLUDED.dispname, name = EXCLUDED.name, l = EXCLUDED.l, m = EXCLUDED.m, s = EXCLUDED.s, ss = EXCLUDED.ss;`
  );
  
  // 3. SQLファイルに出力（1INSERT文1行形式）
  const sqlContent = [
    '-- レノちゃん用データ連携SQL',
    '-- 生成日時: ' + new Date().toISOString(),
    '',
    ...recipeInserts,
    '',
    ...tagInserts
  ].join('\n');
  
  await fs.writeFile('lenochan_inserts.sql', sqlContent);
}
```

**注意事項**:
- データの整合性チェックが必要（重複データの回避など）
- UPSERT形式（ON CONFLICT DO UPDATE）を使用して重複を回避
- エラーハンドリングとログ出力
- SQLインジェクション対策（`escapeSQL`関数を使用）
- INSERT文は1行形式で出力（可読性よりもファイルサイズを優先）

---

### 4.4 主材料の事前スクレイピング設計

**注意**: この機能は**つくおめ側のみ**で実施します。レノちゃん側では材料情報は不要です。材料情報は管理機能（レシピ登録・変更）でのみ使用されます。

#### 4.4.1 つくおめでの実装

**実装方式**: 材料情報を`repo`テーブルに埋め込みます。

- **カラム追加**: `repo`テーブルに材料情報を格納するカラムを追加（JSON形式またはTEXT形式）
- **スクレイピングタイミング**: レシピ追加時に材料情報も取得して`repo`テーブルに保存
- **データ形式**: JSON配列または区切り文字で材料名を保存

**実装例**:

```typescript
// つくおめ: レシピ追加時の処理
async function addRecipe(recipeId: number) {
  // 1. レシピ基本情報をスクレイピング
  const recipeInfo = await scrapeUrl(`https://cookpad.com/recipe/${recipeId}`);
  
  // 2. repoテーブルに保存（材料情報も含める）
  await insertRepo({
    recipe_id: recipeId,
    title: recipeInfo.title,
    image_url: recipeInfo.image,
    // ... 既存のカラム
    ingredients: JSON.stringify(recipeInfo.ingredients), // 材料情報をJSON形式で埋め込み
    // または
    ingredients_text: recipeInfo.ingredients.join(','), // カンマ区切りで埋め込み
  });
}
```

#### 4.4.2 スクレイピングタイミング

**方式1: レシピ追加時に自動スクレイピング**
- レシピ追加時に材料情報も取得
- `repo`テーブルに埋め込み

**方式2: バッチ処理で一括スクレイピング**
- 定期的に未取得のレシピをスクレイピング
- つくれぽ数の更新も同時に実行

**推奨: 方式1 + 方式2のハイブリッド**
- レシピ追加時は即座にスクレイピング
- バッチ処理で定期的に材料情報とつくれぽ数を更新

---

## 5. 移行計画

### 5.1 フェーズ1: つくおめの機能追加（材料情報の埋め込み）

1. **repoテーブルの拡張**
   - `repo`テーブルに材料情報を格納するカラムを追加（JSON形式またはTEXT形式）
   - 既存データへの影響を最小限に

2. **スクレイピング機能の拡張**
   - レシピ追加時に材料情報も取得
   - 材料情報を`repo`テーブルに埋め込む処理を実装
   - 既存レシピへの材料情報追加（バッチ処理）

**注意**: つくおめの認証、タグマスタ、フォルダー設計は変更しません（現行通り）。

### 5.2 フェーズ2: レノちゃん（新アプリ）のデータベース構築

1. **レノちゃん専用PostgreSQLデータベースの作成**
   - 新規PostgreSQLデータベースを構築
   - つくおめとは完全に分離

2. **データベーススキーマの作成**
   - `reno_recipes` テーブル作成（`tag`カラムを含む）
   - `reno_tag_master` テーブル作成（つくおめの現行設計に準拠）
   - `reno_users` テーブル作成（レノちゃん専用）
   - `reno_user_recipe_preferences` テーブル作成
   - `reno_user_folders` テーブル作成（つくおめの現行設計に準拠）

**注意**: `recipe_ingredients`テーブルは作成しません。材料情報はレノちゃん側では不要です。

### 5.3 フェーズ3: つくおめ側データ連携スクリプトの作成

1. **データ抽出スクリプトの実装**
   - つくおめの`repo`テーブルからレシピデータを抽出（`tag`カラムも含む）
   - つくおめの現行タグマスタを`reno_tag_master`に連携

**注意**: 材料情報はレノちゃん側では不要のため、データ連携の対象外です。

2. **INSERT文生成スクリプトの実装**
   - 抽出したデータからレノちゃん用のINSERT文を生成
   - SQLファイルとして出力
   - データ整合性チェック機能

3. **スクリプトのテスト**
   - テストデータでの動作確認
   - 生成されたSQLファイルの検証

### 5.4 フェーズ4: レノちゃん（新アプリ）の構築

1. **プロジェクトセットアップ**
   - Next.js 15+ プロジェクト作成
   - レノちゃん専用PostgreSQLデータベースへの接続設定

2. **認証実装**
   - NextAuth.jsのEmail Provider + Google Provider実装
   - メールベリファイ実装
   - `reno_users`テーブルの実装
   - Prismaアダプターで`@@map("reno_users")`属性を使用してテーブル名を指定

3. **ユーザー機能の実装**
   - レシピ一覧・検索機能
   - いいね機能（`reno_user_recipe_preferences`テーブル使用）
   - コメント機能（`reno_user_recipe_preferences`テーブル使用）
   - フォルダー機能（`reno_user_folders`テーブル使用）

4. **データ取得機能の実装**
   - つくおめから生成されたINSERT文を実行してデータを投入
   - データ更新時の再投入手順の確立

### 5.5 フェーズ5: データ移行とテスト

1. **初期データの移行**
   - つくおめ側スクリプトでINSERT文を生成
   - レノちゃんのデータベースにINSERT文を実行
   - データ整合性の確認

2. **既存ユーザーデータの移行（該当する場合）**
   - `rank` データの移行（つくおめから抽出してレノちゃんへ）
   - `comment` データの移行
   - `folder` データの移行

3. **テスト**
   - 機能テスト
   - パフォーマンステスト
   - データ整合性テスト
   - データ連携スクリプトの動作確認

### 5.6 フェーズ6: 本番リリースと運用

1. **段階的リリース**
   - ベータ版リリース
   - フィードバック収集
   - 本番リリース

2. **運用体制の確立**
   - データ連携スクリプトの定期実行スケジュール
   - データ更新時の手順確立
   - モニタリング体制

---

## 6. 技術的な考慮事項

### 6.1 パフォーマンス

#### 6.1.1 インデックス戦略

- `reno_recipes` テーブル: `cookpad_recipe_id`, `author_name`, `tsukurepo_count` にインデックス
- `reno_tag_master` テーブル: つくおめの現行設計に準拠したインデックス
- `reno_user_recipe_preferences` テーブル: `user_id`, `recipe_id`, `(user_id, rank)` にインデックス
- `reno_user_folders` テーブル: つくおめの現行設計に準拠したインデックス

**注意**: `recipe_ingredients`テーブルはレノちゃん側では不要のため、インデックス戦略の対象外です。

#### 6.1.2 クエリ最適化

- JOINクエリの最適化
- ページネーションの実装（LIMIT/OFFSET またはカーソルベース）
- キャッシュ戦略（Redis等）

### 6.2 セキュリティ

#### 6.2.1 データアクセス制御

- 共通データ: 全ユーザーが読み取り可能
- ユーザー別データ: 該当ユーザーのみアクセス可能
- Row Level Security (RLS) の検討

#### 6.2.2 認証・認可

- JWT トークンの適切な管理
- メールベリファイの実装
- CSRF対策

### 6.3 スケーラビリティ

#### 6.3.1 データベース

- 読み取りレプリカの検討
- パーティショニングの検討（将来的に）

#### 6.3.2 アプリケーション

- キャッシュ戦略
- CDNの活用（画像等）
- 負荷分散

---

## 7. リスクと対策

### 7.1 データ移行のリスク

**リスク**: 既存データの移行時にデータ損失や不整合が発生する可能性

**対策**:
- 移行前のバックアップ
- 移行スクリプトのテスト
- 段階的な移行
- ロールバック計画

### 7.2 パフォーマンスのリスク

**リスク**: データベース共有によりパフォーマンスが低下する可能性

**対策**:
- 適切なインデックス設計
- クエリの最適化
- キャッシュの活用
- モニタリング

### 7.3 認証のリスク

**リスク**: メールベリファイの実装が複雑

**対策**:
- NextAuth.jsの標準機能を活用
- メール送信サービスの選定（SendGrid、AWS SES等）
- テスト環境での十分なテスト

---

## 8. まとめ

### 8.1 解決策の要点

1. **データベース設計の分離**: レノちゃんとつくおめは別PostgreSQLに分離、つくおめは現行通りを維持
2. **主材料の事前保存**: つくおめ側のみ実施、`repo`テーブルに埋め込み。レノちゃん側では材料情報は不要
3. **認証の改善**: レノちゃんのみメール認証＋Google認証、メールベリファイ実装、つくおめは現行通り（ハードコーディング）
4. **データ連携**: 完全に別PostgreSQLに分離、つくおめ側でスクリプトを作成してレノちゃんへのINSERT文を生成

### 8.2 次のステップ

1. 本ドキュメントのレビュー・承認
2. データベーススキーマの詳細設計
3. 移行計画の詳細化
4. プロトタイプの作成
5. 段階的な実装・移行

---

## 9. 参考資料

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Database Design Best Practices](https://www.postgresql.org/docs/current/ddl.html)

---

## 10. 更新履歴

- 2024-XX-XX: 初版作成

