# データベース DDL (Data Definition Language)

このドキュメントには、アプリケーションで使用するすべてのテーブルのCREATE TABLE文を記載します。

## 使用方法

このドキュメントには、Vercelのダッシュボードから取得した実際のテーブル定義を記載しています。

---

## テーブル一覧

### 1. repo (レシピテーブル)

```sql
CREATE TABLE repo (
    userid VARCHAR(2000) NOT NULL,
    id_n INTEGER NOT NULL,
    image VARCHAR(2000),
    title VARCHAR(2000),
    rank INTEGER,
    reposu_n INTEGER,
    comment VARCHAR(2000),
    tag VARCHAR(2000),
    ismain INTEGER,
    issub INTEGER,
    ingredients JSONB,
    CONSTRAINT repo_pkey PRIMARY KEY (userid, id_n)
);

CREATE UNIQUE INDEX repo_pkey ON repo USING BTREE (userid, id_n);
```

**説明:**
- レシピ情報を格納するテーブル
- 主キー: (userid, id_n)
- `rank`: いいね状態 (0または1)
- `reposu_n`: つくれぽ数
- `ismain`: 主菜フラグ
- `issub`: 副菜フラグ
- `ingredients`: 材料情報（JSONB形式の配列、例: `["鶏もも肉 1枚", "玉ねぎ 1個"]`）

---

### 2. tag (タグテーブル)

```sql
CREATE TABLE tag (
    userid VARCHAR(2000) NOT NULL,
    id INTEGER NOT NULL,
    level INTEGER,
    dispname VARCHAR(2000),
    name VARCHAR(2000),
    l VARCHAR(255) DEFAULT '',
    m VARCHAR(255) DEFAULT '',
    s VARCHAR(255) DEFAULT '',
    ss VARCHAR(255) DEFAULT '',
    CONSTRAINT tag_pkey PRIMARY KEY (userid, id)
);

CREATE UNIQUE INDEX tag_pkey ON tag USING BTREE (userid, id);
```

**説明:**
- タグ情報を格納するテーブル
- 主キー: (userid, id)
- `level`: タグのレベル (0:大タグ, 1:中タグ, 2:小タグ, 3:極小タグ)
- `l`, `m`, `s`, `ss`: 階層構造を保持するカラム（VARCHAR(255)、デフォルト値は空文字列）

---

### 3. folder (フォルダーテーブル)

> ⚠️ **注意**: Vercelのダッシュボードでは制約やインデックスが表示されていませんでしたが、コードベースから推測すると主キー(userid, foldername)が存在する可能性があります。実際のデータベースで確認してください。

```sql
CREATE TABLE folder (
    userid VARCHAR(2000),
    foldername VARCHAR(2000),
    idofrepos VARCHAR(2000)
);
```

**説明:**
- フォルダー情報を格納するテーブル
- 主キー: Vercelのダッシュボードでは表示されていませんが、コードベースから推測すると(userid, foldername)が主キーの可能性があります
- `idofrepos`: フォルダーに含まれるレシピIDをスペース区切りで格納

---

### 4. mastertag (マスタータグテーブル)

```sql
CREATE TABLE mastertag (
    userid VARCHAR(2000),
    gen INTEGER,
    id INTEGER,
    l VARCHAR(2000),
    m VARCHAR(2000),
    s VARCHAR(2000),
    ss VARCHAR(2000),
    CONSTRAINT mastertag_pkey PRIMARY KEY (userid, gen, id)
);

CREATE UNIQUE INDEX mastertag_pkey ON mastertag USING BTREE (userid, gen, id);
```

**説明:**
- マスタータグ情報を格納するテーブル
- 主キー: (userid, gen, id)
- `gen`: 世代 (0: 前世代, 1: 現世代)

---

## 注意事項

1. **NOT NULL制約**: Vercelのダッシュボードでは明確に表示されていないため、主キーのカラムはNOT NULLとしていますが、実際のデータベースで確認してください
2. **folderテーブル**: Vercelのダッシュボードでは制約やインデックスが表示されていませんでしたが、コードベースから推測すると主キー(userid, foldername)が存在する可能性があります
3. **Row Level Security (RLS)**: すべてのテーブルでRLSは無効でした

---

## 更新履歴

- 2024-XX-XX: `repo`テーブルに`ingredients`カラム（JSONB型）を追加
- 2024-XX-XX: Vercelダッシュボードから取得した実際の定義に更新
- 2024-XX-XX: 初版作成

